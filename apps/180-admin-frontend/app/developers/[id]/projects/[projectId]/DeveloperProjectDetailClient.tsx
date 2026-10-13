'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  DollarSign,
  ArrowDownToLine,
  Wallet,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  CreditCard,
  Webhook,
  Globe,
  Sliders,
  Receipt,
  Search,
  Filter,
  Eye,
  RotateCw,
  BadgeCheck,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function DeveloperProjectDetailClient({
  developerId: propDevId,
  projectId: propProjectId,
}: {
  developerId?: string;
  projectId?: string;
} = {}) {
  const params = useParams();
  const router = useRouter();
  const developerId = propDevId || (params?.id as string);
  const projectId = propProjectId || (params?.projectId as string);

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-refresh interval (0 = off, 10000 = 10s, 30000 = 30s)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());

  // Chart range filter
  const [timeRangeFilter, setTimeRangeFilter] = useState<'7D' | '14D' | '30D'>('30D');

  // Live payment logs filter & search
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'CAPTURED' | 'PENDING' | 'FAILED'>('ALL');
  const [sessionModeFilter, setSessionModeFilter] = useState<'ALL' | 'payment' | 'subscription'>('ALL');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Payout actions & filter state
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'>('ALL');
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [payoutModalType, setPayoutModalType] = useState<'SETTLE' | 'REJECT' | null>(null);
  const [utrReference, setUtrReference] = useState('');
  const [payoutAdminNote, setPayoutAdminNote] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Project Switcher dropdown state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Rotating secret state
  const [isRotatingSecret, setIsRotatingSecret] = useState(false);

  // Chart hover state
  const [hoveredDataPoint, setHoveredDataPoint] = useState<any | null>(null);

  useEffect(() => {
    if (developerId && projectId) {
      loadProjectDetails();
    }
  }, [developerId, projectId]);

  useEffect(() => {
    if (!autoRefreshInterval || !developerId || !projectId) return;
    const timer = setInterval(() => {
      loadProjectDetails(true);
    }, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, developerId, projectId]);

  // Payment graph time horizon calculation (placed at top level before early returns to strictly adhere to React Rules of Hooks)
  const displayedPaymentGraph = React.useMemo(() => {
    const raw = data?.paymentGraph || [];
    if (timeRangeFilter === '7D') return raw.slice(-7);
    if (timeRangeFilter === '14D') return raw.slice(-14);
    return raw;
  }, [data?.paymentGraph, timeRangeFilter]);

  const rangeStats = React.useMemo(() => {
    if (!displayedPaymentGraph.length) return { total: 0, count: 0, avg: 0, peak: 0 };
    const total = displayedPaymentGraph.reduce((sum: number, pt: any) => sum + (pt.volume || 0), 0);
    const count = displayedPaymentGraph.reduce((sum: number, pt: any) => sum + (pt.count || 0), 0);
    const avg = total / displayedPaymentGraph.length;
    const peak = Math.max(...displayedPaymentGraph.map((pt: any) => pt.volume || 0), 0);
    return {
      total: Math.round(total * 100) / 100,
      count,
      avg: Math.round(avg * 100) / 100,
      peak: Math.round(peak * 100) / 100,
    };
  }, [displayedPaymentGraph]);

  const loadProjectDetails = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await adminApi.getDeveloperProject(developerId, projectId);
      if (res.success) {
        setData(res.data || res);
        setLastSyncedTime(new Date());
      } else if (!isSilent) {
        toast.error(res.error || 'Failed to load project telemetry');
      }
    } catch (err: any) {
      console.error('Failed to load project details', err);
      if (!isSilent) toast.error(err.message || 'Error fetching project details');
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProjectDetails();
    toast.success('Live telemetry refreshed');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleProjectStatus = async () => {
    if (!data?.project) return;
    try {
      const nextActive = !data.project.isActive;
      const res = await adminApi.toggleAppStatus(data.project.id, nextActive);
      if (res.success) {
        toast.success(`Project set to ${nextActive ? 'ACTIVE' : 'SUSPENDED'}`);
        setData((prev: any) => ({
          ...prev,
          project: { ...prev.project, isActive: nextActive },
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle project status');
    }
  };

  const handleRotateSecret = async () => {
    if (!data?.project) return;
    if (!window.confirm('Are you sure you want to rotate this application client secret? Previous credentials will stop working.')) {
      return;
    }
    try {
      setIsRotatingSecret(true);
      const res = await adminApi.rotateAppSecret(data.project.id);
      if (res.success) {
        toast.success('Client secret rotated successfully!');
        if (res.secretHint) {
          setData((prev: any) => ({
            ...prev,
            project: { ...prev.project, clientSecretHint: res.secretHint },
          }));
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to rotate client secret');
    } finally {
      setIsRotatingSecret(false);
    }
  };

  const handleApprovePayout = async (payoutId: string) => {
    try {
      const res = await adminApi.approvePayout(payoutId, 'Approved by super admin');
      if (res.success) {
        toast.success('Payout marked as APPROVED');
        loadProjectDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve payout');
    }
  };

  const handleSettlePayoutSubmit = async () => {
    if (!selectedPayout || !utrReference.trim()) {
      toast.error('Bank UTR Reference is required');
      return;
    }
    try {
      setSubmittingPayout(true);
      const res = await adminApi.settlePayout(selectedPayout.id, {
        transactionRef: utrReference.trim(),
        adminNote: payoutAdminNote.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Payout settled! UTR: ${utrReference.trim()}`);
        setPayoutModalType(null);
        setSelectedPayout(null);
        setUtrReference('');
        setPayoutAdminNote('');
        loadProjectDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to settle payout');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleRejectPayoutSubmit = async () => {
    if (!selectedPayout || !payoutAdminNote.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    try {
      setSubmittingPayout(true);
      const res = await adminApi.rejectPayout(selectedPayout.id, payoutAdminNote.trim());
      if (res.success) {
        toast.success('Payout rejected');
        setPayoutModalType(null);
        setSelectedPayout(null);
        setPayoutAdminNote('');
        loadProjectDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject payout');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleExportSessionsCsv = () => {
    if (!data?.livePaymentLogs?.length) {
      toast.error('No payment logs to export');
      return;
    }
    const rows = data.livePaymentLogs.map((s: any) => ({
      SessionID: s.id,
      CustomerEmail: s.user?.email || s.metadata?.customerEmail || 'Guest Customer',
      CustomerName: s.user?.name || '',
      Title: s.title || 'Checkout',
      Mode: s.mode || 'payment',
      Amount: s.amount || 0,
      Currency: s.currency || 'USD',
      Status: s.status,
      Gateway: data.project?.customGatewayType && data.project.customGatewayType !== 'NONE'
        ? `BYOG (${data.project.customGatewayType})`
        : '180 Pay Gateway',
      CreatedAt: new Date(s.createdAt).toISOString(),
    }));
    exportToCsv(`${data.project?.name || 'project'}_payment_logs`, rows);
    toast.success('Exported payment logs to CSV');
  };

  const handleExportPayoutsCsv = () => {
    if (!data?.payoutRequests?.length) {
      toast.error('No payout requests to export');
      return;
    }
    const rows = data.payoutRequests.map((p: any) => ({
      PayoutID: p.id,
      Amount: p.amount || 0,
      Currency: p.currency || 'USD',
      Method: p.payoutMethod || 'BANK_TRANSFER',
      Status: p.status,
      TransactionRef: p.transactionRef || '',
      RequestedAt: new Date(p.requestedAt).toISOString(),
    }));
    exportToCsv(`${data.project?.name || 'project'}_payouts`, rows);
    toast.success('Exported project payouts to CSV');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-6 w-36 bg-zinc-200 dark:bg-white/10 rounded-lg animate-pulse" />
        <div className="h-32 bg-zinc-100 dark:bg-white/5 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-100 dark:bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-zinc-100 dark:bg-white/5 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Project Not Found</h2>
        <p className="text-xs text-zinc-500">
          The requested project does not exist under this developer account.
        </p>
        <Link
          href={`/developers/${developerId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Developer Profile
        </Link>
      </div>
    );
  }

  const { project, developer, allProjects, stats, services, livePaymentLogs, paymentGraph, payoutRequests } = data;

  // Filter live payment sessions
  const filteredSessions = (livePaymentLogs || []).filter((s: any) => {
    const matchesSearch =
      sessionSearch === '' ||
      s.id?.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      s.title?.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      s.user?.email?.toLowerCase().includes(sessionSearch.toLowerCase()) ||
      s.metadata?.customerEmail?.toLowerCase().includes(sessionSearch.toLowerCase());

    const matchesStatus =
      sessionStatusFilter === 'ALL' ||
      (sessionStatusFilter === 'CAPTURED' && ['CAPTURED', 'COMPLETED', 'PAID'].includes(s.status)) ||
      (sessionStatusFilter === 'PENDING' && s.status === 'PENDING') ||
      (sessionStatusFilter === 'FAILED' && ['FAILED', 'EXPIRED', 'CANCELLED'].includes(s.status));

    const matchesMode =
      sessionModeFilter === 'ALL' || s.mode === sessionModeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  // Filter project payouts
  const filteredPayouts = (payoutRequests || []).filter((p: any) => {
    if (payoutStatusFilter === 'ALL') return true;
    if (payoutStatusFilter === 'PENDING') return ['PENDING_REVIEW', 'PENDING', 'PROCESSING'].includes(p.status);
    if (payoutStatusFilter === 'APPROVED') return p.status === 'APPROVED';
    if (payoutStatusFilter === 'PAID') return ['PAID', 'SETTLED'].includes(p.status);
    if (payoutStatusFilter === 'REJECTED') return p.status === 'REJECTED';
    return true;
  });

  // Calculate payment graph heights
  const graphPoints = displayedPaymentGraph;
  const maxVolume = Math.max(...graphPoints.map((p: any) => p.volume || 0), 10);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header: Navigation & Project Switcher Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/developers/${developerId}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors p-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Developer Profile</span>
          </Link>

          {/* Project Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 hover:border-blue-500/50 text-zinc-900 dark:text-white shadow-sm transition-all"
            >
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Switch Project:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{project.name}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSwitcherOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-3 py-1.5">
                  Developer Projects ({allProjects?.length || 0})
                </div>
                {allProjects?.map((p: any) => {
                  const isCurrent = p.id === project.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setIsSwitcherOpen(false);
                        router.push(`/developers/${developerId}/projects/${p.id}`);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                          : 'hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <div className="truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">{p.clientId}</div>
                      </div>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          p.isActive !== false
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {p.isActive !== false ? 'ACTIVE' : 'SUSP'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Auto-Sync Control */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-xs">
            <span className="text-zinc-400 font-medium">Auto-Sync:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent text-zinc-800 dark:text-zinc-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value={0}>Manual</option>
              <option value={10000}>Every 10s</option>
              <option value={30000}>Every 30s</option>
            </select>
            {autoRefreshInterval > 0 && (
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <button
            onClick={handleRefresh}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>Live Sync</span>
          </button>

          <button
            onClick={handleExportSessionsCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Logs</span>
          </button>

          <a
            href={`http://localhost:3008/dashboard/apps/${project.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open in Dev Console</span>
          </a>
        </div>
      </div>

      {/* Project Hero Identity Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg shadow-blue-500/20 shrink-0">
              {project.name?.slice(0, 2).toUpperCase() || 'PR'}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {project.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    project.isActive !== false
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  }`}
                >
                  {project.isActive !== false ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {project.isActive !== false ? 'PROJECT ACTIVE' : 'PROJECT SUSPENDED'}
                </span>
                {project.customGatewayType && project.customGatewayType !== 'NONE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    BYOG: {project.customGatewayType}
                  </span>
                )}
              </div>

              {/* Developer Owner info pill */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <Link
                  href={`/developers/${developer?.id || developerId}`}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <span>Owner: {developer?.name || 'Developer'}</span>
                  {developer?.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />}
                </Link>
                <span>• {developer?.email}</span>
                <span>• Created {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Client ID & Credentials hint */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                  <span className="text-zinc-400">Client ID:</span>
                  <span>{project.clientId}</span>
                  <button
                    onClick={() => copyToClipboard(project.clientId, 'clientId')}
                    className="ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                  >
                    {copiedKey === 'clientId' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>

                {project.clientSecretHint && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/5 font-mono text-[11px] text-zinc-500">
                    <span>Secret: {project.clientSecretHint}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleToggleProjectStatus}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                project.isActive !== false
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              {project.isActive !== false ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              <span>{project.isActive !== false ? 'Suspend Project' : 'Activate Project'}</span>
            </button>

            <button
              disabled={isRotatingSecret}
              onClick={handleRotateSecret}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-2"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRotatingSecret ? 'animate-spin' : ''}`} />
              <span>Rotate Secret</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Project KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Incoming GMV */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Total Incoming Payments</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
            ${(stats.totalGmv || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.successfulTransactions || 0} completed checkouts
          </div>
        </div>

        {/* Metric 2: Active Services & Components */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Active Services</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {stats.activeServicesCount}
            <span className="text-xs font-semibold text-zinc-400 font-sans ml-1">
              / {stats.totalServicesCount} Services
            </span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Pay, Identity, Wallet configured
          </div>
        </div>

        {/* Metric 3: Project Sovereign Wallet Balance */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Project Wallet Balance</span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            ${(stats.walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {stats.pendingPayoutsAmount > 0 ? (
            <div
              className={`text-[11px] font-semibold flex items-center gap-1 ${
                (stats.walletBalance || 0) >= stats.pendingPayoutsAmount
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>
                {(stats.walletBalance || 0) >= stats.pendingPayoutsAmount
                  ? '100% Solvency Covered'
                  : 'Escrow Deficit Warning'}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 font-mono">
              {stats.walletCurrency || 'USD'} Escrow
            </div>
          )}
        </div>

        {/* Metric 4: Payouts Requested from this Project */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Requested Payouts</span>
            <ArrowDownToLine className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            ${(stats.totalPayoutsRequested || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.payoutsCount || 0} total ({stats.pendingPayoutsCount || 0} pending)
          </div>
        </div>

        {/* Metric 5: Success & Conversion Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Checkout Success Rate</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
            {stats.successRate || 100}%
          </div>
          <div className="text-[11px] text-zinc-500">
            Avg Order: ${(stats.averageOrderValue || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Services Deep-Dive Matrix */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            Project Services & APIs In Use
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Active features, protocol endpoints, credentials, and telemetry routes configured for this project.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Service 1: 180 Pay Gateway */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <h4 className="font-bold text-xs text-zinc-900 dark:text-white">180 Pay Gateway</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  services.payGateway.isEnabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                }`}
              >
                {services.payGateway.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Checkout sessions, multi-currency processing, and automatic escrow collection.
            </p>
            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Gateway Type:</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {services.payGateway.byogActive ? `BYOG (${services.payGateway.customGatewayType})` : 'Standard 180 Pay'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Captured Sessions:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.payGateway.capturedSessionsCount}
                </span>
              </div>
            </div>
          </div>

          {/* Service 2: 180 Universal Identity */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Key className="h-4 w-4 text-blue-500" />
                <h4 className="font-bold text-xs text-zinc-900 dark:text-white">180 Identity (OAuth 2.0)</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  services.identityAuth.isEnabled
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                }`}
              >
                {services.identityAuth.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Universal SSO login, federated tokens, and passwordless authentication.
            </p>
            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Redirect URIs:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.identityAuth.redirectUris?.length || 0} registered
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Allowed Scopes:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.identityAuth.allowedScopes?.join(', ') || 'identity:read'}
                </span>
              </div>
            </div>
          </div>

          {/* Service 3: Sovereign Wallet & Settlement */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-emerald-500" />
                <h4 className="font-bold text-xs text-zinc-900 dark:text-white">Sovereign Wallet</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  services.sovereignWallet.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {services.sovereignWallet.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Non-custodial developer ledger, instant balance reflection, and payout settlements.
            </p>
            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Available Balance:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ${(services.sovereignWallet.balanceUsd || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Currency:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.sovereignWallet.currency}
                </span>
              </div>
            </div>
          </div>

          {/* Service 4: Webhooks & Event Streaming */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Webhook className="h-4 w-4 text-purple-500" />
                <h4 className="font-bold text-xs text-zinc-900 dark:text-white">Webhooks & Events</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  services.webhooks.isEnabled
                    ? 'bg-purple-500/10 text-purple-500'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                }`}
              >
                {services.webhooks.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate">
              {services.webhooks.endpointUrl || 'No webhook URL registered yet.'}
            </p>
            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Deliveries Tracked:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.webhooks.deliveriesCount} events
                </span>
              </div>
            </div>
          </div>

          {/* Service 5: Custom Pay Domain */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 text-indigo-500" />
                <h4 className="font-bold text-xs text-zinc-900 dark:text-white">Custom Pay Domain</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  services.customDomain.isEnabled
                    ? 'bg-indigo-500/10 text-indigo-500'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                }`}
              >
                {services.customDomain.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 truncate">
              {services.customDomain.domain || 'White-label checkout brand domain'}
            </p>
            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">DNS Resolution:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.customDomain.status}
                </span>
              </div>
            </div>
          </div>

          {/* Service 6: Subscriptions Engine */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Receipt className="h-4 w-4 text-cyan-500" />
                <h4 className="font-bold text-xs text-zinc-900 dark:text-white">Subscriptions Engine</h4>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  services.subscriptions.isEnabled
                    ? 'bg-cyan-500/10 text-cyan-500'
                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                }`}
              >
                {services.subscriptions.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Recurring billing plans, automated dunning, and subscriber lifecycle.
            </p>
            <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-400">Configured Plans:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {services.subscriptions.plansCount} plans
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Graph & Revenue Analytics Section */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Payment Graph & Revenue Trajectory ({timeRangeFilter === '7D' ? 'Last 7 Days' : timeRangeFilter === '14D' ? 'Last 14 Days' : 'Last 30 Days'})
              </h3>
              {/* Range tabs */}
              <div className="flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-[11px] font-semibold">
                {(['7D', '14D', '30D'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRangeFilter(r)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      timeRangeFilter === r
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
              <span>Period Volume: <strong className="text-zinc-900 dark:text-white font-mono">${rangeStats.total.toFixed(2)}</strong></span>
              <span>•</span>
              <span>Avg Daily: <strong className="text-zinc-900 dark:text-white font-mono">${rangeStats.avg.toFixed(2)}</strong></span>
              <span>•</span>
              <span>Peak Day: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">${rangeStats.peak.toFixed(2)}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-emerald-500 inline-block" />
              <span className="text-zinc-500">Captured Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-md bg-amber-500 inline-block" />
              <span className="text-zinc-500">Pending / In-Flight</span>
            </div>
          </div>
        </div>

        {/* Visual Revenue Bars Chart */}
        <div className="pt-4">
          <div className="relative h-56 flex items-end gap-1.5 sm:gap-2 px-2 pb-6 border-b border-zinc-100 dark:border-white/10">
            {graphPoints.map((point: any, idx: number) => {
              const successHeight = Math.max((point.successfulVolume / maxVolume) * 100, point.successfulVolume > 0 ? 6 : 2);
              const pendingHeight = Math.max((point.pendingVolume / maxVolume) * 100, point.pendingVolume > 0 ? 4 : 0);
              const isHovered = hoveredDataPoint?.date === point.date;

              return (
                <div
                  key={point.date}
                  onMouseEnter={() => setHoveredDataPoint(point)}
                  onMouseLeave={() => setHoveredDataPoint(null)}
                  className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 z-30 px-3 py-2 rounded-xl bg-zinc-900 text-white text-[10px] shadow-xl whitespace-nowrap pointer-events-none">
                      <div className="font-bold">{point.label}</div>
                      <div className="text-emerald-400 font-mono font-semibold">
                        Captured: ${point.successfulVolume.toFixed(2)}
                      </div>
                      {point.pendingVolume > 0 && (
                        <div className="text-amber-400 font-mono">
                          Pending: ${point.pendingVolume.toFixed(2)}
                        </div>
                      )}
                      <div className="text-zinc-400">{point.count} transactions</div>
                    </div>
                  )}

                  {/* Bars stack */}
                  <div className="w-full max-w-[24px] flex flex-col justify-end items-center gap-0.5">
                    {point.pendingVolume > 0 && (
                      <div
                        style={{ height: `${pendingHeight}%` }}
                        className="w-full rounded-t-sm bg-amber-500/80 transition-all group-hover:bg-amber-400"
                      />
                    )}
                    <div
                      style={{ height: `${successHeight}%` }}
                      className={`w-full rounded-t-sm transition-all ${
                        point.successfulVolume > 0
                          ? 'bg-emerald-500 group-hover:bg-emerald-400 shadow-sm'
                          : 'bg-zinc-200 dark:bg-white/10'
                      }`}
                    />
                  </div>

                  {/* Label for every 5th item */}
                  {idx % 5 === 0 && (
                    <span className="absolute top-full mt-2 text-[9px] font-mono text-zinc-400 whitespace-nowrap">
                      {point.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-3">
            <span>30 days ago</span>
            <span>Hover on any bar for breakdown</span>
            <span>Today (Live)</span>
          </div>
        </div>
      </div>

      {/* Live Payment Logs Section */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/10">
          <div>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-500" />
              Live Payment Logs & Stream
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                {filteredSessions.length} / {livePaymentLogs?.length || 0} Sessions
              </span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Real-time payment sessions initiated and captured for this project.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search session ID, customer..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none w-52"
              />
            </div>

            <select
              value={sessionStatusFilter}
              onChange={(e: any) => setSessionStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="CAPTURED">Captured / Paid</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed / Cancelled</option>
            </select>

            <select
              value={sessionModeFilter}
              onChange={(e: any) => setSessionModeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">All Modes</option>
              <option value="payment">One-Time Payment</option>
              <option value="subscription">Subscription</option>
            </select>

            <button
              onClick={handleExportSessionsCsv}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Sessions Table */}
        {filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            No checkout transactions recorded for this project yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3 px-4 font-medium">Session ID</th>
                  <th className="py-3 px-4 font-medium">Customer</th>
                  <th className="py-3 px-4 font-medium">Title / Mode</th>
                  <th className="py-3 px-4 font-medium">Amount</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Date & Time</th>
                  <th className="py-3 px-4 font-medium text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {filteredSessions.map((session: any) => {
                  const customerEmail = session.user?.email || session.metadata?.customerEmail || 'Guest Customer';
                  const isSuccess = ['CAPTURED', 'COMPLETED', 'PAID'].includes(session.status);

                  return (
                    <tr key={session.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.01]">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <span>#{session.id.slice(0, 10)}</span>
                          <button
                            onClick={() => copyToClipboard(session.id, session.id)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            title="Copy full session ID"
                          >
                            {copiedKey === session.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-white truncate max-w-[180px]">
                          {customerEmail}
                        </div>
                        {session.user?.name && <div className="text-[10px] text-zinc-400">{session.user.name}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">{session.title || 'Checkout'}</div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-zinc-500">
                          {session.mode || 'payment'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        {session.currency || 'USD'} {Number(session.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : session.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                        {new Date(session.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedSession(session)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Project Payout Requests & Settlement Section */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/10">
          <div>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-indigo-500" />
              Project Settlement & Payout Requests
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                {filteredPayouts.length} / {payoutRequests?.length || 0} Requests
              </span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Payouts requested specifically from this project sovereign wallet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={payoutStatusFilter}
              onChange={(e: any) => setPayoutStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">All Payout Status</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Settled / Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <button
              onClick={handleExportPayoutsCsv}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Payouts</span>
            </button>
          </div>
        </div>

        {/* Payouts Table */}
        {!filteredPayouts || filteredPayouts.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            No payout requests match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3 px-4 font-medium">Payout ID</th>
                  <th className="py-3 px-4 font-medium">Amount</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium">Destination Account</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Requested At</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5">
                {filteredPayouts.map((payout: any) => {
                  const account = typeof payout.accountDetails === 'string'
                    ? JSON.parse(payout.accountDetails || '{}')
                    : payout.accountDetails || {};

                  return (
                    <tr key={payout.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.01]">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">
                        #{payout.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        {payout.currency || 'USD'} {Number(payout.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300">
                          {payout.payoutMethod || 'BANK_TRANSFER'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-zinc-600 dark:text-zinc-400">
                        {account.upiId ? (
                          <div>UPI: <span className="font-mono">{account.upiId}</span></div>
                        ) : account.accountNumber ? (
                          <div>
                            <span>A/C: ••••{String(account.accountNumber).slice(-4)}</span>
                            {account.ifsc && <span className="text-[10px] font-mono ml-1 text-zinc-400">({account.ifsc})</span>}
                          </div>
                        ) : (
                          <span className="italic text-zinc-400">Default Verified Account</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            payout.status === 'PAID' || payout.status === 'SETTLED'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : payout.status === 'APPROVED'
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : payout.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 text-[11px]">
                        {new Date(payout.requestedAt).toLocaleString()}
                        {payout.transactionRef && (
                          <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                            UTR: {payout.transactionRef}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(payout.status === 'PENDING_REVIEW' || payout.status === 'PENDING') && (
                            <>
                              <button
                                onClick={() => handleApprovePayout(payout.id)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setPayoutModalType('SETTLE');
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                              >
                                Settle (UTR)
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setPayoutModalType('REJECT');
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {payout.status === 'APPROVED' && (
                            <button
                              onClick={() => {
                                setSelectedPayout(payout);
                                setPayoutModalType('SETTLE');
                              }}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                            >
                              Settle (UTR)
                            </button>
                          )}
                          {(payout.status === 'PAID' || payout.status === 'SETTLED') && (
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Settled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Session Modal Dialog */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/10">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-500" />
                Session Deep Dive: #{selectedSession.id.slice(0, 12)}
              </h3>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5">
                <div>
                  <span className="text-zinc-400 text-[10px]">Amount:</span>
                  <div className="font-bold font-mono text-sm text-zinc-900 dark:text-white">
                    {selectedSession.currency || 'USD'} {Number(selectedSession.amount || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px]">Status:</span>
                  <div className="font-bold text-sm text-emerald-500">{selectedSession.status}</div>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px]">Mode:</span>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{selectedSession.mode || 'payment'}</div>
                </div>
                <div>
                  <span className="text-zinc-400 text-[10px]">Display UX:</span>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{selectedSession.displayMode || 'bottom_sheet'}</div>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-semibold">Metadata & Gateway Payload:</span>
                <pre className="mt-1 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedSession.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Payout Modal Dialog */}
      {payoutModalType === 'SETTLE' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Settle Payout Transfer
              </h3>
              <button
                onClick={() => setPayoutModalType(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Payout ID:</span>
                <span className="font-mono text-zinc-900 dark:text-white">#{selectedPayout.id.slice(0, 10)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {selectedPayout.currency || 'USD'} {Number(selectedPayout.amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Bank UTR / Transaction Reference Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR123498765432 or IMPS839210"
                  value={utrReference}
                  onChange={(e) => setUtrReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Admin Internal Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transferred via HDFC Corporate Banking"
                  value={payoutAdminNote}
                  onChange={(e) => setPayoutAdminNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPayoutModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={submittingPayout || !utrReference.trim()}
                onClick={handleSettlePayoutSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                {submittingPayout ? 'Settling...' : 'Confirm Bank Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payout Modal Dialog */}
      {payoutModalType === 'REJECT' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <XCircle className="h-5 w-5 text-rose-500" />
                Reject Payout Request
              </h3>
              <button
                onClick={() => setPayoutModalType(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Rejection Reason (will notify developer) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Invalid bank account IFSC code. Please update your settlement settings."
                  value={payoutAdminNote}
                  onChange={(e) => setPayoutAdminNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPayoutModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={submittingPayout || !payoutAdminNote.trim()}
                onClick={handleRejectPayoutSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
              >
                {submittingPayout ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
