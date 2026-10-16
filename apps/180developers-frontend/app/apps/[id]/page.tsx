import React, { Suspense } from 'react';
import AppDetailClient from './AppDetailClient';
import { AdaptiveSkeleton } from '@workspace/ui';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function Page() {
  return (
    <Suspense fallback={<AdaptiveSkeleton screen="app-detail" />}>
      <AppDetailClient />
    </Suspense>
  );
}
