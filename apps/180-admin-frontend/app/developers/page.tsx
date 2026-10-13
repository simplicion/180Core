'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function DevelopersDirectoryPage() {
  const router = useRouter();
  const [developers, setDevelopers] = useState<any[]>([]);
  const [bgDeletingUsers, setBgDeletingUsers] = useState<
    Array<{ id: string; name: string; email: string; reason?: string }>
  >([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED' | 'WITH_APPS' | 'WITH_VOLUME' | 'WALLET_LOCKED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedDeveloper, setSelectedDeveloper] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [developerToDelete, setDeveloperToDelete] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('Detected suspicious activity violating platform integrity and operational policies.');
  const [isDeleting, setIsDeleting] = useState(false);

  const syncDeletionQueue = async () => {
    try {
      const res = await adminApi.getDeletionQueue();
      if (res.success && res.tasks) {
        const active = res.tasks
          .filter((t: any) => t.isPending)
          .map((t: any) => ({
            id: t.userId,
            name: t.name,
            email: t.email,
            reason: t.reason,
          }));
        setBgDeletingUsers((prev) => {
          const map = new Map<string, { id: string; name: string; email: string; reason?: string }>();
          active.forEach((u: any) => map.set(u.id, u));
          prev.forEach((u) => {
            if (!map.has(u.id)) map.set(u.id, u);
          });
          return Array.from(map.values());
        });
      }
    } catch (_) {}
  };

  useEffect(() => {
    syncDeletionQueue();
    const interval = setInterval(syncDeletionQueue, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadDevelopers();
  }, [search, statusFilter]);

  const loadDevelopers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getDevelopers({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: 100,
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

  const openDeleteModal = (dev: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeveloperToDelete(dev);
    setDeleteReason('Detected suspicious activity violating platform integrity and operational policies.');
  };

  const handleConfirmDelete = async () => {
    if (!developerToDelete) return;
    const target = developerToDelete;
    const targetReason = deleteReason;

    // 1. Instantly close modal and slideover drawer (0ms delay)
    setDeveloperToDelete(null);
    if (selectedDeveloper && selectedDeveloper.id === target.id) {
      setSelectedDeveloper(null);
    }

    // 2. Optimistically remove from developer table list immediately
    setDevelopers((prev) => prev.filter((d) => d.id !== target.id));

    // 3. Register in background deleting users tracker
    const targetItem = {
      id: target.id,
      name: target.name || target.username || target.email || 'Developer',
      email: target.email || '',
      reason: targetReason,
    };
    setBgDeletingUsers((prev) => [targetItem, ...prev.filter((u) => u.id !== target.id)]);

    // 4. Instantly notify the admin
    toast.loading(`⚡ Deleting "${targetItem.name}" in background queue... Purging database records.`, {
      id: `del-${target.id}`,
    });

    // 5. Fire background request to queue without blocking admin UI
    try {
      const res = await adminApi.deleteDeveloper(target.id, targetReason);
      if (res.success) {
        toast.success(
          `User "${targetItem.name}" queued for deletion! Running smoothly in background.`,
          { id: `del-${target.id}`, duration: 5000 }
        );
      }
    } catch (err: any) {
      toast.error(`Background deletion notice: ${err.message || 'Operation failed'}`, {
        id: `del-${target.id}`,
      });
      loadDevelopers();
    } finally {
      setTimeout(syncDeletionQueue, 3000);
    }
  };

  // Real aggregate telemetry calculated directly from live database records
  const totalDevs = developers.length;
  const verifiedDevs = developers.filter((d) => d.isVerified).length;
  const verifiedPct = totalDevs > 0 ? Math.round((verifiedDevs / totalDevs) * 100) : 0;
  const totalFleetApps = developers.reduce(
    (acc, d) => acc + (d.appCount || d._count?.apps || d.apps?.length || 0),
    0
  );
  const totalFleetGmv = developers.reduce((acc, d) => acc + (d.totalGmv || 0), 0);
  const totalEscrowWallet = developers.reduce(
    (acc, d) => acc + (d.totalWalletBalance || d.walletBalance || 0),
    0
  );

  // Client-side quick filtering
  const filteredDevelopers = developers.filter((dev) => {
    if (quickFilter === 'VERIFIED') return dev.isVerified;
    if (quickFilter === 'UNVERIFIED') return !dev.isVerified;
    if (quickFilter === 'WITH_APPS') return (dev.appCount || dev._count?.apps || dev.apps?.length || 0) > 0;
    if (quickFilter === 'WITH_VOLUME') return (dev.totalGmv || 0) > 0;
    if (quickFilter === 'WALLET_LOCKED') return dev.isWalletLocked;
    return true;
  });

  const handleExportCsv = () => {
    const listToExport = filteredDevelopers.length > 0 ? filteredDevelopers : developers;
    if (!listToExport.length) {
      toast.error('No developers to export');
      return;
    }
    const rows = listToExport.map((d) => ({
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
    toast.success(`Exported ${listToExport.length} developer records to CSV`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Stats Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Developer Directory & Profiles
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono">
              {totalDevs} Registered
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

      {/* 4-Card Real Metric Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">Total Registered</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            {totalDevs}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-blue-500 font-semibold font-mono">100% live</span> database studios
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">KYC Verification</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            {verifiedDevs}{' '}
            <span className="text-xs font-medium text-emerald-500 font-sans">
              ({verifiedPct}%)
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-500 font-semibold font-mono">{verifiedDevs}</span> verified accounts
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">Fleet Applications</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            {totalFleetApps}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-indigo-500 font-semibold font-mono">
              {(totalFleetApps / (totalDevs || 1)).toFixed(1)}
            </span>{' '}
            apps / developer avg
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">Volume (GMV) Collected</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            ${totalFleetGmv.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-amber-500 font-semibold font-mono">
              ${totalEscrowWallet.toFixed(2)}
            </span>{' '}
            in sovereign wallets
          </div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
          Quick Filters:
        </span>
        {[
          { id: 'ALL', label: `All Studios (${totalDevs})` },
          { id: 'VERIFIED', label: `KYC Verified (${verifiedDevs})` },
          { id: 'UNVERIFIED', label: `Unverified (${totalDevs - verifiedDevs})` },
          {
            id: 'WITH_APPS',
            label: `With Apps (${developers.filter((d) => (d.appCount || d._count?.apps || d.apps?.length || 0) > 0).length})`,
          },
          {
            id: 'WITH_VOLUME',
            label: `With Volume (${developers.filter((d) => (d.totalGmv || 0) > 0).length})`,
          },
          {
            id: 'WALLET_LOCKED',
            label: `Wallet Locked (${developers.filter((d) => d.isWalletLocked).length})`,
          },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setQuickFilter(chip.id as any)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === chip.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/5'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Background Deletion Queue Active Banner */}
      {bgDeletingUsers.length > 0 && (
        <div className="p-4.5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/[0.08] border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-xl shadow-amber-500/5 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <div className="h-4 w-4 border-2 border-amber-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Background Deletion Queue Running
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                    {bgDeletingUsers.length} Active
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                  Permanently deleting{' '}
                  <strong className="font-semibold text-amber-950 dark:text-white">
                    {bgDeletingUsers.map((u) => u.name || u.email).join(', ')}
                  </strong>
                  . PostgreSQL database records, OAuth apps, wallets, and tokens are being purged smoothly in the background, and automated suspicious activity security notices are being dispatched.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                Processing smoothly in background
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Developers Table */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500">Loading developer registry...</div>
        ) : filteredDevelopers.length === 0 && bgDeletingUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">
            No developers found matching current criteria. Try adjusting your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Developer ({filteredDevelopers.length})</th>
                  <th className="py-3.5 px-4 font-medium">Verification (KYC)</th>
                  <th className="py-3.5 px-4 font-medium">Active Apps</th>
                  <th className="py-3.5 px-4 font-medium">GMV Collected</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Balance</th>
                  <th className="py-3.5 px-4 font-medium">Wallet Status</th>
                  <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {bgDeletingUsers.map((user) => (
                  <tr
                    key={`deleting-${user.id}`}
                    className="bg-amber-500/[0.04] dark:bg-amber-500/[0.06] border-b border-amber-500/20"
                  >
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                          <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                            <span>{user.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 animate-pulse">
                              DELETING USER
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td colSpan={5} className="py-3.5 px-4">
                      <div className="text-xs text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                        <span>Purging database records, tokens & apps in background queue. Security notice dispatched.</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-1 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Running in Background
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredDevelopers.map((dev) => (
                  <tr
                    key={dev.id}
                    onClick={() => router.push(`/developers/${dev.id}`)}
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/developers/${dev.id}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="View Profile & Projects"
                        >
                          <span>Profile & Projects</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={actionLoadingId === dev.id || isDeleting}
                          onClick={(e) => openDeleteModal(dev, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                          title="Delete Account (Suspicious Activity)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
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

                  <button
                    onClick={() => router.push(`/developers/${selectedDeveloper.id}`)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open Full Details Page</span>
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

                  <button
                    onClick={() => openDeleteModal(selectedDeveloper)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Permanently Delete Account</span>
                  </button>
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

      {/* Permanent Account Deletion Modal (Suspicious Activity Policy) */}
      {developerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-rose-500/30 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Permanent Account Deletion
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    Suspicious Activity Policy Enforcement
                  </p>
                </div>
              </div>
              <button
                disabled={isDeleting}
                onClick={() => setDeveloperToDelete(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Developer / User:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {developerToDelete.name || 'Anonymous Developer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Email:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {developerToDelete.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Registered Apps:</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                  {developerToDelete.appCount || developerToDelete._count?.apps || developerToDelete.apps?.length || 0} Apps
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-4 w-4" />
                Database Purge & Notice Guarantee:
              </div>
              <p className="leading-relaxed">
                1. This user, their OAuth apps, wallets, tokens, and ledger items will be <strong>permanently deleted from PostgreSQL</strong>.<br />
                2. The user will receive an automated security termination notice explaining that <strong>we detected suspicious activity</strong> which is why their account was deleted.<br />
                3. Any subsequent login or re-registration attempts will explicitly notify them of account termination for suspicious activity.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Reason for Termination (Included in Email & Audit):
              </label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Specify details about the detected suspicious activity..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeveloperToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account (Queue in Background)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
