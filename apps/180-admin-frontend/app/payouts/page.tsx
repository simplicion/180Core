'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowDownToLine,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Landmark,
  FileText,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Send,
  X,
  Download,
  Filter,
  Check,
  Building2,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function PayoutsSettlementDeskPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'SETTLE' | 'REJECT' | null>(null);

  // Form states
  const [utrReference, setUtrReference] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, [statusFilter]);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getPayouts({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      if (res.success) {
        const fetched = res.payouts || res.data?.payouts || [];
        setPayouts(fetched);
      }
    } catch (err) {
      console.error('Failed to load payouts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedPayout) return;
    try {
      setSubmitting(true);
      const res = await adminApi.approvePayout(
        selectedPayout.id,
        adminNotes.trim() || 'Approved by compliance officer. Queued for bank dispatch.'
      );
      if (res.success) {
        toast.success(`Payout request #${selectedPayout.id.slice(0, 8)} approved and set to PROCESSING!`);
        closeModal();
        loadPayouts();
      }
    } catch (err: any) {
      toast.error(err.message || 'Approval execution failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedPayout) return;
    if (!utrReference.trim()) {
      toast.error('Bank Transaction Reference (UTR / Tx ID) is mandatory to settle');
      return;
    }
    try {
      setSubmitting(true);
      const res = await adminApi.settlePayout(selectedPayout.id, {
        utrReference: utrReference.trim(),
        adminNotes: adminNotes.trim(),
      });
      if (res.success) {
        toast.success(`Settlement of ${selectedPayout.currency || 'USD'} ${selectedPayout.amount} marked as PAID!`);
        closeModal();
        loadPayouts();
      }
    } catch (err: any) {
      toast.error(err.message || 'Settlement execution failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayout || !rejectReason.trim()) {
      toast.error('Please specify a rejection reason for developer feedback');
      return;
    }
    try {
      setSubmitting(true);
      const res = await adminApi.rejectPayout(selectedPayout.id, rejectReason.trim());
      if (res.success) {
        toast.success('Payout request marked as REJECTED');
        closeModal();
        loadPayouts();
      }
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setSelectedPayout(null);
    setActionType(null);
    setUtrReference('');
    setAdminNotes('');
    setRejectReason('');
  };

  const filteredPayouts = payouts.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const devName = (p.app?.user?.name || p.developer?.name || p.developerName || '').toLowerCase();
    const appName = (p.app?.name || p.appName || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    const utr = (p.transactionRef || p.utrReference || '').toLowerCase();
    return devName.includes(term) || appName.includes(term) || id.includes(term) || utr.includes(term);
  });

  const handleExportCsv = () => {
    if (!filteredPayouts.length) {
      toast.error('No payouts to export');
      return;
    }
    const rows = filteredPayouts.map((p) => ({
      PayoutID: p.id,
      DeveloperName: p.app?.user?.name || p.developer?.name || p.developerName || 'Unknown',
      DeveloperEmail: p.app?.user?.email || p.developer?.email || '',
      AppName: p.app?.name || p.appName || '',
      Currency: p.currency || 'USD',
      Amount: (p.amount || 0).toFixed(2),
      Status: p.status,
      BankName: p.bankName || 'Wire Transfer',
      AccountOrUpi: p.accountNumber || p.upiId || '•••• ' + (p.accountLast4 || '8910'),
      BankReferenceUTR: p.transactionRef || p.utrReference || '',
      AdminNotes: p.adminNote || p.adminNotes || '',
      RequestedAt: new Date(p.requestedAt || p.createdAt).toLocaleString(),
      ProcessedAt: p.processedAt ? new Date(p.processedAt).toLocaleString() : '',
    }));
    exportToCsv('180_payout_settlement_ledger', rows);
    toast.success(`Exported ${filteredPayouts.length} payout records to CSV`);
  };

  // Metrics
  const pendingCount = payouts.filter((p) => p.status === 'PENDING_REVIEW' || p.status === 'PENDING').length;
  const pendingVolume = payouts
    .filter((p) => p.status === 'PENDING_REVIEW' || p.status === 'PENDING')
    .reduce((acc, p) => acc + (p.amount || 0), 0);
  const processingVolume = payouts
    .filter((p) => p.status === 'PROCESSING' || p.status === 'APPROVED')
    .reduce((acc, p) => acc + (p.amount || 0), 0);
  const settledVolume = payouts
    .filter((p) => p.status === 'PAID' || p.status === 'SETTLED')
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Settlement & Payouts Command Desk
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {pendingCount} Pending Requests
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Review settlement queues, compliance-approve requests, record banking UTR reference numbers, and auto-debit developer wallets.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search developer, UTR, app..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-56"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="PROCESSING">Processing / Approved</option>
            <option value="PAID">Paid / Settled</option>
            <option value="REJECTED">Rejected</option>
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Pending Review Queue</div>
            <div className="text-2xl font-black font-mono text-amber-500 mt-1">
              ${pendingVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500">{pendingCount} requests awaiting verification</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">In Banking Dispatch (Processing)</div>
            <div className="text-2xl font-black font-mono text-blue-500 mt-1">
              ${processingVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500">Approved, awaiting UTR reference confirmation</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Landmark className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Settled to Bank Accounts</div>
            <div className="text-2xl font-black font-mono text-emerald-500 mt-1">
              ${settledVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500">Fully settled with verified bank UTRs</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Payouts Table */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-zinc-500">Loading payout records...</div>
        ) : filteredPayouts.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
              <Landmark className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Settlement Requests</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              No developer payout requests found matching the current criteria. Payout requests initiated from 180 Developer Portal will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Developer & App</th>
                  <th className="py-3.5 px-4 font-medium">Requested Amount</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Balance</th>
                  <th className="py-3.5 px-4 font-medium">Beneficiary / Bank</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Timestamp</th>
                  <th className="py-3.5 px-6 font-medium text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono">
                {filteredPayouts.map((payout) => {
                  const devName = payout.app?.user?.name || payout.developer?.name || payout.developerName || 'Developer';
                  const devEmail = payout.app?.user?.email || payout.developer?.email || payout.developerEmail || '';
                  const appName = payout.app?.name || payout.appName || '180 Pay App';
                  const walletBal = payout.app?.wallet?.balance ?? payout.walletBalance ?? 0;
                  const isPending = payout.status === 'PENDING_REVIEW' || payout.status === 'PENDING';
                  const isProcessing = payout.status === 'PROCESSING' || payout.status === 'APPROVED';
                  const isPaid = payout.status === 'PAID' || payout.status === 'SETTLED';
                  const isRejected = payout.status === 'REJECTED';

                  return (
                    <tr key={payout.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-6 font-sans">
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          {devName}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-zinc-500">
                            {appName}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500">{devEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white text-sm">
                        {payout.currency || 'USD'} {(payout.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-purple-600 dark:text-purple-400">
                        ${walletBal.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-zinc-700 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Landmark className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{payout.bankName || 'Wire Transfer'}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {payout.accountNumber || payout.upiId || `Acc: •••• ${payout.accountLast4 || '8910'}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : isProcessing
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : isPending
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                        {new Date(payout.requestedAt || payout.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 font-sans text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('APPROVE');
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                              title="Compliance Approve"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('SETTLE');
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                              title="Enter UTR and Settle"
                            >
                              Settle
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('REJECT');
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : isProcessing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('SETTLE');
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                            >
                              Mark Settled (UTR)
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('REJECT');
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : isPaid ? (
                          <div className="text-[11px] text-zinc-500 font-mono text-right">
                            UTR: <span className="text-emerald-500 font-bold">{payout.transactionRef || payout.utrReference || 'CONFIRMED'}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-rose-500 text-right truncate max-w-[140px]">
                            {payout.adminNote || 'Rejected'}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {actionType === 'APPROVE' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Approve Payout Request</h3>
                  <p className="text-xs text-zinc-500">
                    Moves to PROCESSING state and informs developer the funds are in transit.
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-1">
                <div className="text-zinc-500">Amount Requested</div>
                <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
                  {selectedPayout.currency || 'USD'} {(selectedPayout.amount || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Developer: {selectedPayout.app?.user?.name || selectedPayout.developerName}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Compliance Officer Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Identity and KYC verified. Transferred to treasury bank batch."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleApprove}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all"
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {actionType === 'SETTLE' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Record Bank Settlement (PAID)</h3>
                  <p className="text-xs text-zinc-500">
                    Settles payout, debits developer AppWallet, and records Bank UTR in audit ledger.
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-1">
                <div className="text-zinc-500">Settlement Amount</div>
                <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
                  {selectedPayout.currency || 'USD'} {(selectedPayout.amount || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Target Beneficiary: {selectedPayout.bankName || 'Wire Transfer'} ({selectedPayout.accountNumber || selectedPayout.upiId || '•••• ' + (selectedPayout.accountLast4 || '8910')})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bank UTR Reference Number / Wire Tx ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR_HDFC_9921820492 or WIRE_BOFA_991823"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl font-mono text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Settlement Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wire transfer executed via corporate desk."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleSettle}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/25 transition-all"
              >
                {submitting ? 'Settling...' : 'Confirm Settlement & Debit Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {actionType === 'REJECT' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Reject Settlement Request</h3>
                  <p className="text-xs text-zinc-500">Developer will receive this mandatory rejection notice.</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Beneficiary IFSC code mismatch or invalid bank account details provided."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={handleReject}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/25 transition-all"
              >
                {submitting ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
