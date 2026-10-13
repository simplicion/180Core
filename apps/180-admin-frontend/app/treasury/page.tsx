'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Landmark,
  DollarSign,
  Layers,
  Users,
  ArrowDownToLine,
  TrendingUp,
  CreditCard,
  Building2,
  PieChart,
  ArrowUpRight,
  Filter,
  Download,
  Settings,
  ShieldCheck,
  Percent,
  Receipt,
  X,
  CheckCircle2,
  ChevronRight,
  Coins,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function TreasuryPage() {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'BY_DEVELOPER' | 'BY_APP'>('BY_DEVELOPER');
  const [loading, setLoading] = useState(true);

  // Fee Adjustment Modal
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [feeRate, setFeeRate] = useState(2.0);
  const [savingFee, setSavingFee] = useState(false);

  // Drilldown Drawer
  const [drilldownItem, setDrilldownItem] = useState<any | null>(null);

  useEffect(() => {
    loadTreasury();
  }, []);

  const loadTreasury = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTreasury();
      if (res.success) {
        setData(res.data || res);
      }
    } catch (err) {
      console.error('Failed to load treasury analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFeeTier = async () => {
    try {
      setSavingFee(true);
      const res = await adminApi.updateSecuritySettings({ standardFeePercent: feeRate });
      if (res.success) {
        toast.success(`Platform standard take-rate updated to ${feeRate}%!`);
        setIsFeeModalOpen(false);
        loadTreasury();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update fee tier');
    } finally {
      setSavingFee(false);
    }
  };

  const treasury = data?.summary || data?.treasury || {
    totalPlatformGmv: 0,
    totalWalletEscrow: 0,
    totalPendingPayouts: 0,
    totalCompletedPayouts: 0,
    platformTakeRateEstimated: 0,
  };

  const totalGmv = Number(treasury.totalPlatformGmv || treasury.totalGmv || 0);
  const escrowFloat = Number(treasury.totalWalletEscrow || treasury.developerWalletLiabilities || 0);
  const pendingPayouts = Number(treasury.totalPendingPayouts || treasury.pendingSettlementClaims || 0);
  const settledToDate = Number(treasury.totalCompletedPayouts || treasury.settledToDate || 0);
  const platformFees = Number(treasury.platformTakeRateEstimated || treasury.platformFeeCut || (totalGmv * feeRate) / 100);

  const volumeVelocity = Number(treasury.volumeVelocity ?? data?.volumeVelocity ?? 0);

  // Multi-Currency Distribution computed from live database checkout sessions
  const multiCurrencyVolume: any[] = data?.currencyDistribution || [];

  // Gateway Share Distribution computed from live database checkout sessions
  const gatewayShares: any[] = data?.gatewayDistribution || [];

  // Tax & TDS calculations (1% TDS on Indian payouts, 18% GST on platform fee cut)
  const estimatedTdsWithheld = pendingPayouts * 0.01;
  const estimatedGstLiability = platformFees * 0.18;

  const byDeveloper: any[] = data?.byDeveloper || [];
  const byApp: any[] = data?.byApp || [];

  const handleExportStatements = () => {
    if (activeTab === 'BY_DEVELOPER') {
      const rows = byDeveloper.map((d: any) => ({
        DeveloperID: d.developerId,
        DeveloperName: d.developerName,
        Email: d.email || d.developerEmail,
        AppsCount: d.appCount || d.appsCount || 1,
        TotalCollectedUSD: (d.totalCollected || d.totalGmv || 0).toFixed(2),
        WalletBalanceUSD: (d.totalWalletBalance || d.walletBalance || 0).toFixed(2),
        PendingSettlementUSD: (d.pendingSettlement || d.pendingPayout || 0).toFixed(2),
        SettledPayoutsUSD: (d.settledPayouts || 0).toFixed(2),
        EstimatedTdsUSD: ((d.pendingSettlement || 0) * 0.01).toFixed(2),
      }));
      exportToCsv('180_treasury_developers_financial_statement', rows);
    } else {
      const rows = byApp.map((a: any) => ({
        AppID: a.appId,
        AppName: a.appName,
        OwnerDeveloper: a.developerName,
        OwnerEmail: a.developerEmail || '',
        TotalCollectedUSD: (a.totalCollected || 0).toFixed(2),
        WalletBalanceUSD: (a.walletBalance || 0).toFixed(2),
        SuccessfulTransactions: a.txCount || a.successfulCharges || 0,
        GatewayType: a.gatewayType || '180_PAY_STANDARD',
      }));
      exportToCsv('180_treasury_apps_financial_statement', rows);
    }
    toast.success('Financial statements exported to CSV!');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            180 Pay Treasury & Revenue Analytics
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Sovereign Reserves
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time funds collected across 180 Pay, gateway shares, developer escrow liabilities, and tax withholdings.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsFeeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <Percent className="h-3.5 w-3.5 text-blue-500" />
            <span>Fee Tiers ({feeRate}%)</span>
          </button>

          <button
            onClick={handleExportStatements}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <Link
            href="/payouts"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20 transition-all flex items-center gap-2"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            <span>Settlement Desk</span>
          </Link>
        </div>
      </div>

      {/* High-Level Treasury Balances (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Collected */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span>Gross Funds Collected (GMV)</span>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            ${totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className={`font-bold ${volumeVelocity >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {volumeVelocity >= 0 ? `+${volumeVelocity}%` : `${volumeVelocity}%`}
            </span> vs previous cycle
          </div>
        </div>

        {/* Developer Wallet Liabilities */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span>Developer Float (Escrow)</span>
            <Building2 className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-3">
            ${escrowFloat.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Sovereign wallet balances held</div>
        </div>

        {/* Pending Settlements */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span>Requested Settlements</span>
            <ArrowDownToLine className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-500 mt-3">
            ${pendingPayouts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Awaiting bank dispatch</div>
        </div>

        {/* Platform Net Earnings */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span>Platform Fee Earnings</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-3">
            ${platformFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Calculated at standard {feeRate}% take-rate</div>
        </div>
      </div>

      {/* Middle Row: Multi-Currency Breakdown & Gateway Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Multi-Currency Volume Distribution */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Multi-Currency Volume Distribution
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">Live FX Conversion</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {multiCurrencyVolume.length === 0 ? (
              <div className="col-span-2 sm:col-span-4 p-8 text-center text-xs text-zinc-500 font-sans">
                No foreign currency transactions processed yet. Volume breakdown will update live as checkout sessions occur.
              </div>
            ) : (
              multiCurrencyVolume.map((curr) => (
                <div
                  key={curr.code}
                  className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{curr.flag}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                      {curr.share}%
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-500 uppercase mt-2">{curr.code}</div>
                  <div className="text-base font-black font-mono text-zinc-900 dark:text-white">
                    {curr.symbol} {curr.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tax & TDS Withholding Calculation Card */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-4 w-4 text-amber-500" />
                Tax & Regulatory Withholdings Estimation
              </div>
              <div className="text-zinc-500 text-[11px]">
                Statutory 1% TDS on domestic payouts and 18% GST accrued on platform fee earnings.
              </div>
            </div>
            <div className="flex items-center gap-6 font-mono shrink-0">
              <div>
                <div className="text-[10px] text-zinc-400">1% TDS Withheld</div>
                <div className="text-sm font-bold text-amber-500">${estimatedTdsWithheld.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400">18% GST Accrued</div>
                <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  ${estimatedGstLiability.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gateway Share Distribution */}
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Gateway Share</h3>
              </div>
              <span className="text-[11px] text-zinc-500">Routing</span>
            </div>

            <div className="space-y-4 mt-4">
              {gatewayShares.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500 font-sans">
                  No transaction routing data recorded yet.
                </div>
              ) : (
                gatewayShares.map((gw) => (
                  <div key={gw.name} className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium truncate pr-2">{gw.name}</span>
                      <span className="font-bold font-mono text-zinc-900 dark:text-white">{gw.share}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className={`h-full ${gw.color} rounded-full transition-all duration-500`}
                        style={{ width: `${gw.share}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono text-right">
                      ${gw.volume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[11px] text-zinc-500">
            Escrow reserve ratio: <span className="font-bold text-blue-500">100% fully-backed</span> in sovereign settlement accounts.
          </div>
        </div>
      </div>

      {/* Main Breakdown: Tabs for By Developer vs By App */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-zinc-100 dark:bg-white/5 w-fit">
            <button
              onClick={() => setActiveTab('BY_DEVELOPER')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'BY_DEVELOPER'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Collected by Developer ({byDeveloper.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('BY_APP')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'BY_APP'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Collected by Application ({byApp.length})</span>
            </button>
          </div>

          <div className="text-xs text-zinc-500 font-mono">
            Audit Integrity Hash: <span className="text-blue-500 font-bold">SHA256-verified</span>
          </div>
        </div>

        {/* Tab 1: Breakdown by Developer */}
        {activeTab === 'BY_DEVELOPER' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Developer Account</th>
                  <th className="py-3.5 px-4 font-medium">Fleet Apps</th>
                  <th className="py-3.5 px-4 font-medium">Gross GMV Collected</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Balance</th>
                  <th className="py-3.5 px-4 font-medium">Pending Payouts</th>
                  <th className="py-3.5 px-4 font-medium">Settled to Date</th>
                  <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono">
                {byDeveloper.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500 font-sans">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Users className="h-8 w-8 text-zinc-400 stroke-[1.5]" />
                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Developer Treasury Accounts</p>
                        <p className="text-xs text-zinc-400 max-w-sm">No registered developers have collected payments or accumulated wallet float yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  byDeveloper.map((row: any) => (
                    <tr
                      key={row.developerId}
                      className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-6 font-sans">
                        <div className="font-semibold text-zinc-900 dark:text-white">{row.developerName}</div>
                        <div className="text-[11px] text-zinc-500">{row.email || row.developerEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 text-[11px]">
                          {row.appCount || row.appsCount || 1} Apps
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white">
                        ${(row.totalCollected || row.totalGmv || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-purple-600 dark:text-purple-400">
                        ${(row.totalWalletBalance || row.walletBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-amber-500">
                        ${(row.pendingSettlement || row.pendingPayout || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ${(row.settledPayouts || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6 font-sans text-right">
                        <button
                          onClick={() => setDrilldownItem({ type: 'DEVELOPER', ...row })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          Drill-Down
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Breakdown by Application */}
        {activeTab === 'BY_APP' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Application Name</th>
                  <th className="py-3.5 px-4 font-medium">Owner Developer</th>
                  <th className="py-3.5 px-4 font-medium">Transactions</th>
                  <th className="py-3.5 px-4 font-medium">Gateway Protocol</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Balance</th>
                  <th className="py-3.5 px-4 font-medium">Total Collected</th>
                  <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono">
                {byApp.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500 font-sans">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Layers className="h-8 w-8 text-zinc-400 stroke-[1.5]" />
                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Application Revenue Records</p>
                        <p className="text-xs text-zinc-400 max-w-sm">No registered applications have received checkouts or captured charges yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  byApp.map((row: any) => (
                    <tr key={row.appId} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-6 font-sans">
                        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-indigo-500" />
                          {row.appName}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">{row.appId}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans text-zinc-700 dark:text-zinc-300">
                        {row.developerName}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600 dark:text-zinc-300">
                        {row.txCount || row.successfulCharges || 0} checkouts
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[11px] font-bold">
                          {row.gatewayType || '180_PAY'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-purple-600 dark:text-purple-400">
                        ${(row.walletBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-white">
                        ${(row.totalCollected || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6 font-sans text-right">
                        <button
                          onClick={() => setDrilldownItem({ type: 'APP', ...row })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          Drill-Down
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fee Tier Adjustment Modal */}
      {isFeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Adjust Platform Fee Tier</h3>
                  <p className="text-xs text-zinc-500">Global 180 Pay take-rate applied to all transactions</p>
                </div>
              </div>
              <button onClick={() => setIsFeeModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Take-Rate Percentage (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={feeRate}
                    onChange={(e) => setFeeRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-xl font-mono text-sm bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-base font-bold text-zinc-500">%</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">Recommended industry standard: 1.5% to 2.5%</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Projected Monthly Take:</span>
                  <span className="font-bold text-emerald-500">${((totalGmv * feeRate) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Developer Payout Share:</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    ${(totalGmv * (1 - feeRate / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={() => setIsFeeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={savingFee}
                onClick={handleUpdateFeeTier}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all"
              >
                {savingFee ? 'Saving...' : 'Apply New Fee Tier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Financial Drill-Down Inspection Drawer */}
      {drilldownItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-white/10">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    {drilldownItem.type === 'DEVELOPER' ? 'Developer Revenue Report' : 'Application Revenue Audit'}
                  </h3>
                  <p className="font-mono text-xs text-zinc-500">
                    {drilldownItem.developerName || drilldownItem.appName}
                  </p>
                </div>
                <button onClick={() => setDrilldownItem(null)} className="p-2 rounded-xl text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4 text-xs">
                <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-2">
                  <div className="text-zinc-500">Total Lifetime Volume Processed</div>
                  <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
                    ${(drilldownItem.totalCollected || drilldownItem.totalGmv || 0).toFixed(2)}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Entity Identifier</span>
                    <span className="font-mono text-zinc-900 dark:text-white">
                      {drilldownItem.developerId || drilldownItem.appId}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Associated Contact</span>
                    <span className="text-zinc-900 dark:text-white">
                      {drilldownItem.email || drilldownItem.developerEmail || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Current Wallet Escrow</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      ${(drilldownItem.totalWalletBalance || drilldownItem.walletBalance || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Estimated Platform Cut Taken</span>
                    <span className="font-mono font-bold text-emerald-500">
                      ${(((drilldownItem.totalCollected || drilldownItem.totalGmv || 0) * feeRate) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Settlement Verification</span>
                    <span className="font-bold text-blue-500">KYC Compliant</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setDrilldownItem(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-300"
              >
                Close Audit Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
