/**
 * 180 Identity - Verification Controller ("180 Verify")
 * Location: apps/180-core-backend/src/controllers/verification.controller.ts
 *
 * Two surfaces:
 *  1. Resident session API (/session/...) used by the 180 Profile /verify page and the identity SDK.
 *  2. Standalone B2B endpoints (/pan, /dl, /rc, /gstin, /voter, /bank, /upi, /biometrics/*, /full-kyc),
 *     authenticated with developer client credentials.
 * Errors use the uniform envelope { status:'FAILED', error_code, error_message }.
 * Nothing in this file logs request bodies or identifiers.
 */

import { Request, Response } from 'express';
import apiSetuService from '../services/apisetu.service';
import razorpayVerificationService from '../services/razorpay-verification.service';
import NameMatcherService from '../services/name-matcher.service';
import CrossDocumentValidatorService, { DocumentRecord } from '../services/cross-document-validator.service';
import { biometrics, LivenessStep } from '../services/verification/biometrics-port';
import { getEnvironment, MAX_LIVENESS_FRAMES } from '../services/verification/config';
import { VerifyError, handleError } from '../services/verification/errors';
import { aadhaarLast4, maskAadhaar, maskName } from '../services/verification/pii';
import { sessionStore } from '../services/verification/session-store';
import VerificationSessionService, { assertImage } from '../services/verification/session.service';
import { validateAadhaar } from '../services/verification/validators';
import {
  VerifyApp,
  authenticateClient,
  findApp,
  isOriginRegistered,
  isRedirectUriRegistered,
  parseBasicAuth,
  sandboxDemoApp,
} from '../middleware/verification-auth.middleware';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function nameCmp(declared?: string, registry?: string) {
  if (!declared || !registry) return null;
  const c = NameMatcherService.compare(declared, registry);
  return { score: c.score, passed: c.isMatch, confidence: c.confidence };
}

function dobCmp(declared?: string, registry?: string): boolean | null {
  if (!declared || !registry) return null;
  const a = CrossDocumentValidatorService.normalizeDob(declared);
  const b = CrossDocumentValidatorService.normalizeDob(registry);
  return a && b ? CrossDocumentValidatorService.compareDobs(a, b).isMatch : null;
}

function fatherCmp(declared?: string, registry?: string) {
  if (!declared || !registry) return null;
  return nameCmp(
    CrossDocumentValidatorService.normalizeFatherOrGuardianName(declared),
    CrossDocumentValidatorService.normalizeFatherOrGuardianName(registry)
  );
}

/** Strips raw registry attributes from a record and replaces them with masked values. */
function publicRecord(rec: any) {
  const { name, dob, fatherName, ownerName, legalName, registeredName, customerName, validationId, ...rest } = rec;
  return {
    ...rest,
    ...(name !== undefined ? { nameMasked: maskName(name) } : {}),
    ...(fatherName !== undefined ? { fatherNameMasked: maskName(fatherName) } : {}),
    ...(ownerName !== undefined ? { ownerNameMasked: maskName(ownerName) } : {}),
    ...(registeredName !== undefined ? { registeredNameMasked: maskName(registeredName) } : {}),
    ...(customerName !== undefined ? { customerNameMasked: maskName(customerName) } : {}),
    ...(legalName !== undefined ? { legalName } : {}), // GSTIN legal names are public business data
    ...(dob !== undefined ? { dobAvailable: true } : {}),
  };
}

function ok(res: Response, data: any): void {
  res.json({ status: 'SUCCESS', environment: getEnvironment(), data });
}

export class VerificationController {
  // ═══════════════════════════ Resident session API ═══════════════════════════

  /**
   * POST /session
   *  - server call: Authorization: Basic base64(clientId:clientSecret)
   *  - browser call: body.clientId + Origin registered for the app (allowedOrigins / redirect URI origins)
   */
  public static async createSession(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body || {};
      let app: VerifyApp | null;
      let browserOrigin: string | null = null;
      if (parseBasicAuth(req)) {
        app = await authenticateClient(req);
        if (body.clientId && body.clientId !== app.clientId) throw new VerifyError(400, 'VALIDATION_ERROR', 'clientId does not match the authenticated client.');
      } else {
        const clientId = str(body.clientId);
        if (!clientId) throw new VerifyError(400, 'VALIDATION_ERROR', 'clientId is required.');
        app = await findApp(clientId);
        if (!app || !app.isActive || app.id === null) throw new VerifyError(401, 'INVALID_CLIENT', 'Unknown or inactive client.');
        const origin = str(req.headers.origin as string);
        if (!origin || !isOriginRegistered(app, origin)) {
          throw new VerifyError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not registered for the application. Add it to Allowed Web Origins in the developer portal, or create the session server-side with client credentials.');
        }
        browserOrigin = origin.replace(/\/+$/, '');
      }

      let parentOrigin = str(body.parentOrigin)?.replace(/\/+$/, '') || browserOrigin;
      if (parentOrigin && !isOriginRegistered(app, parentOrigin)) {
        throw new VerifyError(400, 'ORIGIN_NOT_ALLOWED', 'parentOrigin is not registered for this application.');
      }
      const redirectUri = str(body.redirectUri);
      if (redirectUri && !isRedirectUriRegistered(app, redirectUri)) {
        throw new VerifyError(400, 'REDIRECT_URI_NOT_ALLOWED', 'redirectUri is not registered for this application.');
      }
      const out = await VerificationSessionService.createSession({
        app,
        documents: body.documents,
        strictNameMatching: body.strictNameMatching,
        parentOrigin: parentOrigin || null,
        redirectUri: redirectUri || null,
      });
      res.status(201).json(out);
    } catch (err) {
      handleError(res, err, 'createSession');
    }
  }

  /** POST /session/demo - sandbox only, no auth, built-in sandbox client, all doc types. */
  public static async createDemoSession(req: Request, res: Response): Promise<void> {
    try {
      const out = await VerificationSessionService.createDemoSession(sandboxDemoApp());
      res.status(201).json(out);
    } catch (err) {
      handleError(res, err, 'createDemoSession');
    }
  }

  /** GET /session/:id/public (Bearer sessionToken) */
  public static async getPublicSession(req: Request, res: Response): Promise<void> {
    try {
      const session = (req as any).verifySession;
      const app = await findApp(session.clientId);
      res.json(VerificationSessionService.publicView(session, app));
    } catch (err) {
      handleError(res, err, 'getPublicSession');
    }
  }

  /** POST /session/:id/documents (Bearer) */
  public static async submitDocument(req: Request, res: Response): Promise<void> {
    try {
      res.json(await VerificationSessionService.submitDocument((req as any).verifySession, req.body || {}));
    } catch (err) {
      handleError(res, err, 'submitDocument');
    }
  }

  /** POST /session/:id/bank (Bearer) */
  public static async submitBank(req: Request, res: Response): Promise<void> {
    try {
      res.json(await VerificationSessionService.submitBank((req as any).verifySession, req.body || {}));
    } catch (err) {
      handleError(res, err, 'submitBank');
    }
  }

  /** POST /session/:id/liveness/challenge (Bearer) */
  public static async issueChallenge(req: Request, res: Response): Promise<void> {
    try {
      res.json(await VerificationSessionService.issueChallenge((req as any).verifySession));
    } catch (err) {
      handleError(res, err, 'issueChallenge');
    }
  }

  /** POST /session/:id/complete (Bearer) */
  public static async completeSession(req: Request, res: Response): Promise<void> {
    try {
      res.json(await VerificationSessionService.complete((req as any).verifySession, req.body || {}));
    } catch (err) {
      handleError(res, err, 'completeSession');
    }
  }

  /** GET /session/:id/result (Basic auth of the owning app) - signed, server-to-server. */
  public static async getResult(req: Request, res: Response): Promise<void> {
    try {
      const client: VerifyApp = (req as any).verifyClient;
      const session = await sessionStore().get(req.params.id);
      // 404 for both "missing" and "not yours" (no cross-tenant oracle)
      if (!session || session.clientId !== client.clientId) throw new VerifyError(404, 'SESSION_NOT_FOUND', 'Verification session not found.');
      res.setHeader('Cache-Control', 'no-store');
      res.json(await VerificationSessionService.getResult(session));
    } catch (err) {
      handleError(res, err, 'getResult');
    }
  }

  // ═══════════════════════════ Standalone B2B endpoints ═══════════════════════════

  /** POST /pan { panNumber|pan, name?, dob?, fatherName?, gender? } */
  public static async verifyPan(req: Request, res: Response): Promise<void> {
    try {
      const b = req.body || {};
      const pan = str(b.panNumber) || str(b.pan);
      if (!pan) throw new VerifyError(400, 'VALIDATION_ERROR', 'panNumber is required.');
      const gender = CrossDocumentValidatorService.normalizeGender(str(b.gender) || '') || undefined;
      const rec = await apiSetuService.verifyPan(pan, { name: str(b.name), dob: str(b.dob), gender });
      ok(res, {
        ...publicRecord(rec),
        nameComparison: nameCmp(str(b.name), rec.name),
        dobMatch: dobCmp(str(b.dob), rec.dob),
        fatherComparison: fatherCmp(str(b.fatherName), rec.fatherName),
      });
    } catch (err) {
      handleError(res, err, 'verifyPan');
    }
  }

  /** POST /dl { dlNumber, dob?, name?, fatherName? } */
  public static async verifyDrivingLicense(req: Request, res: Response): Promise<void> {
    try {
      const b = req.body || {};
      const dl = str(b.dlNumber);
      if (!dl) throw new VerifyError(400, 'VALIDATION_ERROR', 'dlNumber is required.');
      const rec = await apiSetuService.verifyDrivingLicense(dl, { dob: str(b.dob), name: str(b.name) });
      ok(res, {
        ...publicRecord(rec),
        nameComparison: nameCmp(str(b.name), rec.name),
        dobMatch: dobCmp(str(b.dob), rec.dob),
        fatherComparison: fatherCmp(str(b.fatherName), rec.fatherName),
      });
    } catch (err) {
      handleError(res, err, 'verifyDrivingLicense');
    }
  }

  /** POST /rc { rcNumber, chassisNumber?, ownerName? } */
  public static async verifyVehicleRc(req: Request, res: Response): Promise<void> {
    try {
      const b = req.body || {};
      const rc = str(b.rcNumber);
      if (!rc) throw new VerifyError(400, 'VALIDATION_ERROR', 'rcNumber is required.');
      const rec = await apiSetuService.verifyVehicleRc(rc, { chassisNumber: str(b.chassisNumber), ownerName: str(b.ownerName) });
      ok(res, { ...publicRecord(rec), ownerNameComparison: nameCmp(str(b.ownerName), rec.ownerName) });
    } catch (err) {
      handleError(res, err, 'verifyVehicleRc');
    }
  }

  /** POST /gstin { gstin } */
  public static async verifyGstin(req: Request, res: Response): Promise<void> {
    try {
      const gstin = str(req.body?.gstin);
      if (!gstin) throw new VerifyError(400, 'VALIDATION_ERROR', 'gstin is required.');
      ok(res, publicRecord(await apiSetuService.verifyGstin(gstin)));
    } catch (err) {
      handleError(res, err, 'verifyGstin');
    }
  }

  /** POST /voter { epicNumber, name?, dob?, relativeName? } */
  public static async verifyVoterId(req: Request, res: Response): Promise<void> {
    try {
      const b = req.body || {};
      const epic = str(b.epicNumber);
      if (!epic) throw new VerifyError(400, 'VALIDATION_ERROR', 'epicNumber is required.');
      const rec = await apiSetuService.verifyVoterId(epic, { name: str(b.name) });
      ok(res, {
        ...publicRecord(rec),
        nameComparison: nameCmp(str(b.name), rec.name),
        dobMatch: dobCmp(str(b.dob), rec.dob),
        relativeComparison: fatherCmp(str(b.relativeName), rec.fatherName),
      });
    } catch (err) {
      handleError(res, err, 'verifyVoterId');
    }
  }

  /** POST /bank { accountNumber, ifsc, expectedName? } - status ACTIVE | INVALID | PENDING */
  public static async verifyBankAccount(req: Request, res: Response): Promise<void> {
    try {
      const b = req.body || {};
      if (!str(b.accountNumber) || !str(b.ifsc)) throw new VerifyError(400, 'VALIDATION_ERROR', 'accountNumber and ifsc are required.');
      const rec = await razorpayVerificationService.verifyBankAccount(String(b.accountNumber), String(b.ifsc));
      ok(res, { ...publicRecord(rec), validationId: rec.validationId, nameComparison: nameCmp(str(b.expectedName), rec.registeredName) });
    } catch (err) {
      handleError(res, err, 'verifyBankAccount');
    }
  }

  /** POST /upi { vpa, expectedName? } */
  public static async verifyUpi(req: Request, res: Response): Promise<void> {
    try {
      const b = req.body || {};
      if (!str(b.vpa)) throw new VerifyError(400, 'VALIDATION_ERROR', 'vpa is required.');
      const rec = await razorpayVerificationService.validateUpi(String(b.vpa));
      ok(res, { ...publicRecord(rec), nameComparison: nameCmp(str(b.expectedName), rec.customerName) });
    } catch (err) {
      handleError(res, err, 'verifyUpi');
    }
  }

  /**
   * POST /biometrics/face-match { liveSelfie, documents:[{docType, photoBase64}] }
   * 1:N face comparison only; liveness is NOT assessed here (livenessAssessed:false).
   */
  public static async faceMatch(req: Request, res: Response): Promise<void> {
    try {
      const { liveSelfie, documents } = req.body || {};
      assertImage(liveSelfie, 'liveSelfie');
      if (!Array.isArray(documents) || documents.length === 0 || documents.length > 4) {
        throw new VerifyError(400, 'VALIDATION_ERROR', 'documents must contain 1-4 reference photos.');
      }
      const refs = documents.map((d: any, i: number) => ({
        docType: String(d?.docType || 'IDENTITY_CARD'),
        photoBase64: assertImage(d?.photoBase64 || d?.photo || d?.imageBase64, `documents[${i}].photoBase64`),
      }));
      const result = await biometrics().matchFaces(liveSelfie, refs);
      ok(res, { ...result, livenessAssessed: false });
    } catch (err) {
      handleError(res, err, 'faceMatch');
    }
  }

  /** POST /biometrics/extract-face { documentImage } */
  public static async extractFace(req: Request, res: Response): Promise<void> {
    try {
      const { documentImage } = req.body || {};
      assertImage(documentImage, 'documentImage');
      ok(res, await biometrics().extractFaceFromDocument(documentImage));
    } catch (err) {
      handleError(res, err, 'extractFace');
    }
  }

  /**
   * POST /full-kyc - stateless orchestration.
   * Body: { pan?:{number,name,dob?,fatherName?,gender?,imageBase64?}, dl?:{...}, voter?:{...},
   *         aadhaar?:{number?,name,dob?|yob?,gender?,imageBase64?}  (SELF_DECLARED),
   *         bank?:{accountNumber,ifsc} | upi?:{vpa}, liveSelfie?, livenessFrames?:[{step,image}] }
   * status: APPROVED | MANUAL_REVIEW | REJECTED. Registry attributes only come from registries.
   * Without liveness frames a selfie match can at best yield MANUAL_REVIEW.
   */
  public static async fullVerification(req: Request, res: Response): Promise<void> {
    try {
      const { pan, dl, voter, aadhaar, bank, upi, liveSelfie, livenessFrames } = req.body || {};
      const records: DocumentRecord[] = [];
      const photos: { docType: string; photoBase64: string }[] = [];
      const checks: { id: string; passed: boolean; detail?: string }[] = [];
      const rejectCodes: string[] = [];
      const review: string[] = [];
      const docs: Record<string, any> = {};

      const addPhoto = async (docType: string, img: unknown) => {
        if (!img) return;
        const crop = await biometrics().extractFaceFromDocument(assertImage(img, `${docType}.imageBase64`));
        if (crop?.hasFace && crop.faceBase64) photos.push({ docType, photoBase64: crop.faceBase64 });
      };

      const registryDoc = async (key: 'PAN' | 'DRIVING_LICENSE' | 'VOTER_ID', input: any, label: DocumentRecord['docType']) => {
        if (!input?.number) return;
        const declaredName = str(input.name);
        const rec: any =
          key === 'PAN'
            ? await apiSetuService.verifyPan(String(input.number), { name: declaredName, dob: str(input.dob) })
            : key === 'DRIVING_LICENSE'
              ? await apiSetuService.verifyDrivingLicense(String(input.number), { name: declaredName, dob: str(input.dob) })
              : await apiSetuService.verifyVoterId(String(input.number), { name: declaredName });
        const statusOk = rec.found && (!rec.status || rec.status === 'VALID' || rec.status === 'ACTIVE');
        const nm = nameCmp(declaredName, rec.name);
        const dm = dobCmp(str(input.dob), rec.dob);
        docs[key] = { found: rec.found, docStatus: rec.status, numberMasked: rec.panMasked || rec.dlMasked || rec.epicMasked, nameComparison: nm, dobMatch: dm };
        checks.push({ id: `DOC_${key}`, passed: Boolean(statusOk && (nm ? nm.passed : rec.issuerAttested?.name) && dm !== false) });
        if (!rec.found) rejectCodes.push('DOCUMENT_NOT_FOUND');
        else if (!statusOk) rejectCodes.push(rec.status === 'EXPIRED' ? 'DOCUMENT_EXPIRED' : 'DOCUMENT_INVALID');
        else {
          if (nm && !nm.passed) rejectCodes.push('DOCUMENT_NAME_MISMATCH');
          if (!nm && !rec.issuerAttested?.name) review.push(`${key}: registry name not available`);
          if (!nm && rec.issuerAttested?.name) review.push(`${key}: name attested by issuer only`);
          if (dm === false) rejectCodes.push('DOCUMENT_DOB_MISMATCH');
          records.push({ docType: label, source: 'REGISTRY', name: rec.name, dob: rec.dob, fatherName: rec.fatherName, gender: rec.gender });
        }
        await addPhoto(key, input.imageBase64);
      };

      await registryDoc('PAN', pan, 'PAN Card');
      await registryDoc('DRIVING_LICENSE', dl, 'Driving License');
      await registryDoc('VOTER_ID', voter, 'Voter ID');

      if (aadhaar && str(aadhaar.name)) {
        let numberMasked: string | null = null;
        if (aadhaar.number) {
          const chk = validateAadhaar(String(aadhaar.number));
          if (!chk.valid) throw new VerifyError(400, 'INVALID_DOCUMENT_NUMBER', chk.reason!);
          numberMasked = maskAadhaar(aadhaarLast4(chk.normalized));
        }
        docs.AADHAAR = { source: 'SELF_DECLARED', numberMasked };
        records.push({ docType: 'Aadhaar Card', source: 'SELF_DECLARED', name: str(aadhaar.name), dob: str(aadhaar.dob) || (aadhaar.yob ? String(aadhaar.yob) : undefined), gender: str(aadhaar.gender), fatherName: str(aadhaar.fatherName) || str(aadhaar.careOf) });
        await addPhoto('AADHAAR', aadhaar.imageBase64);
      }

      const cross = CrossDocumentValidatorService.validateDocuments(records);
      for (const m of cross.criticalMismatches) rejectCodes.push(m.field === 'DOB' ? 'DOCUMENT_DOB_MISMATCH' : m.field === 'GENDER' ? 'DOCUMENT_GENDER_MISMATCH' : 'DOCUMENT_NAME_MISMATCH');
      if (cross.warnings.some((w) => w.requiresReview)) review.push('Cross-document conflict involving self-declared data');
      if (!records.some((r) => r.source === 'REGISTRY')) review.push('No registry-verified identity document');

      const registryNames = records.filter((r) => r.source === 'REGISTRY' && r.name).map((r) => r.name!);
      let bankVerified = false;
      if (bank?.accountNumber || upi?.vpa) {
        let holder: string | undefined;
        let state: string;
        if (bank?.accountNumber) {
          const rec = await razorpayVerificationService.verifyBankAccount(String(bank.accountNumber), String(bank.ifsc || ''));
          holder = rec.registeredName;
          state = rec.accountStatus;
          docs.BANK_ACCOUNT = { accountMasked: rec.accountMasked, status: rec.accountStatus, validationId: rec.validationId };
        } else {
          const rec = await razorpayVerificationService.validateUpi(String(upi.vpa));
          holder = rec.customerName;
          state = rec.found ? 'ACTIVE' : 'INVALID';
          docs.UPI = { vpaMasked: rec.vpaMasked, found: rec.found };
        }
        const best = registryNames.map((n) => NameMatcherService.compare(holder || '', n)).sort((a, b) => b.score - a.score)[0];
        bankVerified = state === 'ACTIVE' && Boolean(holder) && Boolean(best?.isMatch);
        checks.push({ id: 'BANK', passed: bankVerified });
        if (state === 'PENDING') review.push('Bank validation pending');
        else if (state !== 'ACTIVE') rejectCodes.push('BANK_ACCOUNT_INVALID');
        else if (!bankVerified) rejectCodes.push('BANK_NAME_MISMATCH');
      }

      let faceMatchConfidence: number | null = null;
      let livenessScore: number | null = null;
      if (liveSelfie) {
        assertImage(liveSelfie, 'liveSelfie');
        if (!photos.length) {
          rejectCodes.push('NO_DOCUMENT_FACE');
        } else {
          if (Array.isArray(livenessFrames) && livenessFrames.length) {
            if (livenessFrames.length > MAX_LIVENESS_FRAMES) throw new VerifyError(400, 'VALIDATION_ERROR', `At most ${MAX_LIVENESS_FRAMES} liveness frames are accepted.`);
            const frames = livenessFrames.map((f: any, i: number) => ({ step: String(f?.step || 'NEUTRAL').toUpperCase() as LivenessStep, image: assertImage(f?.image, `livenessFrames[${i}].image`) }));
            const live = await biometrics().evaluateLiveness(frames);
            livenessScore = live.score ?? null;
            checks.push({ id: 'LIVENESS', passed: live.passed });
            if (!live.passed) rejectCodes.push('LIVENESS_CHECK_FAILED');
          } else {
            review.push('Liveness not assessed (no livenessFrames supplied)');
          }
          const fm = await biometrics().matchFaces(liveSelfie, photos);
          faceMatchConfidence = fm.overallConfidence ?? null;
          checks.push({ id: 'FACE_MATCH', passed: fm.verdict === 'APPROVE' });
          if (fm.verdict === 'REJECT') rejectCodes.push('FACE_MISMATCH_DETECTED');
          else if (fm.verdict !== 'APPROVE') review.push('Face match requires manual review');
        }
      }

      const status = rejectCodes.length ? 'REJECTED' : review.length ? 'MANUAL_REVIEW' : 'APPROVED';
      res.json({
        status,
        ...(rejectCodes.length ? { error_code: rejectCodes[0], error_message: 'Verification failed: ' + rejectCodes[0].toLowerCase().replace(/_/g, ' ') } : {}),
        environment: getEnvironment(),
        verification_id: 'ver_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        verifiedProfile:
          status === 'REJECTED'
            ? null
            : {
                fullName: cross.primaryIdentity.fullName,
                nameSource: cross.primaryIdentity.source || null,
                dob: cross.primaryIdentity.dob || null,
                fatherName: cross.primaryIdentity.fatherName || null,
                gender: cross.primaryIdentity.gender || null,
                bankVerified,
                faceMatchConfidence,
                livenessScore,
                verifiedAt: new Date().toISOString(),
              },
        checks,
        reviewReasons: review,
        documents: docs,
      });
    } catch (err) {
      handleError(res, err, 'fullVerification');
    }
  }
}

export default VerificationController;
