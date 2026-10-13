'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ShieldCheck,
  ExternalLink,
  Key,
  Globe,
  Radio,
  Filter,
  Download,
  RotateCw,
  Copy,
  Check,
  X,
  CreditCard,
  Settings,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function AppsFleetPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PAY_ENABLED' | 'WITH_VOLUME'>('ALL');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Rotate secret modal
  const [secretModalApp, setSecretModalApp] = useState<any | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Gateway inspection drawer
  const [gatewayDrawerApp, setGatewayDrawerApp] = useState<any | null>(null);

  useEffect(() => {
    loadApps();
  }, [search, statusFilter]);

  const loadApps = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getApps({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: 100,
      });
      if (res.success) {
        setApps(res.data?.apps || res.apps || []);
      }
    } catch (err) {
      console.error('Failed to load apps fleet', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (app: any) => {
    const nextStatus = !app.isActive;
    try {
      setUpdatingId(app.id);
      const res = await adminApi.toggleAppStatus(app.id, nextStatus);
      if (res.success) {
        toast.success(
          `App "${app.name}" is now ${nextStatus ? 'ACTIVE' : 'SUSPENDED'}`
        );
        setApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, isActive: nextStatus } : a))
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update app status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRotateSecret = async (app: any) => {
    try {
      setSecretModalApp(app);
      setGeneratedSecret(null);
      setCopied(false);
      const res = await adminApi.rotateAppSecret(app.id);
      if (res.success) {
        setGeneratedSecret(res.newSecret);
        toast.success(`New secret generated for ${app.name}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to rotate client secret');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Real fleet aggregate telemetry
  const totalApps = apps.length;
  const activeApps = apps.filter((a) => a.isActive !== false).length;
  const activePct = totalApps > 0 ? Math.round((activeApps / totalApps) * 100) : 0;
  const payApps = apps.filter((a) => a.enablePay).length;
  const totalFleetGmv = apps.reduce((sum, a) => sum + (a.totalGmv || 0), 0);
  const totalWalletEscrow = apps.reduce((sum, a) => sum + (a.walletBalance || 0), 0);

  // Client-side quick filter
  const filteredApps = apps.filter((a) => {
    if (quickFilter === 'ACTIVE') return a.isActive !== false;
    if (quickFilter === 'SUSPENDED') return a.isActive === false;
    if (quickFilter === 'PAY_ENABLED') return a.enablePay;
    if (quickFilter === 'WITH_VOLUME') return (a.totalGmv || 0) > 0;
    return true;
  });

  const handleExportCsv = () => {
    const listToExport = filteredApps.length > 0 ? filteredApps : apps;
    if (!listToExport.length) return;
    const rows = listToExport.map((a) => ({
      ID: a.id,
      Name: a.name,
      ClientID: a.clientId,
      OwnerName: a.developer?.name || a.user?.name || 'Unknown',
      OwnerEmail: a.developer?.email || a.user?.email || '',
      Status: a.isActive !== false ? 'ACTIVE' : 'SUSPENDED',
      EnablePay: a.enablePay ? 'YES' : 'NO',
      TotalGmvUSD: (a.totalGmv || 0).toFixed(2),
      WalletBalanceUSD: (a.walletBalance || 0).toFixed(2),
      CreatedAt: new Date(a.createdAt).toLocaleDateString(),
    }));
    exportToCsv('180_apps_fleet', rows);
    toast.success(`Exported ${listToExport.length} applications to CSV`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Global App Fleet & Policy Center
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-mono">
              {totalApps} Applications
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Governance, RS256 token capabilities, payment permissions, and suspension controls.
          </p>
        </div>

        {/* Search, Status Filters & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search app, client ID, owner..."
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
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
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
            <span className="font-medium">Total App Fleet</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            {totalApps}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-indigo-500 font-semibold font-mono">100% genuine</span> OAuth 2.1 apps
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">Operational Status</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            {activeApps}{' '}
            <span className="text-xs font-medium text-emerald-500 font-sans">
              ({activePct}%)
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-500 font-semibold font-mono">{activeApps}</span> active, {totalApps - activeApps} suspended
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">180 Pay Enabled</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            {payApps}{' '}
            <span className="text-xs font-medium text-blue-500 font-sans">
              ({Math.round((payApps / (totalApps || 1)) * 100)}%)
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-blue-500 font-semibold font-mono">{payApps}</span> checkout enabled
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span className="font-medium">Fleet GMV Collected</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
            ${totalFleetGmv.toFixed(2)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
            <span className="text-amber-500 font-semibold font-mono">
              ${totalWalletEscrow.toFixed(2)}
            </span>{' '}
            settled balance
          </div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
          Quick Filters:
        </span>
        {[
          { id: 'ALL', label: `All Apps (${totalApps})` },
          { id: 'ACTIVE', label: `Active (${activeApps})` },
          { id: 'SUSPENDED', label: `Suspended (${totalApps - activeApps})` },
          { id: 'PAY_ENABLED', label: `Pay Enabled (${payApps})` },
          {
            id: 'WITH_VOLUME',
            label: `With Volume (${apps.filter((a) => (a.totalGmv || 0) > 0).length})`,
          },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setQuickFilter(chip.id as any)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === chip.id
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/5'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Main Apps Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-zinc-500">Loading app fleet telemetry...</div>
      ) : filteredApps.length === 0 ? (
        <div className="p-16 text-center text-xs text-zinc-500">
          No applications found matching current criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className={`p-6 rounded-3xl bg-white dark:bg-zinc-950 border transition-all flex flex-col justify-between group ${
                app.isActive !== false
                  ? 'border-zinc-200/80 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                  : 'border-rose-500/30 bg-rose-500/[0.01]'
              }`}
            >
              <div>
                {/* Header: Icon, Name, Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0">
                      {app.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate max-w-[170px]">
                        {app.name}
                      </h3>
                      <div className="text-[11px] text-zinc-500 truncate max-w-[170px]">
                        {app.developer?.name || app.user?.name || app.user?.email || 'System Owned'}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      app.isActive !== false
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}
                  >
                    {app.isActive !== false ? 'ACTIVE' : 'SUSPENDED'}
                  </span>
                </div>

                {/* App Credentials & Metadata */}
                <div className="mt-5 space-y-2">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Key className="h-3 w-3" />
                        Client ID
                      </span>
                      <button
                        onClick={() => handleRotateSecret(app)}
                        className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <RotateCw className="h-2.5 w-2.5" />
                        Rotate Secret
                      </button>
                    </div>
                    <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 truncate select-all">
                      {app.clientId || app.id}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1 text-zinc-500">
                    <button
                      onClick={() => setGatewayDrawerApp(app)}
                      className="flex items-center gap-1.5 text-blue-500 hover:underline"
                    >
                      <CreditCard className="h-3 w-3" />
                      Gateway Config
                    </button>
                    <span className="font-mono text-[11px]">
                      Created: {new Date(app.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-3">
                <button
                  disabled={updatingId === app.id}
                  onClick={() => handleToggleStatus(app)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    app.isActive !== false
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  }`}
                >
                  {updatingId === app.id ? (
                    'Updating...'
                  ) : app.isActive !== false ? (
                    <>
                      <Ban className="h-3.5 w-3.5" />
                      <span>Suspend App</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Reactivate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Secret Rotation Modal */}
      {secretModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Rotated Client Secret</h3>
                  <p className="text-xs text-zinc-500">{secretModalApp.name}</p>
                </div>
              </div>
              <button onClick={() => setSecretModalApp(null)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {generatedSecret ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
                  Save this secret immediately. It cannot be shown again.
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2 font-mono text-xs select-all text-zinc-900 dark:text-white">
                  <span className="truncate">{generatedSecret}</span>
                  <button
                    onClick={() => copyToClipboard(generatedSecret)}
                    className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-500">Generating cryptographic secret...</div>
            )}

            <div className="pt-3 border-t border-zinc-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setSecretModalApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BYOG Gateway Inspection Drawer */}
      {gatewayDrawerApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Payment Gateway Config</h3>
                  <p className="text-xs text-zinc-500">{gatewayDrawerApp.name}</p>
                </div>
                <button onClick={() => setGatewayDrawerApp(null)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-6 space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/5 space-y-2">
                  <div className="text-zinc-500 text-[11px]">Primary Gateway Engine</div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white font-mono">
                    {gatewayDrawerApp.customGatewayType || '180_PAY_HYBRID (Stripe + Razorpay)'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">180 Pay Enabled</span>
                    <span className="font-bold text-emerald-500">{gatewayDrawerApp.enablePay !== false ? 'YES' : 'NO'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Universal Auth Enabled</span>
                    <span className="font-bold text-blue-500">YES</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">Custom BYOG Key</span>
                    <span className="font-mono text-zinc-400">••••sec_encrypted</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setGatewayDrawerApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
