'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { OneEightyCoreIcon } from '@/components/OneEightyCoreLogo';

export default function CheckoutStandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInsideIframe, setIsInsideIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInsideIframe(typeof window !== 'undefined' && window.self !== window.top);
    } catch {
      setIsInsideIframe(true);
    }
  }, []);

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      const closePayload = { type: '180_PAYMENT_CLOSE' };
      const closePayloadPay = { type: '180_PAY_CLOSE' };

      // 1. Post to embedding parent window (iframe drawer / bottom sheet SDK)
      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage(closePayload, '*'); } catch (_) {}
        try { window.parent.postMessage(JSON.stringify(closePayload), '*'); } catch (_) {}
        try { window.parent.postMessage(closePayloadPay, '*'); } catch (_) {}
        try { window.parent.postMessage(JSON.stringify(closePayloadPay), '*'); } catch (_) {}
      }

      // 2. Post to opener window if launched via popup
      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(closePayload, '*'); } catch (_) {}
        try { window.opener.postMessage(JSON.stringify(closePayload), '*'); } catch (_) {}
        try { window.opener.postMessage(closePayloadPay, '*'); } catch (_) {}
        try { window.opener.postMessage(JSON.stringify(closePayloadPay), '*'); } catch (_) {}
        try { window.close(); } catch (_) {}
      }

      // 3. Fallback for standalone browser tab navigation
      if ((!window.parent || window.parent === window) && (!window.opener || window.opener.closed)) {
        window.history.back();
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-black flex flex-col justify-between text-slate-900 dark:text-zinc-100 font-sans relative antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 py-3 shadow-2xs">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-center shadow-2xs shrink-0 overflow-hidden">
              <OneEightyCoreIcon size={18} className="shrink-0" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-zinc-100 leading-tight">
                Secure Checkout
              </span>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                End-to-End Encrypted
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close checkout"
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Direct Page Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 sm:px-6 py-5 flex flex-col justify-start relative z-10">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-slate-200/70 dark:border-zinc-800/70 py-3 px-4 text-center text-slate-400 dark:text-zinc-500 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm relative z-10">
        <div className="max-w-md mx-auto flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>PCI-DSS Compliant • End-to-End Encrypted Payment Security</span>
        </div>
      </footer>
    </div>
  );
}

