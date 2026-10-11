'use strict';

import React, { useState, useEffect, useCallback } from 'react';
import { use180GeoPricing } from '../hooks/useGeoPricing';

export interface PlanFeatureItem {
  text: string;
  included?: boolean;
  note?: string;
}

export interface PricingPlan {
  id?: string;
  planCode?: string;
  name: string;
  description?: string;
  monthlyAmount?: number;
  yearlyAmount?: number;
  amount?: number;
  currency?: string;
  isPopular?: boolean;
  badgeText?: string;
  badgeColor?: string;
  features: (string | PlanFeatureItem)[];
  buttonText?: string;
  ctaText?: string;
  buttonUrl?: string;
  isFree?: boolean;
  trialDays?: number;
  metadata?: Record<string, any>;
}

export interface PricingTableProps {
  appId: string;
  plans?: PricingPlan[];
  title?: string;
  subtitle?: string;
  theme?: 'obsidian' | 'dark' | 'light' | 'glass' | 'auto';
  accentColor?: string;
  apiBase?: string;
  defaultInterval?: 'monthly' | 'yearly';
  enableGeoPricing?: boolean;
  currentPlanId?: string;
  activePlanCode?: string;
  onSelectPlan?: (plan: PricingPlan, interval: 'monthly' | 'yearly') => void;
  className?: string;
}

export const OneEightyPricingTable: React.FC<PricingTableProps> = ({
  appId,
  plans: initialPlans,
  title,
  subtitle,
  theme = 'auto',
  accentColor: customAccent,
  apiBase,
  defaultInterval = 'monthly',
  enableGeoPricing = false,
  currentPlanId,
  activePlanCode,
  onSelectPlan,
  className = '',
}) => {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>(defaultInterval);
  const [fetchedPlans, setFetchedPlans] = useState<PricingPlan[]>([]);
  const [fetchedTitle, setFetchedTitle] = useState<string>('');
  const [fetchedSubtitle, setFetchedSubtitle] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>(customAccent || '#6366f1');
  const [yearlyDiscountPct, setYearlyDiscountPct] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(!initialPlans || initialPlans.length === 0);
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = useCallback(() => {
    if (apiBase) return apiBase;
    if (typeof window !== 'undefined') {
      const globalUrl = (window as any).__180_CORE_API_URL || (window as any).__180_API_URL;
      if (globalUrl) return globalUrl;

      const envCore =
        (process.env.NEXT_PUBLIC_CORE_BACKEND_URL as string) ||
        (process.env.NEXT_PUBLIC_IDENTITY_SERVER_URL as string) ||
        (process.env.NEXT_PUBLIC_180_CORE_URL as string);
      if (envCore) return envCore;

      const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      if (isLocal) {
        return 'http://localhost:4003';
      }

      return 'https://services.180workspace.com';
    }
    return process.env.CORE_BACKEND_URL || 'http://localhost:4003';
  }, [apiBase]);

  // Fetch configuration if plans prop is not passed directly
  useEffect(() => {
    if (initialPlans && initialPlans.length > 0) {
      setLoading(false);
      return;
    }

    if (!appId) return;

    let isMounted = true;
    setLoading(true);

    const loadConfig = async () => {
      try {
        const url = `${getApiUrl()}/api/v1/pricing-tables/${appId}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success && data.config) {
          const cfg = data.config;
          setFetchedTitle(cfg.headline || 'Plans & Pricing');
          setFetchedSubtitle(cfg.subheadline || 'Choose the plan that fits your growth.');
          if (!customAccent && cfg.accentColor) {
            setAccentColor(cfg.accentColor);
          }
          if (cfg.yearlyDiscountPct !== undefined) {
            setYearlyDiscountPct(Number(cfg.yearlyDiscountPct));
          }

          if (Array.isArray(cfg.planCards) && cfg.planCards.length > 0) {
            const normalized: PricingPlan[] = cfg.planCards.map((card: any, idx: number) => ({
              id: card.planCode || `plan-${idx}`,
              planCode: card.planCode,
              name: card.name,
              description: card.description,
              monthlyAmount: Number(card.amount || 0),
              yearlyAmount: card.yearlyAmount ? Number(card.yearlyAmount) : Math.round(Number(card.amount || 0) * 12 * 0.8),
              currency: card.currency || 'USD',
              isPopular: Boolean(card.isPopular),
              badgeText: card.badgeText,
              badgeColor: card.badgeColor,
              features: Array.isArray(card.features) ? card.features : [],
              buttonText: card.buttonText,
              ctaText: card.buttonText,
              buttonUrl: card.buttonUrl,
              trialDays: card.trialDays,
              isFree: card.isFree || Number(card.amount || 0) === 0,
            }));
            setFetchedPlans(normalized);
          }
        } else {
          setError(data.error || 'Failed to load pricing table');
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Network error fetching pricing');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [appId, initialPlans, getApiUrl, customAccent]);

  const activePlans: PricingPlan[] = (initialPlans && initialPlans.length > 0) ? initialPlans : fetchedPlans;
  const displayTitle = title || fetchedTitle || 'Plans & Pricing';
  const displaySubtitle = subtitle || fetchedSubtitle;

  // Use base amount of popular plan for geo-pricing detection
  const baseReferenceAmount = activePlans.find((p) => p.isPopular)?.monthlyAmount || activePlans[0]?.monthlyAmount || 17;
  const { data: geoData, hasDiscount } = use180GeoPricing(appId, baseReferenceAmount, {
    enabled: enableGeoPricing,
    apiBaseUrl: getApiUrl(),
  });

  const getThemeStyles = () => {
    switch (theme) {
      case 'light':
        return {
          bg: '#ffffff',
          cardBg: '#fafafa',
          cardBorder: '#e4e4e7',
          cardActiveBorder: accentColor,
          text: '#09090b',
          mutedText: '#71717a',
          toggleBg: '#f4f4f5',
          ctaBg: accentColor,
          ctaText: '#ffffff',
          badgeBg: accentColor,
          badgeText: '#ffffff',
        };
      case 'glass':
        return {
          bg: 'transparent',
          cardBg: 'rgba(24, 24, 27, 0.65)',
          cardBorder: 'rgba(255, 255, 255, 0.1)',
          cardActiveBorder: accentColor,
          text: '#f8fafc',
          mutedText: '#94a3b8',
          toggleBg: 'rgba(255, 255, 255, 0.08)',
          ctaBg: accentColor,
          ctaText: '#ffffff',
          badgeBg: accentColor,
          badgeText: '#ffffff',
        };
      case 'dark':
      case 'obsidian':
        return {
          bg: '#09090b',
          cardBg: '#121214',
          cardBorder: '#27272a',
          cardActiveBorder: accentColor,
          text: '#fafafa',
          mutedText: '#a1a1aa',
          toggleBg: '#18181b',
          ctaBg: accentColor,
          ctaText: '#ffffff',
          badgeBg: accentColor,
          badgeText: '#ffffff',
        };
      case 'auto':
      default:
        return {
          bg: 'transparent',
          cardBg: 'var(--pricing-card-bg, #ffffff)',
          cardBorder: 'var(--pricing-card-border, #e4e4e7)',
          cardActiveBorder: accentColor,
          text: 'inherit',
          mutedText: '#71717a',
          toggleBg: 'rgba(150, 150, 150, 0.12)',
          ctaBg: accentColor,
          ctaText: '#ffffff',
          badgeBg: accentColor,
          badgeText: '#ffffff',
        };
    }
  };

  const s = getThemeStyles();

  const calculateDisplayPrice = (plan: PricingPlan) => {
    const rawMonthly = plan.monthlyAmount ?? plan.amount ?? 0;
    const rawYearly = plan.yearlyAmount ?? Math.round(rawMonthly * 12 * ((100 - yearlyDiscountPct) / 100));
    const effectivePrice = interval === 'monthly' ? rawMonthly : Math.round(rawYearly / 12);

    if (enableGeoPricing && geoData?.hasRegionalDiscount && geoData.discountPercentage > 0) {
      const discounted = Math.round(effectivePrice * (1 - geoData.discountPercentage / 100));
      return {
        amount: discounted,
        currencySymbol: geoData.symbol || '$',
        originalPrice: effectivePrice,
      };
    }

    const symbol = plan.currency === 'INR' ? '₹' : plan.currency === 'EUR' ? '€' : plan.currency === 'GBP' ? '£' : '$';
    return {
      amount: effectivePrice,
      currencySymbol: symbol,
      originalPrice: null,
    };
  };

  const handlePlanClick = (plan: PricingPlan) => {
    if (onSelectPlan) {
      onSelectPlan(plan, interval);
      return;
    }

    if (plan.buttonUrl && plan.buttonUrl.trim().length > 0) {
      window.open(plan.buttonUrl.trim(), '_blank');
      return;
    }

    if (typeof window !== 'undefined') {
      const isInternalDev =
        (window as any).__180_INTERNAL_DEV__ === true ||
        (window as any).__180_ENV__ === 'development';
      const profileBase =
        (window as any).__180_PROFILE_URL ||
        process.env.NEXT_PUBLIC_PROFILE_URL ||
        (isInternalDev ? 'http://localhost:3009' : 'https://profile.180workspace.com');
      const checkoutUrl = `${profileBase}/checkout?appId=${encodeURIComponent(appId)}&planCode=${encodeURIComponent(plan.planCode || plan.id || '')}&interval=${interval.toUpperCase()}&amount=${plan.monthlyAmount || plan.amount || 0}&currency=${encodeURIComponent(plan.currency || 'USD')}&title=${encodeURIComponent(plan.name)}`;
      window.open(checkoutUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className={`one-eighty-pricing-loading p-12 text-center flex flex-col items-center justify-center ${className}`}>
        <div
          style={{ borderColor: `${accentColor} transparent transparent transparent` }}
          className="w-8 h-8 rounded-full border-2 border-solid animate-spin mb-4"
        />
        <p className="text-xs font-semibold opacity-70">Loading 180 Pay subscriptions...</p>
      </div>
    );
  }

  if (error && activePlans.length === 0) {
    return (
      <div className={`one-eighty-pricing-error p-8 text-center rounded-2xl border border-red-500/20 bg-red-500/5 ${className}`}>
        <p className="text-sm font-semibold text-red-500">Subscription Table Unavailable</p>
        <p className="text-xs text-red-400/80 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <section
      className={`one-eighty-pricing-table ${className}`}
      style={{
        padding: '32px 16px',
        color: s.text,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        {displayTitle && (
          <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
            {displayTitle}
          </h2>
        )}
        {displaySubtitle && (
          <p style={{ fontSize: '15px', color: s.mutedText, margin: 0, maxWidth: '640px', marginLeft: 'auto', marginRight: 'auto' }}>
            {displaySubtitle}
          </p>
        )}

        {hasDiscount && geoData?.banner && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span>{geoData.banner.flag}</span>
            <span>{geoData.discountPercentage}% Regional Discount Applied ({geoData.countryName})</span>
          </div>
        )}

        {/* Interval Switcher */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px',
              background: s.toggleBg,
              borderRadius: '12px',
              border: `1px solid ${s.cardBorder}`,
            }}
          >
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              style={{
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: interval === 'monthly' ? s.ctaBg : 'transparent',
                color: interval === 'monthly' ? s.ctaText : s.mutedText,
                transition: 'all 0.15s ease',
              }}
            >
              Monthly billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              style={{
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: interval === 'yearly' ? s.ctaBg : 'transparent',
                color: interval === 'yearly' ? s.ctaText : s.mutedText,
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Annual billing</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 7px',
                  borderRadius: '9999px',
                }}
              >
                Save {yearlyDiscountPct}%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '24px',
          maxWidth: '1140px',
          margin: '0 auto',
          alignItems: 'stretch',
        }}
      >
        {activePlans.map((plan, index) => {
          const pricing = calculateDisplayPrice(plan);
          const isCurrentActive =
            (currentPlanId && (currentPlanId === plan.id || currentPlanId === plan.planCode)) ||
            (activePlanCode && (activePlanCode.toLowerCase() === plan.name.toLowerCase() || activePlanCode === plan.planCode));

          const badge = plan.badgeText || (plan.isPopular ? 'Most Popular' : undefined);

          return (
            <div
              key={plan.id || plan.planCode || `plan-${index}`}
              style={{
                position: 'relative',
                background: s.cardBg,
                borderRadius: '24px',
                padding: '32px 28px',
                border: `1.5px solid ${isCurrentActive || plan.isPopular ? s.cardActiveBorder : s.cardBorder}`,
                boxShadow: plan.isPopular
                  ? '0 20px 40px -15px rgba(99, 102, 241, 0.2)'
                  : '0 4px 20px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              {badge && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-13px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: plan.isPopular ? s.badgeBg : 'rgba(100, 116, 139, 0.9)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '4px 14px',
                    borderRadius: '9999px',
                    letterSpacing: '0.06em',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badge}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                    {plan.name}
                  </h3>
                  {isCurrentActive && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.12)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>

                {plan.description && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: s.mutedText,
                      margin: '10px 0 20px 0',
                      lineHeight: '1.5',
                      minHeight: '40px',
                    }}
                  >
                    {plan.description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '20px 0 24px 0' }}>
                  <span style={{ fontSize: '42px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.03em' }}>
                    {pricing.currencySymbol}{pricing.amount}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: s.mutedText, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    / mo
                  </span>
                  {pricing.originalPrice && (
                    <span
                      style={{
                        fontSize: '14px',
                        color: s.mutedText,
                        textDecoration: 'line-through',
                        marginLeft: '8px',
                      }}
                    >
                      {pricing.currencySymbol}{pricing.originalPrice}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    borderTop: `1px solid ${s.cardBorder}`,
                    paddingTop: '20px',
                    marginBottom: '32px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: s.mutedText,
                      marginBottom: '14px',
                    }}
                  >
                    What's included:
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {plan.features.map((feat, idx) => {
                      const text = typeof feat === 'string' ? feat : feat.text;
                      const included = typeof feat === 'string' ? true : feat.included !== false;
                      return (
                        <li
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            fontSize: '13px',
                            lineHeight: '1.4',
                            opacity: included ? 1 : 0.5,
                          }}
                        >
                          <span
                            style={{
                              color: included ? '#10b981' : '#94a3b8',
                              fontWeight: 800,
                              fontSize: '14px',
                              lineHeight: '1',
                              marginTop: '2px',
                            }}
                          >
                            {included ? '✓' : '×'}
                          </span>
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  disabled={Boolean(isCurrentActive)}
                  onClick={() => handlePlanClick(plan)}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: isCurrentActive ? 'default' : 'pointer',
                    background: isCurrentActive ? s.toggleBg : s.ctaBg,
                    color: isCurrentActive ? s.mutedText : s.ctaText,
                    transition: 'all 0.18s ease',
                    boxShadow: isCurrentActive ? 'none' : '0 4px 14px rgba(99, 102, 241, 0.25)',
                    opacity: isCurrentActive ? 0.7 : 1,
                  }}
                  onMouseOver={(e) => {
                    if (!isCurrentActive) {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                      (e.currentTarget as HTMLElement).style.opacity = '0.95';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isCurrentActive) {
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                    }
                  }}
                >
                  {isCurrentActive
                    ? 'Current Active Plan'
                    : plan.buttonText || (plan.trialDays && plan.trialDays > 0 ? `Start ${plan.trialDays}-Day Free Trial` : 'Get Started')}
                </button>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: s.mutedText,
                    marginTop: '8px',
                    fontWeight: 500,
                  }}
                >
                  {plan.trialDays && plan.trialDays > 0
                    ? `${plan.trialDays}-day full access trial • Cancel anytime`
                    : 'Instant activation • Cancel anytime'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
