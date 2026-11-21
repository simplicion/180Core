'use strict';

import { PrismaClient, Prisma } from '../generated/client/index.js';

export { PrismaClient, Prisma };

function getCoreDatabaseUrl(): string {
  let url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'CRITICAL: DATABASE_URL environment variable is missing. Database credentials must be provided via the DATABASE_URL environment variable.'
    );
  }

  // Redirect legacy 180developers_db to isolated 180core_db
  if (url.includes('180developers_db')) {
    url = url.replace('180developers_db', '180core_db');
  }

  // If a config mistakenly passed 180workspace_db to 180 Core services, redirect to dedicated 180core_db
  if (url.includes('180workspace_db')) {
    url = url.replace('180workspace_db', '180core_db');
    url = url.replace(/[?&]schema=[^&]*/, '');
  }

  return url;
}

const globalForCorePrisma = globalThis as unknown as {
  corePrisma?: PrismaClient;
};

export const corePrisma =
  globalForCorePrisma.corePrisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getCoreDatabaseUrl(),
      },
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

export const db180core = corePrisma;
export const developersPrisma = corePrisma;
export const prisma = corePrisma;

if (process.env.NODE_ENV !== 'production') {
  globalForCorePrisma.corePrisma = corePrisma;
}

export default corePrisma;

/**
 * Generates a clean URL/identifier slug from any arbitrary string.
 */
export function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CachedOAuthApp {
  app: any;
  expiresAt: number;
}
const oauthAppResolveCache = new Map<string, CachedOAuthApp>();
const OAUTH_APP_CACHE_TTL_MS = 60_000; // 60s in-memory TTL

export function invalidateOAuthAppCache(identifier?: string) {
  if (!identifier) {
    oauthAppResolveCache.clear();
    return;
  }
  const needle = String(identifier).toLowerCase().trim();
  for (const [key, entry] of oauthAppResolveCache.entries()) {
    if (
      key.includes(needle) ||
      (entry.app && (
        entry.app.id?.toLowerCase() === needle ||
        entry.app.clientId?.toLowerCase() === needle ||
        slugify(entry.app.name) === needle
      ))
    ) {
      oauthAppResolveCache.delete(key);
    }
  }
}

/**
 * Universal Two-Credential Model Helper:
 * Resolves an OAuthApp record by public clientId, internal UUID id, case-insensitive name, or slug.
 */
export async function resolveOAuthApp(identifier: string) {
  if (!identifier) return null;
  const trimmed = String(identifier).trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  const now = Date.now();
  const cached = oauthAppResolveCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.app;
  }

  // 1. Direct match by id, clientId, or exact name (case-insensitive)
  const direct = await (corePrisma as any).oAuthApp.findFirst({
    where: {
      OR: [
        { id: trimmed },
        { clientId: trimmed },
        { name: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
  });
  if (direct) {
    const entry: CachedOAuthApp = { app: direct, expiresAt: now + OAUTH_APP_CACHE_TTL_MS };
    oauthAppResolveCache.set(cacheKey, entry);
    if (direct.id) oauthAppResolveCache.set(direct.id.toLowerCase(), entry);
    if (direct.clientId) oauthAppResolveCache.set(direct.clientId.toLowerCase(), entry);
    if (direct.name) oauthAppResolveCache.set(slugify(direct.name), entry);
    return direct;
  }

  // 2. Slug match against app name (e.g. "bookselling" -> "Bookselling")
  const targetSlug = slugify(trimmed);
  if (targetSlug) {
    const allApps = await (corePrisma as any).oAuthApp.findMany();
    const slugMatch = allApps.find((a: any) => {
      const aSlug = slugify(a.name);
      return aSlug === targetSlug || aSlug.replace(/-/g, '') === targetSlug.replace(/-/g, '');
    });
    if (slugMatch) {
      const entry: CachedOAuthApp = { app: slugMatch, expiresAt: now + OAUTH_APP_CACHE_TTL_MS };
      oauthAppResolveCache.set(cacheKey, entry);
      if (slugMatch.id) oauthAppResolveCache.set(slugMatch.id.toLowerCase(), entry);
      if (slugMatch.clientId) oauthAppResolveCache.set(slugMatch.clientId.toLowerCase(), entry);
      oauthAppResolveCache.set(targetSlug, entry);
      return slugMatch;
    }
  }

  // 3. Fallback: Check if identifier matches a PaymentLink slug or ID
  try {
    const link = await (corePrisma as any).paymentLink.findFirst({
      where: {
        OR: [{ id: trimmed }, { slug: trimmed }],
      },
      select: { appId: true },
    });
    if (link && link.appId) {
      const app = await (corePrisma as any).oAuthApp.findFirst({
        where: {
          OR: [
            { id: link.appId },
            { clientId: link.appId },
            { name: { equals: link.appId, mode: 'insensitive' } },
          ],
        },
      });
      if (app) {
        const entry: CachedOAuthApp = { app, expiresAt: now + OAUTH_APP_CACHE_TTL_MS };
        oauthAppResolveCache.set(cacheKey, entry);
        return app;
      }
    }
  } catch (_) {}

  // 4. Special fallback: If identifier is 'default', resolve to the first active OAuthApp
  if (trimmed === 'default') {
    const defaultApp = await (corePrisma as any).oAuthApp.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (defaultApp) {
      const entry: CachedOAuthApp = { app: defaultApp, expiresAt: now + OAUTH_APP_CACHE_TTL_MS };
      oauthAppResolveCache.set(cacheKey, entry);
      return defaultApp;
    }

    const anyApp = await (corePrisma as any).oAuthApp.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (anyApp) {
      const entry: CachedOAuthApp = { app: anyApp, expiresAt: now + OAUTH_APP_CACHE_TTL_MS };
      oauthAppResolveCache.set(cacheKey, entry);
      return anyApp;
    }
  }

  return null;
}

/**
 * Resolves the internal database primary key UUID from either a clientId, UUID, app name, or slug.
 */
export async function resolveAppId(identifier: string): Promise<string> {
  const app = await resolveOAuthApp(identifier);
  if (app) return app.id;

  // Fallback for 'default' if no direct app was matched
  if (String(identifier).trim() === 'default') {
    const fallback = await (corePrisma as any).oAuthApp.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (fallback) return fallback.id;
  }

  return identifier;
}

