/**
 * 180 Verify - shared types for registry providers (mock + live adapters) and sessions.
 */

import type { VerifyEnvironment } from './config';

export const DOC_TYPES = ['PAN', 'DRIVING_LICENSE', 'VOTER_ID', 'AADHAAR', 'BANK_ACCOUNT', 'FACE_MATCH'] as const;
export type DocType = (typeof DOC_TYPES)[number];
/** Identity documents that carry a name/DOB and (optionally) a photo. */
export const IDENTITY_DOC_TYPES = ['PAN', 'DRIVING_LICENSE', 'VOTER_ID', 'AADHAAR'] as const;
export type IdentityDocType = (typeof IDENTITY_DOC_TYPES)[number];
/** Identity documents whose attributes come from a government registry (vs self-declared). */
export const REGISTRY_DOC_TYPES: IdentityDocType[] = ['PAN', 'DRIVING_LICENSE', 'VOTER_ID'];

export type ProviderName = 'MOCK' | 'APISETU' | 'RAZORPAY';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
/**
 * REGISTRY       - attribute returned by the issuing registry.
 * SELF_DECLARED  - typed/OCR'd by the user (Aadhaar today); never treated as registry truth.
 */
export type DataSource = 'REGISTRY' | 'SELF_DECLARED';

interface RegistryBase {
  /** false => the registry has no record for this number (NOT_FOUND) */
  found: boolean;
  provider: ProviderName;
  environment: VerifyEnvironment;
  /** opaque provider transaction id, safe to log */
  txnId?: string;
}

export interface RegistryPerson {
  /** Only ever populated from the registry response. Never copied from user input. */
  name?: string;
  /** ISO YYYY-MM-DD, or YYYY when the registry only knows the year */
  dob?: string;
  fatherName?: string;
  gender?: Gender;
}

export interface PanRecord extends RegistryBase, RegistryPerson {
  panMasked: string;
  /** VALID | DEACTIVATED | DELETED | INOPERATIVE (not linked with Aadhaar) | FAKE */
  status?: 'VALID' | 'DEACTIVATED' | 'DELETED' | 'INOPERATIVE' | 'FAKE';
  category: 'INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM' | 'TRUST' | 'OTHER';
  aadhaarSeeded?: boolean;
  /**
   * Live API Setu certificate APIs verify the tuple you send (PANFullName/DOB/GENDER) and return a
   * certificate. When the certificate does not echo a name attribute, the issuer has attested the
   * submitted name; we record that here instead of copying the user-typed name into `name`.
   */
  issuerAttested?: { name?: boolean; dob?: boolean; gender?: boolean };
}

export interface DrivingLicenseRecord extends RegistryBase, RegistryPerson {
  dlMasked: string;
  status?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
  issueDate?: string;
  validTill?: string;
  vehicleClasses?: string[];
  issuerAttested?: { name?: boolean; dob?: boolean };
}

export interface VoterRecord extends RegistryBase, RegistryPerson {
  epicMasked: string;
  status?: 'ACTIVE' | 'DELETED';
  relationType?: 'FATHER' | 'HUSBAND' | 'MOTHER' | 'OTHER';
  state?: string;
  assemblyConstituency?: string;
}

export interface VehicleRcRecord extends RegistryBase {
  rcMasked: string;
  ownerName?: string;
  status?: 'ACTIVE' | 'BLACKLISTED' | 'EXPIRED';
  makerModel?: string;
  fuelType?: string;
  vehicleClass?: string;
  fitnessValidTill?: string;
  insuranceValidTill?: string;
}

export interface GstinRecord extends RegistryBase {
  gstin: string; // GSTIN is public business data
  legalName?: string;
  tradeName?: string;
  status?: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED';
  registrationDate?: string;
  stateCode: string;
}

export interface BankAccountRecord extends RegistryBase {
  accountMasked: string;
  ifsc: string;
  /** ACTIVE: account exists & credited. INVALID: bank rejected. PENDING: async validation not finished. */
  accountStatus: 'ACTIVE' | 'INVALID' | 'PENDING';
  /** Name returned by the beneficiary bank. NEVER falls back to an expected/user name. */
  registeredName?: string;
  bankName?: string;
  utrPresent?: boolean;
  /** Razorpay fund account validation id, used to resume polling a PENDING validation */
  validationId?: string;
}

export interface UpiRecord extends RegistryBase {
  vpaMasked: string;
  customerName?: string;
}

export interface IdentityRegistryProvider {
  verifyPan(input: { pan: string; name?: string; dob?: string; gender?: Gender; uid?: string }): Promise<PanRecord>;
  verifyDrivingLicense(input: { dlNumber: string; dob?: string; name?: string; uid?: string }): Promise<DrivingLicenseRecord>;
  verifyVoterId(input: { epic: string; name?: string }): Promise<VoterRecord>;
  verifyVehicleRc(input: { rcNumber: string; chassisNumber?: string; ownerName?: string; uid?: string }): Promise<VehicleRcRecord>;
  verifyGstin(input: { gstin: string }): Promise<GstinRecord>;
}

export interface BankRegistryProvider {
  verifyBankAccount(input: { accountNumber: string; ifsc: string; referenceId?: string }): Promise<BankAccountRecord>;
  pollBankValidation(validationId: string, accountNumber: string, ifsc: string): Promise<BankAccountRecord>;
  validateVpa(input: { vpa: string }): Promise<UpiRecord>;
}
