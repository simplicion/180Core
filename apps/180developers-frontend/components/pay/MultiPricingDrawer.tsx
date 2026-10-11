'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Sparkles,
  Calculator,
  Search,
  Sliders,
  DollarSign,
  Percent,
  X,
  HelpCircle,
  TrendingDown,
  Info,
} from 'lucide-react';
import { PlatformDrawer, Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';

export interface RegionalPricingRule {
  countryCode: string;
  countryName: string;
  flag: string;
  currency: string;
  symbol: string;
  ruleType: 'FIXED_PRICE' | 'PERCENTAGE_DISCOUNT';
  amount: number;
  discountPct?: number | null;
}

export interface MultiPricingConfig {
  enabled: boolean;
  mode: 'HYBRID' | 'CUSTOM_ONLY' | 'PPP_FALLBACK';
  rules: RegionalPricingRule[];
}

export interface MultiPricingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  baseAmount: number;
  baseCurrency: string;
  title?: string;
  itemName?: string;
  value: MultiPricingConfig;
  onChange: (config: MultiPricingConfig) => void;
}

interface CountryMeta {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  pppTier: 1 | 2 | 3;
  suggestedDiscount: number;
  fxToUsd: number;
}

const SUPPORTED_COUNTRIES: CountryMeta[] = [
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳', pppTier: 3, suggestedDiscount: 65, fxToUsd: 86.5 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', flag: '🇬🇧', pppTier: 1, suggestedDiscount: 0, fxToUsd: 0.78 },
  { code: 'DE', name: 'Germany (Eurozone)', currency: 'EUR', symbol: '€', flag: '🇩🇪', pppTier: 1, suggestedDiscount: 0, fxToUsd: 0.92 },
  { code: 'FR', name: 'France (Eurozone)', currency: 'EUR', symbol: '€', flag: '🇫🇷', pppTier: 1, suggestedDiscount: 0, fxToUsd: 0.92 },
  { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$', flag: '🇧🇷', pppTier: 2, suggestedDiscount: 40, fxToUsd: 5.8 },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'C$', flag: '🇨🇦', pppTier: 1, suggestedDiscount: 0, fxToUsd: 1.39 },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$', flag: '🇦🇺', pppTier: 1, suggestedDiscount: 0, fxToUsd: 1.54 },
  { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥', flag: '🇯🇵', pppTier: 1, suggestedDiscount: 0, fxToUsd: 152.0 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$', flag: '🇸🇬', pppTier: 1, suggestedDiscount: 0, fxToUsd: 1.34 },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', symbol: 'AED', flag: '🇦🇪', pppTier: 1, suggestedDiscount: 0, fxToUsd: 3.67 },
  { code: 'MX', name: 'Mexico', currency: 'MXN', symbol: 'Mex$', flag: '🇲🇽', pppTier: 2, suggestedDiscount: 40, fxToUsd: 19.8 },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R', flag: '🇿🇦', pppTier: 2, suggestedDiscount: 40, fxToUsd: 18.2 },
  { code: 'TR', name: 'Turkey', currency: 'TRY', symbol: '₺', flag: '🇹🇷', pppTier: 2, suggestedDiscount: 40, fxToUsd: 34.5 },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', symbol: 'Rp', flag: '🇮🇩', pppTier: 3, suggestedDiscount: 65, fxToUsd: 15800.0 },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦', flag: '🇳🇬', pppTier: 3, suggestedDiscount: 65, fxToUsd: 1550.0 },
  { code: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱', flag: '🇵🇭', pppTier: 3, suggestedDiscount: 65, fxToUsd: 58.5 },
  { code: 'VN', name: 'Vietnam', currency: 'VND', symbol: '₫', flag: '🇻🇳', pppTier: 3, suggestedDiscount: 65, fxToUsd: 25300.0 },
  { code: 'EG', name: 'Egypt', currency: 'EGP', symbol: 'E£', flag: '🇪🇬', pppTier: 3, suggestedDiscount: 65, fxToUsd: 49.0 },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', symbol: '₨', flag: '🇵🇰', pppTier: 3, suggestedDiscount: 65, fxToUsd: 278.0 },
  { code: 'NP', name: 'Nepal', currency: 'NPR', symbol: 'Rs', flag: '🇳🇵', pppTier: 3, suggestedDiscount: 65, fxToUsd: 133.6 },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', symbol: '৳', flag: '🇧🇩', pppTier: 3, suggestedDiscount: 65, fxToUsd: 120.0 },
  { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh', flag: '🇰🇪', pppTier: 3, suggestedDiscount: 65, fxToUsd: 129.0 },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', symbol: 'RM', flag: '🇲🇾', pppTier: 2, suggestedDiscount: 40, fxToUsd: 4.4 },
  { code: 'TH', name: 'Thailand', currency: 'THB', symbol: '฿', flag: '🇹🇭', pppTier: 2, suggestedDiscount: 40, fxToUsd: 34.0 },
  { code: 'PL', name: 'Poland', currency: 'PLN', symbol: 'zł', flag: '🇵🇱', pppTier: 2, suggestedDiscount: 40, fxToUsd: 4.0 },
  { code: 'CL', name: 'Chile', currency: 'CLP', symbol: 'CLP$', flag: '🇨🇱', pppTier: 2, suggestedDiscount: 40, fxToUsd: 940.0 },
  { code: 'AR', name: 'Argentina', currency: 'ARS', symbol: '$', flag: '🇦🇷', pppTier: 2, suggestedDiscount: 40, fxToUsd: 1020.0 },
  { code: 'NL', name: 'Netherlands (Eurozone)', currency: 'EUR', symbol: '€', flag: '🇳🇱', pppTier: 1, suggestedDiscount: 0, fxToUsd: 0.92 },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', symbol: 'CHF', flag: '🇨🇭', pppTier: 1, suggestedDiscount: 0, fxToUsd: 0.89 },
  { code: 'SE', name: 'Sweden', currency: 'SEK', symbol: 'kr', flag: '🇸🇪', pppTier: 1, suggestedDiscount: 0, fxToUsd: 10.6 },
  { code: 'NO', name: 'Norway', currency: 'NOK', symbol: 'kr', flag: '🇳🇴', pppTier: 1, suggestedDiscount: 0, fxToUsd: 10.8 },
];

export function MultiPricingDrawer({
  isOpen,
  onClose,
  baseAmount,
  baseCurrency,
  title = 'Configure Multi-Pricing & Regional Rules',
  itemName = 'Payment Item',
  value,
  onChange,
}: MultiPricingDrawerProps) {
  const [enabled, setEnabled] = useState(value?.enabled ?? false);
  const [mode, setMode] = useState<'HYBRID' | 'CUSTOM_ONLY' | 'PPP_FALLBACK'>(value?.mode ?? 'HYBRID');
  const [rules, setRules] = useState<RegionalPricingRule[]>(value?.rules ?? []);

  // Form State for Adding / Editing a Country Rule
  const [selectedCountryCode, setSelectedCountryCode] = useState('IN');
  const [ruleType, setRuleType] = useState<'FIXED_PRICE' | 'PERCENTAGE_DISCOUNT'>('FIXED_PRICE');
  const [customAmount, setCustomAmount] = useState('1499');
  const [discountPercent, setDiscountPercent] = useState('50');
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [countrySearch, setCountrySearch] = useState('');
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);

  // Sync state with incoming value whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setEnabled(Boolean(value?.enabled));
      setMode(value?.mode || 'HYBRID');
      setRules(Array.isArray(value?.rules) ? [...value.rules] : []);
    }
  }, [isOpen, value]);

  const currentCountry = useMemo(() => {
    return SUPPORTED_COUNTRIES.find((c) => c.code === selectedCountryCode) || SUPPORTED_COUNTRIES[0];
  }, [selectedCountryCode]);

  // Auto-calculate suggested price when country changes
  useEffect(() => {
    if (currentCountry) {
      setSelectedCurrency(currentCountry.currency);
      // Rough FX calculation from base
      const usdEstimate = baseCurrency.toUpperCase() === 'USD' ? baseAmount : baseAmount / 86.5;
      const localFx = usdEstimate * currentCountry.fxToUsd;
      const discountMult = 1 - currentCountry.suggestedDiscount / 100;
      const suggested = Math.round(localFx * discountMult);
      const prettyAmount = suggested > 50 ? Math.round(suggested / 10) * 10 : Math.max(1, suggested);
      if (editingRuleIndex === null) {
        setCustomAmount(String(prettyAmount));
        setDiscountPercent(String(currentCountry.suggestedDiscount || 40));
      }
    }
  }, [currentCountry, baseAmount, baseCurrency, editingRuleIndex]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return SUPPORTED_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return SUPPORTED_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  const handleApplyPresetPPP = () => {
    // Generate recommended defaults for popular emerging markets
    const presets: RegionalPricingRule[] = [
      {
        countryCode: 'IN',
        countryName: 'India',
        flag: '🇮🇳',
        currency: 'INR',
        symbol: '₹',
        ruleType: 'FIXED_PRICE',
        amount: Math.round(((baseCurrency === 'USD' ? baseAmount : baseAmount / 86.5) * 86.5 * 0.35) / 10) * 10 || 999,
        discountPct: 65,
      },
      {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        flag: '🇬🇧',
        currency: 'GBP',
        symbol: '£',
        ruleType: 'FIXED_PRICE',
        amount: Math.round((baseCurrency === 'USD' ? baseAmount : baseAmount / 86.5) * 0.78) || 39,
        discountPct: null,
      },
      {
        countryCode: 'DE',
        countryName: 'Germany (Eurozone)',
        flag: '🇩🇪',
        currency: 'EUR',
        symbol: '€',
        ruleType: 'FIXED_PRICE',
        amount: Math.round((baseCurrency === 'USD' ? baseAmount : baseAmount / 86.5) * 0.92) || 45,
        discountPct: null,
      },
      {
        countryCode: 'BR',
        countryName: 'Brazil',
        flag: '🇧🇷',
        currency: 'BRL',
        symbol: 'R$',
        ruleType: 'FIXED_PRICE',
        amount: Math.round(((baseCurrency === 'USD' ? baseAmount : baseAmount / 86.5) * 5.8 * 0.6) / 5) * 5 || 149,
        discountPct: 40,
      },
    ];

    setRules(presets);
    setEnabled(true);
    setMode('HYBRID');
    toast.success('Applied standard regional presets (India, UK, Eurozone, Brazil)');
  };

  const handleSaveCountryRule = () => {
    const meta = currentCountry;
    let finalAmt = parseFloat(customAmount);
    let finalDiscount: number | null = null;

    if (ruleType === 'PERCENTAGE_DISCOUNT') {
      const pct = parseFloat(discountPercent);
      if (isNaN(pct) || pct <= 0 || pct >= 100) {
        toast.error('Discount percentage must be between 1% and 99%');
        return;
      }
      finalDiscount = Math.round(pct);
      const usdEstimate = baseCurrency.toUpperCase() === 'USD' ? baseAmount : baseAmount / 86.5;
      const converted = usdEstimate * meta.fxToUsd;
      finalAmt = Math.round(converted * (1 - pct / 100));
    } else {
      if (isNaN(finalAmt) || finalAmt <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }
      if (baseAmount > 0) {
        finalDiscount = Math.round(((baseAmount - finalAmt) / baseAmount) * 100);
      }
    }

    const newRule: RegionalPricingRule = {
      countryCode: meta.code,
      countryName: meta.name,
      flag: meta.flag,
      currency: selectedCurrency.toUpperCase(),
      symbol: meta.symbol,
      ruleType,
      amount: finalAmt,
      discountPct: finalDiscount && finalDiscount > 0 ? finalDiscount : null,
    };

    const updated = [...rules];
    if (editingRuleIndex !== null && editingRuleIndex >= 0) {
      updated[editingRuleIndex] = newRule;
      setEditingRuleIndex(null);
      toast.success(`Updated rule for ${meta.name}`);
    } else {
      const existingIdx = updated.findIndex((r) => r.countryCode === meta.code);
      if (existingIdx >= 0) {
        updated[existingIdx] = newRule;
        toast.success(`Updated existing rule for ${meta.name}`);
      } else {
        updated.push(newRule);
        toast.success(`Added regional rule for ${meta.name}`);
      }
    }

    setRules(updated);
    setEnabled(true);
  };

  const handleEditRule = (rule: RegionalPricingRule, idx: number) => {
    setEditingRuleIndex(idx);
    setSelectedCountryCode(rule.countryCode);
    setRuleType(rule.ruleType);
    setSelectedCurrency(rule.currency);
    setCustomAmount(String(rule.amount));
    if (rule.discountPct) {
      setDiscountPercent(String(rule.discountPct));
    }
  };

  const handleDeleteRule = (code: string) => {
    setRules(rules.filter((r) => r.countryCode !== code));
    if (editingRuleIndex !== null) setEditingRuleIndex(null);
    toast.success('Removed country rule');
  };

  const handleSaveDrawer = () => {
    const config: MultiPricingConfig = {
      enabled,
      mode,
      rules,
    };
    onChange(config);
    toast.success('Multi-pricing configuration applied!');
    onClose();
  };

  return (
    <PlatformDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={Globe}
      iconColorClass="text-indigo-600 dark:text-indigo-400"
      iconBgClass="bg-indigo-500/10"
      maxWidthClass="max-w-2xl"
      subHeader={
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
              Targeted pricing by country, region, and Purchasing Power Parity (PPP).
            </p>
            <p className="text-[11px] text-zinc-400">
              Item: <span className="font-semibold text-zinc-900 dark:text-white">{itemName}</span> • Base:{' '}
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {baseCurrency} {baseAmount}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full font-bold border ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-white/10'
              }`}
            >
              {enabled ? `Active (${rules.length} Rules)` : 'Disabled'}
            </span>
          </div>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleApplyPresetPPP}
              className="text-xs font-semibold border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-500" />
              Apply Smart Presets
            </Button>
            <Button
              type="button"
              onClick={handleSaveDrawer}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              Save Configuration
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 pb-6">
        {/* 1. Main Enable Toggle */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              Enable Multi-Pricing for this Item
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              When turned on, visitors from supported locations will see targeted regional prices and local currencies.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            {/* 2. Resolution Mode */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  Resolution Strategy
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">How unlisted countries behave</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('HYBRID')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    mode === 'HYBRID'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-xs'
                      : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between mb-1">
                    <span>Hybrid (Best)</span>
                    {mode === 'HYBRID' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Custom rules take priority; unlisted emerging markets get automatic PPP discount.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('CUSTOM_ONLY')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    mode === 'CUSTOM_ONLY'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-xs'
                      : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between mb-1">
                    <span>Custom Only</span>
                    {mode === 'CUSTOM_ONLY' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Only countries explicitly listed below receive localized price. All others pay base.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('PPP_FALLBACK')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    mode === 'PPP_FALLBACK'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-xs'
                      : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between mb-1">
                    <span>Auto PPP Global</span>
                    {mode === 'PPP_FALLBACK' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    Dynamically scales price globally across Tier 1 (0%), Tier 2 (40%), and Tier 3 (65%).
                  </p>
                </button>
              </div>
            </div>

            {/* 3. Add / Edit Country Override Box */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                    <Plus className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                      {editingRuleIndex !== null ? 'Edit Country Override' : 'Add Country Price Override'}
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Specify exact local currency and price for customers in this territory.
                    </p>
                  </div>
                </div>
                {editingRuleIndex !== null && (
                  <button
                    type="button"
                    onClick={() => setEditingRuleIndex(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Country */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Target Country / Market
                  </label>
                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {filteredCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.currency}) - PPP Tier {c.pppTier}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Rule Type */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Override Rule Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRuleType('FIXED_PRICE')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        ruleType === 'FIXED_PRICE'
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Fixed Price
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleType('PERCENTAGE_DISCOUNT')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        ruleType === 'PERCENTAGE_DISCOUNT'
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      Discount %
                    </button>
                  </div>
                </div>
              </div>

              {/* Price / Percentage Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ruleType === 'FIXED_PRICE' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                        Fixed Local Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-400">
                          {currentCountry.symbol}
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="e.g. 1499"
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                        Currency Code
                      </label>
                      <input
                        type="text"
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-950 dark:text-white focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                        Regional Discount (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(e.target.value)}
                          placeholder="e.g. 50"
                          className="w-full pr-8 pl-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono font-bold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                          %
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-[11px] text-zinc-500 w-full flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>
                          Customer will get {discountPercent}% off converted price in {currentCountry.currency}.
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Suggested World Bank PPP:{' '}
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {currentCountry.suggestedDiscount > 0 ? `${currentCountry.suggestedDiscount}% Off` : '0% Off'}
                    </span>
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCountryRule}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {editingRuleIndex !== null ? 'Update Override' : 'Save Country Override'}
                </Button>
              </div>
            </div>

            {/* 4. Active Rules List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Active Regional Overrides ({rules.length})
                </span>
                <span className="text-[11px] text-zinc-400">
                  {rules.length === 0 ? 'No custom overrides set' : 'Sorted by country'}
                </span>
              </div>

              {rules.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 text-center space-y-2 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <Globe className="w-8 h-8 text-zinc-400 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    No custom country rules defined yet
                  </p>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                    Add overrides above or click{' '}
                    <button
                      type="button"
                      onClick={handleApplyPresetPPP}
                      className="text-indigo-500 font-bold hover:underline"
                    >
                      Apply Smart Presets
                    </button>{' '}
                    to automatically configure major markets like India, Brazil, and the UK.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-white/5">
                  {rules.map((rule, idx) => (
                    <div
                      key={rule.countryCode}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{rule.flag}</span>
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {rule.countryName}
                            <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-bold border border-zinc-200 dark:border-white/5">
                              {rule.countryCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-mono">
                            {rule.ruleType === 'PERCENTAGE_DISCOUNT'
                              ? `${rule.discountPct}% Regional Discount`
                              : `Target Currency: ${rule.currency}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {rule.symbol}
                            {rule.amount} {rule.currency}
                          </span>
                          {rule.discountPct && rule.discountPct > 0 ? (
                            <div className="text-[10px] text-emerald-500 font-bold flex items-center justify-end gap-0.5">
                              <TrendingDown className="w-3 h-3" />
                              {rule.discountPct}% Off Base
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditRule(rule, idx)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            title="Edit Rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.countryCode)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Remove Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PlatformDrawer>
  );
}
