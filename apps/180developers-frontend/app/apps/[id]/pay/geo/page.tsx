'use client';

import { useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { extractAppIdFromPath } from '@/context/ProjectContext';

export default function PayGeoPricingPage() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = extractAppIdFromPath(pathname) || (params?.id !== 'default' ? (params?.id as string) : '') || (typeof window !== 'undefined' ? extractAppIdFromPath(window.location.pathname) : '');
    if (id && id !== 'default') {
      router.replace(`/apps/${id}/pay/pricing`);
    }
  }, [pathname, params?.id, router]);

  return null;
}
