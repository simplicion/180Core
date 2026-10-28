'use client';

import { useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { extractAppIdFromPath } from '@/context/ProjectContext';

export default function IdentityIndexRedirectPage() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = extractAppIdFromPath(pathname) || (params?.id !== 'default' ? params?.id : '') || (typeof window !== 'undefined' ? extractAppIdFromPath(window.location.pathname) : '');
    if (id && id !== 'default') {
      router.replace(`/apps/${id}/identity/users`);
    }
  }, [pathname, params?.id, router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
