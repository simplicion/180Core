'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Check, Sparkles, Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { Button, LogoLoader } from '@workspace/ui';
import { CORE_BACKEND_URL } from '@/lib/api';

interface PlanFeatureItem {
  text: string;
  included?: boolean;
  note?: string;
}

interface PlanCard {
  planCode: string;
  name: string;
  description?: string;
  amount: number;
  yearlyAmount?: number;
  currency?: string;
  interval?: string;
  trialDays?: number;
  isPopular?: boolean;
  badgeText?: string;
  badgeColor?: string;
  features: (string | PlanFeatureItem)[];
  buttonText?: string;
  buttonUrl?: string;
  isFree?: boolean;
  originalAmount?: number;
  originalCurrency?: string;
  regionalPricing?: {
    isApplied: boolean;
    countryCode: string;
    countryName: string;
    flag: string;
    currency: string;
    symbol: string;
    originalAmount: number;
    originalCurrency: string;
    discountPercentage?: number;
    banner?: {
      flag: string;
      headline: string;
      message: string;
    };
  };
}

interface PricingConfig {
  appId: string;
  appName?: string;
  appLogo?: string;
  clientId?: string;
  appDescription?: string;
  headline: string;
  subheadline?: string;
  theme?: string;
  accentColor?: string;
  billingIntervals?: string[];
  yearlyDiscountPct?: number;
  planCards: PlanCard[];
  customCss?: string;
  showTrustBadge?: boolean;
  showIntervalToggle?: boolean;
}

export function PricingEmbedClient({ appId: initialAppId }: { appId?: string } = {}) {
  const params = useParams();

  // Resilient appId extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialAppId = useCallback(() => {
    if (initialAppId && initialAppId !== 'default') return initialAppId;
    const pAppId = params?.appId as string;
    if (pAppId && pAppId !== 'default') return pAppId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/embed\/pricing\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== 'default') {
        return decodeURIComponent(match[1]);
      }
    }
    return '';
  }, [initialAppId, params?.appId]);

  const [appId, setAppId] = useState<string>(getInitialAppId);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const getApiBase = () => {
    return CORE_BACKEND_URL;
  };

  const getProfileBase = () => {
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      return isLocal ? 'http://localhost:3009' : (process.env.NEXT_PUBLIC_PROFILE_URL || 'https://profile.180workspace.com');
    }
    return process.env.NEXT_PUBLIC_PROFILE_URL || 'https://profile.180workspace.com';
  };

  const fetchConfig = useCallback(async (targetAppId?: string) => {
    const idToFetch = targetAppId || appId || getInitialAppId();
    if (!idToFetch || idToFetch === 'default') {
      setLoading(false);
      setError('Please provide a valid application ID');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiBase = getApiBase();
      const countryParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('country')
          : null;
      const url = `${apiBase}/api/v1/pricing-tables/${encodeURIComponent(idToFetch)}${
        countryParam ? `?country=${encodeURIComponent(countryParam)}` : ''
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load pricing table');
      }
      setConfig(data.config);
    } catch (err: any) {
      setError(err.message || 'Pricing table configuration could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [appId, getInitialAppId]);

  useEffect(() => {
    const currentId = getInitialAppId();
    if (currentId && currentId !== 'default') {
      setAppId(currentId);
      fetchConfig(currentId);
    } else {
      setLoading(false);
      setError('Please provide a valid application ID');
    }
  }, [getInitialAppId, fetchConfig]);

  const handleSelectPlan = (plan: PlanCard) => {
    // If a custom external action URL was defined
    if (plan.buttonUrl && plan.buttonUrl.trim().length > 0) {
      window.open(plan.buttonUrl.trim(), '_blank');
      return;
    }

    // Notify parent window if in an iframe
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: '180_PLAN_SELECTED',
          appId: config?.appId || appId,
          planCode: plan.planCode,
          name: plan.name,
          interval: selectedInterval,
          amount: plan.amount,
          currency: plan.currency || 'USD',
        },
        '*'
      );
    }

    // Direct checkout redirection
    const profileBase = getProfileBase();
    const checkoutUrl = `${profileBase}/checkout?appId=${encodeURIComponent(config?.clientId || config?.appId || appId)}&planCode=${encodeURIComponent(plan.planCode)}&interval=${selectedInterval}&amount=${plan.amount}&currency=${encodeURIComponent(plan.currency || 'USD')}&title=${encodeURIComponent(plan.name)}`;
    window.open(checkoutUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-zinc-950 text-white">
        <LogoLoader size={36} className="w-9 h-9 text-purple-500" />
        <p className="text-xs text-zinc-400 font-medium mt-3">Loading pricing plans...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-8 bg-zinc-950 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-sm font-semibold text-white">Pricing Unavailable</p>
        <p className="text-xs text-zinc-400 max-w-sm mt-1">{error || 'Could not load pricing tiers.'}</p>
      </div>
    );
  }

  const yearlyDiscount = config.yearlyDiscountPct ?? 20;
  const cards = config.planCards || [];
  const accentColor = config.accentColor || '#6366f1';

  return (
    <div className="w-full bg-zinc-950 text-white py-8 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
          <span>{config.appName || '180 Workspace'} Membership</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{config.headline}</h1>
        {config.subheadline && (
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">{config.subheadline}</p>
        )}

        {/* Interval Switcher */}
        {config.billingIntervals?.includes('YEARLY') && (
          <div className="pt-2 flex items-center justify-center gap-3">
            <span
              className={`text-xs font-semibold cursor-pointer ${
                selectedInterval === 'MONTHLY' ? 'text-white' : 'text-zinc-500'
              }`}
              onClick={() => setSelectedInterval('MONTHLY')}
            >
              Monthly billing
            </span>
            <button
              type="button"
              onClick={() => setSelectedInterval(selectedInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              style={{ backgroundColor: selectedInterval === 'YEARLY' ? accentColor : '#27272a' }}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  selectedInterval === 'YEARLY' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div
              className="flex items-center gap-1.5 cursor-pointer"
              onClick={() => setSelectedInterval('YEARLY')}
            >
              <span
                className={`text-xs font-semibold ${
                  selectedInterval === 'YEARLY' ? 'text-white' : 'text-zinc-500'
                }`}
              >
                Annual billing
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                Save {yearlyDiscount}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Empty State when no tiers exist */}
      {cards.length === 0 ? (
        <div className="max-w-md mx-auto text-center p-8 rounded-3xl border border-white/10 bg-zinc-900/50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Subscription Tiers Published Yet</h3>
          <p className="text-xs text-zinc-400">
            This application has not published any public subscription plans yet. Please check back later.
          </p>
        </div>
      ) : (
        /* Pricing Cards Grid */
        <div
          className={`max-w-5xl mx-auto grid gap-6 ${
            cards.length === 1
              ? 'max-w-sm'
              : cards.length === 2
              ? 'sm:grid-cols-2 max-w-2xl'
              : 'sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {cards.map((plan, index) => {
            const isFree = plan.isFree || plan.amount === 0;
            const rawAmount = plan.amount;
            const finalAmount = isFree
              ? 0
              : selectedInterval === 'YEARLY'
              ? plan.yearlyAmount
                ? plan.yearlyAmount
                : Math.round(rawAmount * 12 * (1 - yearlyDiscount / 100))
              : rawAmount;

            const currencySymbol =
              plan.currency === 'INR'
                ? '₹'
                : plan.currency === 'EUR'
                ? '€'
                : plan.currency === 'GBP'
                ? '£'
                : plan.currency === 'BRL'
                ? 'R$'
                : plan.currency === 'CAD' || plan.currency === 'AUD'
                ? '$'
                : plan.currency === 'JPY'
                ? '¥'
                : plan.currency === 'PHP'
                ? '₱'
                : plan.currency === 'NGN'
                ? '₦'
                : '$';

            const badgeText = plan.badgeText || (plan.isPopular ? 'Most Popular' : null);

            return (
              <div
                key={plan.planCode || index}
                className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                  plan.isPopular
                    ? 'border-2 bg-gradient-to-b from-white/[0.04] via-zinc-900/90 to-zinc-950 shadow-2xl'
                    : 'border border-white/10 bg-zinc-900/70 hover:border-white/20'
                }`}
                style={plan.isPopular ? { borderColor: `${accentColor}90` } : {}}
              >
                {badgeText && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-lg"
                    style={{ backgroundColor: accentColor }}
                  >
                    {badgeText}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-white">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{plan.description}</p>
                      )}
                    </div>
                    {plan.trialDays && plan.trialDays > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold shrink-0">
                        {plan.trialDays}d Trial
                      </span>
                    ) : null}
                  </div>

                  <div className="pt-2 pb-3 border-b border-white/5">
                    {isFree ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white font-mono">Free</span>
                        <span className="text-xs text-zinc-500 font-medium">/forever</span>
                      </div>
                    ) : (
                      <>
                        {plan.regionalPricing?.isApplied &&
                          plan.originalAmount &&
                          plan.originalAmount !== plan.amount && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-zinc-500 line-through font-mono">
                                {plan.originalCurrency === 'INR'
                                  ? '₹'
                                  : plan.originalCurrency === 'EUR'
                                  ? '€'
                                  : plan.originalCurrency === 'GBP'
                                  ? '£'
                                  : '$'}
                                {selectedInterval === 'YEARLY'
                                  ? Math.round(plan.originalAmount * 12 * (1 - yearlyDiscount / 100))
                                  : plan.originalAmount}
                              </span>
                              {plan.regionalPricing.discountPercentage ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                  {plan.regionalPricing.discountPercentage}% Off
                                </span>
                              ) : null}
                            </div>
                          )}
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-white font-mono">
                            {currencySymbol}
                            {finalAmount}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">
                            /{selectedInterval === 'YEARLY' ? 'year' : 'month'}
                          </span>
                        </div>
                        {plan.regionalPricing?.isApplied && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-indigo-400 font-medium">
                            <span>{plan.regionalPricing.flag}</span>
                            <span>Localized for {plan.regionalPricing.countryName}</span>
                          </div>
                        )}
                        {selectedInterval === 'YEARLY' && (
                          <p className="text-[11px] text-emerald-400 font-medium mt-1">
                            Billed annually ({currencySymbol}
                            {Math.round(finalAmount / 12)}/mo)
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Features List */}
                  <ul className="space-y-2.5 pt-2">
                    {(plan.features || []).map((feat, fIdx) => {
                      const isObj = typeof feat === 'object' && feat !== null;
                      const featText = isObj ? feat.text : String(feat);
                      const isIncluded = isObj ? feat.included !== false : true;
                      const featNote = isObj ? feat.note : undefined;

                      return (
                        <li
                          key={fIdx}
                          className={`flex items-start gap-2 text-xs ${
                            isIncluded ? 'text-zinc-300' : 'text-zinc-500 line-through'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              isIncluded
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {isIncluded ? <Check className="w-2.5 h-2.5" /> : '✕'}
                          </div>
                          <div className="min-w-0">
                            <span>{featText}</span>
                            {featNote && (
                              <span className="block text-[10px] text-zinc-500 not-italic no-underline">
                                {featNote}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="pt-6 mt-auto">
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg text-white"
                    style={{
                      backgroundColor: plan.isPopular ? accentColor : '#27272a',
                    }}
                  >
                    <span>{plan.buttonText || (isFree ? 'Get Started Free' : 'Choose Plan')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded Trust Footer */}
      <div className="max-w-4xl mx-auto pt-8 text-center flex items-center justify-center gap-2 text-[11px] text-zinc-500">
        <Shield className="w-3.5 h-3.5 text-emerald-400" />
        <span>Secure 256-bit encrypted checkout powered by 180 Pay</span>
      </div>
    </div>
  );
}
