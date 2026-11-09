import React, { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full motion-safe:animate-spin mb-4" />
          <p className="text-xs text-zinc-400 font-medium">Loading 180 Verify…</p>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
