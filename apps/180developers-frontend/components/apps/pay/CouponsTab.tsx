'use strict';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Globe,
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  RefreshCw,
  Clock,
  Sparkles,
  History,
  AlertTriangle,
  Edit2,
  Loader2,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getAuthToken } from '@/lib/api-config';

interface CouponItem {
  id: string;
  appId: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  maxRedemptions?: number | null;
  redemptionsCount: number;
  perCustomerLimit: number;
  allowedOrigins: string[];
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface RedemptionItem {
  id: string;
  customerEmail: string;
  sessionId: string;
  discountApplied: number;
  createdAt: string;
}

interface CouponsTabProps {
  appId: string;
}

export function CouponsTab({ appId }: CouponsTabProps) {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('20');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('500');
  const [minOrderAmount, setMinOrderAmount] = useState('100');
  const [maxRedemptions, setMaxRedemptions] = useState('20');
  const [perCustomerLimit, setPerCustomerLimit] = useState('1');
  const [allowedOriginsText, setAllowedOriginsText] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // Edit Modal State
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDiscountType, setEditDiscountType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [editDiscountValue, setEditDiscountValue] = useState('20');
  const [editMaxDiscountAmount, setEditMaxDiscountAmount] = useState('500');
  const [editMinOrderAmount, setEditMinOrderAmount] = useState('100');
  const [editMaxRedemptions, setEditMaxRedemptions] = useState('20');
  const [editPerCustomerLimit, setEditPerCustomerLimit] = useState('1');
  const [editAllowedOriginsText, setEditAllowedOriginsText] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Redemptions History Drawer
  const [selectedCoupon, setSelectedCoupon] = useState<CouponItem | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Copied state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/coupons/apps/${appId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCoupons(data.coupons || data.data || []);
      }
    } catch (err: any) {
      console.error('[CouponsTab] Failed to load coupons:', err);
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleGenerateCode = () => {
    const prefixes = ['SAVE', 'DEAL', 'VIP', 'LAUNCH', 'OFF'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    setCode(`${prefix}${num}`);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Discount value must be greater than zero');
      return;
    }
    if (discountType === 'PERCENTAGE' && val > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    const origins = allowedOriginsText
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);

    setCreating(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/coupons/apps/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountValue: val,
          maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
          minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
          perCustomerLimit: perCustomerLimit ? parseInt(perCustomerLimit, 10) : 1,
          allowedOrigins: origins,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create coupon');
      }

      toast.success(`Coupon ${code.toUpperCase()} created successfully!`);
      setShowCreateModal(false);
      setCode('');
      setAllowedOriginsText('');
      fetchCoupons();
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Network error: Unable to reach the API server. Please check your connection.'
        : (err.message || 'Error creating coupon');
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (coupon: CouponItem) => {
    setEditingCoupon(coupon);
    setEditDiscountType(coupon.discountType);
    setEditDiscountValue(String(coupon.discountValue));
    setEditMaxDiscountAmount(coupon.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : '');
    setEditMinOrderAmount(coupon.minOrderAmount != null ? String(coupon.minOrderAmount) : '');
    setEditMaxRedemptions(coupon.maxRedemptions != null ? String(coupon.maxRedemptions) : '');
    setEditPerCustomerLimit(String(coupon.perCustomerLimit || 1));
    setEditAllowedOriginsText((coupon.allowedOrigins || []).join('\n'));
    setEditValidUntil(
      coupon.validUntil ? new Date(coupon.validUntil).toISOString().slice(0, 16) : ''
    );
    setEditIsActive(coupon.isActive);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;

    const val = parseFloat(editDiscountValue);
    if (isNaN(val) || val <= 0) {
      toast.error('Discount value must be greater than zero');
      return;
    }
    if (editDiscountType === 'PERCENTAGE' && val > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }

    const origins = editAllowedOriginsText
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);

    setEditing(true);
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/coupons/apps/${appId}/${editingCoupon.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          discountType: editDiscountType,
          discountValue: val,
          maxDiscountAmount: editMaxDiscountAmount ? parseFloat(editMaxDiscountAmount) : null,
          minOrderAmount: editMinOrderAmount ? parseFloat(editMinOrderAmount) : null,
          maxRedemptions: editMaxRedemptions ? parseInt(editMaxRedemptions, 10) : null,
          perCustomerLimit: editPerCustomerLimit ? parseInt(editPerCustomerLimit, 10) : 1,
          allowedOrigins: origins,
          validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : null,
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update coupon');
      }

      toast.success(`Coupon ${editingCoupon.code} updated successfully!`);
      setShowEditModal(false);
      setEditingCoupon(null);
      fetchCoupons();
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Network error: Unable to reach the API server.'
        : (err.message || 'Error updating coupon');
      toast.error(msg);
    } finally {
      setEditing(false);
    }
  };

  const handleToggleCouponStatus = async (coupon: CouponItem) => {
    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();
      const nextStatus = !coupon.isActive;
      const res = await fetch(`${apiBase}/api/v1/coupons/apps/${appId}/${coupon.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to toggle status');
      }

      toast.success(`Coupon ${coupon.code} ${nextStatus ? 'activated' : 'paused'}`);
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, isActive: nextStatus } : c))
      );
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Network error: Unable to reach the API server.'
        : (err.message || 'Error toggling coupon status');
      toast.error(msg);
    }
  };

  const handleDeleteCoupon = async (id: string, codeName: string) => {
    if (!confirm(`Are you sure you want to delete coupon ${codeName}?`)) return;

    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/coupons/apps/${appId}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete coupon');
      toast.success('Coupon deleted');
      fetchCoupons();
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Network error: Unable to reach the API server.'
        : (err.message || 'Error deleting coupon');
      toast.error(msg);
    }
  };

  const handleViewRedemptions = async (coupon: CouponItem) => {
    setSelectedCoupon(coupon);
    setLoadingRedemptions(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/coupons/apps/${appId}/${coupon.id}/redemptions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRedemptions(data.redemptions || data.data || []);
      }
    } catch (err: any) {
      toast.error('Failed to load redemption history');
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    setCopiedCode(c);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCoupons = coupons.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm dark:shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Coupons & Promo Codes</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Server-enforced promotion rules, strict origin whitelisting & atomic redemption caps.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchCoupons}
            className="rounded-xl border-zinc-200 dark:border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Coupon</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Active Coupons</span>
          <div className="text-2xl font-bold text-zinc-950 dark:text-white mt-1">
            {coupons.filter((c) => c.isActive).length}
          </div>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Redemptions</span>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {coupons.reduce((acc, c) => acc + c.redemptionsCount, 0)}
          </div>
        </div>
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Domain Whitelists Active</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {coupons.filter((c) => c.allowedOrigins.length > 0).length}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter coupon codes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Coupons Table */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading coupon rules...</div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Tag className="w-10 h-10 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">No coupons found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Create your first promotional coupon to offer percentage or fixed discounts to your users.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Discount</th>
                  <th className="px-5 py-3.5">Capacity / Used</th>
                  <th className="px-5 py-3.5">Allowed Domains</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                {filteredCoupons.map((coupon) => {
                  const isExpired = coupon.validUntil && new Date() > new Date(coupon.validUntil);
                  const isSoldOut = coupon.maxRedemptions && coupon.redemptionsCount >= coupon.maxRedemptions;

                  return (
                    <tr key={coupon.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-zinc-950 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{coupon.code}</span>
                          <button
                            type="button"
                            onClick={() => copyCode(coupon.code)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                          >
                            {copiedCode === coupon.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-zinc-950 dark:text-white">
                          {coupon.discountType === 'PERCENTAGE' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                        </span>
                        {coupon.maxDiscountAmount && coupon.discountType === 'PERCENTAGE' && (
                          <div className="text-[11px] text-zinc-500">Max ₹{coupon.maxDiscountAmount}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-950 dark:text-white">{coupon.redemptionsCount}</span>
                          <span className="text-zinc-500">/ {coupon.maxRedemptions ? coupon.maxRedemptions : '∞'}</span>
                        </div>
                        {isSoldOut && <span className="text-[10px] text-red-500 font-bold">SOLD OUT</span>}
                      </td>
                      <td className="px-5 py-4">
                        {coupon.allowedOrigins.length === 0 ? (
                          <span className="text-zinc-400 italic">All Domains (Public)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {coupon.allowedOrigins.map((dom, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-medium border border-purple-500/20"
                              >
                                {dom}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isExpired ? (
                          <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">
                            Expired
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleCouponStatus(coupon)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              coupon.isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 hover:bg-zinc-500/20'
                            }`}
                            title={coupon.isActive ? 'Click to pause coupon' : 'Click to activate coupon'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                coupon.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                              }`}
                            />
                            {coupon.isActive ? 'Active' : 'Disabled'}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(coupon)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewRedemptions(coupon)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer"
                            title="View Redemptions"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE COUPON MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">Create Promotional Coupon</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Coupon Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. LAUNCH50"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm font-mono font-bold uppercase text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateCode}
                    className="rounded-xl flex items-center gap-1.5 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Generate</span>
                  </Button>
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e: any) => setDiscountType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Value {discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={discountType === 'PERCENTAGE' ? '100' : '999999'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Max Discount Cap (for %) & Min Order */}
              <div className="grid grid-cols-2 gap-4">
                {discountType === 'PERCENTAGE' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Redemption Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Total Redemption Limit
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 20 (First 20 users)"
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Per-Customer Limit
                  </label>
                  <input
                    type="number"
                    value={perCustomerLimit}
                    onChange={(e) => setPerCustomerLimit(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Strict Whitelisted Origins */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Whitelisted Website Origins (1 per line)
                </label>
                <textarea
                  rows={3}
                  placeholder={`https://theirsass.com\nhttps://checkout.theirsass.com\nhttp://localhost:3000`}
                  value={allowedOriginsText}
                  onChange={(e) => setAllowedOriginsText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Leave empty to allow this coupon globally, or enter specific origin URLs to prevent misuse on other websites.
                </p>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold"
                >
                  {creating ? 'Creating...' : 'Create Coupon'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COUPON MODAL */}
      {showEditModal && editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">Edit Promotional Coupon</h3>
                  <p className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {editingCoupon.code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCoupon(null);
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Active Toggle */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">Coupon Status</span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {editIsActive ? 'Coupon is active & ready for redemption' : 'Coupon is paused (redemptions blocked)'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editIsActive}
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    editIsActive ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editIsActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Discount Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditDiscountType('PERCENTAGE')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      editDiscountType === 'PERCENTAGE'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDiscountType('FIXED_AMOUNT')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      editDiscountType === 'FIXED_AMOUNT'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                    }`}
                  >
                    Fixed Amount (₹)
                  </button>
                </div>
              </div>

              {/* Value & Max Cap */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    {editDiscountType === 'PERCENTAGE' ? 'Discount %' : 'Discount Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={editDiscountType === 'PERCENTAGE' ? '100' : undefined}
                    required
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {editDiscountType === 'PERCENTAGE' && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                      Max Cap (₹ Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500"
                      value={editMaxDiscountAmount}
                      onChange={(e) => setEditMaxDiscountAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* Min Order & Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 100"
                    value={editMinOrderAmount}
                    onChange={(e) => setEditMinOrderAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Max Redemptions (Total)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited if empty"
                    value={editMaxRedemptions}
                    onChange={(e) => setEditMaxRedemptions(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Per Customer Limit */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Per Customer Limit
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editPerCustomerLimit}
                  onChange={(e) => setEditPerCustomerLimit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Allowed Origins */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Whitelisted Website Origins (1 per line)
                </label>
                <textarea
                  rows={3}
                  placeholder={`https://theirsass.com\nhttps://checkout.theirsass.com\nhttp://localhost:3000`}
                  value={editAllowedOriginsText}
                  onChange={(e) => setEditAllowedOriginsText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Leave empty to allow this coupon globally, or enter specific origin URLs to restrict redemption.
                </p>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={editValidUntil}
                  onChange={(e) => setEditValidUntil(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCoupon(null);
                  }}
                  className="rounded-xl cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={editing}
                  className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-2 cursor-pointer"
                >
                  {editing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editing ? 'Saving Changes...' : 'Save Coupon Changes'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REDEMPTION HISTORY DRAWER */}
      {selectedCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-white/10">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">Redemption Audit Log</h3>
                <p className="text-xs font-mono text-purple-400">{selectedCoupon.code}</p>
              </div>
              <button onClick={() => setSelectedCoupon(null)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            {loadingRedemptions ? (
              <div className="text-center py-12 text-sm text-zinc-500">Loading redemptions...</div>
            ) : redemptions.length === 0 ? (
              <div className="text-center py-12 text-sm text-zinc-500">No redemptions recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {redemptions.map((r) => (
                  <div key={r.id} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-950 dark:text-white">{r.customerEmail}</span>
                      <span className="font-bold text-emerald-500">-₹{r.discountApplied}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Session: {r.sessionId.slice(-8)}</span>
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
