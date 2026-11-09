/**
 * 180 Identity - Verification Controller
 * Location: apps/180-core-backend/src/controllers/verification.controller.ts
 *
 * Exposes turnkey REST APIs for PAN, Driving License, Vehicle RC, GSTIN, Voter ID,
 * Bank Account / UPI Penny Drop, AI Face Match, and Full KYC Orchestration with
 * strict multi-attribute cross-document verification (Name, DOB, Father's Name, Gender).
 */

import { Request, Response } from 'express';
import apiSetuService from '../services/apisetu.service';
import razorpayVerificationService from '../services/razorpay-verification.service';
import NameMatcherService from '../services/name-matcher.service';
import CrossDocumentValidatorService, { DocumentRecord } from '../services/cross-document-validator.service';
import BiometricsService from '../services/biometrics.service';

// In-memory verification sessions store (survives active bottom sheet life-cycle)
const verificationSessions = new Map<string, any>();

export class VerificationController {
  /**
   * 1. PAN Card Verification
   * POST /api/v1/identity/verify/pan
   */
  public static async verifyPan(req: Request, res: Response): Promise<void> {
    try {
      const { panNumber, name, dob, fatherName } = req.body;
      if (!panNumber) {
        res.status(400).json({ error: 'PAN number is required' });
        return;
      }

      const result = await apiSetuService.verifyPan(panNumber, name);
      let nameComparison = null;
      let dobComparison = null;
      let fatherComparison = null;

      if (name && result.registeredName) {
        nameComparison = NameMatcherService.compare(name, result.registeredName);
      }

      if (dob && result.dob) {
        const norm1 = CrossDocumentValidatorService.normalizeDob(dob);
        const norm2 = CrossDocumentValidatorService.normalizeDob(result.dob);
        if (norm1 && norm2) {
          dobComparison = CrossDocumentValidatorService.compareDobs(norm1, norm2);
        }
      }

      if (fatherName && result.fatherName) {
        const f1 = CrossDocumentValidatorService.normalizeFatherOrGuardianName(fatherName);
        const f2 = CrossDocumentValidatorService.normalizeFatherOrGuardianName(result.fatherName);
        fatherComparison = NameMatcherService.compare(f1, f2);
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...result,
          nameComparison,
          dobComparison,
          fatherComparison
        }
      });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 2. Driving License Verification
   * POST /api/v1/identity/verify/dl
   */
  public static async verifyDrivingLicense(req: Request, res: Response): Promise<void> {
    try {
      const { dlNumber, dob, name, fatherName } = req.body;
      if (!dlNumber) {
        res.status(400).json({ error: 'Driving License number is required' });
        return;
      }

      const result = await apiSetuService.verifyDrivingLicense(dlNumber, dob);
      let nameComparison = null;
      let dobComparison = null;
      let fatherComparison = null;

      if (name && result.holderName) {
        nameComparison = NameMatcherService.compare(name, result.holderName);
      }

      if (dob && result.dob) {
        const norm1 = CrossDocumentValidatorService.normalizeDob(dob);
        const norm2 = CrossDocumentValidatorService.normalizeDob(result.dob);
        if (norm1 && norm2) {
          dobComparison = CrossDocumentValidatorService.compareDobs(norm1, norm2);
        }
      }

      if (fatherName && result.fatherOrHusbandName) {
        const f1 = CrossDocumentValidatorService.normalizeFatherOrGuardianName(fatherName);
        const f2 = CrossDocumentValidatorService.normalizeFatherOrGuardianName(result.fatherOrHusbandName);
        fatherComparison = NameMatcherService.compare(f1, f2);
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...result,
          nameComparison,
          dobComparison,
          fatherComparison
        }
      });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 3. Vehicle RC Verification
   * POST /api/v1/identity/verify/rc
   */
  public static async verifyVehicleRc(req: Request, res: Response): Promise<void> {
    try {
      const { rcNumber } = req.body;
      if (!rcNumber) {
        res.status(400).json({ error: 'Vehicle Registration number (RC) is required' });
        return;
      }

      const result = await apiSetuService.verifyVehicleRc(rcNumber);
      res.json({ status: 'SUCCESS', data: result });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 4. GSTIN Verification
   * POST /api/v1/identity/verify/gstin
   */
  public static async verifyGstin(req: Request, res: Response): Promise<void> {
    try {
      const { gstin } = req.body;
      if (!gstin) {
        res.status(400).json({ error: 'GSTIN is required' });
        return;
      }

      const result = await apiSetuService.verifyGstin(gstin);
      res.json({ status: 'SUCCESS', data: result });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 5. Voter ID (EPIC) Verification
   * POST /api/v1/identity/verify/voter
   */
  public static async verifyVoterId(req: Request, res: Response): Promise<void> {
    try {
      const { epicNumber, name, dob, relativeName } = req.body;
      if (!epicNumber) {
        res.status(400).json({ error: 'Voter ID (EPIC) number is required' });
        return;
      }

      const result = await apiSetuService.verifyVoterId(epicNumber);
      let nameComparison = null;
      let dobComparison = null;
      let relativeComparison = null;

      if (name && result.name) {
        nameComparison = NameMatcherService.compare(name, result.name);
      }

      if (dob && result.dob) {
        const norm1 = CrossDocumentValidatorService.normalizeDob(dob);
        const norm2 = CrossDocumentValidatorService.normalizeDob(result.dob);
        if (norm1 && norm2) {
          dobComparison = CrossDocumentValidatorService.compareDobs(norm1, norm2);
        }
      }

      if (relativeName && result.relativeName) {
        const f1 = CrossDocumentValidatorService.normalizeFatherOrGuardianName(relativeName);
        const f2 = CrossDocumentValidatorService.normalizeFatherOrGuardianName(result.relativeName);
        relativeComparison = NameMatcherService.compare(f1, f2);
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...result,
          nameComparison,
          dobComparison,
          relativeComparison
        }
      });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 6. Bank Account Penny Drop Verification (via Razorpay IMPS)
   * POST /api/v1/identity/verify/bank
   */
  public static async verifyBankAccount(req: Request, res: Response): Promise<void> {
    try {
      const { accountNumber, ifsc, expectedName } = req.body;
      if (!accountNumber || !ifsc) {
        res.status(400).json({ error: 'Both accountNumber and ifsc code are required' });
        return;
      }

      const result = await razorpayVerificationService.verifyBankAccount(accountNumber, ifsc, expectedName);
      let nameComparison = null;

      if (expectedName && result.registeredName) {
        nameComparison = NameMatcherService.compare(expectedName, result.registeredName);
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...result,
          nameComparison
        }
      });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 7. UPI VPA Verification
   * POST /api/v1/identity/verify/upi
   */
  public static async verifyUpi(req: Request, res: Response): Promise<void> {
    try {
      const { vpa, expectedName } = req.body;
      if (!vpa) {
        res.status(400).json({ error: 'UPI ID (vpa) is required' });
        return;
      }

      const result = await razorpayVerificationService.validateUpi(vpa);
      let nameComparison = null;

      if (expectedName && result.customerName) {
        nameComparison = NameMatcherService.compare(expectedName, result.customerName);
      }

      res.json({
        status: 'SUCCESS',
        data: {
          ...result,
          nameComparison
        }
      });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 8. AI Face Match (Live Selfie vs Document Photos)
   * POST /api/v1/identity/biometrics/face-match
   */
  public static async faceMatch(req: Request, res: Response): Promise<void> {
    try {
      const { liveSelfie, documents, eyeBlinkDetected, headTurnDetected } = req.body;
      if (!liveSelfie) {
        res.status(400).json({ error: 'liveSelfie base64 image is required' });
        return;
      }
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        res.status(400).json({ error: 'At least one document reference photo is required' });
        return;
      }

      const result = BiometricsService.matchFaces(
        liveSelfie,
        documents.map((d: any) => ({
          docType: d.docType || 'IDENTITY_CARD',
          photoBase64: d.photoBase64 || d.photo || d.imageBase64
        })),
        { eyeBlinkDetected, headTurnDetected }
      );

      res.json({ status: 'SUCCESS', data: result });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 9. Extract Face from Document
   * POST /api/v1/identity/biometrics/extract-face
   */
  public static async extractFace(req: Request, res: Response): Promise<void> {
    try {
      const { documentImage } = req.body;
      if (!documentImage) {
        res.status(400).json({ error: 'documentImage base64 is required' });
        return;
      }

      const result = BiometricsService.extractFaceFromDocument(documentImage);
      res.json({ status: 'SUCCESS', data: result });
    } catch (err: any) {
      res.status(400).json({ status: 'FAILED', error: err.message });
    }
  }

  /**
   * 10. Full End-to-End Orchestrated Verification
   * POST /api/v1/identity/verify/full-kyc
   *
   * Validates Name, Date of Birth (DOB), Father's Name, Gender, Bank account and Face Biometrics
   */
  public static async fullVerification(req: Request, res: Response): Promise<void> {
    try {
      const {
        pan,
        dl,
        aadhaar,
        voter,
        bank,
        upi,
        liveSelfie,
        options = {}
      } = req.body;

      const results: any = {
        panResult: null,
        dlResult: null,
        voterResult: null,
        bankResult: null,
        upiResult: null,
        faceMatchResult: null,
        crossDocValidation: null
      };

      const documentRecords: DocumentRecord[] = [];
      const documentPhotosForFaceMatch: { docType: string; photoBase64: string }[] = [];

      // 1. Process PAN Card
      if (pan && pan.number) {
        const panRes = await apiSetuService.verifyPan(pan.number, pan.name);
        results.panResult = panRes;

        documentRecords.push({
          docType: 'PAN Card',
          name: panRes.registeredName || pan.name,
          dob: panRes.dob || pan.dob,
          fatherName: panRes.fatherName || pan.fatherName,
          gender: panRes.gender,
          docNumber: pan.number
        });

        if (pan.imageBase64) {
          const crop = BiometricsService.extractFaceFromDocument(pan.imageBase64);
          if (crop.hasFace && crop.faceBase64) {
            documentPhotosForFaceMatch.push({ docType: 'PAN Card', photoBase64: crop.faceBase64 });
          }
        }
      }

      // 2. Process Driving License
      if (dl && dl.number) {
        const dlRes = await apiSetuService.verifyDrivingLicense(dl.number, dl.dob);
        results.dlResult = dlRes;

        documentRecords.push({
          docType: 'Driving License',
          name: dlRes.holderName || dl.name,
          dob: dlRes.dob || dl.dob,
          fatherName: dlRes.fatherOrHusbandName || dl.fatherName,
          gender: dlRes.gender,
          docNumber: dl.number
        });

        if (dl.imageBase64) {
          const crop = BiometricsService.extractFaceFromDocument(dl.imageBase64);
          if (crop.hasFace && crop.faceBase64) {
            documentPhotosForFaceMatch.push({ docType: 'Driving License', photoBase64: crop.faceBase64 });
          }
        }
      }

      // 3. Process Voter ID
      if (voter && voter.number) {
        const voterRes = await apiSetuService.verifyVoterId(voter.number);
        results.voterResult = voterRes;

        documentRecords.push({
          docType: 'Voter ID',
          name: voterRes.name || voter.name,
          dob: voterRes.dob || voter.dob,
          fatherName: voterRes.relativeName || voter.fatherName,
          gender: voterRes.gender || voter.gender,
          docNumber: voter.number
        });

        if (voter.imageBase64) {
          const crop = BiometricsService.extractFaceFromDocument(voter.imageBase64);
          if (crop.hasFace && crop.faceBase64) {
            documentPhotosForFaceMatch.push({ docType: 'Voter ID', photoBase64: crop.faceBase64 });
          }
        }
      }

      // 4. Process Aadhaar Card (OCR/Offline XML data)
      if (aadhaar) {
        documentRecords.push({
          docType: 'Aadhaar Card',
          name: aadhaar.name,
          dob: aadhaar.dob || aadhaar.yob,
          fatherName: aadhaar.fatherName || aadhaar.careOf,
          gender: aadhaar.gender,
          docNumber: aadhaar.number
        });

        if (aadhaar.imageBase64) {
          const crop = BiometricsService.extractFaceFromDocument(aadhaar.imageBase64);
          if (crop.hasFace && crop.faceBase64) {
            documentPhotosForFaceMatch.push({ docType: 'Aadhaar Card', photoBase64: crop.faceBase64 });
          }
        }
      }

      // 5. Process Bank Account / UPI
      const primaryDocName = documentRecords[0]?.name;
      if (bank && bank.accountNumber && bank.ifsc) {
        const bankRes = await razorpayVerificationService.verifyBankAccount(
          bank.accountNumber,
          bank.ifsc,
          primaryDocName
        );
        results.bankResult = bankRes;
        documentRecords.push({
          docType: 'Bank Account',
          name: bankRes.registeredName
        });
      } else if (upi && upi.vpa) {
        const upiRes = await razorpayVerificationService.validateUpi(upi.vpa);
        results.upiResult = upiRes;
        documentRecords.push({
          docType: 'UPI',
          name: upiRes.customerName
        });
      }

      // 6. Strict Multi-Attribute Cross-Document Validation (Name, DOB, Father's Name, Gender)
      const crossValidation = CrossDocumentValidatorService.validateDocuments(documentRecords);
      results.crossDocValidation = crossValidation;

      if (!crossValidation.isValid) {
        const firstMismatch = crossValidation.criticalMismatches[0];
        let errorCode = 'DOCUMENT_MISMATCH';
        if (firstMismatch.field === 'DOB') errorCode = 'DOCUMENT_DOB_MISMATCH';
        else if (firstMismatch.field === 'NAME') errorCode = 'DOCUMENT_NAME_MISMATCH';
        else if (firstMismatch.field === 'GENDER') errorCode = 'DOCUMENT_GENDER_MISMATCH';

        res.status(422).json({
          status: 'REJECTED',
          error_code: errorCode,
          error_message: `Cross-document verification failed: ${firstMismatch.reason}`,
          details: crossValidation
        });
        return;
      }

      // 7. Biometric Face Match (if live selfie was supplied)
      if (liveSelfie) {
        if (documentPhotosForFaceMatch.length === 0) {
          res.status(400).json({
            status: 'REJECTED',
            error_code: 'NO_DOCUMENT_PHOTO',
            error_message: 'Cannot run Face Match: No photograph could be detected on the uploaded documents.'
          });
          return;
        }

        const faceRes = BiometricsService.matchFaces(
          liveSelfie,
          documentPhotosForFaceMatch,
          { eyeBlinkDetected: options.eyeBlinkDetected }
        );
        results.faceMatchResult = faceRes;

        if (!faceRes.livenessPassed) {
          res.status(422).json({
            status: 'REJECTED',
            error_code: 'LIVENESS_CHECK_FAILED',
            error_message: faceRes.mismatchReason || 'Live presence could not be confirmed.',
            details: faceRes
          });
          return;
        }

        if (faceRes.verdict === 'REJECT') {
          res.status(422).json({
            status: 'REJECTED',
            error_code: 'FACE_MISMATCH_DETECTED',
            error_message: 'Biometric verification failed: The live camera face does not match the uploaded identity document photo.',
            details: faceRes
          });
          return;
        }
      }

      // All validations successfully passed!
      res.json({
        status: 'APPROVED',
        verification_id: 'ver_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        verifiedProfile: {
          fullName: crossValidation.primaryIdentity.fullName,
          dob: crossValidation.primaryIdentity.dob,
          fatherName: crossValidation.primaryIdentity.fatherName,
          gender: crossValidation.primaryIdentity.gender,
          panVerified: Boolean(results.panResult?.valid),
          dlVerified: Boolean(results.dlResult?.valid),
          voterVerified: Boolean(results.voterResult?.valid),
          bankVerified: Boolean(results.bankResult?.valid || results.upiResult?.valid),
          faceMatchConfidence: results.faceMatchResult?.overallConfidence ?? 100,
          verifiedAt: new Date().toISOString()
        },
        auditDetails: results
      });
    } catch (err: any) {
      res.status(500).json({ status: 'ERROR', error: err.message });
    }
  }

  /**
   * 11. Create Turnkey Verification Session (for Resident Bottom Sheet)
   * POST /api/v1/identity/verify/session
   */
  public static async createSession(req: Request, res: Response): Promise<void> {
    try {
      const {
        clientId,
        documents = ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
        strictNameMatching = true,
        strictDobMatching = true,
        redirectUri
      } = req.body;

      const sessionId = 'ver_sess_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const sessionData = {
        sessionId,
        clientId: clientId || 'com.simplicion',
        documents,
        strictNameMatching,
        strictDobMatching,
        redirectUri,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      verificationSessions.set(sessionId, sessionData);

      const profileFrontendUrl = process.env.PROFILE_FRONTEND_URL || 'http://localhost:3008';
      const verifyUrl = `${profileFrontendUrl}/verify?session_id=${sessionId}&ux_mode=bottom_sheet`;

      res.json({
        status: 'SUCCESS',
        sessionId,
        verifyUrl,
        documents
      });
    } catch (err: any) {
      res.status(500).json({ status: 'ERROR', error: err.message });
    }
  }

  /**
   * 12. Retrieve Session Status
   * GET /api/v1/identity/verify/session/:sessionId
   */
  public static async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const session = verificationSessions.get(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Verification session not found' });
        return;
      }

      res.json({ status: 'SUCCESS', data: session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export default VerificationController;
