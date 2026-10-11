import React, { Suspense } from 'react';
import { PaymentLinkClient } from './PaymentLinkClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ slug: 'default' }];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PaymentLinkPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
          <LogoLoader size={40} className="w-10 h-10 text-indigo-500" />
          <p className="text-xs text-zinc-400 font-medium mt-3">Loading checkout link...</p>
        </div>
      }
    >
      <PaymentLinkClient slug={slug} />
    </Suspense>
  );
}
