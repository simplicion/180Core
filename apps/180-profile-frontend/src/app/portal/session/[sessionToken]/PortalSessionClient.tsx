'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  Clock,
  ExternalLink,
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  Calendar,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Download,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';

interface PortalData {
  sessionToken: string;
  expiresAt: string;
  returnUrl: string;
  merchant: {
    name: string;
    logoUrl?: string;
    homepageUrl?: string;
    clientId: string;
  };
  customer: {
    email: string;
    externalId?: string;
  };
  subscriptions: Array<{
    id: string;
    planName: string;
    amount: number;
    currency: string;
    billingCycle: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingDate: string;
    cancelReason?: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    title: string;
    date: string;
    status: string;
    receiptUrl: string;
  }>;
}

interface PortalSessionClientProps {
  sessionToken?: string;
}

export function PortalSessionClient({ sessionToken: initialSessionToken }: PortalSessionClientProps = {}) {
  const params = useParams();

  // Resilient sessionToken extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialSessionToken = useCallback(() => {
    if (initialSessionToken && initialSessionToken !== 'default') return initialSessionToken;
    const pToken = (params?.sessionToken as string) || '';
    if (pToken && pToken !== 'default') return pToken;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/portal(?:\/session)?\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== 'default') {
        return decodeURIComponent(match[1]);
      }
    }
    return '';
  }, [initialSessionToken, params?.sessionToken]);

  const [sessionToken, setSessionToken] = useState<string>(getInitialSessionToken);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Cancel Modal State
  const [cancellingSubId, setCancellingSubId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('No longer needed');
  const [cancelImmediately, setCancelImmediately] = useState(false);

  // Link 180 Account State
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);

  // Fetch session data
  const fetchPortalData = useCallback(async (tokenToFetch?: string) => {
    const targetToken = tokenToFetch || sessionToken || getInitialSessionToken();
    if (!targetToken || targetToken === 'default') {
      setLoading(false);
      setError('This customer billing session has expired or is invalid.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const url = getCoreApiUrl(`/api/v1/customer-portal/sessions/${encodeURIComponent(targetToken)}`);
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json.data || json);
      } else {
        setError(json.error || 'This customer billing session has expired or is invalid.');
      }
    } catch {
      setError('Unable to connect to billing server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, getInitialSessionToken]);

  useEffect(() => {
    const currentToken = getInitialSessionToken();
    if (currentToken && currentToken !== 'default') {
      setSessionToken(currentToken);
      fetchPortalData(currentToken);
    } else {
      setLoading(false);
      setError('This customer billing session has expired or is invalid.');
    }
  }, [getInitialSessionToken, fetchPortalData]);

  // Session countdown timer
  useEffect(() => {
    if (!data?.expiresAt) return;
    const interval = setInterval(() => {
      const remainingMs = new Date(data.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft('Expired');
        setError('This secure session has expired. Please request a new billing link from the merchant.');
        clearInterval(interval);
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.expiresAt]);

  const handleCancelSubscription = async () => {
    if (!cancellingSubId) return;
    setCancelling(true);
    try {
      const url = getCoreApiUrl(
        `/api/v1/customer-portal/sessions/${encodeURIComponent(sessionToken)}/cancel-subscription`
      );
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: cancellingSubId,
          reason: cancelReason,
          cancelImmediately,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(json.message || 'Subscription cancelled successfully');
        setCancellingSubId(null);
        fetchPortalData();
      } else {
        toast.error(json.error || 'Failed to cancel subscription');
      }
    } catch {
      toast.error('Network error during cancellation');
    } finally {
      setCancelling(false);
    }
  };

  const handleLink180Account = async () => {
    setLinking(true);
    try {
      const url = getCoreApiUrl(
        `/api/v1/customer-portal/sessions/${encodeURIComponent(sessionToken)}/link-180-account`
      );
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLinked(true);
        toast.success('Successfully linked to your 180 Profile wallet');
      } else {
        toast.error(json.error || 'Failed to link account');
      }
    } catch {
      toast.error('Network error linking account');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
          <p className="text-sm text-zinc-400 font-medium">Verifying secure customer session...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 text-center space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Session Unavailable</h2>
          <p className="text-sm text-zinc-400">{error || 'This billing session is no longer active.'}</p>
          <div className="pt-2">
            {data?.returnUrl ? (
              <a
                href={data.returnUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-600/20"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to {data.merchant.name}
              </a>
            ) : (
              <a
                href="https://180workspace.com"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs font-semibold text-white transition-all"
              >
                Back to 180 Workspace
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.merchant.logoUrl ? (
              <img
                src={data.merchant.logoUrl}
                alt={data.merchant.name}
                className="h-8 w-8 rounded-lg object-contain bg-white/5 p-1 border border-zinc-800"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                {data.merchant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight">{data.merchant.name}</h1>
              <p className="text-[11px] text-zinc-400">Customer Self-Service Billing</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timeLeft && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
                <Clock className="h-3 w-3 text-indigo-400" />
                <span>Session: {timeLeft}</span>
              </div>
            )}

            {data.returnUrl && (
              <a
                href={data.returnUrl}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Return to</span> {data.merchant.name}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Customer Identity Card & Optional 180 Profile Bridge */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 backdrop-blur-xl shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400">Signed In As</span>
              <div className="text-lg font-bold text-white flex items-center gap-2">
                <span>{data.customer.email}</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  Verified Customer
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                You have authenticated via secure one-time session link. No password required.
              </p>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-zinc-800 pt-4 sm:pt-0 sm:pl-6">
              {linked ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="h-4 w-4" />
                  Linked to 180 Profile Wallet
                </div>
              ) : (
                <Button
                  onClick={handleLink180Account}
                  disabled={linking}
                  variant="outline"
                  size="sm"
                  className="text-xs border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  {linking ? 'Linking...' : 'Connect to 180 Profile'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Subscriptions Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-400" />
                Active Subscriptions
              </h2>
              <p className="text-xs text-zinc-400">Manage your recurring plans and cancel anytime</p>
            </div>
          </div>

          {data.subscriptions && data.subscriptions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.subscriptions.map((sub) => {
                const isActive = sub.status === 'ACTIVE';

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-xl flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-all shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white text-base">{sub.planName}</h3>
                          <div className="text-2xl font-extrabold text-white mt-1">
                            ${sub.amount.toFixed(2)}{' '}
                            <span className="text-xs font-medium text-zinc-400 uppercase">
                              {sub.currency} / {sub.billingCycle.toLowerCase()}
                            </span>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400 border border-zinc-700">
                            {sub.status}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5 text-xs text-zinc-400">
                        <div className="flex justify-between">
                          <span>Next Billing Date:</span>
                          <span className="text-zinc-200 font-medium">
                            {new Date(sub.nextBillingDate || sub.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Current Period:</span>
                          <span className="text-zinc-300">
                            {new Date(sub.currentPeriodStart).toLocaleDateString()} –{' '}
                            {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                        {sub.cancelReason && (
                          <div className="flex justify-between text-amber-400">
                            <span>Cancellation:</span>
                            <span>{sub.cancelReason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isActive && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancellingSubId(sub.id)}
                          className="w-full border-zinc-800 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
                        >
                          Cancel Subscription
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-xs text-zinc-500">
              No active recurring subscriptions found for this email address.
            </div>
          )}
        </div>

        {/* Invoices & Billing History Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-400" />
              Invoices & Payment History
            </h2>
            <p className="text-xs text-zinc-400">Download PDF receipts for your accounting and expense reporting</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl overflow-hidden shadow-xl">
            {data.invoices && data.invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-400 bg-zinc-950/60">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {data.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">{inv.invoiceNumber}</td>
                        <td className="py-3.5 px-4 font-medium text-white">{inv.title}</td>
                        <td className="py-3.5 px-4 text-xs text-zinc-400">
                          {new Date(inv.date).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-white">
                          ${inv.amount.toFixed(2)} {inv.currency}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <a
                            href={inv.receiptUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-zinc-500">No payment receipts or invoices generated yet.</div>
            )}
          </div>
        </div>
      </main>

      {/* Subscription Cancellation Modal */}
      {cancellingSubId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Cancel Subscription
              </h3>
              <button
                onClick={() => setCancellingSubId(null)}
                className="text-zinc-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed">
                We are sorry to see you go. Please let us know why you are cancelling so we can improve our service:
              </p>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Reason for Cancellation</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="No longer needed">No longer needed</option>
                  <option value="Too expensive">Too expensive / Found cheaper alternative</option>
                  <option value="Missing features">Missing required features</option>
                  <option value="Technical issues">Technical issues or bugs</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cancelImmediately}
                    onChange={(e) => setCancelImmediately(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <span className="font-medium text-white block">Cancel immediately</span>
                    <span className="text-zinc-500 text-[11px]">
                      {cancelImmediately
                        ? 'Revokes access immediately today.'
                        : 'Keep plan active until the end of your prepaid period.'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancellingSubId(null)}
                  className="border-zinc-800 text-zinc-400"
                >
                  Keep Subscription
                </Button>
                <Button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  size="sm"
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
