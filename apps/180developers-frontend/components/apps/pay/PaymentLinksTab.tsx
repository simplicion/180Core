'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Package,
  Layers,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  Globe,
  QrCode,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getPublicBase, getAuthToken } from '@/lib/api-config';
import { MultiPricingDrawer, MultiPricingConfig } from '@/components/pay/MultiPricingDrawer';
import { PaymentLinkDrawer, PaymentLinkItem } from '@/components/pay/PaymentLinkDrawer';

interface PaymentLinksTabProps {
  appId: string;
}

export function PaymentLinksTab({ appId }: PaymentLinksTabProps) {
  const [links, setLinks] = useState<PaymentLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Unified Side Drawer State (Replaces both floating popups)
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerLink, setDrawerLink] = useState<PaymentLinkItem | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'LINK' | 'QR'>('LINK');

  // Multi-Pricing Drawer State
  const [showMultiPricingDrawer, setShowMultiPricingDrawer] = useState(false);
  const [activeEditingLink, setActiveEditingLink] = useState<PaymentLinkItem | null>(null);
  const [multiPricingConfig, setMultiPricingConfig] = useState<MultiPricingConfig>({
    enabled: false,
    mode: 'HYBRID',
    rules: [],
  });

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/payment-links/apps/${appId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLinks(data.links || data.data || []);
      }
    } catch {
      toast.error('Failed to load payment links');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);


  const handleOpenMultiPricingForNewLink = () => {
    setActiveEditingLink(null);
    setShowMultiPricingDrawer(true);
  };

  const handleOpenMultiPricingForExistingLink = (link: PaymentLinkItem) => {
    setActiveEditingLink(link);
    const existing = link.metadata?.multiPricing;
    if (existing && typeof existing === 'object') {
      setMultiPricingConfig({
        enabled: Boolean(existing.enabled),
        mode: existing.mode || 'HYBRID',
        rules: Array.isArray(existing.rules) ? existing.rules : [],
      });
    } else {
      setMultiPricingConfig({ enabled: false, mode: 'HYBRID', rules: [] });
    }
    setShowMultiPricingDrawer(true);
  };

  const handleSaveMultiPricing = async (newConfig: MultiPricingConfig) => {
    setMultiPricingConfig(newConfig);

    if (activeEditingLink) {
      // Save directly to the existing payment link via PUT
      try {
        const token = getAuthToken();
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/v1/payment-links/apps/${appId}/${activeEditingLink.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            metadata: {
              ...(activeEditingLink.metadata || {}),
              multiPricing: newConfig,
            },
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(`Multi-pricing saved for "${activeEditingLink.title}"!`);
          fetchLinks();
        } else {
          toast.error(data.error || 'Failed to update payment link multi-pricing');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to update payment link');
      }
    }
  };

  const handleDeleteLink = async (id: string, slugName: string) => {
    if (!confirm(`Are you sure you want to delete payment link /${slugName}?`)) return;

    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/payment-links/apps/${appId}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete payment link');
      toast.success('Payment link deleted');
      fetchLinks();
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Network error: Unable to reach the API server.'
        : (err.message || 'Error deleting payment link');
      toast.error(msg);
    }
  };

  const copyLinkUrl = (slug: string) => {
    const fullUrl = `${getPublicBase()}/link/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    toast.success('Payment link copied to clipboard!');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const filteredLinks = links.filter((l) =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    l.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm dark:shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Shareable Payment Links</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Zero-code hosted checkout links with capacity caps & instant digital fulfillment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchLinks}
            className="rounded-xl border-zinc-200 dark:border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            type="button"
            onClick={() => {
              setDrawerLink(null);
              setDrawerInitialTab('LINK');
              setShowDrawer(true);
            }}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Payment Link</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter payment links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Links Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-zinc-500">Loading payment links...</div>
      ) : filteredLinks.length === 0 ? (
        <div className="p-12 text-center space-y-3 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
          <Package className="w-10 h-10 text-zinc-400 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">No payment links created yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Generate shareable payment links to sell digital products, tickets, or services with zero backend coding.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLinks.map((link) => {
            const isSoldOut = link.maxPurchases && link.purchasesCount >= link.maxPurchases;

            const totalCollected = Number(link.totalCollected !== undefined ? link.totalCollected : (link.metadata?.totalCollected ?? (link.purchasesCount * link.amount)));
            const viewsCount = Number(link.viewsCount !== undefined ? link.viewsCount : (link.metadata?.viewsCount ?? 0));
            const qualifiedViewsCount = Number(link.qualifiedViewsCount !== undefined ? link.qualifiedViewsCount : (link.metadata?.qualifiedViewsCount ?? 0));
            const currencySymbol = link.currency === 'INR' ? '₹' : (link.currency === 'USD' ? '$' : (link.currency === 'EUR' ? '€' : link.currency));

            return (
              <div
                key={link.id}
                className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 space-y-4 hover:border-zinc-300 dark:hover:border-white/20 transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    onClick={() => {
                      setDrawerLink(link);
                      setDrawerInitialTab('LINK');
                      setShowDrawer(true);
                    }}
                    className="cursor-pointer group flex-1"
                  >
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">/link/{link.slug}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {Number(link.amount) === 0 || link.metadata?.allowCustomAmount ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/30 text-xs font-bold">
                        <Sparkles className="w-3 h-3" />
                        Flexible Amount
                      </span>
                    ) : (
                      <span className="text-base font-extrabold text-zinc-950 dark:text-white font-mono">
                        {link.currency === 'INR' ? '₹' : '$'}{Number(link.amount).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {link.description && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">{link.description}</p>
                )}

                {/* Link Telemetry: Payments Collected & 3s+ Qualified Views */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-white/5 text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Collected
                    </span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      {currencySymbol}{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex flex-col border-l border-zinc-200/60 dark:border-white/5 pl-2.5">
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Sales
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                      {link.purchasesCount} <span className="text-[10px] font-normal text-zinc-400">/ {link.maxPurchases ? link.maxPurchases : '∞'}</span>
                    </span>
                  </div>

                  <div className="flex flex-col border-l border-zinc-200/60 dark:border-white/5 pl-2.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Views
                      </span>
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-1 py-0.2 rounded" title="Visitors who stayed 3 seconds or longer">
                        3s+
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5" title={`${viewsCount} total visits (${qualifiedViewsCount} stayed >= 3s)`}>
                      {qualifiedViewsCount} <span className="text-[10px] font-normal text-zinc-400">/ {viewsCount}</span>
                    </span>
                  </div>
                </div>

                {link.metadata?.multiPricing?.enabled && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                    <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>
                      {link.metadata.multiPricing.rules?.length || 0} Regional Override{link.metadata.multiPricing.rules?.length === 1 ? '' : 's'} Active ({link.metadata.multiPricing.mode})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenMultiPricingForExistingLink(link)}
                      className="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Edit Rules
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{link.purchasesCount} Accepted</span>
                    </span>
                    {isSoldOut && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">
                        SOLD OUT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Dedicated Get QR Code Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerLink(link);
                        setDrawerInitialTab('QR');
                        setShowDrawer(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all cursor-pointer border border-indigo-500/20"
                      title="Get & download QR code for this link"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Get QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenMultiPricingForExistingLink(link)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      title="Configure Regional Multi-Pricing"
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyLinkUrl(link.slug)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                      title="Copy Public Link"
                    >
                      {copiedSlug === link.slug ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={`${getPublicBase()}/link/${link.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                      title="Open Checkout Preview"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteLink(link.id, link.slug)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete Link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reusable Multi-Pricing Rule Drawer */}
      <MultiPricingDrawer
        isOpen={showMultiPricingDrawer}
        onClose={() => {
          setShowMultiPricingDrawer(false);
          setActiveEditingLink(null);
        }}
        baseAmount={activeEditingLink ? activeEditingLink.amount : 500}
        baseCurrency={activeEditingLink ? activeEditingLink.currency : 'INR'}
        itemName={activeEditingLink ? activeEditingLink.title : 'Payment Link'}
        value={multiPricingConfig}
        onChange={handleSaveMultiPricing}
      />

      {/* Unified Side Drawer (Replaces both floating popups) */}
      <PaymentLinkDrawer
        isOpen={showDrawer}
        onClose={() => {
          setShowDrawer(false);
          setDrawerLink(null);
        }}
        appId={appId}
        link={drawerLink}
        initialTab={drawerInitialTab}
        onLinkSaved={(saved) => {
          if (saved) {
            setDrawerLink(saved);
          }
          fetchLinks();
        }}
        onOpenMultiPricing={() => {
          handleOpenMultiPricingForNewLink();
        }}
      />
    </div>
  );
}
