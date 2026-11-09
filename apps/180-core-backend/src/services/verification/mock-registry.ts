/**
 * 180 Verify - deterministic MOCK registry (sandbox provider).
 *
 * Rules (documented in ./README.md, which is the source of truth for testers):
 *  - Responses are driven ONLY by the document number. User-supplied names / DOBs are never
 *    echoed back, so name and DOB matching are exercised for real.
 *  - Any well-formed number that is not in the fixture table returns NOT_FOUND (found:false).
 *  - Every call waits 100-400 ms to mimic upstream latency (override with VERIFY_MOCK_LATENCY_MS
 *    for tests; e.g. VERIFY_MOCK_LATENCY_MS=0).
 *  - Fixture PAN ZZZPZ9999Z / account 999999999999 simulate an upstream outage (502 PROVIDER_UNAVAILABLE).
 */

import crypto from 'crypto';
import { ProviderUnavailableError } from './errors';
import { maskAccount, maskId, maskPan, maskVpa } from './pii';
import { panCategory } from './validators';
import type {
  BankAccountRecord,
  BankRegistryProvider,
  DrivingLicenseRecord,
  GstinRecord,
  IdentityRegistryProvider,
  PanRecord,
  UpiRecord,
  VehicleRcRecord,
  VoterRecord,
} from './types';

// ─── Personas ────────────────────────────────────────────────────────────────
export const PERSONA_ARJUN = {
  name: 'ARJUN VIKRAM MEHTA',
  dob: '1990-04-12',
  fatherName: 'VIKRAM SINGH MEHTA',
  gender: 'MALE' as const,
};
export const PERSONA_PRIYA = {
  name: 'PRIYA RAMESH IYER',
  dob: '1994-11-03',
  fatherName: 'RAMESH IYER',
  gender: 'FEMALE' as const,
};

// ─── Fixture tables (keyed by normalized number) ──────────────────────────────
interface PanFixture { name: string; dob?: string; fatherName?: string; gender?: 'MALE' | 'FEMALE' | 'OTHER'; status: PanRecord['status']; aadhaarSeeded: boolean }
export const PAN_FIXTURES: Record<string, PanFixture> = {
  AFZPM4821K: { ...PERSONA_ARJUN, status: 'VALID', aadhaarSeeded: true }, // happy path
  BKDPS7310L: { name: 'SURESH KUMAR SHARMA', dob: '1990-04-12', fatherName: 'MAHESH SHARMA', gender: 'MALE', status: 'VALID', aadhaarSeeded: true }, // name mismatch vs Arjun
  CQRPX5555Z: { ...PERSONA_ARJUN, status: 'DEACTIVATED', aadhaarSeeded: false }, // suspended / invalid PAN
  DJKPM1111A: { ...PERSONA_ARJUN, status: 'INOPERATIVE', aadhaarSeeded: false }, // inoperative (not Aadhaar-linked)
  AGJPI2468B: { ...PERSONA_PRIYA, status: 'VALID', aadhaarSeeded: true }, // second persona (female, initials on voter roll)
};

interface DlFixture { name: string; dob: string; fatherName?: string; gender?: 'MALE' | 'FEMALE' | 'OTHER'; status: DrivingLicenseRecord['status']; issueDate: string; validTill: string; vehicleClasses: string[] }
export const DL_FIXTURES: Record<string, DlFixture> = {
  MH0220190012345: { ...PERSONA_ARJUN, status: 'ACTIVE', issueDate: '2019-05-20', validTill: '2040-04-11', vehicleClasses: ['LMV', 'MCWG'] }, // happy path
  KA0120150045678: { ...PERSONA_ARJUN, dob: '1988-01-01', status: 'ACTIVE', issueDate: '2015-02-10', validTill: '2038-01-01', vehicleClasses: ['LMV'] }, // DOB mismatch
  DL0420100098765: { ...PERSONA_ARJUN, status: 'EXPIRED', issueDate: '2010-07-01', validTill: '2020-06-30', vehicleClasses: ['LMV'] }, // expired
  TN0920170033333: { ...PERSONA_ARJUN, status: 'SUSPENDED', issueDate: '2017-03-15', validTill: '2037-03-14', vehicleClasses: ['LMV'] }, // suspended
  KL0720160024680: { name: 'PRIYA R IYER', dob: PERSONA_PRIYA.dob, fatherName: 'RAMESH IYER', gender: 'FEMALE', status: 'ACTIVE', issueDate: '2016-12-01', validTill: '2036-11-02', vehicleClasses: ['MCWG', 'LMV'] },
};

interface VoterFixture { name: string; dob?: string; fatherName?: string; gender?: 'MALE' | 'FEMALE' | 'OTHER'; relationType: VoterRecord['relationType']; status: VoterRecord['status']; state: string; assemblyConstituency: string }
export const VOTER_FIXTURES: Record<string, VoterFixture> = {
  ZRT1234567: { ...PERSONA_ARJUN, relationType: 'FATHER', status: 'ACTIVE', state: 'MAHARASHTRA', assemblyConstituency: 'ANDHERI WEST' }, // happy path
  KLX7654321: { name: 'PRIYA R IYER', dob: '1994', fatherName: 'RAMESH IYER', gender: 'FEMALE', relationType: 'FATHER', status: 'ACTIVE', state: 'KERALA', assemblyConstituency: 'ERNAKULAM' }, // year-only DOB + initial
  GHJ1112223: { name: 'ARJUN VIKRAM MEHTA', dob: '1990-04-12', fatherName: 'VIKRAM SINGH MEHTA', gender: 'FEMALE', relationType: 'FATHER', status: 'ACTIVE', state: 'GUJARAT', assemblyConstituency: 'VEJALPUR' }, // gender mismatch
};

interface BankFixture { registeredName?: string; bankName: string; outcome: 'ACTIVE' | 'INVALID' | 'PENDING_THEN_ACTIVE' | 'PENDING_FOREVER' | 'OUTAGE' }
export const BANK_FIXTURES: Record<string, BankFixture> = {
  '100020003000|HDFC0001234': { registeredName: 'ARJUN V MEHTA', bankName: 'HDFC BANK', outcome: 'ACTIVE' }, // happy path (bank-style initials)
  '200030004000|ICIC0000456': { registeredName: 'NEHA RAJESH GUPTA', bankName: 'ICICI BANK', outcome: 'ACTIVE' }, // different holder
  '300040005000|SBIN0001111': { registeredName: 'MR ARJUN VIKRAM MEHTA', bankName: 'STATE BANK OF INDIA', outcome: 'PENDING_THEN_ACTIVE' }, // async: PENDING then ACTIVE on poll
  '300040005001|SBIN0001111': { bankName: 'STATE BANK OF INDIA', outcome: 'PENDING_FOREVER' }, // never completes -> PENDING
  '400050006000|UTIB0000789': { bankName: 'AXIS BANK', outcome: 'INVALID' }, // closed / invalid account
  '500060007000|KKBK0000321': { registeredName: 'PRIYA R IYER', bankName: 'KOTAK MAHINDRA BANK', outcome: 'ACTIVE' },
  '999999999999|HDFC0001234': { bankName: 'HDFC BANK', outcome: 'OUTAGE' },
};

export const UPI_FIXTURES: Record<string, { customerName: string }> = {
  'arjun.mehta@okhdfc': { customerName: 'ARJUN VIKRAM MEHTA' },
  'arjun@ybl': { customerName: 'Arjun Mehta' },
  'neha.gupta@okicici': { customerName: 'NEHA RAJESH GUPTA' },
  'priya.iyer@oksbi': { customerName: 'PRIYA IYER' },
  // 'nobody@okaxis' and any other well-formed VPA => not found
};

export const RC_FIXTURES: Record<string, Omit<VehicleRcRecord, 'found' | 'provider' | 'environment' | 'rcMasked' | 'txnId'>> = {
  MH02AB1234: { ownerName: 'ARJUN VIKRAM MEHTA', status: 'ACTIVE', makerModel: 'MARUTI SUZUKI SWIFT', fuelType: 'PETROL', vehicleClass: 'LMV', fitnessValidTill: '2034-05-10', insuranceValidTill: '2027-02-14' },
  DL3CAB0001: { ownerName: 'SURESH KUMAR SHARMA', status: 'BLACKLISTED', makerModel: 'HYUNDAI AURA', fuelType: 'CNG', vehicleClass: 'LMV', fitnessValidTill: '2028-01-01', insuranceValidTill: '2025-01-01' },
};

export const GSTIN_FIXTURES: Record<string, Omit<GstinRecord, 'found' | 'provider' | 'environment' | 'gstin' | 'stateCode' | 'txnId'>> = {
  '27AFZPM4821K1ZQ': { legalName: 'ARJUN VIKRAM MEHTA', tradeName: 'MEHTA TRADERS', status: 'ACTIVE', registrationDate: '2021-07-01' },
  '29AGJPI2468B1ZG': { legalName: 'PRIYA RAMESH IYER', tradeName: 'IYER DESIGN STUDIO', status: 'CANCELLED', registrationDate: '2019-04-01' },
};

/** Fixture PAN that simulates an upstream outage. */
export const OUTAGE_PAN = 'ZZZPZ9999Z';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function latencyMs(): number {
  const override = process.env.VERIFY_MOCK_LATENCY_MS;
  if (override !== undefined && override !== '') return Math.max(0, Number(override) || 0);
  return 100 + crypto.randomInt(0, 301);
}

async function simulateLatency(): Promise<void> {
  const ms = latencyMs();
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

function txn(): string {
  return 'mock_' + crypto.randomBytes(6).toString('hex');
}

const ENV = 'sandbox' as const;

// Track pending validations so that a poll can "complete" PENDING_THEN_ACTIVE fixtures.
const mockValidations = new Map<string, { key: string }>();

export class MockRegistryProvider implements IdentityRegistryProvider, BankRegistryProvider {
  async verifyPan(input: { pan: string }): Promise<PanRecord> {
    await simulateLatency();
    if (input.pan === OUTAGE_PAN) throw new ProviderUnavailableError('MOCK', 'Simulated upstream outage (sandbox fixture).');
    const f = PAN_FIXTURES[input.pan];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), panMasked: maskPan(input.pan), category: panCategory(input.pan) };
    if (!f) return { ...base, found: false };
    return {
      ...base,
      found: true,
      name: f.name,
      dob: f.dob,
      fatherName: f.fatherName,
      gender: f.gender,
      status: f.status,
      aadhaarSeeded: f.aadhaarSeeded,
    };
  }

  async verifyDrivingLicense(input: { dlNumber: string }): Promise<DrivingLicenseRecord> {
    await simulateLatency();
    const f = DL_FIXTURES[input.dlNumber];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), dlMasked: maskId(input.dlNumber) };
    if (!f) return { ...base, found: false };
    return { ...base, found: true, ...f, vehicleClasses: [...f.vehicleClasses] };
  }

  async verifyVoterId(input: { epic: string }): Promise<VoterRecord> {
    await simulateLatency();
    const f = VOTER_FIXTURES[input.epic];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), epicMasked: maskId(input.epic) };
    if (!f) return { ...base, found: false };
    return { ...base, found: true, ...f };
  }

  async verifyVehicleRc(input: { rcNumber: string }): Promise<VehicleRcRecord> {
    await simulateLatency();
    const f = RC_FIXTURES[input.rcNumber];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), rcMasked: maskId(input.rcNumber) };
    if (!f) return { ...base, found: false };
    return { ...base, found: true, ...f };
  }

  async verifyGstin(input: { gstin: string }): Promise<GstinRecord> {
    await simulateLatency();
    const f = GSTIN_FIXTURES[input.gstin];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), gstin: input.gstin, stateCode: input.gstin.slice(0, 2) };
    if (!f) return { ...base, found: false };
    return { ...base, found: true, ...f };
  }

  async verifyBankAccount(input: { accountNumber: string; ifsc: string }): Promise<BankAccountRecord> {
    await simulateLatency();
    const key = `${input.accountNumber}|${input.ifsc}`;
    const f = BANK_FIXTURES[key];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), accountMasked: maskAccount(input.accountNumber), ifsc: input.ifsc };
    if (f?.outcome === 'OUTAGE') throw new ProviderUnavailableError('MOCK', 'Simulated penny-drop outage (sandbox fixture).');
    if (!f) {
      // Unknown account: the beneficiary bank rejects it (equivalent of NOT_FOUND for bank rails).
      return { ...base, found: false, accountStatus: 'INVALID' };
    }
    if (f.outcome === 'PENDING_THEN_ACTIVE' || f.outcome === 'PENDING_FOREVER') {
      const validationId = 'fav_mock_' + crypto.randomBytes(6).toString('hex');
      mockValidations.set(validationId, { key });
      return { ...base, found: true, accountStatus: 'PENDING', bankName: f.bankName, validationId };
    }
    if (f.outcome === 'INVALID') return { ...base, found: true, accountStatus: 'INVALID', bankName: f.bankName };
    return { ...base, found: true, accountStatus: 'ACTIVE', registeredName: f.registeredName, bankName: f.bankName, utrPresent: true };
  }

  async pollBankValidation(validationId: string, accountNumber: string, ifsc: string): Promise<BankAccountRecord> {
    await simulateLatency();
    const entry = mockValidations.get(validationId);
    const key = entry?.key || `${accountNumber}|${ifsc}`;
    const f = BANK_FIXTURES[key];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), accountMasked: maskAccount(accountNumber), ifsc, validationId };
    if (!f) return { ...base, found: false, accountStatus: 'INVALID' };
    if (f.outcome === 'PENDING_THEN_ACTIVE') {
      return { ...base, found: true, accountStatus: 'ACTIVE', registeredName: f.registeredName, bankName: f.bankName, utrPresent: true };
    }
    if (f.outcome === 'PENDING_FOREVER') return { ...base, found: true, accountStatus: 'PENDING', bankName: f.bankName };
    if (f.outcome === 'INVALID') return { ...base, found: true, accountStatus: 'INVALID', bankName: f.bankName };
    return { ...base, found: true, accountStatus: 'ACTIVE', registeredName: f.registeredName, bankName: f.bankName, utrPresent: true };
  }

  async validateVpa(input: { vpa: string }): Promise<UpiRecord> {
    await simulateLatency();
    const f = UPI_FIXTURES[input.vpa];
    const base = { provider: 'MOCK' as const, environment: ENV, txnId: txn(), vpaMasked: maskVpa(input.vpa) };
    if (!f) return { ...base, found: false };
    return { ...base, found: true, customerName: f.customerName };
  }
}

export const mockRegistry = new MockRegistryProvider();
