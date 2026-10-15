'use strict';

/**
 * All possible auth token and user keys used across local storage and session storage
 */
export const AUTH_STORAGE_KEYS = [
  'platform_auth_token',
  'platform_refresh_token',
  'auth_token',
  'token',
  'accessToken',
  'access_token',
  'id_token',
  '180_access_token',
  '180_refresh_token',
  '180_id_token',
  'user',
  '180_user',
  'platform_user',
  'user_profile',
  'developer_profile',
];

/**
 * All possible cookie names used across 180 Core apps
 */
export const AUTH_COOKIE_NAMES = [
  'platform_auth_token',
  'platform_refresh_token',
  'auth_token',
  'token',
  'accessToken',
  'access_token',
  '180_access_token',
  'session',
  '180_session',
];

/**
 * Retrieves the currently active authentication token from localStorage or document.cookie.
 */
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('180_access_token');

    if (token) return token;

    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)(?:platform_auth_token|token|auth_token)=([^;]+)/);
      if (match) return match[1];
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Completely purges all auth tokens, user credentials, and session data
 * from localStorage, sessionStorage, and cookies across all possible domains.
 */
export function purgeAuthSession(): void {
  if (typeof window === 'undefined') return;

  // 1. Purge all storage items
  for (const key of AUTH_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
  }

  // 2. Expire all cookies across all path and domain scopes
  const host = window.location.hostname;
  const hostParts = host.split('.');
  const domainsToClear: (string | undefined)[] = [undefined, host, `.${host}`];

  if (hostParts.length >= 2) {
    const root2 = hostParts.slice(-2).join('.');
    domainsToClear.push(root2, `.${root2}`);
  }
  if (hostParts.length >= 3) {
    const root3 = hostParts.slice(-3).join('.');
    domainsToClear.push(root3, `.${root3}`);
  }
  domainsToClear.push('180core.cloud', '.180core.cloud', '180workspace.com', '.180workspace.com');

  const uniqueDomains = Array.from(new Set(domainsToClear));

  for (const name of AUTH_COOKIE_NAMES) {
    for (const dom of uniqueDomains) {
      const domainAttr = dom ? `; domain=${dom}` : '';
      document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${domainAttr}`;
      document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure${domainAttr}`;
    }
  }

  // 3. Dispatch global browser signout event for all active listeners
  try {
    window.dispatchEvent(new Event('180_SIGNOUT'));
  } catch (_) {}

  // 4. Broadcast across tabs and windows
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('180_auth_sync');
      channel.postMessage({ type: '180_SIGNOUT' });
      channel.close();
    }
  } catch (_) {}

  // 5. Invoke SDK sign-out if mounted on window
  try {
    if ((window as any).OneEighty?.signOut) {
      (window as any).OneEighty.signOut();
    }
    if ((window as any).OneEightyIdentity?.signOut) {
      (window as any).OneEightyIdentity.signOut();
    }
  } catch (_) {}
}
