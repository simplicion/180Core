/**
 * 180 Identity - Verification Routes
 * Location: apps/180-core-backend/src/routes/verification.routes.ts
 */

import { Router } from 'express';
import VerificationController from '../controllers/verification.controller';

const router = Router();

// 1. Core Government & Document Endpoints (API Setu)
router.post('/pan', VerificationController.verifyPan);
router.post('/dl', VerificationController.verifyDrivingLicense);
router.post('/rc', VerificationController.verifyVehicleRc);
router.post('/gstin', VerificationController.verifyGstin);
router.post('/voter', VerificationController.verifyVoterId);

// 2. Financial & Banking Verification (Razorpay Penny Drop / UPI)
router.post('/bank', VerificationController.verifyBankAccount);
router.post('/upi', VerificationController.verifyUpi);

// 3. Biometrics & Face Match (ArcFace + Anti-Spoofing)
router.post('/biometrics/face-match', VerificationController.faceMatch);
router.post('/biometrics/extract-face', VerificationController.extractFace);

// 4. Turnkey Full KYC Orchestration
router.post('/full-kyc', VerificationController.fullVerification);

// 5. Resident Bottom Sheet Session Management
router.post('/session', VerificationController.createSession);
router.get('/session/:sessionId', VerificationController.getSession);

export default router;

