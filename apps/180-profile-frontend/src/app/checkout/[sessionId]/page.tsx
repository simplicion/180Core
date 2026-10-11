import React, { Suspense } from 'react';
import CheckoutClient from './CheckoutClient';
import { LogoLoader } from '@workspace/ui';

export function generateStaticParams() {
  return [{ sessionId: 'default' }];
}

export default function StandaloneCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-16 text-center space-y-4 flex flex-col items-center justify-center font-sans">
          <LogoLoader size={40} className="w-10 h-10 text-blue-600" />
          <p className="text-xs text-slate-500 font-medium">Loading 180 Pay checkout...</p>
        </div>
      }
    >
      <CheckoutClient />
    </Suspense>
  );
}
