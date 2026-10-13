import React, { Suspense } from 'react';
import DeveloperProjectDetailClient from './DeveloperProjectDetailClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ id: 'overview', projectId: 'overview' }];
}

interface PageProps {
  params: Promise<{ id: string; projectId: string }>;
}

export default async function DeveloperProjectDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const developerId = resolvedParams.id;
  const projectId = resolvedParams.projectId;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
          <LogoLoader size={36} className="w-9 h-9 text-blue-500 animate-spin" />
          <p className="text-xs text-slate-400 font-medium mt-3">Loading project telemetry...</p>
        </div>
      }
    >
      <DeveloperProjectDetailClient developerId={developerId} projectId={projectId} />
    </Suspense>
  );
}
