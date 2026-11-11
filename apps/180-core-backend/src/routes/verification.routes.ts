/**
 * 180 Identity - Verification Routes ("180 Verify")
 * Location: apps/180-core-backend/src/routes/verification.routes.ts
 * Mounted at /api/v1/identity/verify and /api/v1/verify (server.ts).
 */

import { NextFunction, Request, Response, Router } from 'express';
import VerificationController from '../controllers/verification.controller';
import { requireSessionToken, requireVerifyClient } from '../middleware/verification-auth.middleware';
import {
  verifyB2BLimiter,
  verifyDemoLimiter,
  verifySessionCreateLimiter,
  verifySessionStepLimiter,
} from '../middleware/verification-rate-limit.middleware';
import { checkVerificationConfig } from '../services/verification/config';
import { sendError } from '../services/verification/errors';

/**
 * Builds the router. In production the module refuses to serve (503 VERIFY_MODULE_MISCONFIGURED on
 * every route) when mock providers are active without VERIFY_ALLOW_SANDBOX_IN_PRODUCTION=true, or when
 * required secrets/credentials are missing. The rest of the backend keeps running.
 */
export function createVerificationRouter(env: NodeJS.ProcessEnv = process.env): Router {
  const router = Router();
  const config = checkVerificationConfig(env);
  if (!config.ok) {
    console.error(`[180Verify] Verification module DISABLED (environment=${config.environment}):\n  - ${config.problems.join('\n  - ')}`);
    router.use((_req: Request, res: Response) =>
      sendError(res, 503, 'VERIFY_MODULE_MISCONFIGURED', 'The verification module is not available: server configuration is incomplete.')
    );
    return router;
  }
  console.log(`[180Verify] Verification module active (environment=${config.environment}).`);

  // Responses carry PII; never cache.
  router.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // 1. Resident session API (contract consumed by 180 Profile /verify and the identity SDK)
  router.post('/session/demo', verifyDemoLimiter, VerificationController.createDemoSession);
  router.post('/session', verifySessionCreateLimiter, VerificationController.createSession);
  router.get('/session/:id/public', verifySessionStepLimiter, requireSessionToken, VerificationController.getPublicSession);
  router.post('/session/:id/documents', verifySessionStepLimiter, requireSessionToken, VerificationController.submitDocument);
  router.post('/session/:id/bank', verifySessionStepLimiter, requireSessionToken, VerificationController.submitBank);
  router.post('/session/:id/liveness/challenge', verifySessionStepLimiter, requireSessionToken, VerificationController.issueChallenge);
  router.post('/session/:id/complete', verifySessionStepLimiter, requireSessionToken, VerificationController.completeSession);
  router.get('/session/:id/result', requireVerifyClient, verifyB2BLimiter, VerificationController.getResult);
  // Legacy alias (previously unauthenticated): now identical to /result.
  router.get('/session/:id', requireVerifyClient, verifyB2BLimiter, VerificationController.getResult);

  // 2. Standalone B2B registry endpoints (developer client credentials)
  const b2b = [requireVerifyClient, verifyB2BLimiter];
  router.post('/pan', ...b2b, VerificationController.verifyPan);
  router.post('/dl', ...b2b, VerificationController.verifyDrivingLicense);
  router.post('/rc', ...b2b, VerificationController.verifyVehicleRc);
  router.post('/gstin', ...b2b, VerificationController.verifyGstin);
  router.post('/voter', ...b2b, VerificationController.verifyVoterId);
  router.post('/bank', ...b2b, VerificationController.verifyBankAccount);
  router.post('/upi', ...b2b, VerificationController.verifyUpi);
  router.post('/biometrics/face-match', ...b2b, VerificationController.faceMatch);
  router.post('/biometrics/extract-face', ...b2b, VerificationController.extractFace);
  router.post('/full-kyc', ...b2b, VerificationController.fullVerification);

  return router;
}

const router = createVerificationRouter();
export default router;
