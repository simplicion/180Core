'use strict';

import rateLimit from 'express-rate-limit';

/**
 * 180 Verify rate limiters. Stricter than the platform-wide generalApiLimiter because every
 * verification call can burn paid API Setu / Razorpay quota and probe PII.
 * Limits are enforced in every environment except NODE_ENV=test.
 */

const envelope = (message: string) => ({ status: 'FAILED', error_code: 'RATE_LIMITED', error_message: message });
const skipInTests = () => process.env.NODE_ENV === 'test';

/** B2B registry endpoints: 30 calls / minute per client (falls back to IP before auth). */
export const verifyB2BLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.VERIFY_B2B_RATE_LIMIT_PER_MIN || 30),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req: any) => 'b2b:' + (req.verifyClient?.clientId || req.ip),
  message: envelope('Verification rate limit exceeded for this client. Please retry in a minute.'),
}) as any;

/** Session creation: 30 sessions / 10 minutes per IP. */
export const verifySessionCreateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req: any) => 'vsc:' + req.ip,
  message: envelope('Too many verification sessions created. Please wait a few minutes.'),
}) as any;

/** Unauthenticated sandbox demo sessions: 10 / 10 minutes per IP. */
export const verifyDemoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req: any) => 'vdemo:' + req.ip,
  message: envelope('Too many sandbox demo sessions. Please wait a few minutes.'),
}) as any;

/** Resident session steps: 40 requests / minute per session id + IP. */
export const verifySessionStepLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req: any) => `vstep:${req.params?.id || 'none'}:${req.ip}`,
  message: envelope('Too many requests for this verification session. Please slow down.'),
}) as any;
