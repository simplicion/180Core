'use strict';

/**
 * Paytm for Business connector (merchant-account auto verification).
 *
 * How it works (same model NineTech Pay uses for its "Paytm for Business" accounts):
 *   1. The checkout shows a dynamic UPI QR / intent addressed to the merchant's Paytm Business VPA
 *      with `tr=<orderId>` and the exact amount. Because the payee is a *merchant* VPA, `tr` is
 *      honoured by the payer app and Paytm records the payment against that orderId.
 *   2. While the customer pays, `/sessions/:id/status` (and the background reconciler) calls
 *      Paytm's official Transaction Status API (`/v3/order/status`) with the merchant's MID,
 *      signed with the merchant key using Paytm's checksum algorithm.
 *   3. `TXN_SUCCESS` + matching amount => session is captured, no UTR typing or bank SMS needed.
 *
 * Credentials come from Paytm for Business dashboard -> Developer Settings -> API Keys
 * (Production MID + Merchant Key). Personal Paytm / UPI handles have no MID, so they cannot
 * use this connector.
 */

import crypto from 'crypto';
import axios from 'axios';

const PAYTM_IV = '@@@@&&&&####$$$$';

export const PAYTM_STATUS_URLS = {
  production: 'https://securegw.paytm.in/v3/order/status',
  staging: 'https://securegw-stage.paytm.in/v3/order/status',
} as const;

/** Paytm MIDs are alphanumeric, usually 20 chars (e.g. "AbCdEf12345678901234"). */
export function isValidPaytmMid(mid: string): boolean {
  return typeof mid === 'string' && /^[A-Za-z0-9]{10,30}$/.test(mid.trim());
}

/** Paytm merchant keys are 16 chars (AES-128 key). Some legacy keys contain symbols like # @ & %. */
export function isValidPaytmMerchantKey(key: string): boolean {
  return typeof key === 'string' && Buffer.byteLength(key.trim(), 'utf8') === 16;
}

/**
 * Paytm orderId rules: alphanumerics plus - _ @ . ; max 50 chars.
 * `attempt` > 0 gives a fresh id after a failed payment, so a retry is never tied to a failed order.
 */
export function buildPaytmOrderId(sessionId: string, attempt: number = 0): string {
  const base = `180P${sessionId.replace(/[^A-Za-z0-9]/g, '').slice(0, 30)}`;
  return attempt > 0 ? `${base}R${attempt}` : base;
}

function aesEncrypt(plain: string, key: string): string {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(PAYTM_IV, 'utf8'));
  return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('base64');
}

function aesDecrypt(encrypted: string, key: string): string {
  const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(PAYTM_IV, 'utf8'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

/** Port of Paytm's official `PaytmChecksum.generateSignature` (string body variant). */
export function generatePaytmSignature(body: string, merchantKey: string, salt?: string): string {
  const s = salt || crypto.randomBytes(3).toString('base64').slice(0, 4);
  const hash = crypto.createHash('sha256').update(`${body}|${s}`).digest('hex');
  return aesEncrypt(hash + s, merchantKey);
}

/** Port of Paytm's official `PaytmChecksum.verifySignature` (string body variant). */
export function verifyPaytmSignature(body: string, merchantKey: string, signature: string): boolean {
  try {
    const decrypted = aesDecrypt(signature, merchantKey);
    const salt = decrypted.slice(-4);
    const expected = crypto.createHash('sha256').update(`${body}|${salt}`).digest('hex') + salt;
    const a = Buffer.from(decrypted);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface PaytmOrderStatus {
  /** TXN_SUCCESS | PENDING | TXN_FAILURE | NO_RECORD (order not found yet) | ERROR */
  status: 'TXN_SUCCESS' | 'PENDING' | 'TXN_FAILURE' | 'NO_RECORD' | 'ERROR';
  resultCode?: string;
  resultMsg?: string;
  /** True only when Paytm explicitly rejected the MID / merchant key. */
  credentialError?: boolean;
  txnId?: string;
  bankTxnId?: string;
  txnAmount?: number;
  paymentMode?: string;
  txnDate?: string;
  raw?: any;
}

/**
 * Calls Paytm's Transaction Status API for `orderId`.
 * Never throws for business outcomes; network/auth problems come back as status 'ERROR'.
 */
export async function fetchPaytmOrderStatus(input: {
  mid: string;
  merchantKey: string;
  orderId: string;
  environment?: 'production' | 'staging';
  timeoutMs?: number;
}): Promise<PaytmOrderStatus> {
  const { mid, merchantKey, orderId } = input;
  const bodyObj = { mid: mid.trim(), orderId };
  const bodyStr = JSON.stringify(bodyObj);
  const signature = generatePaytmSignature(bodyStr, merchantKey.trim());
  const url = PAYTM_STATUS_URLS[input.environment || 'production'];

  try {
    const res = await axios.post(
      url,
      // Body must be serialized exactly as signed.
      `{"body":${bodyStr},"head":{"signature":"${signature}"}}`,
      { headers: { 'Content-Type': 'application/json' }, timeout: input.timeoutMs ?? 6000 },
    );
    const body = res.data?.body || {};
    const info = body.resultInfo || {};
    const resultStatus = String(info.resultStatus || '').toUpperCase();
    const resultCode = String(info.resultCode || '');

    let status: PaytmOrderStatus['status'];
    const credentialError =
      ['330', '335'].includes(resultCode) || (!body.txnId && /checksum|invalid mid/i.test(String(info.resultMsg || '')));
    // Credential errors come back as TXN_FAILURE too; they are config errors, not a failed payment.
    // 330 = checksum mismatch (wrong merchant key), 335 = invalid MID.
    if (credentialError) {
      status = 'ERROR';
    }
    // 334 = "Invalid Order Id": nothing recorded yet, i.e. the customer has not paid.
    else if (resultCode === '334') status = 'NO_RECORD';
    else if (resultStatus === 'TXN_SUCCESS') status = 'TXN_SUCCESS';
    else if (resultStatus === 'TXN_FAILURE') status = 'TXN_FAILURE';
    else if (resultStatus === 'PENDING') status = 'PENDING';
    else status = 'ERROR';

    return {
      status,
      resultCode,
      resultMsg: info.resultMsg,
      credentialError,
      txnId: body.txnId,
      bankTxnId: body.bankTxnId,
      txnAmount: body.txnAmount !== undefined ? parseFloat(body.txnAmount) : undefined,
      paymentMode: body.paymentMode,
      txnDate: body.txnDate,
      raw: res.data,
    };
  } catch (err: any) {
    return { status: 'ERROR', resultMsg: err?.message || 'Paytm status request failed' };
  }
}

/**
 * Probes credentials by querying a random, non-existent order.
 * Valid MID + key => "order not found" (NO_RECORD). Bad key/MID => checksum / merchant error.
 */
export async function testPaytmCredentials(mid: string, merchantKey: string) {
  const probe = await fetchPaytmOrderStatus({
    mid,
    merchantKey,
    orderId: `180PROBE${Date.now()}`,
  });
  return {
    /** Paytm answered "order not found": MID + key are accepted. */
    ok: probe.status === 'NO_RECORD',
    /** Paytm explicitly rejected the MID or key: block saving. Anything else (network, unexpected code) is inconclusive. */
    rejected: Boolean(probe.credentialError),
    resultCode: probe.resultCode,
    message: probe.resultMsg,
  };
}
