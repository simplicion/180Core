import React, { Suspense } from 'react';
import DeveloperDetailClient from './DeveloperDetailClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ id: 'overview' }];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DeveloperDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const developerId = resolvedParams.id;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
          <LogoLoader size={36} className="w-9 h-9 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400 font-medium mt-3">Loading developer telemetry...</p>
        </div>
      }
    >
      <DeveloperDetailClient developerId={developerId} />
    </Suspense>
  );
}
