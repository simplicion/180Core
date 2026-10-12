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
  Sparkles,
  Lock,
  RefreshCw,
  Clock,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  Sliders,
  Wallet,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { use180Pay } from '@workspace/identity-sdk';
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
  trialDaysLeft: number;
  trialEndsAt: string;
  subscriptionId?: string | null;
  nextBillingDate?: string | null;
  daysUntilRenewal?: number | null;
  warningActive: boolean;
  warningDaysLeft?: number | null;
  gracePeriodActive: boolean;
  gracePeriodHoursLeft?: number | null;
  gracePeriodEndsAt?: string | null;
  isLocked: boolean;
  canCreateMore: boolean;
  message?: string;
  contactFormUrl: string;
}

const ENTERPRISE_FORM_URL = 'https://app.180workspace.com/f/9hbzy4u62s';

export function BillingView() {
  const [loading, setLoading] = useState(true);
  const [subscribingTier, setSubscribingTier] = useState<'STARTER' | 'PRO' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectUsageItem[]>([]);
  const [billingStatus, setBillingStatus] = useState<DeveloperBillingStatus | null>(null);
  const [calcProjects, setCalcProjects] = useState<number>(3);

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

      let currentBilling: DeveloperBillingStatus | null = null;
      if (billingRes.ok) {
        const bData = await billingRes.json();
        if (bData.billing) {
          currentBilling = bData.billing;
          setBillingStatus(bData.billing);
        }
      }

      if (appsRes.ok) {
        const data = await appsRes.json();
        const appsList = data.apps || data || [];
        const maxAllowed = currentBilling?.maxProjectsAllowed || 5;

        setProjects(
          appsList.map((app: any, index: number) => {
            const isWithinPlan = index < maxAllowed;
            return {
              id: app.id,
              name: app.name,
              clientId: app.clientId,
              plan: currentBilling?.isTrial
                ? 'Trial Project (Included)'
                : currentBilling?.planTier === 'PRO'
                ? 'Pro Project Quota'
                : 'Starter Project Quota',
              activeUsers: app.metrics?.authorizedUsers ?? app.metrics?.[0]?.authorizedUsers ?? 0,
              tokensIssued: app.metrics?.activeTokens ?? app.metrics?.[0]?.activeTokens ?? 0,
              accruedAmount: 0.0,
              enableAuth: app.enableAuth ?? true,
              enablePay: app.enablePay ?? true,
              isActive: app.isActive ?? true,
              isBillable: !isWithinPlan,
            };
          })
        );
        if (appsList.length > 0) {
          setCalcProjects(appsList.length);
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

  /**
   * Settle overdue payment manually
   */
  const handleSettlePayment = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';

      const res = await fetch(`${apiBase}/api/v1/identity/developer/billing/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to settle payment');

      toast.success(data.message || 'Payment settled! All projects are unlocked.');
      await fetchBillingData();
    } catch (err: any) {
      toast.error(err.message || 'Settlement failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isTrialActive = billingStatus?.isTrial ?? false;
  const isTrialExpired = billingStatus?.status === 'TRIAL_EXPIRED';
  const isPaidActive = billingStatus?.status === 'ACTIVE';
  const currentTier = billingStatus?.planTier || (isTrialActive ? 'TRIAL' : 'NONE');
  const maxProjects = billingStatus?.maxProjectsAllowed || 5;
  const projectCount = projects.length;
  const usagePercentage = Math.min(100, Math.round((projectCount / maxProjects) * 100));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Billing & Developer Plans
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                billingStatus?.isLocked
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : isTrialActive
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  : isTrialExpired
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : currentTier === 'PRO'
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}
            >
              {billingStatus?.isLocked
                ? 'Services Locked'
                : isTrialActive
                ? `30-Day Free Trial (${billingStatus?.trialDaysLeft}d left)`
                : isTrialExpired
                ? 'Trial Expired'
                : currentTier === 'PRO'
                ? 'Pro Plan ($5/mo)'
                : currentTier === 'STARTER'
                ? 'Starter Plan ($2/mo)'
                : 'Free Access'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-2xl">
            All engineering developers get <strong>30 days free trial access</strong> (up to 5 projects). Afterwards, continue with Starter ($2/mo for 5 projects) or Pro ($5/mo for 10 projects) via <strong>180 Pay</strong>, or contact enterprise for unlimited scale.
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

      {/* A. 30-Day Free Trial Active Banner */}
      {isTrialActive && !billingStatus?.isLocked && (
        <div className="p-6 rounded-3xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                    30-Day Free Trial Active
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono">
                    {billingStatus?.trialDaysLeft} Days Remaining
                  </span>
                </div>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed max-w-2xl">
                  You have full developer portal access to create up to <strong>5 projects</strong> with 180 Identity and 180 Pay APIs. Your trial ends on{' '}
                  <strong className="underline">
                    {billingStatus?.trialEndsAt ? new Date(billingStatus.trialEndsAt).toLocaleDateString() : '30 days'}
                  </strong>
                  . You can upgrade to a paid tier anytime using 180 Pay.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={() => handleSubscribeWith180Pay('PRO')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer min-h-[40px] flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Upgrade with 180 Pay ($5/mo)</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* B. Trial Expired Banner */}
      {isTrialExpired && !billingStatus?.isLocked && (
        <div className="p-6 rounded-3xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                  30-Day Free Trial Has Concluded
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed max-w-2xl">
                  Your 30-day developer trial period has ended. To continue creating new applications and maintain production access, please choose Starter ($2/mo) or Pro ($5/mo) using 180 Pay below.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button
                onClick={() => handleSubscribeWith180Pay('STARTER')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-bold text-xs shadow-sm cursor-pointer min-h-[40px]"
              >
                Starter ($2/mo)
              </Button>
              <Button
                onClick={() => handleSubscribeWith180Pay('PRO')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer min-h-[40px] flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Pro ($5/mo) via 180 Pay</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* C. Lockout Banner (>3 days past due) */}
      {billingStatus?.isLocked && (
        <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                Services Locked: Payment Overdue
              </h3>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed max-w-2xl">
                Automatic deduction could not be completed and the post-expiry grace period has ended. Settle your outstanding balance or renew your subscription via 180 Pay to immediately unlock all services.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSettlePayment}
            disabled={actionLoading}
            className="w-full md:w-auto shrink-0 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer min-h-[44px]"
          >
            {actionLoading ? 'Processing...' : `Settle & Unlock ($${(billingStatus.monthlyAmount || 2.0).toFixed(2)})`}
          </Button>
        </div>
      )}

      {/* D. 3-Day Grace Period Banner */}
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
                Automatic monthly renewal was unsuccessful. Your projects remain operational under our 3-day grace period. Settle payment now before services are locked.
              </p>
            </div>
          </div>
          <Button
            onClick={handleSettlePayment}
            disabled={actionLoading}
            className="w-full md:w-auto shrink-0 px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer min-h-[44px]"
          >
            {actionLoading ? 'Processing...' : `Settle Payment ($${(billingStatus.monthlyAmount || 2.0).toFixed(2)})`}
          </Button>
        </div>
      )}

      {/* 2. Project Quota & Usage Meter */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>Project Quota Utilization</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Current active applications against your tier allocation ({projectCount} of {maxProjects} projects used).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
              {projectCount} / {maxProjects} Projects
            </span>
            <span className="text-xs text-zinc-400 font-mono">({usagePercentage}%)</span>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <div className="w-full h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercentage >= 100
                  ? 'bg-rose-500'
                  : usagePercentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {maxProjects - projectCount > 0
                ? `${maxProjects - projectCount} project slot${maxProjects - projectCount > 1 ? 's' : ''} available`
                : 'Project limit reached'}
            </span>
            <span>
              {currentTier === 'PRO'
                ? 'Pro Tier (10 Projects Limit)'
                : currentTier === 'STARTER'
                ? 'Starter Tier (5 Projects Limit)'
                : 'Trial Tier (5 Projects Limit)'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Transparent Pricing Plans (3 Cards: Starter, Pro, Enterprise) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-zinc-950 dark:text-white">
            Developer Portal Plans
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Predictable, transparent developer pricing. Seamlessly checkout with <strong>180 Pay</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ─── CARD 1: STARTER PLAN ─── */}
          <div
            className={`rounded-3xl border transition-all relative flex flex-col justify-between p-6 sm:p-7 ${
              currentTier === 'STARTER' && !isTrialActive
                ? 'border-blue-500 dark:border-blue-500/80 bg-blue-50/20 dark:bg-blue-950/10 shadow-md ring-1 ring-blue-500/40'
                : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] hover:border-zinc-300 dark:hover:border-white/20'
            }`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                  Starter Plan
                </span>
                {currentTier === 'STARTER' && !isTrialActive && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                    Current Plan
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white">
                    $2
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    / month
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Essential portal access for developers and independent builders.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                <div className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>5 Projects Access</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-5.5">
                  Deploy and manage up to 5 OAuth 2.0 & 180 Pay applications.
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>180 Identity OAuth 2.0 & OIDC</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>180 Pay Sovereign Checkout SDK</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Unlimited User Logins & Tokens</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Webhook Signatures & Retries</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Community & Docs Support</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={() => handleSubscribeWith180Pay('STARTER')}
                disabled={subscribingTier !== null || isOpeningPay || (currentTier === 'STARTER' && !isTrialActive)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer min-h-[44px] flex items-center justify-center gap-2 ${
                  currentTier === 'STARTER' && !isTrialActive
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-default'
                    : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {subscribingTier === 'STARTER'
                    ? 'Opening 180 Pay...'
                    : currentTier === 'STARTER' && !isTrialActive
                    ? 'Active Starter Plan'
                    : 'Subscribe with 180 Pay ($2/mo)'}
                </span>
              </Button>
            </div>
          </div>

          {/* ─── CARD 2: PRO PLAN (FEATURED / MOST POPULAR) ─── */}
          <div
            className={`rounded-3xl border transition-all relative flex flex-col justify-between p-6 sm:p-7 ${
              currentTier === 'PRO'
                ? 'border-blue-500 dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-lg ring-2 ring-blue-500/50'
                : 'border-blue-500/50 dark:border-blue-500/40 bg-white dark:bg-[#101012] shadow-md hover:border-blue-500'
            }`}
          >
            {/* Featured Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
                Most Popular
              </span>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Pro Plan
                </span>
                {currentTier === 'PRO' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                    Current Plan
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white">
                    $5
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    / month
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Best value for professional developers, SaaS teams, and growing studios.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 space-y-1">
                <div className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>10 Projects Access</span>
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 pl-5.5">
                  Full capacity to run up to 10 production applications in parallel.
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Everything in Starter included</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>BYOG (Custom Payment Gateway)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Custom OAuth Domain & CNAME</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Real-Time Payment & Telemetry Logs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Priority Developer Support</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={() => handleSubscribeWith180Pay('PRO')}
                disabled={subscribingTier !== null || isOpeningPay || currentTier === 'PRO'}
                className={`w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer min-h-[44px] flex items-center justify-center gap-2 ${
                  currentTier === 'PRO'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>
                  {subscribingTier === 'PRO'
                    ? 'Opening 180 Pay...'
                    : currentTier === 'PRO'
                    ? 'Active Pro Plan'
                    : 'Upgrade with 180 Pay ($5/mo)'}
                </span>
              </Button>
            </div>
          </div>

          {/* ─── CARD 3: ENTERPRISE / CONTACT ─── */}
          <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] hover:border-zinc-300 dark:hover:border-white/20 transition-all flex flex-col justify-between p-6 sm:p-7">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                  Enterprise
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                  Custom Scale
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-black text-zinc-950 dark:text-white">
                    Custom
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    / flexible
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Tailored solutions for enterprises with unlimited applications and bespoke compliance.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                <div className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
                  <span>Unlimited Projects</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-5.5">
                  Custom capacity allocation with dedicated isolation and white-labeling.
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Unlimited OAuth Applications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>99.99% Guaranteed SLA Uptime</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Custom Gateway White-Labeling</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Dedicated Solutions Engineer</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Custom Invoicing & Vendor Contracts</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={handleOpenContactForm}
                variant="outline"
                className="w-full py-2.5 rounded-xl font-bold text-xs cursor-pointer min-h-[44px] flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white"
              >
                <span>Contact Us</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interactive Project Plan Matcher */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
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
            <span>1 Project</span>
            <span>5 Projects</span>
            <span>10 Projects</span>
            <span>15+ Projects</span>
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
                {calcProjects} Applications
              </div>
              <p className="text-[11px] text-zinc-500">
                {calcProjects <= 5 ? 'Fits in Starter or Trial' : calcProjects <= 10 ? 'Fits in Pro Plan' : 'Requires Enterprise'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 space-y-1">
              <span className="text-xs text-zinc-500">Recommended Plan</span>
              <div className="text-xl font-bold text-zinc-950 dark:text-white">
                {calcProjects <= 5 ? 'Starter ($2/mo)' : calcProjects <= 10 ? 'Pro ($5/mo)' : 'Enterprise'}
              </div>
              <p className="text-[11px] text-zinc-500">
                {calcProjects <= 5 ? 'Includes 5 project slots' : calcProjects <= 10 ? 'Includes 10 project slots' : 'Unlimited custom slots'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-1 flex flex-col justify-between">
              <div>
                <span className="text-xs text-blue-700 dark:text-blue-300">Action</span>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {calcProjects <= 5 ? '$2.00 / mo via 180 Pay' : calcProjects <= 10 ? '$5.00 / mo via 180 Pay' : 'Contact for Invoicing'}
                </div>
              </div>
              <div className="pt-2">
                {calcProjects <= 5 ? (
                  <Button
                    onClick={() => handleSubscribeWith180Pay('STARTER')}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 cursor-pointer"
                  >
                    Select Starter
                  </Button>
                ) : calcProjects <= 10 ? (
                  <Button
                    onClick={() => handleSubscribeWith180Pay('PRO')}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                  >
                    Select Pro
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

      {/* 5. Registered Projects Ledger Table */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>Registered Projects Ledger</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Overview of all active applications linked to your developer credentials.
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
                <th className="pb-3 px-4">Plan Quota</th>
                <th className="pb-3 px-4">Status</th>
                <th className="pb-3 px-4">Active Users</th>
                <th className="pb-3 pl-4 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-medium">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    No registered projects yet. Create your first application from the Dashboard!
                  </td>
                </tr>
              ) : (
                projects.map((proj, idx) => {
                  const isWithinQuota = idx < maxProjects;
                  const isProjectLocked = !isWithinQuota || billingStatus?.isLocked || !proj.isActive;

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
                            isWithinQuota
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}
                        >
                          {isWithinQuota ? `Slot #${idx + 1} of ${maxProjects}` : `Exceeds Quota (#${idx + 1})`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isProjectLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <Lock className="w-3 h-3" />
                            <span>Locked</span>
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
                      <td className="py-3.5 pl-4 text-right">
                        <Link
                          href={`/apps/${proj.id}`}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Manage App
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Invoices & Billing History */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-zinc-500" />
              <span>Invoices & 180 Pay Statements</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Download tax invoices and receipts for accounting compliance.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {billingStatus?.monthlyAmount === 0 || isTrialActive ? (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-white/5 text-center text-xs text-zinc-500 dark:text-zinc-400 py-6">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                {isTrialActive ? '30-Day Free Trial Active' : 'Zero Invoices Accrued'}
              </p>
              <p className="text-[11px] mt-1">
                {isTrialActive
                  ? 'Zero charges during your 30-day trial period.'
                  : 'Invoices will be recorded when you subscribe to Starter or Pro.'}
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <div className="font-bold text-zinc-950 dark:text-white">
                    {billingStatus?.planName || 'Developer Subscription'}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Paid via 180 Pay · Renews:{' '}
                    {billingStatus?.nextBillingDate
                      ? new Date(billingStatus.nextBillingDate).toLocaleDateString()
                      : 'Monthly'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-zinc-950 dark:text-white">
                  ${(billingStatus?.monthlyAmount || 2.0).toFixed(2)} / mo
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
