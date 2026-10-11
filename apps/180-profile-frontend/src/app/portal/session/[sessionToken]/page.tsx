import React, { Suspense } from 'react';
import { PortalSessionClient } from './PortalSessionClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ sessionToken: 'default' }];
}

interface PageProps {
  params: Promise<{ sessionToken: string }>;
}

export default async function CustomerPortalSessionPage({ params }: PageProps) {
  const resolvedParams = await params;
  const sessionToken = resolvedParams.sessionToken;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
          <LogoLoader size={40} className="w-10 h-10 text-indigo-500" />
          <p className="text-xs text-zinc-400 font-medium mt-3">Loading customer portal...</p>
        </div>
      }
    >
      <PortalSessionClient sessionToken={sessionToken} />
    </Suspense>
  );
}
