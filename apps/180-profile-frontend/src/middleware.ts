import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const hostname = rawHost.toLowerCase();
  const pathname = url.pathname;
  const appParam = url.searchParams.get('app');

  // Canonical permanent redirect for deprecated 180workspace.com domains
  if (hostname.includes('180workspace.com')) {
    const canonicalUrl = new URL(`https://profile.180core.cloud${pathname}${url.search}`);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // Bypass internal Next.js assets, API routes, and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files like favicon.ico, images, .svg, .png
  ) {
    return NextResponse.next();
  }

  // ─── 1. 180 AUTH (profile.180core.cloud / auth.180core.cloud / ?app=auth) ───────────
  const isAuthDomain =
    hostname.startsWith('auth.') ||
    hostname.startsWith('180auth.') ||
    appParam === 'auth';

  if (isAuthDomain) {
    if (pathname === '/' || pathname === '') {
      url.pathname = '/auth/login';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/consent') {
      url.pathname = '/auth/consent';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/login') {
      url.pathname = '/auth/login';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/register' || pathname === '/signup') {
      url.pathname = '/auth/register';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/oauth/authorize') {
      url.pathname = '/auth/login';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/oauth/callback') {
      return NextResponse.next();
    }
    if (
      pathname.startsWith('/.well-known') ||
      pathname.startsWith('/certs') ||
      pathname === '/health'
    ) {
      return NextResponse.next();
    }
    // If accessing any /auth/* path on auth domain, pass through directly
    if (pathname.startsWith('/auth')) {
      return NextResponse.next();
    }
    // If accessing checkout or pay on auth domain, allow pass through
    if (pathname.startsWith('/checkout') || pathname.startsWith('/pay')) {
      return NextResponse.next();
    }
    // Route any unspecified paths under auth
    url.pathname = `/auth${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ─── 2. 180 PAY (pay.180core.cloud / 180pay.* / ?app=pay) ───────────────
  const isPayDomain =
    hostname.startsWith('pay.') ||
    hostname.startsWith('180pay.') ||
    appParam === 'pay';

  if (isPayDomain) {
    if (pathname === '/' || pathname === '') {
      url.pathname = '/checkout/default';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/demo' || pathname === '/sandbox') {
      url.pathname = '/checkout/default';
      url.searchParams.set('sessionId', 'sess_sandbox_demo');
      return NextResponse.rewrite(url);
    }
    // If path is already /checkout/*, /pay/*, /link/*, /portal/*, /embed/*, allow pass-through
    if (
      pathname.startsWith('/checkout') ||
      pathname.startsWith('/pay') ||
      pathname.startsWith('/link') ||
      pathname.startsWith('/portal') ||
      pathname.startsWith('/embed')
    ) {
      return NextResponse.next();
    }
    // If visiting https://pay.180core.cloud/:sessionId directly
    const cleanPath = pathname.replace(/^\//, '');
    url.pathname = `/checkout/${cleanPath}`;
    return NextResponse.rewrite(url);
  }

  // ─── 3. 180 PROFILE (profile.180core.cloud / 180profile.* / Default) ────
  // Pass-through for universal profile dashboard (/), wallet (/wallet), security (/security), settings (/settings)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
