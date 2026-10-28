/**
 * 180 Profile Unified API Gateway Helper
 * Directs all API and OAuth calls to the universal core backend (api.180core.cloud)
 */

export function isLocalOrIpHost(host: string): boolean {
  if (!host) return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)
  );
}

const envCoreUrl = process.env.NEXT_PUBLIC_CORE_BACKEND_URL || process.env.NEXT_PUBLIC_CORE_API_URL || process.env.NEXT_PUBLIC_API_URL;
export const CORE_BACKEND_URL =
  (envCoreUrl && !envCoreUrl.includes(':4004'))
    ? envCoreUrl
    : (typeof window !== 'undefined' && isLocalOrIpHost(window.location.hostname)
        ? `http://${window.location.hostname}:4003`
        : 'https://api.180core.cloud');

export function isCustomDomainHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return (
    !isLocalOrIpHost(host) &&
    !host.endsWith('180core.cloud') &&
    !host.endsWith('.pages.dev')
  );
}

export function getCoreApiUrl(path: string): string {
  if (!path) return CORE_BACKEND_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If on a custom merchant subdomain (e.g. pay.brand.com), use current origin so Nginx proxies with correct Host header
  if (isCustomDomainHost()) {
    return `${window.location.origin}${cleanPath}`;
  }

  return `${CORE_BACKEND_URL}${cleanPath}`;
}

// Client-side auto-interceptor so all relative `/api/` and `/oauth/` calls route appropriately
if (typeof window !== 'undefined' && !(window as any).__180_fetch_intercepted) {
  (window as any).__180_fetch_intercepted = true;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let target = input;
    let isCoreTarget = false;

    if (typeof input === 'string') {
      if (input.startsWith('/api/') || input.startsWith('/oauth/')) {
        target = isCustomDomainHost() ? input : `${CORE_BACKEND_URL}${input}`;
        isCoreTarget = true;
      } else if (input.startsWith(CORE_BACKEND_URL)) {
        isCoreTarget = true;
      }
    } else if (input instanceof URL) {
      if (input.pathname.startsWith('/api/') || input.pathname.startsWith('/oauth/')) {
        target = isCustomDomainHost() ? input : new URL(input.pathname + input.search, CORE_BACKEND_URL);
        isCoreTarget = true;
      } else if (input.origin === new URL(CORE_BACKEND_URL).origin) {
        isCoreTarget = true;
      }
    }

    let modifiedInit: RequestInit = isCoreTarget
      ? {
          ...init,
          credentials: init?.credentials || 'include',
        }
      : (init || {});

    // Automatically inject Authorization Bearer token for core backend calls
    if (isCoreTarget && typeof window !== 'undefined') {
      const headers = new Headers(modifiedInit.headers || {});
      if (!headers.has('Authorization')) {
        const token =
          localStorage.getItem('platform_auth_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('accessToken');
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
      modifiedInit.headers = headers;
    }

    return originalFetch(target, modifiedInit);
  };
}
