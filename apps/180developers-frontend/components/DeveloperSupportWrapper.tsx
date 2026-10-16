'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FloatingSupportWidget } from '@workspace/ui';
import { getStoredAuthToken } from '@/lib/auth';

export function DeveloperSupportWrapper() {
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getStoredAuthToken());
    const onAuthChange = () => setToken(getStoredAuthToken());
    window.addEventListener('storage', onAuthChange);
    window.addEventListener('180_AUTH_CHANGED', onAuthChange);
    return () => {
      window.removeEventListener('storage', onAuthChange);
      window.removeEventListener('180_AUTH_CHANGED', onAuthChange);
    };
  }, []);

  // If on dashboard and not authenticated, hide support widget
  if (pathname?.startsWith('/dashboard') && !token) {
    return null;
  }

  // Also hide on any /auth path
  if (pathname?.startsWith('/auth')) {
    return null;
  }

  return <FloatingSupportWidget backendUrl="http://localhost:4003" />;
}

export default DeveloperSupportWrapper;
