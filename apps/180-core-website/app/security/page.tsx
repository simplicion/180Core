import React from 'react';
import type { Metadata } from 'next';
import { SecurityShowcase } from '@/components/SecurityShowcase';

export const metadata: Metadata = {
  title: 'Security & Cryptography',
  description:
    'RS256 JWKS asymmetric signing, RFC 7636 PKCE, HMAC-SHA256 replay-safe webhooks, and sovereign compliance.',
};

export default function SecurityPage() {
  return <SecurityShowcase />;
}
