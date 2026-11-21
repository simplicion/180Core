'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  CreditCard,
  Activity,
  TrendingUp,
  Play,
  RotateCw,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Percent,
  BarChart3,
  Calendar,
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

  const [chartView, setChartView] = useState<'current-month' | '12-months'>('current-month');

  useEffect(() => {
    fetchPaymentAnalytics();
  }, [fetchPaymentAnalytics]);

  const capturedVolume = paymentAnalytics?.grossVolume || 0;
  const capturedCount = paymentAnalytics?.totalTransactionsCount || 0;

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

  // Real Current Month Daily Activity & Rolling 12-Month Volume Breakdown
  const { currentMonthDaily, currentMonthTotal, currentMonthCount, last12MonthsData, currentMonthName, currentYearNum } = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();
    const daysInCurMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const monthShort = now.toLocaleString('en-US', { month: 'short' });

    const daily = Array.from({ length: daysInCurMonth }, (_, i) => ({
      day: i + 1,
      volume: 0,
      count: 0,
      isToday: i + 1 === curDate,
      isFuture: i + 1 > curDate,
      dateLabel: `${monthShort} ${i + 1}`,
    }));

    let curMoVol = 0;
    let curMoCount = 0;

    const txList = paymentAnalytics?.transactions || [];
    txList.forEach((tx) => {
      if (tx.status === 'CAPTURED' || tx.status === 'SUCCESS') {
        const d = new Date(tx.createdAt);
        if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
          const dayIdx = d.getDate() - 1;
          if (dayIdx >= 0 && dayIdx < daysInCurMonth) {
            const amt = Number(tx.amount || 0);
            daily[dayIdx].volume += amt;
            daily[dayIdx].count += 1;
            curMoVol += amt;
            curMoCount += 1;
          }
        }
      }
    });

    // Fallback: If no individual captured transactions matched the current month,
    // but the backend reports thisMonthVolume or capturedVolume > 0, reflect it on today's bar
    const fallbackVol = paymentAnalytics?.thisMonthVolume ?? capturedVolume;
    if (curMoVol === 0 && fallbackVol > 0) {
      const todayIdx = Math.min(curDate - 1, daysInCurMonth - 1);
      daily[todayIdx].volume = fallbackVol;
      daily[todayIdx].count = capturedCount || 1;
      curMoVol = fallbackVol;
      curMoCount = capturedCount || 1;
    }

    // Last 12 months rolling data using real transaction aggregation
    const last12 = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(curYear, curMonth - i, 1);
      const tYear = targetDate.getFullYear();
      const tMonth = targetDate.getMonth();
      const label = targetDate.toLocaleString('en-US', { month: 'short' });
      let vol = 0;
      let cnt = 0;

      txList.forEach((tx) => {
        if (tx.status === 'CAPTURED' || tx.status === 'SUCCESS') {
          const d = new Date(tx.createdAt);
          if (d.getFullYear() === tYear && d.getMonth() === tMonth) {
            vol += Number(tx.amount || 0);
            cnt += 1;
          }
        }
      });

      if (i === 0 && vol === 0) {
        vol = curMoVol;
        cnt = curMoCount;
      } else if (i === 1 && vol === 0 && paymentAnalytics?.lastMonthVolume) {
        vol = paymentAnalytics.lastMonthVolume;
      }

      last12.push({
        month: label,
        year: tYear,
        volume: vol,
        count: cnt,
        isCurrent: i === 0,
      });
    }

    return {
      currentMonthDaily: daily,
      currentMonthTotal: curMoVol,
      currentMonthCount: curMoCount,
      last12MonthsData: last12,
      currentMonthName: monthName,
      currentYearNum: curYear,
    };
  }, [paymentAnalytics, capturedVolume, capturedCount]);

  return (
    <div className="space-y-6">
      {/* Unified Financial Overview & Conversion Funnel */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-7 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Payments &amp; Conversion Overview
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {conversionRate}% Success Rate
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Summary of your collected payments, customer intents, and checkout conversion.
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

        {/* Compact 3-Column Single-Row Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Metric 1: Payments Collected */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Payments Collected</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatAmount(capturedVolume, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400">
              {capturedCount} successful payments
              {paymentAnalytics?.thisMonthVolume !== undefined && paymentAnalytics.thisMonthVolume !== capturedVolume
                ? ` • ${formatAmount(paymentAnalytics.thisMonthVolume, baseCurrency)} this mo`
                : ' • Current cycle'}
            </p>
          </div>

          {/* Metric 2: Checkouts Started */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Checkouts Started</span>
              <Compass className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white font-mono">
              {formatAmount(totalIntentsVolume, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              {totalFunnelCount} checkout sheets opened
            </p>
          </div>

          {/* Metric 3: Proceeded to Pay */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Proceeded to Pay</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {formatAmount(gatewayInvocationsVolume, baseCurrency)}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              {gatewayInvocationsCount} reached gateway ({Math.round((gatewayInvocationsCount / totalFunnelCount) * 100)}%)
            </p>
          </div>
        </div>

        {/* Behavioral Conversion Funnel Bar (Mathematically Accurate) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                <span>Payment Success Funnel</span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                See how customers move from opening checkout to paying successfully.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {capturedCount} of {totalFunnelCount} completed
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono border border-emerald-500/20">
                {conversionRate}% Success Rate
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
                  title={`Successful Payments: ${capturedCount} (${capturedPct}%)`}
                />
              )}
              {gatewayDropPct > 0 && (
                <div
                  style={{ width: `${gatewayDropPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-500"
                  title={`Dropped at Payment: ${gatewayAttemptsCount} (${gatewayDropPct}%)`}
                />
              )}
              {intentOnlyPct > 0 && (
                <div
                  style={{ width: `${intentOnlyPct}%` }}
                  className="bg-blue-500/40 dark:bg-blue-500/50 h-full transition-all duration-500"
                  title={`Opened Checkout Only: ${intentOnlyCount} (${intentOnlyPct}%)`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white">Successful ({capturedCount}):</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{capturedPct}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white">Dropped at Payment ({gatewayAttemptsCount}):</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{gatewayDropPct}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500/60 shrink-0" />
                <span className="font-semibold text-zinc-900 dark:text-white">Opened Checkout Only ({intentOnlyCount}):</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{intentOnlyPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Processing Volume Histogram (Current Month by default, with Last 12 Months toggle) */}
      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                {chartView === 'current-month'
                  ? `Current Month Processing Volume (${currentMonthName} ${currentYearNum})`
                  : 'Monthly Processing Volume (Last 12 Months)'}
              </h3>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
              {chartView === 'current-month'
                ? `${formatAmount(currentMonthTotal, baseCurrency)} processed across ${currentMonthCount} payment${currentMonthCount === 1 ? '' : 's'} this month`
                : `${formatAmount(capturedVolume, baseCurrency)} gross volume across ${capturedCount} payment${capturedCount === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => setChartView('current-month')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  chartView === 'current-month'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setChartView('12-months')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  chartView === '12-months'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Last 12 Months
              </button>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 hidden md:inline">180 Pay Engine</span>
          </div>
        </div>

        {chartView === 'current-month' ? (
          (() => {
            const maxDailyVal = Math.max(...currentMonthDaily.map((d) => d.volume), 0.01);
            return (
              <div className="space-y-2">
                <div className="h-36 flex items-end gap-1 sm:gap-1.5 pt-4 px-1 sm:px-2 overflow-x-auto">
                  {currentMonthDaily.map((d) => {
                    const heightPct = d.volume > 0
                      ? Math.max(14, Math.min(100, Math.round((d.volume / maxDailyVal) * 100)))
                      : 4;
                    return (
                      <div
                        key={d.day}
                        className="flex-1 min-w-[8px] sm:min-w-[12px] flex flex-col items-center gap-1.5 group relative"
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-sm sm:rounded-t-md transition-all duration-300 relative ${
                            d.volume > 0
                              ? 'bg-gradient-to-t from-purple-600 to-indigo-500 shadow-sm shadow-purple-500/25 ring-1 ring-purple-400/30'
                              : d.isToday
                              ? 'bg-purple-500/20 border-t-2 border-purple-500'
                              : d.isFuture
                              ? 'bg-zinc-200/40 dark:bg-zinc-800/20'
                              : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                          }`}
                          title={`${d.dateLabel}: ${formatAmount(d.volume, baseCurrency)} (${d.count} payment${d.count === 1 ? '' : 's'})${d.isToday ? ' • Today' : ''}`}
                        />
                        <span
                          className={`text-[8px] sm:text-[9px] font-mono leading-none ${
                            d.isToday
                              ? 'text-purple-600 dark:text-purple-400 font-bold'
                              : d.volume > 0
                              ? 'text-zinc-700 dark:text-zinc-300 font-semibold'
                              : 'text-zinc-400 dark:text-zinc-500'
                          } ${
                            d.day === 1 || d.day % 5 === 0 || d.day === currentMonthDaily.length || d.isToday
                              ? 'block'
                              : 'hidden sm:block'
                          }`}
                        >
                          {d.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-500 px-2 pt-1 border-t border-zinc-200/60 dark:border-white/5">
                  <span>Day 1 ({currentMonthDaily[0]?.dateLabel})</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">
                    Daily Activity for {currentMonthName} {currentYearNum}
                  </span>
                  <span>Day {currentMonthDaily.length} ({currentMonthDaily[currentMonthDaily.length - 1]?.dateLabel})</span>
                </div>
              </div>
            );
          })()
        ) : (
          (() => {
            const maxMonthlyVal = Math.max(...last12MonthsData.map((m) => m.volume), 0.01);
            return (
              <div className="space-y-2">
                <div className="h-36 flex items-end gap-2 pt-4 px-2">
                  {last12MonthsData.map((m, i) => {
                    const heightPct = m.volume > 0
                      ? Math.max(14, Math.min(100, Math.round((m.volume / maxMonthlyVal) * 100)))
                      : 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            m.isCurrent
                              ? 'bg-gradient-to-t from-purple-600 to-indigo-500 shadow-sm shadow-purple-500/25 ring-1 ring-purple-400/30'
                              : m.volume > 0
                              ? 'bg-indigo-600/70 dark:bg-indigo-500/70 hover:bg-indigo-600'
                              : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                          }`}
                          title={`${m.month} ${m.year}: ${formatAmount(m.volume, baseCurrency)} (${m.count} payments)`}
                        />
                        <span
                          className={`text-[9px] font-mono ${
                            m.isCurrent ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-zinc-500'
                          }`}
                        >
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 dark:text-zinc-500 px-2 pt-1 border-t border-zinc-200/60 dark:border-white/5">
                  <span>{last12MonthsData[0]?.month} {last12MonthsData[0]?.year}</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">12-Month Trend</span>
                  <span>{last12MonthsData[last12MonthsData.length - 1]?.month} {last12MonthsData[last12MonthsData.length - 1]?.year}</span>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* 3. Incoming Transactions Ledger (Lazy Loaded) */}
      <LazyTransactionsSection />
    </div>
  );
}

export default PayOverviewView;
