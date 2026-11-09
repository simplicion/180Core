/**
 * 180 Identity - Cross-Document Name Matching Engine
 * Location: apps/180-core-backend/src/services/name-matcher.service.ts
 *
 * Token-aligned matching calibrated for Indian names:
 *  - leading honorifics are stripped (Shri/Smt/Kumari/Km/Mr/Mrs/Ms/Dr/Late...), but only as a LEADING
 *    title: "KUMAR" and a trailing "KUMARI" are real name parts and are kept;
 *  - relation suffixes are cut ("RAMESH KUMAR S/O MAHESH" -> "RAMESH KUMAR");
 *  - order independent ("SHARMA RAJESH" == "RAJESH SHARMA");
 *  - initials ("R. KUMAR" vs "RAMESH KUMAR", "ARJUN V MEHTA" vs "ARJUN VIKRAM MEHTA");
 *  - transliteration variants via a phonetic key (LAKSHMI/LAXMI, MOHAMMAD/MOHAMMED/MD/MOHD, SHREYA/SREYA);
 *  - joined/split tokens ("RAMKUMAR" vs "RAM KUMAR");
 *  - single-name records ("PRIYA" vs "PRIYA KUMARI") match only at the threshold (MODERATE confidence).
 * Every token of the shorter name must align to a token of the longer one; a different first name
 * (RAMESH vs RAJESH) is a mismatch even though whole-string similarity is high.
 */

export interface NameComparisonResult {
  isMatch: boolean;
  score: number; // 0 to 100
  confidence: 'EXACT' | 'HIGH' | 'MODERATE' | 'LOW' | 'MISMATCH';
  name1Normalized: string;
  name2Normalized: string;
  reason?: string;
}

export interface CrossDocumentValidationInput {
  panName?: string;
  aadhaarName?: string;
  dlName?: string;
  voterName?: string;
  passportName?: string;
  bankRegisteredName?: string;
}

export interface CrossDocumentValidationResult {
  isValid: boolean;
  overallScore: number;
  primaryName: string;
  mismatches: {
    doc1: string;
    name1: string;
    doc2: string;
    name2: string;
    score: number;
    reason: string;
  }[];
}

/** Titles stripped only when they appear as LEADING tokens. */
const LEADING_TITLES = new Set([
  'MR', 'MRS', 'MS', 'MISS', 'MASTER', 'SHRI', 'SHREE', 'SRI', 'SH', 'SMT', 'SHRIMATI', 'SHREEMATI',
  'KUMARI', 'KUM', 'KM', 'SUSHRI', 'DR', 'DOCTOR', 'PROF', 'LATE', 'LT', 'ADV', 'CA', 'ER', 'CAPT', 'COL', 'MAJ',
]);

/** Canonical forms for very common abbreviations that are name parts (not titles). */
const TOKEN_EQUIVALENTS: Record<string, string> = {
  MD: 'MOHAMMED', MOHD: 'MOHAMMED', MOHAMMAD: 'MOHAMMED', MOHAMAD: 'MOHAMMED', MOHAMED: 'MOHAMMED',
  MUHAMMAD: 'MOHAMMED', MUHAMMED: 'MOHAMMED', MOHAMMED: 'MOHAMMED', MOHMMAD: 'MOHAMMED',
};

/** Markers after which the rest of the string describes a relative, not the person. */
const RELATION_MARKER = /\b(S\s*\/\s*O|D\s*\/\s*O|W\s*\/\s*O|C\s*\/\s*O|H\s*\/\s*O|SON OF|DAUGHTER OF|WIFE OF|CARE OF|HUSBAND OF)\b.*$/;

export const NAME_MATCH_THRESHOLD = 80;

export class NameMatcherService {
  /** Uppercases, strips diacritics/punctuation, cuts relation suffixes and leading titles. */
  public static normalize(name: string): string {
    if (!name || typeof name !== 'string') return '';
    let v = name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase();
    v = v.replace(RELATION_MARKER, ' ');
    v = v
      .replace(/[^A-Z\s]/g, ' ') // dots, commas, digits
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = v.split(' ').filter(Boolean);
    while (tokens.length > 1 && LEADING_TITLES.has(tokens[0])) tokens.shift();
    return tokens.join(' ');
  }

  /** Tokens after normalization, with abbreviation equivalents applied. */
  public static tokenize(normalizedName: string): string[] {
    return normalizedName
      .split(' ')
      .filter(Boolean)
      .map((t) => TOKEN_EQUIVALENTS[t] || t);
  }

  /** Phonetic key for Indian transliteration variants. */
  public static phoneticKey(token: string): string {
    let t = token.toUpperCase();
    t = TOKEN_EQUIVALENTS[t] || t;
    t = t
      .replace(/KSH/g, 'X')
      .replace(/KS/g, 'X')
      .replace(/SHR/g, 'SR')
      .replace(/SH/g, 'S')
      .replace(/PH/g, 'F')
      .replace(/(TH|DH|BH|KH|GH|CH|JH)/g, (m) => m[0])
      .replace(/W/g, 'V')
      .replace(/Z/g, 'J')
      .replace(/Q/g, 'K')
      .replace(/EE|II|IE|EA/g, 'I')
      .replace(/OO|OU|UU/g, 'U')
      .replace(/AA/g, 'A')
      .replace(/Y$/g, 'I')
      .replace(/(.)\1+/g, '$1')
      .replace(/H$/g, '');
    // Vowels are kept on purpose: dropping them would equate different names (AMIT/AMITA, RAVI/RAVA).
    return t;
  }

  private static jaroDistance(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0 || len2 === 0) return 0.0;

    const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);
      for (let j = start; j < end; j++) {
        if (!s2Matches[j] && s1[i] === s2[j]) {
          s1Matches[i] = true;
          s2Matches[j] = true;
          matches++;
          break;
        }
      }
    }
    if (matches === 0) return 0.0;

    let k = 0;
    let transpositions = 0;
    for (let i = 0; i < len1; i++) {
      if (s1Matches[i]) {
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
      }
    }
    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;
  }

  public static jaroWinkler(s1: string, s2: string): number {
    const jaro = this.jaroDistance(s1, s2);
    if (jaro < 0.7) return jaro;
    let prefixLength = 0;
    const maxPrefix = Math.min(4, s1.length, s2.length);
    for (let i = 0; i < maxPrefix; i++) {
      if (s1[i] === s2[i]) prefixLength++;
      else break;
    }
    return jaro + prefixLength * 0.1 * (1 - jaro);
  }

  /**
   * Similarity of two single tokens:
   *   1.00 identical, 0.97 phonetic-equivalent, 0.85 initial vs full token (or initial vs initial),
   *   JW >= 0.92 on tokens of length >= 4 counts as a typo-level variant, otherwise 0.
   */
  public static tokenSimilarity(a: string, b: string): { score: number; kind: 'EXACT' | 'PHONETIC' | 'INITIAL' | 'FUZZY' | 'NONE' } {
    if (a === b) return { score: a.length === 1 ? 0.85 : 1, kind: a.length === 1 ? 'INITIAL' : 'EXACT' };
    if (a.length === 1 || b.length === 1) {
      return a[0] === b[0] ? { score: 0.85, kind: 'INITIAL' } : { score: 0, kind: 'NONE' };
    }
    if (this.phoneticKey(a) === this.phoneticKey(b)) return { score: 0.97, kind: 'PHONETIC' };
    // Typo-level variants only: similar length (PRIYA vs PRIYANKA is a different name).
    if (Math.min(a.length, b.length) >= 4 && Math.abs(a.length - b.length) <= 1) {
      const jw = this.jaroWinkler(a, b);
      if (jw >= 0.92 && a[0] === b[0]) return { score: jw, kind: 'FUZZY' };
    }
    return { score: 0, kind: 'NONE' };
  }

  private static result(isMatch: boolean, score: number, n1: string, n2: string, reason?: string): NameComparisonResult {
    let confidence: NameComparisonResult['confidence'];
    if (!isMatch) confidence = score >= 60 ? 'LOW' : 'MISMATCH';
    else if (score >= 99) confidence = 'EXACT';
    else if (score >= 88) confidence = 'HIGH';
    else confidence = 'MODERATE';
    return { isMatch, score, confidence, name1Normalized: n1, name2Normalized: n2, reason };
  }

  /** Compares two names and returns a calibrated verdict (pass threshold: NAME_MATCH_THRESHOLD). */
  public static compare(name1: string, name2: string): NameComparisonResult {
    const norm1 = this.normalize(name1);
    const norm2 = this.normalize(name2);

    if (!norm1 || !norm2) {
      return this.result(false, 0, norm1, norm2, 'One or both names are empty');
    }
    const t1 = this.tokenize(norm1);
    const t2 = this.tokenize(norm2);
    if (t1.join(' ') === t2.join(' ')) return this.result(true, 100, norm1, norm2);

    // Joined / split tokens: "RAMKUMAR SINGH" vs "RAM KUMAR SINGH"
    if (t1.join('') === t2.join('')) return this.result(true, 97, norm1, norm2, 'Names differ only in spacing');

    // Same multiset of tokens in a different order
    const sorted1 = [...t1].sort().join(' ');
    const sorted2 = [...t2].sort().join(' ');
    if (sorted1 === sorted2) return this.result(true, 98, norm1, norm2, 'Names contain identical parts in a different order');

    const [shorter, longer] = t1.length <= t2.length ? [t1, t2] : [t2, t1];

    // Greedy best alignment: prefer full-token matches first, then initials.
    const used = new Array(longer.length).fill(false);
    const scores: number[] = new Array(shorter.length).fill(0);
    const kinds: string[] = new Array(shorter.length).fill('NONE');
    const order = shorter
      .map((tok, idx) => ({ tok, idx }))
      .sort((a, b) => b.tok.length - a.tok.length); // align long tokens before initials
    for (const { tok, idx } of order) {
      let best = -1;
      let bestScore = 0;
      let bestKind = 'NONE';
      for (let j = 0; j < longer.length; j++) {
        if (used[j]) continue;
        const sim = this.tokenSimilarity(tok, longer[j]);
        // prefer same relative position on ties (keeps "R KUMAR" -> RAMESH KUMAR aligned)
        const tieBreak = j === idx ? 0.0001 : 0;
        if (sim.score + tieBreak > bestScore) {
          best = j;
          bestScore = sim.score + tieBreak;
          bestKind = sim.kind;
        }
      }
      if (best >= 0 && bestScore > 0) {
        used[best] = true;
        scores[idx] = Math.min(1, bestScore);
        kinds[idx] = bestKind;
      }
    }

    const allAligned = scores.every((s) => s > 0);
    const fullTokenMatches = kinds.filter((k) => k === 'EXACT' || k === 'PHONETIC' || k === 'FUZZY').length;
    const unmatchedLonger = used.filter((u) => !u).length;
    const base = (scores.reduce((a, b) => a + b, 0) / shorter.length) * 100;
    let score = Math.round(Math.max(0, Math.min(100, base - 5 * unmatchedLonger)));

    if (!allAligned) {
      // At least one token of the shorter name has no counterpart: different person.
      score = Math.min(score, 60);
      return this.result(false, score, norm1, norm2, 'One or more name parts do not correspond (e.g. different first name or surname)');
    }
    if (fullTokenMatches === 0) {
      return this.result(false, Math.min(score, 60), norm1, norm2, 'Only initials match; at least one full name part must match');
    }
    if (shorter.length === 1 && longer.length > 1) {
      // Single-name record (common on Aadhaar / older voter rolls): never better than the threshold.
      return this.result(true, Math.min(score, NAME_MATCH_THRESHOLD), norm1, norm2, 'Single-name record matches one part of the full name');
    }
    const isMatch = score >= NAME_MATCH_THRESHOLD;
    return this.result(
      isMatch,
      score,
      norm1,
      norm2,
      isMatch
        ? kinds.includes('INITIAL')
          ? 'Initials match full name parts'
          : unmatchedLonger > 0
            ? 'One name has additional parts (e.g. middle name)'
            : 'Minor spelling / transliteration variation'
        : `Similarity score ${score}% is below the required ${NAME_MATCH_THRESHOLD}% threshold`
    );
  }

  /**
   * Cross-validates all supplied document names against each other (legacy helper).
   */
  public static validateAllDocuments(input: CrossDocumentValidationInput): CrossDocumentValidationResult {
    const docs = [
      { type: 'PAN Card', name: input.panName },
      { type: 'Aadhaar Card', name: input.aadhaarName },
      { type: 'Driving License', name: input.dlName },
      { type: 'Voter ID', name: input.voterName },
      { type: 'Passport', name: input.passportName },
      { type: 'Bank Account', name: input.bankRegisteredName },
    ].filter((d) => Boolean(d.name && d.name.trim().length > 0)) as { type: string; name: string }[];

    if (docs.length === 0) {
      return {
        isValid: false,
        overallScore: 0,
        primaryName: '',
        mismatches: [{ doc1: 'N/A', name1: '', doc2: 'N/A', name2: '', score: 0, reason: 'No document names provided' }],
      };
    }
    if (docs.length === 1) {
      return { isValid: true, overallScore: 100, primaryName: this.normalize(docs[0].name), mismatches: [] };
    }

    const mismatches: CrossDocumentValidationResult['mismatches'] = [];
    let totalScore = 0;
    let comparisons = 0;
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const res = this.compare(docs[i].name, docs[j].name);
        totalScore += res.score;
        comparisons++;
        if (!res.isMatch) {
          mismatches.push({
            doc1: docs[i].type,
            name1: docs[i].name,
            doc2: docs[j].type,
            name2: docs[j].name,
            score: res.score,
            reason: res.reason || `Name mismatch (${res.score}%) between ${docs[i].type} and ${docs[j].type}`,
          });
        }
      }
    }
    return {
      isValid: mismatches.length === 0,
      overallScore: Math.round(totalScore / comparisons),
      primaryName: this.normalize(docs[0].name),
      mismatches,
    };
  }
}

export default NameMatcherService;
