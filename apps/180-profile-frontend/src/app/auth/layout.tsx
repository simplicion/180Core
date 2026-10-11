'use client';

import React, { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function AuthWatermark() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client_id');
  if (clientId) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
      <img
        src="/black-icon.svg"
        alt=""
        className="w-80 h-80 object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
}

function AuthHeader() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client_id');

  // When authenticating with a client app, strictly remove 180 branding header
  if (clientId) {
    return null;
  }

  return (
    <header className="relative z-10 w-full pt-6 pb-2 px-6 flex items-center justify-center gap-2.5">
      <img
        src="/black-icon.svg"
        alt="180 Profile"
        className="w-7 h-7 object-contain"
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement;
          if (!target.src.includes('black-icon')) target.src = '/black-icon.svg';
        }}
      />
      <span className="font-bold text-base tracking-tight text-gray-900">
        <span className="text-black font-extrabold">180</span>profile
      </span>
    </header>
  );
}

function AuthFooter() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client_id');

  return (
    <footer className="w-full py-3.5 px-4 border-t border-slate-100 text-center text-[11px] text-slate-400 relative z-10 bg-white/80 backdrop-blur-xs flex items-center justify-center gap-1.5">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <span>
        {clientId
          ? 'Protected by Universal Identity & End-to-End Encryption'
          : 'Protected by 180 Workspace Universal Identity & Ledger Protocol'}
      </span>
    </footer>
  );
}

export default function AuthStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-between text-slate-900 relative overflow-hidden">
      {/* Full Page Minimal Grid Background */}
      <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-70" />

      {/* Subtle ambient gradient orbs */}
      <div className="fixed top-0 right-0 w-[400px] h-[400px] bg-zinc-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-zinc-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* Watermark logo - only on standalone direct access */}
      <Suspense fallback={null}>
        <AuthWatermark />
      </Suspense>

      {/* Top Branding Bar - only on standalone direct access */}
      <Suspense fallback={null}>
        <AuthHeader />
      </Suspense>

      {/* Full Page Auth Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-4 sm:px-8 w-full max-w-md mx-auto relative z-10">
        <div className="w-full">{children}</div>
      </main>

      {/* Docked Minimal Footer */}
      <Suspense fallback={null}>
        <AuthFooter />
      </Suspense>
    </div>
  );
}
