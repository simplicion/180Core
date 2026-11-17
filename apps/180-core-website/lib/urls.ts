/**
 * Centralized ecosystem URLs for the 180 Core main domain (https://180core.cloud).
 * Uses environment variables when provided, with clean production defaults.
 */

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const SITE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL || 'https://180core.cloud'
);

export const DEVELOPERS_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_DEVELOPERS_URL || 'https://developer.180core.cloud'
);

export const PROFILE_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_PROFILE_URL || 'https://profile.180core.cloud'
);

export const DOCS_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_DOCS_URL || `${DEVELOPERS_URL}/docs`
);

export const API_URL = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL || 'https://api.180core.cloud'
);

export const DEMO_CLIENT_ID =
  process.env.NEXT_PUBLIC_180_CLIENT_ID || '180_client_system_primary';

export function developerLink(path = '/dashboard'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${DEVELOPERS_URL}${clean}`;
}

export function docsLink(section?: string): string {
  if (!section) return DOCS_URL;
  return `${DOCS_URL}?section=${encodeURIComponent(section)}`;
}

export function profileLink(path = ''): string {
  if (!path) return PROFILE_URL;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${PROFILE_URL}${clean}`;
}
