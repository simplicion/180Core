'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  ShieldCheck,
  Smartphone,
  Mail,
  Copy,
  Check,
  QrCode,
  Edit3,
  CreditCard,
  AppWindow,
  Receipt,
  ArrowRight,
  Sparkles,
  Calendar,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Button, UniversalSkeleton } from '@workspace/ui';
import toast from 'react-hot-toast';
import { UserProfile, ConnectedApp, LedgerEntry } from '@/types';
import { getCoreApiUrl } from '@/lib/api';
import { EditProfileModal } from '@/components/EditProfileModal';
import { OneEightyPayBottomSheet } from '@/components/OneEightyPayBottomSheet';
import { InvoiceModal } from '@/components/InvoiceModal';

export default function HomePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0.0);
  const [loading, setLoading] = useState(true);

  // Modals & Bottom Sheets
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTopUpSheetOpen, setIsTopUpSheetOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [selectedInvoice, setSelectedInvoice] = useState<LedgerEntry | null>(null);

  // Connected apps & ledger entries
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [recentLedger, setRecentLedger] = useState<LedgerEntry[]>([]);

  const loadData = async () => {
    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      '';

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Step 1: Validate the token with userinfo first
      const userRes = await fetch(getCoreApiUrl('/api/oauth/userinfo'), { headers, credentials: 'include' });

      if (!userRes.ok) {
        // Token is expired/invalid — clear all stale auth and stop
        localStorage.removeItem('platform_auth_token');
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setUser(null);
        setLoading(false);
        return;
      }

      const userData = await userRes.json().catch(() => null);
      if (userData && (userData.user || userData.id)) {
        const u = userData.user || userData;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      } else {
        setUser(null);
        setLoading(false);
        return;
      }

      // Step 2: Only fetch wallet, ledger, and apps AFTER auth is confirmed
      const [walletRes, ledgerRes, appsRes] = await Promise.all([
        fetch(getCoreApiUrl('/api/oauth/wallet'), { headers, credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(getCoreApiUrl('/api/oauth/wallet/ledger'), { headers, credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch(getCoreApiUrl('/api/oauth/authorized-apps'), { headers, credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ]);

      if (walletRes?.success && walletRes.data) {
        setBalance(walletRes.data.balance || 0);
      }

      if (ledgerRes?.success && Array.isArray(ledgerRes.data?.entries)) {
        setRecentLedger(ledgerRes.data.entries.slice(0, 5));
      }

      if (appsRes?.success && Array.isArray(appsRes.apps)) {
        setConnectedApps(appsRes.apps);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleWalletUpdated = (e: any) => {
      if (typeof e.detail?.balance === 'number') {
        setBalance(e.detail.balance);
      } else {
        loadData();
      }
    };

    window.addEventListener('180_wallet_updated', handleWalletUpdated);
    return () => {
      window.removeEventListener('180_wallet_updated', handleWalletUpdated);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <UniversalSkeleton type="metrics" count={3} columns={3} />
        <UniversalSkeleton type="form" count={4} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. UNAUTHENTICATED STATE: SHOWCASE PUBLIC LANDING PAGE
  // ─────────────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="space-y-16 py-6 max-w-5xl mx-auto">
        {/* Hero Section */}
        <section className="text-center space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Universal 180 Identity &amp; Prepaid Ledger</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            One Unified Profile for
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              Every 180 Experience.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Access 180 Workspace, Voiceforce AI, Traffic Director, and partner applications with zero passwords, 1-tap WhatsApp verification, and a cryptographic universal wallet.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/auth/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[46px] cursor-pointer"
            >
              <span>Get Started with 180 Identity</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/auth/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 min-h-[46px] cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Sign In to Existing Account</span>
            </Link>
          </div>
        </section>

        {/* Feature Pillar Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">1-Tap WhatsApp Login</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Eliminate password fatigue. Instant 6-digit WhatsApp OTP verification ensures friction-free, secure authentication.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Universal Prepaid Wallet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              One shared balance across every 180 app. 1-click checkouts for AI calls, metered tools, and workspace upgrades.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Unified Privacy Controls</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You own your data. See every authorized application, monitor active sessions, and revoke access instantly.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUTHENTICATED STATE: USER PROFILE & WALLET DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────────
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const visibleApps = connectedApps.slice(0, 3);
  const extraAppsCount = connectedApps.length > 3 ? connectedApps.length - 3 : 0;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto pb-10">
      {/* 1. Header Greeting Section */}
      <section className="pb-1 sm:pb-2 pt-1 sm:pt-2">
        <div className="space-y-0.5 sm:space-y-1">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            {getGreeting()},{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              {user.name || user.username || 'User'}
            </span>
          </h1>

          <p className="text-xs sm:text-sm font-semibold text-slate-500 font-mono">
            @{user.username || (user.email ? user.email.split('@')[0] : 'user')}
          </p>
        </div>
      </section>

      {/* 2. Overview Main Blocks: Both cards side-by-side in a single row on mobile and desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
        {/* Block 1: Total Wallet Balance Block */}
        <div className="p-3 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">
                    Wallet Balance
                  </h2>
                  <p className="hidden sm:block text-xs text-slate-500">Universal 180 Pay Ledger</p>
                </div>
              </div>

              <div className="shrink-0">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  1-Click Ready
                </span>
                <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  Ready
                </span>
              </div>
            </div>

            {/* Wallet Current Available Balance Display */}
            <div className="py-2.5 sm:py-3 space-y-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  ₹{Number(balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  INR
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                Available across all 180 apps
              </p>
            </div>
          </div>

          <div className="pt-3 sm:pt-4">
            <Button
              variant="default"
              onClick={() => {
                setTopUpAmount(1000);
                setIsTopUpSheetOpen(true);
              }}
              className="w-full px-3 sm:px-5 py-2 sm:py-2.5 min-h-[36px] sm:min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Top-Up</span>
            </Button>
          </div>
        </div>

        {/* Block 2: Connected Apps Block */}
        <Link
          href="/connected-apps"
          className="p-3 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer block"
        >
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <AppWindow className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">
                    Connected Apps
                  </h2>
                  <p className="hidden sm:block text-xs text-slate-500">Authorized OAuth Ecosystem</p>
                </div>
              </div>

              <div className="shrink-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-blue-200">
                  {connectedApps.length} <span className="hidden sm:inline">{connectedApps.length === 1 ? 'App' : 'Apps'}</span>
                </span>
              </div>
            </div>

            {connectedApps.length > 0 ? (
              <div className="py-2.5 sm:py-3 space-y-1.5">
                {/* App Icons with Overlap */}
                <div className="flex items-center -space-x-1.5 sm:-space-x-3 overflow-hidden p-0.5">
                  {visibleApps.map((app, idx) => {
                    const bgGradients = [
                      'from-blue-600 to-indigo-600',
                      'from-indigo-600 to-violet-600',
                      'from-sky-600 to-cyan-600',
                    ];
                    return (
                      <div
                        key={app.id || idx}
                        className="relative w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl p-[1.5px] bg-gradient-to-tr from-slate-200 to-slate-300 ring-2 sm:ring-4 ring-white shadow-xs shrink-0 group-hover:scale-105 transition-transform"
                        title={app.name}
                      >
                        {app.logo ? (
                          <img
                            src={app.logo}
                            alt={app.name}
                            className="w-full h-full rounded-[6px] sm:rounded-xl object-cover bg-white"
                          />
                        ) : (
                          <div
                            className={`w-full h-full bg-gradient-to-tr ${
                              bgGradients[idx % bgGradients.length]
                            } text-white rounded-[6px] sm:rounded-xl flex items-center justify-center font-bold text-[9px] sm:text-xs tracking-wider`}
                          >
                            {app.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* +N bubble if more than 3 connected apps */}
                  {extraAppsCount > 0 && (
                    <div
                      className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-900 text-white font-extrabold text-[9px] sm:text-xs flex items-center justify-center ring-2 sm:ring-4 ring-white shadow-xs shrink-0"
                      title={`${extraAppsCount} more connected platforms`}
                    >
                      +{extraAppsCount}
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">
                    {connectedApps.map((a) => a.name).slice(0, 2).join(', ')}
                    {connectedApps.length > 2 ? '...' : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Tap to manage apps &amp; consents →
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-3 text-center text-xs text-slate-500 space-y-1">
                <p className="font-bold text-[11px] sm:text-xs text-slate-700">No Apps Yet</p>
                <p className="text-[10px] text-slate-400">
                  Connect apps to view permissions.
                </p>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* 3. Recent Activity Snippet */}
      <section className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Recent Activity</h2>
            <p className="hidden sm:block text-xs text-slate-500">Latest credits, charges, and authenticated transactions.</p>
          </div>

          <Link
            href="/transactions"
            className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors min-h-[32px] sm:min-h-[36px]"
          >
            <span>Full Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile View for Recent Activity (sm:hidden) */}
        <div className="sm:hidden space-y-2">
          {recentLedger.length > 0 ? (
            recentLedger.map((tx) => {
              const isCredit = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {tx.description}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className={`text-xs font-extrabold ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {isCredit ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedInvoice(tx)}
                      className="h-7 w-7 p-0 rounded-lg hover:bg-slate-200 text-slate-500"
                      title="Invoice"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No recent transactions recorded.
            </div>
          )}
        </div>

        {/* Desktop Table View (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentLedger.length > 0 ? (
                recentLedger.map((tx) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div>{tx.description}</div>
                        {tx.referenceId && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {tx.referenceId}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            isCredit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold font-mono ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isCredit ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInvoice(tx)}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="View Invoice"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">No Ledger Transactions Recorded Yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Top up your prepaid balance to begin using 1-click checkouts and AI agent credits.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      {isEditModalOpen && (
        <EditProfileModal
          user={user}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updated) => {
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
            setIsEditModalOpen(false);
          }}
        />
      )}

      {isTopUpSheetOpen && (
        <OneEightyPayBottomSheet
          isOpen={isTopUpSheetOpen}
          initialAmount={topUpAmount}
          currentBalance={balance}
          user={user}
          onClose={() => setIsTopUpSheetOpen(false)}
          onSuccess={(newBal) => {
            if (typeof newBal === 'number') {
              setBalance(newBal);
            }
            loadData();
            setIsTopUpSheetOpen(false);
          }}
        />
      )}

      {selectedInvoice && (
        <InvoiceModal
          transaction={selectedInvoice}
          userName={user?.name}
          userEmail={user?.email}
          userPhone={user?.phone}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
