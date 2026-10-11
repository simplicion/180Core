'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogoLoader } from '@workspace/ui';

function RegisterRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', 'signup');
    router.replace(`/auth/login?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="bg-white rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto flex flex-col items-center justify-center border border-slate-200 shadow-xl">
      <LogoLoader size={36} className="w-9 h-9 text-blue-600 animate-spin" />
      <p className="text-xs text-slate-500 font-medium">Redirecting to 180 Profile registration...</p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto flex flex-col items-center justify-center border border-slate-200 shadow-xl">
          <LogoLoader size={36} className="w-9 h-9 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading 180 Identity registration...</p>
        </div>
      }
    >
      <RegisterRedirectContent />
    </Suspense>
  );
}
