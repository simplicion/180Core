'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Download,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { LogoLoader } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';
import { currencyService } from '@/lib/currency-service';
import { OneEightyCoreLogo } from '@/components/OneEightyCoreLogo';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || searchParams.get('sessionId') || '';
  const paymentId = searchParams.get('payment_id') || searchParams.get('transactionId') || '';
  const statusParam = searchParams.get('status') || '';

  const [loading, setLoading] = useState(Boolean(sessionId));
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function verifySession() {
      try {
        const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/status`));
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSessionDetails(data);
          }
        }
      } catch (err) {
        console.warn('[180 Pay] Could not fetch session receipt:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verifySession();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const copyToClipboard = (text: string, label: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(label);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const amount = sessionDetails?.amount ?? parseFloat(searchParams.get('amount') || '0');
  const currency = sessionDetails?.currency || searchParams.get('currency') || 'INR';
  const appName = sessionDetails?.appName || searchParams.get('appName') || '180 Merchant';
  const fulfillment = sessionDetails?.fulfillment;
  const returnUrl = sessionDetails?.returnUrl || searchParams.get('returnUrl') || '';
  const displayTxId = paymentId || sessionDetails?.transactionId || sessionDetails?.metadata?.transactionId || sessionId;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Header */}
      <header className="max-w-xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
          <OneEightyCoreLogo className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Verified Receipt</span>
        </div>
      </header>

      {/* Main Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        {loading ? (
          <div className="text-center py-16 space-y-4">
            <LogoLoader size={44} className="w-11 h-11 text-blue-600 mx-auto" />
            <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Verifying payment receipt...</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-8 space-y-6 animate-in zoom-in-95">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            {/* Title & Amount */}
            <div className="text-center space-y-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Payment Authorized & Completed
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white pt-1">
                {amount > 0 ? currencyService.format(amount, currency) : 'Payment Complete'}
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Paid to <strong className="text-slate-900 dark:text-zinc-200">{appName}</strong>
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-zinc-800/80">
                <span className="text-slate-600 dark:text-zinc-400 font-medium">Status</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>

              {displayTxId && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-zinc-800/80">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Transaction ID</span>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                    <span className="truncate max-w-[160px]">{displayTxId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(displayTxId, 'Transaction ID')}
                      className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      title="Copy Transaction ID"
                    >
                      {copiedId === 'Transaction ID' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}

              {sessionId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Checkout Session</span>
                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                    <span className="truncate max-w-[160px]">{sessionId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(sessionId, 'Session ID')}
                      className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      title="Copy Session ID"
                    >
                      {copiedId === 'Session ID' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Digital Fulfillment / License Key */}
            {fulfillment?.fulfillmentMessage && (
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Digital Access / License Key
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fulfillment.fulfillmentMessage, 'License Key')}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 font-mono text-xs text-slate-800 dark:text-zinc-200 select-all break-all border border-slate-200 dark:border-zinc-800">
                  {fulfillment.fulfillmentMessage}
                </div>
              </div>
            )}

            {/* Digital Fulfillment File Download */}
            {fulfillment?.fulfillmentFileUrl && (
              <div>
                <a
                  href={fulfillment.fulfillmentFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-4 h-4" />
                  Download Purchased Asset
                </a>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {returnUrl ? (
                <a
                  href={returnUrl}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-zinc-100 font-semibold text-xs transition-all shadow-sm"
                >
                  <span>Return to {appName}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}

              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800/60 font-semibold text-xs text-slate-700 dark:text-zinc-300 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Profile Home</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-xl w-full mx-auto text-center py-4 text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
        <p>Processed securely via 180 Pay • 256-bit encrypted transaction ledger</p>
        <p>© {new Date().getFullYear()} 180 Core Cloud Identity & Payments Infrastructure</p>
      </footer>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center font-sans space-y-3">
          <LogoLoader size={44} className="w-11 h-11 text-blue-600" />
          <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Loading receipt...</p>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}
