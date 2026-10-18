import { NextResponse } from 'next/server';

const rawUrl =
  process.env.CORE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_CORE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://api.180core.cloud';
const backendUrl = rawUrl.includes(':4004') ? 'http://localhost:4003' : rawUrl.replace(/\/+$/, '');

export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch(`${backendUrl}/.well-known/openid-configuration`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch OpenID configuration' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'OpenID configuration unavailable' }, { status: 502 });
  }
}
