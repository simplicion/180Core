'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Layers,
  DollarSign,
  ArrowDownToLine,
  Clock,
  Wallet,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Download,
  AlertCircle,
  Copy,
  Check,
  BadgeCheck,
  CreditCard,
  Key,
  Webhook,
  Globe,
  Sliders,
  Receipt,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function DeveloperDetailClient({ developerId }: { developerId: string }) {
  const router = useRouter();

  const [developer, setDeveloper] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-refresh interval (0 = off, 10000 = 10s, 30000 = 30s)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());

  // Filters for projects
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Filters for payouts
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'>('ALL');

  // Payout actions modal state
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [modalType, setModalType] = useState<'SETTLE' | 'REJECT' | null>(null);
  const [utrReference, setUtrReference] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('Detected suspicious activity violating platform integrity and operational policies.');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (developerId) {
      loadDeveloperDetails();
    }
  }, [developerId]);

  useEffect(() => {
    if (!autoRefreshInterval || !developerId) return;
    const timer = setInterval(() => {
      loadDeveloperDetails(true);
    }, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, developerId]);

  const loadDeveloperDetails = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await adminApi.getDeveloper(developerId);
      if (res.success) {
        setDeveloper(res.developer || res.data?.developer || res.data || null);
        setLastSyncedTime(new Date());
      } else if (!isSilent) {
        toast.error(res.error || 'Failed to load developer profile');
      }
    } catch (err: any) {
      console.error('Failed to load developer', err);
      if (!isSilent) toast.error(err.message || 'Error fetching developer details');
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeveloperDetails();
    toast.success('Telemetry refreshed');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleVerify = async () => {
    if (!developer) return;
    try {
      const nextState = !developer.isVerified;
      const res = await adminApi.verifyDeveloper(developer.id, nextState);
      if (res.success) {
        toast.success(`Developer KYC set to ${nextState ? 'VERIFIED' : 'UNVERIFIED'}`);
        setDeveloper((prev: any) => ({ ...prev, isVerified: nextState }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update verification status');
    }
  };

  const handleToggleWalletLock = async () => {
    if (!developer) return;
    try {
      const nextLocked = !developer.stats?.isWalletLocked;
      const res = await adminApi.lockDeveloperWallet(developer.id, nextLocked);
      if (res.success) {
        toast.success(`Developer wallet ${nextLocked ? 'LOCKED' : 'UNLOCKED'}`);
        setDeveloper((prev: any) => ({
          ...prev,
          stats: { ...prev.stats, isWalletLocked: nextLocked },
        }));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wallet lock');
    }
  };

  const handleToggleProjectStatus = async (projectId: string, currentActive: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const nextActive = !currentActive;
      const res = await adminApi.toggleAppStatus(projectId, nextActive);
      if (res.success) {
        toast.success(`Project status set to ${nextActive ? 'ACTIVE' : 'SUSPENDED'}`);
        setDeveloper((prev: any) => {
          if (!prev) return prev;
          const updatedProjects = prev.projects?.map((p: any) =>
            p.id === projectId ? { ...p, isActive: nextActive } : p
          );
          return {
            ...prev,
            projects: updatedProjects,
            stats: {
              ...prev.stats,
              activeProjects: updatedProjects?.filter((p: any) => p.isActive).length,
              activeApps: updatedProjects?.filter((p: any) => p.isActive).length,
            },
          };
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project status');
    }
  };

  const handleApprovePayout = async (payoutId: string) => {
    try {
      const res = await adminApi.approvePayout(payoutId, 'Approved by super admin');
      if (res.success) {
        toast.success('Payout request marked as APPROVED');
        loadDeveloperDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve payout');
    }
  };

  const handleSettlePayoutSubmit = async () => {
    if (!selectedPayout || !utrReference.trim()) {
      toast.error('Bank UTR or Transfer Reference is required');
      return;
    }
    try {
      setSubmittingAction(true);
      const res = await adminApi.settlePayout(selectedPayout.id, {
        transactionRef: utrReference.trim(),
        adminNote: adminNote.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Payout settled successfully! UTR: ${utrReference.trim()}`);
        setModalType(null);
        setSelectedPayout(null);
        setUtrReference('');
        setAdminNote('');
        loadDeveloperDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to settle payout');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectPayoutSubmit = async () => {
    if (!selectedPayout || !adminNote.trim()) {
      toast.error('Reason for rejecting payout is required');
      return;
    }
    try {
      setSubmittingAction(true);
      const res = await adminApi.rejectPayout(selectedPayout.id, adminNote.trim());
      if (res.success) {
        toast.success('Payout request rejected');
        setModalType(null);
        setSelectedPayout(null);
        setAdminNote('');
        loadDeveloperDetails();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject payout');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!developer) return;
    const target = developer;
    const targetReason = deleteReason;

    // 1. Instantly close modal and navigate back to /developers (0ms delay)
    setShowDeleteModal(false);
    toast.loading(`⚡ Deleting "${target.name || target.email}" in background queue...`, {
      id: `del-${target.id}`,
    });
    router.push('/developers');

    // 2. Fire background request to queue
    try {
      const res = await adminApi.deleteDeveloper(target.id, targetReason);
      if (res.success) {
        toast.success(
          `User "${target.name || target.email}" queued for permanent purge. Running in background.`,
          { id: `del-${target.id}`, duration: 5000 }
        );
      }
    } catch (err: any) {
      toast.error(`Background deletion notice: ${err.message || 'Operation failed'}`, {
        id: `del-${target.id}`,
      });
    }
  };

  const handleExportProjectsCsv = () => {
    if (!developer?.projects?.length) {
      toast.error('No projects to export');
      return;
    }
    const rows = developer.projects.map((p: any) => ({
      ProjectID: p.id,
      Name: p.name,
      ClientID: p.clientId,
      Status: p.isActive ? 'ACTIVE' : 'SUSPENDED',
      ServicesInUse: p.servicesList?.join('; ') || '',
      TotalGmvUSD: p.totalGmv || 0,
      WalletBalanceUSD: p.walletBalance || 0,
      PayoutsRequestedUSD: p.totalPayoutsRequested || 0,
      CreatedAt: new Date(p.createdAt).toLocaleDateString(),
    }));
    exportToCsv(`${developer.name || 'developer'}_projects`, rows);
    toast.success('Exported projects list to CSV');
  };

  const handleExportPayoutsCsv = () => {
    if (!developer?.allPayouts?.length) {
      toast.error('No payout requests to export');
      return;
    }
    const rows = developer.allPayouts.map((p: any) => ({
      PayoutID: p.id,
      Project: p.app?.name || 'N/A',
      AmountUSD: p.amount || 0,
      Currency: p.currency || 'USD',
      Method: p.payoutMethod || 'BANK_TRANSFER',
      Status: p.status,
      TransactionRef: p.transactionRef || '',
      RequestedAt: new Date(p.requestedAt).toISOString(),
    }));
    exportToCsv(`${developer.name || 'developer'}_payout_ledger`, rows);
    toast.success('Exported payout requests to CSV');
  };

  const handleExportFullDossierCsv = () => {
    if (!developer) return;
    const summaryRow = [
      {
        DeveloperName: developer.name,
        Email: developer.email,
        Phone: developer.phone || 'N/A',
        KYCVerified: developer.isVerified ? 'YES' : 'NO',
        WalletStatus: developer.stats?.isWalletLocked ? 'LOCKED' : 'ACTIVE',
        TotalProjects: developer.stats?.totalProjects || 0,
        ActiveProjects: developer.stats?.activeProjects || 0,
        TotalGMVCollectedUSD: developer.stats?.totalPaymentsCollected || 0,
        TotalPayoutsRequestedUSD: developer.stats?.totalPayoutsRequested || 0,
        PendingPayoutsAmountUSD: developer.stats?.pendingPayoutsAmount || 0,
        SovereignWalletEscrowUSD: developer.stats?.totalWalletBalance || 0,
      },
    ];
    exportToCsv(`${developer.name || 'developer'}_executive_dossier`, summaryRow);
    toast.success('Exported developer executive dossier to CSV');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-6 w-32 bg-zinc-200 dark:bg-white/10 rounded-lg animate-pulse" />
        <div className="h-32 bg-zinc-100 dark:bg-white/5 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-100 dark:bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-zinc-100 dark:bg-white/5 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!developer) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Developer Not Found</h2>
        <p className="text-xs text-zinc-500">
          The requested developer account does not exist or has been removed from the platform.
        </p>
        <Link
          href="/developers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Developer Directory
        </Link>
      </div>
    );
  }

  const filteredProjects = (developer.projects || []).filter((p: any) => {
    const matchesSearch =
      projectSearch === '' ||
      p.name?.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.clientId?.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.id?.toLowerCase().includes(projectSearch.toLowerCase());

    const matchesStatus =
      projectStatusFilter === 'ALL' ||
      (projectStatusFilter === 'ACTIVE' && p.isActive !== false) ||
      (projectStatusFilter === 'SUSPENDED' && p.isActive === false);

    return matchesSearch && matchesStatus;
  });

  const filteredPayouts = (developer.allPayouts || []).filter((p: any) => {
    if (payoutStatusFilter === 'ALL') return true;
    if (payoutStatusFilter === 'PENDING') return ['PENDING_REVIEW', 'PENDING', 'PROCESSING'].includes(p.status);
    if (payoutStatusFilter === 'APPROVED') return p.status === 'APPROVED';
    if (payoutStatusFilter === 'PAID') return ['PAID', 'SETTLED'].includes(p.status);
    if (payoutStatusFilter === 'REJECTED') return p.status === 'REJECTED';
    return true;
  });

  const stats = developer.stats || {
    totalProjects: developer.projects?.length || 0,
    activeProjects: developer.projects?.filter((p: any) => p.isActive).length || 0,
    activeApps: developer.projects?.filter((p: any) => p.isActive).length || 0,
    totalPaymentsCollected: 0,
    totalPaymentsCount: 0,
    totalPayoutsRequested: 0,
    pendingPayoutsAmount: 0,
    settledPayoutsAmount: 0,
    totalPayoutsCount: 0,
    pendingPayoutsCount: 0,
    totalWalletBalance: 0,
    isWalletLocked: false,
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Back button & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/developers"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Developer Directory
        </Link>

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
            <span>Refresh Telemetry</span>
          </button>

          <button
            onClick={handleExportFullDossierCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Dossier</span>
          </button>

          <a
            href="http://localhost:3008/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Inspect Dev Portal</span>
          </a>
        </div>
      </div>

      {/* Developer Profile Hero Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg shadow-blue-500/20 shrink-0">
              {developer.name ? developer.name.slice(0, 2).toUpperCase() : 'DV'}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                  {developer.name || 'Anonymous Developer'}
                </h1>
                {developer.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified KYC
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    stats.isWalletLocked
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}
                >
                  {stats.isWalletLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {stats.isWalletLocked ? 'Wallet Locked' : 'Wallet Active'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span className="font-mono text-zinc-600 dark:text-zinc-400">{developer.email}</span>
                {developer.phone && <span>• {developer.phone}</span>}
                {developer.company && <span>• {developer.company}</span>}
                <span>• Joined {new Date(developer.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-mono text-zinc-400">ID: {developer.id}</span>
                <button
                  onClick={() => copyToClipboard(developer.id, 'devId')}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {copiedId === 'devId' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Administrative Toggle Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleToggleVerify}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                developer.isVerified
                  ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20'
                  : 'bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/20'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{developer.isVerified ? 'Mark Unverified' : 'Mark Verified (KYC)'}</span>
            </button>

            <button
              onClick={handleToggleWalletLock}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-2 ${
                stats.isWalletLocked
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20'
              }`}
            >
              {stats.isWalletLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              <span>{stats.isWalletLocked ? 'Unlock Sovereign Wallet' : 'Lock Sovereign Wallet'}</span>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Top Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Active Apps / Projects */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Active Projects</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white">
            {stats.activeProjects}
            <span className="text-xs font-semibold text-zinc-400 font-sans ml-1.5">
              / {stats.totalProjects} Total
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>{stats.totalProjects > 0 ? Math.round((stats.activeProjects / stats.totalProjects) * 100) : 0}% active fleet</span>
          </div>
        </div>

        {/* Metric 2: Total Payments Collected (GMV) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Total Collected (GMV)</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white">
            ${(stats.totalPaymentsCollected || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.totalPaymentsCount || 0} successful customer checkouts
          </div>
        </div>

        {/* Metric 3: Total Payouts Requested */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Total Payouts Requested</span>
            <ArrowDownToLine className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            ${(stats.totalPayoutsRequested || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500">
            {stats.totalPayoutsCount || 0} payout requests submitted
          </div>
        </div>

        {/* Metric 4: Pending Payout Requests */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Pending Payouts</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            ${(stats.pendingPayoutsAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
            {stats.pendingPayoutsCount || 0} awaiting settlement
          </div>
        </div>

        {/* Metric 5: Sovereign Wallet Escrow */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-medium">Sovereign Wallet Escrow</span>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            ${(stats.totalWalletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          {stats.pendingPayoutsAmount > 0 ? (
            <div
              className={`text-[11px] font-semibold flex items-center gap-1 ${
                stats.totalWalletBalance >= stats.pendingPayoutsAmount
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>
                {stats.totalWalletBalance >= stats.pendingPayoutsAmount
                  ? '100% Solvency Covered'
                  : 'Escrow Deficit Warning'}
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500">Available developer funds</div>
          )}
        </div>
      </div>

      {/* Projects & Applications Fleet Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
              <span>Developer Registered Projects</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
                {developer.projects?.length || 0} Projects
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select any project to inspect live payment logs, volume charts, enabled services, and payout requests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search project name, client ID..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-56"
              />
            </div>

            <select
              value={projectStatusFilter}
              onChange={(e: any) => setProjectStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Projects</option>
              <option value="SUSPENDED">Suspended Projects</option>
            </select>

            <button
              onClick={handleExportProjectsCsv}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Projects Cards Grid */}
        {filteredProjects.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 text-center text-xs text-zinc-500">
            No projects found matching current criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project: any) => (
              <div
                key={project.id}
                onClick={() => router.push(`/developers/${developer.id}/projects/${project.id}`)}
                className="group relative p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 hover:border-blue-500/50 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
                        {project.name?.slice(0, 2).toUpperCase() || 'PR'}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white group-hover:text-blue-500 transition-colors flex items-center gap-1.5">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 mt-0.5">
                          <span>{project.clientId}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleToggleProjectStatus(project.id, project.isActive !== false, e)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors shrink-0 ${
                        project.isActive !== false
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20'
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20'
                      }`}
                    >
                      {project.isActive !== false ? 'ACTIVE' : 'SUSPENDED'}
                    </button>
                  </div>

                  {/* Project Services In Use */}
                  <div className="mt-5 space-y-2">
                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Services in Use:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {project.servicesList && project.servicesList.length > 0 ? (
                        project.servicesList.map((svc: string) => (
                          <span
                            key={svc}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/5"
                          >
                            {svc.includes('Pay') && <CreditCard className="h-3 w-3 text-emerald-500" />}
                            {svc.includes('Identity') && <Key className="h-3 w-3 text-blue-500" />}
                            {svc.includes('Wallet') && <Wallet className="h-3 w-3 text-emerald-500" />}
                            {svc.includes('Webhook') && <Webhook className="h-3 w-3 text-purple-500" />}
                            {svc.includes('BYOG') && <Sliders className="h-3 w-3 text-amber-500" />}
                            {svc.includes('Domain') && <Globe className="h-3 w-3 text-indigo-500" />}
                            {svc.includes('Subscriptions') && <Receipt className="h-3 w-3 text-cyan-500" />}
                            <span>{svc}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-zinc-400 italic">No services configured yet</span>
                      )}
                    </div>
                  </div>

                  {/* Project Financial Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-2.5 mt-5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-400">Payments Collected</div>
                      <div className="font-bold font-mono text-zinc-900 dark:text-white text-sm mt-0.5">
                        ${(project.totalGmv || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-zinc-500">{project.paymentsCount || 0} checkouts</div>
                    </div>

                    <div>
                      <div className="text-[10px] text-zinc-400">Wallet Balance</div>
                      <div className="font-bold font-mono text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                        ${(project.walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {project.payoutsCount || 0} payout requests
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Button */}
                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-500">
                  <span>View Project Details & Live Logs</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Developer Payout Requests & Settlement Desk Ledger */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden space-y-4 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/10">
          <div>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-indigo-500" />
              Developer Payout Requests & Settlement Desk
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                {filteredPayouts.length} / {developer.allPayouts?.length || 0} Requests
              </span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Monitor, approve, and settle bank transfer payouts requested by this developer.
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
                  <th className="py-3 px-4 font-medium">Project</th>
                  <th className="py-3 px-4 font-medium">Amount</th>
                  <th className="py-3 px-4 font-medium">Method</th>
                  <th className="py-3 px-4 font-medium">Account Details</th>
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
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {payout.projectName || 'Project'}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400">{payout.projectClientId}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-white">
                        {payout.currency || 'USD'} {Number(payout.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/5">
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
                                  setModalType('SETTLE');
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                              >
                                Settle (UTR)
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setModalType('REJECT');
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
                                setModalType('SETTLE');
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

      {/* Settle Payout Modal Dialog */}
      {modalType === 'SETTLE' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Settle Payout Transfer
              </h3>
              <button
                onClick={() => setModalType(null)}
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
              <div className="flex justify-between">
                <span className="text-zinc-500">Project:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{selectedPayout.projectName}</span>
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
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction || !utrReference.trim()}
                onClick={handleSettlePayoutSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                {submittingAction ? 'Settling...' : 'Confirm Bank Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payout Modal Dialog */}
      {modalType === 'REJECT' && selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <XCircle className="h-5 w-5 text-rose-500" />
                Reject Payout Request
              </h3>
              <button
                onClick={() => setModalType(null)}
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
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction || !adminNote.trim()}
                onClick={handleRejectPayoutSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
              >
                {submittingAction ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Account Deletion Modal (Suspicious Activity Policy) */}
      {showDeleteModal && developer && (
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
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/80 dark:border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Developer / User:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {developer.name || 'Anonymous Developer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Email:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {developer.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Registered Projects:</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                  {developer.projects?.length || 0} Apps
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
                onClick={() => setShowDeleteModal(false)}
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
