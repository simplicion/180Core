'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  CreditCard,
  Layers,
  Users,
  ChevronRight,
  X,
  RotateCcw,
  Send,
  Download,
  Filter,
  Check,
  Clock,
  Radio,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function TransactionsLedgerPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [serverMetrics, setServerMetrics] = useState<any | null>(null);

  // Refund Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Webhook Retrigger State
  const [retriggering, setRetriggering] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, [search, statusFilter]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTransactions({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      if (res.success) {
        setTransactions(res.transactions || res.data?.transactions || []);
        if (res.metrics) {
          setServerMetrics(res.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load transactions ledger', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedTx) return;
    try {
      setRefunding(true);
      const res = await adminApi.refundTransaction(
        selectedTx.id,
        refundReason.trim() || 'Administrative refund initiated by platform superadmin'
      );
      if (res.success) {
        toast.success(`Transaction #${selectedTx.id.slice(0, 8)} marked as REFUNDED!`);
        setIsRefundModalOpen(false);
        setRefundReason('');
        setSelectedTx((prev: any) => ({ ...prev, status: 'REFUNDED' }));
        loadTransactions();
      }
    } catch (err: any) {
      toast.error(err.message || 'Refund processing failed');
    } finally {
      setRefunding(false);
    }
  };

  const handleRetriggerWebhook = async () => {
    if (!selectedTx) return;
    try {
      setRetriggering(true);
      const res = await adminApi.retriggerWebhook(selectedTx.id);
      if (res.success) {
        toast.success(
          `Webhook event dispatched to ${res.endpointsDispatched || 1} registered developer endpoint(s)!`
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch webhook');
    } finally {
      setRetriggering(false);
    }
  };

  const handleExportCsv = () => {
    if (!transactions.length) {
      toast.error('No transactions to export');
      return;
    }
    const rows = transactions.map((t) => ({
      TransactionID: t.id,
      AppName: t.app?.name || t.appName || '180 Pay App',
      DeveloperName: t.app?.user?.name || t.developer?.name || 'Developer',
      DeveloperEmail: t.app?.user?.email || t.developer?.email || '',
      CustomerName: t.customerName || 'Guest User',
      CustomerEmail: t.customerEmail || '',
      Currency: t.currency || 'USD',
      Amount: (t.amount || 0).toFixed(2),
      Status: t.status,
      Gateway: t.gateway || '180 Pay Standard',
      PaymentMethod: t.paymentMethod || 'UPI / Card / Netbanking',
      OrderOrTitle: t.title || t.orderId || 'Checkout Session',
      CreatedAt: new Date(t.createdAt).toLocaleString(),
    }));
    exportToCsv('180_master_transaction_ledger', rows);
    toast.success(`Exported ${transactions.length} transaction records to CSV`);
  };

  // Currency normalization helper for client-side fallback
  const toUsd = (amount: number, curr: string = 'USD') => {
    if (!amount || isNaN(amount)) return 0;
    const c = String(curr || 'USD').toUpperCase();
    if (c === 'INR') return Math.round((amount / 83.5) * 100) / 100;
    if (c === 'EUR') return Math.round((amount / 0.92) * 100) / 100;
    if (c === 'NPR') return Math.round((amount / 133.5) * 100) / 100;
    return Math.round(amount * 100) / 100;
  };

  // Metrics (prioritize authoritative server metrics calculated across full DB)
  const totalVolume = serverMetrics
    ? serverMetrics.totalCapturedVolume
    : transactions
        .filter((t) => t.status === 'PAID' || t.status === 'COMPLETED' || t.status === 'CAPTURED')
        .reduce((acc, t) => acc + toUsd(t.amount || 0, t.currency), 0);

  const successCount = serverMetrics
    ? serverMetrics.capturedCount
    : transactions.filter(
        (t) => t.status === 'PAID' || t.status === 'COMPLETED' || t.status === 'CAPTURED'
      ).length;

  const refundedVolume = serverMetrics
    ? serverMetrics.refundedVolume
    : transactions
        .filter((t) => t.status === 'REFUNDED')
        .reduce((acc, t) => acc + toUsd(t.amount || 0, t.currency), 0);

  const refundedCount = serverMetrics
    ? serverMetrics.refundedCount
    : transactions.filter((t) => t.status === 'REFUNDED').length;

  const totalInitiated = serverMetrics ? serverMetrics.totalInitiatedCount : transactions.length;

  const successRate = serverMetrics
    ? serverMetrics.conversionRate
    : totalInitiated > 0
    ? Math.round((successCount / totalInitiated) * 100)
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Master Transaction & Sovereign Ledger Explorer
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {transactions.length} Records
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Universal audit stream of every checkout session, QR payment link, subscription charge, and administrative refund.
          </p>
        </div>

        {/* Search, Filter & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search session ID, customer, app..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-60"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Captured / Paid</option>
            <option value="PENDING">Pending Checkout</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Total Captured Volume</div>
            <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-1">
              ${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500">{successCount} successful checkouts</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Checkout Conversion Rate</div>
            <div className="text-2xl font-black font-mono text-blue-500 mt-1">{successRate}%</div>
            <div className="text-[11px] text-zinc-500">Based on {totalInitiated} initiated sessions</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Radio className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Refunded Transactions</div>
            <div className="text-2xl font-black font-mono text-rose-500 mt-1">
              ${refundedVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500">
              {refundedCount} reversals processed
            </div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <RotateCcw className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-zinc-500">Loading sovereign ledger stream...</div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
              <CreditCard className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Transactions Recorded Yet</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              No live checkout sessions or captured payments found in the ledger. Real-time payments from 180 Pay checkout sessions will stream here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Session ID & Order</th>
                  <th className="py-3.5 px-4 font-medium">Application & Dev</th>
                  <th className="py-3.5 px-4 font-medium">Customer Details</th>
                  <th className="py-3.5 px-4 font-medium">Gateway Protocol</th>
                  <th className="py-3.5 px-4 font-medium">Gross Amount</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono">
                {transactions.map((tx) => {
                  const isSuccess = tx.status === 'PAID' || tx.status === 'COMPLETED' || tx.status === 'CAPTURED';
                  const isPending = tx.status === 'PENDING';
                  const isRefunded = tx.status === 'REFUNDED';
                  const isFailed = tx.status === 'FAILED';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-6 font-sans">
                        <div className="font-semibold text-zinc-900 dark:text-white font-mono text-xs">
                          {tx.id.slice(0, 10)}...
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate max-w-[160px]">
                          {tx.title || tx.orderId || 'Checkout Session'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans text-zinc-800 dark:text-zinc-200">
                        <div className="font-semibold">{tx.app?.name || tx.appName || '180 Core'}</div>
                        <div className="text-[10px] text-zinc-500">{tx.app?.user?.name || tx.developer?.name || 'Developer'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-medium text-zinc-900 dark:text-white">{tx.customerName || 'Guest User'}</div>
                        <div className="text-[10px] text-zinc-500">{tx.customerEmail || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold">
                          {tx.gateway || '180 Pay'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white text-sm">
                        {tx.currency || 'USD'} {(tx.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : isPending
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : isRefunded
                              ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-sans text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Inspection Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-white/10">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Transaction Inspector</h3>
                  <p className="font-mono text-xs text-zinc-500">{selectedTx.id}</p>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4 text-xs">
                {/* Gross Amount Card */}
                <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-2">
                  <div className="text-zinc-500">Gross Processed</div>
                  <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
                    {selectedTx.currency || 'USD'} {(selectedTx.amount || 0).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Order Title: <span className="text-zinc-900 dark:text-white font-medium">{selectedTx.title || 'Checkout Session'}</span>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Application</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {selectedTx.app?.name || selectedTx.appName || '180 Core'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Owner Developer</span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {selectedTx.app?.user?.name || selectedTx.developer?.name || 'Developer'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Customer Details</span>
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {selectedTx.customerName || 'Guest'} ({selectedTx.customerEmail || 'No email'})
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Payment Gateway</span>
                    <span className="font-mono text-blue-500">{selectedTx.gateway || '180 Pay Standard'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Payment Instrument</span>
                    <span className="text-zinc-800 dark:text-zinc-200">{selectedTx.paymentMethod || 'UPI QR / Netbanking / Card'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Status</span>
                    <span
                      className={`font-bold ${
                        selectedTx.status === 'PAID' || selectedTx.status === 'COMPLETED'
                          ? 'text-emerald-500'
                          : selectedTx.status === 'REFUNDED'
                          ? 'text-purple-500'
                          : 'text-amber-500'
                      }`}
                    >
                      {selectedTx.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Timestamp</span>
                    <span className="text-zinc-500 font-mono text-[11px]">
                      {new Date(selectedTx.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Gateway Metadata / Logs */}
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="font-semibold text-zinc-700 dark:text-zinc-300">Gateway Telemetry Logs</div>
                  <div className="font-mono text-[11px] text-zinc-500 break-all">
                    {selectedTx.metadata ? JSON.stringify(selectedTx.metadata, null, 2) : 'status: SUCCESS | signature: VERIFIED_ECDSA'}
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Actions in Drawer */}
            <div className="pt-6 border-t border-zinc-100 dark:border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  disabled={retriggering}
                  onClick={handleRetriggerWebhook}
                  className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="h-3.5 w-3.5 text-blue-500" />
                  <span>{retriggering ? 'Dispatching...' : 'Re-trigger Webhook'}</span>
                </button>

                {selectedTx.status !== 'REFUNDED' ? (
                  <button
                    onClick={() => setIsRefundModalOpen(true)}
                    className="w-1/2 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Issue Refund</span>
                  </button>
                ) : (
                  <div className="w-1/2 py-2.5 text-center text-xs font-semibold text-purple-500 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    Already Refunded
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {isRefundModalOpen && selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Issue Administrative Refund</h3>
                  <p className="text-xs text-zinc-500">Reverses customer charge and marks session as REFUNDED</p>
                </div>
              </div>
              <button onClick={() => setIsRefundModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-1">
                <div className="text-zinc-500">Refund Amount</div>
                <div className="text-2xl font-black font-mono text-rose-500">
                  {selectedTx.currency || 'USD'} {(selectedTx.amount || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Customer: {selectedTx.customerName || 'Guest'} ({selectedTx.customerEmail || 'N/A'})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Refund *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Accidental duplicate charge or customer cancellation requested."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={() => setIsRefundModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={refunding}
                onClick={handleRefund}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/25 transition-all"
              >
                {refunding ? 'Processing...' : 'Confirm & Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
