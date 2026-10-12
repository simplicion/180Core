'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Link as LinkIcon,
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Globe,
  Sparkles,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  CreditCard,
  User,
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
  const [qrSvg, setQrSvg] = useState<string>('');
  const [generatingQr, setGeneratingQr] = useState(false);

  // Sync drawer form state when opened or link changed
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);

    if (link) {
      setTitle(link.title || '');
      setDescription(link.description || '');
      const isCustom = Number(link.amount) === 0 || Boolean(link.metadata?.allowCustomAmount);
      setAmountType(isCustom ? 'CUSTOM' : 'FIXED');
      setAmount(isCustom ? '500' : String(link.amount));
      setCurrency(link.currency || 'INR');
      setCustomSlug(link.slug || '');
      setMaxPurchases(link.maxPurchases ? String(link.maxPurchases) : '');
      setFulfillmentMessage(link.fulfillmentMessage || '');
      setFulfillmentFileUrl(link.fulfillmentFileUrl || '');
      setRedirectUrl(link.redirectUrl || '');

      const existingMp = link.metadata?.multiPricing;
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
  }, [isOpen, link, initialTab]);

  // Derived effective public link URL
  const effectiveSlug = link?.slug || customSlug.trim() || 'preview-link';
  const effectiveUrl = `${getPublicBase()}/link/${effectiveSlug}`;

  // Generate QR code whenever URL, theme, or amount changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setGeneratingQr(true);

    const darkColor = qrTheme === 'dark' ? '#0f172a' : qrTheme === 'brand' ? '#312e81' : '#000000';
    const lightColor = '#ffffff';

    Promise.all([
      QRCode.toDataURL(effectiveUrl, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: darkColor, light: lightColor },
      }),
      QRCode.toString(effectiveUrl, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: darkColor, light: lightColor },
      }),
    ])
      .then(([dataUrl, svg]) => {
        if (!isMounted) return;
        setQrDataUrl(dataUrl);
        setQrSvg(svg);
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

  // Download High-Resolution Counter Standee PNG
  const handleDownloadStandee = () => {
    if (!qrDataUrl) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw White Card Background
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(0, 0, 1200, 1500, 48);
    ctx.fill();

    // Subtle Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Top Brand Pill
    ctx.fillStyle = '#4f46e5';
    ctx.roundRect(400, 90, 400, 60, 30);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('180 PAY • SCAN & PAY', 600, 132);

    // Title / Item Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    ctx.fillText(title || 'Scan to Pay', 600, 240);

    // Amount Label
    if (amountType === 'FIXED') {
      const sym = currency === 'INR' ? '₹' : `${currency} `;
      const numVal = parseFloat(amount);
      const displayAmt = !isNaN(numVal) && numVal > 0 ? `${sym}${numVal.toFixed(2)}` : `${sym}500.00`;
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 44px monospace, system-ui';
      ctx.fillText(displayAmt, 600, 320);
    } else {
      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
      ctx.fillText('Customer Chooses Amount at Checkout', 600, 320);
    }

    // Draw QR Code
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = qrDataUrl;
    img.onload = () => {
      const qrSize = 720;
      const qrX = (1200 - qrSize) / 2;
      const qrY = 380;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Supported Apps Banner
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 26px system-ui, -apple-system, sans-serif';
      ctx.fillText('Accepted via Google Pay • PhonePe • Paytm • Any UPI App • Phone Camera', 600, 1180);

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'normal 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('Powered by 180 Workspace Sovereign Ledger Protocol • Instant Verification', 600, 1260);

      const filename = `${effectiveSlug.toLowerCase()}-standee.png`;
      const a = document.createElement('a');
      a.download = filename;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast.success('High-res counter standee downloaded!');
    };
  };

  // Vector SVG Download
  const handleDownloadSVG = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${effectiveSlug.toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Vector SVG downloaded!');
  };

  // Print Standee
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print standee.');
      return;
    }

    const titleText = title || 'Scan to Pay';
    const amountText =
      amountType === 'FIXED'
        ? `${currency === 'INR' ? '₹' : currency} ${amount}`
        : 'Customer Chooses Amount';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print 180 Pay QR Standee</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fafafa; }
            .card { width: 440px; padding: 36px 28px; background: white; border-radius: 28px; border: 2px solid #e2e8f0; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
            .badge { display: inline-block; background: #4f46e5; color: white; padding: 6px 18px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
            .title { font-size: 24px; font-weight: 900; color: #0f172a; margin-bottom: 6px; }
            .amount { font-size: 20px; font-weight: 800; color: #10b981; font-family: monospace; margin-bottom: 20px; }
            .qr-box { padding: 16px; background: white; border: 2px dashed #cbd5e1; border-radius: 20px; display: inline-block; margin-bottom: 20px; }
            .qr-box img { width: 280px; height: 280px; display: block; }
            .footer { font-size: 11px; color: #64748b; line-height: 1.6; }
            .footer-sub { color: #94a3b8; font-size: 9.5px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">SCAN TO PAY WITH ANY UPI APP</div>
            <div class="title">${titleText}</div>
            <div class="amount">${amountText}</div>
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="Payment QR" />
            </div>
            <div class="footer">
              <strong>Accepted on Google Pay • PhonePe • Paytm • BHIM • Phone Camera</strong><br/>
              <div class="footer-sub">Verified Instant Settlement • Secured by 180 Workspace Sovereign Ledger</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyLinkUrl = () => {
    navigator.clipboard.writeText(effectiveUrl);
    setCopiedUrl(true);
    toast.success('Public Payment Link copied!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Submit Handler: Create or Update Payment Link
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Item Title is required');
      return;
    }

    const isCustom = amountType === 'CUSTOM';
    const numAmount = isCustom ? 0 : parseFloat(amount);
    if (!isCustom && (isNaN(numAmount) || numAmount <= 0)) {
      toast.error('Price amount must be greater than zero');
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

      const url = link
        ? `${apiBase}/api/v1/payment-links/apps/${appId}/${link.id}`
        : `${apiBase}/api/v1/payment-links/apps/${appId}`;
      const method = link ? 'PUT' : 'POST';

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
      toast.success(link ? 'Payment Link updated successfully!' : 'Payment Link created successfully!');
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
      title={link ? 'Manage Payment Link & QR Code' : 'Create Payment Link & QR Code'}
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
            {activeTab === 'LINK' && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4"
              >
                {saving ? 'Saving...' : link ? 'Update Link' : 'Save & Generate QR'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* TAB 1: LINK CONFIGURATION */}
      {activeTab === 'LINK' && (
        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* QR Code Quick Shortcut Banner */}
          <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Live Payment QR Code Ready</h4>
                <p className="text-[11px] text-zinc-500">
                  Directly linked with this {amountType === 'CUSTOM' ? 'custom amount' : 'fixed'} link.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('QR')}
              className="rounded-xl text-xs font-semibold flex items-center gap-1.5 border-zinc-200 dark:border-white/10 cursor-pointer"
            >
              <span>View & Get QR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      )}

      {/* TAB 2: INSTANT QR CODE & STANDEE DOWNLOAD */}
      {activeTab === 'QR' && (
        <div className="space-y-6">
          {/* Top Notice */}
          <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white block">
                  Gateway-Connected QR Active
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {amountType === 'FIXED'
                    ? `Pre-filled for ${currency === 'INR' ? '₹' : currency} ${amount} • Accepted via Any UPI & Cameras`
                    : 'Customer enters custom amount at checkout • Universal Acceptance'}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold tracking-wider uppercase border border-emerald-500/20">
              Live
            </span>
          </div>

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
                {effectiveUrl}
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

          {/* QR Action Buttons */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Download & Print Actions
            </h4>

            {/* Instant Download Primary CTA */}
            <Button
              type="button"
              onClick={handleDownloadDirectQR}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Instant Download QR Code (PNG)</span>
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadStandee}
                className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-zinc-200 dark:border-white/10"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                <span>Counter Standee PNG</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handlePrint}
                className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-zinc-200 dark:border-white/10"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-500" />
                <span>Print Standee</span>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadSVG}
                className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-zinc-200 dark:border-white/10"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400" />
                <span>Vector SVG</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={copyLinkUrl}
                className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-zinc-200 dark:border-white/10"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Link URL</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </PlatformDrawer>
  );
}
export default PaymentLinkDrawer;
