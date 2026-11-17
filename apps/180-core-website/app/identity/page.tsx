import React from 'react';
import type { Metadata } from 'next';
import { IdentityShowcase } from '@/components/IdentityShowcase';

export const metadata: Metadata = {
  title: '180 Identity & 180 Verify',
  description:
    'Universal OpenID Connect authentication, 1-tap WhatsApp OTP, FIDO2 passkeys, API Setu government document verification, and ArcFace AI biometrics.',
};

export default function IdentityPage() {
  return <IdentityShowcase />;
}
