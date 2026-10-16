'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FloatingSupportWidget } from '@workspace/ui';

export function ProfileSupportWrapper() {
  const pathname = usePathname();

  // Do not display Quick Support button on auth screens, checkout modals, embed pages, or payment links
  if (
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/checkout') ||
    pathname?.startsWith('/embed') ||
    pathname?.startsWith('/link') ||
    pathname?.startsWith('/pay/l')
  ) {
    return null;
  }

  return <FloatingSupportWidget backendUrl="http://localhost:4003" />;
}

export default ProfileSupportWrapper;
