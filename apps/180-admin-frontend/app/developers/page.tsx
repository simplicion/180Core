'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Download,
  X,
  ExternalLink,
  ChevronRight,
  Wallet,
  BadgeCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function DevelopersDirectoryPage() {
  const [developers, setDevelopers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedDeveloper, setSelectedDeveloper] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadDevelopers();
  }, [search, statusFilter]);

  const loadDevelopers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getDevelopers({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      if (res.success) {
        setDevelopers(res.data?.developers || res.developers || []);
      }
    } catch (err) {
      console.error('Failed to load developers', err);
    } finally {
      setLoading(false);
    }
  };

  const openDeveloperDetails = async (dev: any) => {
    try {
      setDrawerLoading(true);
      setSelectedDeveloper(dev);
      const res = await adminApi.getDeveloper(dev.id);
      if (res.success) {
        setSelectedDeveloper(res.data?.developer || res.developer || dev);
      }
    } catch (err) {
      console.error('Failed to load developer deep-dive', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleToggleVerify = async (dev: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setActionLoadingId(dev.id);
      const nextState = !dev.isVerified;
      const res = await adminApi.verifyDeveloper(dev.id, nextState);
      if (res.success) {
        toast.success(`Developer "${dev.name}" verification set to ${nextState ? 'VERIFIED' : 'UNVERIFIED'}`);
        setDevelopers((prev) =>
          prev.map((d) => (d.id === dev.id ? { ...d, isVerified: nextState } : d))
        );
        if (selectedDeveloper && selectedDeveloper.id === dev.id) {
          setSelectedDeveloper((prev: any) => ({ ...prev, isVerified: nextState }));
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update verification status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleWalletLock = async (dev: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setActionLoadingId(dev.id);
      const nextLocked = !dev.isWalletLocked;
      const res = await adminApi.lockDeveloperWallet(dev.id, nextLocked);
      if (res.success) {
        toast.success(`Wallet ${nextLocked ? 'LOCKED' : 'UNLOCKED'} for "${dev.name}"`);
        setDevelopers((prev) =>
          prev.map((d) => (d.id === dev.id ? { ...d, isWalletLocked: nextLocked } : d))
        );
        if (selectedDeveloper && selectedDeveloper.id === dev.id) {
          setSelectedDeveloper((prev: any) => ({ ...prev, isWalletLocked: nextLocked }));
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wallet lock');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportCsv = () => {
    if (!developers.length) {
      toast.error('No developers to export');
      return;
    }
    const rows = developers.map((d) => ({
      ID: d.id,
      Name: d.name || 'Anonymous',
      Email: d.email || '',
      Phone: d.phone || '',
      Company: d.company || '',
      Verified: d.isVerified ? 'YES' : 'NO',
      AppsCount: d.appCount || d.apps?.length || 0,
      TotalGmvUSD: (d.totalGmv || 0).toFixed(2),
      WalletBalanceUSD: (d.totalWalletBalance || 0).toFixed(2),
      WalletLocked: d.isWalletLocked ? 'YES' : 'NO',
      Joined: new Date(d.createdAt).toLocaleDateString(),
    }));
    exportToCsv('180_developers_roster', rows);
    toast.success(`Exported ${developers.length} developer records to CSV`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Stats Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Developer Directory & Profiles
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {developers.length} Developers
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Global directory of registered developers, studio profiles, sovereign wallets, and apps fleet.
          </p>
        </div>

        {/* Search, Filter & CSV Export Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search name, email, phone, ID..."
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
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Developers Table */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500">Loading developer registry...</div>
        ) : developers.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">
            No developers found matching query. Try adjusting your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Developer</th>
                  <th className="py-3.5 px-4 font-medium">Verification (KYC)</th>
                  <th className="py-3.5 px-4 font-medium">Active Apps</th>
                  <th className="py-3.5 px-4 font-medium">GMV Collected</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Balance</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Status</th>
                  <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {developers.map((dev) => (
                  <tr
                    key={dev.id}
                    onClick={() => openDeveloperDetails(dev)}
                    className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                          {dev.name ? dev.name.slice(0, 2).toUpperCase() : 'DV'}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {dev.name || 'Anonymous Developer'}
                            {dev.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-zinc-500">{dev.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        disabled={actionLoadingId === dev.id}
                        onClick={(e) => handleToggleVerify(dev, e)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1.5 ${
                          dev.isVerified
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20'
                            : 'bg-zinc-100 dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20'
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span>{dev.isVerified ? 'Verified' : 'Unverified'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 font-mono text-[11px] font-semibold flex items-center gap-1.5 w-fit">
                        <Layers className="h-3 w-3 text-zinc-400" />
                        {dev.appCount || dev._count?.apps || dev.apps?.length || 0} Apps
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                      ${(dev.totalGmv || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      ${(dev.totalWalletBalance || dev.walletBalance || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        disabled={actionLoadingId === dev.id}
                        onClick={(e) => handleToggleWalletLock(dev, e)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                          dev.isWalletLocked
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-500'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-500'
                        }`}
                      >
                        {dev.isWalletLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                        <span>{dev.isWalletLocked ? 'LOCKED' : 'ACTIVE'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button className="text-zinc-400 hover:text-blue-500 transition-colors">
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Developer Deep-Dive Slide-Over Modal */}
      {selectedDeveloper && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-xl h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {selectedDeveloper.name ? selectedDeveloper.name.slice(0, 2).toUpperCase() : 'DV'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      {selectedDeveloper.name || 'Anonymous Developer'}
                      {selectedDeveloper.isVerified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
                    </h3>
                    <p className="text-xs text-zinc-500">{selectedDeveloper.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDeveloper(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Developer Metadata */}
              <div className="grid grid-cols-2 gap-3 my-6">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5">
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                    Total GMV Collected
                  </div>
                  <div className="text-lg font-bold font-mono text-zinc-900 dark:text-white mt-1">
                    ${(selectedDeveloper.totalGmv || 0).toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5">
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    Sovereign Wallet
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    ${(selectedDeveloper.totalWalletBalance || selectedDeveloper.walletBalance || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Administrative Quick Actions */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-3 mb-6">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Administrative Actions</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleToggleVerify(selectedDeveloper)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                      selectedDeveloper.isVerified
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        : 'bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{selectedDeveloper.isVerified ? 'Mark Unverified' : 'Mark Verified'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleWalletLock(selectedDeveloper)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 ${
                      selectedDeveloper.isWalletLocked
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}
                  >
                    {selectedDeveloper.isWalletLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                    <span>{selectedDeveloper.isWalletLocked ? 'Unlock Wallet' : 'Lock Wallet'}</span>
                  </button>

                  <a
                    href="http://localhost:3008/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Inspect Workspace</span>
                  </a>
                </div>
              </div>

              {/* Developer Fleet Apps */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-zinc-400" />
                  Deployed Applications ({selectedDeveloper.apps?.length || 0})
                </h4>

                {selectedDeveloper.apps?.length === 0 ? (
                  <p className="text-xs text-zinc-500">No applications registered under this account.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDeveloper.apps?.map((app: any) => (
                      <div
                        key={app.id}
                        className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-white">{app.name}</div>
                          <div className="font-mono text-[10px] text-zinc-500">{app.clientId || app.id}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            app.isActive !== false
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-rose-500/10 text-rose-500'
                          }`}
                        >
                          {app.isActive !== false ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Close footer */}
            <div className="pt-6 border-t border-zinc-100 dark:border-white/10 flex items-center justify-end">
              <button
                onClick={() => setSelectedDeveloper(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
