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
  Sparkles,
  RefreshCw,
  CreditCard,
  UserCheck,
  ShieldCheck,
  Activity,
  Globe,
  Coins,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { DeveloperOnboardingChart } from '@/components/charts/DeveloperOnboardingChart';
import { PaymentActivityChart } from '@/components/charts/PaymentActivityChart';

export default function AdminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [timeRange, setTimeRange] = useState<'TODAY' | '7D' | '30D' | 'YEAR'>('30D');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'EUR' | 'NPR'>('USD');

  useEffect(() => {
    loadOverview();
  }, [timeRange, currency]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getOverview({ timeRange, currency });
      if (res.success) {
        setData(res.data || res);
      }
    } catch (err) {
      console.error('Failed to fetch admin overview', err);
    } finally {
      setLoading(false);
    }
  };

  const overview = {
    totalGmv: data?.totalGmv ?? data?.overview?.totalGmv ?? 0,
    allTimeGmv: data?.allTimeGmv ?? 0,
    volume24h: data?.volume24h ?? data?.overview?.volume24h ?? 0,
    volumeVelocity: data?.volumeVelocity ?? data?.overview?.volumeVelocity ?? 0,
    platformFeesEarned: data?.estimatedPlatformFees ?? data?.overview?.platformFeesEarned ?? 0,
    totalUsers: data?.totalUsers ?? 0,
    totalDevelopers: data?.totalDevelopers ?? data?.overview?.totalDevelopers ?? 0,
    totalApps: data?.totalApps ?? data?.overview?.totalApps ?? 0,
    activeApps: data?.activeApps ?? 0,
    totalPaymentsCount: data?.totalPaymentsCount ?? 0,
    rangePaymentsCount: data?.rangePaymentsCount ?? 0,
    totalSessionsCount: data?.totalSessionsCount ?? 0,
    totalPayoutsCount: data?.totalPayoutsCount ?? 0,
    totalPayoutsAmount: data?.totalPayoutsAmount ?? 0,
    pendingPayoutsCount: data?.pendingSettlementCount ?? data?.overview?.pendingPayoutsCount ?? 0,
    pendingPayoutsAmount: data?.pendingSettlementAmount ?? data?.overview?.pendingPayoutsAmount ?? 0,
    openTicketsCount: data?.openTicketsCount ?? data?.overview?.openTicketsCount ?? 0,
  };

  const topApps = data?.topApps || [];
  const topDevelopers = data?.topDevelopers || [];
  const currencyDistribution = data?.currencyDistribution || [];
  const fleetCapabilities = data?.fleetCapabilities || {
    totalApps: overview.totalApps,
    payEnabled: 0,
    authEnabled: 0,
    customGatewayEnabled: 0,
    customDomainEnabled: 0,
    verifiedDevelopersCount: overview.totalDevelopers,
    unverifiedDevelopersCount: 0,
  };

  const recentTransactions = data?.recentTransactions || [];

  const devDailyData = data?.developerOnboardingChart || [];
  const devWeeklyData = data?.developerOnboardingWeekly || [];
  const devMonthlyData = data?.developerOnboardingMonthly || [];

  const txDailyData = data?.transactionsVolumeChart || [];
  const txWeeklyData = data?.transactionsWeekly || [];
  const txMonthlyData = data?.transactionsMonthly || [];

  const currencySymbol = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    NPR: 'Rs. ',
  }[currency];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Page Title & Interactive Global Controls */}
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

        {/* Date Range, Currency & Desk Links */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadOverview}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Refresh Real-time Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

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
                    {overview.pendingPayoutsAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} awaiting bank verification.
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

      {/* KPI Stats Grid Row 1: Core Financials & Payments */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-32 rounded-3xl bg-zinc-200 dark:bg-zinc-900" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Row 1: 180 Pay Financial Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gross Merchandise Value */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>Platform GMV ({timeRange})</span>
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
                {currencySymbol}
                {overview.totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 flex items-center justify-between">
                <span className={`font-bold ${overview.volumeVelocity >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {overview.volumeVelocity >= 0 ? `+${overview.volumeVelocity}%` : `${overview.volumeVelocity}%`} velocity
                </span>
                <span className="font-mono text-zinc-400">
                  All-time: {currencySymbol}{overview.allTimeGmv.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
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
                {overview.volume24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Processed across checkout sessions</div>
            </div>

            {/* Captured Payments */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>180 Pay Captured Payments</span>
                <CreditCard className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
                {overview.totalPaymentsCount}{' '}
                <span className="text-xs font-normal text-zinc-500">paid</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                From {overview.totalSessionsCount} checkout sessions initiated
              </div>
            </div>

            {/* Net Platform Fee */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>Net Platform Take-Rate</span>
                <Sparkles className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-3">
                {currencySymbol}
                {overview.platformFeesEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Calculated at standard 2.0% cut</div>
            </div>
          </div>

          {/* Row 2: Developer Ecosystem & Sovereign Users */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Registered Developers */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>Registered Developers</span>
                <UserCheck className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
                {overview.totalDevelopers || 0}{' '}
                <span className="text-xs font-normal text-zinc-500">dev accounts</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Engineers building on 180 Core</div>
            </div>

            {/* Global App Fleet */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>Global App Fleet</span>
                <Layers className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
                {overview.activeApps || 0}{' '}
                <span className="text-xs font-normal text-zinc-500">active</span> / {overview.totalApps || 0}{' '}
                <span className="text-xs font-normal text-zinc-500">total</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Connected client applications</div>
            </div>

            {/* Total Sovereign Users */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>Total Sovereign Users</span>
                <Users className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
                {overview.totalUsers || 0}{' '}
                <span className="text-xs font-normal text-zinc-500">identities</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Registered across 180 Core platform</div>
            </div>

            {/* Settlement Desk */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
              <div className="text-xs text-zinc-500 flex items-center justify-between">
                <span>Settlement Desk</span>
                <ArrowDownToLine className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
                {overview.totalPayoutsCount}{' '}
                <span className="text-xs font-normal text-zinc-500">requested</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {overview.pendingPayoutsCount > 0 ? (
                  <span className="text-amber-500 font-semibold">{overview.pendingPayoutsCount} awaiting review</span>
                ) : (
                  <span>All settlements up to date</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Interactive Graphs Section */}
      <div className="space-y-6">
        {/* Graph 1: Developer Onboarding Velocity Chart */}
        <DeveloperOnboardingChart
          dailyData={devDailyData}
          weeklyData={devWeeklyData}
          monthlyData={devMonthlyData}
          timeRangeLabel={timeRange}
        />

        {/* Graph 2: 180 Pay Payment Activity & Settlement Velocity Chart */}
        <PaymentActivityChart
          dailyData={txDailyData}
          weeklyData={txWeeklyData}
          monthlyData={txMonthlyData}
          currencySymbol={currencySymbol}
          timeRangeLabel={timeRange}
        />
      </div>

      {/* Deep Ecosystem Telemetry: Fleet Architecture, Multi-Currency Settlement & Top Developers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Fleet Capabilities & Gateways */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Fleet Integration Matrix</h3>
            </div>
            <Link href="/apps" className="text-xs text-blue-500 hover:underline">
              Fleet Desk
            </Link>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                180 Pay Gateways Active
              </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">
                {fleetCapabilities.payEnabled} / {fleetCapabilities.totalApps}{' '}
                <span className="text-[10px] text-zinc-400 font-normal">
                  ({Math.round((fleetCapabilities.payEnabled / (fleetCapabilities.totalApps || 1)) * 100)}%)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-indigo-500" />
                180 Sovereign Auth SSO
              </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white">
                {fleetCapabilities.authEnabled} / {fleetCapabilities.totalApps}{' '}
                <span className="text-[10px] text-zinc-400 font-normal">
                  ({Math.round((fleetCapabilities.authEnabled / (fleetCapabilities.totalApps || 1)) * 100)}%)
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-amber-500" />
                Custom Pay Domains Active
              </span>
              <span className="font-mono font-bold text-amber-500">
                {fleetCapabilities.customDomainEnabled} apps
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-purple-500" />
                BYOG Gateway Nodes
              </span>
              <span className="font-mono font-bold text-purple-400">
                {fleetCapabilities.customGatewayEnabled} apps
              </span>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                KYC Verified Developers
              </span>
              <span className="font-mono font-bold text-emerald-500">
                {fleetCapabilities.verifiedDevelopersCount} / {overview.totalDevelopers} (100%)
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Multi-Currency Settlement Breakdown */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Multi-Currency Distribution</h3>
            </div>
            <Link href="/treasury" className="text-xs text-blue-500 hover:underline">
              Treasury
            </Link>
          </div>

          {currencyDistribution.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">No currency volume recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {currencyDistribution.map((item: any) => (
                <div key={item.currency} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {item.currency} ({item.count} payments)
                    </span>
                    <span className="font-mono text-zinc-900 dark:text-white font-bold">
                      {currencySymbol}
                      {(item.volumeNormalized || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-[10px] text-zinc-400 font-normal">({item.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, item.percentage || 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Top Developers Leaderboard */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Top Developer Studios</h3>
            </div>
            <Link href="/developers" className="text-xs text-blue-500 hover:underline">
              All Devs
            </Link>
          </div>

          {topDevelopers.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">No developers recorded yet.</div>
          ) : (
            <div className="space-y-2.5">
              {topDevelopers.map((dev: any) => (
                <Link
                  key={dev.id}
                  href={`/developers/${dev.id}`}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                      {(dev.name || 'D').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-zinc-900 dark:text-white group-hover:text-blue-500 transition-colors flex items-center gap-1.5">
                        <span className="truncate max-w-[120px]">{dev.name}</span>
                        {dev.isVerified && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {dev.appsCount} app{dev.appsCount > 1 ? 's' : ''} • {dev.paymentsCount} orders
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                      {currencySymbol}
                      {(dev.gmv || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{dev.volumeShare}% vol</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Top Applications Leaderboard & Live Sovereign Transactions */}
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
                      {(app.gmv || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, app.volumeShare || 0)}%` }}
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
              {recentTransactions.slice(0, 5).map((tx: any) => {
                const isPaid = tx.status === 'PAID' || tx.status === 'CAPTURED' || tx.status === 'COMPLETED';
                const isPending = tx.status === 'PENDING';
                const isRefunded = tx.status === 'REFUNDED';
                const dotColor = isPaid
                  ? 'bg-emerald-500'
                  : isPending
                  ? 'bg-amber-500'
                  : isRefunded
                  ? 'bg-purple-500'
                  : 'bg-rose-500';
                const badgeColor = isPaid
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : isPending
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : isRefunded
                  ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                  : 'bg-rose-500/10 text-rose-500 border-rose-500/20';

                return (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 font-sans">
                      <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <span>{tx.title || tx.app?.name || '180 Pay Checkout'}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                            {tx.status}
                          </span>
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
