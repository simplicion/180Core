'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FloatingSupportWidget } from '@workspace/ui';
import { getStoredAuthToken } from '@/lib/auth';

export function ProfileSupportWrapper() {
  const pathname = usePathname();
  const [hasAuth, setHasAuth] = useState(false);

  useEffect(() => {
    const checkToken = () => {
      setHasAuth(!!getStoredAuthToken());
    };
    checkToken();

    window.addEventListener('storage', checkToken);
    window.addEventListener('180_SIGNOUT', checkToken);
    window.addEventListener('180_AUTH_SUCCESS', checkToken);
    return () => {
      window.removeEventListener('storage', checkToken);
      window.removeEventListener('180_SIGNOUT', checkToken);
      window.removeEventListener('180_AUTH_SUCCESS', checkToken);
    };
  }, []);

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

  // On mobile screens (< 640px), hide the floating trigger button completely so it never covers the bottom navigation bar or page content.
  // Quick Support is always cleanly accessible from the Top Header and Account Menu.
  // On desktop screens (sm: and up), the floating button sits comfortably at bottom-right.
  const positionClass = 'hidden sm:inline-flex bottom-5 right-5';

  return (
    <FloatingSupportWidget
      backendUrl="http://localhost:4003"
      className={positionClass}
    />
  );
}

export default ProfileSupportWrapper;
