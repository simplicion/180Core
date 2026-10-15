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
        <div className="w-full py-16 text-center space-y-4 flex flex-col items-center justify-center font-sans">
          <LogoLoader size={40} className="w-10 h-10 text-blue-600" />
          <p className="text-xs text-slate-500 font-medium">Loading 180 Pay checkout...</p>
        </div>
      }
    >
      <PaymentLinkClient slug={slug} />
    </Suspense>
  );
}
