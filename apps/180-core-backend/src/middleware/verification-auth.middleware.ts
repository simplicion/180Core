/**
 * 180 Verify - authentication for verification routes.
 *
 *  requireVerifyClient   B2B endpoints (/pan, /dl, ..., /full-kyc, GET /session/:id/result):
 *                        developer client credentials, reusing the OAuthApp model
 *                        (clientId + clientSecret, secret stored as sha256 hex in clientSecretHash,
 *                        same scheme as subscription.controller.ts). Accepted as
 *                          Authorization: Basic base64(clientId:clientSecret)   (preferred)
 *                          X-Client-Id / X-Client-Secret headers
 *                          body { clientId, clientSecret }
 *                        Secrets are compared in constant time.
 *  requireSessionToken   resident-facing session endpoints: Authorization: Bearer <sessionToken>
 *                        bound to :id.
 */

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { SANDBOX_DEMO_APP_NAME, SANDBOX_DEMO_CLIENT_ID, SANDBOX_DEMO_CLIENT_SECRET, isSandbox } from '../services/verification/config';
import { VerifyError, handleError } from '../services/verification/errors';
import { FINAL_STATUSES, SessionRecord, sessionStore } from '../services/verification/session-store';
import { verifySessionToken } from '../services/verification/tokens';
import { FaceCache } from '../services/verification/face-cache';

export interface VerifyApp {
  id: string | null; // null for the built-in sandbox demo client
  clientId: string;
  name: string;
  logoUrl: string | null;
  clientSecretHash: string;
  allowedOrigins: string[];
  redirectUris: string[];
  isActive: boolean;
}

export interface AppDirectory {
  findByClientId(clientId: string): Promise<VerifyApp | null>;
}

class PrismaAppDirectory implements AppDirectory {
  async findByClientId(clientId: string): Promise<VerifyApp | null> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const db = require('@workspace/db-180core');
    const prisma = db.corePrisma || db.developersPrisma || db.default;
    const app = await prisma.oAuthApp.findUnique({
      where: { clientId },
      select: { id: true, clientId: true, name: true, logoUrl: true, clientSecretHash: true, allowedOrigins: true, redirectUris: true, isActive: true },
    });
    if (!app) return null;
    return { ...app, logoUrl: app.logoUrl || null };
  }
}

let directory: AppDirectory = new PrismaAppDirectory();

/** Test hook. */
export function setAppDirectory(d: AppDirectory | null): void {
  directory = d || new PrismaAppDirectory();
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a || '').digest();
  const hb = crypto.createHash('sha256').update(b || '').digest();
  return crypto.timingSafeEqual(ha, hb) && Boolean(a) && Boolean(b);
}

export function sandboxDemoApp(): VerifyApp {
  return {
    id: null,
    clientId: SANDBOX_DEMO_CLIENT_ID,
    name: SANDBOX_DEMO_APP_NAME,
    logoUrl: null,
    clientSecretHash: hashSecret(SANDBOX_DEMO_CLIENT_SECRET),
    allowedOrigins: [],
    redirectUris: [],
    isActive: true,
  };
}

export async function findApp(clientId: string): Promise<VerifyApp | null> {
  if (!clientId) return null;
  if (clientId === SANDBOX_DEMO_CLIENT_ID) return isSandbox() ? sandboxDemoApp() : null;
  return directory.findByClientId(clientId);
}

export function parseBasicAuth(req: Request): { clientId: string; clientSecret: string } | null {
  const h = req.headers.authorization || '';
  if (!/^Basic\s+/i.test(h)) return null;
  try {
    const decoded = Buffer.from(h.replace(/^Basic\s+/i, '').trim(), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx <= 0) return null;
    return { clientId: decodeURIComponent(decoded.slice(0, idx)), clientSecret: decodeURIComponent(decoded.slice(idx + 1)) };
  } catch {
    return null;
  }
}

function extractCredentials(req: Request): { clientId: string; clientSecret: string } | null {
  const basic = parseBasicAuth(req);
  if (basic) return basic;
  const id = (req.headers['x-client-id'] as string) || (req.headers['x-180-client-id'] as string) || req.body?.clientId || req.body?.client_id;
  const secret = (req.headers['x-client-secret'] as string) || (req.headers['x-180-client-secret'] as string) || req.body?.clientSecret || req.body?.client_secret;
  if (id && secret) return { clientId: String(id), clientSecret: String(secret) };
  return null;
}

/** Verifies developer client credentials. Throws 401 INVALID_CLIENT on any failure (no oracle). */
export async function authenticateClient(req: Request): Promise<VerifyApp> {
  const creds = extractCredentials(req);
  if (!creds) throw new VerifyError(401, 'CLIENT_AUTH_REQUIRED', 'Client credentials are required (Authorization: Basic base64(clientId:clientSecret)).');
  const app = await findApp(creds.clientId);
  const expected = app?.clientSecretHash || hashSecret('__no_such_client__' + crypto.randomBytes(8).toString('hex'));
  const ok = timingSafeEqualStr(hashSecret(creds.clientSecret), expected);
  if (!app || !ok || !app.isActive) throw new VerifyError(401, 'INVALID_CLIENT', 'Invalid client credentials.');
  return app;
}

export function requireVerifyClient(req: Request, res: Response, next: NextFunction): void {
  authenticateClient(req)
    .then((app) => {
      (req as any).verifyClient = app;
      // never keep secrets on the request body
      if (req.body) {
        delete req.body.clientSecret;
        delete req.body.client_secret;
      }
      next();
    })
    .catch((err) => handleError(res, err, 'client-auth'));
}

function normalizeOrigin(o: string): string {
  return (o || '').trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * True when `origin` is registered for the app: exact match in allowedOrigins, or the origin of a
 * registered redirect URI. Wildcards ('*') are deliberately NOT honoured for KYC session creation.
 */
export function isOriginRegistered(app: VerifyApp, origin: string): boolean {
  const o = normalizeOrigin(origin);
  if (!o || o === 'null') return false;
  if ((app.allowedOrigins || []).some((ao) => normalizeOrigin(ao) === o)) return true;
  return (app.redirectUris || []).some((ru) => {
    try {
      return normalizeOrigin(new URL(ru).origin) === o;
    } catch {
      return false;
    }
  });
}

export function isRedirectUriRegistered(app: VerifyApp, uri: string): boolean {
  const target = (uri || '').trim();
  return (app.redirectUris || []).some((ru) => {
    const reg = ru.trim();
    if (reg === target) return true;
    try {
      const a = new URL(reg);
      const b = new URL(target);
      return a.origin.toLowerCase() === b.origin.toLowerCase() && a.pathname === b.pathname;
    } catch {
      return false;
    }
  });
}

/**
 * Bearer session token bound to req.params.id. Attaches req.verifySession.
 * Expired sessions -> 410 SESSION_EXPIRED (and are marked EXPIRED, cached faces purged).
 */
export function requireSessionToken(req: Request, res: Response, next: NextFunction): void {
  (async () => {
    const h = req.headers.authorization || '';
    const token = /^Bearer\s+/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : '';
    if (!token) throw new VerifyError(401, 'INVALID_SESSION_TOKEN', 'Authorization: Bearer <sessionToken> is required.');
    const claims = verifySessionToken(token);
    if (claims.sid !== req.params.id) throw new VerifyError(401, 'INVALID_SESSION_TOKEN', 'The session token does not belong to this session.');
    const session = await sessionStore().get(req.params.id);
    if (!session || !timingSafeEqualStr(session.tokenJti, claims.jti)) {
      throw new VerifyError(401, 'INVALID_SESSION_TOKEN', 'The session token does not belong to this session.');
    }
    await expireIfNeeded(session);
    (req as any).verifySession = session;
  })()
    .then(() => next())
    .catch((err) => handleError(res, err, 'session-auth'));
}

/** Marks a non-final, past-expiry session EXPIRED and throws 410. */
export async function expireIfNeeded(session: SessionRecord): Promise<void> {
  if (session.expiresAt.getTime() > Date.now()) return;
  if (!FINAL_STATUSES.includes(session.status)) {
    await sessionStore().update(session.id, { status: 'EXPIRED', failureCode: 'SESSION_EXPIRED' });
    session.status = 'EXPIRED';
  }
  FaceCache.purge(session.id);
  if (session.status === 'EXPIRED') {
    throw new VerifyError(410, 'SESSION_EXPIRED', 'This verification session has expired. Please start a new one.');
  }
}
