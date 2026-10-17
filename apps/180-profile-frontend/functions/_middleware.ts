interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
}

type PagesFunction<T = any> = (context: {
  request: Request;
  env: T;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  data: Record<string, any>;
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
}) => Promise<Response> | Response;

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname;
  const appParam = url.searchParams.get('app');

  // Canonical permanent redirect for deprecated 180workspace.com domains
  if (hostname.includes('180workspace.com')) {
    return Response.redirect(`https://profile.180core.cloud${pathname}${url.search}`, 308);
  }

  // Bypass static assets, scripts, images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return context.next();
  }

  // Helper to attach permissive framing and CORS headers for 180 Pay & Auth iframes/modals
  const respondWithFrameHeaders = async (assetUrl: URL) => {
    try {
      const response = await context.env.ASSETS.fetch(assetUrl);
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');
      newHeaders.delete('X-Frame-Options');
      newHeaders.set('Content-Security-Policy', 'frame-ancestors *');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      return context.next();
    }
  };

  // 1. 180 AUTH (profile.180core.cloud / auth.180core.cloud / ?app=auth)
  if (hostname.startsWith('auth.') || hostname.startsWith('180auth.') || appParam === 'auth') {
    if (pathname === '/' || pathname === '' || pathname === '/login' || pathname === '/oauth/authorize') {
      return respondWithFrameHeaders(new URL('/auth/login', context.request.url));
    }
    if (pathname === '/consent') {
      return respondWithFrameHeaders(new URL('/auth/consent', context.request.url));
    }
    if (pathname === '/register' || pathname === '/signup') {
      return respondWithFrameHeaders(new URL('/auth/register', context.request.url));
    }
    if (pathname === '/oauth/callback' || pathname.startsWith('/.well-known') || pathname.startsWith('/certs')) {
      return respondWithFrameHeaders(new URL(pathname, context.request.url));
    }
    if (!pathname.startsWith('/auth')) {
      return respondWithFrameHeaders(new URL(`/auth${pathname}`, context.request.url));
    }
    return respondWithFrameHeaders(new URL(pathname, context.request.url));
  }

  // 2. 180 PAY (pay.180core.cloud / 180pay.* / ?app=pay)
  if (hostname.startsWith('pay.') || hostname.startsWith('180pay.') || appParam === 'pay') {
    if (pathname.startsWith('/checkout/manage-subscription')) {
      return respondWithFrameHeaders(new URL('/checkout/manage-subscription/default', context.request.url));
    }
    if (
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/pay') ||
      pathname.startsWith('/link') ||
      pathname.startsWith('/portal') ||
      pathname.startsWith('/embed')
    ) {
      return respondWithFrameHeaders(new URL(pathname, context.request.url));
    }
    if (pathname === '/' || pathname === '') {
      return respondWithFrameHeaders(new URL('/checkout/default', context.request.url));
    }
    const cleanPath = pathname.replace(/^\//, '');
    return respondWithFrameHeaders(new URL(`/checkout/${cleanPath}`, context.request.url));
  }

  // 3. 180 PROFILE (profile.180core.cloud / 180profile.* / default)
  const response = await context.next();
  if (pathname.startsWith('/checkout') || pathname.startsWith('/auth')) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.delete('X-Frame-Options');
    newHeaders.set('Content-Security-Policy', 'frame-ancestors *');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
  return response;
};
