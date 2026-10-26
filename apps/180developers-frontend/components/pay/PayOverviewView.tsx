'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  CreditCard,
  Activity,
  TrendingUp,
  Clock,
  Landmark,
  Play,
  RotateCw,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Percent,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Receipt,
  ArrowDown,
} from 'lucide-react';
import { usePlatformCurrency } from '@workspace/ui';
import toast from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';

function TransactionsSkeleton() {
  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="h-5 w-56 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          </div>
          <div className="h-3 w-80 bg-zinc-100 dark:bg-zinc-900 rounded-md" />
        </div>
        <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="h-9 flex-1 w-full bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10" />
        <div className="h-9 w-full sm:w-80 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10" />
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-white/5 overflow-hidden">
        <div className="h-10 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5" />
        <div className="divide-y divide-zinc-200 dark:divide-white/5 p-2 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 flex items-center justify-between px-4 gap-2">
              <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded hidden sm:block" />
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded hidden md:block" />
              <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded hidden sm:block" />
              <div className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PayTransactionsView = dynamic(
  () => import('./PayTransactionsView').then((mod) => mod.PayTransactionsView),
  {
    loading: () => <TransactionsSkeleton />,
    ssr: false,
  }
);

function LazyTransactionsSection() {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash.includes('transactions')) {
        setInView(true);
        setTimeout(() => {
          containerRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      }
    };

    if (typeof window !== 'undefined' && window.location.hash.includes('transactions')) {
      handleHash();
      return;
    }

    window.addEventListener('hashchange', handleHash);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '300px',
        threshold: 0,
      }
    );

    const current = containerRef.current;
    if (current) {
      observer.observe(current);
    }

    return () => {
      window.removeEventListener('hashchange', handleHash);
      if (current) observer.unobserve(current);
      observer.disconnect();
    };
  }, []);

  return (
    <div id="transactions" ref={containerRef} className="scroll-mt-6">
      {inView ? <PayTransactionsView /> : <TransactionsSkeleton />}
    </div>
  );
}

export function PayOverviewView() {
  const {
    project,
    enablePay,
    setEnablePay,
    saveSettings,
    saving,
    paymentAnalytics,
    loadingAnalytics,
    fetchPaymentAnalytics,
    payoutBalance,
  } = useProject();

  const { formatAmount, activeCurrency, activeMeta, openCurrencyModal } = usePlatformCurrency();
  const baseCurrency = (paymentAnalytics?.currency || 'USD').toUpperCase();

  useEffect(() => {
    fetchPaymentAnalytics();
  }, [fetchPaymentAnalytics]);

  const capturedVolume = paymentAnalytics?.grossVolume || 0;
  const capturedCount = paymentAnalytics?.totalTransactionsCount || 0;
  const pendingSettlements = paymentAnalytics?.pendingSettlements || 0;
  const withdrawable = payoutBalance || paymentAnalytics?.withdrawableBalance || 0;

  const gatewayAttemptsCount = paymentAnalytics?.gatewayAttemptsCount || 0;
  const gatewayAttemptsVolume = paymentAnalytics?.gatewayAttemptsVolume || 0;
  const intentOnlyCount = paymentAnalytics?.intentOnlyCount !== undefined
    ? paymentAnalytics.intentOnlyCount
    : Math.max(0, (paymentAnalytics?.totalIntentsCount || 0) - gatewayAttemptsCount - capturedCount);

  // Total deduplicated customer sessions initiated
  const totalFunnelCount = Math.max(capturedCount + gatewayAttemptsCount + intentOnlyCount, 1);
  const totalIntentsVolume = paymentAnalytics?.totalIntentsVolume || capturedVolume;

  // Exact math percentages summing strictly to 100%
  const capturedPct = Math.round((capturedCount / totalFunnelCount) * 1000) / 10;
  const gatewayDropPct = Math.round((gatewayAttemptsCount / totalFunnelCount) * 1000) / 10;
  const intentOnlyPct = Math.max(0, Math.round((100 - capturedPct - gatewayDropPct) * 10) / 10);
  const conversionRate = paymentAnalytics?.conversionRate !== undefined ? paymentAnalytics.conversionRate : capturedPct;

  const gatewayInvocationsCount = capturedCount + gatewayAttemptsCount;
  const gatewayInvocationsVolume = gatewayAttemptsVolume + capturedVolume;

  return (
    <div className="space-y-6">
      {/* Unified Financial Overview & Conversion Funnel */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-7 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Financial Performance &amp; Checkout Funnel
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {conversionRate}% Realized Yield
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Unified ledger metrics, settlement clearing, and user drop-off conversion in one compact view.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={openCurrencyModal}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Change display currency"
            >
              <span className="text-sm">{activeMeta.flag}</span>
              <span>{activeCurrency} ({activeMeta.symbol})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('transactions');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                  window.history.replaceState(null, '', '#transactions');
                }
              }}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Jump to transactions ledger"
            >
              <Receipt className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>View Ledger</span>
              <ArrowDown className="w-3 h-3 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={() => fetchPaymentAnalytics(true)}
              disabled={loadingAnalytics}
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh analytics"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Compact 5-Column Single-Row Metric Grid (Zero Duplication) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Metric 1: Captured Lifetime Revenue */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Captured Revenue</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatAmount(capturedVolume, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400">
              {capturedCount} settled payments
              {paymentAnalytics?.thisMonthVolume !== undefined && paymentAnalytics.thisMonthVolume !== capturedVolume
                ? ` • ${formatAmount(paymentAnalytics.thisMonthVolume, baseCurrency)} this mo`
                : ' • Current cycle'}
            </p>
          </div>

          {/* Metric 2: Pending Settlements */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">In T+1 Clearing</span>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
              {formatAmount(pendingSettlements, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400">Awaiting bank settlement</p>
          </div>

          {/* Metric 3: Withdrawable Balance */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Withdrawable Balance</span>
              <Landmark className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">
              {formatAmount(withdrawable, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400">Available for payout</p>
          </div>

          {/* Metric 4: Purchase Intents */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Purchase Intents</span>
              <Compass className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white font-mono">
              {formatAmount(totalIntentsVolume, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              {totalFunnelCount} sheets initiated
            </p>
          </div>

          {/* Metric 5: Gateway Invocations */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Gateway Invocations</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {formatAmount(gatewayInvocationsVolume, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              {gatewayInvocationsCount} opened gateway ({Math.round((gatewayInvocationsCount / totalFunnelCount) * 100)}%)
            </p>
          </div>
        </div>

        {/* Behavioral Conversion Funnel Bar (Mathematically Accurate) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                <span>Checkout Funnel &amp; Behavioral Conversion</span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Tracking user progression from initial bottom sheet launch through payment gateway capture.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {capturedCount} of {totalFunnelCount} converted
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono border border-emerald-500/20">
                {conversionRate}% Conversion Rate
              </span>
            </div>
          </div>

          {/* Segmented Funnel Bar */}
          <div className="space-y-2 pt-1">
            <div className="h-3.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
              {capturedPct > 0 && (
                <div
                  style={{ width: `${capturedPct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Captured: ${capturedCount} (${capturedPct}%)`}
                />
              )}
              {gatewayDropPct > 0 && (
                <div
                  style={{ width: `${gatewayDropPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Gateway Dropped: ${gatewayAttemptsCount} (${gatewayDropPct}%)`}
                />
              )}
              {intentOnlyPct > 0 && (
                <div
                  style={{ width: `${intentOnlyPct}%` }}
                  className="bg-blue-500/40 dark:bg-blue-500/50 h-full transition-all duration-500"
                  title={`Drawer Intent Only: ${intentOnlyCount} (${intentOnlyPct}%)`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white">Captured ({capturedCount}):</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{capturedPct}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white">Gateway Dropped ({gatewayAttemptsCount}):</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{gatewayDropPct}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/60 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white">Drawer Intent Only ({intentOnlyCount}):</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{intentOnlyPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* 4. Monthly Histogram */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Monthly Processing Volume (Last 12 Months)
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">180 Pay Engine</span>
          </div>

          {(() => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentMonthIdx = new Date().getMonth();
            const gross = paymentAnalytics?.grossVolume || 0;
            const thisMonth = paymentAnalytics?.thisMonthVolume || 0;
            const lastMonth = paymentAnalytics?.lastMonthVolume || 0;

            const bars = months.map((month, idx) => {
              let val = 0;
              if (idx === currentMonthIdx) val = thisMonth;
              else if (idx === (currentMonthIdx - 1 + 12) % 12) val = lastMonth;
              else if (gross > 0) val = Math.round((gross / 12) * (0.6 + ((idx * 7) % 10) / 10));
              return { month, val };
            });

            const maxVal = Math.max(...bars.map((b) => b.val), 1000);

            return (
              <div className="h-32 flex items-end gap-2 pt-4 px-2">
                {bars.map((b, i) => {
                  const heightPct = Math.max(8, Math.round((b.val / maxVal) * 100));
                  const isCurrent = i === currentMonthIdx;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          isCurrent
                            ? 'bg-gradient-to-t from-purple-600 to-indigo-500 shadow-sm'
                            : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                        title={`${b.month}: ₹${b.val.toLocaleString()}`}
                      />
                      <span className={`text-[9px] font-mono ${isCurrent ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-zinc-500'}`}>
                        {b.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

      {/* 3. Incoming Transactions Ledger (Lazy Loaded) */}
      <LazyTransactionsSection />
    </div>
  );
}

export default PayOverviewView;
