/**
 * 180 Identity - Cross-Document Verification Engine
 * Location: apps/180-core-backend/src/services/cross-document-validator.service.ts
 *
 * Multi-attribute consistency across identity documents and financial records:
 *  1. Full name (token-aligned matcher, see name-matcher.service.ts)
 *  2. Date of birth (multi-format normalization; year-only Aadhaar YOB compares on year)
 *  3. Father's / guardian's / spouse's name (S/O, D/O, W/O, C/O prefixes stripped)
 *  4. Gender
 *
 * Source weighting: every record carries `source`:
 *  - REGISTRY       attributes returned by a government registry / bank
 *  - SELF_DECLARED  attributes typed or OCR'd by the user (e.g. Aadhaar without offline-XML signature)
 * A REGISTRY-vs-REGISTRY conflict is CRITICAL (reject). Any conflict involving a SELF_DECLARED
 * record is a review flag (MANUAL_REVIEW), never an auto-approve and never treated as registry truth.
 * The primary identity is always taken from registry records first.
 */

import { NameMatcherService } from './name-matcher.service';
import * as v from './verification/validators';

export type RecordSource = 'REGISTRY' | 'SELF_DECLARED';

export interface DocumentRecord {
  docType: 'PAN Card' | 'Driving License' | 'Aadhaar Card' | 'Voter ID' | 'Passport' | 'Bank Account' | 'UPI';
  /** Defaults to SELF_DECLARED (conservative) when omitted. */
  source?: RecordSource;
  name?: string;
  dob?: string;
  fatherName?: string;
  gender?: string;
  docNumber?: string;
}

export interface NormalizedDate {
  raw: string;
  year: number;
  month?: number;
  day?: number;
  isoString: string; // 'YYYY-MM-DD' or 'YYYY'
  isYearOnly: boolean;
}

export interface AttributeMismatch {
  field: 'NAME' | 'DOB' | 'FATHER_NAME' | 'GENDER';
  doc1: string;
  doc2: string;
  /** true => registry-vs-registry conflict (reject). false => warning / review flag. */
  critical: boolean;
  /** true => blocks automatic approval (MANUAL_REVIEW at best) */
  requiresReview: boolean;
  reason: string;
}

export interface CrossValidationReport {
  isValid: boolean;
  requiresManualReview: boolean;
  overallScore: number;
  primaryIdentity: {
    fullName: string;
    dob?: string;
    fatherName?: string;
    gender?: string;
    /** source of the primary name */
    source?: RecordSource;
  };
  nameCheck: {
    isMatch: boolean;
    averageScore: number;
    comparisons: { doc1: string; doc2: string; score: number; isMatch: boolean; reason?: string }[];
  };
  dobCheck: {
    isMatch: boolean;
    normalizedDobs: { docType: string; normalized: string; isYearOnly: boolean; source: RecordSource }[];
    mismatches: AttributeMismatch[];
  };
  fatherNameCheck: {
    isMatch: boolean;
    comparisons: { doc1: string; doc2: string; score: number; isMatch: boolean; reason?: string }[];
  };
  genderCheck: {
    isMatch: boolean;
    comparisons: { doc1: string; doc2: string; isMatch: boolean }[];
  };
  criticalMismatches: AttributeMismatch[];
  warnings: AttributeMismatch[];
}

const MONTH_MAP: { [key: string]: number } = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** Registry documents in priority order for building the primary identity. */
const PRIMARY_PRIORITY: DocumentRecord['docType'][] = ['PAN Card', 'Driving License', 'Voter ID', 'Passport', 'Aadhaar Card', 'Bank Account', 'UPI'];

const RELATION_PREFIX = /^(S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O|H\s*\/\s*O|SON OF|DAUGHTER OF|WIFE OF|HUSBAND OF|CARE OF|FATHER|HUSBAND|GUARDIAN)\b[\s:.\-]*/;

export class CrossDocumentValidatorService {
  /**
   * Normalizes Indian date formats into YYYY-MM-DD (or YYYY for year-of-birth only):
   *  1995-06-15 | 1995/06/15 | 15/06/1995 | 15-06-1995 | 15.06.1995 | 15 June 1995 | 15-JUN-1995
   *  | 1995 | "YOB: 1995" | "Year of Birth : 1995".
   * Ambiguous numeric dates are read as DD/MM/YYYY (Indian convention). Impossible dates
   * (31/02/1990, month 13) and free text containing a year are rejected (null), never coerced.
   */
  public static normalizeDob(rawDob: string): NormalizedDate | null {
    if (!rawDob || typeof rawDob !== 'string') return null;
    const clean = rawDob.trim().toUpperCase().replace(/,/g, ' ').replace(/\s+/g, ' ');

    const yob = clean.match(/^(?:(?:YEAR OF BIRTH|YOB|BIRTH YEAR)\s*[:\-]?\s*)?((?:19|20)\d{2})$/);
    if (yob) {
      const year = parseInt(yob[1], 10);
      if (!this.plausibleYear(year)) return null;
      return { raw: rawDob, year, isoString: `${year}`, isYearOnly: true };
    }

    const iso = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
    if (iso) return this.buildDateResult(rawDob, +iso[1], +iso[2], +iso[3]);

    const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) return this.buildDateResult(rawDob, +dmy[3], +dmy[2], +dmy[1]);

    const text = clean.match(/^(\d{1,2})(?:ST|ND|RD|TH)?[-/\s]+([A-Z]+)[-/\s]+(\d{4})$/);
    if (text) {
      const month = MONTH_MAP[text[2].substring(0, 3)];
      if (month) return this.buildDateResult(rawDob, +text[3], month, +text[1]);
    }
    return null;
  }

  private static plausibleYear(year: number): boolean {
    return year >= 1900 && year <= new Date().getUTCFullYear();
  }

  private static buildDateResult(raw: string, year: number, month: number, day: number): NormalizedDate | null {
    if (!this.plausibleYear(year) || month < 1 || month > 12 || day < 1) return null;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > daysInMonth) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return { raw, year, month, day, isoString: `${year}-${pad(month)}-${pad(day)}`, isYearOnly: false };
  }

  /** Exact match, or year match when either side is year-only. Reasons never contain the dates. */
  public static compareDobs(d1: NormalizedDate, d2: NormalizedDate): { isMatch: boolean; reason?: string } {
    if (d1.isYearOnly || d2.isYearOnly) {
      return d1.year === d2.year ? { isMatch: true } : { isMatch: false, reason: 'Birth year does not match' };
    }
    return d1.isoString === d2.isoString ? { isMatch: true } : { isMatch: false, reason: 'Date of birth does not match' };
  }

  /**
   * Strips relation prefixes (S/O, D/O, W/O, C/O, SON OF ...) and leading titles (SHRI, LATE, MR ...)
   * using word boundaries, so names such as SHRIDHAR or MRINAL are not truncated.
   */
  public static normalizeFatherOrGuardianName(raw: string): string {
    if (!raw) return '';
    let name = raw.toUpperCase().trim();
    let prev = '';
    while (prev !== name) {
      prev = name;
      name = name.replace(RELATION_PREFIX, '').trim();
    }
    return NameMatcherService.normalize(name);
  }

  public static normalizeGender(raw: string): 'MALE' | 'FEMALE' | 'OTHER' | null {
    if (!raw) return null;
    const g = raw.trim().toUpperCase();
    if (g === 'M' || g === 'MALE' || g === 'PURUSH') return 'MALE';
    if (g === 'F' || g === 'FEMALE' || g === 'MAHILA' || g === 'STRI') return 'FEMALE';
    if (g === 'T' || g === 'O' || g === 'OTHER' || g === 'TRANSGENDER') return 'OTHER';
    return null;
  }

  /** Legacy format check kept for callers; see verification/validators.ts for checksum-aware versions. */
  public static validateDocumentNumber(docType: string, number: string): { valid: boolean; reason?: string } {
    if (!number) return { valid: false, reason: 'Document number is missing' };
    switch (docType) {
      case 'PAN Card':
      case 'PAN':
        return v.validatePan(number);
      case 'Driving License':
      case 'DL':
      case 'DRIVING_LICENSE':
        return v.validateDrivingLicense(number);
      case 'Aadhaar Card':
      case 'AADHAAR': {
        const r = v.validateAadhaar(number);
        return { valid: r.valid, reason: r.reason };
      }
      case 'Voter ID':
      case 'EPIC':
      case 'VOTER_ID':
        return v.validateEpic(number);
      case 'GSTIN':
        return v.validateGstin(number);
      default:
        return { valid: true };
    }
  }

  private static severity(a: RecordSource, b: RecordSource): { critical: boolean; requiresReview: boolean } {
    if (a === 'REGISTRY' && b === 'REGISTRY') return { critical: true, requiresReview: true };
    return { critical: false, requiresReview: true };
  }

  /**
   * Pairwise comparison of Name, DOB, Father's name and Gender with source weighting.
   */
  public static validateDocuments(records: DocumentRecord[]): CrossValidationReport {
    const recs = records
      .filter((r) => Boolean(r.name || r.dob || r.fatherName || r.gender))
      .map((r) => ({ ...r, source: (r.source || 'SELF_DECLARED') as RecordSource }));

    const criticalMismatches: AttributeMismatch[] = [];
    const warnings: AttributeMismatch[] = [];
    const push = (m: AttributeMismatch) => (m.critical ? criticalMismatches : warnings).push(m);

    // 1. Names
    const nameRecs = recs.filter((r) => Boolean(r.name && r.name.trim()));
    const nameComparisons: CrossValidationReport['nameCheck']['comparisons'] = [];
    let nameTotal = 0;
    for (let i = 0; i < nameRecs.length; i++) {
      for (let j = i + 1; j < nameRecs.length; j++) {
        const a = nameRecs[i];
        const b = nameRecs[j];
        const res = NameMatcherService.compare(a.name!, b.name!);
        nameTotal += res.score;
        nameComparisons.push({ doc1: a.docType, doc2: b.docType, score: res.score, isMatch: res.isMatch, reason: res.reason });
        if (!res.isMatch) {
          push({
            field: 'NAME',
            doc1: a.docType,
            doc2: b.docType,
            ...this.severity(a.source, b.source),
            reason: `Name on ${a.docType} does not match ${b.docType} (similarity ${res.score}%).`,
          });
        }
      }
    }
    const avgNameScore = nameComparisons.length ? Math.round(nameTotal / nameComparisons.length) : nameRecs.length === 1 ? 100 : 0;

    // 2. DOB
    const dobRecs = recs
      .map((r) => ({ docType: r.docType, source: r.source, parsed: r.dob ? this.normalizeDob(r.dob) : null }))
      .filter((r) => r.parsed !== null) as { docType: string; source: RecordSource; parsed: NormalizedDate }[];
    const dobMismatches: AttributeMismatch[] = [];
    for (let i = 0; i < dobRecs.length; i++) {
      for (let j = i + 1; j < dobRecs.length; j++) {
        const a = dobRecs[i];
        const b = dobRecs[j];
        const cmp = this.compareDobs(a.parsed, b.parsed);
        if (!cmp.isMatch) {
          const m: AttributeMismatch = {
            field: 'DOB',
            doc1: a.docType,
            doc2: b.docType,
            ...this.severity(a.source, b.source),
            reason: `Date of birth on ${a.docType} does not match ${b.docType}.`,
          };
          dobMismatches.push(m);
          push(m);
        }
      }
    }

    // 3. Father / guardian (relation type differs across documents - e.g. DL may carry the husband's
    //    name - so this is informational and never critical).
    const fatherRecs = recs
      .map((r) => ({ docType: r.docType, normalized: this.normalizeFatherOrGuardianName(r.fatherName || '') }))
      .filter((r) => r.normalized.length > 0);
    const fatherComparisons: CrossValidationReport['fatherNameCheck']['comparisons'] = [];
    for (let i = 0; i < fatherRecs.length; i++) {
      for (let j = i + 1; j < fatherRecs.length; j++) {
        const a = fatherRecs[i];
        const b = fatherRecs[j];
        const res = NameMatcherService.compare(a.normalized, b.normalized);
        fatherComparisons.push({ doc1: a.docType, doc2: b.docType, score: res.score, isMatch: res.isMatch, reason: res.reason });
        if (!res.isMatch) {
          warnings.push({
            field: 'FATHER_NAME',
            doc1: a.docType,
            doc2: b.docType,
            critical: false,
            requiresReview: false,
            reason: `Father/guardian name on ${a.docType} does not match ${b.docType} (similarity ${res.score}%).`,
          });
        }
      }
    }

    // 4. Gender
    const genderRecs = recs
      .map((r) => ({ docType: r.docType, source: r.source, normalized: this.normalizeGender(r.gender || '') }))
      .filter((r) => r.normalized !== null) as { docType: string; source: RecordSource; normalized: 'MALE' | 'FEMALE' | 'OTHER' }[];
    const genderComparisons: CrossValidationReport['genderCheck']['comparisons'] = [];
    for (let i = 0; i < genderRecs.length; i++) {
      for (let j = i + 1; j < genderRecs.length; j++) {
        const a = genderRecs[i];
        const b = genderRecs[j];
        const isMatch = a.normalized === b.normalized;
        genderComparisons.push({ doc1: a.docType, doc2: b.docType, isMatch });
        if (!isMatch) {
          push({ field: 'GENDER', doc1: a.docType, doc2: b.docType, ...this.severity(a.source, b.source), reason: `Gender on ${a.docType} does not match ${b.docType}.` });
        }
      }
    }

    // Primary identity: registry records first, then document priority; full DOB preferred over year-only.
    const rank = (r: { source: RecordSource; docType: string }) =>
      (r.source === 'REGISTRY' ? 0 : 100) + Math.max(0, PRIMARY_PRIORITY.indexOf(r.docType as any));
    const identityRecs = recs.filter((r) => r.docType !== 'Bank Account' && r.docType !== 'UPI');
    const byRank = [...identityRecs].sort((a, b) => rank(a) - rank(b));
    const primaryNameRec = byRank.find((r) => r.name);
    const primaryDob = [...dobRecs]
      .filter((d) => d.docType !== 'Bank Account' && d.docType !== 'UPI')
      .sort((a, b) => (a.parsed.isYearOnly ? 1 : 0) - (b.parsed.isYearOnly ? 1 : 0) || rank(a) - rank(b))[0];
    const primaryFatherRec = byRank.find((r) => r.fatherName);
    const primaryGenderRec = byRank.find((r) => this.normalizeGender(r.gender || ''));

    const isValid = criticalMismatches.length === 0;
    const requiresManualReview = [...criticalMismatches, ...warnings].some((m) => m.requiresReview);
    const overallScore = isValid ? Math.max(requiresManualReview ? 60 : 80, avgNameScore) : Math.min(40, avgNameScore);

    return {
      isValid,
      requiresManualReview,
      overallScore,
      primaryIdentity: {
        fullName: primaryNameRec?.name ? NameMatcherService.normalize(primaryNameRec.name) : '',
        dob: primaryDob?.parsed.isoString,
        fatherName: primaryFatherRec ? this.normalizeFatherOrGuardianName(primaryFatherRec.fatherName!) : undefined,
        gender: primaryGenderRec ? this.normalizeGender(primaryGenderRec.gender!) || undefined : undefined,
        source: primaryNameRec?.source,
      },
      nameCheck: { isMatch: nameComparisons.every((c) => c.isMatch), averageScore: avgNameScore, comparisons: nameComparisons },
      dobCheck: {
        isMatch: dobMismatches.length === 0,
        normalizedDobs: dobRecs.map((d) => ({ docType: d.docType, normalized: d.parsed.isoString, isYearOnly: d.parsed.isYearOnly, source: d.source })),
        mismatches: dobMismatches,
      },
      fatherNameCheck: { isMatch: fatherComparisons.every((c) => c.isMatch), comparisons: fatherComparisons },
      genderCheck: { isMatch: genderComparisons.every((c) => c.isMatch), comparisons: genderComparisons },
      criticalMismatches,
      warnings,
    };
  }
}

export default CrossDocumentValidatorService;
