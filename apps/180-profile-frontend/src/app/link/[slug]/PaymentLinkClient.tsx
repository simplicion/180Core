'use client';

import React, { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CheckoutClient from '@/app/checkout/[sessionId]/CheckoutClient';
import CheckoutStandaloneLayout from '@/app/checkout/layout';

export function PaymentLinkClient({ slug: initialSlug }: { slug?: string } = {}) {
  const params = useParams();

  // Resilient slug extraction for static SSG exports (Cloudflare Pages rewrites)
  const getSlug = useCallback(() => {
    if (initialSlug && initialSlug !== 'default') return initialSlug;
    const pSlug = params?.slug as string;
    if (pSlug && pSlug !== 'default') return pSlug;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/(?:link|pay\/l)\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== 'default') {
        return decodeURIComponent(match[1]);
      }
    }
    return '';
  }, [initialSlug, params?.slug]);

  const slug = getSlug();

  // Telemetry: Track page views and 3-second qualified engagements
  useEffect(() => {
    if (!slug || slug === 'default' || slug === 'preview-link') return;

    const apiBase =
      process.env.NEXT_PUBLIC_CORE_BACKEND_URL ||
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:4003'
        : 'https://api.180core.cloud');

    // 1. Initial page view
    try {
      fetch(`${apiBase}/api/v1/payment-links/public/${encodeURIComponent(slug)}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualified: false }),
      }).catch(() => {});
    } catch (_) {}

    // 2. Qualified view: User stays for 3 seconds or longer
    const timer = setTimeout(() => {
      try {
        fetch(`${apiBase}/api/v1/payment-links/public/${encodeURIComponent(slug)}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qualified: true, durationSeconds: 3 }),
        }).catch(() => {});
      } catch (_) {}
    }, 3000);

    return () => clearTimeout(timer);
  }, [slug]);

  return (
    <CheckoutStandaloneLayout>
      <CheckoutClient initialSessionId={slug} />
    </CheckoutStandaloneLayout>
  );
}

export default PaymentLinkClient;
