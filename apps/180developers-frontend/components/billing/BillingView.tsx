'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Download,
  ChevronRight,
  Receipt,
  Check,
  ShieldCheck,
  Sliders,
  Sparkles,
  CreditCard,
  Zap,
  AlertTriangle,
  AlertCircle,
  Lock,
  RefreshCw,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import toast from 'react-hot-toast';

interface ProjectUsageItem {
  id: string;
  name: string;
  clientId: string;
  plan: string;
  activeUsers: number;
  tokensIssued: number;
  accruedAmount: number;
  enableAuth: boolean;
  enablePay: boolean;
  isActive: boolean;
  isBillable: boolean;
}

interface DeveloperBillingStatus {
  totalProjects: number;
  freeProjects: number;
  billableProjects: number;
  ratePerProject: number;
  currentMonthlyTotal: number;
  subscriptionId?: string | null;
  status: 'FREE_TIER' | 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED';
  nextBillingDate?: string | null;
  daysUntilRenewal?: number | null;
  warningActive: boolean;
  warningDaysLeft?: number | null;
  gracePeriodActive: boolean;
  gracePeriodHoursLeft?: number | null;
  gracePeriodEndsAt?: string | null;
  isLocked: boolean;
  message?: string;
}

export function BillingView() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectUsageItem[]>([]);
  const [billingStatus, setBillingStatus] = useState<DeveloperBillingStatus | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [calcProjects, setCalcProjects] = useState<number>(3);

  const FREE_PROJECTS_LIMIT = 1;
  const PRICE_PER_PROJECT_MONTHLY = 2.5;
  const PRICE_PER_PROJECT_YEARLY = 2.0;

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com';

      const [appsRes, billingRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/identity/developer/apps`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/v1/identity/developer/billing/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (appsRes.ok) {
        const data = await appsRes.json();
        const appsList = data.apps || data || [];
        setProjects(
          appsList.map((app: any, index: number) => {
            const isBillable = index >= FREE_PROJECTS_LIMIT;
            return {
              id: app.id,
              name: app.name,
              clientId: app.clientId,
              plan: isBillable
                ? `Additional Project ($${PRICE_PER_PROJECT_MONTHLY.toFixed(2)}/mo)`
                : 'First Project Free ($0/mo)',
              activeUsers: app.metrics?.authorizedUsers ?? app.metrics?.[0]?.authorizedUsers ?? 0,
              tokensIssued: app.metrics?.activeTokens ?? app.metrics?.[0]?.activeTokens ?? 0,
              accruedAmount: isBillable ? PRICE_PER_PROJECT_MONTHLY : 0.0,
              enableAuth: app.enableAuth ?? true,
              enablePay: app.enablePay ?? true,
              isActive: app.isActive ?? true,
              isBillable,
            };
          })
        );
        if (appsList.length > 0) {
          setCalcProjects(Math.max(appsList.length, 1));
        }
      }

      if (billingRes.ok) {
        const bData = await billingRes.json();
        if (bData.billing) {
          setBillingStatus(bData.billing);
        }
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const activeRate = selectedCycle === 'monthly' ? PRICE_PER_PROJECT_MONTHLY : PRICE_PER_PROJECT_YEARLY;
  const activeCount = projects.length;
  const billableCount = Math.max(0, activeCount - FREE_PROJECTS_LIMIT);
  const currentMonthlyUsage = billableCount * activeRate;

  // Simulator calculations
  const simBillableProjects = Math.max(0, calcProjects - FREE_PROJECTS_LIMIT);
  const simProjectMonthlyCost = simBillableProjects * activeRate;

  const handleActivateAutoPay = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com';

      const res = await fetch(`${apiBase}/api/v1/identity/developer/billing/autopay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentSource: 'WALLET_AUTOPAY' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to activate auto-pay');

      localStorage.setItem('developer_subscription_tier', 'per_project');
      toast.success(
        `Auto-Pay active! Monthly total of $${(billableCount * PRICE_PER_PROJECT_MONTHLY).toFixed(2)}/mo configured.`
      );
      await fetchBillingData();
    } catch (err: any) {
      toast.error(err.message || 'Auto-pay setup failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettlePayment = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com';

      const res = await fetch(`${apiBase}/api/v1/identity/developer/billing/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to settle payment');

      toast.success(data.message || 'Payment settled! All projects are unlocked with full features access.');
      await fetchBillingData();
    } catch (err: any) {
      toast.error(err.message || 'Settlement failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Billing & Project Subscriptions
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                billingStatus?.isLocked
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : billingStatus?.gracePeriodActive
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              {billingStatus?.isLocked
                ? 'Services Locked'
                : billingStatus?.gracePeriodActive
                ? '3-Day Grace Period'
                : billableCount > 0
                ? `${billableCount} Paid Project${billableCount > 1 ? 's' : ''}`
                : '1 Free Project Active'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            First project is 100% free forever. Additional projects are $2.50/month each with full features access and automated monthly auto-pay.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchBillingData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold gap-1.5 min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Link
            href="/dashboard"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* ─── DYNAMIC STATUS BANNERS ────────────────────────────────────────── */}

      {/* A. Lockout Warning Banner (>3 days past expiry) */}
      {billingStatus?.isLocked && (
        <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                Services Locked: Payment Overdue for Billable Projects
              </h3>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed max-w-2xl">
                Automatic deduction could not be completed and the 3-day post-expiry grace period has ended. All OAuth logins, token flows, and 180 Pay checkouts are locked for your {billingStatus.billableProjects} billable project(s). Project #1 remains free. Settle the outstanding balance to immediately unlock all services.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSettlePayment}
            disabled={actionLoading}
            className="w-full md:w-auto shrink-0 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer min-h-[44px]"
          >
            {actionLoading ? 'Processing...' : `Settle & Unlock ($${billingStatus.currentMonthlyTotal.toFixed(2)})`}
          </Button>
        </div>
      )}

      {/* B. 3-Day Grace Period Banner (Payment Due / Auto-Pay Failed) */}
      {!billingStatus?.isLocked && billingStatus?.gracePeriodActive && (
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                3-Day Grace Period Active ({billingStatus.gracePeriodHoursLeft}h left)
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed max-w-2xl">
                Automatic monthly deduction was unsuccessful. Your billable projects remain operational under our 3-day post-expiry grace period. You can settle payment manually right now before the grace period elapses to avoid service shutdown.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSettlePayment}
            disabled={actionLoading}
            className="w-full md:w-auto shrink-0 px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer min-h-[44px]"
          >
            {actionLoading ? 'Processing...' : `Settle Payment Manually ($${billingStatus.currentMonthlyTotal.toFixed(2)})`}
          </Button>
        </div>
      )}

      {/* C. 7-Day Pre-Renewal Warning Banner */}
      {!billingStatus?.isLocked && !billingStatus?.gracePeriodActive && billingStatus?.warningActive && (
        <div className="p-5 rounded-3xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                Upcoming Monthly Auto-Pay: {billingStatus.warningDaysLeft} Day(s) Remaining
              </h3>
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                Your monthly subscription of ${billingStatus.currentMonthlyTotal.toFixed(2)} covering {billingStatus.billableProjects} billable project(s) will be automatically charged on {new Date(billingStatus.nextBillingDate!).toLocaleDateString()}. Please ensure your linked account or wallet has sufficient funds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Simple, Transparent Pricing Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-white/10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Unified Developer Model</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
              $2.50 <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">/ project / month</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xl">
              Your first project is completely free forever. Every additional project is charged at $2.50/month with zero feature limitations, unlimited API throughput, and automated monthly auto-pay.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Billing Cycle Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCycle('monthly')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  selectedCycle === 'monthly'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Monthly ($2.50)
              </button>
              <button
                type="button"
                onClick={() => setSelectedCycle('yearly')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  selectedCycle === 'yearly'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>Yearly ($2.00)</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500 text-white font-mono">
                  -20%
                </span>
              </button>
            </div>

            <Button
              onClick={handleActivateAutoPay}
              disabled={actionLoading}
              className="rounded-2xl text-xs font-bold px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-md shadow-blue-500/20"
            >
              {actionLoading ? 'Setting up...' : 'Authorize Auto-Pay'}
            </Button>
          </div>
        </div>

        {/* Dynamic Aggregation Info & Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 text-xs">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Project #1: Free Forever</span>
            </div>
            <p className="text-zinc-500 text-[11px]">
              Full production access for your first app with $0.00 charges forever.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white">
              <Check className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Dynamic Aggregation</span>
            </div>
            <p className="text-zinc-500 text-[11px]">
              1 paid = $2.50/mo. 2 paid = $5.00/mo ($2.50 + $2.50). Automatically aggregated on your account.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white">
              <Clock className="w-4 h-4 text-blue-500 shrink-0" />
              <span>7-Day Pre-Renewal Notice</span>
            </div>
            <p className="text-zinc-500 text-[11px]">
              Timely notification 7 days prior to automated auto-pay deduction.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
              <span>3-Day Grace Period</span>
            </div>
            <p className="text-zinc-500 text-[11px]">
              3 days extra post-expiry grace period to pay manually before project services lock.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Interactive Project Cost Estimator */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <span>Interactive Project Cost Estimator</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Calculate exact monthly costs as you spin up additional workspace applications.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-900 dark:text-white">
            <span className="text-zinc-400">Selected:</span>
            <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              {calcProjects} Total {calcProjects === 1 ? 'Project' : 'Projects'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>1 Project (Free)</span>
            <span>2 Projects ($2.50)</span>
            <span>3 Projects ($5.00)</span>
            <span>5 Projects ($10.00)</span>
            <span>10 Projects ($22.50)</span>
            <span>20 Projects ($47.50)</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={calcProjects}
            onChange={(e) => setCalcProjects(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 space-y-1">
              <span className="text-xs text-zinc-500">Free Project Quota</span>
              <div className="text-xl font-bold text-zinc-950 dark:text-white font-mono">
                {Math.min(calcProjects, FREE_PROJECTS_LIMIT)} / 1
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                $0.00 / month cost
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 space-y-1">
              <span className="text-xs text-zinc-500">Billable Extra Projects</span>
              <div className="text-xl font-bold text-zinc-950 dark:text-white font-mono">
                {simBillableProjects}
              </div>
              <p className="text-[11px] text-zinc-500">
                {simBillableProjects > 0 ? `@ $${activeRate.toFixed(2)}/project/mo` : 'No billable projects'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-1">
              <span className="text-xs text-blue-700 dark:text-blue-300">Estimated Total Monthly Auto-Pay</span>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                ${simProjectMonthlyCost.toFixed(2)}
                <span className="text-xs font-normal text-zinc-400"> / mo</span>
              </div>
              <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80">
                {selectedCycle === 'yearly'
                  ? 'Billed annually ($2.00/mo per extra project)'
                  : 'Billed monthly via automated auto-pay'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Per-Project Usage & Billing Breakdown Table */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>Per-Project Billing Breakdown</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live consumption ledger with status and individual project pricing.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {projects.length} Registered {projects.length === 1 ? 'Project' : 'Projects'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-semibold">
                <th className="pb-3 pr-4">Project Name</th>
                <th className="pb-3 px-4">Client ID</th>
                <th className="pb-3 px-4">Project Tier</th>
                <th className="pb-3 px-4">Service Status</th>
                <th className="pb-3 px-4">Active Users</th>
                <th className="pb-3 pl-4 text-right">Project Monthly Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-medium">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    No registered projects found.
                  </td>
                </tr>
              ) : (
                projects.map((proj, idx) => {
                  const isFreeSlot = idx < FREE_PROJECTS_LIMIT;
                  const itemCost = isFreeSlot ? 0 : activeRate;
                  const isProjectLocked = !isFreeSlot && (billingStatus?.isLocked || !proj.isActive);

                  return (
                    <tr
                      key={proj.id}
                      className={`transition-colors ${
                        isProjectLocked
                          ? 'bg-rose-50/40 dark:bg-rose-950/10'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                      }`}
                    >
                      <td className="py-3.5 pr-4 font-bold text-zinc-950 dark:text-white">
                        <Link href={`/apps/${proj.id}`} className="hover:underline flex items-center gap-1.5">
                          <span>{proj.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                        {proj.clientId}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isFreeSlot
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {isFreeSlot ? 'Project #1 (Free Forever)' : `Project #${idx + 1} ($${activeRate.toFixed(2)}/mo)`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isProjectLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <Lock className="w-3 h-3" />
                            <span>Locked (Unpaid)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300 font-mono">
                        {proj.activeUsers.toLocaleString()} MAU
                      </td>
                      <td className="py-3.5 pl-4 text-right font-mono font-bold text-zinc-950 dark:text-white">
                        ${itemCost.toFixed(2)}
                        <span className="text-[10px] font-normal text-zinc-400"> / mo</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {projects.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-950 dark:text-white">
                  <td colSpan={5} className="pt-4 pr-4 text-right">
                    Total Projected Monthly Auto-Pay:
                  </td>
                  <td className="pt-4 pl-4 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                    ${currentMonthlyUsage.toFixed(2)} / mo
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. Tax Invoices & Billing History */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-zinc-500" />
              <span>Invoices & Billing History</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Download tax invoices and receipts for accounting compliance.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {billableCount === 0 ? (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-white/5 text-center text-xs text-zinc-500 dark:text-zinc-400 py-6">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">Zero Invoices Accrued</p>
              <p className="text-[11px] mt-1">Your first project is 100% free with full features access.</p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="font-bold text-zinc-950 dark:text-white">
                    Invoice #INV-2026-10-PROJ
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Oct 5, 2026 · {billableCount} Additional Projects @ ${activeRate.toFixed(2)}/mo
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-zinc-950 dark:text-white">
                  ${currentMonthlyUsage.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => toast.success('Downloaded invoice PDF')}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Download Invoice"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BillingView;
