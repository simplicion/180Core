'use strict';

import { PrismaClient, Prisma } from '../generated/client/index.js';

export { PrismaClient, Prisma };

function getCoreDatabaseUrl(): string {
  let url = process.env.DATABASE_URL;

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL: DATABASE_URL environment variable is missing in production. Hardcoded database fallback credentials are strictly prohibited.'
      );
    }
    // Safe local development fallback
    url = 'postgresql://postgres:postgres@localhost:5432/180core_db?schema=public';
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
 * Universal Two-Credential Model Helper:
 * Resolves an OAuthApp record by either its public clientId or internal UUID id.
 */
export async function resolveOAuthApp(identifier: string) {
  if (!identifier) return null;
  return (corePrisma as any).oAuthApp.findFirst({
    where: {
      OR: [
        { clientId: identifier },
        { id: identifier },
      ],
    },
  });
}

/**
 * Resolves the internal database primary key UUID from either a clientId or UUID.
 */
export async function resolveAppId(identifier: string): Promise<string> {
  const app = await resolveOAuthApp(identifier);
  return app ? app.id : identifier;
}
