'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { DeveloperAppDetail, PaymentAnalyticsData, BankDetailsData, PayoutRecord, WebhookTestResult } from '@/components/apps/types';

interface ProjectContextValue {
  project: DeveloperAppDetail | null;
  projectId: string;
  loading: boolean;
  refreshProject: () => Promise<void>;
  userProfile: any;
  allProjects: any[];
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (expanded: boolean) => void;
  // Shared state & actions
  enableAuth: boolean;
  setEnableAuth: (val: boolean) => void;
  enablePay: boolean;
  setEnablePay: (val: boolean) => void;
  saveSettings: (updates?: Partial<any>) => Promise<boolean>;
  saving: boolean;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  // Telemetry for Identity
  authLogs: { logs: any[]; totalUsers: number; activeSessionsCount: number } | null;
  loadingAuthLogs: boolean;
  fetchAuthLogs: () => Promise<void>;
  handleRevokeUserSession: (targetUserId: string, userName: string) => Promise<void>;
  revokingUserId: string | null;
  // Telemetry for Pay
  paymentAnalytics: PaymentAnalyticsData | null;
  loadingAnalytics: boolean;
  fetchPaymentAnalytics: () => Promise<void>;
  payoutBalance: number;
  payoutHistory: PayoutRecord[];
  loadingPayoutHistory: boolean;
  fetchPayoutHistory: () => Promise<void>;
  bankDetails: BankDetailsData | null;
  setBankDetails: (val: BankDetailsData | null) => void;
  // Webhook
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  webhookSecret: string;
  testResult: WebhookTestResult | null;
  isTestingWebhook: boolean;
  handleTestWebhook: () => Promise<void>;
  handleRotateWebhookSecret: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('180_access_token') ||
      document.cookie.match(/(?:^|;\s*)platform_auth_token=([^;]+)/)?.[1] ||
      null
    );
  } catch (_) {
    return null;
  }
};

export function ProjectProvider({
  children,
  projectId: propProjectId,
}: {
  children: React.ReactNode;
  projectId?: string;
}) {
  const params = useParams();
  const router = useRouter();

  const getInitialAppId = () => {
    if (propProjectId && propProjectId !== 'default') return propProjectId;
    const pId = params?.id as string;
    if (pId && pId !== 'default') return pId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/apps\/([^\/\?#]+)/);
      if (match && match[1] && match[1] !== 'default') return match[1];
    }
    return pId || '';
  };

  const [projectId, setProjectId] = useState<string>(getInitialAppId);
  const [project, setProject] = useState<DeveloperAppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Synchronize projectId with window location pathname and params.id on mount and route changes
  useEffect(() => {
    const currentId = getInitialAppId();
    if (currentId && currentId !== 'default' && currentId !== projectId) {
      setProjectId(currentId);
    }
  }, [params?.id, propProjectId]);

  // Watchdog timer: ensure loading state never hangs for more than 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [projectId]);

  // Identity states
  const [enableAuth, setEnableAuth] = useState(true);
  const [authLogs, setAuthLogs] = useState<{ logs: any[]; totalUsers: number; activeSessionsCount: number } | null>(null);
  const [loadingAuthLogs, setLoadingAuthLogs] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  // Pay states
  const [enablePay, setEnablePay] = useState(true);
  const [paymentAnalytics, setPaymentAnalytics] = useState<PaymentAnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [payoutBalance, setPayoutBalance] = useState<number>(0);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRecord[]>([]);
  const [loadingPayoutHistory, setLoadingPayoutHistory] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankDetailsData | null>(null);

  // Webhook states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const getApiBase = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch Project Details
  const refreshProject = useCallback(async () => {
    if (!projectId || projectId === 'default') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const apiBase = getApiBase();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }).catch(() => null);
      }

      clearTimeout(timeoutId);

      if (!res || !res.ok) {
        throw new Error('Failed to load project details');
      }

      const data = await res.json();
      const appData = data.app || data.data || data;
      setProject(appData);
      if (appData.bankDetails) {
        setBankDetails(appData.bankDetails);
      }
      setEnableAuth(appData.enableAuth ?? true);
      setEnablePay(appData.enablePay ?? true);
      setWebhookUrl(appData.webhookUrl || '');
      setWebhookSecret(appData.webhookSecret || '');
    } catch (err: any) {
      console.warn('[ProjectContext] Failed to load project:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Cross-app real-time revocation & immediate sign-out sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRevoked = (revokedClientId?: string) => {
      const lower = (revokedClientId || '').toLowerCase().trim();
      if (
        lower.includes('developer') ||
        lower === '180-developers-portal' ||
        lower === '180_developers_portal'
      ) {
        localStorage.removeItem('platform_auth_token');
        localStorage.removeItem('platform_refresh_token');
        localStorage.removeItem('180_access_token');
        localStorage.removeItem('user');
        document.cookie = 'platform_auth_token=; path=/; max-age=0;';
        window.dispatchEvent(new Event('180_SIGNOUT'));
        toast.error('Access for 180 Developers Console was revoked. Logged out.');
        router.push('/');
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('180_auth_sync');
        channel.onmessage = (e) => {
          if (e.data?.type === 'APP_REVOKED') {
            handleRevoked(e.data.clientId);
          }
        };
      } catch (_) {}
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === '180_revoked_app_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleRevoked(parsed.clientId);
        } catch (_) {}
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      try {
        channel?.close();
      } catch (_) {}
      window.removeEventListener('storage', onStorage);
    };
  }, [router]);

  // Fetch All Projects & User Profile
  const fetchAllProjectsAndProfile = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const apiBase = getApiBase();

      const userRes = await fetch(`${apiBase}/api/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (userRes.status === 401) {
        localStorage.removeItem('platform_auth_token');
        localStorage.removeItem('platform_refresh_token');
        localStorage.removeItem('180_access_token');
        localStorage.removeItem('user');
        document.cookie = 'platform_auth_token=; path=/; max-age=0;';
        window.dispatchEvent(new Event('180_SIGNOUT'));
        router.push('/');
        return;
      }
      if (userRes.ok) {
        const uData = await userRes.json();
        setUserProfile(uData.user || uData);
      }

      const appsRes = await fetch(`${apiBase}/api/v1/identity/developer/apps`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setAllProjects(appsData.apps || []);
      }
    } catch (_) {}
  }, [router]);

  // Fetch Auth Logs
  const fetchAuthLogs = useCallback(async () => {
    if (!projectId || projectId === 'default') return;
    setLoadingAuthLogs(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/auth-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuthLogs({
          logs: data.logs || [],
          totalUsers: data.totalUsers || 0,
          activeSessionsCount: data.activeSessionsCount || 0,
        });
      }
    } catch (_) {}
    finally {
      setLoadingAuthLogs(false);
    }
  }, [projectId]);

  // Revoke User Session
  const handleRevokeUserSession = async (targetUserId: string, userName: string) => {
    setRevokingUserId(targetUserId);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/revoke-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: targetUserId }),
      });
      if (!res.ok) throw new Error('Revoke session request failed');
      toast.success(`Active session for ${userName || targetUserId} terminated`);
      fetchAuthLogs();
    } catch (err: any) {
      toast.error(err.message || 'Revocation failed');
    } finally {
      setRevokingUserId(null);
    }
  };

  // Fetch Payment Analytics
  const fetchPaymentAnalytics = useCallback(async () => {
    if (!projectId || projectId === 'default') return;
    setLoadingAnalytics(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/payment-analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (res.ok) {
        const data = await res.json();
        const analytics = data.analytics || data.data || data;
        setPaymentAnalytics(analytics || null);
        if (typeof analytics?.withdrawableBalance === 'number') {
          setPayoutBalance(analytics.withdrawableBalance);
        }
      }
    } catch (_) {}
    finally {
      setLoadingAnalytics(false);
    }
  }, [projectId]);

  // Fetch Payout History
  const fetchPayoutHistory = useCallback(async () => {
    if (!projectId || projectId === 'default') return;
    setLoadingPayoutHistory(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/payouts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayoutHistory(data.payouts || data.data || []);
      }
    } catch (_) {}
    finally {
      setLoadingPayoutHistory(false);
    }
  }, [projectId]);

  // Webhook Test & Rotate
  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Please configure a destination webhook URL first');
      return;
    }
    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        statusCode: data.statusCode || (res.ok ? 200 : 500),
        latencyMs: data.latencyMs || 0,
        signature: data.signature || '',
        targetUrl: data.targetUrl || webhookUrl,
        message: data.message || '',
        response: typeof data.response === 'string' ? data.response : JSON.stringify(data.response || ''),
      });
      if (data.success) {
        toast.success(`Webhook test delivered! HTTP ${data.statusCode}`);
      } else {
        toast.error(`Webhook test failed with HTTP ${data.statusCode}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Webhook dispatch failed');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleRotateWebhookSecret = async () => {
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/rotate-webhook-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Secret rotation failed');
      const data = await res.json();
      setWebhookSecret(data.webhookSecret);
      toast.success('Webhook signature secret rotated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to rotate secret');
    }
  };

  // General Save Settings
  const saveSettings = async (updates: Partial<any> = {}) => {
    setSaving(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const payload = {
        name: updates.name ?? project?.name,
        description: updates.description ?? project?.description,
        logoUrl: updates.logoUrl ?? project?.logoUrl,
        redirectUris: updates.redirectUris ?? project?.redirectUris,
        allowedOrigins: updates.allowedOrigins ?? project?.allowedOrigins,
        enableAuth: updates.enableAuth ?? enableAuth,
        enablePay: updates.enablePay ?? enablePay,
        webhookUrl: updates.webhookUrl ?? webhookUrl,
        ...updates,
      };

      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to update settings');
      }

      toast.success('Settings saved successfully');
      await refreshProject();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    refreshProject();
    fetchAllProjectsAndProfile();
  }, [refreshProject, fetchAllProjectsAndProfile]);

  return (
    <ProjectContext.Provider
      value={{
        project,
        projectId,
        loading,
        refreshProject,
        userProfile,
        allProjects,
        isSidebarExpanded,
        setIsSidebarExpanded,
        enableAuth,
        setEnableAuth,
        enablePay,
        setEnablePay,
        saveSettings,
        saving,
        copiedKey,
        copyToClipboard,
        authLogs,
        loadingAuthLogs,
        fetchAuthLogs,
        handleRevokeUserSession,
        revokingUserId,
        paymentAnalytics,
        loadingAnalytics,
        fetchPaymentAnalytics,
        payoutBalance,
        payoutHistory,
        loadingPayoutHistory,
        fetchPayoutHistory,
        bankDetails,
        setBankDetails,
        webhookUrl,
        setWebhookUrl,
        webhookSecret,
        testResult,
        isTestingWebhook,
        handleTestWebhook,
        handleRotateWebhookSecret,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export default ProjectContext;
