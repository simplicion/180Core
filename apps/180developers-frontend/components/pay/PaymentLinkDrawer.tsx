'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Link as LinkIcon,
  QrCode,
  Download,
  Copy,
  Check,
  Globe,
  Sparkles,
  DollarSign,
  Package,
  CheckCircle2,
  Eye,
  TrendingUp,
} from 'lucide-react';
import { PlatformDrawer, Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getPublicBase, getAuthToken } from '@/lib/api-config';
import { MultiPricingConfig } from './MultiPricingDrawer';

export interface PaymentLinkItem {
  id: string;
  appId: string;
  slug: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  purchasesCount: number;
  maxPurchases?: number | null;
  isActive: boolean;
  redirectUrl?: string;
  fulfillmentMessage?: string;
  fulfillmentFileUrl?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  totalCollected?: number;
  viewsCount?: number;
  qualifiedViewsCount?: number;
}

export interface PaymentLinkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string;
  link?: PaymentLinkItem | null;
  initialTab?: 'LINK' | 'QR';
  onLinkSaved?: (savedLink: PaymentLinkItem) => void;
  onOpenMultiPricing?: (config: MultiPricingConfig) => void;
}

export function PaymentLinkDrawer({
  isOpen,
  onClose,
  appId,
  link,
  initialTab = 'LINK',
  onLinkSaved,
  onOpenMultiPricing,
}: PaymentLinkDrawerProps) {
  const [activeTab, setActiveTab] = useState<'LINK' | 'QR'>(initialTab);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountType, setAmountType] = useState<'FIXED' | 'CUSTOM'>('FIXED');
  const [amount, setAmount] = useState('500');
  const [currency, setCurrency] = useState('INR');
  const [customSlug, setCustomSlug] = useState('');
  const [maxPurchases, setMaxPurchases] = useState('');
  const [fulfillmentMessage, setFulfillmentMessage] = useState('');
  const [fulfillmentFileUrl, setFulfillmentFileUrl] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  // Multi-Pricing configuration
  const [multiPricingConfig, setMultiPricingConfig] = useState<MultiPricingConfig>({
    enabled: false,
    mode: 'HYBRID',
    rules: [],
  });

  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // QR Code Generation State
  const [qrTheme, setQrTheme] = useState<'clean' | 'dark' | 'brand'>('clean');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState(false);

  // Active link state managed internally so new creations immediately update the QR tab
  const [currentLink, setCurrentLink] = useState<PaymentLinkItem | null>(link || null);

  useEffect(() => {
    setCurrentLink(link || null);
  }, [link, isOpen]);

  // Sync drawer form state when opened or link changed
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);

    const active = currentLink || link;
    if (active) {
      setTitle(active.title || '');
      setDescription(active.description || '');
      const isCustom = Number(active.amount) === 0 || Boolean(active.metadata?.allowCustomAmount);
      setAmountType(isCustom ? 'CUSTOM' : 'FIXED');
      setAmount(isCustom ? '500' : String(active.amount));
      setCurrency(active.currency || 'INR');
      setCustomSlug(active.slug || '');
      setMaxPurchases(active.maxPurchases ? String(active.maxPurchases) : '');
      setFulfillmentMessage(active.fulfillmentMessage || '');
      setFulfillmentFileUrl(active.fulfillmentFileUrl || '');
      setRedirectUrl(active.redirectUrl || '');

      const existingMp = active.metadata?.multiPricing;
      if (existingMp && typeof existingMp === 'object') {
        setMultiPricingConfig({
          enabled: Boolean(existingMp.enabled),
          mode: existingMp.mode || 'HYBRID',
          rules: Array.isArray(existingMp.rules) ? existingMp.rules : [],
        });
      } else {
        setMultiPricingConfig({ enabled: false, mode: 'HYBRID', rules: [] });
      }
    } else {
      // New Link Defaults
      setTitle('');
      setDescription('');
      setAmountType('FIXED');
      setAmount('500');
      setCurrency('INR');
      setCustomSlug('');
      setMaxPurchases('');
      setFulfillmentMessage('');
      setFulfillmentFileUrl('');
      setRedirectUrl('');
      setMultiPricingConfig({ enabled: false, mode: 'HYBRID', rules: [] });
    }
  }, [isOpen, currentLink, link, initialTab]);

  // Derived effective public link URL & persistence status
  const isSaved = Boolean(currentLink && currentLink.id && currentLink.slug);
  const effectiveSlug = currentLink?.slug || customSlug.trim() || 'preview-link';
  const effectiveUrl = `${getPublicBase()}/link/${effectiveSlug}`;

  // Generate QR code whenever URL, theme, or amount changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setGeneratingQr(true);

    const darkColor = qrTheme === 'dark' ? '#0f172a' : qrTheme === 'brand' ? '#312e81' : '#000000';
    const lightColor = '#ffffff';

    QRCode.toDataURL(effectiveUrl, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: darkColor, light: lightColor },
    })
      .then((dataUrl) => {
        if (!isMounted) return;
        setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('[PaymentLinkDrawer] QR generation error:', err);
      })
      .finally(() => {
        if (isMounted) setGeneratingQr(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, effectiveUrl, qrTheme]);

  // Direct 1-Click Instant QR PNG Download
  const handleDownloadDirectQR = () => {
    if (!isSaved) {
      toast.error('Please save this link first to generate an active payment QR code.');
      return;
    }
    if (!qrDataUrl) {
      toast.error('QR code is still generating, please wait a second');
      return;
    }
    const filename = `${effectiveSlug.toLowerCase()}-qr.png`;
    const a = document.createElement('a');
    a.download = filename;
    a.href = qrDataUrl;
    a.click();
    toast.success('Instant Payment QR Code downloaded!');
  };



  const copyLinkUrl = () => {
    if (!isSaved) {
      toast.error('Please save this link first to generate an active checkout URL.');
      return;
    }
    navigator.clipboard.writeText(effectiveUrl);
    setCopiedUrl(true);
    toast.success('Public Payment Link copied!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Submit Handler: Create or Update Payment Link
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      toast.error('Item Title is required');
      setActiveTab('LINK');
      return;
    }

    const isCustom = amountType === 'CUSTOM';
    const numAmount = isCustom ? 0 : parseFloat(amount);
    if (!isCustom && (isNaN(numAmount) || numAmount <= 0)) {
      toast.error('Price amount must be greater than zero');
      setActiveTab('LINK');
      return;
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        amount: numAmount,
        currency: currency.toUpperCase(),
        customSlug: customSlug.trim() || undefined,
        maxPurchases: maxPurchases ? parseInt(maxPurchases, 10) : null,
        fulfillmentMessage: fulfillmentMessage.trim() || undefined,
        fulfillmentFileUrl: fulfillmentFileUrl.trim() || undefined,
        redirectUrl: redirectUrl.trim() || undefined,
        metadata: {
          allowCustomAmount: isCustom,
          multiPricing: multiPricingConfig,
        },
      };

      const activeLink = currentLink || link;
      const url = activeLink
        ? `${apiBase}/api/v1/payment-links/apps/${appId}/${activeLink.id}`
        : `${apiBase}/api/v1/payment-links/apps/${appId}`;
      const method = activeLink ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save payment link');
      }

      const savedLink = data.link || data.data;
      if (savedLink) {
        setCurrentLink(savedLink);
        if (savedLink.slug) {
          setCustomSlug(savedLink.slug);
        }
      }
      toast.success(activeLink ? 'Payment Link updated successfully!' : 'Payment Link created successfully!');
      if (onLinkSaved && savedLink) {
        onLinkSaved(savedLink);
      }

      // Automatically switch to QR tab so the user can immediately download or inspect the QR code!
      setActiveTab('QR');
    } catch (err: any) {
      toast.error(err.message || 'Error saving payment link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={currentLink ? 'Manage Payment Link & QR Code' : 'Create Payment Link & QR Code'}
      icon={activeTab === 'QR' ? QrCode : LinkIcon}
      iconColorClass="text-indigo-600 dark:text-indigo-400"
      iconBgClass="bg-indigo-500/10"
      maxWidthClass="max-w-2xl"
      subHeader={
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('LINK')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'LINK'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Link Configuration</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QR')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'QR'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-500" />
            <span>Instant QR Code</span>
          </button>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadDirectQR}
              className="rounded-xl border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span>Get QR Code</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyLinkUrl}
              className="rounded-xl border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Link</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="rounded-xl">
              Close
            </Button>
            {activeTab === 'LINK' ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 cursor-pointer"
              >
                {saving ? 'Saving...' : currentLink ? 'Update Link' : 'Save & Generate QR'}
              </Button>
            ) : !isSaved ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save & Activate'}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {/* TAB 1: LINK CONFIGURATION */}
      {activeTab === 'LINK' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {currentLink && (
            <div className="grid grid-cols-3 gap-2 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 text-xs shadow-xs">
              <div>
                <span className="block text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Total Collected
                </span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {currentLink.currency === 'INR' ? '₹' : '$'}
                  {Number(currentLink.totalCollected !== undefined ? currentLink.totalCollected : (currentLink.metadata?.totalCollected ?? (currentLink.purchasesCount * currentLink.amount))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-l border-zinc-200 dark:border-white/10 pl-3">
                <span className="block text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Payments
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono text-sm">
                  {currentLink.purchasesCount} <span className="text-[11px] font-normal text-zinc-400">/ {currentLink.maxPurchases || '∞'}</span>
                </span>
              </div>
              <div className="border-l border-zinc-200 dark:border-white/10 pl-3">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Views
                  </span>
                  <span className="text-[9px] font-medium text-indigo-500 bg-indigo-500/10 px-1 rounded" title="Visitor stayed 3 seconds or longer">
                    3s+
                  </span>
                </div>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-sm" title="Qualified views where user stayed >= 3s">
                  {currentLink.qualifiedViewsCount ?? currentLink.metadata?.qualifiedViewsCount ?? 0}
                  <span className="text-[11px] font-normal text-zinc-400"> / {currentLink.viewsCount ?? currentLink.metadata?.viewsCount ?? 0}</span>
                </span>
              </div>
            </div>
          )}

          {/* Item Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
              Item Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Masterclass VIP Ticket or Support Donation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Optional brief description of what the customer is purchasing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* AMOUNT TYPE TOGGLE: FIXED vs CUSTOM */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Pricing Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAmountType('FIXED')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  amountType === 'FIXED'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                    : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className={`w-4 h-4 ${amountType === 'FIXED' ? 'text-indigo-600' : 'text-zinc-400'}`} />
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">Fixed Price</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  Customer pays a pre-defined fixed amount (e.g. ₹500, $20).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAmountType('CUSTOM')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  amountType === 'CUSTOM'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                    : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className={`w-4 h-4 ${amountType === 'CUSTOM' ? 'text-indigo-600' : 'text-zinc-400'}`} />
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">Customer Enters Amount</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  Payer enters custom amount at checkout (donations, tips, bills).
                </p>
              </button>
            </div>
          </div>

          {/* AMOUNT & CURRENCY INPUTS */}
          <div className="grid grid-cols-2 gap-4">
            {amountType === 'FIXED' ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Fixed Amount
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm font-mono font-bold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Payment Mode
                </label>
                <div className="px-4 py-2.5 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Open Custom Amount</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* Regional Multi-Pricing Configuration Box */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                  <span>Multi-Currency & Regional Rules</span>
                  {multiPricingConfig.enabled && multiPricingConfig.rules.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                      {multiPricingConfig.rules.length} Active ({multiPricingConfig.mode})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 truncate">
                  {multiPricingConfig.enabled
                    ? `${multiPricingConfig.rules.length} custom country price rule(s) configured`
                    : 'Offer localized pricing or PPP discounts across 18+ countries'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenMultiPricing && onOpenMultiPricing(multiPricingConfig)}
              className="rounded-xl text-xs font-semibold shrink-0 cursor-pointer border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              {multiPricingConfig.enabled ? 'Edit Rules' : 'Add Rules'}
            </Button>
          </div>

          {/* Custom Slug & Capacity Cap */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Custom Slug (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. coffee-tip or vip-pass"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Capacity Cap (Inventory)
              </label>
              <input
                type="number"
                placeholder="e.g. 50 (Leave blank for unlimited)"
                value={maxPurchases}
                onChange={(e) => setMaxPurchases(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Digital Fulfillment Assets */}
          <div className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Instant Digital Delivery (Revealed Only After Payment)
            </span>
            <div>
              <input
                type="text"
                placeholder="License Key, Discord Invite, or Secret Access Message..."
                value={fulfillmentMessage}
                onChange={(e) => setFulfillmentMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <input
                type="url"
                placeholder="Digital Asset Download URL (e.g. https://cdn.../file.zip)"
                value={fulfillmentFileUrl}
                onChange={(e) => setFulfillmentFileUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none"
              />
            </div>
          </div>

        </form>
      )}

      {/* TAB 2: INSTANT QR CODE */}
      {activeTab === 'QR' && (
        <div className="py-2">
          {/* QR Display Card */}
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <div className="relative p-4 rounded-2xl bg-white shadow-md border border-zinc-200/80">
              {generatingQr ? (
                <div className="w-64 h-64 flex items-center justify-center text-xs text-zinc-400">
                  Generating QR Code...
                </div>
              ) : (
                <img src={qrDataUrl} alt="180 Pay QR Code" className="w-64 h-64 object-contain rounded-lg" />
              )}
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-zinc-950 dark:text-white">
                {title || '180 Payment Link'}
              </h3>
              <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {amountType === 'FIXED'
                  ? `${currency === 'INR' ? '₹' : currency} ${parseFloat(amount).toFixed(2)}`
                  : 'Customer Chooses Amount'}
              </p>
              <p className="text-[11px] text-zinc-400 font-mono truncate max-w-xs mx-auto">
                {isSaved ? effectiveUrl : `${effectiveUrl} (Unsaved Draft)`}
              </p>
            </div>

            {/* Supported Badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center pt-2 text-[10px] font-medium text-zinc-500">
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">Google Pay</span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">PhonePe</span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">Paytm</span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">Any UPI App</span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">Phone Camera</span>
            </div>
          </div>
        </div>
      )}
    </PlatformDrawer>
  );
}
export default PaymentLinkDrawer;
