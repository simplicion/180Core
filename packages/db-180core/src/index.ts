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

/**
 * Universal Two-Credential Model Helper:
 * Resolves an OAuthApp record by public clientId, internal UUID id, case-insensitive name, or slug.
 */
export async function resolveOAuthApp(identifier: string) {
  if (!identifier) return null;
  const trimmed = String(identifier).trim();
  if (!trimmed) return null;

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
  if (direct) return direct;

  // 2. Slug match against app name (e.g. "bookselling" -> "Bookselling")
  const targetSlug = slugify(trimmed);
  if (targetSlug) {
    const allApps = await (corePrisma as any).oAuthApp.findMany();
    const slugMatch = allApps.find((a: any) => {
      const aSlug = slugify(a.name);
      return aSlug === targetSlug || aSlug.replace(/-/g, '') === targetSlug.replace(/-/g, '');
    });
    if (slugMatch) return slugMatch;
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
      return (corePrisma as any).oAuthApp.findFirst({
        where: {
          OR: [
            { id: link.appId },
            { clientId: link.appId },
            { name: { equals: link.appId, mode: 'insensitive' } },
          ],
        },
      });
    }
  } catch (_) {}

  // 4. Special fallback: If identifier is 'default', resolve to the first active OAuthApp
  if (trimmed === 'default') {
    const defaultApp = await (corePrisma as any).oAuthApp.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (defaultApp) return defaultApp;

    const anyApp = await (corePrisma as any).oAuthApp.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (anyApp) return anyApp;
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

