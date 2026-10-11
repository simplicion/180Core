'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  XCircle,
  RotateCcw,
  CreditCard,
} from 'lucide-react';
import { Button, LogoLoader } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';

export function ManageSubscriptionClient({ id: initialId }: { id?: string } = {}) {
  const params = useParams();

  // Resilient subscriptionId extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialSubscriptionId = useCallback(() => {
    if (initialId && initialId !== 'default') return initialId;
    const pId = params?.id as string;
    if (pId && pId !== 'default') return pId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/checkout\/manage-subscription\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== 'default') {
        return decodeURIComponent(match[1]);
      }
    }
    return '';
  }, [initialId, params?.id]);

  const [subscriptionId, setSubscriptionId] = useState<string>(getInitialSubscriptionId);

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Found an alternative solution');

  const fetchDetails = useCallback(async (idToFetch?: string) => {
    const targetId = idToFetch || subscriptionId || getInitialSubscriptionId();
    if (!targetId || targetId === 'default') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(getCoreApiUrl(`/api/v1/subscriptions/${encodeURIComponent(targetId)}`), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {}

      if (data && data.success && data.subscription) {
        setSub(data.subscription);
      } else if (targetId === 'preview' || targetId.startsWith('sub_demo_')) {
        // High fidelity preview state
        setSub({
          id: targetId,
          planCode: 'traffic-pro',
          planName: 'Traffic Director Pro Armor',
          description: 'Max 5 Smart Links with Dynamic Shield & Multi-AdBot Cloaking',
          amount: 50.0,
          currency: 'USD',
          interval: 'MONTHLY',
          status: 'ACTIVE',
          paymentSource: 'RAZORPAY_MANDATE',
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          app: {
            name: '180 Traffic Director',
            logoUrl: null,
            clientId: '180-traffic-director',
          },
        });
      } else {
        throw new Error(data?.error || 'Subscription not found or unauthorized');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, getInitialSubscriptionId]);

  useEffect(() => {
    const currentId = getInitialSubscriptionId();
    if (currentId && currentId !== 'default') {
      setSubscriptionId(currentId);
      fetchDetails(currentId);
    } else {
      setLoading(false);
    }
  }, [getInitialSubscriptionId, fetchDetails]);

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const res = await fetch(getCoreApiUrl(`/api/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      toast.success('Subscription and recurring mandate cancelled successfully');
      setSub((prev: any) => ({
        ...prev,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelReason,
      }));
      setShowConfirmModal(false);

      // Post message to parent frame (180 Pay bottom sheet / modal)
      if (typeof window !== 'undefined') {
        const messagePayload = {
          type: '180_SUBSCRIPTION_CANCELLED',
          subscriptionId,
          status: 'CANCELLED',
          timestamp: Date.now(),
        };
        window.parent.postMessage(messagePayload, '*');
        if (window.opener) {
          window.opener.postMessage(messagePayload, '*');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.parent.postMessage({ type: '180_SUBSCRIPTION_CLOSE' }, '*');
      if (window.opener) {
        window.close();
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto flex flex-col items-center justify-center border border-slate-200 shadow-xl font-sans">
        <LogoLoader size={36} className="w-9 h-9 text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading subscription details from 180 Pay...</p>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-4 max-w-lg mx-auto border border-slate-200 shadow-xl font-sans">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Subscription Not Found</h3>
        <p className="text-xs text-slate-500">The subscription ID could not be retrieved or has expired.</p>
        <Button onClick={handleClose} className="w-full mt-4 bg-slate-900 text-white rounded-xl text-xs py-2.5">
          Close Window
        </Button>
      </div>
    );
  }

  const isCancelled = sub.status === 'CANCELLED';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-7 space-y-6 max-w-lg mx-auto font-sans relative">
      {/* App & Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 font-bold text-sm">
            {sub.app?.name ? sub.app.name.charAt(0) : '1'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900">{sub.app?.name || 'Client Application'}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-[11px] text-slate-400">180 Pay Subscription</span>
          </div>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1.5 ${
          isCancelled
            ? 'bg-slate-100 text-slate-600 border border-slate-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {!isCancelled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          <span>{sub.status}</span>
        </div>
      </div>

      {/* Plan Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-blue-100/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-900 tracking-tight">{sub.planName}</span>
          <div className="text-right">
            <span className="text-lg font-black text-slate-900">
              {sub.currency === 'USD' ? '$' : '₹'}{Number(sub.amount).toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500"> / {sub.interval?.toLowerCase() || 'month'}</span>
          </div>
        </div>

        {sub.description && (
          <p className="text-[11px] text-slate-600 leading-relaxed">{sub.description}</p>
        )}

        <div className="pt-2 border-t border-blue-100/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            <span>Recurring Mandate</span>
          </span>
          <span className="font-semibold text-slate-700">
            {sub.paymentSource === 'RAZORPAY_MANDATE'
              ? 'Bank / Card Mandate (Razorpay Backed)'
              : '180 Prepaid Wallet Debit'}
          </span>
        </div>
      </div>

      {/* Subscription Timeline & Billing Specs */}
      <div className="space-y-2 text-xs border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Current Period</span>
          </span>
          <span className="font-medium text-slate-900">
            {sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString() : 'N/A'} -{' '}
            {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-slate-200/60">
          <span className="text-slate-500">Next Auto-Renewal</span>
          <span className="font-bold text-slate-900">
            {isCancelled
              ? 'Cancelled (No further renewal)'
              : sub.nextBillingAt
              ? new Date(sub.nextBillingAt).toLocaleDateString()
              : 'Scheduled'}
          </span>
        </div>

        {isCancelled && sub.cancelledAt && (
          <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-slate-200/60">
            <span className="text-rose-500 font-medium">Cancellation Date</span>
            <span className="text-rose-600 font-semibold">{new Date(sub.cancelledAt).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Information Notice */}
      {!isCancelled ? (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/70 flex items-start gap-2.5 text-[11px] text-amber-800 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Dual-Revocation Notice:</strong> When you cancel this subscription, 180 Pay will automatically revoke the underlying recurring bank mandate with the gateway, and notify {sub.app?.name || 'the service'}. Your quota remains active until the end of the billing period.
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-2.5 text-[11px] text-slate-700 leading-relaxed">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong>Mandate Revoked:</strong> This subscription is officially cancelled. The underlying gateway mandate has been closed and zero future charges will occur.
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        {!isCancelled ? (
          <button
            onClick={() => setShowConfirmModal(true)}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Cancel Subscription & Revoke Mandate</span>
          </button>
        ) : null}

        <button
          onClick={handleClose}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          Close Manager
        </button>
      </div>

      {/* Confirm Cancellation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-extrabold text-slate-900">Cancel Subscription?</h4>
              <p className="text-xs text-slate-500">
                Are you sure you want to cancel your <strong>{sub.planName}</strong> subscription? This will cancel your auto-renewal and revoke your recurring bank/card mandate in 180 Pay.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Reason for cancellation
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="Found an alternative solution">Found an alternative solution</option>
                <option value="Too expensive / cutting costs">Too expensive / cutting costs</option>
                <option value="Temporary project completed">Temporary project completed</option>
                <option value="Feature not working as expected">Feature not working as expected</option>
                <option value="Other">Other reason</option>
              </select>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-rose-600/20"
              >
                {cancelling ? 'Revoking Mandate...' : 'Confirm & Cancel Subscription'}
              </Button>
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={cancelling}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Never mind, keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageSubscriptionClient;
