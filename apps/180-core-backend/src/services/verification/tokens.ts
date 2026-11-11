/**
 * 180 Verify - session tokens and signed results.
 *
 * Session token: HS256 JWT { sid, jti, typ } signed with VERIFY_SESSION_SECRET, expiring with the
 * session (30 min). The jti is stored on the session row, so a token is bound to exactly one session.
 *
 * Result signature: JWS compact, RS256 with the platform's OIDC signing key (RsaKeysService, published
 * at /.well-known/jwks.json, header `kid`), so relying parties can verify results with the same JWKS
 * they already use for 180 ID tokens. Claims: sessionId, clientId, status, error_code?, verifiedProfile,
 * environment, iss='180-verify', aud=<clientId>, iat, exp (30 days). There is no HMAC fallback.
 */

import jwt from 'jsonwebtoken';
import { getSessionSecret } from './config';
import { VerifyError } from './errors';

const ISSUER = '180-verify';
const SESSION_AUDIENCE = '180-verify-session';

export function signSessionToken(sessionId: string, jti: string, expiresAt: Date): string {
  const secret = getSessionSecret();
  if (!secret) throw new VerifyError(503, 'VERIFY_MODULE_MISCONFIGURED', 'VERIFY_SESSION_SECRET is not configured.');
  const exp = Math.floor(expiresAt.getTime() / 1000);
  return jwt.sign({ sid: sessionId, jti, typ: 'verify_session', exp }, secret, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: SESSION_AUDIENCE,
  });
}

export function verifySessionToken(token: string): { sid: string; jti: string } {
  const secret = getSessionSecret();
  if (!secret) throw new VerifyError(503, 'VERIFY_MODULE_MISCONFIGURED', 'VERIFY_SESSION_SECRET is not configured.');
  try {
    const d = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: SESSION_AUDIENCE }) as any;
    if (d?.typ !== 'verify_session' || !d.sid || !d.jti) throw new Error('bad claims');
    return { sid: d.sid, jti: d.jti };
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') throw new VerifyError(410, 'SESSION_EXPIRED', 'This verification session has expired. Please start a new one.');
    throw new VerifyError(401, 'INVALID_SESSION_TOKEN', 'The session token is missing, invalid or does not belong to this session.');
  }
}

interface SigningKey {
  kid: string;
  key: string;
  verifyKey: string;
}

let cachedKey: SigningKey | null = null;

/** Platform RSA key (same key published at /.well-known/jwks.json). No HMAC fallback for results. */
function signingKey(): SigningKey {
  if (cachedKey) return cachedKey;
  let svc: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    svc = require('@workspace/identity-provider').RsaKeysService;
  } catch (err: any) {
    console.error(`[180Verify] RSA signing key unavailable: ${err?.message}`);
  }
  const priv = svc?.getPrivateKey?.();
  const pub = svc?.getPublicKey?.();
  if (!priv || !pub) {
    throw new VerifyError(503, 'VERIFY_MODULE_MISCONFIGURED', 'The platform signing key (JWKS) is not available; results cannot be signed.');
  }
  cachedKey = { kid: svc.getKeyId(), key: priv, verifyKey: pub };
  return cachedKey;
}

export const RESULT_ISSUER = '180-verify';
export const RESULT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Signs a verification result as an RS256 compact JWS (header kid = platform JWKS key id).
 * The payload is signed exactly as given plus iss / aud (= clientId) / iat / exp, and the full claim
 * set is returned so callers can expose the identical object next to the signature.
 */
export function signResult(payload: Record<string, unknown>, clientId: string): { jws: string; claims: Record<string, unknown> } {
  const k = signingKey();
  const iat = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iss: RESULT_ISSUER, aud: clientId, iat, exp: iat + RESULT_TTL_SECONDS };
  const jws = jwt.sign(claims, k.key, { algorithm: 'RS256', keyid: k.kid, header: { alg: 'RS256', kid: k.kid, typ: 'JWT' } as any });
  return { jws, claims };
}

export function verifyResultSignature(jws: string, clientId?: string): Record<string, unknown> {
  const k = signingKey();
  return jwt.verify(jws, k.verifyKey, { algorithms: ['RS256'], issuer: RESULT_ISSUER, ...(clientId ? { audience: clientId } : {}) }) as Record<string, unknown>;
}

/** Test hook. */
export function _resetSigningKeyCache(): void {
  cachedKey = null;
}
