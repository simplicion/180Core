import React, { Suspense } from 'react';
import { PricingEmbedClient } from './PricingEmbedClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ appId: 'default' }];
}

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default async function PricingEmbedPage({ params }: PageProps) {
  const resolvedParams = await params;
  const appId = resolvedParams.appId;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
          <LogoLoader size={36} className="w-9 h-9 text-indigo-500" />
          <p className="text-xs text-zinc-400 font-medium mt-3">Loading pricing plans...</p>
        </div>
      }
    >
      <PricingEmbedClient appId={appId} />
    </Suspense>
  );
}
