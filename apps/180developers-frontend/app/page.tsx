'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdaptiveSkeleton } from '@workspace/ui';

export default function DevelopersRootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AdaptiveSkeleton screen="developer-dashboard" />
    </div>
  );
}
