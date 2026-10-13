'use client';

import React, { useState, useEffect } from 'react';
import {
  Tag,
  Search,
  Plus,
  Percent,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  X,
  Layers,
  ArrowUpRight,
  Download,
  Filter,
  Sparkles,
  Users,
  TicketPercent,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Eye,
  Sliders,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

interface CouponItem {
  id: string;
  appId: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  maxRedemptions?: number | null;
  perCustomerLimit: number;
  allowedOrigins: string[];
  validPlans: string[];
  validFrom: string;
  validUntil?: string | null;
  isActive: boolean;
  createdAt: string;
  app?: {
    id: string;
    name: string;
    clientId: string;
    logoUrl?: string;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  };
  _count?: {
    redemptions: number;
  };
}

export default function CouponsManagementPage() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    totalRedemptions: 0,
    totalDiscountAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'ACTIVE' | 'PERCENTAGE' | 'FIXED' | 'EXPIRED'>('ALL');
  const [appsList, setAppsList] = useState<any[]>([]);

  // Action states
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<CouponItem | null>(null);

  // Redemptions Drawer
  const [inspectCoupon, setInspectCoupon] = useState<CouponItem | null>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  // Create Coupon Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: '20',
    maxDiscountAmount: '',
    minOrderAmount: '0',
    maxRedemptions: '100',
    perCustomerLimit: '1',
    validUntil: '',
    appId: 'UNIVERSAL',
    isActive: true,
  });

  useEffect(() => {
    loadCoupons();
    loadApps();
  }, [search, statusFilter]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getCoupons({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter.toLowerCase() : undefined,
      });
      if (res.success) {
        setCoupons(res.coupons || res.data || []);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load coupons', err);
      toast.error('Failed to fetch platform coupons');
    } finally {
      setLoading(false);
    }
  };

  const loadApps = async () => {
    try {
      const res = await adminApi.getApps({ limit: 100 });
      if (res.success) {
        setAppsList(res.apps || res.data?.apps || []);
      }
    } catch (e) {
      console.error('Failed to fetch apps list for coupons', e);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleToggleStatus = async (coupon: CouponItem) => {
    const nextActive = !coupon.isActive;
    try {
      setTogglingId(coupon.id);
      const res = await adminApi.updateCoupon(coupon.id, { isActive: nextActive });
      if (res.success) {
        toast.success(`Coupon "${coupon.code}" is now ${nextActive ? 'ACTIVE' : 'PAUSED'}`);
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? { ...c, isActive: nextActive } : c))
        );
        setMetrics((prev) => ({
          ...prev,
          activeCoupons: nextActive ? prev.activeCoupons + 1 : Math.max(0, prev.activeCoupons - 1),
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update coupon status');
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!couponToDelete) return;
    try {
      setDeletingId(couponToDelete.id);
      const res = await adminApi.deleteCoupon(couponToDelete.id);
      if (res.success) {
        toast.success(`Coupon "${couponToDelete.code}" deleted permanently`);
        setCoupons((prev) => prev.filter((c) => c.id !== couponToDelete.id));
        setCouponToDelete(null);
        loadCoupons();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete coupon');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenRedemptions = async (coupon: CouponItem) => {
    setInspectCoupon(coupon);
    setRedemptions([]);
    setRedemptionsLoading(true);
    try {
      const res = await adminApi.getCouponRedemptions(coupon.id);
      if (res.success) {
        setRedemptions(res.redemptions || []);
      }
    } catch (err) {
      console.error('Failed to load coupon redemptions', err);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const generateRandomCode = () => {
    const prefixes = ['DEV', 'LAUNCH', 'SUPER', 'SUMMER', 'BUILD', 'PROMO', 'BOOST'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    setFormData((prev) => ({ ...prev, code: `${prefix}${num}` }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    const val = Number(formData.discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Please provide a valid discount value');
      return;
    }
    if (formData.discountType === 'PERCENTAGE' && val > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        discountValue: val,
        minOrderAmount: formData.minOrderAmount ? Number(formData.minOrderAmount) : 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        maxRedemptions: formData.maxRedemptions ? Number(formData.maxRedemptions) : null,
        perCustomerLimit: formData.perCustomerLimit ? Number(formData.perCustomerLimit) : 1,
        validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
        isActive: formData.isActive,
        appId: formData.appId,
      };

      const res = await adminApi.createCoupon(payload);
      if (res.success) {
        toast.success(`Coupon ${payload.code} created and live!`);
        setIsCreateOpen(false);
        setFormData({
          code: '',
          discountType: 'PERCENTAGE',
          discountValue: '20',
          maxDiscountAmount: '',
          minOrderAmount: '0',
          maxRedemptions: '100',
          perCustomerLimit: '1',
          validUntil: '',
          appId: 'UNIVERSAL',
          isActive: true,
        });
        loadCoupons();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create coupon code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter computation
  const filteredCoupons = coupons.filter((c) => {
    if (quickFilter === 'ACTIVE') {
      const isExpired = c.validUntil && new Date(c.validUntil) < new Date();
      if (!c.isActive || isExpired) return false;
    }
    if (quickFilter === 'PERCENTAGE') {
      if (c.discountType !== 'PERCENTAGE') return false;
    }
    if (quickFilter === 'FIXED') {
      if (c.discountType !== 'FIXED_AMOUNT') return false;
    }
    if (quickFilter === 'EXPIRED') {
      const isExpired = c.validUntil && new Date(c.validUntil) <= new Date();
      if (!isExpired) return false;
    }
    return true;
  });

  const handleExportCsv = () => {
    const rows = filteredCoupons.map((c) => ({
      Code: c.code,
      Type: c.discountType,
      Value: c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `$${c.discountValue}`,
      Status: c.isActive ? 'ACTIVE' : 'PAUSED',
      ScopeApp: c.app?.name || 'Universal',
      Redemptions: c._count?.redemptions || 0,
      MaxRedemptions: c.maxRedemptions || 'Unlimited',
      MinOrder: c.minOrderAmount ? `$${c.minOrderAmount}` : 'None',
      MaxCap: c.maxDiscountAmount ? `$${c.maxDiscountAmount}` : 'None',
      ValidUntil: c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'Never',
      CreatedAt: new Date(c.createdAt).toLocaleDateString(),
    }));
    exportToCsv('180core_coupons_report', rows);
    toast.success('Coupons exported to CSV');
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ─── Page Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Sparkles className="h-3 w-3" />
              Promotional Engine
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Checkout & Developer Discounts
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Coupons & Promo Codes
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Create promotional discount codes for developer subscriptions, SDK usage, and 180 Pay checkout sessions with granular rate limits and app-level isolation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={!filteredCoupons.length}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Coupon
          </button>
        </div>
      </div>

      {/* ─── KPI Metrics Deck ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Codes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 shadow-sm backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Coupons</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {metrics.totalCoupons}
            </span>
            <span className="text-xs text-zinc-500">campaigns</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
            <span className="text-emerald-500 font-medium">All-time</span> platform promotional codes
          </div>
        </div>

        {/* Active Promos */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 shadow-sm backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active Campaigns</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.activeCoupons}
            </span>
            <span className="text-xs text-zinc-500">live now</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
            <span className="text-emerald-500 font-medium">Redeemable</span> in checkout right now
          </div>
        </div>

        {/* Total Redemptions */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 shadow-sm backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Redemptions</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {metrics.totalRedemptions}
            </span>
            <span className="text-xs text-zinc-500">uses</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-purple-500" />
            Applied across 180 Pay sessions
          </div>
        </div>

        {/* Discount Granted */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800/80 shadow-sm backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Value Granted</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ${Number(metrics.totalDiscountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-zinc-500">USD</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
            Developer subsidy & promotional savings
          </div>
        </div>
      </div>

      {/* ─── Search, Status Filters & Quick Selector ─── */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coupon by code (e.g. DEV50, SUMMER20) or target app..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active & Live</option>
              <option value="INACTIVE">Paused / Disabled</option>
              <option value="EXPIRED">Expired Dates</option>
            </select>

            <button
              onClick={loadCoupons}
              className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              title="Refresh coupons"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Codes', count: coupons.length },
            { id: 'ACTIVE', label: 'Active Promos', count: coupons.filter((c) => c.isActive && (!c.validUntil || new Date(c.validUntil) > new Date())).length },
            { id: 'PERCENTAGE', label: 'Percentage %', count: coupons.filter((c) => c.discountType === 'PERCENTAGE').length },
            { id: 'FIXED', label: 'Fixed Amount $', count: coupons.filter((c) => c.discountType === 'FIXED_AMOUNT').length },
            { id: 'EXPIRED', label: 'Expired', count: coupons.filter((c) => c.validUntil && new Date(c.validUntil) <= new Date()).length },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setQuickFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                quickFilter === pill.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{pill.label}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                quickFilter === pill.id
                  ? 'bg-white/20 dark:bg-black/20 text-current'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Coupons Data Table ─── */}
      <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Coupon Code</th>
                <th className="py-3.5 px-4">Discount</th>
                <th className="py-3.5 px-4">Scope / App</th>
                <th className="py-3.5 px-4">Redemptions</th>
                <th className="py-3.5 px-4">Order Rules</th>
                <th className="py-3.5 px-4">Validity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {loading && !coupons.length ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading platform coupons...
                  </td>
                </tr>
              ) : !filteredCoupons.length ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-500 dark:text-zinc-400">
                    <Tag className="h-8 w-8 mx-auto mb-3 opacity-30 text-zinc-400" />
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No coupons found</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {search ? 'Try adjusting your search query or status filter.' : 'Create your first promo code to grant developer discounts.'}
                    </p>
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Coupon
                    </button>
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((c) => {
                  const isExpired = c.validUntil && new Date(c.validUntil) <= new Date();
                  const redemptionsCount = c._count?.redemptions || 0;
                  const maxLimit = c.maxRedemptions;
                  const percentUsed = maxLimit ? Math.min(100, Math.round((redemptionsCount / maxLimit) * 100)) : null;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition group"
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 tracking-wide bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800">
                            {c.code}
                          </span>
                          <button
                            onClick={() => handleCopy(c.code)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            title="Copy Code"
                          >
                            {copiedCode === c.code ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Discount */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                            {c.discountType === 'PERCENTAGE' ? (
                              <>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{c.discountValue}% OFF</span>
                              </>
                            ) : (
                              <>
                                <span className="text-blue-600 dark:text-blue-400 font-bold">${c.discountValue.toFixed(2)} OFF</span>
                              </>
                            )}
                          </span>
                          {c.maxDiscountAmount && (
                            <span className="text-[11px] text-zinc-500">
                              Max cap: ${c.maxDiscountAmount}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Scope / App */}
                      <td className="py-3.5 px-4">
                        {c.app ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              {c.app.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate max-w-[140px]">
                                {c.app.name}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {c.app.clientId}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <Layers className="h-3 w-3" />
                            Universal
                          </span>
                        )}
                      </td>

                      {/* Redemptions */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                            <span className="font-medium">{redemptionsCount}</span>
                            <span className="text-zinc-400 text-[11px]">
                              {maxLimit ? `/ ${maxLimit}` : 'unlimited'}
                            </span>
                          </div>
                          {percentUsed !== null && (
                            <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentUsed >= 90
                                    ? 'bg-rose-500'
                                    : percentUsed >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Order Rules */}
                      <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-400">
                        <div className="flex flex-col text-[11px] gap-0.5">
                          <span>Min: {c.minOrderAmount ? `$${c.minOrderAmount}` : 'None'}</span>
                          <span className="text-zinc-400">Limit: {c.perCustomerLimit} per customer</span>
                        </div>
                      </td>

                      {/* Validity */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col text-[11px]">
                          {c.validUntil ? (
                            <>
                              <span className={isExpired ? 'text-rose-500 font-semibold' : 'text-zinc-700 dark:text-zinc-300'}>
                                {new Date(c.validUntil).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {isExpired ? 'Expired' : 'Expires at 23:59'}
                              </span>
                            </>
                          ) : (
                            <span className="text-zinc-500">No expiration</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Expired
                          </span>
                        ) : c.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                            Paused
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle Active */}
                          <button
                            onClick={() => handleToggleStatus(c)}
                            disabled={togglingId === c.id}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                              c.isActive
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                            title={c.isActive ? 'Pause coupon' : 'Activate coupon'}
                          >
                            {togglingId === c.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : c.isActive ? (
                              'Pause'
                            ) : (
                              'Enable'
                            )}
                          </button>

                          {/* View Redemptions */}
                          <button
                            onClick={() => handleOpenRedemptions(c)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            title="Inspect Redemptions"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setCouponToDelete(c)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                            title="Delete Coupon"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create Coupon Modal ─── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <TicketPercent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Create Promotional Coupon
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Configure promotional discount codes for checkout & developer accounts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* Code + Generator */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Coupon Code *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                      placeholder="e.g. DEV50, WELCOME20, BLACKFRIDAY"
                      className="flex-1 px-3.5 py-2.5 rounded-xl font-mono uppercase text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition flex items-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      Auto-Generate
                    </button>
                  </div>
                </div>

                {/* Discount Type Toggle */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Discount Mechanism *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, discountType: 'PERCENTAGE' })}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                        formData.discountType === 'PERCENTAGE'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Percent className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Percentage (%)</div>
                        <div className="text-[10px] opacity-75">e.g. 20% off whole cart</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, discountType: 'FIXED_AMOUNT' })}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                        formData.discountType === 'FIXED_AMOUNT'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Fixed Amount ($)</div>
                        <div className="text-[10px] opacity-75">e.g. $15.00 flat discount</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Value and Max Cap */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      {formData.discountType === 'PERCENTAGE' ? 'Discount Percentage (%) *' : 'Discount Amount (USD $) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                      required
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Max Discount Cap (USD $)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional (e.g. 50)"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                      disabled={formData.discountType === 'FIXED_AMOUNT'}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Min Order & Max Redemptions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Min Order Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.minOrderAmount}
                      onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Max Redemptions (Pool)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.maxRedemptions}
                      onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
                      placeholder="e.g. 100 (blank = unlimited)"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                {/* Per-Customer Limit & Expiry Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Per-Customer Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.perCustomerLimit}
                      onChange={(e) => setFormData({ ...formData, perCustomerLimit: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                {/* Scope App */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    App Target / Ecosystem Scope
                  </label>
                  <select
                    value={formData.appId}
                    onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="UNIVERSAL">Platform Universal (All Apps & Developer Portal)</option>
                    {appsList.map((app) => (
                      <option key={app.id} value={app.id}>
                        App: {app.name} ({app.clientId})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Universal coupons can be redeemed by developers on the developer portal and across any checkout session.
                  </p>
                </div>

                {/* Live Preview Card */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-2">
                    Live Checkout Preview
                  </span>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black border border-emerald-500/30 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Tag className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {formData.code || 'CODE'}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          {formData.discountType === 'PERCENTAGE'
                            ? `${formData.discountValue || 0}% discount applied`
                            : `$${formData.discountValue || 0} flat discount applied`}
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      VERIFIED
                    </span>
                  </div>
                </div>
              </div>

              {/* Sticky Submit Footer Buttons */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 bg-white dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {isSubmitting ? 'Creating Coupon...' : 'Deploy Coupon Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {couponToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Delete Promotional Code?
                </h3>
                <p className="text-xs text-zinc-500">
                  This action permanently removes the coupon and its logs.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">
              Are you sure you want to delete coupon <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{couponToDelete.code}</span>? Once deleted, developers and checkout sessions will no longer be able to claim this discount.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCouponToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId === couponToDelete.id}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/25 transition flex items-center gap-1.5"
              >
                {deletingId === couponToDelete.id && <RefreshCw className="h-3 w-3 animate-spin" />}
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Redemptions Audit Drawer ─── */}
      {inspectCoupon && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 h-full p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Redemption Audit Logs
                  </h3>
                  <p className="text-xs font-mono text-zinc-500">
                    Coupon: {inspectCoupon.code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectCoupon(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {redemptionsLoading ? (
                <div className="py-20 text-center text-zinc-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-500" />
                  Loading redemptions history...
                </div>
              ) : !redemptions.length ? (
                <div className="py-20 text-center text-zinc-500">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    No redemptions yet
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    When developers or shoppers apply this promo code during checkout, their records will appear here.
                  </p>
                </div>
              ) : (
                redemptions.map((r: any) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.customerEmail || 'Guest Developer'}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        -${r.discountApplied?.toFixed(2)} USD
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="font-mono">Order: ${r.orderAmount?.toFixed(2)}</span>
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    {r.checkoutSessionId && (
                      <div className="font-mono text-[10px] text-zinc-500 truncate pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                        Session: {r.checkoutSessionId}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
              <span>Total Redemptions: {redemptions.length}</span>
              <button
                onClick={() => setInspectCoupon(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition font-medium"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
