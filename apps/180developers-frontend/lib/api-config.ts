'use strict';

/**
 * Resolves the 180 Core Backend API base URL.
 * In local development (localhost / 127.0.0.1), uses http://localhost:4003.
 * In production (developers.180workspace.com / Cloudflare Pages), uses https://services.180workspace.com.
 */
export const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003';
  }
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal
    ? (process.env.NEXT_PUBLIC_LOCAL_CORE_URL || 'http://localhost:4003')
    : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://services.180workspace.com');
};

/**
 * Resolves the 180 Profile / Pay web domain base URL (where /embed/pricing/ or /link/ are hosted).
 * In local development, uses http://localhost:3009.
 * In production, uses https://profile.180workspace.com.
 */
export const getPublicBase = (): string => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_PROFILE_URL || 'http://localhost:3009';
  }
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal
    ? 'http://localhost:3009'
    : (process.env.NEXT_PUBLIC_PROFILE_URL || 'https://profile.180workspace.com');
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
