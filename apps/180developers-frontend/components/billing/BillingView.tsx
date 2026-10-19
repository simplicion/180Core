'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sliders,
  RefreshCw,
  Wallet,
  Check,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { use180Pay } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';

export interface DeveloperBillingStatus {
  totalProjects: number;
  maxProjectsAllowed: number;
  freeProjects: number;
  billableProjects: number;
  ratePerProject: number;
  currentMonthlyTotal: number;
  monthlyAmount: number;
  status: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED';
  planTier: 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  planName: string;
  isTrial: boolean;
  contactFormUrl: string;
  canCreateMore?: boolean;
  message?: string;
  nextBillingDate?: string | null;
  daysUntilRenewal?: number | null;
  subscriptionId?: string | null;
}

const ENTERPRISE_FORM_URL = 'https://app.180core.cloud/f/9hbzy4u62s';

export function BillingView() {
  const [loading, setLoading] = useState(true);
  const [subscribingTier, setSubscribingTier] = useState<'STARTER' | 'PRO' | null>(null);
  const [billingStatus, setBillingStatus] = useState<DeveloperBillingStatus | null>(null);
  const [calcProjects, setCalcProjects] = useState<number>(5);

  const { launch180Pay, isOpeningPay } = use180Pay();

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';

      const [appsRes, billingRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/identity/developer/apps`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBase}/api/v1/identity/developer/billing/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (billingRes.ok) {
        const bData = await billingRes.json();
        if (bData.billing) {
          setBillingStatus(bData.billing);
          if (bData.billing.totalProjects) {
            setCalcProjects(Math.max(1, bData.billing.totalProjects));
          }
        }
      }

      if (appsRes.ok) {
        const data = await appsRes.json();
        const appsList = data.apps || data || [];
        if (appsList.length > 0 && !billingStatus) {
          setCalcProjects(Math.max(1, appsList.length));
        }
      }
    } catch (err) {
      console.error('Failed to fetch developer billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  /**
   * Launch 180 Pay Sovereign Checkout for Starter ($2/mo) or Pro ($5/mo)
   */
  const handleSubscribeWith180Pay = async (tier: 'STARTER' | 'PRO') => {
    setSubscribingTier(tier);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';

      // 1. Request 180 Pay checkout session from core backend
      const checkoutRes = await fetch(`${apiBase}/api/v1/identity/developer/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planTier: tier }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.message || 'Failed to initialize 180 Pay checkout session');
      }

      // 2. Launch 180 Pay Checkout Bottom Sheet / Popup
      await launch180Pay({
        sessionId: checkoutData.sessionId,
        amount: checkoutData.amount,
        currency: checkoutData.currency || 'USD',
        title: checkoutData.title,
        description: checkoutData.description,
        onSuccess: async (res) => {
          try {
            // 3. Confirm payment on server & activate recurring plan
            const confirmRes = await fetch(
              `${apiBase}/api/v1/identity/developer/billing/confirm-subscription`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  planTier: tier,
                  sessionId: res.sessionId || checkoutData.sessionId,
                  transactionId: res.transactionId,
                  paymentSource: '180_PAY',
                }),
              }
            );

            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) {
              throw new Error(confirmData.message || 'Failed to activate subscription tier');
            }

            toast.success(
              `Successfully subscribed to ${tier === 'PRO' ? 'Pro ($5/mo)' : 'Starter ($2/mo)'} Plan via 180 Pay!`
            );
            await fetchBillingData();
          } catch (confirmErr: any) {
            toast.error(confirmErr.message || 'Error finalizing subscription activation.');
          }
        },
        onError: () => {
          toast.error('180 Pay checkout was not completed.');
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate 180 Pay checkout');
    } finally {
      setSubscribingTier(null);
    }
  };

  /**
   * Open the designated Contact Enterprise form
   */
  const handleOpenContactForm = () => {
    const url = billingStatus?.contactFormUrl || ENTERPRISE_FORM_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const totalUsed = billingStatus?.totalProjects ?? 0;
  const maxAllowed = billingStatus?.maxProjectsAllowed ?? 1;
  const isLimitReached = totalUsed >= maxAllowed;
  const usagePercentage = Math.min(100, Math.round((totalUsed / Math.max(1, maxAllowed)) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            Billing & Developer Plans
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-2xl">
            Predictable, transparent developer pricing. Free tier includes 1 project. Seamlessly upgrade with <strong>180 Pay</strong>.
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

      {/* 2. Current Subscription & Usage Card */}
      {billingStatus && (
        <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Current Plan</span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                    billingStatus.planTier === 'PRO'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : billingStatus.planTier === 'STARTER'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {billingStatus.planName}
                </span>
                {billingStatus.status === 'ACTIVE' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    Active
                  </span>
                )}
                {isLimitReached && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                    Limit Reached
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                {billingStatus.planTier === 'PRO'
                  ? 'Pro Subscription ($5.00 / month)'
                  : billingStatus.planTier === 'STARTER'
                  ? 'Starter Subscription ($2.00 / month)'
                  : 'Free Tier (1 Project Included)'}
              </h2>
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-400 block">Monthly Rate</span>
              <span className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
                ${(billingStatus.monthlyAmount || 0).toFixed(2)}
                <span className="text-xs text-zinc-400 font-normal"> / mo</span>
              </span>
            </div>
          </div>

          {/* Project Usage Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-400" />
                <span>Project Capacity Usage</span>
              </span>
              <span className="font-mono font-bold text-zinc-950 dark:text-white">
                {totalUsed} of {maxAllowed} Projects Used ({usagePercentage}%)
              </span>
            </div>

            <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-200/60 dark:border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isLimitReached
                    ? 'bg-amber-500'
                    : usagePercentage > 60
                    ? 'bg-blue-600'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(5, usagePercentage)}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 gap-2 pt-1">
              <p>
                {billingStatus.message ||
                  (isLimitReached
                    ? 'You have reached the maximum allowed projects for your plan. Upgrade below to create more.'
                    : `You can create ${maxAllowed - totalUsed} more project(s) on your current plan.`)}
              </p>
              {billingStatus.nextBillingDate && (
                <span className="font-mono text-[11px] shrink-0 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Renews: {new Date(billingStatus.nextBillingDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Plans Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Free Tier */}
        <div
          className={`rounded-3xl border p-6 sm:p-7 flex flex-col justify-between space-y-6 ${
            billingStatus?.planTier === 'TRIAL' || !billingStatus?.planTier
              ? 'border-zinc-400 dark:border-white/20 bg-zinc-50/50 dark:bg-[#121214] shadow-xs'
              : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012]'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">Free Plan</span>
              {(billingStatus?.planTier === 'TRIAL' || !billingStatus?.subscriptionId) && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                  Current
                </span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-950 dark:text-white">Free Tier</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                For developers building and testing their first application.
              </p>
            </div>
            <div className="pt-2 font-mono">
              <span className="text-3xl font-black text-zinc-950 dark:text-white">$0</span>
              <span className="text-xs text-zinc-400"> / forever</span>
            </div>

            <ul className="space-y-2.5 pt-4 border-t border-zinc-200/80 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>1 Active Project</strong> (Maximum limit)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>OAuth 2.0 & PKCE Support</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>180 Identity & 180 Pay SDKs</span>
              </li>
              <li className="flex items-center gap-2 text-zinc-400">
                <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Cannot create more than 1 project</span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <div className="w-full py-2.5 rounded-xl text-xs font-semibold text-center border border-zinc-200 dark:border-zinc-800 text-zinc-500">
              {billingStatus?.planTier === 'TRIAL' || !billingStatus?.subscriptionId ? 'Current Tier (1 Project)' : 'Included Tier'}
            </div>
          </div>
        </div>

        {/* Card 2: Starter ($2/mo) */}
        <div
          className={`rounded-3xl border p-6 sm:p-7 flex flex-col justify-between space-y-6 relative ${
            billingStatus?.planTier === 'STARTER'
              ? 'border-blue-500 dark:border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 ring-2 ring-blue-500 shadow-md'
              : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] hover:border-zinc-300 dark:hover:border-white/20 transition-all'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">
                Most Popular
              </span>
              {billingStatus?.planTier === 'STARTER' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500 text-white font-bold">
                  Active
                </span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-950 dark:text-white">Starter Plan</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                For growing indie hackers & startups managing multiple projects.
              </p>
            </div>
            <div className="pt-2 font-mono">
              <span className="text-3xl font-black text-zinc-950 dark:text-white">$2.00</span>
              <span className="text-xs text-zinc-400"> / month</span>
            </div>

            <ul className="space-y-2.5 pt-4 border-t border-zinc-200/80 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>5 Active Projects</strong> capacity</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>OAuth 2.0, PKCE & API Tokens</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>180 Pay Checkout Bottom Sheet</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Automated 30-day auto-renewal</span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            {billingStatus?.planTier === 'STARTER' ? (
              <div className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-blue-600 text-white flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Active Subscription</span>
              </div>
            ) : (
              <Button
                onClick={() => handleSubscribeWith180Pay('STARTER')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Wallet className="w-4 h-4" />
                <span>{subscribingTier === 'STARTER' ? 'Opening 180 Pay...' : 'Upgrade to Starter ($2/mo)'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Card 3: Pro ($5/mo) */}
        <div
          className={`rounded-3xl border p-6 sm:p-7 flex flex-col justify-between space-y-6 ${
            billingStatus?.planTier === 'PRO'
              ? 'border-purple-500 dark:border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 ring-2 ring-purple-500 shadow-md'
              : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] hover:border-zinc-300 dark:hover:border-white/20 transition-all'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-purple-600 dark:text-purple-400 font-bold">
                Scale
              </span>
              {billingStatus?.planTier === 'PRO' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500 text-white font-bold">
                  Active
                </span>
              )}
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-950 dark:text-white">Pro Plan</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                For scale-ups and agencies deploying full suites of client apps.
              </p>
            </div>
            <div className="pt-2 font-mono">
              <span className="text-3xl font-black text-zinc-950 dark:text-white">$5.00</span>
              <span className="text-xs text-zinc-400"> / month</span>
            </div>

            <ul className="space-y-2.5 pt-4 border-t border-zinc-200/80 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>10 Active Projects</strong> capacity</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Full Telemetry & Financial Analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Automated HMAC Webhook dispatch</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Priority 24/7 technical routing</span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            {billingStatus?.planTier === 'PRO' ? (
              <div className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-purple-600 text-white flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Active Subscription</span>
              </div>
            ) : (
              <Button
                onClick={() => handleSubscribeWith180Pay('PRO')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Wallet className="w-4 h-4" />
                <span>{subscribingTier === 'PRO' ? 'Opening 180 Pay...' : 'Upgrade to Pro ($5/mo)'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Project Capacity Estimator */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-500" />
              <span>Project Capacity Estimator</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Select how many applications you plan to build to find the ideal subscription.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-900 dark:text-white">
            <span className="text-zinc-400">Target:</span>
            <span className="px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              {calcProjects} {calcProjects === 1 ? 'Project' : 'Projects'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
            <span>1 Project (Free)</span>
            <span>5 Projects ($2/mo)</span>
            <span>10 Projects ($5/mo)</span>
            <span>15+ Projects (Custom)</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            value={calcProjects}
            onChange={(e) => setCalcProjects(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 space-y-1">
              <span className="text-xs text-zinc-500">Selected Capacity</span>
              <div className="text-xl font-bold text-zinc-950 dark:text-white font-mono">
                {calcProjects} {calcProjects === 1 ? 'Application' : 'Applications'}
              </div>
              <p className="text-[11px] text-zinc-500">
                {calcProjects === 1
                  ? 'Max 1 project in Free Tier'
                  : calcProjects <= 5
                  ? 'Fits in Starter Plan (5 slots)'
                  : calcProjects <= 10
                  ? 'Fits in Pro Plan (10 slots)'
                  : 'Requires Enterprise scaling'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 space-y-1">
              <span className="text-xs text-zinc-500">Recommended Plan</span>
              <div className="text-xl font-bold text-zinc-950 dark:text-white">
                {calcProjects === 1
                  ? 'Free Tier or Starter'
                  : calcProjects <= 5
                  ? 'Starter ($2/mo)'
                  : calcProjects <= 10
                  ? 'Pro ($5/mo)'
                  : 'Enterprise'}
              </div>
              <p className="text-[11px] text-zinc-500">
                {calcProjects === 1
                  ? 'Includes 1 project slot'
                  : calcProjects <= 5
                  ? 'Includes up to 5 project slots'
                  : calcProjects <= 10
                  ? 'Includes up to 10 project slots'
                  : 'Unlimited custom slots'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-1 flex flex-col justify-between">
              <div>
                <span className="text-xs text-blue-700 dark:text-blue-300">Action</span>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {calcProjects <= 5
                    ? '$2.00 / mo via 180 Pay'
                    : calcProjects <= 10
                    ? '$5.00 / mo via 180 Pay'
                    : 'Contact for Invoicing'}
                </div>
              </div>
              <div className="pt-2">
                {calcProjects <= 5 ? (
                  <Button
                    onClick={() => handleSubscribeWith180Pay('STARTER')}
                    disabled={subscribingTier !== null || isOpeningPay || billingStatus?.planTier === 'STARTER'}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>
                      {subscribingTier === 'STARTER'
                        ? 'Opening 180 Pay...'
                        : billingStatus?.planTier === 'STARTER'
                        ? 'Active Plan'
                        : 'Select Starter ($2/mo)'}
                    </span>
                  </Button>
                ) : calcProjects <= 10 ? (
                  <Button
                    onClick={() => handleSubscribeWith180Pay('PRO')}
                    disabled={subscribingTier !== null || isOpeningPay || billingStatus?.planTier === 'PRO'}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>
                      {subscribingTier === 'PRO'
                        ? 'Opening 180 Pay...'
                        : billingStatus?.planTier === 'PRO'
                        ? 'Active Plan'
                        : 'Select Pro ($5/mo)'}
                    </span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleOpenContactForm}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
                  >
                    Contact Enterprise
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Custom Volume & Enterprise Contact Banner */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-indigo-500/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise Scale</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
            Need 15+ Projects or Custom Invoicing?
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl">
            For large organizations, custom SLA guarantees, volume discounts, and white-label OAuth configurations, connect directly with our engineering leadership.
          </p>
        </div>

        <Button
          onClick={handleOpenContactForm}
          className="rounded-xl px-5 py-2.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 shrink-0 cursor-pointer flex items-center gap-2 shadow-sm"
        >
          <span>Contact Us</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default BillingView;
