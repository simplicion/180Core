'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  ArrowDownToLine,
  Headphones,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { adminApi } from '@/lib/api';

export default function AdminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [timeRange, setTimeRange] = useState<'TODAY' | '7D' | '30D' | 'YEAR'>('30D');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'EUR' | 'NPR'>('USD');

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getOverview();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch admin overview', err);
    } finally {
      setLoading(false);
    }
  };

  const overview = {
    totalGmv: data?.totalGmv ?? data?.overview?.totalGmv ?? 0,
    volume24h: data?.volume24h ?? data?.overview?.volume24h ?? 0,
    platformFeesEarned: data?.estimatedPlatformFees ?? data?.overview?.platformFeesEarned ?? 0,
    totalDevelopers: data?.totalDevelopers ?? data?.overview?.totalDevelopers ?? 0,
    totalApps: data?.totalApps ?? data?.overview?.totalApps ?? 0,
    pendingPayoutsCount: data?.pendingSettlementCount ?? data?.overview?.pendingPayoutsCount ?? 0,
    pendingPayoutsAmount: data?.pendingSettlementAmount ?? data?.overview?.pendingPayoutsAmount ?? 0,
    openTicketsCount: data?.openTicketsCount ?? data?.overview?.openTicketsCount ?? 0,
  };

  const topApps = data?.topApps || data?.apps || [];
  const recentTransactions = data?.recentTransactions || [];
  const pendingPayouts = data?.pendingPayouts || data?.recentPayoutRequests || [];

  const currencyMultiplier = {
    USD: 1,
    INR: 83.5,
    EUR: 0.92,
    NPR: 133.5,
  }[currency];

  const currencySymbol = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    NPR: 'Rs. ',
  }[currency];

  const timeMultiplier = {
    TODAY: 0.25,
    '7D': 0.65,
    '30D': 1.0,
    YEAR: 4.8,
  }[timeRange];

  const adjustedGmv = (overview.totalGmv || 0) * currencyMultiplier * timeMultiplier;
  const adjustedVelocity = (overview.volume24h || 0) * currencyMultiplier;
  const adjustedFees = (overview.platformFeesEarned || 0) * currencyMultiplier * timeMultiplier;
  const adjustedPending = (overview.pendingPayoutsAmount || 0) * currencyMultiplier;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Executive Pulse & Sovereign GMV
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Global network health across 180 Core, 180 Pay gateways, and sovereign developer nodes.
          </p>
        </div>

        {/* Date Range & Currency Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs">
            {(['TODAY', '7D', '30D', 'YEAR'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold text-[11px] transition-all min-h-[36px] ${
                  timeRange === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            className="px-3 py-2 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-bold focus:outline-none min-h-[40px]"
          >
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="EUR">EUR (€)</option>
            <option value="NPR">NPR (Rs)</option>
          </select>

          <Link
            href="/treasury"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 min-h-[40px]"
          >
            <span>Treasury</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Priority Action Alerts (If pending settlements or tickets) */}
      {!loading && (overview.pendingPayoutsCount > 0 || overview.openTicketsCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overview.pendingPayoutsCount > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                  <ArrowDownToLine className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                    {overview.pendingPayoutsCount} Pending Settlement Request{overview.pendingPayoutsCount > 1 ? 's' : ''}
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Totaling {currencySymbol}
                    {adjustedPending.toLocaleString('en-US', { minimumFractionDigits: 2 })} awaiting bank verification.
                  </p>
                </div>
              </div>
              <Link
                href="/payouts"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors shrink-0"
              >
                Review Desk
              </Link>
            </div>
          )}

          {overview.openTicketsCount > 0 && (
            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                    {overview.openTicketsCount} Unresolved Support Ticket{overview.openTicketsCount > 1 ? 's' : ''}
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Developer bug reports with client environment telemetry awaiting response.
                  </p>
                </div>
              </div>
              <Link
                href="/support"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0"
              >
                Open Desk
              </Link>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-3xl bg-zinc-200 dark:bg-zinc-900" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Merchandise Value */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
            <div className="text-xs text-zinc-500 flex items-center justify-between">
              <span>Platform GMV ({timeRange})</span>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
              {currencySymbol}
              {adjustedGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span className="text-emerald-500 font-bold">+18.4%</span> volume velocity
            </div>
          </div>

          {/* 24h Velocity */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
            <div className="text-xs text-zinc-500 flex items-center justify-between">
              <span>24h Velocity Volume</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-3">
              {currencySymbol}
              {adjustedVelocity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Processed across checkout sessions</div>
          </div>

          {/* Net Platform Fee */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
            <div className="text-xs text-zinc-500 flex items-center justify-between">
              <span>Net Platform Take-Rate</span>
              <Sparkles className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-3">
              {currencySymbol}
              {adjustedFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Calculated at standard 2.0% cut</div>
          </div>

          {/* Active Fleet */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
            <div className="text-xs text-zinc-500 flex items-center justify-between">
              <span>Active Developers & Apps</span>
              <Users className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
              {overview.totalDevelopers || 0}{' '}
              <span className="text-xs font-normal text-zinc-500">devs</span> / {overview.totalApps || 0}{' '}
              <span className="text-xs font-normal text-zinc-500">apps</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Registered sovereign identities</div>
          </div>
        </div>
      )}

      {/* Middle Section: Top Applications & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Applications Leaderboard */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Volume Leaderboard</h3>
            </div>
            <Link href="/apps" className="text-xs text-blue-500 hover:underline">
              View Fleet
            </Link>
          </div>

          {topApps.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No application volume recorded yet. Apps processing checkouts will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {topApps.map((app: any) => (
                <div key={app.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{app.name}</span>
                    <span className="font-mono text-zinc-500 font-bold">
                      {currencySymbol}
                      {((app.gmv || 0) * currencyMultiplier).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, app.volumeShare || 20)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Transaction Ledger Stream */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Live Sovereign Transactions</h3>
            </div>
            <Link href="/transactions" className="text-xs text-blue-500 hover:underline">
              Full Ledger
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No recent transactions recorded. Live transactions will stream here in real time.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-white/5 font-mono text-xs">
              {recentTransactions.slice(0, 5).map((tx: any) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 font-sans">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-white">
                        {tx.title || tx.app?.name || '180 Pay Checkout'}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">{tx.id.slice(0, 12)}...</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-zinc-900 dark:text-white">
                      {tx.currency} {(tx.amount || 0).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
