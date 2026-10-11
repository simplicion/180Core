'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Sparkles,
  Sliders,
  ArrowRight,
  Edit2,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getAuthToken } from '@/lib/api-config';

interface GeoRuleItem {
  id: string;
  appId: string;
  countryCode: string;
  discountPercent?: number | null;
  fixedAmount?: number | null;
  customCurrency?: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  tier: number;
  defaultDiscountPercent: number;
}

interface LocalizedPricingResult {
  country: string;
  currency: string;
  originalAmount: number;
  discountPercent: number;
  finalAmount: number;
  formattedAmount: string;
  pppApplied: boolean;
  isOverride: boolean;
}

interface GeoPricingTabProps {
  appId: string;
}

export function GeoPricingTab({ appId }: GeoPricingTabProps) {
  const [rules, setRules] = useState<GeoRuleItem[]>([]);
  const [directory, setDirectory] = useState<CountryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pppEnabled, setPppEnabled] = useState(true);
  const [togglingPPP, setTogglingPPP] = useState(false);

  // Simulator State
  const [simBaseAmount, setSimBaseAmount] = useState('49.00');
  const [simBaseCurrency, setSimBaseCurrency] = useState('USD');
  const [simCountry, setSimCountry] = useState('IN');
  const [simResult, setSimResult] = useState<LocalizedPricingResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Create/Edit Override Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleCountry, setRuleCountry] = useState('IN');
  const [ruleType, setRuleType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [ruleDiscountPercent, setRuleDiscountPercent] = useState('50');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('1499');
  const [ruleCurrency, setRuleCurrency] = useState('INR');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();

      const [rulesRes, dirRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/geo-pricing/apps/${appId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${apiBase}/api/v1/geo-pricing/directory`),
      ]);

      const rulesData = await rulesRes.json();
      const dirData = await dirRes.json();

      if (rulesRes.ok && rulesData.success) {
        setRules(rulesData.rules || rulesData.data || []);
      }
      if (dirRes.ok && dirData.success) {
        setDirectory(dirData.directory || []);
      }
    } catch {
      toast.error('Failed to load geo-pricing configuration');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Run simulation whenever simulator inputs change
  const runSimulation = useCallback(async () => {
    const amount = parseFloat(simBaseAmount);
    if (isNaN(amount) || amount <= 0) return;

    setSimulating(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(
        `${apiBase}/api/v1/geo-pricing/resolve?appId=${appId}&baseAmount=${amount}&baseCurrency=${simBaseCurrency}&country=${simCountry}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setSimResult(data.pricing || data.data);
      }
    } catch {
      // fallback simulation calculation
      const countryObj = directory.find((c) => c.code === simCountry);
      const disc = countryObj ? countryObj.defaultDiscountPercent : 0;
      const finalVal = amount * (1 - disc / 100);
      setSimResult({
        country: simCountry,
        currency: countryObj?.currency || 'USD',
        originalAmount: amount,
        discountPercent: disc,
        finalAmount: finalVal,
        formattedAmount: `${countryObj?.currency || '$'} ${finalVal.toFixed(2)}`,
        pppApplied: disc > 0,
        isOverride: false,
      });
    } finally {
      setSimulating(false);
    }
  }, [appId, simBaseAmount, simBaseCurrency, simCountry, directory]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  const handleTogglePPP = async () => {
    setTogglingPPP(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();
      const newStatus = !pppEnabled;

      const res = await fetch(`${apiBase}/api/v1/geo-pricing/apps/${appId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPppEnabled(newStatus);
        toast.success(`Automated PPP pricing ${newStatus ? 'enabled' : 'disabled'}`);
        runSimulation();
      } else {
        toast.error(data.error || 'Failed to toggle PPP pricing');
      }
    } catch {
      toast.error('Network error toggling PPP pricing');
    } finally {
      setTogglingPPP(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();

      const payload: Record<string, any> = {
        countryCode: ruleCountry,
        currency: ruleCurrency,
        customCurrency: ruleCurrency,
        overrideType: ruleType === 'PERCENT' ? 'PERCENTAGE_DISCOUNT' : 'FIXED_PRICE',
        isEnabled: true,
        isActive: true,
      };

      if (ruleType === 'PERCENT') {
        const pct = parseFloat(ruleDiscountPercent);
        payload.discountPercent = pct;
        payload.discountPct = Math.round(pct);
      } else {
        const amt = parseFloat(ruleFixedAmount);
        payload.fixedAmount = amt;
        payload.planOverrides = { default: amt };
      }

      const res = await fetch(`${apiBase}/api/v1/geo-pricing/apps/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Rule for ${ruleCountry} saved`);
        setShowCreateModal(false);
        setEditingRuleId(null);
        fetchData();
        runSimulation();
      } else {
        toast.error(data.error || 'Failed to save country rule');
      }
    } catch {
      toast.error('Failed to create country rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleOpenEditRule = (rule: GeoRuleItem | any) => {
    setEditingRuleId(rule.id);
    setRuleCountry(rule.countryCode);
    const isPercent =
      rule.overrideType === 'PERCENTAGE_DISCOUNT' ||
      rule.discountPercent != null ||
      rule.discountPct != null;
    setRuleType(isPercent ? 'PERCENT' : 'FIXED');
    setRuleDiscountPercent(
      rule.discountPercent != null
        ? String(rule.discountPercent)
        : rule.discountPct != null
        ? String(rule.discountPct)
        : '50'
    );
    setRuleFixedAmount(
      rule.fixedAmount != null
        ? String(rule.fixedAmount)
        : rule.planOverrides?.default != null
        ? String(rule.planOverrides.default)
        : '1499'
    );
    setRuleCurrency(rule.customCurrency || rule.currency || 'INR');
    setShowCreateModal(true);
  };

  const handleDeleteRule = async (ruleId: string, countryCode: string) => {
    if (!confirm(`Are you sure you want to delete the override for ${countryCode}?`)) return;
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/geo-pricing/apps/${appId}/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Override for ${countryCode} deleted`);
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        runSimulation();
      } else {
        toast.error(data.error || 'Failed to delete rule');
      }
    } catch {
      toast.error('Network error deleting rule');
    }
  };

  const getCountryName = (code: string) => {
    const found = directory.find((c) => c.code === code);
    return found ? `${found.name} (${code})` : code;
  };

  return (
    <div className="space-y-8">
      {/* 1. Top Banner & Automated PPP Toggle */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Globe className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">
                Dynamic Geo-Pricing & PPP Engine
              </h2>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                Cloudflare Edge Detected
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Automatically calculate Purchasing Power Parity (PPP) discounts based on the visitor&apos;s country header (
              <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300">
                CF-IPCountry
              </code>
              ). Increase international revenue by making checkout affordable in developing economies while maintaining full price in high-income markets.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200 dark:border-white/10">
            <div>
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Automated World Bank PPP
              </div>
              <div className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1.5 mt-0.5">
                {pppEnabled ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active (4 World Tiers)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-zinc-400" />
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Disabled (Global Flat USD)</span>
                  </>
                )}
              </div>
            </div>
            <Button
              onClick={handleTogglePPP}
              disabled={togglingPPP}
              variant={pppEnabled ? 'outline' : 'default'}
              size="sm"
              className={
                pppEnabled
                  ? 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium cursor-pointer shadow-xs rounded-xl'
                  : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white text-xs font-medium cursor-pointer shadow-xs rounded-xl'
              }
            >
              {togglingPPP ? 'Updating...' : pppEnabled ? 'Disable PPP' : 'Enable Automated PPP'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Live Regional Simulator Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Sliders className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">Live Regional Price Simulator</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Preview exactly how prices appear to customers worldwide</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runSimulation}
            disabled={simulating}
            className="text-xs border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium rounded-xl cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${simulating ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Base Configuration Input */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Base Product Price</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="number"
                  step="0.01"
                  value={simBaseAmount}
                  onChange={(e) => setSimBaseAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                  placeholder="49.00"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Base Currency</label>
              <select
                value={simBaseCurrency}
                onChange={(e) => setSimBaseCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Simulate Visitor Location</label>
              <select
                value={simCountry}
                onChange={(e) => setSimCountry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
              >
                {directory.length > 0 ? (
                  directory.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code}) - Tier {c.tier} ({c.defaultDiscountPercent}% off)
                    </option>
                  ))
                ) : (
                  <>
                    <option value="US">United States (US) - 0%</option>
                    <option value="GB">United Kingdom (GB) - 0%</option>
                    <option value="IN">India (IN) - 60%</option>
                    <option value="BR">Brazil (BR) - 50%</option>
                    <option value="NG">Nigeria (NG) - 60%</option>
                    <option value="JP">Japan (JP) - 0%</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Arrow / Transition Divider */}
          <div className="flex md:flex-col items-center justify-center text-zinc-400 gap-2">
            <div className="hidden md:block w-px h-12 bg-zinc-200 dark:bg-white/10" />
            <ArrowRight className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            <div className="hidden md:block w-px h-12 bg-zinc-200 dark:bg-white/10" />
          </div>

          {/* Calculated Output Card */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Localized Customer Price
                </span>
                {simResult?.isOverride ? (
                  <span className="text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    Custom Override
                  </span>
                ) : simResult?.pppApplied ? (
                  <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    PPP Applied
                  </span>
                ) : (
                  <span className="text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2.5 py-0.5 rounded-full">
                    Standard Rate
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-3xl sm:text-4xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
                  {simResult ? simResult.formattedAmount : '...'}
                </div>
                {simResult && simResult.discountPercent > 0 && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="line-through text-zinc-400 dark:text-zinc-500">${simBaseAmount}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {simResult.discountPercent}% purchasing power discount
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-indigo-200/60 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
              <div className="flex justify-between">
                <span>Target Market:</span>
                <span className="text-zinc-950 dark:text-zinc-200 font-bold">{getCountryName(simCountry)}</span>
              </div>
              <div className="flex justify-between">
                <span>Currency Settlement:</span>
                <span className="text-zinc-950 dark:text-zinc-200 font-bold font-mono">{simResult?.currency || 'USD'}</span>
              </div>
              <div className="flex justify-between">
                <span>Psychological Rounding:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">Automatic (.99 / .00 local standard)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. World Bank PPP Tiers Overview Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">World Bank PPP Discount Benchmark</h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10">
              Updated Quarterly
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Automated pricing automatically maps international users to one of 4 purchasing power tiers:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/40 space-y-1.5">
            <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Tier 1: High Income</div>
            <div className="text-2xl font-extrabold text-zinc-950 dark:text-white">0% Off</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
              United States, United Kingdom, Canada, Australia, Germany, Japan, Singapore
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-indigo-200/80 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-1.5">
            <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Tier 2: Upper Middle</div>
            <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">30% Off</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
              Poland, Chile, Malaysia, Hungary, Romania, Croatia
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-purple-200/80 dark:border-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20 space-y-1.5">
            <div className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Tier 3: Middle Income</div>
            <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300">50% Off</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
              Brazil, Mexico, Turkey, South Africa, Colombia, Argentina
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Tier 4: Growth Markets</div>
            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">60% Off</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pt-1">
              India, Indonesia, Philippines, Nigeria, Kenya, Vietnam, Pakistan
            </p>
          </div>
        </div>
      </div>

      {/* 4. Custom Country Overrides Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">Custom Country Overrides</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Need specific pricing for a key partner or country? Define custom fixed rates or percentage discounts that override default PPP.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white shadow-xs text-xs font-medium cursor-pointer rounded-xl"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Country Override
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-500 dark:text-zinc-400 text-sm">Loading custom overrides...</div>
        ) : rules.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/20 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2">
              <Globe className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">No Custom Overrides Defined</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              Your app is currently running 100% on automated World Bank PPP tiers. Add custom overrides if you need fixed pricing in specific countries.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 dark:border-white/10 text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60">
                  <tr>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4">Rule Type</th>
                    <th className="py-3 px-4">Override Value</th>
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-zinc-950 dark:text-white flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                          {rule.countryCode}
                        </span>
                        <span>{getCountryName(rule.countryCode)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-300 font-medium">
                        {(rule.discountPercent != null || (rule as any).discountPct != null || (rule as any).overrideType === 'PERCENTAGE_DISCOUNT')
                          ? 'Percentage Discount'
                          : 'Fixed Price Override'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {(rule.discountPercent != null || (rule as any).discountPct != null)
                          ? `${rule.discountPercent ?? (rule as any).discountPct}% OFF`
                          : `${rule.customCurrency || (rule as any).currency || '$'} ${rule.fixedAmount ?? (rule as any).planOverrides?.default ?? '0'}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-400 font-medium">{rule.customCurrency || (rule as any).currency || 'USD'}</td>
                      <td className="py-3.5 px-4">
                        {rule.isEnabled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200 dark:border-white/10">
                            <XCircle className="h-3 w-3" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditRule(rule)}
                            className="text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 h-8 w-8 p-0 cursor-pointer rounded-xl"
                            title="Edit Country Override"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id, rule.countryCode)}
                            className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 h-8 w-8 p-0 cursor-pointer rounded-xl"
                            title="Delete Country Override"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Country Override Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
              <h3 className="font-bold text-zinc-950 dark:text-white flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                {editingRuleId ? 'Edit Country Override' : 'Add Country Override'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRuleId(null);
                }}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white text-xl font-bold cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Target Country</label>
                <select
                  value={ruleCountry}
                  onChange={(e) => {
                    const code = e.target.value;
                    setRuleCountry(code);
                    const found = directory.find((c) => c.code === code);
                    if (found) setRuleCurrency(found.currency);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                >
                  {directory.length > 0 ? (
                    directory.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code}) - {c.currency}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="IN">India (IN)</option>
                      <option value="BR">Brazil (BR)</option>
                      <option value="NG">Nigeria (NG)</option>
                      <option value="TR">Turkey (TR)</option>
                      <option value="ID">Indonesia (ID)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Rule Model</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleType('PERCENT')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      ruleType === 'PERCENT'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Percent className="h-3.5 w-3.5" />
                    Percentage Off
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleType('FIXED')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      ruleType === 'FIXED'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    Fixed Amount
                  </button>
                </div>
              </div>

              {ruleType === 'PERCENT' ? (
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Discount Percentage (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={ruleDiscountPercent}
                    onChange={(e) => setRuleDiscountPercent(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                    placeholder="e.g. 50"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Fixed Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ruleFixedAmount}
                      onChange={(e) => setRuleFixedAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-medium"
                      placeholder="1499"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Currency</label>
                    <input
                      type="text"
                      value={ruleCurrency}
                      onChange={(e) => setRuleCurrency(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-mono font-medium"
                      placeholder="INR"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-200 dark:border-white/10 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingRuleId(null);
                  }}
                  className="border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs cursor-pointer shadow-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingRule}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white font-medium text-xs cursor-pointer shadow-xs rounded-xl"
                >
                  {savingRule ? 'Saving...' : 'Save Override'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
