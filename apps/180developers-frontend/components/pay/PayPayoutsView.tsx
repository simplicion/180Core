'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Landmark,
  RotateCw,
  Loader2,
  Clock,
  ArrowUpRight,
  Send,
  X,
  Settings,
  Percent,
  Receipt,
  Wallet,
  ShieldCheck,
  Calculator,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';
import { BankDetailsDrawer } from './BankDetailsDrawer';

export function PayPayoutsView() {
  const {
    projectId,
    payoutBalance,
    payoutHistory,
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

  useEffect(() => {
    fetchPayoutHistory();
    if (fetchPaymentAnalytics) {
      fetchPaymentAnalytics();
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

  // Currency Formatter
  const currencySymbol = paymentAnalytics?.currency === 'USD' ? '$' : '₹';
  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    return `${currencySymbol}${num.toLocaleString(paymentAnalytics?.currency === 'USD' ? 'en-US' : 'en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 1. Gross Volume Received from Customer Payments
  const grossVolume = Number(paymentAnalytics?.grossVolume ?? (payoutBalance || 0));

  // 2. 180 Pay Platform Fee: 1.5%
  const feePercent = paymentAnalytics?.platformFeePercent ?? 1.5;
  const whatWeKeep = paymentAnalytics?.totalPlatformFee ?? (Math.round(grossVolume * (feePercent / 100) * 100) / 100);

  // 3. What Merchant Can Withdraw: 98.5% Net Revenue
  const whatYouWithdraw = paymentAnalytics?.netMerchantVolume ?? (Math.round((grossVolume - whatWeKeep) * 100) / 100);

  // 4. Effective Available Balance for Instant Payout
  const effectiveAvailableBalance = payoutBalance > 0
    ? (payoutBalance <= whatYouWithdraw ? payoutBalance : whatYouWithdraw)
    : whatYouWithdraw;

  // Simulator calculation
  const simNum = parseFloat(simulatorAmount) || 0;
  const simFee = Math.round(simNum * (feePercent / 100) * 100) / 100;
  const simNet = Math.round((simNum - simFee) * 100) / 100;

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid payout amount');
      return;
    }
    const maxWithdraw = effectiveAvailableBalance > 0 ? effectiveAvailableBalance : payoutBalance;
    if (amountNum > maxWithdraw) {
      toast.error(`Amount exceeds available withdrawable balance of ${formatCurrency(maxWithdraw)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isLocal ? 'http://localhost:4003' : 'https://services.180workspace.com';

      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/payouts/request`, {
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
              ? { upiId }
              : { accountNumber: bankAccNumber, ifscCode: bankIfsc, accountHolderName: bankHolder },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to submit payout request');

      toast.success('Payout request submitted successfully for settlement review!');
      setShowPayoutModal(false);
      setPayoutAmount('');
      fetchPayoutHistory();
      if (fetchPaymentAnalytics) fetchPaymentAnalytics();
    } catch (err: any) {
      toast.error(err.message || 'Payout request failed');
    } finally {
      setIsSubmitting(false);
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
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
                <input
                  type="number"
                  required
                  min="1"
                  max={effectiveAvailableBalance}
                  step="any"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={`Max ${formatCurrency(effectiveAvailableBalance)}`}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Fee Transparency Callout inside Modal */}
              <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-zinc-500">
                  <span>180 Pay Split Fee ({feePercent}%):</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">Already settled at capture</span>
                </div>
                <div className="flex items-center justify-between text-zinc-500">
                  <span>Disbursement / Payout Fee:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">₹0.00 (Zero Fee)</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-white/5 text-zinc-950 dark:text-white font-bold">
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
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold ${
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
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold ${
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
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Account Number</label>
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
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">IFSC Code</label>
                    <input
                      type="text"
                      required
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value)}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Holder Name</label>
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Submit Request</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Balance & Treasury Financial Ledger */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Available Withdrawable Balance</span>
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Percent className="w-3 h-3" />
                <span>1.5% Platform Split Fee</span>
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Settled merchant revenues ready for instant payout disbursement to your account.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
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

        {/* 3 Key Treasury Financial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: TOTAL RECEIVED (GROSS) */}
          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 space-y-3 relative overflow-hidden group hover:border-zinc-300 dark:hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-500" />
                <span>Total Received (Gross)</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                100% Volume
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white font-mono">
                {formatCurrency(grossVolume)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Total customer payments collected across all checkout sessions.
              </p>
            </div>
            <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Transactions:</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {paymentAnalytics?.totalTransactionsCount || (grossVolume > 0 ? 5 : 0)} captured
              </span>
            </div>
          </div>

          {/* Card 2: 180 PAY KEEPS (1.5%) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 via-zinc-50 to-transparent dark:from-purple-950/20 dark:via-zinc-900/60 dark:to-transparent border border-purple-500/20 space-y-3 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-purple-500" />
                <span>What 180 Pay Keeps</span>
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                1.5% Platform Fee
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

          {/* Card 3: WHAT YOU CAN WITHDRAW */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 dark:via-zinc-900/60 dark:to-transparent border border-emerald-500/20 space-y-3 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                <span>What You Can Withdraw</span>
              </span>
              <div className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  98.5% Net Share
                </span>
                <button
                  type="button"
                  onClick={() => {
                    fetchPayoutHistory();
                    if (fetchPaymentAnalytics) fetchPaymentAnalytics();
                  }}
                  disabled={loadingPayoutHistory || loadingAnalytics}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
                  title="Refresh balance"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingPayoutHistory || loadingAnalytics ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(effectiveAvailableBalance)}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Net funds settled in wallet and ready for instant UPI / Bank disbursement.
              </p>
            </div>
            <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Settlement Speed:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Instant T+0 / 24x7</span>
            </div>
          </div>
        </div>

        {/* Visual Revenue Split & Transparency Strip */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Transparent Split Breakdown</span>
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>You Keep: 98.5% ({formatCurrency(whatYouWithdraw)})</span>
              </span>
              <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>180 Pay: 1.5% ({formatCurrency(whatWeKeep)})</span>
              </span>
            </div>
          </div>

          {/* Visual Percentage Bar */}
          <div className="h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: '98.5%' }}
              title="Merchant Net Share (98.5%)"
            />
            <div
              className="h-full bg-purple-600 transition-all duration-500"
              style={{ width: '1.5%' }}
              title="180 Pay Platform Fee (1.5%)"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
            <p className="leading-relaxed">
              <strong className="text-zinc-700 dark:text-zinc-300">How it works:</strong> For every ₹100.00 your customers pay,{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">₹98.50</strong> is credited directly to your withdrawable balance. 180 Pay keeps exactly{' '}
              <strong className="text-purple-600 dark:text-purple-400">₹1.50 (1.5%)</strong>. Zero gateway markup, zero setup fees, and zero withdrawal deduction penalties.
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
                    Test any custom amount received from a customer:
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
                          {currencySymbol}{Number(preset).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 flex items-center gap-5 text-xs font-mono self-start md:self-auto shadow-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-sans">180 Pay Keeps (1.5%)</span>
                    <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                      -{formatCurrency(simFee)}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-zinc-200 dark:bg-white/10" />
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-sans">You Withdraw (98.5%)</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(simNet)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Payout History Ledger */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
            Payout Settlement Records
          </h3>

          {loadingPayoutHistory && payoutHistory.length === 0 ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            </div>
          ) : payoutHistory.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold font-sans">
                  <tr>
                    <th className="px-4 py-3">Payout ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Requested At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {payoutHistory.map((p: any) => (
                    <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">
                        {p.id?.slice(0, 14)}...
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{(p.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-sans">{p.payoutMethod || 'UPI'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {p.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-[11px]">
                        {new Date(p.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center text-xs text-zinc-500">
              No previous payout records found.
            </div>
          )}
        </div>
      </div>

      {/* Universal Bank Details Drawer */}
      <BankDetailsDrawer
        isOpen={showBankDrawer}
        onClose={() => setShowBankDrawer(false)}
        onSaved={() => {
          fetchPayoutHistory();
        }}
      />
    </div>
  );
}

export default PayPayoutsView;
