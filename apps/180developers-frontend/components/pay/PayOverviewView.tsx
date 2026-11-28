'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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
  Landmark,
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
    projectId,
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

  const [chartFilter, setChartFilter] = useState<'7d' | '30d' | '12m'>('7d');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

  // Captured Payments Frequency Curve Data for 7D, 30D, and 12M
  const chartData = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curDate = now.getDate();
    const txList = paymentAnalytics?.transactions || [];

    const isCaptured = (tx: any) => tx.status === 'CAPTURED' || tx.status === 'SUCCESS';

    // 1. Last 7 Days (Default View)
    const points7d: Array<{ label: string; axisLabel: string; volume: number; count: number; isCurrent: boolean }> = [];
    let vol7d = 0;
    let count7d = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(curYear, curMonth, curDate - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const dt = d.getDate();
      const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const axisLabel = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

      let dayVol = 0;
      let dayCount = 0;
      txList.forEach((tx) => {
        if (isCaptured(tx)) {
          const txD = new Date(tx.createdAt);
          if (txD.getFullYear() === y && txD.getMonth() === m && txD.getDate() === dt) {
            dayVol += Number(tx.amount || 0);
            dayCount += 1;
          }
        }
      });

      vol7d += dayVol;
      count7d += dayCount;
      points7d.push({
        label,
        axisLabel,
        volume: dayVol,
        count: dayCount,
        isCurrent: i === 0,
      });
    }

    // Fallback: If no individual transactions found in txList, but capturedVolume > 0
    if (vol7d === 0 && capturedVolume > 0) {
      points7d[points7d.length - 1].volume = capturedVolume;
      points7d[points7d.length - 1].count = capturedCount || 1;
      vol7d = capturedVolume;
      count7d = capturedCount || 1;
    }

    // 2. Last 30 Days (Monthly View)
    const points30d: Array<{ label: string; axisLabel: string; volume: number; count: number; isCurrent: boolean }> = [];
    let vol30d = 0;
    let count30d = 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(curYear, curMonth, curDate - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const dt = d.getDate();
      const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const axisLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let dayVol = 0;
      let dayCount = 0;
      txList.forEach((tx) => {
        if (isCaptured(tx)) {
          const txD = new Date(tx.createdAt);
          if (txD.getFullYear() === y && txD.getMonth() === m && txD.getDate() === dt) {
            dayVol += Number(tx.amount || 0);
            dayCount += 1;
          }
        }
      });

      vol30d += dayVol;
      count30d += dayCount;
      points30d.push({
        label,
        axisLabel,
        volume: dayVol,
        count: dayCount,
        isCurrent: i === 0,
      });
    }

    if (vol30d === 0 && (paymentAnalytics?.thisMonthVolume || capturedVolume > 0)) {
      const fallback = paymentAnalytics?.thisMonthVolume || capturedVolume;
      points30d[points30d.length - 1].volume = fallback;
      points30d[points30d.length - 1].count = capturedCount || 1;
      vol30d = fallback;
      count30d = capturedCount || 1;
    }

    // 3. Last 12 Months
    const points12m: Array<{ label: string; axisLabel: string; volume: number; count: number; isCurrent: boolean }> = [];
    let vol12m = 0;
    let count12m = 0;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const axisLabel = d.toLocaleDateString('en-US', { month: 'short' });

      let mVol = 0;
      let mCount = 0;
      txList.forEach((tx) => {
        if (isCaptured(tx)) {
          const txD = new Date(tx.createdAt);
          if (txD.getFullYear() === y && txD.getMonth() === m) {
            mVol += Number(tx.amount || 0);
            mCount += 1;
          }
        }
      });

      if (i === 0 && mVol === 0) {
        mVol = vol30d || capturedVolume;
        mCount = count30d || capturedCount;
      } else if (i === 1 && mVol === 0 && paymentAnalytics?.lastMonthVolume) {
        mVol = paymentAnalytics.lastMonthVolume;
      }

      vol12m += mVol;
      count12m += mCount;
      points12m.push({
        label,
        axisLabel,
        volume: mVol,
        count: mCount,
        isCurrent: i === 0,
      });
    }

    return {
      '7d': {
        points: points7d,
        totalVolume: vol7d,
        totalCount: count7d,
        title: 'Captured Payments Frequency (Last 7 Days)',
        periodLabel: 'Last 7 Days',
      },
      '30d': {
        points: points30d,
        totalVolume: vol30d,
        totalCount: count30d,
        title: 'Captured Payments Frequency (Last 30 Days)',
        periodLabel: 'Last 30 Days',
      },
      '12m': {
        points: points12m,
        totalVolume: vol12m,
        totalCount: count12m,
        title: 'Captured Payments Frequency (Last 12 Months)',
        periodLabel: 'Last 12 Months',
      },
    };
  }, [paymentAnalytics, capturedVolume, capturedCount]);

  const currentDataset = chartData[chartFilter];
  const { points: currentPoints, totalVolume: currentTotalVolume, totalCount: currentTotalCount, title: currentChartTitle, periodLabel: currentPeriodLabel } = currentDataset;

  const maxVal = Math.max(...currentPoints.map((p) => p.volume), 0.01);
  const baselineY = 205;
  const graphHeight = 175;
  const paddingX = 0;
  const graphWidth = 800;

  const coords = currentPoints.map((p, i) => {
    const x = (i / Math.max(currentPoints.length - 1, 1)) * graphWidth;
    const normalized = p.volume / maxVal;
    const y = baselineY - normalized * graphHeight;
    return { ...p, x, y };
  });

  const getSmoothCurvePaths = (points: Array<{ x: number; y: number }>, base: number) => {
    if (!points || points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      const linePath = `M 0 ${p.y} L 800 ${p.y}`;
      const areaPath = `M 0 ${base} L 0 ${p.y} L 800 ${p.y} L 800 ${base} Z`;
      return { linePath, areaPath };
    }

    let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;

      const clampedCp1y = Math.min(base, Math.max(15, cp1y));
      const clampedCp2y = Math.min(base, Math.max(15, cp2y));

      linePath += ` C ${cp1x.toFixed(1)} ${clampedCp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${clampedCp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${base} L ${first.x.toFixed(1)} ${base} Z`;

    return { linePath, areaPath };
  };

  const { linePath, areaPath } = getSmoothCurvePaths(coords, baselineY);
  const hoveredPoint = hoveredIdx !== null && coords[hoveredIdx] ? coords[hoveredIdx] : null;

  return (
    <div className="space-y-6">
      {/* Payment Rails & Receiving UPI Quick Configuration Banner */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/[0.07] via-indigo-500/[0.04] to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-950 dark:text-white">
                Payment Rails &amp; Direct UPI Setup
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                (project as any)?.enableDirectUpi !== false
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                {(project as any)?.enableDirectUpi !== false ? 'Direct UPI Ready' : 'UPI Disabled'}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {((project as any)?.customUpiId)
                ? `Receiving UPI ID: ${(project as any).customUpiId}. Configure Direct Native UPI or 180 Pay Gateway processing.`
                : 'No receiving UPI ID configured yet. Add your UPI ID to accept Direct Native UPI payments or configure 180 Pay Gateway.'}
            </p>
          </div>
        </div>

        <Link
          href={`/apps/${projectId}/pay/gateways`}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <span>Configure Rails</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

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

      {/* 4. Captured Payments Frequency Graph (Area / Spline Curve with 7d / 30d / 12m filters) */}
      <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 overflow-hidden shadow-sm flex flex-col">
        {/* Card Header with Filters */}
        <div className="p-5 sm:p-6 pb-4 border-b border-zinc-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                {currentChartTitle}
              </h3>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
              {hoveredPoint ? (
                <span>
                  <strong className="text-purple-600 dark:text-purple-400">{hoveredPoint.label}:</strong>{' '}
                  {formatAmount(hoveredPoint.volume, baseCurrency)} across {hoveredPoint.count} payment{hoveredPoint.count === 1 ? '' : 's'}
                </span>
              ) : (
                <span>
                  {formatAmount(currentTotalVolume, baseCurrency)} processed across {currentTotalCount} payment{currentTotalCount === 1 ? '' : 's'} ({currentPeriodLabel})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setChartFilter('7d');
                  setHoveredIdx(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  chartFilter === '7d'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartFilter('30d');
                  setHoveredIdx(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  chartFilter === '30d'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartFilter('12m');
                  setHoveredIdx(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  chartFilter === '12m'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                12 Months
              </button>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 hidden md:inline">180 Pay Engine</span>
          </div>
        </div>

        {/* Edge-to-Edge Full-Area Interactive Chart Canvas */}
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-transparent to-purple-500/[0.03]">
          {/* Floating Tooltip Card */}
          {hoveredPoint && (
            <div
              style={{
                left: `${Math.min(90, Math.max(10, (hoveredPoint.x / 800) * 100))}%`,
                top: `${(Math.max(hoveredPoint.y - 15, 20) / 250) * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-20"
            >
              <div className="bg-zinc-900/95 dark:bg-zinc-800/95 text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 backdrop-blur-md whitespace-nowrap text-xs space-y-0.5">
                <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between gap-3">
                  <span>{hoveredPoint.label}</span>
                  {hoveredPoint.isCurrent && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-semibold">
                      Current
                    </span>
                  )}
                </div>
                <div className="font-bold text-sm text-purple-400 font-mono">
                  {formatAmount(hoveredPoint.volume, baseCurrency)}
                </div>
                <div className="text-[10px] text-zinc-300 font-mono">
                  {hoveredPoint.count} captured payment{hoveredPoint.count === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          )}

          <div className="w-full">
            <svg
              viewBox="0 0 800 250"
              preserveAspectRatio="none"
              className="w-full h-64 sm:h-72 md:h-80 cursor-crosshair block"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (!rect.width) return;
                const mouseX = ((e.clientX - rect.left) / rect.width) * 800;
                let closestIdx = 0;
                let minDist = Infinity;
                coords.forEach((c, idx) => {
                  const dist = Math.abs(c.x - mouseX);
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = idx;
                  }
                });
                setHoveredIdx(closestIdx);
              }}
              onMouseLeave={() => setHoveredIdx(null)}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                const rect = e.currentTarget.getBoundingClientRect();
                if (!rect.width) return;
                const mouseX = ((touch.clientX - rect.left) / rect.width) * 800;
                let closestIdx = 0;
                let minDist = Infinity;
                coords.forEach((c, idx) => {
                  const dist = Math.abs(c.x - mouseX);
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = idx;
                  }
                });
                setHoveredIdx(closestIdx);
              }}
              onTouchEnd={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="freqAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.55" />
                  <stop offset="35%" stopColor="#8b5cf6" stopOpacity="0.30" />
                  <stop offset="70%" stopColor="#6366f1" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="freqLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="35%" stopColor="#8b5cf6" />
                  <stop offset="70%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
                <linearGradient id="chartBackdropGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Subtle Full-Chart Ambient Backdrop */}
              <rect x="0" y="0" width="800" height={baselineY} fill="url(#chartBackdropGrad)" pointerEvents="none" />

              {/* Horizontal Reference Gridlines across 100% Width */}
              <line
                x1="0"
                y1={baselineY - graphHeight}
                x2="800"
                y2={baselineY - graphHeight}
                stroke="currentColor"
                className="text-zinc-200/80 dark:text-zinc-800/80"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1={baselineY - graphHeight / 2}
                x2="800"
                y2={baselineY - graphHeight / 2}
                stroke="currentColor"
                className="text-zinc-200/80 dark:text-zinc-800/80"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1="0"
                y1={baselineY}
                x2="800"
                y2={baselineY}
                stroke="currentColor"
                className="text-zinc-300 dark:text-zinc-700"
                strokeWidth="1.5"
              />

              {/* Y-Axis Floating Value Labels */}
              <text
                x="16"
                y={baselineY - graphHeight - 6}
                className="text-[10px] font-mono fill-zinc-500 dark:fill-zinc-400 font-semibold"
              >
                {formatAmount(maxVal, baseCurrency)}
              </text>
              <text
                x="16"
                y={baselineY - graphHeight / 2 - 6}
                className="text-[10px] font-mono fill-zinc-400 dark:fill-zinc-500 font-medium"
              >
                {formatAmount(maxVal / 2, baseCurrency)}
              </text>
              <text
                x="16"
                y={baselineY - 6}
                className="text-[10px] font-mono fill-zinc-400 dark:fill-zinc-500 font-medium"
              >
                {formatAmount(0, baseCurrency)}
              </text>

              {/* Filled Frequency Area (Full Bleed from Left to Right) */}
              {areaPath && (
                <path d={areaPath} fill="url(#freqAreaGrad)" className="transition-all duration-300" />
              )}

              {/* Smooth Frequency Line Stroke */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#freqLineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
              )}

              {/* Vertical Hover Guide Line */}
              {hoveredPoint && (
                <line
                  x1={hoveredPoint.x}
                  y1={baselineY - graphHeight}
                  x2={hoveredPoint.x}
                  y2={baselineY}
                  stroke="#8b5cf6"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity="0.85"
                />
              )}

              {/* Data Nodes & Halo Accents */}
              {coords.map((c, i) => {
                const isHovered = hoveredIdx === i;
                const hasActivity = c.volume > 0;
                if (!hasActivity && !isHovered && !c.isCurrent) return null;
                return (
                  <g key={i} className="transition-all duration-150">
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isHovered ? 10 : 6.5}
                      fill="#8b5cf6"
                      opacity={isHovered ? 0.4 : 0.22}
                    />
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isHovered ? 5 : 3.8}
                      fill="#ffffff"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}

              {/* X-Axis Tick Labels with Edge Margin Protection */}
              {coords.map((c, i) => {
                let showLabel = false;
                if (chartFilter === '7d' || chartFilter === '12m') {
                  showLabel = true;
                } else if (chartFilter === '30d') {
                  showLabel = i === 0 || i % 5 === 0 || i === coords.length - 1 || c.isCurrent;
                }
                if (!showLabel) return null;

                const isHovered = hoveredIdx === i;
                const isCurrent = c.isCurrent;

                let labelX = c.x;
                let textAnchor: 'start' | 'middle' | 'end' = 'middle';
                if (i === 0) {
                  labelX = 16;
                  textAnchor = 'start';
                } else if (i === coords.length - 1) {
                  labelX = 784;
                  textAnchor = 'end';
                }

                return (
                  <text
                    key={i}
                    x={labelX}
                    y={232}
                    textAnchor={textAnchor}
                    className={`text-[10px] font-mono transition-colors ${
                      isHovered || isCurrent
                        ? 'fill-purple-600 dark:fill-purple-400 font-bold'
                        : 'fill-zinc-500 dark:fill-zinc-400'
                    }`}
                  >
                    {c.axisLabel}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Bottom Legend and Metric Strip */}
        <div className="px-5 sm:px-6 py-3.5 bg-zinc-100/70 dark:bg-zinc-950/40 border-t border-zinc-200/60 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="font-semibold text-zinc-900 dark:text-white">Captured Frequency &amp; Volume</span>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span>Peak: <strong className="text-zinc-900 dark:text-white">{formatAmount(maxVal, baseCurrency)}</strong></span>
            <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">{formatAmount(currentTotalVolume, baseCurrency)}</strong></span>
            <span>Payments: <strong className="text-purple-600 dark:text-purple-400">{currentTotalCount}</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Incoming Transactions Ledger (Lazy Loaded) */}
      <LazyTransactionsSection />
    </div>
  );
}

export default PayOverviewView;
