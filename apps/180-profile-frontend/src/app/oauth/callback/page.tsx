'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Info, ArrowRight, ExternalLink, Key, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@workspace/ui';

function OAuthCallbackDiagnosticContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              180 Identity — Callback Diagnostic
            </h1>
            <p className="text-xs text-slate-400">
              OAuth 2.0 & RFC 6749 Protocol Resolution
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 leading-relaxed space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-blue-300">
            <Info className="w-4 h-4 shrink-0" />
            <span>Understanding This Endpoint</span>
          </div>
          <p>
            You have reached the <code className="text-white font-mono bg-blue-950/60 px-1 py-0.5 rounded">/oauth/callback</code> route on the 180 Core profile server.
          </p>
          <p>
            Under <strong>RFC 6749 Section 3.1.2</strong>, the OAuth redirect URI must point to <em>your client application's</em> callback endpoint (e.g. <code className="text-white font-mono bg-blue-950/60 px-1 py-0.5 rounded">https://yourapp.com/auth/callback</code> or <code className="text-white font-mono bg-blue-950/60 px-1 py-0.5 rounded">http://localhost:3000/auth/callback</code>), rather than the identity provider's hosted domain.
          </p>
        </div>

        {code && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Authorization Code Delivered
              </span>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                Valid for 15 minutes
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/50 font-mono text-xs text-emerald-300 break-all select-all border border-emerald-500/20">
              {code}
            </div>
            {state && (
              <p className="text-[11px] text-slate-400 font-mono">
                State: <span className="text-slate-200">{state}</span>
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 space-y-1.5">
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
              {error}
            </div>
            {errorDescription && (
              <div className="text-xs text-red-200">{errorDescription}</div>
            )}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Link href="/" className="flex-1">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs py-2.5 flex items-center justify-center gap-2">
              <span>Return to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <a
            href="https://developer.180core.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button
              variant="outline"
              className="w-full border-white/10 hover:bg-white/5 text-slate-300 text-xs py-2.5 flex items-center justify-center gap-2"
            >
              <span>Developer Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
          Loading 180 Identity diagnostic...
        </div>
      }
    >
      <OAuthCallbackDiagnosticContent />
    </Suspense>
  );
}
