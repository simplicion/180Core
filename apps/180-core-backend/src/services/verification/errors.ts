/**
 * 180 Verify - typed errors + the uniform error envelope.
 *
 * Every non-2xx response from the verification module has the shape
 *   { status: 'FAILED', error_code: string, error_message: string }
 * (business outcomes such as REJECTED / MANUAL_REVIEW are 200 responses, not errors).
 */

import { Response } from 'express';

export class VerifyError extends Error {
  public readonly httpStatus: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(httpStatus: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VerifyError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

/**
 * Raised when a LIVE upstream (API Setu / Razorpay) fails, times out, or returns an
 * unexpected payload. Never answered with mock data. Maps to HTTP 502 PROVIDER_UNAVAILABLE.
 */
export class ProviderUnavailableError extends VerifyError {
  public readonly provider: string;
  public readonly upstreamStatus?: number;
  public readonly upstreamCode?: string;

  constructor(provider: string, message: string, opts: { upstreamStatus?: number; upstreamCode?: string } = {}) {
    super(502, 'PROVIDER_UNAVAILABLE', message);
    this.name = 'ProviderUnavailableError';
    this.provider = provider;
    this.upstreamStatus = opts.upstreamStatus;
    this.upstreamCode = opts.upstreamCode;
  }
}

/** Input failed format / checksum validation. */
export class ValidationError extends VerifyError {
  constructor(code: string, message: string) {
    super(400, code, message);
    this.name = 'ValidationError';
  }
}

export function isBiometricsUnavailable(err: any): boolean {
  return Boolean(err && (err.code === 'BIOMETRICS_ENGINE_UNAVAILABLE' || err.name === 'BiometricsUnavailableError'));
}

export function sendError(res: Response, httpStatus: number, code: string, message: string, extra?: Record<string, unknown>): void {
  if (res.headersSent) return;
  res.status(httpStatus).json({ status: 'FAILED', error_code: code, error_message: message, ...(extra || {}) });
}

/** Converts any thrown value to the uniform envelope. Never echoes raw upstream payloads. */
export function handleError(res: Response, err: any, context: string): void {
  if (err instanceof VerifyError) {
    if (err.httpStatus >= 500) {
      console.warn(`[180Verify] ${context}: ${err.code} - ${err.message}`);
    }
    sendError(res, err.httpStatus, err.code, err.message, err.details);
    return;
  }
  if (isBiometricsUnavailable(err)) {
    console.warn(`[180Verify] ${context}: biometrics engine unavailable - ${err?.message || ''}`);
    sendError(res, 503, 'BIOMETRICS_ENGINE_UNAVAILABLE', 'The biometrics engine is temporarily unavailable. Please retry shortly.');
    return;
  }
  // Unknown error: log message only (no request bodies / PII), return generic envelope.
  console.error(`[180Verify] ${context}: unexpected error - ${err?.message || err}`);
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred while processing the verification request.');
}
