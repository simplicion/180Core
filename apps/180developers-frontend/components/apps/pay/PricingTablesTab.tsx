'use strict';
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  Save,
  Sparkles,
  Code2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Palette,
  Sliders,
  Settings2,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  Download,
  CopyCheck,
  Zap,
  Tag,
  Shield,
  X,
  FileCode,
  LayoutGrid,
  Globe,
  Terminal,
  Lock,
  Key,
  Cpu,
} from 'lucide-react';
import { Button, UniversalSkeleton } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getPublicBase, getAuthToken } from '@/lib/api-config';
import { MultiPricingDrawer, MultiPricingConfig } from '@/components/pay/MultiPricingDrawer';

export interface PlanFeatureItem {
  text: string;
  included?: boolean;
  note?: string;
}

export interface PlanCard {
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
  featureKeys?: string[];
  buttonText?: string;
  buttonUrl?: string;
  isFree?: boolean;
  multiPricing?: MultiPricingConfig;
}

export interface PricingConfig {
  appId: string;
  appName?: string;
  appLogo?: string;
  clientId?: string;
  appDescription?: string;
  headline: string;
  subheadline: string;
  theme: string;
  accentColor: string;
  billingIntervals: string[];
  yearlyDiscountPct: number;
  planCards: PlanCard[];
  customCss?: string;
  showTrustBadge?: boolean;
  showIntervalToggle?: boolean;
}

export interface AvailablePlan {
  id: string;
  planCode: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: string;
  trialDays?: number;
  metadata?: any;
}

interface PricingTablesTabProps {
  appId: string;
}

const ACCENT_COLOR_PRESETS = [
  { name: 'Electric Indigo', hex: '#6366f1' },
  { name: 'Universal Violet', hex: '#8b5cf6' },
  { name: 'Emerald Growth', hex: '#10b981' },
  { name: 'Cyber Cyan', hex: '#06b6d4' },
  { name: 'Rose Sunset', hex: '#f43f5e' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Obsidian Minimal', hex: '#ffffff' },
];

const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
  { code: 'SGD', symbol: 'S$', label: 'SGD (S$)' },
];

export function PricingTablesTab({ appId }: PricingTablesTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PricingConfig>({
    appId,
    headline: '',
    subheadline: '',
    theme: 'auto',
    accentColor: '#6366f1',
    billingIntervals: ['MONTHLY', 'YEARLY'],
    yearlyDiscountPct: 20,
    planCards: [],
    customCss: '',
    showTrustBadge: true,
    showIntervalToggle: true,
  });

  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([]);
  const [syncToSubscriptionPlans, setSyncToSubscriptionPlans] = useState(true);

  // View state
  const [activeTab, setActiveTab] = useState<'tiers' | 'styling' | 'snippets' | 'custom_css' | 'api'>('tiers');
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('editor');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewInterval, setPreviewInterval] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [copiedSnippet, setCopiedSnippet] = useState<'wc' | 'iframe' | 'react' | 'url' | 'headless' | 'token' | null>(null);

  // Modal: Edit/Create Tier
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardCode, setCardCode] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [cardYearlyAmount, setCardYearlyAmount] = useState('');
  const [cardCurrency, setCardCurrency] = useState('USD');
  const [cardTrialDays, setCardTrialDays] = useState('0');
  const [cardPopular, setCardPopular] = useState(false);
  const [cardBadgeText, setCardBadgeText] = useState('');
  const [cardBadgeColor, setCardBadgeColor] = useState('indigo');
  const [cardButtonText, setCardButtonText] = useState('Get Started');
  const [cardButtonUrl, setCardButtonUrl] = useState('');
  const [cardIsFree, setCardIsFree] = useState(false);
  const [cardFeatures, setCardFeatures] = useState<PlanFeatureItem[]>([]);
  const [cardFeatureKeys, setCardFeatureKeys] = useState<string[]>([]);
  const [newFeatureKeyInput, setNewFeatureKeyInput] = useState('');
  const [newFeatureText, setNewFeatureText] = useState('');
  const [newFeatureIncluded, setNewFeatureIncluded] = useState(true);

  // Multi-Pricing Drawer State for Tier
  const [showMultiPricingDrawer, setShowMultiPricingDrawer] = useState(false);
  const [cardMultiPricing, setCardMultiPricing] = useState<MultiPricingConfig>({
    enabled: false,
    mode: 'HYBRID',
    rules: [],
  });

  // Headless & Entitlements Tab State
  const [liveHeadlessData, setLiveHeadlessData] = useState<any>(null);
  const [testingHeadless, setTestingHeadless] = useState(false);
  const [headlessCodeTab, setHeadlessCodeTab] = useState<'fetch' | 'node_verify' | 'nextjs_edge' | 'python' | 'webhook'>('fetch');



  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/api/v1/pricing-tables/${appId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setConfig({
          appId,
          appName: data.config.appName,
          appLogo: data.config.appLogo,
          clientId: data.config.clientId,
          appDescription: data.config.appDescription,
          headline: data.config.headline || `${data.config.appName || 'Platform'} Plans & Pricing`,
          subheadline: data.config.subheadline || 'Choose the plan that fits your growth',
          theme: data.config.theme || 'auto',
          accentColor: data.config.accentColor || '#6366f1',
          billingIntervals: data.config.billingIntervals || ['MONTHLY', 'YEARLY'],
          yearlyDiscountPct: data.config.yearlyDiscountPct ?? 20,
          planCards: Array.isArray(data.config.planCards) ? data.config.planCards : [],
          customCss: data.config.customCss || '',
          showTrustBadge: data.config.showTrustBadge !== false,
          showIntervalToggle: data.config.showIntervalToggle !== false,
        });

        if (Array.isArray(data.availablePlans)) {
          setAvailablePlans(data.availablePlans);
        }
      }
    } catch {
      toast.error('Failed to load pricing table settings');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/api/v1/pricing-tables/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...config,
          syncToSubscriptionPlans,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          syncToSubscriptionPlans
            ? 'Pricing table saved & synced with 180 Pay subscriptions!'
            : 'Pricing table configuration saved!'
        );
        fetchConfig();
      } else {
        toast.error(data.error || 'Failed to save configuration');
      }
    } catch {
      toast.error('Network error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  // Open modal to create a new tier without hardcoded defaults
  const openCreateCardModal = () => {
    setEditingCardIndex(null);
    setCardName('');
    setCardCode('');
    setCardDescription('');
    setCardAmount('');
    setCardYearlyAmount('');
    setCardCurrency(config.planCards[0]?.currency || 'USD');
    setCardTrialDays('0');
    setCardPopular(config.planCards.length === 0);
    setCardBadgeText('');
    setCardBadgeColor('indigo');
    setCardButtonText('Get Started');
    setCardButtonUrl('');
    setCardIsFree(false);
    setCardFeatures([]);
    setCardFeatureKeys([]);
    setNewFeatureKeyInput('');
    setNewFeatureText('');
    setNewFeatureIncluded(true);
    setCardMultiPricing({ enabled: false, mode: 'HYBRID', rules: [] });
    setShowCardModal(true);
  };

  const openEditCardModal = (index: number) => {
    const card = config.planCards[index];
    if (!card) return;
    setEditingCardIndex(index);
    setCardName(card.name);
    setCardCode(card.planCode);
    setCardDescription(card.description || '');
    setCardAmount(card.isFree || card.amount === 0 ? '0' : String(card.amount));
    setCardYearlyAmount(card.yearlyAmount ? String(card.yearlyAmount) : '');
    setCardCurrency(card.currency || 'USD');
    setCardTrialDays(String(card.trialDays || 0));
    setCardPopular(Boolean(card.isPopular));
    setCardBadgeText(card.badgeText || '');
    setCardBadgeColor(card.badgeColor || 'indigo');
    setCardButtonText(card.buttonText || 'Get Started');
    setCardButtonUrl(card.buttonUrl || '');
    setCardIsFree(Boolean(card.isFree || card.amount === 0));
    setCardFeatureKeys(Array.isArray(card.featureKeys) ? card.featureKeys : []);
    setNewFeatureKeyInput('');

    const existingMp = card.multiPricing;
    if (existingMp && typeof existingMp === 'object') {
      setCardMultiPricing({
        enabled: Boolean(existingMp.enabled),
        mode: existingMp.mode || 'HYBRID',
        rules: Array.isArray(existingMp.rules) ? existingMp.rules : [],
      });
    } else {
      setCardMultiPricing({ enabled: false, mode: 'HYBRID', rules: [] });
    }

    // Normalize features
    const normalized = (card.features || []).map((f) => {
      if (typeof f === 'object' && f !== null) {
        return { text: f.text, included: f.included !== false, note: f.note };
      }
      return { text: String(f), included: true };
    });
    setCardFeatures(normalized);
    setNewFeatureText('');
    setNewFeatureIncluded(true);
    setShowCardModal(true);
  };

  const handleDuplicateCard = (index: number) => {
    const card = config.planCards[index];
    if (!card) return;
    const duplicated: PlanCard = {
      ...card,
      name: `${card.name} (Copy)`,
      planCode: `${card.planCode}_copy_${Date.now().toString(36).slice(-4)}`,
      isPopular: false,
    };
    const updated = [...config.planCards, duplicated];
    setConfig({ ...config, planCards: updated });
    toast.success('Tier duplicated');
  };

  const handleMoveCard = (index: number, direction: 'left' | 'right') => {
    const newIdx = direction === 'left' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= config.planCards.length) return;
    const updated = [...config.planCards];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setConfig({ ...config, planCards: updated });
  };

  const handleAddFeatureKey = () => {
    const raw = newFeatureKeyInput.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
    if (!raw) return;
    if (!cardFeatureKeys.includes(raw)) {
      setCardFeatureKeys([...cardFeatureKeys, raw]);
    }
    setNewFeatureKeyInput('');
  };

  const handleRemoveFeatureKey = (key: string) => {
    setCardFeatureKeys(cardFeatureKeys.filter((k) => k !== key));
  };

  const testHeadlessEndpoint = async () => {
    setTestingHeadless(true);
    try {
      const apiBase = getApiBase();
      const targetId = config.clientId || appId;
      const res = await fetch(`${apiBase}/api/v1/pricing-tables/${targetId}/headless`);
      const data = await res.json();
      setLiveHeadlessData(data);
      if (res.ok && data.success) {
        toast.success('Headless API responded with live plan data!');
      } else {
        toast.error(data.error || 'Failed to fetch headless data');
      }
    } catch (err: any) {
      toast.error(`Headless API error: ${err.message}`);
    } finally {
      setTestingHeadless(false);
    }
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) {
      toast.error('Tier name is required');
      return;
    }

    const autoCode =
      cardCode.trim() || cardName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
    const amountVal = cardIsFree ? 0 : parseFloat(cardAmount);

    if (!cardIsFree && (isNaN(amountVal) || amountVal < 0)) {
      toast.error('Please enter a valid monthly price or mark as Free Tier');
      return;
    }

    const yearlyAmountVal = cardYearlyAmount.trim() ? parseFloat(cardYearlyAmount) : undefined;
    const trialDaysVal = parseInt(cardTrialDays, 10);

    const newCard: PlanCard = {
      planCode: autoCode,
      name: cardName.trim(),
      description: cardDescription.trim(),
      amount: amountVal,
      yearlyAmount: yearlyAmountVal,
      currency: cardCurrency,
      trialDays: isNaN(trialDaysVal) || trialDaysVal <= 0 ? 0 : trialDaysVal,
      isPopular: cardPopular,
      badgeText: cardBadgeText.trim() || undefined,
      badgeColor: cardBadgeColor,
      features: cardFeatures.filter((f) => f.text.trim().length > 0),
      featureKeys: cardFeatureKeys,
      buttonText: cardButtonText.trim() || (cardIsFree ? 'Get Started Free' : 'Choose Plan'),
      buttonUrl: cardButtonUrl.trim() || undefined,
      isFree: cardIsFree || amountVal === 0,
      multiPricing: cardMultiPricing,
    };

    const updated = [...config.planCards];
    if (editingCardIndex !== null && editingCardIndex >= 0) {
      updated[editingCardIndex] = newCard;
    } else {
      updated.push(newCard);
    }

    setConfig({ ...config, planCards: updated });
    setShowCardModal(false);
    toast.success(editingCardIndex !== null ? 'Plan tier updated' : 'Plan tier added');
  };

  const handleDeleteCard = (index: number) => {
    const updated = config.planCards.filter((_, i) => i !== index);
    setConfig({ ...config, planCards: updated });
    toast.success('Plan tier removed');
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    setCardFeatures([
      ...cardFeatures,
      { text: newFeatureText.trim(), included: newFeatureIncluded },
    ]);
    setNewFeatureText('');
    setNewFeatureIncluded(true);
  };

  const handleRemoveFeature = (idx: number) => {
    setCardFeatures(cardFeatures.filter((_, i) => i !== idx));
  };

  const handleToggleFeatureIncluded = (idx: number) => {
    const updated = [...cardFeatures];
    updated[idx] = { ...updated[idx], included: !updated[idx].included };
    setCardFeatures(updated);
  };

  const handleMoveFeature = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cardFeatures.length) return;
    const updated = [...cardFeatures];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setCardFeatures(updated);
  };

  const copySnippet = (type: 'wc' | 'iframe' | 'react' | 'url') => {
    const publicBase = getPublicBase();
    let snippet = '';

    if (type === 'wc') {
      snippet = `<!-- 180 Pay Web Component -->\n<script src="${publicBase}/sdk/v1/180-core-sdk.js" async></script>\n<one-eighty-pricing-table\n  app-id="${appId}"\n  theme="${config.theme}"\n  accent-color="${config.accentColor}">\n</one-eighty-pricing-table>`;
    } else if (type === 'iframe') {
      snippet = `<!-- 180 Pay Responsive IFrame Embed -->\n<iframe\n  src="${publicBase}/embed/pricing/${appId}"\n  width="100%"\n  height="720"\n  frameborder="0"\n  scrolling="no"\n  style="border:none;border-radius:24px;overflow:hidden;"\n></iframe>`;
    } else if (type === 'react') {
      snippet = `// React / Next.js Component\nimport { OneEightyPricingTable } from '@workspace/identity-sdk';\n\nexport function PricingSection() {\n  return (\n    <OneEightyPricingTable\n      appId="${appId}"\n      theme="${config.theme}"\n      accentColor="${config.accentColor}"\n    />\n  );\n}`;
    } else {
      snippet = `${publicBase}/embed/pricing/${appId}`;
    }

    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(type);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  const getCurrencySymbol = (code?: string) => {
    const item = CURRENCY_OPTIONS.find((c) => c.code === code);
    return item ? item.symbol : '$';
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-8 shadow-sm">
        <UniversalSkeleton type="form" />
      </div>
    );
  }

  const yearlyDiscount = config.yearlyDiscountPct ?? 20;

  return (
    <div className="space-y-6">
      {/* Top Header & Studio Navigation Bar */}
      <div className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-7 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
                  <span>Embeddable Pricing Table Studio</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                    Pro Builder
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configure subscription tiers with auto-sync to 180 Pay recurring billing, dynamic styling & multi-device preview.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === 'editor'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`hidden md:block px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Split View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Live Preview
              </button>
            </div>



            {/* Save Configuration Button */}
            <Button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save & Sync</span>
            </Button>
          </div>
        </div>

        {/* Studio Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto text-xs border-b border-zinc-100 dark:border-white/5 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('tiers')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'tiers'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Subscription Tiers ({config.planCards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('styling')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'styling'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Branding & Appearance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('snippets')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'snippets'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Embed Snippets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom_css')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'custom_css'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Custom CSS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'api'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Headless API & Entitlements</span>
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">New</span>
          </button>
        </div>

        {/* Global Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Table Headline
            </label>
            <input
              type="text"
              placeholder="e.g. Choose the plan tailored for your scale"
              value={config.headline}
              onChange={(e) => setConfig({ ...config, headline: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Subheadline / Tagline
            </label>
            <input
              type="text"
              placeholder="e.g. Upgrade or cancel anytime. All plans include 180 Pay protection."
              value={config.subheadline}
              onChange={(e) => setConfig({ ...config, subheadline: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Annual Billing Discount (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={90}
                value={config.yearlyDiscountPct}
                onChange={(e) => setConfig({ ...config, yearlyDiscountPct: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 pr-16"
              />
              <span className="absolute right-3 top-2 text-[11px] font-bold text-emerald-500">
                Save {config.yearlyDiscountPct}%
              </span>
            </div>
          </div>
        </div>

        {/* 180 Pay Engine Sync Checkbox */}
        <div className="pt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncToSubscriptionPlans}
              onChange={(e) => setSyncToSubscriptionPlans(e.target.checked)}
              className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
            />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Auto-sync tiers to 180 Pay Recurring Subscription Engine (enables gateway rebilling & webhooks)
            </span>
          </label>

          <a
            href={`${getPublicBase()}/embed/pricing/${appId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            <span>Live Hosted URL</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Studio Body: Editor or Split View */}
      <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Left Column: Editor Tabs */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className="space-y-6">
            {/* Tab 1: Tiers */}
            {activeTab === 'tiers' && (
              <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                      Subscription Plan Tiers ({config.planCards.length})
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Configure individual pricing plans, features, trial periods and CTA buttons.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={openCreateCardModal}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 font-bold shadow-md shadow-purple-600/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Plan Tier</span>
                  </Button>
                </div>

                {/* Empty State */}
                {config.planCards.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/20 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div className="max-w-sm mx-auto">
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                        No Subscription Tiers Created Yet
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Build your tiers from scratch, import from your registered 180 Pay plans, or apply a curated SaaS template.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={openCreateCardModal}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Tier</span>
                      </Button>


                    </div>
                  </div>
                ) : (
                  /* Cards List with Reordering */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {config.planCards.map((card, idx) => {
                      const isFree = card.isFree || card.amount === 0;
                      const currencySymbol = getCurrencySymbol(card.currency);

                      return (
                        <div
                          key={card.planCode || idx}
                          className={`rounded-2xl border p-4 space-y-3 relative group transition-all ${
                            card.isPopular
                              ? 'border-purple-500/40 bg-purple-500/[0.03] dark:bg-purple-950/20 shadow-md'
                              : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50'
                          }`}
                        >
                          {/* Header of Tier Card */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                                  {card.name}
                                </h4>
                                {card.isPopular && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold border border-purple-500/20">
                                    {card.badgeText || 'Popular'}
                                  </span>
                                )}
                                {card.trialDays && card.trialDays > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">
                                    {card.trialDays}d Trial
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[11px] font-mono text-zinc-500">{card.planCode}</span>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveCard(idx, 'left')}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white disabled:opacity-30"
                                title="Move Left"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === config.planCards.length - 1}
                                onClick={() => handleMoveCard(idx, 'right')}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white disabled:opacity-30"
                                title="Move Right"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateCard(idx)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-purple-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                title="Duplicate"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCardModal(idx)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-purple-600 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCard(idx)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Price Display */}
                          <div className="flex items-baseline gap-1 font-mono">
                            {isFree ? (
                              <span className="text-xl font-black text-zinc-950 dark:text-white">Free</span>
                            ) : (
                              <>
                                <span className="text-xl font-black text-zinc-950 dark:text-white">
                                  {currencySymbol}
                                  {card.amount}
                                </span>
                                <span className="text-xs text-zinc-500">/mo</span>
                              </>
                            )}
                          </div>

                          {/* Regional Multi-Pricing Indicator */}
                          {card.multiPricing?.enabled && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-600 dark:text-purple-400 font-semibold w-fit">
                              <Globe className="w-3 h-3 text-purple-500 shrink-0" />
                              <span>
                                {card.multiPricing.rules?.length || 0} Regional Override{(card.multiPricing.rules?.length || 0) === 1 ? '' : 's'} Active
                              </span>
                            </div>
                          )}

                          {/* Features Summary */}
                          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                            {(card.features || []).slice(0, 3).map((feat, fIdx) => {
                              const isObj = typeof feat === 'object' && feat !== null;
                              const featText = isObj ? feat.text : String(feat);
                              const isIncluded = isObj ? feat.included !== false : true;

                              return (
                                <li
                                  key={fIdx}
                                  className={`flex items-center gap-1.5 truncate ${
                                    isIncluded ? '' : 'text-zinc-400 line-through'
                                  }`}
                                >
                                  {isIncluded ? (
                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                  ) : (
                                    <span className="text-zinc-400 text-xs font-bold shrink-0">✕</span>
                                  )}
                                  <span className="truncate">{featText}</span>
                                </li>
                              );
                            })}
                            {card.features?.length > 3 && (
                              <li className="text-[11px] text-zinc-500 font-medium">
                                +{card.features.length - 3} more features
                              </li>
                            )}
                          </ul>

                          {/* Machine-Readable Feature Keys */}
                          {card.featureKeys && card.featureKeys.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-2 border-t border-zinc-200/50 dark:border-white/5">
                              {card.featureKeys.slice(0, 3).map((k) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-[9px]"
                                >
                                  {k}
                                </span>
                              ))}
                              {card.featureKeys.length > 3 && (
                                <span className="text-[9px] text-zinc-500 font-mono self-center">
                                  +{card.featureKeys.length - 3} keys
                                </span>
                              )}
                            </div>
                          )}

                          {/* CTA Button Preview */}
                          <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5">
                            <span className="text-[11px] text-zinc-500 font-medium flex items-center justify-between">
                              <span>CTA Button:</span>
                              <span className="font-semibold text-zinc-900 dark:text-white">
                                {card.buttonText || 'Get Started'}
                              </span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Branding & Appearance */}
            {activeTab === 'styling' && (
              <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-6 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                    Theme & Color Palette
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Customize the look and feel to match your brand style guidelines.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                      Theme Mode
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'auto', label: 'Adaptive Auto', desc: 'Syncs with user OS / browser' },
                        { id: 'dark', label: 'Obsidian Dark', desc: 'Deep obsidian black' },
                        { id: 'light', label: 'Clean Light', desc: 'Minimal paper white' },
                      ].map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setConfig({ ...config, theme: t.id })}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                            config.theme === t.id
                              ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                          }`}
                        >
                          <div className="font-bold text-xs text-zinc-950 dark:text-white">{t.label}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">{t.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                      Brand Accent Color
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENT_COLOR_PRESETS.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setConfig({ ...config, accentColor: color.hex })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                            config.accentColor.toLowerCase() === color.hex.toLowerCase()
                              ? 'border-zinc-950 dark:border-white ring-2 ring-purple-500/40'
                              : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-zinc-900 dark:text-white">{color.name}</span>
                        </button>
                      ))}

                      {/* Custom Hex Color Picker */}
                      <div className="flex items-center gap-1 pl-2">
                        <input
                          type="color"
                          value={config.accentColor}
                          onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-zinc-200 dark:border-white/10 p-0.5"
                        />
                        <input
                          type="text"
                          value={config.accentColor}
                          onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                          className="w-20 px-2 py-1 text-xs font-mono uppercase rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Display Toggles */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-white/10 space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                          Show Annual / Monthly Interval Switcher
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Allows visitors to toggle between monthly and yearly billing discounts.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.billingIntervals.includes('YEARLY')}
                        onChange={(e) => {
                          const hasYearly = e.target.checked;
                          setConfig({
                            ...config,
                            billingIntervals: hasYearly ? ['MONTHLY', 'YEARLY'] : ['MONTHLY'],
                          });
                        }}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                          Show 180 Pay Trust & Security Badge
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          Displays "Secure 256-bit encrypted checkout powered by 180 Pay" footer.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.showTrustBadge !== false}
                        onChange={(e) => setConfig({ ...config, showTrustBadge: e.target.checked })}
                        className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Embed Snippets */}
            {activeTab === 'snippets' && (
              <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-6 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                    Embed Snippets & Code Integration
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Embed on any website, CMS (WordPress, Webflow, Shopify) or React application.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Web Component Snippet */}
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-purple-500" />
                          <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                            HTML Web Component (Universal)
                          </h4>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Native custom element, lightweight & matches host page CSS styles.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => copySnippet('wc')}
                        className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-zinc-900 dark:text-white"
                      >
                        {copiedSnippet === 'wc' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSnippet === 'wc' ? 'Copied' : 'Copy Snippet'}</span>
                      </Button>
                    </div>
                    <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto">
                      {`<script src="${getPublicBase()}/sdk/v1/180-core-sdk.js" async></script>\n<one-eighty-pricing-table app-id="${appId}" theme="${config.theme}" accent-color="${config.accentColor}"></one-eighty-pricing-table>`}
                    </pre>
                  </div>

                  {/* Responsive IFrame Snippet */}
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4 text-purple-500" />
                          <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                            Responsive IFrame Embed
                          </h4>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Complete sandbox isolation with zero CSS collision risks.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => copySnippet('iframe')}
                        className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-zinc-900 dark:text-white"
                      >
                        {copiedSnippet === 'iframe' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSnippet === 'iframe' ? 'Copied' : 'Copy IFrame'}</span>
                      </Button>
                    </div>
                    <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto">
                      {`<iframe src="${getPublicBase()}/embed/pricing/${appId}" width="100%" height="700" frameborder="0" scrolling="no" style="border:none;border-radius:24px;"></iframe>`}
                    </pre>
                  </div>

                  {/* React SDK Component Snippet */}
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                            React / Next.js Component
                          </h4>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          Type-safe import from <code>@workspace/identity-sdk</code>.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => copySnippet('react')}
                        className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-zinc-900 dark:text-white"
                      >
                        {copiedSnippet === 'react' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSnippet === 'react' ? 'Copied' : 'Copy Code'}</span>
                      </Button>
                    </div>
                    <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] overflow-x-auto">
                      {`import { OneEightyPricingTable } from '@workspace/identity-sdk';\n\n<OneEightyPricingTable appId="${appId}" theme="${config.theme}" accentColor="${config.accentColor}" />`}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Custom CSS */}
            {activeTab === 'custom_css' && (
              <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                    Custom CSS Overrides
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Inject bespoke CSS rules targeting <code>.one-eighty-pricing-table</code> or tier cards.
                  </p>
                </div>

                <textarea
                  rows={8}
                  placeholder={`/* Example custom CSS overrides */\n.one-eighty-pricing-card {\n  backdrop-filter: blur(12px);\n}`}
                  value={config.customCss || ''}
                  onChange={(e) => setConfig({ ...config, customCss: e.target.value })}
                  className="w-full p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-950 font-mono text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}

            {/* Tab 5: Headless API & Entitlements Engine */}
            {activeTab === 'api' && (
              <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-6 shadow-sm">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Zap className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                        Headless Pricing API &amp; 0ms Entitlements
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                      Fetch raw subscription data to render your own custom CSS &amp; frontend components. Check user feature bundles with cryptographically signed tokens verified offline in 0ms.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={testHeadlessEndpoint}
                    disabled={testingHeadless}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 font-bold shrink-0 shadow-md shadow-amber-600/20"
                  >
                    {testingHeadless ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span>Test Live Headless API</span>
                  </Button>
                </div>

                {/* Domain Whitelist Banner */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        Whitelisted Domain Security (CORS Protected)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-500">
                      App Client ID: <code className="text-purple-400">{config.clientId || appId}</code>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Public visitors can only fetch this headless JSON from web domains you have whitelisted under{' '}
                    <strong className="text-zinc-900 dark:text-white">Project Settings &gt; Allowed Origins</strong>{' '}
                    (e.g.{' '}
                    <code className="text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">https://yourdomain.com</code>). Requests originating from unlisted domains will be blocked by CORS to prevent scraping.
                  </p>
                </div>

                {/* Headless API Endpoint Card */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Headless Public JSON Endpoint</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${getApiBase()}/api/v1/pricing-tables/${config.clientId || appId}/headless`;
                        navigator.clipboard.writeText(url);
                        setCopiedSnippet('headless');
                        setTimeout(() => setCopiedSnippet(null), 2000);
                        toast.success('Endpoint URL copied to clipboard');
                      }}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      {copiedSnippet === 'headless' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSnippet === 'headless' ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 font-mono text-xs text-zinc-800 dark:text-zinc-200 overflow-x-auto">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                      GET
                    </span>
                    <span className="truncate">{`${getApiBase()}/api/v1/pricing-tables/${config.clientId || appId}/headless`}</span>
                  </div>
                </div>

                {/* Live JSON Response Inspector (if tested) */}
                {liveHeadlessData && (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Live Headless Response Payload ({liveHeadlessData.plans?.length || 0} plans)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(liveHeadlessData, null, 2));
                          toast.success('JSON response copied');
                        }}
                        className="text-xs text-zinc-500 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-2xl bg-zinc-950 text-zinc-300 font-mono text-[11px] max-h-56 overflow-y-auto border border-white/5">
                      {JSON.stringify(liveHeadlessData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* The 3 Pillars of Gold Standard Entitlements Architecture */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-1.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Feature Bundles</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Link machine-readable keys (e.g. <code>traffic:cloaking</code>) to each plan tier. When purchased, these exact features are permanently bound to the subscription.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-1.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">0ms Local Verification</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      180 Pay issues a cryptographically signed Entitlement Token (SET). Your backend or edge middleware validates it with zero network roundtrips.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 space-y-1.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Automated Invalidation</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Razorpay &amp; 180 Pay billing engine triggers recurring renewals. If payment fails or card expires, signed webhooks revoke access in real time.
                    </p>
                  </div>
                </div>

                {/* Developer Implementation Code Snippets */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                      Integration Code Examples
                    </h4>
                    <span className="text-[11px] text-zinc-500">Pick your stack</span>
                  </div>

                  {/* Code Tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-xs overflow-x-auto">
                    {[
                      { id: 'fetch', label: '1. Frontend Fetch' },
                      { id: 'node_verify', label: '2. Node.js (0ms Verify)' },
                      { id: 'nextjs_edge', label: '3. Next.js Edge' },
                      { id: 'python', label: '4. Python FastAPI' },
                      { id: 'webhook', label: '5. Webhook Auto-Sync' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setHeadlessCodeTab(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 ${
                          headlessCodeTab === tab.id
                            ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Code Block Display */}
                  <div className="relative">
                    <pre className="p-4 rounded-2xl bg-zinc-950 text-zinc-200 font-mono text-[11px] leading-relaxed overflow-x-auto border border-white/5">
                      {headlessCodeTab === 'fetch' &&
                        `// Fetch headless pricing data on your whitelisted domain\nconst res = await fetch('${getApiBase()}/api/v1/pricing-tables/${config.clientId || appId}/headless');\nconst { plans, settings } = await res.json();\n\n// Render with your own custom CSS classes & styling\nplans.forEach((plan) => {\n  console.log('Tier:', plan.name, 'Price:', plan.amount, 'Features:', plan.featureKeys);\n  // Direct checkout link that triggers 180 Pay checkout modal:\n  // window.location.href = plan.checkoutUrl;\n});`}

                      {headlessCodeTab === 'node_verify' &&
                        `import jwt from 'jsonwebtoken';\n\n// 0ms LOCAL VERIFICATION: Zero network roundtrips!\n// Verified directly in memory with your App Client Secret.\nexport function checkEntitlement(token: string, requiredFeature: string): boolean {\n  try {\n    const payload = jwt.verify(token, process.env.ONE_EIGHTY_CLIENT_SECRET!) as {\n      sub: string;\n      status: string;\n      features: string[];\n      exp: number;\n    };\n\n    if (payload.status !== 'ACTIVE' && payload.status !== 'TRIALING') return false;\n    return payload.features.includes(requiredFeature);\n  } catch (err) {\n    return false; // Signature invalid or token expired\n  }\n}`}

                      {headlessCodeTab === 'nextjs_edge' &&
                        `import { NextResponse } from 'next/server';\nimport type { NextRequest } from 'next/server';\nimport { jwtVerify } from 'jose';\n\n// Edge Middleware to protect premium routes in < 1ms\nexport async function middleware(req: NextRequest) {\n  const token = req.cookies.get('subscription_entitlement_token')?.value;\n  if (!token) return NextResponse.redirect(new URL('/pricing', req.url));\n\n  try {\n    const secret = new TextEncoder().encode(process.env.ONE_EIGHTY_CLIENT_SECRET);\n    const { payload } = await jwtVerify(token, secret);\n    const features = (payload.features as string[]) || [];\n\n    if (!features.includes('traffic:cloaking')) {\n      return NextResponse.redirect(new URL('/upgrade?feature=traffic:cloaking', req.url));\n    }\n    return NextResponse.next();\n  } catch {\n    return NextResponse.redirect(new URL('/pricing', req.url));\n  }\n}`}

                      {headlessCodeTab === 'python' &&
                        `import jwt, os\nfrom fastapi import FastAPI, Depends, HTTPException\nfrom fastapi.security import HTTPBearer, HTTPAuthorizationCredentials\n\napp = FastAPI()\nsecurity = HTTPBearer()\nCLIENT_SECRET = os.getenv("ONE_EIGHTY_CLIENT_SECRET")\n\ndef require_feature(feature_key: str):\n    def dependency(creds: HTTPAuthorizationCredentials = Depends(security)):\n        try:\n            payload = jwt.decode(creds.credentials, CLIENT_SECRET, algorithms=["HS256"])\n            if feature_key not in payload.get("features", []):\n                raise HTTPException(status_code=403, detail=f"Feature {feature_key} not entitled")\n            return payload\n        except jwt.PyJWTError:\n            raise HTTPException(status_code=401, detail="Invalid entitlement token")\n    return dependency`}

                      {headlessCodeTab === 'webhook' &&
                        `import crypto from 'crypto';\n\n// Real-time synchronization webhook (HMAC SHA-256)\napp.post('/api/180-webhook', (req, res) => {\n  const signatureHeader = req.headers['x-180-signature'] as string;\n  // Header format: t=TIMESTAMP,v1=SIGNATURE\n  const [tPart, v1Part] = signatureHeader.split(',');\n  const timestamp = tPart.split('=')[1];\n  const signature = v1Part.split('=')[1];\n\n  const expected = crypto\n    .createHmac('sha256', process.env.ONE_EIGHTY_WEBHOOK_SECRET!)\n    .update(\`\${timestamp}.\${JSON.stringify(req.body)}\`)\n    .digest('hex');\n\n  if (expected !== signature) return res.status(400).send('Invalid signature');\n\n  const { event, data } = req.body;\n  if (event === 'subscription.activated' || event === 'subscription.renewed') {\n    // Instant grant of new features & update user tier\n    grantFeatures(data.userId, data.planCode, data.metadata?.featureKeys);\n  } else if (event === 'subscription.payment_failed' || event === 'subscription.cancelled') {\n    // Grace period or revoke access\n    revokeFeatures(data.userId);\n  }\n  res.json({ received: true });\n});`}
                    </pre>

                    <button
                      type="button"
                      onClick={() => {
                        let codeToCopy = '';
                        if (headlessCodeTab === 'fetch') {
                          codeToCopy = `const res = await fetch('${getApiBase()}/api/v1/pricing-tables/${config.clientId || appId}/headless');\nconst { plans } = await res.json();`;
                        } else if (headlessCodeTab === 'node_verify') {
                          codeToCopy = `import jwt from 'jsonwebtoken';\nexport function checkEntitlement(token, requiredFeature) {\n  const payload = jwt.verify(token, process.env.ONE_EIGHTY_CLIENT_SECRET);\n  return payload.features.includes(requiredFeature);\n}`;
                        } else if (headlessCodeTab === 'nextjs_edge') {
                          codeToCopy = `// Next.js Edge Middleware entitlement check\nimport { jwtVerify } from 'jose';`;
                        } else if (headlessCodeTab === 'python') {
                          codeToCopy = `import jwt\npayload = jwt.decode(token, CLIENT_SECRET, algorithms=["HS256"])`;
                        } else {
                          codeToCopy = `// Webhook handler for subscription lifecycle events`;
                        }
                        navigator.clipboard.writeText(codeToCopy);
                        toast.success('Code copied to clipboard');
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Column / Full Width: Live Interactive Canvas Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-zinc-950 p-6 space-y-5 shadow-2xl relative overflow-hidden">
            {/* Preview Controls Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Live Canvas Preview</span>
              </div>

              {/* Viewport switch: Desktop / Mobile */}
              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded-lg ${
                      previewDevice === 'desktop' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Desktop View"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded-lg ${
                      previewDevice === 'mobile' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Mobile View"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>

                <a
                  href={`${getPublicBase()}/embed/pricing/${appId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5"
                  title="Open live embed in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Container for Preview */}
            <div
              className={`mx-auto transition-all duration-300 ${
                previewDevice === 'mobile'
                  ? 'max-w-[380px] rounded-[36px] border-4 border-zinc-800 bg-zinc-950 p-4 shadow-2xl overflow-hidden'
                  : 'w-full'
              }`}
            >
              {/* Rendered Live Preview Component */}
              <div className="py-6 px-2 space-y-6 text-white font-sans">
                {/* Header */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 text-[11px] font-semibold">
                    <Sparkles className="w-3 h-3" style={{ color: config.accentColor }} />
                    <span>{config.appName || '180 Workspace'} Membership</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {config.headline || 'Simple, Transparent Pricing'}
                  </h3>
                  {config.subheadline && (
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">{config.subheadline}</p>
                  )}

                  {/* Interval Switcher */}
                  {config.billingIntervals.includes('YEARLY') && (
                    <div className="pt-2 flex items-center justify-center gap-3">
                      <span
                        className={`text-xs font-semibold cursor-pointer ${
                          previewInterval === 'MONTHLY' ? 'text-white' : 'text-zinc-500'
                        }`}
                        onClick={() => setPreviewInterval('MONTHLY')}
                      >
                        Monthly
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewInterval(previewInterval === 'MONTHLY' ? 'YEARLY' : 'MONTHLY')
                        }
                        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                        style={{
                          backgroundColor: previewInterval === 'YEARLY' ? config.accentColor : '#27272a',
                        }}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            previewInterval === 'YEARLY' ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <div
                        className="flex items-center gap-1.5 cursor-pointer"
                        onClick={() => setPreviewInterval('YEARLY')}
                      >
                        <span
                          className={`text-xs font-semibold ${
                            previewInterval === 'YEARLY' ? 'text-white' : 'text-zinc-500'
                          }`}
                        >
                          Annual
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                          Save {yearlyDiscount}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cards Preview Grid */}
                {config.planCards.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-white/10 bg-zinc-900/40 text-xs text-zinc-400">
                    No plan tiers configured yet. Add your first tier to see it rendered live here.
                  </div>
                ) : (
                  <div
                    className={`grid gap-4 ${
                      previewDevice === 'mobile' || config.planCards.length === 1
                        ? 'grid-cols-1'
                        : config.planCards.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1 md:grid-cols-3'
                    }`}
                  >
                    {config.planCards.map((plan, pIdx) => {
                      const isFree = plan.isFree || plan.amount === 0;
                      const rawAmount = plan.amount;
                      const finalAmount = isFree
                        ? 0
                        : previewInterval === 'YEARLY'
                        ? plan.yearlyAmount
                          ? plan.yearlyAmount
                          : Math.round(rawAmount * 12 * (1 - yearlyDiscount / 100))
                        : rawAmount;

                      const currencySymbol = getCurrencySymbol(plan.currency);
                      const badgeText = plan.badgeText || (plan.isPopular ? 'Most Popular' : null);

                      return (
                        <div
                          key={plan.planCode || pIdx}
                          className={`relative rounded-2xl p-5 flex flex-col justify-between transition-all ${
                            plan.isPopular
                              ? 'border-2 bg-gradient-to-b from-white/[0.04] via-zinc-900/90 to-zinc-950 shadow-xl'
                              : 'border border-white/10 bg-zinc-900/70 hover:border-white/20'
                          }`}
                          style={plan.isPopular ? { borderColor: `${config.accentColor}90` } : {}}
                        >
                          {badgeText && (
                            <div
                              className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[9px] font-bold uppercase tracking-wider shadow-lg"
                              style={{ backgroundColor: config.accentColor }}
                            >
                              {badgeText}
                            </div>
                          )}

                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <h4 className="text-sm font-bold text-white">{plan.name}</h4>
                                {plan.description && (
                                  <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                                    {plan.description}
                                  </p>
                                )}
                              </div>
                              {plan.trialDays && plan.trialDays > 0 ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold shrink-0">
                                  {plan.trialDays}d trial
                                </span>
                              ) : null}
                            </div>

                            <div className="pt-1 pb-2 border-b border-white/5">
                              {isFree ? (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-white font-mono">Free</span>
                                  <span className="text-[10px] text-zinc-500 font-medium">/forever</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-white font-mono">
                                      {currencySymbol}
                                      {finalAmount}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-medium">
                                      /{previewInterval === 'YEARLY' ? 'yr' : 'mo'}
                                    </span>
                                  </div>
                                  {previewInterval === 'YEARLY' && (
                                    <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                                      Billed annually ({currencySymbol}
                                      {Math.round(finalAmount / 12)}/mo)
                                    </p>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Features */}
                            <ul className="space-y-1.5 pt-1">
                              {(plan.features || []).map((feat, fIdx) => {
                                const isObj = typeof feat === 'object' && feat !== null;
                                const featText = isObj ? feat.text : String(feat);
                                const isIncluded = isObj ? feat.included !== false : true;

                                return (
                                  <li
                                    key={fIdx}
                                    className={`flex items-start gap-1.5 text-[11px] ${
                                      isIncluded ? 'text-zinc-300' : 'text-zinc-500 line-through'
                                    }`}
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                        isIncluded
                                          ? 'bg-emerald-500/10 text-emerald-400'
                                          : 'bg-zinc-800 text-zinc-500'
                                      }`}
                                    >
                                      {isIncluded ? <Check className="w-2 h-2" /> : '✕'}
                                    </div>
                                    <span className="truncate">{featText}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          <div className="pt-4 mt-auto">
                            <button
                              type="button"
                              className="w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 text-white transition-all shadow-md"
                              style={{
                                backgroundColor: plan.isPopular ? config.accentColor : '#27272a',
                              }}
                            >
                              <span>{plan.buttonText || (isFree ? 'Get Started' : 'Choose Plan')}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Trust Footer */}
                {config.showTrustBadge !== false && (
                  <div className="pt-4 text-center flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span>Secure 256-bit encrypted checkout powered by 180 Pay</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Edit or Create Plan Tier */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101012] p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  {editingCardIndex !== null ? 'Edit Subscription Tier' : 'Add Subscription Tier'}
                </h3>
                <p className="text-xs text-zinc-500">
                  Configure pricing, billing cycle, badges and features.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              {/* Row 1: Name and Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Tier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pro Growth, Standard, Enterprise"
                    value={cardName}
                    onChange={(e) => {
                      setCardName(e.target.value);
                      if (editingCardIndex === null && !cardCode) {
                        setCardCode(e.target.value.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_'));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Plan Code (ID for Billing) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pro_growth"
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Row 2: Short Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Tagline / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. For fast-growing teams needing dedicated pipelines"
                  value={cardDescription}
                  onChange={(e) => setCardDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Row 3: Pricing & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      Monthly Price *
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-zinc-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cardIsFree}
                        onChange={(e) => {
                          setCardIsFree(e.target.checked);
                          if (e.target.checked) setCardAmount('0');
                        }}
                        className="rounded border-zinc-300 text-purple-600 w-3 h-3"
                      />
                      <span>Free Tier</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    required={!cardIsFree}
                    disabled={cardIsFree}
                    min={0}
                    placeholder="e.g. 29"
                    value={cardIsFree ? '0' : cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Currency
                  </label>
                  <select
                    value={cardCurrency}
                    onChange={(e) => setCardCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Free Trial (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    placeholder="0"
                    value={cardTrialDays}
                    onChange={(e) => setCardTrialDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Regional Multi-Pricing Configuration Box for Subscription Tier */}
              {!cardIsFree && (
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>Multi-Currency & Regional Rules</span>
                        {cardMultiPricing.enabled && cardMultiPricing.rules.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                            {cardMultiPricing.rules.length} Active ({cardMultiPricing.mode})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {cardMultiPricing.enabled
                          ? `${cardMultiPricing.rules.length} custom country price rule(s) configured`
                          : 'Offer localized pricing or PPP discounts in other countries'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMultiPricingDrawer(true)}
                    className="rounded-xl text-xs font-semibold shrink-0 cursor-pointer border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                  >
                    {cardMultiPricing.enabled ? 'Edit Rules' : 'Add Multi-Pricing'}
                  </Button>
                </div>
              )}

              {/* Row 4: Badge & Popular Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Custom Badge Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Most Popular, Best Value, Early Bird"
                    value={cardBadgeText}
                    onChange={(e) => setCardBadgeText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardPopular}
                      onChange={(e) => setCardPopular(e.target.checked)}
                      className="rounded border-zinc-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Highlight as Featured / Popular Tier
                    </span>
                  </label>
                </div>
              </div>

              {/* Row 5: CTA Button Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="Get Started / Start Free Trial"
                    value={cardButtonText}
                    onChange={(e) => setCardButtonText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Custom Action URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (Leave blank for 180 Pay Checkout)"
                    value={cardButtonUrl}
                    onChange={(e) => setCardButtonUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Feature Checklist Builder */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Feature Checklist & Privileges
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Unlimited API Calls, Dedicated Support"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFeatureIncluded}
                      onChange={(e) => setNewFeatureIncluded(e.target.checked)}
                      className="rounded border-zinc-300 text-purple-600 w-3.5 h-3.5"
                    />
                    <span>Included</span>
                  </label>
                  <Button
                    type="button"
                    onClick={handleAddFeature}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3.5 py-2 rounded-xl font-bold"
                  >
                    Add
                  </Button>
                </div>

                {/* Features List */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto pt-1">
                  {cardFeatures.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-2">
                      No features added yet. Type a feature above and click Add.
                    </p>
                  ) : (
                    cardFeatures.map((feat, fIdx) => (
                      <div
                        key={fIdx}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                          feat.included
                            ? 'bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-white/5 text-zinc-800 dark:text-zinc-200'
                            : 'bg-zinc-100/50 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-white/10 text-zinc-400 line-through'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 mr-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleFeatureIncluded(fIdx)}
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                              feat.included
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                            }`}
                            title="Toggle Included / Excluded"
                          >
                            {feat.included ? <Check className="w-2.5 h-2.5" /> : '✕'}
                          </button>
                          <span className="truncate">{feat.text}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={fIdx === 0}
                            onClick={() => handleMoveFeature(fIdx, 'up')}
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-white disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={fIdx === cardFeatures.length - 1}
                            onClick={() => handleMoveFeature(fIdx, 'down')}
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-white disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature(fIdx)}
                            className="p-1 text-zinc-400 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Feature Entitlement Keys (Machine-Readable Identifiers) */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    Machine-Readable Feature Keys (Entitlements)
                  </label>
                  <span className="text-[10px] text-zinc-400">Used by your backend to gate features</span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g. traffic:cloaking, analytics:pro, custom_domain"
                      value={newFeatureKeyInput}
                      onChange={(e) => setNewFeatureKeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeatureKey();
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddFeatureKey}
                    className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs px-3.5 py-2 rounded-xl font-bold border border-zinc-200 dark:border-white/10"
                  >
                    Add Key
                  </Button>
                </div>

                {/* Feature Keys Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cardFeatureKeys.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic">
                      No feature keys linked yet. Add keys to bundle privileges with this plan ID.
                    </p>
                  ) : (
                    cardFeatureKeys.map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-mono text-[11px]"
                      >
                        <Key className="w-2.5 h-2.5" />
                        <span>{key}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFeatureKey(key)}
                          className="hover:text-red-400 ml-0.5"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Form Footer */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-white/10">
                <Button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs px-4 py-2 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg shadow-purple-600/20"
                >
                  Save Tier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Multi-Pricing Rule Drawer for Subscription Tier */}
      <MultiPricingDrawer
        isOpen={showMultiPricingDrawer}
        onClose={() => setShowMultiPricingDrawer(false)}
        baseAmount={parseFloat(cardAmount) || 0}
        baseCurrency={cardCurrency}
        itemName={cardName || 'Plan Tier'}
        value={cardMultiPricing}
        onChange={(newConfig) => setCardMultiPricing(newConfig)}
      />
    </div>
  );
}
