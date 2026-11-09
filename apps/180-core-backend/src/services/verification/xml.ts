/**
 * Minimal, dependency-free extractor for the attribute-only XML certificates returned by
 * API Setu "certificate" APIs (DigiLocker issuer schema: <Certificate><IssuedTo><Person name=".." dob=".."/>...).
 * Only reads attributes of the first matching element; no DTD/entity expansion (XXE-safe by construction).
 */

const ENTITY_MAP: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

function decode(v: string): string {
  return v.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITY_MAP[m] || m);
}

/** Returns attributes of the first <tag ...> (namespace prefixes ignored), or null if absent. */
export function xmlAttributes(xml: string, tag: string): Record<string, string> | null {
  if (!xml || typeof xml !== 'string') return null;
  const re = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}(\\s[^>]*?)?\\/?>`, 'i');
  const m = xml.match(re);
  if (!m) return null;
  const attrs: Record<string, string> = {};
  const body = m[1] || '';
  const attrRe = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let a: RegExpExecArray | null;
  while ((a = attrRe.exec(body)) !== null) {
    attrs[a[1]] = decode(a[3] !== undefined ? a[3] : a[4] || '');
  }
  return attrs;
}

/** Converts DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD to ISO YYYY-MM-DD (undefined if unparseable). */
export function toIsoDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
}

/** ISO YYYY-MM-DD -> DD-MM-YYYY (API Setu request format). */
export function isoToDdMmYyyy(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}
