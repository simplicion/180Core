'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Search,
  Sparkles,
  Receipt,
} from 'lucide-react';
import { Button, AdaptiveSkeleton, OneEightyIdentityButton } from '@workspace/ui';
import toast from 'react-hot-toast';
import { LedgerEntry } from '@/types';
import { InvoiceModal } from '@/components/InvoiceModal';
import { OneEightyPayBottomSheet } from '@/components/OneEightyPayBottomSheet';
import { getCoreApiUrl } from '@/lib/api';
import { getStoredAuthToken } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';

export default function TransactionsPage() {
  const { user, balance, loading: authLoading, refreshWallet } = useAuth();
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(true);
  const [isTopUpOpen, setIsTopUpOpen] = useState<boolean>(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<LedgerEntry | null>(null);

  const quickAmounts = [500, 1000, 2500, 5000, 10000];

  const fetchLedgerData = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setLedger([]);
      setLedgerLoading(false);
      return;
    }

    setLedgerLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const ledgerRes = await fetch(getCoreApiUrl('/api/oauth/wallet/ledger'), { headers, credentials: 'include' })
        .then((r) => r.json())
        .catch(() => null);

      if (ledgerRes?.success && Array.isArray(ledgerRes.data?.entries)) {
        setLedger(ledgerRes.data.entries);
      } else {
        setLedger([]);
      }
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLedgerData();
    } else {
      setLedgerLoading(false);
    }
  }, [user]);

  const handleTopup = () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;

    if (!finalAmount || finalAmount <= 0) {
      toast.error('Please specify a valid top-up amount');
      return;
    }

    if (finalAmount < 10) {
      toast.error('Minimum recharge amount is ₹10');
      return;
    }

    setIsTopUpOpen(true);
  };

  if (authLoading) {
    return <AdaptiveSkeleton screen="profile-transactions" />;
  }

  // 1. Unauthenticated state: Center Single Sign-In CTA with zero navigation
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-4">
        <OneEightyIdentityButton
          href="/auth/login"
          clientId="180-profile"
          text="Sign In with 180 Identity"
          subtitle="Universal Sovereign Identity & Prepaid Wallet"
          theme="light"
          className="shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-sm px-6 py-3 cursor-pointer"
        />
      </div>
    );
  }

  const filteredLedger = ledger.filter((item) => {
    const matchesType =
      filterType === 'ALL' ||
      (filterType === 'TOPUP' && item.type === 'TOPUP') ||
      (filterType === 'PURCHASE' && (item.type === 'CHECKOUT_PAY' || item.type === 'DEBIT' || item.type === 'PURCHASE')) ||
      (filterType === 'RECEIVE' && item.type === 'CHECKOUT_RECEIVE');

    const matchesSearch =
      !searchQuery ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.referenceId?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="pb-4 sm:pb-6 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            ← Overview
          </Link>
          <span className="text-slate-400">•</span>
          <span className="text-xs text-slate-500">Universal 180 Ledger</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Wallet &amp; Transactions
        </h1>
      </div>

      {/* Top-Up & Balance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Balance Card (Left) */}
        <div className="lg:col-span-1 rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 flex flex-col justify-center shadow-xs">
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Available Prepaid Funds
            </span>

            <div className="mt-3 sm:mt-5 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                ₹{balance.toFixed(2)}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-500">INR</span>
            </div>
          </div>
        </div>

        {/* Top-Up Panel (Right) */}
        <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl p-4 sm:p-7 bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Recharge Prepaid Wallet</span>
              </h2>
              <span className="text-[11px] sm:text-xs text-slate-500">Instant UPI &amp; Cards</span>
            </div>

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mt-3">
              {quickAmounts.map((amt) => {
                const isSelected = selectedAmount === amt && !customAmount;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`py-2 sm:py-3 px-2 sm:px-4 min-h-[38px] sm:min-h-[44px] rounded-xl text-center font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs border border-blue-600'
                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ₹{amt}
                  </button>
                );
              })}
            </div>

            {/* Custom Amount Input */}
            <div className="mt-3.5 sm:mt-5">
              <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1.5 sm:mb-2">
                Or Enter Custom Amount (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="10"
                  placeholder="Enter amount (e.g. 1500)"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2 sm:py-2.5 min-h-[38px] sm:min-h-[44px] text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              Total to Pay:{' '}
              <span className="text-base sm:text-lg font-bold text-slate-900 ml-1">
                ₹{customAmount ? (parseFloat(customAmount) || 0).toFixed(2) : selectedAmount.toFixed(2)} INR
              </span>
            </div>

            <Button
              onClick={handleTopup}
              className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 min-h-[40px] sm:min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Recharge via 180 Pay</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <section
        aria-label="Transaction Ledger"
        className="rounded-2xl sm:rounded-3xl p-4 sm:p-8 bg-white border border-slate-200 shadow-xs space-y-4 sm:space-y-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Complete Ledger History</h2>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 sm:p-1 rounded-xl text-xs">
              {['ALL', 'TOPUP', 'PURCHASE'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterType(tab)}
                  className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[32px] sm:min-h-[36px] rounded-lg font-semibold transition-all cursor-pointer ${
                    filterType === tab
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search description or ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 sm:py-2 min-h-[34px] sm:min-h-[38px] text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
        </div>

        {/* Mobile Card List (sm:hidden) */}
        <div className="sm:hidden space-y-2.5">
          {filteredLedger.length > 0 ? (
            filteredLedger.map((tx: any) => {
              const isCredit = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {tx.description || tx.type}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-extrabold ${
                          isCredit ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isCredit ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                      </div>
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          isCredit
                            ? 'bg-emerald-100/70 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono text-[10px] truncate max-w-[150px]">
                      {tx.referenceId ? `Ref: ${tx.referenceId}` : `Bal: ₹${tx.balanceAfter?.toFixed(2) || '0.00'}`}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(tx)}
                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-200/60 cursor-pointer"
                    >
                      Tax Invoice
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              No matching transactions found.
            </div>
          )}
        </div>

        {/* Desktop Ledger Table (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Reference &amp; Description</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLedger.length > 0 ? (
                filteredLedger.map((tx: any) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900 max-w-sm">
                        <div>{tx.description || tx.type}</div>
                        {tx.referenceId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Ref: {tx.referenceId}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCredit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold text-sm ${
                          isCredit ? 'text-emerald-600' : 'text-slate-900'
                        }`}
                      >
                        {isCredit ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500 font-mono">
                        ₹{tx.balanceAfter.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(tx)}
                          className="px-2.5 py-1 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold text-[11px] border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                        >
                          Tax Invoice
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    No matching transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedInvoice && (
        <InvoiceModal
          transaction={selectedInvoice}
          userName={user?.name}
          userEmail={user?.email}
          userPhone={user?.phone}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      <OneEightyPayBottomSheet
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        initialAmount={customAmount ? (parseFloat(customAmount) || 1000) : selectedAmount}
        currentBalance={balance}
        user={user}
        onSuccess={() => {
          refreshWallet();
          fetchLedgerData();
          setIsTopUpOpen(false);
        }}
      />
    </div>
  );
}
