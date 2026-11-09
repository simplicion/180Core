/**
 * 180 Verify - session tokens and signed results.
 *
 * Session token: HS256 JWT { sid, jti, typ } signed with VERIFY_SESSION_SECRET, expiring with the
 * session (30 min). The jti is stored on the session row, so a token is bound to exactly one session.
 *
 * Result signature: JWS compact, RS256 with the platform's OIDC signing key (RsaKeysService, published
 * at /.well-known/jwks.json, header `kid`), so relying parties can verify results with the same JWKS
 * they already use for 180 ID tokens. If the RSA key cannot be loaded, falls back to HS256 with
 * VERIFY_SESSION_SECRET (kid 'verify-hs256') and logs a warning.
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
  alg: 'RS256' | 'HS256';
  kid: string;
  key: string;
  verifyKey: string;
}

let cachedKey: SigningKey | null = null;

function signingKey(): SigningKey {
  if (cachedKey) return cachedKey;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const idp = require('@workspace/identity-provider');
    const svc = idp.RsaKeysService;
    const priv = svc.getPrivateKey();
    const pub = svc.getPublicKey();
    if (priv && pub) {
      cachedKey = { alg: 'RS256', kid: svc.getKeyId(), key: priv, verifyKey: pub };
      return cachedKey;
    }
  } catch (err: any) {
    console.warn(`[180Verify] RSA signing key unavailable (${err?.message}); falling back to HS256 result signatures.`);
  }
  const secret = getSessionSecret();
  if (!secret) throw new VerifyError(503, 'VERIFY_MODULE_MISCONFIGURED', 'No signing key available for verification results.');
  cachedKey = { alg: 'HS256', kid: 'verify-hs256', key: secret, verifyKey: secret };
  return cachedKey;
}

/** Signs the exact payload object (no added claims) as a JWS compact string. */
export function signResult(payload: Record<string, unknown>): string {
  const k = signingKey();
  return jwt.sign(payload, k.key, { algorithm: k.alg, keyid: k.kid, noTimestamp: true, header: { alg: k.alg, kid: k.kid, typ: '180-verify-result+jwt' } as any });
}

export function verifyResultSignature(jws: string): Record<string, unknown> {
  const k = signingKey();
  return jwt.verify(jws, k.verifyKey, { algorithms: [k.alg] }) as Record<string, unknown>;
}

/** Test hook. */
export function _resetSigningKeyCache(): void {
  cachedKey = null;
}
