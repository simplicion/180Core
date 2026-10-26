'use client';

import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import {
  Users,
  Search,
  RotateCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  UserX,
  UserCheck,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Globe,
  Mail,
  Phone,
  Fingerprint,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  X,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Info,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { OneEightyIdentity } from '@workspace/identity-sdk';
import { useProject } from '@/context/ProjectContext';

export function IdentityUsersView() {
  const {
    project,
    authLogs,
    loadingAuthLogs,
    fetchAuthLogs,
    handleRevokeUserSession,
    handleSuspendUser,
    handleUnsuspendUser,
    handleDeleteAppUser,
    revokingUserId,
    suspendingUserId,
    deletingUserId,
    copiedKey,
    copyToClipboard,
    enableAuth,
    setEnableAuth,
    saveSettings,
    saving,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OFFLINE' | 'SUSPENDED'>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  // Drawer & Modals state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [suspendingTarget, setSuspendingTarget] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [deletingTarget, setDeletingTarget] = useState<any | null>(null);

  // Lazy loading pagination state
  const [displayedCount, setDisplayedCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAuthLogs();
  }, [fetchAuthLogs]);

  const rawLogs = authLogs?.logs || [];
  const growthTimeline = authLogs?.growthTimeline || [];
  const authBreakdown = authLogs?.authMethodBreakdown || {
    google: 0,
    emailPassword: 0,
    otp: 0,
    passkey: 0,
    universal: 0,
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log: any) => {
      const name = (log.user?.name || '').toLowerCase();
      const email = (log.user?.email || '').toLowerCase();
      const phone = (log.user?.phone || '').toLowerCase();
      const username = (log.user?.appScopedUsername || log.user?.username || '').toLowerCase();
      const userId = (log.userId || '').toLowerCase();
      const city = (log.user?.city || '').toLowerCase();
      const country = (log.user?.country || '').toLowerCase();
      const q = deferredSearchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        username.includes(q) ||
        userId.includes(q) ||
        city.includes(q) ||
        country.includes(q);

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'ACTIVE' && log.status !== 'ACTIVE_SESSION') return false;
      if (statusFilter === 'OFFLINE' && (log.status === 'ACTIVE_SESSION' || log.isSuspended)) return false;
      if (statusFilter === 'SUSPENDED' && !log.isSuspended) return false;

      // Method Filter
      if (methodFilter !== 'ALL') {
        if (methodFilter === 'GOOGLE' && log.authMethod !== 'Google SSO') return false;
        if (methodFilter === 'EMAIL' && log.authMethod !== 'Email & Password') return false;
        if (methodFilter === 'OTP' && !log.authMethod.includes('OTP')) return false;
      }

      return true;
    });
  }, [rawLogs, deferredSearchQuery, statusFilter, methodFilter]);

  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, displayedCount);
  }, [filteredLogs, displayedCount]);

  // Infinite scroll trigger via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < filteredLogs.length) {
          setDisplayedCount((prev) => Math.min(prev + 20, filteredLogs.length));
        }
      },
      { threshold: 0.2 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [displayedCount, filteredLogs.length]);

  // Compute metrics
  const totalUsers = authLogs?.totalUsers ?? rawLogs.length;
  const activeCount = authLogs?.activeSessionsCount ?? rawLogs.filter((l: any) => l.status === 'ACTIVE_SESSION').length;
  const suspendedCount = authLogs?.suspendedUsersCount ?? rawLogs.filter((l: any) => l.isSuspended).length;
  const verifiedCount = authLogs?.verifiedUsersCount ?? rawLogs.filter((l: any) => l.user?.isVerified || l.user?.isEmailVerified).length;
  const verifiedPct = totalUsers > 0 ? Math.round((verifiedCount / totalUsers) * 100) : 0;

  // Max value for growth chart scaling
  const maxCumulative = useMemo(() => {
    if (!growthTimeline.length) return 10;
    const max = Math.max(...growthTimeline.map((g) => g.totalCumulative || g.newUsers));
    return max > 0 ? max : 10;
  }, [growthTimeline]);

  // Confirm Suspend
  const executeSuspend = async () => {
    if (!suspendingTarget) return;
    const ok = await handleSuspendUser(suspendingTarget.userId, suspensionReason);
    if (ok) {
      if (selectedUser?.userId === suspendingTarget.userId) {
        setSelectedUser((prev: any) => (prev ? { ...prev, isSuspended: true, status: 'SUSPENDED' } : null));
      }
      setSuspendingTarget(null);
      setSuspensionReason('');
    }
  };

  // Confirm Delete
  const executeDelete = async () => {
    if (!deletingTarget) return;
    const ok = await handleDeleteAppUser(deletingTarget.userId, deletingTarget.user?.name);
    if (ok) {
      if (selectedUser?.userId === deletingTarget.userId) {
        setSelectedUser(null);
      }
      setDeletingTarget(null);
    }
  };

  // Toggle 180 Identity Service
  const handleToggleAuth = async () => {
    const nextVal = !enableAuth;
    setEnableAuth(nextVal);
    await saveSettings({ enableAuth: nextVal });
  };

  // Preview Sovereign Auth Bottom Sheet
  const onPreviewBottomSheet = () => {
    if (!project?.clientId) {
      toast.error('Project client ID not available');
      return;
    }
    try {
      OneEightyIdentity.openAuth({
        clientId: project.clientId,
        uxMode: 'bottom_sheet',
        onSuccess: (res: any) =>
          toast.success(`Auth sheet preview passed! User: ${res?.user?.name || res?.code?.slice(0, 8) || 'OK'}`),
        onCancel: () => toast('Auth sheet closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Auth sheet preview failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 0. 180 IDENTITY ENGINE STATUS & PREVIEW CARD ─────────────────────── */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-5 sm:p-6 shadow-sm dark:shadow-2xl transition-all duration-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Service Information */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
                enableAuth
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-950 dark:text-white tracking-tight">
                  180 Identity Engine
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    enableAuth
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {enableAuth ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xl">
                Universal login with WhatsApp OTP, Google SSO, and unified @usernames. Issues RS256 asymmetric JWKS access tokens.
              </p>
            </div>
          </div>

          {/* Action Controls: Preview Button + Enable Switch */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={onPreviewBottomSheet}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-xs font-semibold text-white shadow-xs flex items-center gap-2 cursor-pointer transition-all duration-150"
              title="Preview Sovereign Auth Bottom Sheet"
            >
              <Smartphone className="w-4 h-4" />
              <span>Preview Bottom Sheet</span>
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-zinc-200 dark:border-white/10">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {enableAuth ? 'Service Enabled' : 'Service Disabled'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enableAuth}
                disabled={saving}
                onClick={handleToggleAuth}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${
                  enableAuth ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title={enableAuth ? 'Disable 180 Identity' : 'Enable 180 Identity'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    enableAuth ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 1. TOP METRICS DASHBOARD ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Authenticated Users
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950 dark:text-white">
              {totalUsers.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Real Database Records</span>
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Registered identities linked to this application
          </p>
        </div>

        {/* Active Sessions */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Sessions
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Tokens</span>
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-400">
            Hold unrevoked OAuth access tokens
          </p>
        </div>

        {/* Primary Auth Breakdown */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Identity Providers
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Fingerprint className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-700 dark:text-zinc-300">Google SSO</span>
                <span className="text-zinc-950 dark:text-white font-mono">{authBreakdown.google}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold mt-1">
                <span className="text-zinc-700 dark:text-zinc-300">Email & Password</span>
                <span className="text-zinc-950 dark:text-white font-mono">{authBreakdown.emailPassword}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
            <span>WhatsApp/OTP: {authBreakdown.otp}</span>
            <span>Passkeys: {authBreakdown.passkey}</span>
          </div>
        </div>

        {/* Security & Verification Health */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Security & Verification
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950 dark:text-white">
              {verifiedPct}%
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Verified Profiles
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <span className="text-emerald-600 dark:text-emerald-400">{verifiedCount} Verified</span>
            <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
            <span className={suspendedCount > 0 ? 'text-rose-500 font-semibold' : 'text-zinc-400'}>
              {suspendedCount} Suspended
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. USER GROWTH ANALYTICS GRAPH ──────────────────────────────────── */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span>Userbase Growth & Monthly Ingestion Analytics</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Historical timeline of authenticated sign-ups and monthly user adoption for this application.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">Cumulative Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-400/50" />
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">Monthly New Signups</span>
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="pt-4 pb-2">
          {growthTimeline.length > 0 ? (
            <div className="space-y-3">
              <div className="h-44 w-full flex items-end gap-3 sm:gap-6 pt-6 px-2">
                {growthTimeline.map((item, idx) => {
                  const barHeightPct = Math.max(
                    Math.round((item.totalCumulative / maxCumulative) * 100),
                    8
                  );
                  const newHeightPct = Math.max(
                    Math.round((item.newUsers / maxCumulative) * 100),
                    4
                  );

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-zinc-900 dark:bg-zinc-800 text-white text-[11px] font-mono px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-white/10">
                        <div>{item.month}</div>
                        <div className="text-blue-400 font-bold">{item.totalCumulative} total users</div>
                        <div className="text-indigo-300">{item.newUsers} new registrations</div>
                      </div>

                      {/* Cumulative Bar & New Signups Bar */}
                      <div className="w-full max-w-[48px] flex items-end justify-center gap-1 h-full">
                        <div
                          style={{ height: `${barHeightPct}%` }}
                          className="w-1/2 rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-700 dark:to-blue-500 transition-all duration-500 shadow-xs"
                        />
                        <div
                          style={{ height: `${newHeightPct}%` }}
                          className="w-1/2 rounded-t-lg bg-indigo-500/40 dark:bg-indigo-400/30 transition-all duration-500"
                        />
                      </div>

                      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-2 truncate max-w-full">
                        {item.month.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-100 dark:border-white/5 pt-2">
                <span>Timeline represents 6-month historical curve</span>
                <span>Active Database: 180 Core Identity Graph</span>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-zinc-400">
              No historical registration points recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. USER DIRECTORY & MANAGEMENT ──────────────────────────────────── */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-xs">
        {/* Header & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span>Registered Users Directory</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Manage identities, revoke sessions, and configure application-level permissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAuthLogs(true)}
              disabled={loadingAuthLogs}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh directory"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAuthLogs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayedCount(20);
              }}
              placeholder="Search by name, email, @username, user ID, or location..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs shrink-0 self-start md:self-auto overflow-x-auto max-w-full">
            {(['ALL', 'ACTIVE', 'OFFLINE', 'SUSPENDED'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter);
                  setDisplayedCount(20);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === filter
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {filter === 'ALL'
                  ? 'All Users'
                  : filter === 'ACTIVE'
                  ? 'Active Sessions'
                  : filter === 'OFFLINE'
                  ? 'Offline'
                  : 'Suspended'}
              </button>
            ))}
          </div>

          {/* Provider Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs shrink-0 self-start md:self-auto">
            {(['ALL', 'GOOGLE', 'EMAIL', 'OTP'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethodFilter(m);
                  setDisplayedCount(20);
                }}
                className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  methodFilter === m
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {m === 'ALL' ? 'All Providers' : m === 'GOOGLE' ? 'Google' : m === 'EMAIL' ? 'Email' : 'OTP'}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Table */}
        <div className="space-y-3 pt-1">
          {loadingAuthLogs && rawLogs.length === 0 ? (
            <div className="p-14 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-900 dark:text-white" />
              <p className="text-xs text-zinc-400">Loading live user identities...</p>
            </div>
          ) : visibleLogs.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">User & Identity</th>
                    <th className="px-4 py-3">Auth Provider</th>
                    <th className="px-4 py-3">App Username</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Location & Security</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {visibleLogs.map((log: any) => {
                    const isRevokingThis = revokingUserId === log.userId;
                    const isSuspendingThis = suspendingUserId === log.userId;
                    const isDeletingThis = deletingUserId === log.userId;
                    const appUsername = log.user?.appScopedUsername || log.user?.username;

                    return (
                      <tr
                        key={log.id || log.userId}
                        className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedUser(log)}
                      >
                        {/* User & Identity */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-xs overflow-hidden shrink-0">
                              {log.user?.avatar ? (
                                <img src={log.user.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                log.user?.name?.charAt(0) || 'U'
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-950 dark:text-white flex items-center gap-1 truncate">
                                <span>{log.user?.name || '180 User'}</span>
                                {log.user?.isVerified && (
                                  <span title="Verified Identity"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /></span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">
                                ID: {log.userId?.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Auth Provider */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-200">
                            {log.authMethod === 'Google SSO' ? (
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                            ) : log.authMethod === 'Email & Password' ? (
                              <Key className="w-3 h-3 text-zinc-400" />
                            ) : (
                              <Phone className="w-3 h-3 text-emerald-500" />
                            )}
                            <span>{log.authMethod}</span>
                          </span>
                        </td>

                        {/* App Username */}
                        <td className="px-4 py-3">
                          {appUsername ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              @{appUsername}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {log.user?.email ? (
                            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                              <span className="truncate max-w-[140px]">{log.user.email}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(log.user.email, `email_${log.id}`);
                                }}
                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                                title="Copy Email"
                              >
                                {copiedKey === `email_${log.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : log.user?.phone ? (
                            <span className="text-zinc-600 dark:text-zinc-400">{log.user.phone}</span>
                          ) : (
                            <span className="text-zinc-400 italic">Not shared</span>
                          )}
                        </td>

                        {/* Location & Security */}
                        <td className="px-4 py-3 text-[11px]">
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                            <Globe className="w-3 h-3 text-zinc-400" />
                            <span>
                              {log.user?.city
                                ? `${log.user.city}, ${log.user.country || 'IN'}`
                                : log.user?.country || 'Global'}
                            </span>
                          </div>
                          {log.user?.hasPasskey && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                              <Fingerprint className="w-2.5 h-2.5" />
                              <span>Passkey enrolled</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {log.isSuspended ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                              <ShieldAlert className="w-2.5 h-2.5" />
                              <span>Suspended</span>
                            </span>
                          ) : log.status === 'ACTIVE_SESSION' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              Offline
                            </span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                          {new Date(log.connectedSince || log.grantedAt || Date.now()).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Inspect */}
                            <button
                              type="button"
                              onClick={() => setSelectedUser(log)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                              title="View Full Profile Drawer"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Revoke active session */}
                            {log.status === 'ACTIVE_SESSION' && (
                              <button
                                type="button"
                                onClick={() => handleRevokeUserSession(log.userId, log.user?.name || 'User')}
                                disabled={isRevokingThis}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                title="Revoke active token"
                              >
                                {isRevokingThis ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserX className="w-3 h-3" />
                                )}
                                <span>Revoke</span>
                              </button>
                            )}

                            {/* Suspend or Unsuspend */}
                            {log.isSuspended ? (
                              <button
                                type="button"
                                onClick={() => handleUnsuspendUser(log.userId)}
                                disabled={isSuspendingThis}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                title="Unsuspend user access"
                              >
                                {isSuspendingThis ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3 h-3" />
                                )}
                                <span>Unsuspend</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSuspendingTarget(log)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                                title="Suspend user from app"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete / Remove from App */}
                            <button
                              type="button"
                              onClick={() => setDeletingTarget(log)}
                              disabled={isDeletingThis}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 transition-colors"
                              title="Delete from this application"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center space-y-2">
              <p className="text-xs text-zinc-500">No users match your filters or criteria.</p>
              {(searchQuery || statusFilter !== 'ALL' || methodFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setMethodFilter('ALL');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          )}

          {/* Lazy loading infinite scroll anchor */}
          {displayedCount < filteredLogs.length && (
            <div ref={observerTarget} className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more users as you scroll ({displayedCount} of {filteredLogs.length})...</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── 4. SLIDE-OVER USER DETAILS DRAWER (MAXIMUM INFORMATION) ────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in">
          <div className="w-full max-w-xl h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-lg overflow-hidden shrink-0">
                  {selectedUser.user?.avatar ? (
                    <img src={selectedUser.user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.user?.name?.charAt(0) || 'U'
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                    <span>{selectedUser.user?.name || '180 User'}</span>
                    {selectedUser.user?.isVerified && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </h3>
                  <div className="text-xs text-zinc-500 font-mono">
                    @{selectedUser.user?.appScopedUsername || selectedUser.user?.username || 'user'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedUser.isSuspended ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Suspended
                  </span>
                ) : selectedUser.status === 'ACTIVE_SESSION' ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active Session</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                    Offline
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Sovereign Identity Overview */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Sovereign Identity Credentials
                </h4>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 font-mono">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Universal User ID</span>
                    <div className="flex items-center gap-1 mt-0.5 text-zinc-800 dark:text-zinc-200 truncate">
                      <span className="truncate">{selectedUser.userId}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedUser.userId, 'drawer_uid')}
                        className="text-zinc-400 hover:text-white shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 block">App-Scoped Username</span>
                    <div className="mt-0.5 font-bold text-indigo-500">
                      @{selectedUser.user?.appScopedUsername || selectedUser.user?.username || '—'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 block">Global 180 Username</span>
                    <div className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      @{selectedUser.user?.username || '—'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 block">Account Created</span>
                    <div className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      {new Date(selectedUser.user?.createdAt || selectedUser.connectedSince).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Authentication & Authenticators */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Authenticators & Security Model
                </h4>
                <div className="space-y-2 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5">
                  <div className="flex items-center justify-between py-1 border-b border-zinc-200/60 dark:border-white/5">
                    <span className="text-zinc-600 dark:text-zinc-400">Primary Auth Provider</span>
                    <span className="font-semibold text-zinc-950 dark:text-white flex items-center gap-1">
                      {selectedUser.authMethod}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-zinc-200/60 dark:border-white/5">
                    <span className="text-zinc-600 dark:text-zinc-400">WebAuthn / Passkeys</span>
                    <span className="font-semibold text-zinc-950 dark:text-white">
                      {selectedUser.user?.hasPasskey
                        ? `${selectedUser.user?.passkeyCount} Passkey(s) Enrolled`
                        : 'None registered'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-zinc-200/60 dark:border-white/5">
                    <span className="text-zinc-600 dark:text-zinc-400">Two-Factor Authentication (2FA)</span>
                    <span className={selectedUser.user?.twoFactorEnabled ? 'text-emerald-500 font-semibold' : 'text-zinc-400'}>
                      {selectedUser.user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-zinc-600 dark:text-zinc-400">Active Token Sessions</span>
                    <span className="font-mono font-bold text-zinc-950 dark:text-white">
                      {selectedUser.activeTokensCount ?? (selectedUser.status === 'ACTIVE_SESSION' ? 1 : 0)} Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact & Demographics */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Contact & Demographics
                </h4>
                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Email Address</span>
                    <div className="mt-0.5 text-zinc-950 dark:text-white font-mono flex items-center gap-1 truncate">
                      <span className="truncate">{selectedUser.user?.email || 'Not shared'}</span>
                      {selectedUser.user?.isEmailVerified && (
                        <span title="Email Verified"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /></span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 block">Phone Number</span>
                    <div className="mt-0.5 text-zinc-950 dark:text-white font-mono flex items-center gap-1">
                      <span>{selectedUser.user?.phone || 'Not provided'}</span>
                      {selectedUser.user?.isPhoneVerified && (
                        <span title="Phone Verified"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /></span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 block">Location</span>
                    <div className="mt-0.5 text-zinc-700 dark:text-zinc-300">
                      {selectedUser.user?.city
                        ? `${selectedUser.user.city}, ${selectedUser.user.country || 'Global'}`
                        : selectedUser.user?.country || 'Global'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-400 block">Last Active</span>
                    <div className="mt-0.5 text-zinc-700 dark:text-zinc-300 font-mono">
                      {new Date(selectedUser.lastLogin || selectedUser.updatedAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* OAuth Consent & Scopes */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Granted Authorization Scopes
                </h4>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.scopes?.map((scope: string) => (
                      <span
                        key={scope}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-400 pt-1">
                    Authorized to access identity claims under OIDC RFC 6749.
                  </p>
                </div>
              </div>

              {/* Danger Zone: App Actions */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Application Control & Danger Zone</span>
                </h4>
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-950 dark:text-white">Revoke Active Session</div>
                      <div className="text-[11px] text-zinc-400">Invalidates live access & refresh tokens</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeUserSession(selectedUser.userId, selectedUser.user?.name || 'User')}
                      disabled={revokingUserId === selectedUser.userId}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold transition-colors disabled:opacity-50"
                    >
                      {revokingUserId === selectedUser.userId ? 'Revoking...' : 'Revoke Tokens'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-rose-500/10 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-950 dark:text-white">
                        {selectedUser.isSuspended ? 'Restore Application Access' : 'Suspend User from App'}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        App-scoped lock. User cannot log in to this app.
                      </div>
                    </div>
                    {selectedUser.isSuspended ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await handleUnsuspendUser(selectedUser.userId);
                          if (ok) {
                            setSelectedUser((prev: any) =>
                              prev ? { ...prev, isSuspended: false, status: 'SESSION_EXPIRED' } : null
                            );
                          }
                        }}
                        disabled={suspendingUserId === selectedUser.userId}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold transition-colors"
                      >
                        Unsuspend
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSuspendingTarget(selectedUser)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold transition-colors"
                      >
                        Suspend User
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-rose-500/10 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-rose-600 dark:text-rose-400">Delete User from App</div>
                      <div className="text-[11px] text-zinc-400">
                        Removes OAuth authorization. Global 180 Profile remains safe.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeletingTarget(selectedUser)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                    >
                      Delete Access
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. SUSPEND CONFIRMATION MODAL ───────────────────────────────────── */}
      {suspendingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-950 dark:text-white">Suspend User Access?</h4>
                <p className="text-xs text-zinc-500">
                  {suspendingTarget.user?.name} (@{suspendingTarget.user?.appScopedUsername || suspendingTarget.user?.username})
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This action will revoke all current active tokens and block this user from authenticating into{' '}
              <strong>{project?.name || 'this app'}</strong>. Their global 180 Profile remains completely unaffected.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Reason for Suspension (Optional)
              </label>
              <textarea
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g., Violation of application terms of service"
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-rose-500"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuspendingTarget(null);
                  setSuspensionReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSuspend}
                disabled={suspendingUserId === suspendingTarget.userId}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5"
              >
                {suspendingUserId === suspendingTarget.userId && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Confirm Suspension</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. DELETE / REMOVE CONFIRMATION MODAL ────────────────────────────── */}
      {deletingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-950 dark:text-white">Delete User from App?</h4>
                <p className="text-xs text-zinc-500">
                  {deletingTarget.user?.name} (@{deletingTarget.user?.appScopedUsername || deletingTarget.user?.username})
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>App-Scoped Deletion:</strong> This action permanently disconnects this user from your application, removes their OAuth consent, and revokes all tokens. Their global 180 Profile and data in other applications remain 100% safe.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={deletingUserId === deletingTarget.userId}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5"
              >
                {deletingUserId === deletingTarget.userId && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Delete from App</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IdentityUsersView;
