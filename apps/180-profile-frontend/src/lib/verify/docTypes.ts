/**
 * 180 Verify — document catalogue, request-list parsing and client-side format validation.
 * Pure module (no runtime imports) so it can be unit-tested with plain node.
 */
import type { DocKind } from './types';

export interface DocConfig {
  kind: DocKind;
  label: string;
  shortLabel: string;
  issuer: string;
  numberLabel: string;
  numberPlaceholder: string;
  numberMaxLength: number;
  /** Aadhaar: number is masked in the UI and never echoed back. */
  sensitiveNumber: boolean;
  numberRequired: boolean;
  dobRequired: boolean;
  showGender: boolean;
  relativeLabel: string;
  /** Card carries a portrait photo; we require one to be visible before auto-capture. */
  photoId: boolean;
}

export const DOC_CONFIG: Record<DocKind, DocConfig> = {
  PAN: {
    kind: 'PAN',
    label: 'PAN card',
    shortLabel: 'PAN',
    issuer: 'Income Tax Department',
    numberLabel: 'PAN number',
    numberPlaceholder: 'ABCDE1234F',
    numberMaxLength: 10,
    sensitiveNumber: false,
    numberRequired: true,
    dobRequired: false,
    showGender: false,
    relativeLabel: "Father's name",
    photoId: true,
  },
  DL: {
    kind: 'DL',
    label: 'Driving licence',
    shortLabel: 'DL',
    issuer: 'MoRTH / Parivahan',
    numberLabel: 'Driving licence number',
    numberPlaceholder: 'MH1420110012345',
    numberMaxLength: 20,
    sensitiveNumber: false,
    numberRequired: true,
    dobRequired: true,
    showGender: true,
    relativeLabel: 'Father / husband name',
    photoId: true,
  },
  VOTER_ID: {
    kind: 'VOTER_ID',
    label: 'Voter ID (EPIC)',
    shortLabel: 'Voter ID',
    issuer: 'Election Commission of India',
    numberLabel: 'EPIC number',
    numberPlaceholder: 'ABC1234567',
    numberMaxLength: 10,
    sensitiveNumber: false,
    numberRequired: true,
    dobRequired: false,
    showGender: true,
    relativeLabel: "Relative's name",
    photoId: true,
  },
  AADHAAR: {
    kind: 'AADHAAR',
    label: 'Aadhaar card',
    shortLabel: 'Aadhaar',
    issuer: 'UIDAI',
    numberLabel: 'Aadhaar number',
    numberPlaceholder: '12-digit number',
    numberMaxLength: 14,
    sensitiveNumber: true,
    numberRequired: true,
    dobRequired: false,
    showGender: true,
    relativeLabel: 'Care of (C/O)',
    photoId: true,
  },
};

const DOC_ALIASES: Record<string, DocKind> = {
  PAN: 'PAN',
  PAN_CARD: 'PAN',
  DL: 'DL',
  DRIVING_LICENSE: 'DL',
  DRIVING_LICENCE: 'DL',
  VOTER: 'VOTER_ID',
  VOTER_ID: 'VOTER_ID',
  EPIC: 'VOTER_ID',
  AADHAAR: 'AADHAAR',
  AADHAR: 'AADHAAR',
};

const BANK_ALIASES = new Set(['BANK_ACCOUNT', 'BANK', 'UPI', 'PENNY_DROP']);

export interface RequestedDoc {
  /** Value exactly as the session listed it — echoed back to the server as `docType`. */
  raw: string;
  kind: DocKind;
}

export interface RequestPlan {
  docs: RequestedDoc[];
  bank: boolean;
  /** Unrecognised entries (ignored by the UI). */
  unknown: string[];
}

export function normaliseDocKind(raw: string): DocKind | null {
  const key = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return DOC_ALIASES[key] ?? null;
}

export function planFromDocuments(documents: unknown): RequestPlan {
  const list = Array.isArray(documents) ? documents.map((d) => String(d)) : [];
  const docs: RequestedDoc[] = [];
  const unknown: string[] = [];
  let bank = false;
  const seen = new Set<DocKind>();
  for (const raw of list) {
    const upper = raw.trim().toUpperCase();
    if (BANK_ALIASES.has(upper)) {
      bank = true;
      continue;
    }
    if (['FACE_MATCH', 'LIVENESS', 'SELFIE', 'FACE'].includes(upper)) continue; // always performed as the final step
    const kind = normaliseDocKind(raw);
    if (!kind) {
      unknown.push(raw);
      continue;
    }
    if (seen.has(kind)) continue;
    seen.add(kind);
    docs.push({ raw, kind });
  }
  return { docs, bank, unknown };
}

// ---------------------------------------------------------------------------
// Format validation
// ---------------------------------------------------------------------------

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** Same rule the backend uses: 2-letter state code + 13–14 alphanumerics (spaces/hyphens stripped). */
export const DL_RE = /^[A-Z]{2}[0-9A-Z]{13,14}$/;
export const EPIC_RE = /^[A-Z]{3}[0-9]{7}$/;
export const AADHAAR_RE = /^[0-9]{12}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,99}$/;

export function cleanDocNumber(kind: DocKind, value: string): string {
  const upper = String(value || '').toUpperCase();
  if (kind === 'AADHAAR') return upper.replace(/[^0-9]/g, '');
  return upper.replace(/[\s-]/g, '');
}

export function validateDocNumber(kind: DocKind, value: string): string | null {
  const clean = cleanDocNumber(kind, value);
  if (!clean) return DOC_CONFIG[kind].numberRequired ? 'Required' : null;
  switch (kind) {
    case 'PAN':
      return PAN_RE.test(clean) ? null : 'PAN must look like ABCDE1234F';
    case 'DL':
      return DL_RE.test(clean) ? null : 'Use the number printed on the licence, e.g. MH1420110012345';
    case 'VOTER_ID':
      return EPIC_RE.test(clean) ? null : 'EPIC must be 3 letters followed by 7 digits';
    case 'AADHAAR':
      return AADHAAR_RE.test(clean) ? null : 'Aadhaar must be 12 digits';
    default:
      return null;
  }
}

export function validateName(value: string, required = true): string | null {
  const v = String(value || '').trim();
  if (!v) return required ? 'Required' : null;
  return NAME_RE.test(v) ? null : 'Use letters only, as printed on the document';
}

/** `value` is a YYYY-MM-DD string from <input type="date">. */
export function validateDob(value: string, required: boolean, today: Date = new Date()): string | null {
  if (!value) return required ? 'Required' : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return 'Use the format YYYY-MM-DD';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return 'Not a valid date';
  const ageYears = (today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (ageYears < 0) return 'Date of birth cannot be in the future';
  if (ageYears < 10 || ageYears > 120) return 'Please check the year';
  return null;
}

export function maskAadhaar(value: string): string {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const last4 = digits.length >= 4 ? digits.slice(-4) : '';
  return `XXXX XXXX ${last4 || '····'}`;
}
