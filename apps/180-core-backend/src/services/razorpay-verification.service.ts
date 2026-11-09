/**
 * 180 Identity - Bank account (penny drop) & UPI VPA verification
 * Location: apps/180-core-backend/src/services/razorpay-verification.service.ts
 *
 * Provider selection: VERIFY_PROVIDER_MODE / VERIFY_RAZORPAY_MODE = mock | live (see verification/config.ts).
 * No silent fallback: live failures throw ProviderUnavailableError (HTTP 502). The registered name
 * is ONLY what the beneficiary bank / NPCI returned; it never falls back to an expected name.
 *
 * Live flow (RazorpayX Fund Account Validation, per https://razorpay.com/docs/api/x/account-validation/
 * and https://razorpay.com/docs/x/fund-account-validation/):
 *   1. POST /v1/contacts                    { name, type:'customer', reference_id, notes }
 *   2. POST /v1/fund_accounts               { contact_id, account_type:'bank_account', bank_account:{ name, ifsc, account_number } }
 *   3. POST /v1/fund_accounts/validations   { account_number: RAZORPAYX_ACCOUNT_NUMBER (source/debit account),
 *                                             fund_account:{ id }, amount:100, currency:'INR', notes }
 *      -> status 'created' (async) | 'completed' | 'failed';
 *         results.account_status 'active'|'invalid', results.registered_name
 *   4. While 'created': GET /v1/fund_accounts/validations/:id with exponential backoff up to
 *      VERIFY_PENNY_DROP_MAX_WAIT_MS (default 30s); otherwise return PENDING with the validation id
 *      (resumable via pollBankValidation). Webhook `fund_account.validation.completed` is an alternative.
 * UPI: POST /v1/payments/validate/vpa { vpa } -> { vpa, success, customer_name }
 *   (https://razorpay.com/docs/api/payments/validate-vpa/ - TODO(razorpay-activation): confirm this
 *    endpoint is enabled on the merchant account; Razorpay also supports VPA fund-account validation.)
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { getEnvironment, getRazorpayMode } from './verification/config';
import { ProviderUnavailableError, ValidationError } from './verification/errors';
import { mockRegistry } from './verification/mock-registry';
import { maskAccount, maskVpa } from './verification/pii';
import { validateAccountNumber, validateIfsc, validateVpa } from './verification/validators';
import type { BankAccountRecord, BankRegistryProvider, UpiRecord } from './verification/types';

export type { BankAccountRecord, UpiRecord } from './verification/types';

function cleanEnv(v?: string): string {
  return (v || '').trim().replace(/^['"]|['"]$/g, '');
}

const PLACEHOLDER_HOLDER = '180 Verify Beneficiary';

export class RazorpayLiveAdapter implements BankRegistryProvider {
  private http: AxiosInstance;
  private sourceAccount: string;
  private maxWaitMs: number;

  constructor() {
    const keyId = cleanEnv(process.env.RAZORPAY_KEY_ID);
    const keySecret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
    if (!keyId || !keySecret) {
      throw new ProviderUnavailableError('RAZORPAY', 'Razorpay live mode is enabled but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.');
    }
    this.sourceAccount = cleanEnv(process.env.RAZORPAYX_ACCOUNT_NUMBER);
    this.maxWaitMs = Number(process.env.VERIFY_PENNY_DROP_MAX_WAIT_MS || 30000);
    this.http = axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      timeout: 10000,
      auth: { username: keyId, password: keySecret },
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  }

  private async call<T = any>(method: 'get' | 'post', path: string, body: any, label: string): Promise<{ status: number; data: any }> {
    try {
      const res = method === 'get' ? await this.http.get(path) : await this.http.post(path, body);
      return { status: res.status, data: res.data };
    } catch (err: any) {
      throw new ProviderUnavailableError('RAZORPAY', `${label}: request failed (${err?.code || err?.message || 'network error'}).`);
    }
  }

  private fail(label: string, r: { status: number; data: any }): never {
    const code = r.data?.error?.code;
    console.warn(`[RazorpayVerification] ${label} upstream status=${r.status} code=${code || 'n/a'}`);
    throw new ProviderUnavailableError('RAZORPAY', `${label}: Razorpay returned ${r.status}${code ? ` (${code})` : ''}.`, {
      upstreamStatus: r.status,
      upstreamCode: code,
    });
  }

  private mapValidation(d: any, accountNumber: string, ifsc: string): BankAccountRecord {
    const base = {
      provider: 'RAZORPAY' as const,
      environment: getEnvironment(),
      accountMasked: maskAccount(accountNumber),
      ifsc,
      validationId: d?.id,
      txnId: d?.id,
    };
    const status = String(d?.status || '').toLowerCase();
    if (status === 'created') return { ...base, found: true, accountStatus: 'PENDING' };
    if (status === 'failed') {
      // Validation could not be completed (e.g. beneficiary bank offline). Not a verdict on the account.
      throw new ProviderUnavailableError('RAZORPAY', 'Bank account validation could not be completed by the beneficiary bank. Please retry.');
    }
    if (status !== 'completed') throw new ProviderUnavailableError('RAZORPAY', `Unexpected fund account validation status '${status || 'missing'}'.`);
    const results = d.results || d.validation_results || {};
    const active = String(results.account_status || '').toLowerCase() === 'active';
    const registered = typeof results.registered_name === 'string' && results.registered_name.trim() ? results.registered_name.trim().toUpperCase() : undefined;
    return {
      ...base,
      found: active,
      accountStatus: active ? 'ACTIVE' : 'INVALID',
      registeredName: active ? registered : undefined, // never substituted with an expected name
      bankName: d.fund_account?.bank_account?.bank_name || undefined,
      utrPresent: Boolean(results.utr),
    };
  }

  async verifyBankAccount(input: { accountNumber: string; ifsc: string; referenceId?: string }): Promise<BankAccountRecord> {
    if (!this.sourceAccount) {
      throw new ProviderUnavailableError('RAZORPAY', 'RAZORPAYX_ACCOUNT_NUMBER is not configured (required as the penny-drop source account).');
    }
    const ref = (input.referenceId || 'vfy_' + crypto.randomBytes(6).toString('hex')).slice(0, 40);
    const contact = await this.call('post', '/contacts', { name: PLACEHOLDER_HOLDER, type: 'customer', reference_id: ref, notes: { purpose: '180_verify_penny_drop' } }, 'Create contact');
    if (contact.status >= 300 || !contact.data?.id) this.fail('Create contact', contact);

    const fa = await this.call(
      'post',
      '/fund_accounts',
      {
        contact_id: contact.data.id,
        account_type: 'bank_account',
        // bank_account.name is a required field but is NOT what the bank returns; the bank's
        // registered_name comes back on the validation and is the only name we use.
        bank_account: { name: PLACEHOLDER_HOLDER, ifsc: input.ifsc, account_number: input.accountNumber },
      },
      'Create fund account'
    );
    if (fa.status >= 300 || !fa.data?.id) {
      if (fa.status === 400) throw new ValidationError('INVALID_BANK_DETAILS', 'The bank rejected the account number / IFSC combination.');
      this.fail('Create fund account', fa);
    }

    const val = await this.call(
      'post',
      '/fund_accounts/validations',
      { account_number: this.sourceAccount, fund_account: { id: fa.data.id }, amount: 100, currency: 'INR', notes: { purpose: '180_verify_penny_drop', ref } },
      'Create validation'
    );
    if (val.status >= 300 || !val.data?.id) this.fail('Create validation', val);

    let record = this.mapValidation(val.data, input.accountNumber, input.ifsc);
    const started = Date.now();
    let delay = 1000;
    while (record.accountStatus === 'PENDING' && Date.now() - started + delay <= this.maxWaitMs) {
      await new Promise((r) => setTimeout(r, delay));
      record = await this.pollBankValidation(val.data.id, input.accountNumber, input.ifsc);
      delay = Math.min(delay * 2, 8000);
    }
    return record;
  }

  async pollBankValidation(validationId: string, accountNumber: string, ifsc: string): Promise<BankAccountRecord> {
    const r = await this.call('get', `/fund_accounts/validations/${encodeURIComponent(validationId)}`, null, 'Fetch validation');
    if (r.status >= 300 || !r.data?.id) this.fail('Fetch validation', r);
    return this.mapValidation(r.data, accountNumber, ifsc);
  }

  async validateVpa(input: { vpa: string }): Promise<UpiRecord> {
    const r = await this.call('post', '/payments/validate/vpa', { vpa: input.vpa }, 'Validate VPA');
    const base = { provider: 'RAZORPAY' as const, environment: getEnvironment(), vpaMasked: maskVpa(input.vpa) };
    if (r.status === 200) {
      const ok = r.data?.success !== false;
      const name = typeof r.data?.customer_name === 'string' && r.data.customer_name.trim() ? r.data.customer_name.trim().toUpperCase() : undefined;
      return { ...base, found: ok, customerName: ok ? name : undefined };
    }
    const desc = String(r.data?.error?.description || '');
    if (r.status === 400 && /invalid vpa|not.*valid.*(vpa|virtual payment address)/i.test(desc)) {
      return { ...base, found: false };
    }
    this.fail('Validate VPA', r);
  }
}

export class RazorpayVerificationService {
  private live: RazorpayLiveAdapter | null = null;

  private provider(): BankRegistryProvider {
    if (getRazorpayMode() === 'mock') return mockRegistry;
    if (!this.live) this.live = new RazorpayLiveAdapter();
    return this.live;
  }

  public reset(): void {
    this.live = null;
  }

  public async validateUpi(vpa: string): Promise<UpiRecord> {
    const check = validateVpa(vpa);
    if (!check.valid) throw new ValidationError('INVALID_VPA', check.reason!);
    return this.provider().validateVpa({ vpa: check.normalized });
  }

  public async verifyBankAccount(accountNumber: string, ifsc: string, referenceId?: string): Promise<BankAccountRecord> {
    const acc = validateAccountNumber(accountNumber);
    if (!acc.valid) throw new ValidationError('INVALID_ACCOUNT_NUMBER', acc.reason!);
    const code = validateIfsc(ifsc);
    if (!code.valid) throw new ValidationError('INVALID_IFSC', code.reason!);
    return this.provider().verifyBankAccount({ accountNumber: acc.normalized, ifsc: code.normalized, referenceId });
  }

  public async pollBankValidation(validationId: string, accountNumber: string, ifsc: string): Promise<BankAccountRecord> {
    return this.provider().pollBankValidation(validationId, accountNumber, ifsc);
  }
}

export const razorpayVerificationService = new RazorpayVerificationService();
export default razorpayVerificationService;
