'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CheckoutClient from './[sessionId]/CheckoutClient';
import { LogoLoader, Button } from '@workspace/ui';
import { CreditCard, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { getCoreApiUrl } from '@/lib/api';

function CheckoutEntryPoint() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const querySessionId = searchParams.get('sessionId') || searchParams.get('session_id') || searchParams.get('cs');
  const appId = searchParams.get('appId') || searchParams.get('clientId');
  const planCode = searchParams.get('planCode') || searchParams.get('plan');
  const initialAmount = searchParams.get('amount');
  const currency = searchParams.get('currency') || 'INR';
  const title = searchParams.get('title') || (planCode ? `${planCode} Subscription` : 'Secure Checkout');
  const couponCode = searchParams.get('couponCode') || searchParams.get('coupon');

  const [activeSessionId, setActiveSessionId] = useState<string | null>(querySessionId || null);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (querySessionId) {
      setActiveSessionId(querySessionId);
      return;
    }

    // Auto-bootstrap checkout session if appId is provided via URL
    if (appId && !activeSessionId && !initializing) {
      const initSession = async () => {
        setInitializing(true);
        setError(null);
        try {
          let orderAmount = initialAmount ? parseFloat(initialAmount) : 0;

          // If amount is not explicitly provided, attempt to resolve from app pricing table config
          if (!orderAmount || orderAmount <= 0) {
            try {
              const pricingRes = await fetch(getCoreApiUrl(`/api/v1/pricing-tables/${encodeURIComponent(appId)}`));
              if (pricingRes.ok) {
                const pricingData = await pricingRes.json();
                const cards = pricingData.config?.planCards || pricingData.data?.planCards || [];
                const matchedCard = cards.find((c: any) => c.planCode === planCode) || cards[0];
                if (matchedCard && matchedCard.amount) {
                  orderAmount = matchedCard.amount;
                }
              }
            } catch {
              // Proceed with fallback default
            }
          }

          if (!orderAmount || orderAmount <= 0) {
            orderAmount = 499; // Standard nominal fallback
          }

          const res = await fetch(getCoreApiUrl('/api/v1/checkout/sessions'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId,
              amount: orderAmount,
              currency: currency.toUpperCase(),
              title,
              couponCode: couponCode || undefined,
              metadata: {
                planCode: planCode || undefined,
                source: 'checkout_direct_entry',
              },
            }),
          });

          const data = await res.json();
          if (res.ok && data.success && (data.sessionId || data.session?.id)) {
            const sid = data.sessionId || data.session.id;
            setActiveSessionId(sid);
            if (typeof window !== 'undefined') {
              window.history.replaceState(null, '', `/checkout/${sid}`);
            }
          } else {
            setError(data.error || 'Unable to initialize checkout session for this application');
          }
        } catch (err: any) {
          setError(err.message || 'Network error connecting to 180 Pay checkout service');
        } finally {
          setInitializing(false);
        }
      };

      initSession();
    }
  }, [querySessionId, appId, planCode, initialAmount, currency, title, couponCode, activeSessionId, initializing]);

  if (activeSessionId) {
    return <CheckoutClient initialSessionId={activeSessionId} />;
  }

  if (initializing) {
    return (
      <div className="w-full py-16 text-center space-y-4 flex flex-col items-center justify-center font-sans">
        <LogoLoader size={44} className="w-11 h-11 text-blue-600" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Initializing Secure Checkout</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Connecting securely to payment gateway...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-10 text-center space-y-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-200/50 dark:border-red-900/50">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Checkout Session Error</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">{error}</p>
        </div>
        <Button
          onClick={() => router.push('/')}
          className="mt-2 w-full py-2.5 rounded-xl bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold"
        >
          Return to 180 Workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full text-center space-y-6 font-sans py-2">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900/50 shadow-2xs">
        <CreditCard className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight">Secure Checkout</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
          Welcome to the checkout gateway. To initiate a secure transaction, use an official payment link or trigger checkout from your application using the 180 Core SDK.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Quick SDK Integration:</span>
        </div>
        <pre className="text-[11px] font-mono text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 overflow-x-auto">
          OneEighty.pay.checkout(&#123;{'\n'}  appId: 'your_app_id',{'\n'}  amount: 499,{'\n'}  planCode: 'pro_monthly'{'\n'}&#125;);
        </pre>
      </div>

      <Button
        onClick={() => router.push('/')}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20"
      >
        <span>Open 180 Profile Dashboard</span>
        <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-16 text-center space-y-4 flex flex-col items-center justify-center font-sans">
          <LogoLoader size={44} className="w-11 h-11 text-blue-600" />
          <p className="text-xs text-slate-500 font-medium">Loading 180 Pay...</p>
        </div>
      }
    >
      <CheckoutEntryPoint />
    </Suspense>
  );
}
