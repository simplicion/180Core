'use strict';

import rateLimit from 'express-rate-limit';

/**
 * High-Security Rate Limiter for OTP Generation & Verification
 * Limits each IP/client to 6 requests per 10 minutes to prevent bill draining and brute force attacks
 */
export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => process.env.NODE_ENV !== 'production',
  message: {
    success: false,
    error: 'Too many OTP attempts. Please wait 10 minutes before requesting a new code.',
  },
}) as any;

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => process.env.NODE_ENV !== 'production',
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 1 minute.',
  },
}) as any;

export const tokenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'OAuth token request rate limit exceeded. Please throttle your client requests.',
  },
}) as any;

export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => req.path === '/health',
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
}) as any;

