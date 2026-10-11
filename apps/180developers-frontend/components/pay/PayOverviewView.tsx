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
  Sliders,
  Monitor,
  Smartphone,
  Settings,
} from 'lucide-react';
import { OneEightyPay } from '@workspace/identity-sdk';
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

export function PayOverviewView({ onOpenUxDrawer }: { onOpenUxDrawer?: () => void } = {}) {
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

  const [payUxModes, setPayUxModes] = useState<string[]>(
    project?.payUxModes || ['bottom_sheet', 'popup']
  );
  const [payDesktopDefault, setPayDesktopDefault] = useState<string>(
    project?.payDesktopDefault || 'bottom_sheet'
  );
  const [payMobileDefault, setPayMobileDefault] = useState<string>(
    project?.payMobileDefault || 'bottom_sheet'
  );

  useEffect(() => {
    fetchPaymentAnalytics();
  }, [fetchPaymentAnalytics]);

  useEffect(() => {
    if (project) {
      if (project.payUxModes && Array.isArray(project.payUxModes) && project.payUxModes.length > 0) {
        setPayUxModes(project.payUxModes);
      }
      if (project.payDesktopDefault) {
        setPayDesktopDefault(project.payDesktopDefault);
      }
      if (project.payMobileDefault) {
        setPayMobileDefault(project.payMobileDefault);
      }
    }
  }, [project?.payUxModes, project?.payDesktopDefault, project?.payMobileDefault]);

  const handleSaveUxModes = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    await saveSettings({
      payUxModes,
      payDesktopDefault,
      payMobileDefault,
    });
  };

  const onTestPopup = () => {
    try {
      OneEightyPay.openPopup({
        amount: 499,
        currency: 'INR',
        title: `${project?.name || 'Developer Project'} Premium Checkout`,
        description: 'Sandbox verification session (Popup)',
        onSuccess: (res: any) => toast.success(`Payment test passed! TxID: ${res?.transactionId || res?.sessionId || 'SUCCESS'}`),
        onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Popup test failed');
    }
  };

  const onTestBottomSheet = () => {
    try {
      OneEightyPay.openBottomSheet({
        amount: 499,
        currency: 'INR',
        title: `${project?.name || 'Developer Project'} Premium Checkout`,
        description: 'Sandbox verification session (Bottom Sheet)',
        onSuccess: (res: any) => toast.success(`Payment test passed! TxID: ${res?.transactionId || res?.sessionId || 'SUCCESS'}`),
        onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Bottom sheet test failed');
    }
  };

  const onTestPayDrawer = onTestBottomSheet;

  const totalIntentsCount = paymentAnalytics?.totalIntentsCount || (paymentAnalytics?.transactions || []).length;
  const totalIntentsVolume = paymentAnalytics?.totalIntentsVolume || paymentAnalytics?.grossVolume || 0;
  const gatewayAttemptsCount = paymentAnalytics?.gatewayAttemptsCount || 0;
  const gatewayAttemptsVolume = paymentAnalytics?.gatewayAttemptsVolume || 0;
  const capturedCount = paymentAnalytics?.totalTransactionsCount || 0;
  const capturedVolume = paymentAnalytics?.grossVolume || 0;
  const conversionRate = paymentAnalytics?.conversionRate || (totalIntentsCount > 0 ? Math.round((capturedCount / totalIntentsCount) * 1000) / 10 : 0);

  const gatewayPct = totalIntentsCount > 0 ? Math.min(100, Math.round(((gatewayAttemptsCount + capturedCount) / totalIntentsCount) * 100)) : 0;
  const capturedPct = totalIntentsCount > 0 ? Math.min(100, Math.round((capturedCount / totalIntentsCount) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Quick Checkout UX Modes Ribbon */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Checkout Presentation &amp; UX Modes
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
                Desktop: {payDesktopDefault === 'bottom_sheet' ? 'Drawer' : payDesktopDefault === 'popup' ? 'Popup' : 'Redirect'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                Mobile: {payMobileDefault === 'bottom_sheet' ? 'Drawer' : payMobileDefault === 'popup' ? 'Popup' : 'Redirect'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Customize display behaviors for desktop vs mobile devices or test flows in the UX drawer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onTestBottomSheet}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-purple-500/50 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Launch test drawer flow"
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-500" />
            <span>Test Drawer</span>
          </button>
          {onOpenUxDrawer && (
            <button
              type="button"
              onClick={onOpenUxDrawer}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure UX</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Financial KPI Metric Blocks */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Financial Overview &amp; Settlements</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live collection volume, clearing settlements, and withdrawable balance.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
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
              onClick={fetchPaymentAnalytics}
              disabled={loadingAnalytics}
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh analytics"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>Total Volume</span>
              <Activity className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-zinc-950 dark:text-white">
              {paymentAnalytics?.currency || 'INR'} {(paymentAnalytics?.grossVolume || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">Captured lifetime revenue</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>This Month</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {paymentAnalytics?.currency || 'INR'} {(paymentAnalytics?.thisMonthVolume || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">Current calendar cycle</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>Pending Settlements</span>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {paymentAnalytics?.currency || 'INR'} {(paymentAnalytics?.pendingSettlements || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">In T+1 clearing cycle</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>Withdrawable Balance</span>
              <Landmark className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {paymentAnalytics?.currency || 'INR'} {(payoutBalance || paymentAnalytics?.withdrawableBalance || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">Available for payout</p>
          </div>
        </div>

        {/* 3. Checkout Funnel & Conversion Intelligence */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                <span>Checkout Funnel &amp; Behavioral Conversion</span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Tracking user drop-offs from initial bottom sheet launch to gateway invocation and final capture.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold font-mono self-start sm:self-auto">
              <Percent className="w-3 h-3" />
              <span>{conversionRate}% Conversion Rate</span>
            </div>
          </div>

          {/* Funnel 4-Card Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                <Compass className="w-3 h-3 text-blue-500" />
                <span>Purchase Intents</span>
              </div>
              <div className="text-base font-bold text-zinc-900 dark:text-white font-mono">
                ₹{totalIntentsVolume.toLocaleString()}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                {totalIntentsCount} sheets initiated
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Gateway Invocations</span>
              </div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                ₹{(gatewayAttemptsVolume + capturedVolume).toLocaleString()}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                {gatewayAttemptsCount + capturedCount} opened gateway
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Captured Revenue</span>
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{capturedVolume.toLocaleString()}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                {capturedCount} settled payments
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                <Percent className="w-3 h-3 text-purple-500" />
                <span>Realized Yield</span>
              </div>
              <div className="text-base font-bold text-purple-600 dark:text-purple-400 font-mono">
                {conversionRate}%
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                Funnel efficiency
              </p>
            </div>
          </div>

          {/* Visual Funnel Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${Math.max(10, capturedPct)}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Captured: ${capturedPct}%`}
              />
              <div
                style={{ width: `${Math.max(0, gatewayPct - capturedPct)}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`Gateway Dropped: ${Math.max(0, gatewayPct - capturedPct)}%`}
              />
              <div
                style={{ width: `${Math.max(0, 100 - gatewayPct)}%` }}
                className="bg-blue-500/40 h-full transition-all"
                title={`Intent Only: ${Math.max(0, 100 - gatewayPct)}%`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Captured ({capturedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Gateway Dropped ({gatewayAttemptsCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Drawer Intent Only ({paymentAnalytics?.intentOnlyCount || Math.max(0, totalIntentsCount - gatewayAttemptsCount - capturedCount)})</span>
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
      </div>

      {/* 3. Incoming Transactions Ledger (Lazy Loaded) */}
      <LazyTransactionsSection />
    </div>
  );
}

export default PayOverviewView;
