'use strict';

import express from 'express';
import { AuthApiController } from '../controllers/auth.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';
import {
  otpRateLimiter,
  authRateLimiter,
  tokenRateLimiter,
} from '../middleware/rate-limiter.middleware';

const router = express.Router();

// ─── OpenID Connect Discovery & JWKS ──────────────────────────────────────────
router.get('/.well-known/openid-configuration', AuthApiController.getOpenIdConfiguration);
router.get('/openid-configuration', AuthApiController.getOpenIdConfiguration);
router.get('/.well-known/jwks.json', AuthApiController.getJwks);
router.get('/jwks.json', AuthApiController.getJwks);
router.get('/certs', AuthApiController.getJwks);

// ─── Authorize & Consent Flow ────────────────────────────────────────────────
router.get('/authorize/validate', optionalAuth, AuthApiController.validateAuthorize);
router.get('/client/:clientId', AuthApiController.getAppPublicConfig);
router.get('/app-config/:clientId', AuthApiController.getAppPublicConfig);
router.post('/authorize/consent', protect, AuthApiController.submitConsent);

// ─── Token Endpoints ─────────────────────────────────────────────────────────
router.post('/token', tokenRateLimiter, AuthApiController.exchangeToken);
router.get('/userinfo', protect, AuthApiController.getUserInfo);
router.post('/userinfo', protect, AuthApiController.getUserInfo);
router.get('/me', protect, (req: any, res: any) => res.json({ success: true, user: req.user }));
router.post('/verify', AuthApiController.verifyToken);
router.get('/verify', AuthApiController.verifyToken);
router.post('/revoke', AuthApiController.revokeToken);
router.get('/authorized-apps', protect, AuthApiController.listAuthorizedApps);
router.delete('/authorized-apps/:clientId', protect, AuthApiController.revokeAuthorizedApp);

// ─── Auth Direct Endpoints ───────────────────────────────────────────────────
router.post('/login', authRateLimiter, AuthApiController.login);
router.post('/register', authRateLimiter, AuthApiController.register);
router.post('/register/initiate', authRateLimiter, AuthApiController.initiateSignup);
router.post('/register/verify-otp', authRateLimiter, AuthApiController.verifySignupOtp);
router.post('/register/set-password', authRateLimiter, AuthApiController.setPassword);
router.post('/onboarding', optionalAuth, AuthApiController.completeOnboarding);
router.put('/onboarding', optionalAuth, AuthApiController.completeOnboarding);
router.post('/forgot-password', authRateLimiter, AuthApiController.forgotPassword);
router.post('/reset-password/verify-otp', authRateLimiter, AuthApiController.verifyResetOtp);
router.post('/reset-password', authRateLimiter, AuthApiController.resetPassword);
router.post('/google-continue', authRateLimiter, AuthApiController.googleContinue);

// ─── OTP & Verification ──────────────────────────────────────────────────────
router.post('/otp/send-whatsapp', otpRateLimiter, AuthApiController.sendOtp);
router.post('/otp/verify-whatsapp', otpRateLimiter, AuthApiController.verifyOtp);

// ─── Username & Location Helpers ─────────────────────────────────────────────
router.get('/check-username', AuthApiController.checkUsername);
router.post('/resolve-location', AuthApiController.resolveLocation);

export default router;

