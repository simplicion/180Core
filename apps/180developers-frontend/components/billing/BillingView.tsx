'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sliders,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { use180Pay } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';

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
  contactFormUrl: string;
}

const ENTERPRISE_FORM_URL = 'https://app.180workspace.com/f/9hbzy4u62s';

export function BillingView() {
  const [loading, setLoading] = useState(true);
  const [subscribingTier, setSubscribingTier] = useState<'STARTER' | 'PRO' | null>(null);
  const [billingStatus, setBillingStatus] = useState<DeveloperBillingStatus | null>(null);
  const [calcProjects, setCalcProjects] = useState<number>(6);

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
        }
      }

      if (appsRes.ok) {
        const data = await appsRes.json();
        const appsList = data.apps || data || [];
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

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            Billing & Developer Plans
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-2xl">
            Predictable, transparent developer pricing. Seamlessly checkout with <strong>180 Pay</strong>.
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

      {/* 2. Project Capacity Estimator */}
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
                    disabled={subscribingTier !== null || isOpeningPay}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{subscribingTier === 'STARTER' ? 'Opening 180 Pay...' : 'Select Starter'}</span>
                  </Button>
                ) : calcProjects <= 10 ? (
                  <Button
                    onClick={() => handleSubscribeWith180Pay('PRO')}
                    disabled={subscribingTier !== null || isOpeningPay}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{subscribingTier === 'PRO' ? 'Opening 180 Pay...' : 'Select Pro'}</span>
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
    </div>
  );
}

export default BillingView;
