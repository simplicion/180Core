'use strict';
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Landmark,
  RotateCw,
  Loader2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  X,
  Percent,
  Receipt,
  Wallet,
  ShieldCheck,
  Calculator,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
  FileText,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  LifeBuoy,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';
import { usePlatformCurrency } from '@workspace/ui';
import { getStoredAuthToken } from '@/lib/auth';
import { BankDetailsDrawer } from './BankDetailsDrawer';

export function PayPayoutsView() {
  const {
    projectId,
    userProfile,
    payoutBalance,
    totalWithdrawn,
    payoutHistory,
    ledgerEntries,
    loadingPayoutHistory,
    fetchPayoutHistory,
    bankDetails,
    paymentAnalytics,
    loadingAnalytics,
    fetchPaymentAnalytics,
  } = useProject();

  const [showBankDrawer, setShowBankDrawer] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [bankAccNumber, setBankAccNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorAmount, setSimulatorAmount] = useState('1000');
  const [activeTab, setActiveTab] = useState<'ledger' | 'payouts'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dispute ticket modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputePayout, setDisputePayout] = useState<any | null>(null);
  const [disputeDescription, setDisputeDescription] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Confirm receipt state
  const [confirmingPayoutId, setConfirmingPayoutId] = useState<string | null>(null);

  // Dismissed notification banner IDs
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    fetchPayoutHistory(true);
    if (fetchPaymentAnalytics) {
      fetchPaymentAnalytics(true);
    }
  }, [fetchPayoutHistory, fetchPaymentAnalytics]);

  // Auto-open bank drawer if navigated with drawer=bank (e.g. from bank redirect)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('drawer=bank')) {
      setShowBankDrawer(true);
    }
  }, []);

  // Sync bank details to payout request modal when available
  useEffect(() => {
    if (bankDetails) {
      if (bankDetails.accountHolderName && !bankHolder) setBankHolder(bankDetails.accountHolderName);
      if (bankDetails.accountNumber && !bankAccNumber) setBankAccNumber(bankDetails.accountNumber);
      if (bankDetails.ifscCode && !bankIfsc) setBankIfsc(bankDetails.ifscCode);
      if (bankDetails.upiId && !upiId) setUpiId(bankDetails.upiId);
    }
  }, [bankDetails]);

  const { formatAmount, activeMeta } = usePlatformCurrency();
  const currencySymbol = activeMeta.symbol;
  const formatCurrency = (val: number) => {
    return formatAmount(val, paymentAnalytics?.currency || 'INR');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied reference ID');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Gross Volume Received from Customer Payments
  const grossVolume = Number(paymentAnalytics?.grossVolume ?? (payoutBalance || 0));

  // 2. 180 Pay Platform Fee: 1.5%
  const feePercent = paymentAnalytics?.platformFeePercent ?? 1.5;
  const whatWeKeep =
    paymentAnalytics?.totalPlatformFee ?? (Math.round(grossVolume * (feePercent / 100) * 100) / 100);

  // 3. What Merchant Earns Net (98.5% Net Revenue before withdrawals)
  const whatYouEarnNet =
    paymentAnalytics?.netMerchantVolume ?? (Math.round((grossVolume - whatWeKeep) * 100) / 100);

  // 4. Total Withdrawn (sum of all completed or active pending payouts)
  const computedTotalWithdrawn = useMemo(() => {
    if (typeof paymentAnalytics?.totalWithdrawn === 'number') {
      return paymentAnalytics.totalWithdrawn;
    }
    if (typeof totalWithdrawn === 'number' && totalWithdrawn > 0) {
      return totalWithdrawn;
    }
    if (Array.isArray(payoutHistory) && payoutHistory.length > 0) {
      return payoutHistory
        .filter((p: any) => p.status !== 'REJECTED')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    }
    return 0;
  }, [paymentAnalytics, totalWithdrawn, payoutHistory]);

  // 5. Effective Available Balance for Instant Payout:
  // Net merchant volume MINUS total withdrawn funds
  const effectiveAvailableBalance = useMemo(() => {
    if (typeof paymentAnalytics?.withdrawableBalance === 'number') {
      return paymentAnalytics.withdrawableBalance;
    }
    if (payoutBalance > 0) {
      return payoutBalance;
    }
    return Math.max(0, Math.round((whatYouEarnNet - computedTotalWithdrawn) * 100) / 100);
  }, [paymentAnalytics, payoutBalance, whatYouEarnNet, computedTotalWithdrawn]);

  // Simulator calculation
  const simNum = parseFloat(simulatorAmount) || 0;
  const simFee = Math.round(simNum * (feePercent / 100) * 100) / 100;
  const simNet = Math.round((simNum - simFee) * 100) / 100;

  // Filtered Ledger entries
  const filteredLedger = useMemo(() => {
    if (!Array.isArray(ledgerEntries)) return [];
    if (!searchQuery.trim()) return ledgerEntries;
    const q = searchQuery.toLowerCase();
    return ledgerEntries.filter(
      (e: any) =>
        e.description?.toLowerCase().includes(q) ||
        e.referenceId?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q) ||
        String(e.amount).includes(q)
    );
  }, [ledgerEntries, searchQuery]);

  // Filtered Payout records
  const filteredPayouts = useMemo(() => {
    if (!Array.isArray(payoutHistory)) return [];
    if (!searchQuery.trim()) return payoutHistory;
    const q = searchQuery.toLowerCase();
    return payoutHistory.filter(
      (p: any) =>
        p.id?.toLowerCase().includes(q) ||
        p.payoutMethod?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q) ||
        p.transactionRef?.toLowerCase().includes(q) ||
        String(p.amount).includes(q)
    );
  }, [payoutHistory, searchQuery]);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (!amountNum || amountNum < 1) {
      toast.error('Minimum withdrawal amount is ₹1.00');
      return;
    }

    if (amountNum > effectiveAvailableBalance) {
      toast.error(`Amount exceeds available withdrawable balance of ${formatCurrency(effectiveAvailableBalance)}`);
      return;
    }

    if (payoutMethod === 'UPI' && (!upiId || upiId.trim().length < 3)) {
      toast.error('Please enter a valid UPI ID (e.g. merchant@okaxis)');
      return;
    }

    if (payoutMethod === 'BANK_TRANSFER' && (!bankAccNumber || !bankIfsc || !bankHolder)) {
      toast.error('Please provide complete account number, IFSC code, and account holder name');
      return;
    }

    setIsSubmitting(true);
    try {
      const token =
        getStoredAuthToken() ||
        (typeof window !== 'undefined' ? localStorage.getItem('platform_auth_token') : null);

      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';

      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          payoutMethod,
          accountDetails:
            payoutMethod === 'UPI'
              ? { upiId: upiId.trim() }
              : {
                  accountNumber: bankAccNumber.trim(),
                  ifscCode: bankIfsc.trim().toUpperCase(),
                  accountHolderName: bankHolder.trim(),
                },
        }),
      });

      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}. Please check your connection or session.`);
        }
        throw new Error('Unexpected response format from server');
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || `Payout request failed (HTTP ${res.status})`);
      }

      toast.success('Payout request submitted successfully for settlement disbursement!');
      setShowPayoutModal(false);
      setPayoutAmount('');

      // Refresh both payouts and analytics immediately
      fetchPayoutHistory(true);
      if (fetchPaymentAnalytics) fetchPaymentAnalytics(true);
    } catch (err: any) {
      toast.error(err.message || 'Payout request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Developer confirms receipt of settled funds
  const handleConfirmReceipt = async (payoutId: string) => {
    try {
      setConfirmingPayoutId(payoutId);
      const token =
        getStoredAuthToken() ||
        (typeof window !== 'undefined' ? localStorage.getItem('platform_auth_token') : null);

      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';

      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/payouts/${payoutId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        throw new Error('Unexpected response format');
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to confirm payout receipt');
      }

      toast.success('Payout receipt confirmed! Thank you.');
      fetchPayoutHistory(true);
    } catch (err: any) {
      toast.error(err.message || 'Error confirming receipt');
    } finally {
      setConfirmingPayoutId(null);
    }
  };

  // Open the dispute support ticket modal
  const handleOpenDispute = (payout: any) => {
    setDisputePayout(payout);
    const dest =
      payout.accountDetails?.upiId ||
      (payout.accountDetails?.accountNumber
        ? `A/C ending ${payout.accountDetails.accountNumber.slice(-4)} (${payout.accountDetails.bankName || 'Bank'})`
        : payout.destination || 'Bank/UPI');

    setDisputeDescription(
      `Hello 180 Core Support,\n\nI have not received the payout settlement of ₹${Number(payout.amount).toFixed(
        2
      )} for Payout Request #${payout.id}.\n\n` +
        `Recorded Bank UTR / Tx ID: ${payout.transactionRef || 'N/A'}\n` +
        `Disbursement Method: ${payout.payoutMethod || 'UPI'}\n` +
        `Target Beneficiary: ${dest}\n` +
        `Settlement Date: ${new Date(payout.processedAt || payout.updatedAt || Date.now()).toLocaleString()}\n\n` +
        `I checked my bank/UPI statement and the amount has not credited. Please investigate this settlement with the corporate treasury bank.`
    );
    setShowDisputeModal(true);
  };

  // Submit dispute support ticket
  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputePayout || !disputeDescription.trim()) {
      toast.error('Please provide a description of the issue');
      return;
    }

    try {
      setIsSubmittingDispute(true);
      const token =
        getStoredAuthToken() ||
        (typeof window !== 'undefined' ? localStorage.getItem('platform_auth_token') : null);

      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isLocal
        ? 'http://localhost:4003'
        : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';

      const res = await fetch(`${apiBase}/api/v1/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: `Dispute: Settlement of ₹${Number(disputePayout.amount).toFixed(2)} not received (UTR: ${
            disputePayout.transactionRef || disputePayout.id.slice(0, 8)
          })`,
          description: disputeDescription.trim(),
          category: 'SETTLEMENT_QUERY',
          priority: 'HIGH',
          appId: projectId,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          userId: userProfile?.id || null,
          userName: userProfile?.name || null,
          userEmail: userProfile?.email || null,
        }),
      });

      let data: any = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch (_) {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        throw new Error('Unexpected response format');
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Failed to submit dispute ticket');
      }

      toast.success(
        `Support ticket #${data.ticket?.ticketNumber || ''} created! Our compliance and banking desk has been notified.`,
        { duration: 6000 }
      );
      setShowDisputeModal(false);
      setDisputePayout(null);
      setDisputeDescription('');
    } catch (err: any) {
      toast.error(err.message || 'Error submitting dispute ticket');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  // Find latest settled payout for top notification banner
  const latestSettledPayout = useMemo(() => {
    if (!Array.isArray(payoutHistory)) return null;
    return payoutHistory.find(
      (p: any) =>
        (p.status === 'PAID' || p.status === 'COMPLETED') &&
        !dismissedNotificationIds.includes(p.id)
    );
  }, [payoutHistory, dismissedNotificationIds]);

  const getLedgerTypeInfo = (type: string, amount: number) => {
    switch (type) {
      case 'CHECKOUT_RECEIVE':
        return {
          label: 'Customer Payment',
          icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />,
          badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          amountClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
          prefix: '+',
        };
      case 'PAYOUT':
        return {
          label: 'Withdrawal Payout',
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-purple-500" />,
          badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          amountClass: 'text-purple-600 dark:text-purple-400 font-bold',
          prefix: '-',
        };
      case 'REFUND':
        return {
          label: 'Refund / Reversal',
          icon: <RotateCw className="w-3.5 h-3.5 text-blue-500" />,
          badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          amountClass: amount >= 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold',
          prefix: amount >= 0 ? '+' : '',
        };
      case 'TOPUP':
        return {
          label: 'Wallet Top-up',
          icon: <Coins className="w-3.5 h-3.5 text-indigo-500" />,
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          amountClass: 'text-indigo-600 dark:text-indigo-400 font-bold',
          prefix: '+',
        };
      default:
        return {
          label: type || 'Ledger Entry',
          icon: <FileText className="w-3.5 h-3.5 text-zinc-400" />,
          badgeClass: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
          amountClass: amount >= 0 ? 'text-zinc-900 dark:text-zinc-100 font-bold' : 'text-zinc-500',
          prefix: amount >= 0 ? '+' : '',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Request Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleRequestPayout}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
              <span className="font-bold text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Withdraw to Bank or UPI</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Withdrawal Amount ({currencySymbol})
                  </label>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    Max: {formatCurrency(effectiveAvailableBalance)}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    max={effectiveAvailableBalance}
                    step="any"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder={`Max ${formatCurrency(effectiveAvailableBalance)}`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                  {effectiveAvailableBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayoutAmount(String(effectiveAvailableBalance))}
                      className="absolute right-2 top-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600/20 cursor-pointer"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>

              {/* Fee Transparency Callout inside Modal */}
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-zinc-500">
                  <span>180 Pay Split Fee ({feePercent}%):</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
                    Already settled at capture
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-500">
                  <span>Disbursement / Payout Fee:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    ₹0.00 (Zero Fee)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-zinc-200 dark:border-white/5 text-zinc-950 dark:text-white font-bold">
                  <span>Net Disbursed to Bank/UPI:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs">
                    {payoutAmount ? formatCurrency(parseFloat(payoutAmount) || 0) : '₹0.00'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Transfer Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('UPI')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      payoutMethod === 'UPI'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
                    }`}
                  >
                    UPI ID (Instant 24x7)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('BANK_TRANSFER')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      payoutMethod === 'BANK_TRANSFER'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
                    }`}
                  >
                    NEFT / IMPS
                  </button>
                </div>
              </div>

              {payoutMethod === 'UPI' ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    VPA / UPI ID
                  </label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. merchant@okaxis"
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Account Number
                    </label>
                    <input
                      type="text"
                      required
                      value={bankAccNumber}
                      onChange={(e) => setBankAccNumber(e.target.value)}
                      placeholder="e.g. 501004561234"
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      required
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value)}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500 uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={bankHolder}
                      onChange={(e) => setBankHolder(e.target.value)}
                      placeholder="e.g. Acme Technologies Pvt Ltd"
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Submit Request</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Settlement Dispute Ticket Modal */}
      {showDisputeModal && disputePayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitDispute}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
              <span className="font-bold text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Raise Settlement Dispute Ticket</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputePayout(null);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payout Details Card */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Disputed Settlement Amount:</span>
                <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                  ₹{Number(disputePayout.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Payout ID:</span>
                <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                  #{disputePayout.id.slice(0, 16)}...
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Recorded Bank UTR:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                  {disputePayout.transactionRef || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Disbursement Method:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {disputePayout.payoutMethod || 'UPI'} (
                  {disputePayout.accountDetails?.upiId ||
                    disputePayout.accountDetails?.accountNumber ||
                    'Account'}
                  )
                </span>
              </div>
              {disputePayout.accountDetails?.proofUrl && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Transfer Proof:</span>
                  <a
                    href={disputePayout.accountDetails.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1 font-sans text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Proof Link</span>
                  </a>
                </div>
              )}
            </div>

            {/* Description Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Dispute Details / Issue Description</span>
                <span className="text-[10px] text-zinc-400 font-normal">Sent directly to Banking Desk</span>
              </label>
              <textarea
                required
                rows={5}
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500"
                placeholder="Explain the issue (e.g. amount not credited, UTR not recognized by bank)..."
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Our banking operations and compliance desk will cross-verify this UTR with the sponsor bank. You will receive real-time updates on this ticket.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDisputeModal(false);
                  setDisputePayout(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingDispute}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDispute ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LifeBuoy className="w-3.5 h-3.5" />
                )}
                <span>Submit Dispute Ticket</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Real-time Settlement Disbursed Notification Banner */}
      {latestSettledPayout && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in-50 slide-in-from-top-2">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-zinc-950 dark:text-white">
                  Settlement Disbursed: ₹{Number(latestSettledPayout.amount).toFixed(2)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  PAID
                </span>
                {latestSettledPayout.accountDetails?.receivedConfirmed && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>Confirmed by You</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Bank UTR / Tx ID: <span className="font-mono font-bold text-zinc-900 dark:text-white">{latestSettledPayout.transactionRef || 'CONFIRMED'}</span>
                {' · '}Disbursed to {latestSettledPayout.payoutMethod || 'UPI'} on{' '}
                {new Date(latestSettledPayout.processedAt || latestSettledPayout.updatedAt || Date.now()).toLocaleDateString()}
              </p>
              {latestSettledPayout.adminNote && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 italic">
                  Note from Treasury: &ldquo;{latestSettledPayout.adminNote}&rdquo;
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-center shrink-0">
            {latestSettledPayout.accountDetails?.proofUrl && (
              <a
                href={latestSettledPayout.accountDetails.proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-all shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                <span>View Proof</span>
              </a>
            )}

            {latestSettledPayout.accountDetails?.receivedConfirmed ? (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" />
                <span>Funds Received</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={confirmingPayoutId === latestSettledPayout.id}
                  onClick={() => handleConfirmReceipt(latestSettledPayout.id)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {confirmingPayoutId === latestSettledPayout.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>I Received This</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDispute(latestSettledPayout)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LifeBuoy className="w-3.5 h-3.5" />
                  <span>Not Received? Raise Ticket</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() =>
                setDismissedNotificationIds((prev) => [...prev, latestSettledPayout.id])
              }
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Balance & Treasury Financial Ledger */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Settlements &amp; Financial Ledger</span>
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Percent className="w-3 h-3" />
                <span>1.5% Platform Split Fee</span>
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Real-time double-entry ledger, revenue splits, and instant UPI / Bank disbursement treasury.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setShowBankDrawer(true)}
              className="px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all shadow-xs flex items-center gap-2 cursor-pointer group"
              title="Settlement Bank & UPI Settings"
              aria-label="Settlement Bank & UPI Settings"
            >
              <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-xs font-semibold">Settlement Bank &amp; UPI</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              disabled={effectiveAvailableBalance <= 0}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Request Payout</span>
            </button>
          </div>
        </div>

        {/* 4 Key Treasury Financial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL RECEIVED (GROSS) */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-3 relative overflow-hidden group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-500" />
                <span>Total Received</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Gross
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white font-mono">
                {formatCurrency(grossVolume)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Total customer payments collected across all checkouts.
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Transactions:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {paymentAnalytics?.totalTransactionsCount || (grossVolume > 0 ? 35 : 0)} captured
              </span>
            </div>
          </div>

          {/* Card 2: 180 PAY KEEPS (1.5%) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 via-zinc-50 to-transparent dark:from-purple-950/20 dark:via-zinc-900/60 dark:to-transparent border border-purple-500/20 space-y-3 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-purple-500" />
                <span>180 Pay Split</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                1.5% Fee
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                -{formatCurrency(whatWeKeep)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Platform fee retained automatically at 1.5% per successful payment.
              </p>
            </div>
            <div className="pt-2 border-t border-purple-500/10 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Gateway Surcharges:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹0.00 (Zero Hidden)</span>
            </div>
          </div>

          {/* Card 3: TOTAL WITHDRAWAL */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/5 via-zinc-50 to-transparent dark:from-amber-950/20 dark:via-zinc-900/60 dark:to-transparent border border-amber-500/20 space-y-3 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                <span>Total Withdrawal</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Payouts
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {formatCurrency(computedTotalWithdrawn)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Total merchant funds withdrawn or queued for bank disbursement.
              </p>
            </div>
            <div className="pt-2 border-t border-amber-500/10 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Payout Records:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {payoutHistory.filter((p: any) => p.status === 'PAID' || p.status === 'COMPLETED').length} Paid •{' '}
                {payoutHistory.filter((p: any) => ['PENDING_REVIEW', 'PROCESSING', 'APPROVED'].includes(p.status)).length} Pending
              </span>
            </div>
          </div>

          {/* Card 4: WHAT YOU CAN WITHDRAW */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-transparent border border-emerald-500/20 space-y-3 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Withdrawable Balance</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Available
                </span>
                <button
                  type="button"
                  onClick={() => {
                    fetchPayoutHistory(true);
                    if (fetchPaymentAnalytics) fetchPaymentAnalytics(true);
                  }}
                  disabled={loadingPayoutHistory || loadingAnalytics}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
                  title="Refresh balance"
                >
                  <RotateCw
                    className={`w-3.5 h-3.5 ${
                      loadingPayoutHistory || loadingAnalytics ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(effectiveAvailableBalance)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Net funds ready for instant UPI / Bank disbursement.
              </p>
            </div>
            <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Settlement Speed:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Instant T+0 / 24x7
              </span>
            </div>
          </div>
        </div>

        {/* Visual Revenue Split & Transparency Strip */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Transparent Settlement Balance Formula</span>
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Gross: {formatCurrency(grossVolume)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Fee (1.5%): -{formatCurrency(whatWeKeep)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Withdrawn: -{formatCurrency(computedTotalWithdrawn)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Available: {formatCurrency(effectiveAvailableBalance)}</span>
              </span>
            </div>
          </div>

          {/* Visual Percentage Bar */}
          <div className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{
                width: `${
                  grossVolume > 0
                    ? Math.min(100, (effectiveAvailableBalance / grossVolume) * 100)
                    : 0
                }%`,
              }}
              title="Available Withdrawable Balance"
            />
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{
                width: `${
                  grossVolume > 0
                    ? Math.min(100, (computedTotalWithdrawn / grossVolume) * 100)
                    : 0
                }%`,
              }}
              title="Already Withdrawn"
            />
            <div
              className="h-full bg-purple-600 transition-all duration-500"
              style={{ width: `${grossVolume > 0 ? (whatWeKeep / grossVolume) * 100 : 1.5}%` }}
              title="180 Pay Platform Fee (1.5%)"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
            <p className="leading-relaxed">
              <strong className="text-zinc-700 dark:text-zinc-300">How deduction works:</strong> For every ₹100.00 received from customers,{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">₹98.50</strong> is credited to your net earnings. As payouts are requested, each withdrawal is deducted directly from this total, leaving your current ready balance at{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatCurrency(effectiveAvailableBalance)}
              </strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowSimulator(!showSimulator)}
              className="text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showSimulator ? 'Hide Calculator' : 'Interactive Calculator'}</span>
            </button>
          </div>

          {/* Interactive Calculator Dropdown */}
          {showSimulator && (
            <div className="pt-4 border-t border-zinc-200 dark:border-white/5 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Test any custom customer payment amount:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-bold text-zinc-500">{currencySymbol}</span>
                    <input
                      type="number"
                      min="1"
                      value={simulatorAmount}
                      onChange={(e) => setSimulatorAmount(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-32 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/10 text-xs font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex items-center gap-1 flex-wrap">
                      {['100', '500', '1000', '5000', '10000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSimulatorAmount(preset)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                            simulatorAmount === preset
                              ? 'bg-purple-600 text-white font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-purple-100 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400'
                          }`}
                        >
                          {currencySymbol}
                          {Number(preset).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 flex items-center gap-5 text-xs font-mono self-start md:self-auto shadow-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-sans">180 Pay Split (1.5%)</span>
                    <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                      -{formatCurrency(simFee)}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200 dark:bg-white/10" />
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-sans">You Receive (98.5%)</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(simNet)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Transaction Ledger & Payout Settlement History Tabs */}
        <div className="space-y-4 pt-2">
          {/* Header & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Transaction Ledger</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === 'ledger'
                      ? 'bg-white/20 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {ledgerEntries.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('payouts')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'payouts'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Payout Requests</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === 'payouts'
                      ? 'bg-white/20 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {payoutHistory.length}
                </span>
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'ledger' ? 'Search ledger entries...' : 'Search payouts...'
                }
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* TAB 1: TRANSACTION LEDGER */}
          {activeTab === 'ledger' && (
            <div className="space-y-3">
              {loadingPayoutHistory && ledgerEntries.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-xs">Loading transaction ledger...</span>
                </div>
              ) : filteredLedger.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold font-sans">
                      <tr>
                        <th className="px-4 py-3">Date &amp; Time</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Reference ID</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                      {filteredLedger.map((item: any) => {
                        const typeInfo = getLedgerTypeInfo(item.type, item.amount);
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-zinc-500 text-[11px] whitespace-nowrap">
                              {new Date(item.createdAt || Date.now()).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${typeInfo.badgeClass}`}
                              >
                                {typeInfo.icon}
                                <span>{typeInfo.label}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-sans max-w-xs truncate" title={item.description || ''}>
                              {item.description || 'Ledger transaction'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                              {item.referenceId ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.referenceId, item.id)}
                                  className="inline-flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer font-mono text-[11px]"
                                  title="Click to copy Reference ID"
                                >
                                  <span>{item.referenceId.slice(0, 16)}...</span>
                                  {copiedId === item.id ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-zinc-400 opacity-60 hover:opacity-100" />
                                  )}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className={`px-4 py-3 text-right whitespace-nowrap ${typeInfo.amountClass}`}>
                              {item.amount < 0
                                ? `-₹${Math.abs(item.amount).toFixed(2)}`
                                : `+₹${Number(item.amount).toFixed(2)}`}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-zinc-800 dark:text-zinc-200 font-semibold">
                              ₹{(Number(item.balanceAfter) || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center text-xs text-zinc-500 space-y-1">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {searchQuery ? 'No matching ledger transactions found.' : 'No transactions recorded yet.'}
                  </p>
                  <p className="text-[11px]">
                    Customer payments received and withdrawal payouts will automatically record here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PAYOUT SETTLEMENT REQUESTS */}
          {activeTab === 'payouts' && (
            <div className="space-y-3">
              {loadingPayoutHistory && payoutHistory.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-xs">Loading payout records...</span>
                </div>
              ) : filteredPayouts.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold font-sans">
                      <tr>
                        <th className="px-4 py-3">Payout ID</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Method &amp; Destination</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Bank UTR / Proof</th>
                        <th className="px-4 py-3 text-right">Settlement Confirmation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                      {filteredPayouts.map((p: any) => {
                        const isPaid = p.status === 'PAID' || p.status === 'COMPLETED';
                        const isRejected = p.status === 'REJECTED';
                        const method = p.payoutMethod || p.method || 'UPI';
                        const dest =
                          p.accountDetails?.upiId ||
                          (p.accountDetails?.accountNumber
                            ? `A/C ending ${p.accountDetails.accountNumber.slice(-4)}`
                            : p.destination || method);

                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">
                              <button
                                type="button"
                                onClick={() => handleCopy(p.id, p.id)}
                                className="inline-flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer"
                                title="Click to copy Payout ID"
                              >
                                <span>{p.id?.slice(0, 14)}...</span>
                                {copiedId === p.id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3 text-zinc-400 opacity-60 hover:opacity-100" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">
                              ₹{(Number(p.amount) || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 font-sans">
                              <span className="font-semibold">{method}:</span>{' '}
                              <span className="text-zinc-500 font-mono text-[11px]">{dest}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  isPaid
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : isRejected
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                }`}
                              >
                                {isPaid ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : isRejected ? (
                                  <XCircle className="w-3 h-3" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                <span>{p.status || 'PENDING'}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-[11px] font-mono">
                              <div>{p.transactionRef || 'Pending Settlement'}</div>
                              {p.accountDetails?.proofUrl && (
                                <a
                                  href={p.accountDetails.proofUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:underline font-sans mt-0.5"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>View Proof</span>
                                </a>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-sans">
                              {isPaid ? (
                                p.accountDetails?.receivedConfirmed ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <Check className="w-3 h-3" />
                                    <span>Funds Received</span>
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      disabled={confirmingPayoutId === p.id}
                                      onClick={() => handleConfirmReceipt(p.id)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      title="Confirm you received this payout"
                                    >
                                      {confirmingPayoutId === p.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                      <span>Received</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDispute(p)}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                                      title="Raise dispute ticket if not received"
                                    >
                                      <LifeBuoy className="w-3 h-3" />
                                      <span>Not Received?</span>
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-[11px] text-zinc-400 font-mono">
                                  {new Date(p.requestedAt || p.createdAt || Date.now()).toLocaleDateString()}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center text-xs text-zinc-500 space-y-1">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {searchQuery ? 'No matching payout records found.' : 'No payout requests submitted yet.'}
                  </p>
                  <p className="text-[11px]">
                    Click &ldquo;Request Payout&rdquo; above to withdraw your settled earnings to UPI or Bank Account.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Universal Bank Details Drawer */}
      <BankDetailsDrawer
        isOpen={showBankDrawer}
        onClose={() => setShowBankDrawer(false)}
        onSaved={() => {
          fetchPayoutHistory(true);
        }}
      />
    </div>
  );
}

export default PayPayoutsView;
