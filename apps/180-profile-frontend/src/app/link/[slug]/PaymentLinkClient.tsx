'use client';

import React, { useCallback } from 'react';
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

  return (
    <CheckoutStandaloneLayout>
      <CheckoutClient initialSessionId={slug} />
    </CheckoutStandaloneLayout>
  );
}

export default PaymentLinkClient;
