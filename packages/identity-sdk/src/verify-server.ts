'use strict';

/**
 * 180 Verify — server-side helpers. NEVER import these into browser code: they need
 * your `clientSecret`.
 *
 *   import { fetchVerificationResult } from '@workspace/identity-sdk/verify-server';
 *
 * `fetchVerificationResult()` is the only way to obtain a trustworthy verification
 * outcome. The browser `onSuccess` callback is a UX signal, not proof.
 */

import { JwksVerifier } from './jwks-verifier';
import {
  VerifiedProfile,
  VerificationResultResponse,
  VerifyDocumentType,
  VerifySessionResponse,
  VerifySessionStatus,
} from './verify-types';

export const DEFAULT_VERIFY_API_BASE_URL = 'https://api.180core.cloud';
const VERIFY_BASE_PATH = '/api/v1/identity/verify';

export class VerificationApiError extends Error {
  code: string;
  httpStatus?: number;
  constructor(code: string, message: string, httpStatus?: number) {
    super(message);
    this.name = 'VerificationApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Thrown when the result's signature is missing, invalid, or does not match the request. */
export class VerificationSignatureError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'VerificationSignatureError';
    this.code = code;
  }
}

/* ── Signature verification (pluggable) ───────────────────────────────────── */

export interface VerificationSignatureContext {
  clientId: string;
  sessionId: string;
  apiBaseUrl: string;
}

/**
 * Verifies the JWS compact `signature` attached to a verification result and returns its
 * claims. The default implementation (`createJwksSignatureVerifier`) uses the platform
 * JWKS via the existing `JwksVerifier` (RS256 + `kid`). Supply your own implementation if
 * the platform signs with a different scheme.
 */
export interface VerificationSignatureVerifier {
  verify(jws: string, ctx: VerificationSignatureContext): Promise<{ valid: boolean; payload?: any; error?: string }>;
}

const jwksVerifierCache = new Map<string, JwksVerifier>();

export function createJwksSignatureVerifier(options?: {
  /** Defaults to `${apiBaseUrl}/.well-known/jwks.json`. */
  jwksUrl?: string;
  /** Use a pre-configured verifier (e.g. seeded with `setKeys` in tests / offline). */
  jwksVerifier?: JwksVerifier;
  issuer?: string;
}): VerificationSignatureVerifier {
  return {
    async verify(jws, ctx) {
      let verifier = options?.jwksVerifier;
      if (!verifier) {
        const url = options?.jwksUrl || `${ctx.apiBaseUrl}/.well-known/jwks.json`;
        verifier = jwksVerifierCache.get(url);
        if (!verifier) {
          verifier = new JwksVerifier(url);
          jwksVerifierCache.set(url, verifier);
        }
      }
      // Audience is checked by the caller so tokens without `aud` are still accepted when
      // they carry an explicit `clientId` claim.
      return verifier.verifyToken(jws, options?.issuer ? { issuer: options.issuer } : undefined);
    },
  };
}

export interface VerifiedVerificationResult {
  sessionId: string;
  status: VerifySessionStatus;
  /** From the SIGNED claims only. */
  verifiedProfile: VerifiedProfile | null;
  environment?: string;
  /** The original JWS — store it if you need a portable, re-verifiable proof. */
  signature: string;
  /** All verified JWS claims. */
  claims: Record<string, any>;
}

/**
 * Verifies a verification-result JWS and checks it is bound to `sessionId` (and to
 * `clientId` when the token carries `aud` / `clientId`). Returns the signed claims mapped
 * to a result. Fails closed.
 */
export async function verifyVerificationSignature(
  signature: string,
  ctx: VerificationSignatureContext & { signatureVerifier?: VerificationSignatureVerifier }
): Promise<VerifiedVerificationResult> {
  if (!signature || typeof signature !== 'string') {
    throw new VerificationSignatureError('SIGNATURE_MISSING', 'Verification result has no signature');
  }
  const verifier = ctx.signatureVerifier || createJwksSignatureVerifier();
  const res = await verifier.verify(signature, {
    clientId: ctx.clientId,
    sessionId: ctx.sessionId,
    apiBaseUrl: ctx.apiBaseUrl,
  });
  if (!res || !res.valid || !res.payload || typeof res.payload !== 'object') {
    throw new VerificationSignatureError('SIGNATURE_INVALID', `Verification result signature is invalid: ${res?.error || 'unknown error'}`);
  }
  const claims = res.payload as Record<string, any>;

  const claimSessionId = claims.sessionId ?? claims.sid ?? claims.sub;
  if (claimSessionId !== ctx.sessionId) {
    throw new VerificationSignatureError('SIGNATURE_SESSION_MISMATCH', 'Signed result belongs to a different session');
  }
  if (claims.aud !== undefined) {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(ctx.clientId)) {
      throw new VerificationSignatureError('SIGNATURE_AUDIENCE_MISMATCH', 'Signed result was issued for a different client');
    }
  }
  if (claims.clientId !== undefined && claims.clientId !== ctx.clientId) {
    throw new VerificationSignatureError('SIGNATURE_AUDIENCE_MISMATCH', 'Signed result was issued for a different client');
  }
  if (typeof claims.status !== 'string' || !claims.status) {
    throw new VerificationSignatureError('SIGNED_CLAIMS_INCOMPLETE', 'Signed result does not contain a status');
  }
  const status = claims.status as VerifySessionStatus;
  const verifiedProfile = (claims.verifiedProfile as VerifiedProfile | undefined) ?? null;
  if ((status === 'APPROVED' || status === 'MANUAL_REVIEW') && !verifiedProfile) {
    throw new VerificationSignatureError('SIGNED_CLAIMS_INCOMPLETE', 'Signed result does not contain the verified profile');
  }

  return {
    sessionId: ctx.sessionId,
    status,
    verifiedProfile,
    environment: typeof claims.environment === 'string' ? claims.environment : undefined,
    signature,
    claims,
  };
}

/* ── HTTP helpers ─────────────────────────────────────────────────────────── */

const basicAuth = (clientId: string, clientSecret: string) =>
  `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;

const warnIfBrowser = (fn: string) => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    console.warn(`[180 Verify] ${fn}() uses your clientSecret and must only run on your server.`);
  }
};

const requireCredentials = (clientId?: string, clientSecret?: string) => {
  if (!clientId || !clientSecret) {
    throw new VerificationApiError('MISSING_CREDENTIALS', 'clientId and clientSecret are required');
  }
};

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toApiError(res: Response, body: any, fallback: string): VerificationApiError {
  const code =
    (body && (body.code || body.errorCode || (typeof body.error === 'string' ? body.error : undefined))) || `HTTP_${res.status}`;
  const message = (body && (body.message || body.error_description || body.error)) || `${fallback} (${res.status})`;
  return new VerificationApiError(String(code), String(message), res.status);
}

export interface CreateVerificationSessionInput {
  clientId: string;
  clientSecret: string;
  documents: VerifyDocumentType[];
  strictNameMatching?: boolean;
  /** Origin of the page that will embed the iframe (where postMessages are delivered). */
  parentOrigin?: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Server-side session creation (Basic auth). Return `{ sessionId, verifyUrl }` to your
 * front-end if you prefer not to create sessions from the browser.
 */
export async function createVerificationSession(input: CreateVerificationSessionInput): Promise<VerifySessionResponse> {
  warnIfBrowser('createVerificationSession');
  requireCredentials(input.clientId, input.clientSecret);
  const base = (input.apiBaseUrl || DEFAULT_VERIFY_API_BASE_URL).replace(/\/+$/, '');
  const fetchFn = input.fetchImpl || fetch;

  const res = await fetchFn(`${base}${VERIFY_BASE_PATH}/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: basicAuth(input.clientId, input.clientSecret),
    },
    body: JSON.stringify({
      clientId: input.clientId,
      documents: input.documents,
      ...(input.strictNameMatching !== undefined ? { strictNameMatching: Boolean(input.strictNameMatching) } : {}),
      ...(input.parentOrigin ? { parentOrigin: input.parentOrigin } : {}),
    }),
  });
  const body = await readJson(res);
  if (!res.ok) throw toApiError(res, body, 'Session creation failed');
  const session = body && (body.data && body.data.sessionId ? body.data : body);
  if (!session || typeof session.sessionId !== 'string' || typeof session.verifyUrl !== 'string') {
    throw new VerificationApiError('INVALID_SESSION_RESPONSE', 'Session response is missing sessionId or verifyUrl', res.status);
  }
  return session as VerifySessionResponse;
}

export interface FetchVerificationResultInput {
  sessionId: string;
  clientId: string;
  clientSecret: string;
  apiBaseUrl?: string;
  /** Override signature verification (defaults to JWKS at `${apiBaseUrl}/.well-known/jwks.json`). */
  signatureVerifier?: VerificationSignatureVerifier;
  fetchImpl?: typeof fetch;
}

/**
 * Fetches `GET /api/v1/identity/verify/session/:id/result` with Basic auth and verifies the
 * JWS `signature`. Everything returned comes from the signed claims, never from unsigned
 * response fields. Throws `VerificationApiError` / `VerificationSignatureError`.
 */
export async function fetchVerificationResult(input: FetchVerificationResultInput): Promise<VerifiedVerificationResult> {
  warnIfBrowser('fetchVerificationResult');
  requireCredentials(input.clientId, input.clientSecret);
  if (!input.sessionId || typeof input.sessionId !== 'string') {
    throw new VerificationApiError('MISSING_SESSION_ID', 'sessionId is required');
  }
  const base = (input.apiBaseUrl || DEFAULT_VERIFY_API_BASE_URL).replace(/\/+$/, '');
  const fetchFn = input.fetchImpl || fetch;

  const res = await fetchFn(`${base}${VERIFY_BASE_PATH}/session/${encodeURIComponent(input.sessionId)}/result`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: basicAuth(input.clientId, input.clientSecret),
    },
  });
  const body = await readJson(res);
  if (!res.ok) throw toApiError(res, body, 'Fetching verification result failed');

  const result = (body && (body.data && body.data.signature ? body.data : body)) as VerificationResultResponse | null;
  if (!result || typeof result !== 'object') {
    throw new VerificationApiError('INVALID_RESULT_RESPONSE', 'Verification result response is empty', res.status);
  }
  if (result.sessionId !== undefined && result.sessionId !== input.sessionId) {
    throw new VerificationSignatureError('SIGNATURE_SESSION_MISMATCH', 'Result belongs to a different session');
  }

  const verified = await verifyVerificationSignature(result.signature, {
    clientId: input.clientId,
    sessionId: input.sessionId,
    apiBaseUrl: base,
    signatureVerifier: input.signatureVerifier,
  });

  if (result.status !== undefined && result.status !== verified.status) {
    throw new VerificationSignatureError('SIGNATURE_PAYLOAD_MISMATCH', 'Unsigned status does not match the signed status');
  }
  return verified;
}
