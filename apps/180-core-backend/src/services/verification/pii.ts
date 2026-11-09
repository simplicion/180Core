/**
 * 180 Verify - PII masking helpers. Use these for EVERY log line and every response field that
 * carries an identifier. Full Aadhaar numbers must never be logged, returned or stored (Aadhaar Act, s.29).
 */

/** ABCDE1234F -> ABXXXXX34F */
export function maskPan(pan?: string | null): string {
  const p = (pan || '').toUpperCase().replace(/\s+/g, '');
  if (p.length < 5) return 'XXXXXXXXXX';
  return p.slice(0, 2) + 'X'.repeat(Math.max(0, p.length - 5)) + p.slice(-3);
}

/** Generic id: keep first 2 and last 4 characters. */
export function maskId(id?: string | null): string {
  const v = (id || '').toUpperCase().replace(/[\s-]/g, '');
  if (v.length <= 6) return 'X'.repeat(v.length);
  return v.slice(0, 2) + 'X'.repeat(v.length - 6) + v.slice(-4);
}

/** Account numbers: last 4 only. */
export function maskAccount(acc?: string | null): string {
  const v = (acc || '').replace(/\s+/g, '');
  if (v.length <= 4) return 'XXXX';
  return 'X'.repeat(Math.min(8, v.length - 4)) + v.slice(-4);
}

/** Aadhaar: XXXX XXXX 1234 (last 4 only). */
export function maskAadhaar(num?: string | null): string {
  const v = (num || '').replace(/\D/g, '');
  return 'XXXX XXXX ' + (v.length >= 4 ? v.slice(-4) : 'XXXX');
}

export function aadhaarLast4(num?: string | null): string | undefined {
  const v = (num || '').replace(/\D/g, '');
  return v.length >= 4 ? v.slice(-4) : undefined;
}

/** arjun.mehta@okhdfc -> ar********@okhdfc */
export function maskVpa(vpa?: string | null): string {
  const v = (vpa || '').toLowerCase();
  const at = v.indexOf('@');
  if (at < 0) return 'XXXX';
  const handle = v.slice(0, at);
  return handle.slice(0, 2) + '*'.repeat(Math.max(2, handle.length - 2)) + v.slice(at);
}

/** ARJUN VIKRAM MEHTA -> A**** V***** M**** */
export function maskName(name?: string | null): string | undefined {
  if (!name) return undefined;
  return name
    .trim()
    .split(/\s+/)
    .map((t) => (t.length <= 1 ? t : t[0] + '*'.repeat(t.length - 1)))
    .join(' ');
}

export function maskDocNumber(docType: string, num?: string | null): string {
  switch (docType) {
    case 'PAN':
      return maskPan(num);
    case 'AADHAAR':
      return maskAadhaar(num);
    case 'BANK_ACCOUNT':
      return maskAccount(num);
    default:
      return maskId(num);
  }
}
