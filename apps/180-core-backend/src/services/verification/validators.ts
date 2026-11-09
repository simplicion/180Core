/**
 * 180 Verify - format & checksum validation for Indian identifiers.
 * All functions are pure and never log their input.
 */

export interface FormatCheck {
  valid: boolean;
  normalized: string;
  reason?: string;
}

const stripSpaces = (v: string) => (v || '').toString().trim().toUpperCase().replace(/[\s-]/g, '');

/**
 * PAN: 5 letters, 4 digits, 1 letter. The 4th character is the holder category
 * (P individual, C company, H HUF, F firm, A AOP, T trust, B BOI, L local authority, J artificial juridical person, G govt).
 */
export function validatePan(raw: string): FormatCheck {
  const v = stripSpaces(raw);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) {
    return { valid: false, normalized: v, reason: 'PAN must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).' };
  }
  if (!'PCHFATBLJG'.includes(v[3])) {
    return { valid: false, normalized: v, reason: 'PAN 4th character is not a valid holder category.' };
  }
  return { valid: true, normalized: v };
}

export function panCategory(pan: string): 'INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM' | 'TRUST' | 'OTHER' {
  switch (pan[3]) {
    case 'P': return 'INDIVIDUAL';
    case 'C': return 'COMPANY';
    case 'H': return 'HUF';
    case 'F': return 'FIRM';
    case 'T': return 'TRUST';
    default: return 'OTHER';
  }
}

/**
 * Driving licence (post-2019 Sarathi format): SS RR YYYY NNNNNNN = 15 chars, e.g. MH0220190012345.
 * Older state formats vary (13-16 chars, letters in the RTO part), so we accept:
 * 2-letter state code + 2 alphanumerics + 9..12 alphanumerics.
 */
export function validateDrivingLicense(raw: string): FormatCheck {
  const v = (raw || '').toString().trim().toUpperCase().replace(/[\s\-/]/g, '');
  if (!/^[A-Z]{2}[0-9A-Z]{2}[0-9A-Z]{9,12}$/.test(v)) {
    return { valid: false, normalized: v, reason: 'Driving licence number must start with a 2-letter state code followed by the RTO code and number (e.g. MH0220190012345).' };
  }
  return { valid: true, normalized: v };
}

/** EPIC (Voter ID): 3 letters + 7 digits (current ECI format). */
export function validateEpic(raw: string): FormatCheck {
  const v = stripSpaces(raw);
  if (!/^[A-Z]{3}[0-9]{7}$/.test(v)) {
    return { valid: false, normalized: v, reason: 'Voter ID (EPIC) must be 3 letters followed by 7 digits (e.g. ABC1234567).' };
  }
  return { valid: true, normalized: v };
}

/** IFSC: 4 letters (bank), '0', 6 alphanumerics (branch). */
export function validateIfsc(raw: string): FormatCheck {
  const v = stripSpaces(raw);
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) {
    return { valid: false, normalized: v, reason: 'IFSC must be 11 characters: 4 letters, 0, then 6 alphanumerics (e.g. HDFC0001234).' };
  }
  return { valid: true, normalized: v };
}

/** Bank account number: 9-18 digits (RBI/NPCI range for Indian accounts). */
export function validateAccountNumber(raw: string): FormatCheck {
  const v = (raw || '').toString().replace(/\s+/g, '');
  if (!/^[0-9]{9,18}$/.test(v)) {
    return { valid: false, normalized: v, reason: 'Account number must be 9 to 18 digits.' };
  }
  return { valid: true, normalized: v };
}

/** UPI VPA: handle@psp, NPCI allows [a-zA-Z0-9.\-_] in the handle, 2-256 chars. */
export function validateVpa(raw: string): FormatCheck {
  const v = (raw || '').toString().trim().toLowerCase();
  if (!/^[a-z0-9.\-_]{2,256}@[a-z][a-z0-9.\-]{1,63}$/.test(v)) {
    return { valid: false, normalized: v, reason: 'UPI ID must look like name@bank (e.g. user@okhdfcbank).' };
  }
  return { valid: true, normalized: v };
}

/** Vehicle registration: SS RR [A-Z]{0,3} NNNN (e.g. MH02AB1234), or BH series 22BH1234AA. */
export function validateVehicleRc(raw: string): FormatCheck {
  const v = stripSpaces(raw);
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(v) && !/^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(v)) {
    return { valid: false, normalized: v, reason: 'Vehicle registration number must look like MH02AB1234 (or 22BH1234AA for BH series).' };
  }
  return { valid: true, normalized: v };
}

// ─── GSTIN (15 chars, mod-36 check digit) ──────────────────────────────────
const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GST_CHARS.indexOf(first14[i]);
    if (value < 0) return '?';
    const product = value * ((i % 2) + 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36];
}

export function validateGstin(raw: string): FormatCheck {
  const v = stripSpaces(raw);
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) {
    return { valid: false, normalized: v, reason: 'GSTIN must be 15 characters: state code, PAN, entity number, Z, check digit.' };
  }
  const state = parseInt(v.slice(0, 2), 10);
  if (state < 1 || (state > 38 && state !== 97 && state !== 99)) {
    return { valid: false, normalized: v, reason: 'GSTIN state code is invalid.' };
  }
  if (gstinCheckChar(v.slice(0, 14)) !== v[14]) {
    return { valid: false, normalized: v, reason: 'GSTIN checksum digit is invalid.' };
  }
  return { valid: true, normalized: v };
}

// ─── Aadhaar (12 digits, Verhoeff checksum, cannot start with 0 or 1) ─────
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function verhoeffValid(num: string): boolean {
  let c = 0;
  const digits = num.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  return c === 0;
}

export function verhoeffCheckDigit(numWithoutCheck: string): number {
  let c = 0;
  const digits = numWithoutCheck.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][digits[i]]];
  return VERHOEFF_INV[c];
}

export function validateAadhaar(raw: string): FormatCheck {
  const v = (raw || '').toString().replace(/[\s-]/g, '');
  if (!/^[2-9][0-9]{11}$/.test(v)) {
    return { valid: false, normalized: '', reason: 'Aadhaar number must be 12 digits and cannot start with 0 or 1.' };
  }
  if (!verhoeffValid(v)) {
    return { valid: false, normalized: '', reason: 'Aadhaar number checksum is invalid.' };
  }
  // normalized intentionally returned so the caller can take last-4; callers MUST NOT persist/log it.
  return { valid: true, normalized: v };
}
