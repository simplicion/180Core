'use strict';

/**
 * Resolves the 180 Core Backend API base URL.
 * In local development (localhost / 127.0.0.1), uses http://localhost:4003.
 * In production (developer.180core.cloud / Cloudflare Pages), uses https://api.180core.cloud.
 */
export const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
  }
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal
    ? (process.env.NEXT_PUBLIC_LOCAL_CORE_URL || 'http://localhost:4003')
    : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.180core.cloud');
};

/**
 * Resolves the 180 Profile / Pay web domain base URL (where /embed/pricing/ or /link/ are hosted).
 * In local development, uses http://localhost:3009.
 * In production, uses https://profile.180core.cloud.
 */
export const getPublicBase = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_PROFILE_URL || 'http://localhost:3009';
  }
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal
    ? 'http://localhost:3009'
    : (process.env.NEXT_PUBLIC_PROFILE_URL || 'https://profile.180core.cloud');
};

/**
 * Fetches the active platform payment domain (configured in Admin Console -> Settings)
 * for Payment Links and Checkout URLs, falling back to getPublicBase().
 */
export const fetchPlatformPaymentBase = async (): Promise<string> => {
  const fallback = getPublicBase();
  if (typeof window === 'undefined') return fallback;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) return fallback;

  try {
    const res = await fetch(`${getApiBase()}/api/v1/checkout/platform-domain`);
    if (!res.ok) return fallback;
    const data = await res.json();
    if (data?.success && typeof data.publicBase === 'string' && data.publicBase.trim()) {
      return data.publicBase.trim().replace(/\/+$/, '');
    }
  } catch {
    // Fall back to default public base
  }
  return fallback;
};

/**
 * Retrieves the current authentication token across localStorage and cookies.
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('180_access_token') ||
      document.cookie.match(/(?:^|;\s*)platform_auth_token=([^;]+)/)?.[1] ||
      null
    );
  } catch (_) {
    return null;
  }
};
