'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { DeveloperAppDetail, PaymentAnalyticsData, BankDetailsData, PayoutRecord, WebhookTestResult } from '@/components/apps/types';
import { purgeAuthSession, getStoredAuthToken } from '@/lib/auth';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { getAppSlug } from '@/lib/slug';

interface ProjectContextValue {
  project: DeveloperAppDetail | null;
  projectId: string;
  projectSlug?: string;
  loading: boolean;
  refreshProject: (forceBypass?: boolean | unknown) => Promise<void>;
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
  authLogs: {
    logs: any[];
    totalUsers: number;
    activeSessionsCount: number;
    suspendedUsersCount?: number;
    verifiedUsersCount?: number;
    authMethodBreakdown?: {
      google: number;
      emailPassword: number;
      otp: number;
      passkey: number;
      universal: number;
    };
    growthTimeline?: Array<{
      month: string;
      newUsers: number;
      activeUsers: number;
      totalCumulative: number;
    }>;
    telemetryEvents?: any[];
  } | null;
  loadingAuthLogs: boolean;
  fetchAuthLogs: (forceBypass?: any) => Promise<void>;
  handleRevokeUserSession: (targetUserId: string, userName: string) => Promise<void>;
  handleSuspendUser: (targetUserId: string, reason?: string) => Promise<boolean>;
  handleUnsuspendUser: (targetUserId: string) => Promise<boolean>;
  handleDeleteAppUser: (targetUserId: string, userName?: string) => Promise<boolean>;
  revokingUserId: string | null;
  suspendingUserId: string | null;
  deletingUserId: string | null;
  // Telemetry for Pay
  paymentAnalytics: PaymentAnalyticsData | null;
  loadingAnalytics: boolean;
  fetchPaymentAnalytics: (forceBypass?: any) => Promise<void>;
  payoutBalance: number;
  payoutHistory: PayoutRecord[];
  loadingPayoutHistory: boolean;
  fetchPayoutHistory: (forceBypass?: any) => Promise<void>;
  bankDetails: BankDetailsData | null;
  setBankDetails: (val: BankDetailsData | null) => void;
  fetchBankDetails: (forceBypass?: any) => Promise<void>;
  // Webhook
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  webhookSecret: string;
  testResult: WebhookTestResult | null;
  isTestingWebhook: boolean;
  handleTestWebhook: (options?: any) => Promise<void>;
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
  return getStoredAuthToken();
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

  // Strict Project Isolation: Immediately purge all project-scoped state when navigating between projects
  useEffect(() => {
    setProject(null);
    setPaymentAnalytics(null);
    setAuthLogs(null);
    setBankDetails(null);
    setPayoutHistory([]);
    setPayoutBalance(0);
    setTestResult(null);
  }, [projectId]);

  // Identity states
  const [enableAuth, setEnableAuth] = useState(true);
  const [authLogs, setAuthLogs] = useState<{
    logs: any[];
    totalUsers: number;
    activeSessionsCount: number;
    suspendedUsersCount?: number;
    verifiedUsersCount?: number;
    authMethodBreakdown?: {
      google: number;
      emailPassword: number;
      otp: number;
      passkey: number;
      universal: number;
    };
    growthTimeline?: Array<{
      month: string;
      newUsers: number;
      activeUsers: number;
      totalCumulative: number;
    }>;
    telemetryEvents?: any[];
  } | null>(null);
  const [loadingAuthLogs, setLoadingAuthLogs] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [suspendingUserId, setSuspendingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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
    return isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch Project Details (Cached & In-Flight Deduplicated)
  const refreshProject = useCallback(async (forceBypass: boolean | unknown = false) => {
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

      if (forceBypass === true) {
        invalidateCache(`app_${projectId}`);
      }

      const appData = await cachedFetch(`app_${projectId}`, async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

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
        return data.app || data.data || data;
      }, 60000);

      if (appData) {
        setProject(appData);
        if (appData.bankDetails) {
          setBankDetails(appData.bankDetails);
        }
        setEnableAuth(appData.enableAuth ?? true);
        setEnablePay(appData.enablePay ?? true);
        setWebhookUrl(appData.webhookUrl || '');
        setWebhookSecret(appData.webhookSecret || '');

        // Automatically replace any legacy raw UUID or ClientID in the URL address bar with the clean slug
        const appSlug = getAppSlug(appData);
        if (appSlug && typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (
            currentPath.includes(`/apps/${appData.id}`) ||
            (appData.clientId && currentPath.includes(`/apps/${appData.clientId}`))
          ) {
            const newPath = currentPath
              .replace(`/apps/${appData.id}`, `/apps/${appSlug}`)
              .replace(`/apps/${appData.clientId}`, `/apps/${appSlug}`);
            window.history.replaceState(null, '', newPath + window.location.search + window.location.hash);
          }
        }
      }
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
        purgeAuthSession();
        toast.error('Access for 180 Developers Console was revoked. Logged out.');
        router.push('/dashboard');
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

  // Fetch All Projects & User Profile (Cached & Deduplicated)
  const fetchAllProjectsAndProfile = useCallback(async (forceBypass = false) => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const apiBase = getApiBase();

      if (forceBypass) {
        invalidateCache('user_profile_and_projects');
      }

      const payload = await cachedFetch('user_profile_and_projects', async () => {
        const [userRes, appsRes] = await Promise.all([
          fetch(`${apiBase}/api/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBase}/api/v1/identity/developer/apps`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        let user = null;
        if (userRes.status === 401) {
          purgeAuthSession();
          router.push('/dashboard');
          return null;
        }
        if (userRes.ok) {
          const uData = await userRes.json();
          user = uData.user || uData;
        }

        let apps: any[] = [];
        if (appsRes.ok) {
          const appsData = await appsRes.json();
          apps = appsData.apps || [];
        }

        return { user, apps };
      }, 60000);

      if (payload) {
        if (payload.user) setUserProfile(payload.user);
        if (payload.apps) setAllProjects(payload.apps);
      }
    } catch (_) {}
  }, [router]);

  // Fetch Auth Logs (Cached & Deduplicated)
  const fetchAuthLogs = useCallback(async (forceBypass?: any) => {
    if (!projectId || projectId === 'default') return;
    setLoadingAuthLogs(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();

      if (forceBypass === true) {
        invalidateCache(`auth_logs_${projectId}`);
      }

      const authData = await cachedFetch(`auth_logs_${projectId}`, async () => {
        const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/auth-logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const raw = await res.json();
          const d = raw.data || raw;
          const logs = d.logs || raw.logs || [];
          return {
            logs,
            totalUsers: d.totalUsers ?? raw.totalUsers ?? logs.length,
            activeSessionsCount: d.activeSessionsCount ?? raw.activeSessionsCount ?? 0,
            suspendedUsersCount: d.suspendedUsersCount ?? raw.suspendedUsersCount ?? 0,
            verifiedUsersCount: d.verifiedUsersCount ?? raw.verifiedUsersCount ?? 0,
            authMethodBreakdown: d.authMethodBreakdown || raw.authMethodBreakdown || {
              google: 0,
              emailPassword: 0,
              otp: 0,
              passkey: 0,
              universal: 0,
            },
            growthTimeline: d.growthTimeline || raw.growthTimeline || [],
            telemetryEvents: d.telemetryEvents || raw.telemetryEvents || [],
          };
        }
        return null;
      }, 15000);

      if (authData) {
        setAuthLogs(authData);
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
      invalidateCache(`auth_logs_${projectId}`);
      fetchAuthLogs(true);
    } catch (err: any) {
      toast.error(err.message || 'Revocation failed');
    } finally {
      setRevokingUserId(null);
    }
  };

  // Suspend User Access to App
  const handleSuspendUser = async (targetUserId: string, reason?: string) => {
    setSuspendingUserId(targetUserId);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/users/${targetUserId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to suspend user');
      toast.success('User access to this application has been suspended');
      invalidateCache(`auth_logs_${projectId}`);
      await fetchAuthLogs(true);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Suspension failed');
      return false;
    } finally {
      setSuspendingUserId(null);
    }
  };

  // Unsuspend User Access to App
  const handleUnsuspendUser = async (targetUserId: string) => {
    setSuspendingUserId(targetUserId);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/users/${targetUserId}/unsuspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to restore user access');
      toast.success('User access restored to this application');
      invalidateCache(`auth_logs_${projectId}`);
      await fetchAuthLogs(true);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Restoration failed');
      return false;
    } finally {
      setSuspendingUserId(null);
    }
  };

  // Delete User from App (App-scoped removal, preserves global 180 Profile)
  const handleDeleteAppUser = async (targetUserId: string, userName?: string) => {
    setDeletingUserId(targetUserId);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/users/${targetUserId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to remove user from application');
      toast.success(`User ${userName || ''} removed from this application`);
      invalidateCache(`auth_logs_${projectId}`);
      await fetchAuthLogs(true);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Removal failed');
      return false;
    } finally {
      setDeletingUserId(null);
    }
  };

  // Fetch Payment Analytics (Cached & Direct Canonical Route)
  const fetchPaymentAnalytics = useCallback(async (forceBypass?: any) => {
    if (!projectId || projectId === 'default') return;
    setLoadingAnalytics(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();

      if (forceBypass === true) {
        invalidateCache(`payment_analytics_${projectId}`);
      }

      const analyticsData = await cachedFetch(`payment_analytics_${projectId}`, async () => {
        const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data.analytics || data.data || data || null;
        }
        return null;
      }, 30000);

      if (analyticsData) {
        setPaymentAnalytics(analyticsData);
        if (typeof analyticsData?.withdrawableBalance === 'number') {
          setPayoutBalance(analyticsData.withdrawableBalance);
        }
      }
    } catch (_) {}
    finally {
      setLoadingAnalytics(false);
    }
  }, [projectId]);

  // Fetch Payout History (Cached & Deduplicated)
  const fetchPayoutHistory = useCallback(async (forceBypass?: any) => {
    if (!projectId || projectId === 'default') return;
    setLoadingPayoutHistory(true);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();

      if (forceBypass === true) {
        invalidateCache(`payouts_${projectId}`);
      }

      const payoutsData = await cachedFetch(`payouts_${projectId}`, async () => {
        const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/payouts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data.payouts || data.data || [];
        }
        return null;
      }, 30000);

      if (payoutsData) {
        setPayoutHistory(payoutsData);
      }
    } catch (_) {}
    finally {
      setLoadingPayoutHistory(false);
    }
  }, [projectId]);

  // Fetch Bank Details (Cached & Deduplicated)
  const fetchBankDetails = useCallback(async (forceBypass?: any) => {
    if (!projectId || projectId === 'default') return;
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();

      if (forceBypass === true) {
        invalidateCache(`bank_details_${projectId}`);
      }

      const data = await cachedFetch(`bank_details_${projectId}`, async () => {
        const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/bank-details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || json || null;
        }
        return null;
      }, 60000);

      if (data) {
        setBankDetails(data);
      }
    } catch (_) {}
  }, [projectId]);

  // Webhook Test & Rotate
  const handleTestWebhook = async (options?: any) => {
    const isSyntheticEvent = options && typeof options === 'object' && ('nativeEvent' in options || 'target' in options);
    const opts = isSyntheticEvent ? undefined : options;
    const target = opts?.url || webhookUrl.trim();
    if (!target) {
      toast.error('Please configure a destination webhook URL first');
      return;
    }
    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const token = getAuthToken();
      const apiBase = getApiBase();
      const eventToTest = opts?.event || 'identity.user.signup';
      const res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: target,
          event: eventToTest,
          customPayload: options?.customPayload,
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        statusCode: data.statusCode || (res.ok ? 200 : 500),
        latencyMs: data.latencyMs || 0,
        signature: data.signature || '',
        timestamp: data.timestamp || '',
        targetUrl: data.targetUrl || target,
        event: data.event || eventToTest,
        headersSent: data.headersSent || undefined,
        requestPayload: data.requestPayload || undefined,
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
      invalidateCache(`app_${projectId}`);
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

      invalidateCache(`app_${projectId}`);
      invalidateCache('user_profile_and_projects');
      toast.success('Settings saved successfully');
      await refreshProject(true);
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

  const projectSlug = (project ? getAppSlug(project) : '') || (params?.id as string) || projectId;

  return (
    <ProjectContext.Provider
      value={{
        project,
        projectId: projectSlug || projectId,
        projectSlug,
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
        handleSuspendUser,
        handleUnsuspendUser,
        handleDeleteAppUser,
        revokingUserId,
        suspendingUserId,
        deletingUserId,
        paymentAnalytics,
        loadingAnalytics,
        fetchPaymentAnalytics,
        payoutBalance,
        payoutHistory,
        loadingPayoutHistory,
        fetchPayoutHistory,
        bankDetails,
        setBankDetails,
        fetchBankDetails,
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
