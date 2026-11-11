/**
 * 180 Verify - resident verification session orchestration.
 * Implements the session API contract (see ./README.md). Controllers stay thin; all decisions live here.
 */

import crypto from 'crypto';
import apiSetuService from '../apisetu.service';
import razorpayVerificationService from '../razorpay-verification.service';
import NameMatcherService from '../name-matcher.service';
import CrossDocumentValidatorService, { DocumentRecord } from '../cross-document-validator.service';
import {
  CHALLENGE_TTL_MS,
  MAX_BANK_ATTEMPTS,
  MAX_CHALLENGES_PER_SESSION,
  MAX_COMPLETE_ATTEMPTS,
  MAX_DOC_ATTEMPTS,
  MAX_IMAGE_BYTES,
  MAX_LIVENESS_FRAMES,
  SANDBOX_DEMO_APP_NAME,
  SANDBOX_DEMO_CLIENT_ID,
  SESSION_TTL_MS,
  getEnvironment,
  getProfileFrontendUrl,
  isSandbox,
  requirePassiveAntiSpoof,
} from './config';
import { ProviderUnavailableError, VerifyError, isBiometricsUnavailable } from './errors';
import { FaceCache } from './face-cache';
import { biometrics, LivenessStep } from './biometrics-port';
import { aadhaarLast4, maskAadhaar, maskAccount, maskDocNumber, maskName, maskVpa } from './pii';
import { BankStep, DocStep, FINAL_STATUSES, SessionRecord, SessionStatus, StepError, sessionStore } from './session-store';
import { signResult, signSessionToken } from './tokens';
import { DOC_TYPES, DocType, Gender, IDENTITY_DOC_TYPES, IdentityDocType, REGISTRY_DOC_TYPES } from './types';
import { validateAadhaar, validateAccountNumber, validateIfsc, validateVpa } from './validators';
import type { VerifyApp } from '../../middleware/verification-auth.middleware';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DOC_LABEL: Record<DocType, string> = {
  PAN: 'PAN',
  DRIVING_LICENSE: 'Driving licence',
  VOTER_ID: 'Voter ID',
  AADHAAR: 'Aadhaar (self-declared)',
  BANK_ACCOUNT: 'Bank account',
  FACE_MATCH: 'Face match',
};

const CROSS_DOC_TYPE: Record<IdentityDocType, DocumentRecord['docType']> = {
  PAN: 'PAN Card',
  DRIVING_LICENSE: 'Driving License',
  VOTER_ID: 'Voter ID',
  AADHAAR: 'Aadhaar Card',
};

function isIdentityDoc(t: string): t is IdentityDocType {
  return (IDENTITY_DOC_TYPES as readonly string[]).includes(t);
}

function normGender(g?: string): Gender | undefined {
  const n = CrossDocumentValidatorService.normalizeGender(g || '');
  return n || undefined;
}

/** Validates a base64 / data-URL image: type, decodability and the 4 MB limit. Returns the input unchanged. */
export function assertImage(image: unknown, field: string): string {
  if (typeof image !== 'string' || image.length < 32) {
    throw new VerifyError(400, 'INVALID_IMAGE', `${field} must be a base64-encoded JPEG/PNG (data URL).`);
  }
  const m = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.*)$/s);
  if (image.startsWith('data:') && !m) {
    throw new VerifyError(400, 'INVALID_IMAGE', `${field} must be a JPEG, PNG or WebP data URL.`);
  }
  const b64 = m ? m[2] : image;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 2048))) {
    throw new VerifyError(400, 'INVALID_IMAGE', `${field} is not valid base64.`);
  }
  const clean = b64.replace(/\s+/g, '');
  const bytes = Math.floor((clean.length * 3) / 4) - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new VerifyError(413, 'IMAGE_TOO_LARGE', `${field} exceeds the 4 MB limit.`);
  }
  return image;
}

function newSessionId(): string {
  return 'vsess_' + crypto.randomBytes(16).toString('hex');
}

/**
 * ['NEUTRAL', TURN_LEFT|TURN_RIGHT, <the other TURN or BLINK>]. The engine can only verify head-turn
 * direction (BLINK is checked for single face / same identity / frontal), so step 2 is always a TURN_*.
 */
export function generateChallengeSteps(): LivenessStep[] {
  const turn: LivenessStep = crypto.randomInt(0, 2) === 0 ? 'TURN_LEFT' : 'TURN_RIGHT';
  const other: LivenessStep = turn === 'TURN_LEFT' ? 'TURN_RIGHT' : 'TURN_LEFT';
  const third: LivenessStep = crypto.randomInt(0, 2) === 0 ? other : 'BLINK';
  return ['NEUTRAL', turn, third];
}

function assertActive(session: SessionRecord): void {
  if (FINAL_STATUSES.includes(session.status)) {
    if (session.status === 'EXPIRED') throw new VerifyError(410, 'SESSION_EXPIRED', 'This verification session has expired. Please start a new one.');
    throw new VerifyError(409, 'SESSION_COMPLETED', 'This verification session is already completed.');
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new VerifyError(410, 'SESSION_EXPIRED', 'This verification session has expired. Please start a new one.');
  }
}

/** Registry-sourced names from verified identity docs (used for bank comparison). */
function registryNames(session: SessionRecord): { docType: DocType; name: string }[] {
  const out: { docType: DocType; name: string }[] = [];
  for (const t of REGISTRY_DOC_TYPES) {
    const s = session.steps.documents[t];
    if (s && s.status === 'VERIFIED' && s.source === 'REGISTRY' && s.registry.name) out.push({ docType: t, name: s.registry.name });
  }
  return out;
}

function bestNameMatch(candidate: string, refs: { name: string }[]): { score: number; passed: boolean } {
  let best = { score: 0, passed: false };
  for (const r of refs) {
    const c = NameMatcherService.compare(candidate, r.name);
    if (c.score > best.score || (c.isMatch && !best.passed)) best = { score: c.score, passed: c.isMatch };
  }
  return best;
}

// ─── Service ────────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  app: VerifyApp;
  documents: unknown;
  strictNameMatching?: unknown;
  parentOrigin?: string | null;
  redirectUri?: string | null;
}

export class VerificationSessionService {
  static parseDocuments(raw: unknown): DocType[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new VerifyError(400, 'VALIDATION_ERROR', `documents must be a non-empty array of: ${DOC_TYPES.join(', ')}.`);
    }
    const docs = [...new Set(raw.map((d) => String(d).trim().toUpperCase()))];
    const bad = docs.filter((d) => !(DOC_TYPES as readonly string[]).includes(d));
    if (bad.length) throw new VerifyError(400, 'VALIDATION_ERROR', `Unsupported document type(s): ${bad.join(', ')}.`);
    if (!docs.some(isIdentityDoc)) {
      throw new VerifyError(400, 'VALIDATION_ERROR', 'At least one identity document (PAN, DRIVING_LICENSE, VOTER_ID or AADHAAR) is required.');
    }
    return docs as DocType[];
  }

  static async createSession(input: CreateSessionInput) {
    const documents = this.parseDocuments(input.documents);
    const environment = getEnvironment();
    const id = newSessionId();
    const jti = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await sessionStore().create({
      id,
      appId: input.app.id,
      clientId: input.app.clientId,
      status: 'PENDING',
      environment,
      documents,
      strictNameMatching: input.strictNameMatching === undefined ? true : Boolean(input.strictNameMatching),
      parentOrigin: input.parentOrigin || null,
      redirectUri: input.redirectUri || null,
      tokenJti: jti,
      expiresAt,
    });
    await sessionStore().addEvent(id, 'SESSION_CREATED', { documents, environment, clientId: input.app.clientId });
    const sessionToken = signSessionToken(id, jti, expiresAt);
    const verifyUrl = `${getProfileFrontendUrl()}/verify?session_id=${encodeURIComponent(id)}#st=${encodeURIComponent(sessionToken)}`;
    return { sessionId: id, sessionToken, verifyUrl, expiresAt: expiresAt.toISOString(), documents, environment };
  }

  static async createDemoSession(sandboxApp: VerifyApp) {
    if (!isSandbox()) throw new VerifyError(404, 'NOT_FOUND', 'Demo sessions are only available in the sandbox environment.');
    return this.createSession({
      app: sandboxApp,
      documents: [...DOC_TYPES],
      strictNameMatching: true,
      parentOrigin: null,
    });
  }

  static publicView(session: SessionRecord, app: VerifyApp | null) {
    const docs: Record<string, { status: 'PENDING' | 'VERIFIED' | 'REJECTED'; faceDetected: boolean }> = {};
    for (const t of session.documents) {
      if (!isIdentityDoc(t)) continue;
      const s = session.steps.documents[t];
      docs[t] = { status: s ? s.status : 'PENDING', faceDetected: Boolean(s?.faceDetected) };
    }
    const bankRequested = session.documents.includes('BANK_ACCOUNT');
    const faceRequested = session.documents.includes('FACE_MATCH');
    return {
      sessionId: session.id,
      appName: app?.name || (session.clientId === SANDBOX_DEMO_CLIENT_ID ? SANDBOX_DEMO_APP_NAME : 'Unknown application'),
      appLogoUrl: app?.logoUrl || null,
      documents: session.documents,
      status: session.status,
      parentOrigin: session.parentOrigin,
      environment: session.environment,
      expiresAt: session.expiresAt.toISOString(),
      steps: {
        documents: docs,
        bank: { status: bankRequested ? session.steps.bank?.status || 'PENDING' : 'NOT_REQUESTED' },
        face: { status: faceRequested ? session.steps.face?.status || 'PENDING' : 'NOT_REQUESTED' },
      },
    };
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  static async submitDocument(session: SessionRecord, body: any) {
    assertActive(session);
    const docType = String(body?.docType || '').toUpperCase() as DocType;
    if (!isIdentityDoc(docType)) {
      throw new VerifyError(400, 'VALIDATION_ERROR', 'docType must be one of PAN, DRIVING_LICENSE, VOTER_ID, AADHAAR.');
    }
    if (!session.documents.includes(docType)) {
      throw new VerifyError(400, 'DOC_TYPE_NOT_REQUESTED', `${docType} was not requested for this session.`);
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) throw new VerifyError(400, 'VALIDATION_ERROR', 'name is required (max 120 characters).');
    const dob = body.dob ? String(body.dob).trim() : undefined;
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new VerifyError(400, 'VALIDATION_ERROR', "dob must be 'YYYY-MM-DD'.");
    if (dob && !CrossDocumentValidatorService.normalizeDob(dob)) throw new VerifyError(400, 'VALIDATION_ERROR', 'dob is not a valid date.');
    const gender = body.gender ? normGender(String(body.gender)) : undefined;
    if (body.gender && !gender) throw new VerifyError(400, 'VALIDATION_ERROR', "gender must be 'MALE', 'FEMALE' or 'OTHER'.");
    const fatherName = typeof body.fatherName === 'string' && body.fatherName.trim() ? body.fatherName.trim().slice(0, 120) : undefined;
    const image = body.image !== undefined && body.image !== null && body.image !== '' ? assertImage(body.image, 'image') : undefined;
    const number = body.number !== undefined && body.number !== null ? String(body.number).trim() : '';
    if (docType !== 'AADHAAR' && !number) throw new VerifyError(400, 'VALIDATION_ERROR', 'number is required for this document type.');

    const attempts = (session.docAttempts[docType] || 0) + 1;
    if (attempts > MAX_DOC_ATTEMPTS) {
      throw new VerifyError(429, 'TOO_MANY_ATTEMPTS', `Maximum ${MAX_DOC_ATTEMPTS} attempts reached for ${docType}.`);
    }

    // Registry / format checks (format errors throw 400 before an attempt is counted).
    let step: DocStep;
    if (docType === 'AADHAAR') {
      step = this.buildAadhaarStep(session, { number, name, dob, gender, fatherName });
    } else {
      // count the attempt before calling a paid provider
      await sessionStore().update(session.id, { docAttempts: { ...session.docAttempts, [docType]: attempts }, status: 'IN_PROGRESS' });
      session.docAttempts[docType] = attempts;
      step = await this.buildRegistryStep(session, docType, { number, name, dob, gender, fatherName });
    }
    if (docType === 'AADHAAR') {
      session.docAttempts[docType] = attempts;
    }

    // Face crop (never persisted; short-lived in-process cache).
    FaceCache.remove(session.id, docType);
    if (image) {
      try {
        const crop = await biometrics().extractFaceFromDocument(image);
        if (crop?.hasFace && crop.faceCount >= 1 && crop.faceBase64) {
          step.faceDetected = true;
          FaceCache.set(session.id, docType, crop.faceBase64);
        }
        if (crop?.faceCount > 1) step.errors.push({ code: 'MULTIPLE_FACES_ON_DOCUMENT', message: 'More than one face was found on the document image.' });
        if (!crop?.hasFace) step.errors.push({ code: 'NO_DOCUMENT_FACE', message: 'No face could be detected on the document image.' });
      } catch (err: any) {
        if (!isBiometricsUnavailable(err)) throw err;
        step.errors.push({ code: 'BIOMETRICS_ENGINE_UNAVAILABLE', message: 'Face detection is temporarily unavailable; please re-upload the document image shortly.' });
      }
    }

    const steps = { ...session.steps, documents: { ...session.steps.documents, [docType]: step } };
    await sessionStore().update(session.id, {
      steps,
      docAttempts: { ...session.docAttempts, [docType]: attempts },
      status: 'IN_PROGRESS',
    });
    await sessionStore().addEvent(session.id, 'DOCUMENT_SUBMITTED', {
      docType,
      status: step.status,
      numberMasked: step.numberMasked,
      faceDetected: step.faceDetected,
      errorCodes: step.errors.map((e) => e.code),
      attempt: attempts,
    });

    return {
      docType,
      status: step.status,
      source: step.source,
      faceDetected: step.faceDetected,
      registry: {
        nameMasked: maskName(step.registry.name),
        dobMatch: step.dobMatch,
        nameMatch: step.nameMatch,
        fatherMatch: step.fatherMatch,
        validTill: step.registry.validTill,
        docStatus: step.registry.docStatus,
      },
      errors: step.errors,
      attemptsRemaining: Math.max(0, MAX_DOC_ATTEMPTS - attempts),
    };
  }

  private static buildAadhaarStep(
    session: SessionRecord,
    input: { number: string; name: string; dob?: string; gender?: Gender; fatherName?: string }
  ): DocStep {
    const errors: StepError[] = [];
    let numberMasked: string | undefined;
    if (input.number) {
      const check = validateAadhaar(input.number);
      if (!check.valid) throw new VerifyError(400, 'INVALID_DOCUMENT_NUMBER', check.reason!);
      numberMasked = maskAadhaar(aadhaarLast4(check.normalized)); // only last 4 survive this line
    }
    // Self-declared data: compare against registry-sourced names/DOBs already verified in this session.
    const refs = registryNames(session);
    const nameMatch = refs.length ? bestNameMatch(input.name, refs) : { score: 100, passed: true };
    let dobMatch: boolean | undefined;
    const declaredDob = input.dob ? CrossDocumentValidatorService.normalizeDob(input.dob) : null;
    for (const t of REGISTRY_DOC_TYPES) {
      const s = session.steps.documents[t];
      const rd = s?.status === 'VERIFIED' && s.registry.dob ? CrossDocumentValidatorService.normalizeDob(s.registry.dob) : null;
      if (declaredDob && rd) dobMatch = (dobMatch ?? true) && CrossDocumentValidatorService.compareDobs(declaredDob, rd).isMatch;
    }
    if (!nameMatch.passed) errors.push({ code: 'DOCUMENT_NAME_MISMATCH', message: 'The name on Aadhaar does not match the name on your verified documents.' });
    if (dobMatch === false) errors.push({ code: 'DOCUMENT_DOB_MISMATCH', message: 'The date of birth on Aadhaar does not match your verified documents.' });
    return {
      status: errors.length ? 'REJECTED' : 'VERIFIED',
      source: 'SELF_DECLARED',
      numberMasked,
      faceDetected: false,
      registry: {},
      declared: { name: input.name, dob: input.dob, gender: input.gender, fatherName: input.fatherName },
      nameMatch,
      dobMatch,
      errors,
      submittedAt: new Date().toISOString(),
    };
  }

  private static async buildRegistryStep(
    session: SessionRecord,
    docType: 'PAN' | 'DRIVING_LICENSE' | 'VOTER_ID',
    input: { number: string; name: string; dob?: string; gender?: Gender; fatherName?: string }
  ): Promise<DocStep> {
    const errors: StepError[] = [];
    let rec: any;
    if (docType === 'PAN') rec = await apiSetuService.verifyPan(input.number, { name: input.name, dob: input.dob, gender: input.gender });
    else if (docType === 'DRIVING_LICENSE') rec = await apiSetuService.verifyDrivingLicense(input.number, { name: input.name, dob: input.dob });
    else rec = await apiSetuService.verifyVoterId(input.number, { name: input.name });

    const numberMasked = rec.panMasked || rec.dlMasked || rec.epicMasked || maskDocNumber(docType, input.number);
    const base: DocStep = {
      status: 'REJECTED',
      source: 'REGISTRY',
      numberMasked,
      faceDetected: false,
      registry: {},
      nameMatch: { score: 0, passed: false },
      errors,
      provider: rec.provider,
      submittedAt: new Date().toISOString(),
    };
    if (!rec.found) {
      errors.push({ code: 'DOCUMENT_NOT_FOUND', message: `No ${DOC_LABEL[docType]} record was found for this number.` });
      return base;
    }
    base.registry = {
      name: rec.name,
      dob: rec.dob,
      fatherName: rec.fatherName,
      gender: rec.gender,
      docStatus: rec.status,
      validTill: rec.validTill,
    };

    // Document status
    if (docType === 'PAN' && rec.status && rec.status !== 'VALID') {
      errors.push({ code: 'DOCUMENT_INVALID', message: `The PAN is ${String(rec.status).toLowerCase()} per the Income Tax registry.` });
    }
    if (docType === 'DRIVING_LICENSE') {
      if (rec.status === 'EXPIRED' || (rec.validTill && rec.validTill < new Date().toISOString().slice(0, 10))) {
        errors.push({ code: 'DOCUMENT_EXPIRED', message: 'The driving licence has expired.' });
      } else if (rec.status && rec.status !== 'ACTIVE') {
        errors.push({ code: 'DOCUMENT_INVALID', message: `The driving licence is ${String(rec.status).toLowerCase()}.` });
      }
    }
    if (docType === 'VOTER_ID' && rec.status && rec.status !== 'ACTIVE') {
      errors.push({ code: 'DOCUMENT_INVALID', message: 'The voter ID is not active on the electoral roll.' });
    }

    // Name: only ever against the registry's own value.
    if (rec.name) {
      const c = NameMatcherService.compare(input.name, rec.name);
      base.nameMatch = { score: c.score, passed: c.isMatch };
      if (!c.isMatch) {
        if (session.strictNameMatching) {
          errors.push({ code: 'DOCUMENT_NAME_MISMATCH', message: `The name entered does not match the ${DOC_LABEL[docType]} registry record.` });
        } else {
          base.nameReview = true;
        }
      }
    } else if (rec.issuerAttested?.name) {
      // Issuer verified the submitted tuple but did not echo the name: pass, but never auto-approve on it.
      base.nameMatch = { score: 100, passed: true };
      base.nameAttestedOnly = true;
    } else {
      errors.push({ code: 'REGISTRY_DATA_INCOMPLETE', message: 'The registry did not return a name for this record.' });
    }

    // DOB
    if (input.dob && rec.dob) {
      const a = CrossDocumentValidatorService.normalizeDob(input.dob);
      const b = CrossDocumentValidatorService.normalizeDob(rec.dob);
      if (a && b) {
        base.dobMatch = CrossDocumentValidatorService.compareDobs(a, b).isMatch;
        if (!base.dobMatch) errors.push({ code: 'DOCUMENT_DOB_MISMATCH', message: `The date of birth does not match the ${DOC_LABEL[docType]} registry record.` });
      }
    }

    // Gender
    if (input.gender && rec.gender && input.gender !== rec.gender) {
      errors.push({ code: 'DOCUMENT_GENDER_MISMATCH', message: `The gender does not match the ${DOC_LABEL[docType]} registry record.` });
    }

    // Father's name: informational only (relation type differs across documents).
    if (input.fatherName && rec.fatherName) {
      const c = NameMatcherService.compare(
        CrossDocumentValidatorService.normalizeFatherOrGuardianName(input.fatherName),
        CrossDocumentValidatorService.normalizeFatherOrGuardianName(rec.fatherName)
      );
      base.fatherMatch = { score: c.score, passed: c.isMatch };
    }

    const blocking = errors.length > 0;
    base.status = blocking ? 'REJECTED' : 'VERIFIED';
    if (!blocking && base.nameReview) {
      errors.push({ code: 'NAME_REVIEW_REQUIRED', message: 'The name is below the match threshold; the result will require manual review.' });
    }
    if (base.fatherMatch && !base.fatherMatch.passed) {
      errors.push({ code: 'FATHER_NAME_MISMATCH', message: "Father's name differs from the registry record (informational)." });
    }
    return base;
  }

  // ── Bank ──────────────────────────────────────────────────────────────────
  static async submitBank(session: SessionRecord, body: any) {
    assertActive(session);
    if (!session.documents.includes('BANK_ACCOUNT')) throw new VerifyError(400, 'DOC_TYPE_NOT_REQUESTED', 'BANK_ACCOUNT was not requested for this session.');
    const mode = String(body?.mode || '').toUpperCase();
    if (mode !== 'UPI' && mode !== 'ACCOUNT') throw new VerifyError(400, 'VALIDATION_ERROR', "mode must be 'UPI' or 'ACCOUNT'.");
    const refs = registryNames(session);
    if (!refs.length) {
      throw new VerifyError(409, 'STEP_INCOMPLETE', 'Verify at least one identity document (PAN, driving licence or voter ID) before the bank step.');
    }
    if (session.bankAttempts >= MAX_BANK_ATTEMPTS) throw new VerifyError(429, 'TOO_MANY_ATTEMPTS', `Maximum ${MAX_BANK_ATTEMPTS} bank verification attempts reached.`);

    // format validation happens inside the services (throws 400 before the attempt is counted)
    let step: BankStep;
    if (mode === 'UPI') {
      const vpa = String(body.vpa || '');
      const chk = validateVpa(vpa);
      if (!chk.valid) throw new VerifyError(400, 'INVALID_VPA', chk.reason!);
      await sessionStore().update(session.id, { bankAttempts: session.bankAttempts + 1 });
      const rec = await razorpayVerificationService.validateUpi(chk.normalized);
      step = this.evaluateBank('UPI', maskVpa(chk.normalized), undefined, rec.found ? 'ACTIVE' : 'INVALID', rec.customerName, refs, undefined);
      if (!rec.found) step.errors = [{ code: 'UPI_NOT_FOUND', message: 'This UPI ID could not be found.' }];
    } else {
      const acc = validateAccountNumber(String(body.accountNumber || ''));
      if (!acc.valid) throw new VerifyError(400, 'INVALID_ACCOUNT_NUMBER', acc.reason!);
      const ifsc = validateIfsc(String(body.ifsc || ''));
      if (!ifsc.valid) throw new VerifyError(400, 'INVALID_IFSC', ifsc.reason!);
      await sessionStore().update(session.id, { bankAttempts: session.bankAttempts + 1 });
      const rec = await razorpayVerificationService.verifyBankAccount(acc.normalized, ifsc.normalized, session.id);
      step = this.evaluateBank('ACCOUNT', maskAccount(acc.normalized), ifsc.normalized, rec.accountStatus, rec.registeredName, refs, rec.validationId);
      if (rec.accountStatus === 'INVALID') step.errors = [{ code: 'BANK_ACCOUNT_INVALID', message: 'The bank could not validate this account.' }];
    }

    await sessionStore().update(session.id, { steps: { ...session.steps, bank: step }, status: 'IN_PROGRESS' });
    await sessionStore().addEvent(session.id, 'BANK_SUBMITTED', { mode, refMasked: step.refMasked, status: step.status, errorCodes: step.errors.map((e) => e.code) });
    return {
      status: step.status,
      registeredNameMasked: step.registeredNameMasked ?? null,
      nameMatch: step.nameMatch,
      errors: step.errors,
      attemptsRemaining: Math.max(0, MAX_BANK_ATTEMPTS - session.bankAttempts - 1),
    };
  }

  private static evaluateBank(
    mode: 'UPI' | 'ACCOUNT',
    refMasked: string,
    ifsc: string | undefined,
    accountStatus: 'ACTIVE' | 'INVALID' | 'PENDING',
    registeredName: string | undefined,
    refs: { name: string }[],
    validationId: string | undefined
  ): BankStep {
    const step: BankStep = {
      status: 'REJECTED',
      mode,
      refMasked,
      ifsc,
      validationId,
      registeredNameMasked: maskName(registeredName),
      nameMatch: { score: 0, passed: false },
      errors: [],
      submittedAt: new Date().toISOString(),
    };
    if (accountStatus === 'PENDING') {
      step.status = 'PENDING';
      return step;
    }
    if (accountStatus !== 'ACTIVE') return step;
    if (!registeredName) {
      step.errors.push({ code: 'BANK_NAME_UNAVAILABLE', message: 'The bank did not return the account holder name.' });
      return step;
    }
    step.nameMatch = bestNameMatch(registeredName, refs);
    step.status = step.nameMatch.passed ? 'VERIFIED' : 'REJECTED';
    if (!step.nameMatch.passed) step.errors.push({ code: 'BANK_NAME_MISMATCH', message: 'The bank account holder name does not match your identity documents.' });
    return step;
  }

  // ── Liveness challenge ───────────────────────────────────────────────────────
  static async issueChallenge(session: SessionRecord) {
    assertActive(session);
    if (!session.documents.includes('FACE_MATCH')) throw new VerifyError(400, 'DOC_TYPE_NOT_REQUESTED', 'FACE_MATCH was not requested for this session.');
    if (session.challengeCount >= MAX_CHALLENGES_PER_SESSION) throw new VerifyError(429, 'TOO_MANY_ATTEMPTS', 'Too many liveness challenges requested for this session.');
    if (session.completeAttempts >= MAX_COMPLETE_ATTEMPTS) throw new VerifyError(429, 'TOO_MANY_ATTEMPTS', 'No verification attempts remaining.');
    const challengeId = 'lch_' + crypto.randomBytes(12).toString('hex');
    const steps = generateChallengeSteps();
    const expiresAt = new Date(Math.min(Date.now() + CHALLENGE_TTL_MS, session.expiresAt.getTime()));
    await sessionStore().update(session.id, {
      challengeId,
      challengeSteps: steps,
      challengeExpiresAt: expiresAt,
      challengeUsedAt: null,
      challengeCount: session.challengeCount + 1,
      status: 'IN_PROGRESS',
    });
    await sessionStore().addEvent(session.id, 'CHALLENGE_ISSUED', { challengeId, steps });
    return { challengeId, steps, expiresAt: expiresAt.toISOString() };
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  static async complete(session: SessionRecord, body: any) {
    assertActive(session);
    if (session.completeAttempts >= MAX_COMPLETE_ATTEMPTS) throw new VerifyError(429, 'TOO_MANY_ATTEMPTS', 'No verification attempts remaining.');

    // 1. All requested steps present (no attempt consumed).
    const missing = session.documents.filter((t) => isIdentityDoc(t) && !session.steps.documents[t]);
    if (missing.length) throw new VerifyError(409, 'STEP_INCOMPLETE', `Please complete: ${missing.map((m) => DOC_LABEL[m]).join(', ')}.`);
    if (session.documents.includes('BANK_ACCOUNT') && !session.steps.bank) throw new VerifyError(409, 'STEP_INCOMPLETE', 'Please complete the bank account step.');

    const faceRequested = session.documents.includes('FACE_MATCH');
    let frames: { step: LivenessStep; image: string; capturedAt: number }[] = [];
    let selfie = '';
    let docFaces: { docType: string; photoBase64: string }[] = [];
    if (faceRequested) {
      const challengeId = String(body?.challengeId || '');
      if (!challengeId) throw new VerifyError(400, 'VALIDATION_ERROR', 'challengeId is required.');
      selfie = assertImage(body?.selfie, 'selfie');
      if (!Array.isArray(body?.frames) || body.frames.length === 0) throw new VerifyError(400, 'VALIDATION_ERROR', 'frames are required.');
      if (body.frames.length > MAX_LIVENESS_FRAMES) throw new VerifyError(400, 'VALIDATION_ERROR', `At most ${MAX_LIVENESS_FRAMES} liveness frames are accepted.`);
      frames = body.frames.map((f: any, i: number) => ({
        step: String(f?.step || '').toUpperCase() as LivenessStep,
        image: assertImage(f?.image, `frames[${i}].image`),
        // Accept epoch ms (number) or an ISO-8601 string (what the hosted page sends).
        capturedAt: typeof f?.capturedAt === 'string' && !/^\d+$/.test(f.capturedAt)
          ? Date.parse(f.capturedAt)
          : Number(f?.capturedAt),
      }));
      docFaces = FaceCache.list(session.id);
      if (!docFaces.length) {
        throw new VerifyError(409, 'NO_DOCUMENT_FACE', 'No face photo is available from your documents. Re-upload a clear photo of an identity document.');
      }
      if (session.challengeId !== challengeId) throw new VerifyError(409, 'CHALLENGE_INVALID', 'Unknown liveness challenge. Request a new challenge.');
      if (session.challengeUsedAt) throw new VerifyError(409, 'CHALLENGE_INVALID', 'This liveness challenge was already used. Request a new challenge.');
      if (!session.challengeExpiresAt || session.challengeExpiresAt.getTime() <= Date.now()) {
        throw new VerifyError(410, 'CHALLENGE_EXPIRED', 'The liveness challenge expired. Request a new challenge.');
      }
      const consumed = await sessionStore().consumeChallenge(session.id, challengeId, new Date());
      if (!consumed) throw new VerifyError(409, 'CHALLENGE_INVALID', 'This liveness challenge was already used or has expired. Request a new challenge.');
    } else {
      const claimed = await sessionStore().claimCompleteAttempt(session.id);
      if (!claimed) throw new VerifyError(429, 'TOO_MANY_ATTEMPTS', 'No verification attempts remaining.');
    }
    const attempt = session.completeAttempts + 1;
    const attemptsRemaining = Math.max(0, MAX_COMPLETE_ATTEMPTS - attempt);

    try {
      return await this.evaluateAndFinalize(session, { faceRequested, frames, selfie, docFaces, attempt, attemptsRemaining });
    } catch (err: any) {
      // Infrastructure failures do not burn the resident's attempt.
      if (isBiometricsUnavailable(err) || err instanceof ProviderUnavailableError || (err instanceof VerifyError && err.httpStatus >= 500)) {
        await sessionStore().releaseCompleteAttempt(session.id);
      }
      throw err;
    }
  }

  private static async evaluateAndFinalize(
    session: SessionRecord,
    ctx: {
      faceRequested: boolean;
      frames: { step: LivenessStep; image: string; capturedAt: number }[];
      selfie: string;
      docFaces: { docType: string; photoBase64: string }[];
      attempt: number;
      attemptsRemaining: number;
    }
  ) {
    const checks: { id: string; label: string; passed: boolean; detail?: string }[] = [];
    const rejectCodes: string[] = [];
    const reviewReasons: string[] = [];

    // 2. Per-document results
    for (const t of session.documents) {
      if (!isIdentityDoc(t)) continue;
      const s = session.steps.documents[t]!;
      const passed = s.status === 'VERIFIED';
      checks.push({
        id: `DOC_${t}`,
        label: t === 'AADHAAR' ? 'Aadhaar details (self-declared)' : `${DOC_LABEL[t]} verified with registry`,
        passed,
        detail: passed ? (s.source === 'SELF_DECLARED' ? 'Self-declared; not verified against UIDAI' : undefined) : s.errors[0]?.message,
      });
      if (!passed) rejectCodes.push(s.errors[0]?.code || 'DOCUMENT_INVALID');
      if (passed && s.nameReview) reviewReasons.push(`${t}: name below threshold (strictNameMatching=false)`);
      if (passed && s.nameAttestedOnly) reviewReasons.push(`${t}: name attested by issuer but not returned`);
    }
    const registryVerified = REGISTRY_DOC_TYPES.some((t) => session.steps.documents[t]?.status === 'VERIFIED');
    if (!registryVerified && !rejectCodes.length) reviewReasons.push('No registry-verified identity document (self-declared data only)');

    // 3. Cross-document validation (registry first, self-declared weighted lower)
    const records: DocumentRecord[] = [];
    for (const t of session.documents) {
      if (!isIdentityDoc(t)) continue;
      const s = session.steps.documents[t]!;
      if (s.status !== 'VERIFIED') continue;
      if (s.source === 'REGISTRY') {
        records.push({ docType: CROSS_DOC_TYPE[t], source: 'REGISTRY', name: s.registry.name, dob: s.registry.dob, fatherName: s.registry.fatherName, gender: s.registry.gender });
      } else if (s.declared) {
        records.push({ docType: CROSS_DOC_TYPE[t], source: 'SELF_DECLARED', name: s.declared.name, dob: s.declared.dob, fatherName: s.declared.fatherName, gender: s.declared.gender });
      }
    }
    const cross = CrossDocumentValidatorService.validateDocuments(records);
    const fieldCode: Record<string, string> = { NAME: 'DOCUMENT_NAME_MISMATCH', DOB: 'DOCUMENT_DOB_MISMATCH', GENDER: 'DOCUMENT_GENDER_MISMATCH' };
    for (const field of ['NAME', 'DOB', 'GENDER'] as const) {
      const crit = cross.criticalMismatches.filter((m) => m.field === field);
      const warn = cross.warnings.filter((m) => m.field === field && m.requiresReview);
      if (records.length > 1) {
        checks.push({
          id: `CROSS_DOC_${field}`,
          label: `${field === 'DOB' ? 'Date of birth' : field === 'NAME' ? 'Name' : 'Gender'} consistent across documents`,
          passed: crit.length === 0 && warn.length === 0,
          detail: crit[0]?.reason || warn[0]?.reason,
        });
      }
      if (crit.length) rejectCodes.push(fieldCode[field]);
      if (warn.length) reviewReasons.push(`Cross-document ${field} conflict involving self-declared data`);
    }

    // 4. Bank
    let bankVerified = false;
    let steps = session.steps;
    if (session.documents.includes('BANK_ACCOUNT')) {
      let bank = session.steps.bank!;
      if (bank.status === 'PENDING' && bank.validationId) {
        const rec = await razorpayVerificationService.pollBankValidation(bank.validationId, bank.refMasked, bank.ifsc || '');
        const refs = registryNames(session);
        bank = this.evaluateBank(bank.mode, bank.refMasked, bank.ifsc, rec.accountStatus, rec.registeredName, refs, bank.validationId);
        if (rec.accountStatus === 'INVALID') bank.errors = [{ code: 'BANK_ACCOUNT_INVALID', message: 'The bank could not validate this account.' }];
        steps = { ...steps, bank };
      }
      bankVerified = bank.status === 'VERIFIED';
      checks.push({
        id: 'BANK',
        label: bank.mode === 'UPI' ? 'UPI holder name matches documents' : 'Bank account holder name matches documents',
        passed: bankVerified,
        detail: bank.status === 'PENDING' ? 'Bank validation still pending' : bank.errors[0]?.message,
      });
      if (bank.status === 'PENDING') reviewReasons.push('Bank validation pending');
      else if (!bankVerified) rejectCodes.push(bank.errors[0]?.code === 'BANK_NAME_MISMATCH' ? 'BANK_NAME_MISMATCH' : bank.errors[0]?.code || 'BANK_ACCOUNT_INVALID');
    }

    // 5. Biometrics (only if nothing final has failed already; avoids needless processing)
    let faceMatchConfidence: number | null = null;
    let livenessScore: number | null = null;
    let retryableCode: string | null = null;
    let faceStatus: 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW' | undefined;
    if (ctx.faceRequested && rejectCodes.length === 0) {
      const expected = session.challengeSteps;
      const got = ctx.frames.map((f) => f.step);
      const sequenceOk =
        got.length === expected.length &&
        got.every((s, i) => s === expected[i]) &&
        ctx.frames.every((f, i) => Number.isFinite(f.capturedAt) && (i === 0 || f.capturedAt >= ctx.frames[i - 1].capturedAt));
      if (!sequenceOk) {
        retryableCode = 'LIVENESS_CHECK_FAILED';
        checks.push({ id: 'LIVENESS', label: 'Liveness challenge', passed: false, detail: 'Frames do not match the issued challenge sequence.' });
      } else {
        const live = await biometrics().evaluateLiveness(ctx.frames.map((f) => ({ step: f.step, image: f.image })));
        livenessScore = typeof live.score === 'number' ? live.score : null;
        checks.push({ id: 'LIVENESS', label: 'Liveness challenge', passed: Boolean(live.passed), detail: live.passed ? undefined : live.reasons?.[0] });
        if (!live.passed) {
          retryableCode = 'LIVENESS_CHECK_FAILED';
        } else {
          if (requirePassiveAntiSpoof() && !live.antiSpoofApplied) {
            reviewReasons.push('Passive anti-spoofing not applied');
            checks.push({ id: 'ANTI_SPOOF', label: 'Passive anti-spoofing', passed: false, detail: 'Anti-spoof model was not applied' });
          }
          const fm = await biometrics().matchFaces(ctx.selfie, ctx.docFaces);
          faceMatchConfidence = typeof fm.overallConfidence === 'number' ? fm.overallConfidence : null;
          const crossInconsistent = fm.mismatchReason === 'CROSS_DOCUMENT_INCONSISTENT';
          checks.push({
            id: 'FACE_MATCH',
            label: 'Selfie matches document photo',
            passed: fm.verdict === 'APPROVE' || (crossInconsistent && fm.overallMatch),
            detail: fm.verdict === 'APPROVE' || crossInconsistent ? undefined : fm.mismatchReason,
          });
          if (crossInconsistent) {
            checks.push({
              id: 'FACE_CROSS_DOCUMENT',
              label: 'Document photos show the same person',
              passed: false,
              detail: 'Each document photo matches the selfie, but two documents do not match each other (CROSS_DOCUMENT_INCONSISTENT).',
            });
          }
          if (fm.verdict === 'REJECT') retryableCode = 'FACE_MISMATCH_DETECTED';
          else if (fm.verdict === 'MANUAL_REVIEW') reviewReasons.push('Face match requires manual review');
          else if (fm.verdict !== 'APPROVE') reviewReasons.push('Unknown face match verdict');
        }
      }
    }

    // 6. Verdict
    let status: 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
    let errorCode: string | undefined;
    let final = true;
    if (rejectCodes.length) {
      status = 'REJECTED';
      errorCode = rejectCodes[0];
    } else if (retryableCode) {
      status = 'REJECTED';
      errorCode = retryableCode;
      final = ctx.attemptsRemaining === 0;
    } else if (reviewReasons.length) {
      status = 'MANUAL_REVIEW';
    } else {
      status = 'APPROVED';
    }
    if (ctx.faceRequested) {
      faceStatus = retryableCode ? 'REJECTED' : status === 'REJECTED' ? undefined : reviewReasons.some((r) => /face|anti-spoof/i.test(r)) ? 'MANUAL_REVIEW' : 'VERIFIED';
    }

    const fullName = cross.primaryIdentity.fullName;
    const summary = {
      fullNameMasked: maskName(fullName) || null,
      checks,
      faceMatchConfidence,
      livenessScore,
    };
    const errorMessages: Record<string, string> = {
      DOCUMENT_NAME_MISMATCH: 'The name does not match across your documents.',
      DOCUMENT_DOB_MISMATCH: 'The date of birth does not match across your documents.',
      DOCUMENT_GENDER_MISMATCH: 'The gender does not match across your documents.',
      BANK_NAME_MISMATCH: 'The bank account holder name does not match your identity documents.',
      FACE_MISMATCH_DETECTED: 'Your selfie does not match the photo on your identity document.',
      LIVENESS_CHECK_FAILED: 'We could not confirm a live person. Please follow the on-screen prompts and try again.',
    };

    const nextSteps = faceStatus ? { ...steps, face: { status: final ? faceStatus : ('PENDING' as const), faceMatchConfidence, livenessScore, lastErrorCode: retryableCode || undefined } } : steps;
    const patch: Partial<SessionRecord> = { steps: nextSteps };

    if (final) {
      const verifiedAt = new Date().toISOString();
      const documents: Record<string, { verified: boolean; numberMasked: string | null }> = {};
      for (const t of session.documents) {
        if (!isIdentityDoc(t)) continue;
        const s = session.steps.documents[t]!;
        documents[t] = { verified: s.status === 'VERIFIED' && s.source === 'REGISTRY', numberMasked: s.numberMasked || null };
      }
      const verifiedProfile =
        status === 'REJECTED'
          ? null
          : {
              fullName,
              dob: cross.primaryIdentity.dob || null,
              fatherName: cross.primaryIdentity.fatherName || null,
              gender: cross.primaryIdentity.gender || null,
              nameSource: cross.primaryIdentity.source || null,
              documents,
              bankVerified,
              faceMatchConfidence,
              livenessScore,
              verifiedAt,
            };
      const payload: Record<string, unknown> = {
        sessionId: session.id,
        clientId: session.clientId,
        status,
        ...(errorCode ? { error_code: errorCode } : {}),
        verifiedProfile,
        environment: session.environment,
      };
      const { jws: signature } = signResult(payload, session.clientId);
      Object.assign(patch, {
        status: status as SessionStatus,
        failureCode: errorCode || null,
        verdict: { status, error_code: errorCode, summary, reviewReasons },
        signedResult: signature,
        completedAt: new Date(),
      });
      FaceCache.purge(session.id);
    } else {
      patch.status = 'IN_PROGRESS';
    }
    await sessionStore().update(session.id, patch);
    await sessionStore().addEvent(session.id, 'COMPLETE_ATTEMPT', {
      attempt: ctx.attempt,
      status,
      final,
      errorCode: errorCode || null,
      reviewReasons,
    });

    return {
      status,
      ...(errorCode ? { error_code: errorCode, error_message: errorMessages[errorCode] || checks.find((c) => !c.passed)?.detail || 'Verification failed.' } : {}),
      final,
      attemptsRemaining: final ? 0 : ctx.attemptsRemaining,
      summary,
    };
  }

  // ── Result (server-to-server) ──────────────────────────────────────────────
  static async getResult(session: SessionRecord) {
    let payload: any = null;
    if (session.signedResult) {
      const parts = session.signedResult.split('.');
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (!session.resultFetchedAt) {
        await sessionStore().update(session.id, { resultFetchedAt: new Date() });
        await sessionStore().addEvent(session.id, 'RESULT_FETCHED', {});
      }
      return { ...payload, signature: session.signedResult };
    }
    const status = session.status !== 'EXPIRED' && session.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : session.status;
    return {
      sessionId: session.id,
      clientId: session.clientId,
      status,
      verifiedProfile: null,
      environment: session.environment,
      signature: null,
    };
  }
}

export default VerificationSessionService;
