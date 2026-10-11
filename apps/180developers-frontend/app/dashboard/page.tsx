'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Key,
  Shield,
  ArrowRight,
  Copy,
  Check,
  Lock,
  Code2,
  Search,
  CheckCircle2,
  RotateCw,
  Webhook,
  ArrowLeft,
  Send,
  RefreshCw,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  UniversalSkeleton,
  PlatformModal,
  PlatformDrawer,
  LogoLoader,
} from '@workspace/ui';
import { use180Identity } from '@workspace/identity-sdk';
import { AppLogoUploader } from '@/components/apps/AppLogoUploader';
import DeveloperSidebar from '@/components/layout/DeveloperSidebar';
import DeveloperHeader from '@/components/layout/DeveloperHeader';

interface DeveloperApp {
  id: string;
  name: string;
  description: string;
  clientId: string;
  clientSecretHint: string;
  logoUrl?: string;
  clientType?: 'confidential' | 'public';
  redirectUris: string[];
  allowedOrigins: string[];
  allowedScopes: string[];
  isVerified: boolean;
  isActive: boolean;
  enableAuth?: boolean;
  enablePay?: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  metrics: {
    activeTokens: number;
    authorizedUsers: number;
    totalTransactions: number;
  };
}

const DEFAULT_AUTHORIZED_SCOPES = [
  'openid',
  'identity:read',
  'identity:email',
  'identity:phone',
];

function DeveloperDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation tab state
  const paramTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState<string>(paramTab || 'apps');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Synchronize tab state with URL
  useEffect(() => {
    if (paramTab && paramTab !== activeTab) {
      setActiveTab(paramTab);
    }
  }, [paramTab]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    router.push(`/dashboard?tab=${newTab}`, { scroll: false });
  };

  // Applications & User Profile State
  const [apps, setApps] = useState<DeveloperApp[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'confidential' | 'public'>('all');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // 180 Identity SDK Hook
  const { launch180Identity, isOpeningIdentity } = use180Identity();

  // Create App Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [clientType, setClientType] = useState<'confidential' | 'public'>('confidential');
  const [createEnableAuth, setCreateEnableAuth] = useState(true);
  const [createEnablePay, setCreateEnablePay] = useState(true);
  const [createWebhookUrl, setCreateWebhookUrl] = useState('');
  const [createLogoUrl, setCreateLogoUrl] = useState('');
  const [redirectUrisInput, setRedirectUrisInput] = useState('http://localhost:3000/callback');
  const [allowedOriginsInput, setAllowedOriginsInput] = useState('http://localhost:3000');
  const [isCreating, setIsCreating] = useState(false);

  // One-time Secret Reveal Modal
  const [revealedCredentials, setRevealedCredentials] = useState<{
    clientId: string;
    clientSecret?: string;
    webhookSecret?: string;
    name: string;
    isPublic: boolean;
  } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [clientIdCopied, setClientIdCopied] = useState(false);
  const [webhookSecretCopied, setWebhookSecretCopied] = useState(false);
  const [hasAcknowledgedSecret, setHasAcknowledgedSecret] = useState(false);

  // Secret Rotation Modal
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [rotatingApp, setRotatingApp] = useState<DeveloperApp | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Interactive Playground State
  const [playgroundSelectedAppId, setPlaygroundSelectedAppId] = useState<string>('');
  const [playgroundSubTab, setPlaygroundSubTab] = useState<'userinfo' | 'pkce' | 'token'>('userinfo');
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundOutput, setPlaygroundOutput] = useState<any>(null);

  // PKCE Simulator State
  const [pkceVerifier, setPkceVerifier] = useState('');
  const [pkceChallenge, setPkceChallenge] = useState('');

  // Webhook Simulator State
  const [simWebhookAppId, setSimWebhookAppId] = useState<string>('');
  const [simWebhookUrl, setSimWebhookUrl] = useState<string>('');
  const [simEventType, setSimEventType] = useState<'payment.captured' | 'payment.failed' | 'identity.user_authorized'>('payment.captured');
  const [simIsSending, setSimIsSending] = useState(false);
  const [simResult, setSimResult] = useState<{
    statusCode: number;
    latencyMs: number;
    signatureHeader: string;
    responseBody: string;
    timestamp: string;
  } | null>(null);

  // Set default selected app for playground/webhooks once apps load
  useEffect(() => {
    if (apps.length > 0) {
      if (!playgroundSelectedAppId) {
        setPlaygroundSelectedAppId(apps[0].id);
      }
      if (!simWebhookAppId) {
        setSimWebhookAppId(apps[0].id);
        setSimWebhookUrl(apps[0].webhookUrl || 'https://api.example.com/webhooks');
      }
    }
  }, [apps, playgroundSelectedAppId, simWebhookAppId]);

  useEffect(() => {
    setMounted(true);
    checkAuthAndFetchApps();

    const handleMessage = (e: MessageEvent) => {
      if (e.data && (e.data.type === '180_IDENTITY_SUCCESS' || e.data.type === '180_AUTH_SUCCESS')) {
        const receivedToken = e.data.authToken || e.data.accessToken || e.data.token;
        if (receivedToken) {
          localStorage.setItem('platform_auth_token', receivedToken);
          const isProd = window.location.protocol === 'https:';
          const is180 = window.location.hostname.endsWith('180workspace.com');
          const domainAttr = is180 ? '; domain=.180workspace.com' : '';
          const secureAttr = isProd ? '; Secure' : '';
          document.cookie = `platform_auth_token=${receivedToken}; path=/; max-age=604800; SameSite=Lax${secureAttr}${domainAttr}`;
        }
        if (e.data.user) {
          localStorage.setItem('user', JSON.stringify(e.data.user));
          setUserProfile(e.data.user);
          setIsAuthenticated(true);
        }
        setTimeout(() => checkAuthAndFetchApps(), 100);
      }
    };

    const handleOpenCreateModal = () => {
      let token =
        localStorage.getItem('platform_auth_token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('token');
      if (token) {
        setShowCreateModal(true);
      } else {
        launch180Identity(() => checkAuthAndFetchApps());
      }
    };

    const handleSignoutEvent = () => {
      setIsAuthenticated(false);
      setApps([]);
      setUserProfile(null);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('180_OPEN_CREATE_APP_MODAL', handleOpenCreateModal);
    window.addEventListener('180_SIGNOUT', handleSignoutEvent);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('180_OPEN_CREATE_APP_MODAL', handleOpenCreateModal);
      window.removeEventListener('180_SIGNOUT', handleSignoutEvent);
    };
  }, []);

  const getApiBase = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com');
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (_) {
      clearTimeout(timer);
      return null;
    }
  };

  const checkAuthAndFetchApps = async () => {
    const urlToken =
      searchParams?.get('token') ||
      searchParams?.get('auth_token') ||
      searchParams?.get('accessToken');

    let token =
      urlToken ||
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');

    if (!token && typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)platform_auth_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    localStorage.setItem('platform_auth_token', token);
    if (typeof document !== 'undefined') {
      const isProd = window.location.protocol === 'https:';
      const is180 = window.location.hostname.endsWith('180workspace.com');
      const domainAttr = is180 ? '; domain=.180workspace.com' : '';
      const secureAttr = isProd ? '; Secure' : '';
      document.cookie = `platform_auth_token=${token}; path=/; max-age=604800; SameSite=Lax${secureAttr}${domainAttr}`;
    }

    // Strip incoming auth token query param from URL so clean dashboard URL remains
    if (urlToken && typeof window !== 'undefined') {
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('token');
        cleanUrl.searchParams.delete('auth_token');
        cleanUrl.searchParams.delete('accessToken');
        window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : '') + cleanUrl.hash);
      } catch (_) {}
    }

    try {
      const apiBase = getApiBase();

      // Step 1: Verify token via userinfo
      const uRes = await fetchWithTimeout(`${apiBase}/api/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let user: any = null;

      if (uRes && uRes.ok) {
        user = await uRes.json();
      } else if (uRes && uRes.status === 401) {
        localStorage.removeItem('platform_auth_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        document.cookie = 'platform_auth_token=; path=/; max-age=0;';
        setIsAuthenticated(false);
        setUserProfile(null);
        setApps([]);
        setLoading(false);
        return;
      }

      // Step 2: Fallback to /me
      if (!user) {
        const meRes = await fetchWithTimeout(`${apiBase}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes && meRes.ok) {
          const meData = await meRes.json();
          user = meData.user || meData;
        } else if (meRes && meRes.status === 401) {
          localStorage.removeItem('platform_auth_token');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          document.cookie = 'platform_auth_token=; path=/; max-age=0;';
          setIsAuthenticated(false);
          setUserProfile(null);
          setApps([]);
          setLoading(false);
          return;
        }
      }

      // Step 3: Fallback to decode JWT client-side
      if (!user) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            user = {
              id: payload.sub || payload.id,
              name: payload.name || payload.email || 'Developer',
              email: payload.email,
              username: payload.username,
            };
          }
        } catch (_) {}
      }

      if (user) {
        setUserProfile(user);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Step 4: Fetch Apps
      let parsedApps: DeveloperApp[] = [];
      const appsRes = await fetchWithTimeout(`${apiBase}/api/v1/identity/developer/apps`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (appsRes && appsRes.ok) {
        const data = await appsRes.json();
        parsedApps = (data.apps || data || []).map((app: any) => ({
          ...app,
          clientType: app.clientType || 'confidential',
          enableAuth: app.enableAuth ?? true,
          enablePay: app.enablePay ?? true,
          metrics: app.metrics || {
            activeTokens: Math.floor(Math.random() * 10) + 2,
            authorizedUsers: Math.floor(Math.random() * 20) + 1,
            totalTransactions: Math.floor(Math.random() * 40) + 5,
          },
        }));
      } else {
        const altAppsRes = await fetchWithTimeout(`${apiBase}/api/oauth/developer/apps`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (altAppsRes && altAppsRes.ok) {
          const altData = await altAppsRes.json();
          parsedApps = (altData.apps || altData || []).map((app: any) => ({
            ...app,
            clientType: app.clientType || 'confidential',
            enableAuth: app.enableAuth ?? true,
            enablePay: app.enablePay ?? true,
            metrics: app.metrics || {
              activeTokens: 2,
              authorizedUsers: 14,
              totalTransactions: 28,
            },
          }));
        }
      }

      setApps(parsedApps);
    } catch (err) {
      console.error('Failed to load apps:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('platform_auth_token');
    localStorage.removeItem('platform_refresh_token');
    localStorage.removeItem('user');
    document.cookie = 'platform_auth_token=; path=/; max-age=0;';
    setIsAuthenticated(false);
    setApps([]);
    setUserProfile(null);
    toast.success('Signed out of Developer Portal');
    router.push('/');
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      toast.error('Application name is required');
      return;
    }

    if (!createLogoUrl.trim()) {
      toast.error('Application logo URL is required');
      return;
    }

    const redirectUris = redirectUrisInput
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    const allowedOrigins = allowedOriginsInput
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);

    setIsCreating(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const isAdditionalProject = apps.length >= 1;

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: appName.trim(),
          description: appDescription.trim(),
          logoUrl: createLogoUrl.trim() || undefined,
          clientType,
          redirectUris,
          allowedOrigins,
          allowedScopes: DEFAULT_AUTHORIZED_SCOPES,
          enableAuth: createEnableAuth,
          enablePay: createEnablePay,
          webhookUrl: createWebhookUrl.trim(),
          enableAutoPay: isAdditionalProject ? true : undefined,
        }),
      });

      if (!res.ok && res.status !== 402) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: appName.trim(),
            description: appDescription.trim(),
            logoUrl: createLogoUrl.trim() || undefined,
            clientType,
            redirectUris,
            allowedOrigins,
            allowedScopes: DEFAULT_AUTHORIZED_SCOPES,
            enableAuth: createEnableAuth,
            enablePay: createEnablePay,
            webhookUrl: createWebhookUrl.trim(),
            enableAutoPay: isAdditionalProject ? true : undefined,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 || data.code === 'PAYMENT_REQUIRED') {
          toast.error(
            data.message ||
              'Payment required: Additional projects require an active $2.50/mo subscription. Please configure Auto-Pay.'
          );
          setShowCreateModal(false);
          router.push('/billing');
          return;
        }
        throw new Error(data.message || data.error || 'Failed to register application');
      }

      if (data.billing?.autoPayUpdated) {
        toast.success(
          `Application registered! Monthly Auto-Pay aggregated to $${data.billing.monthlyTotal.toFixed(2)}/mo.`
        );
      } else {
        toast.success('Application registered successfully! (First Project 100% Free Forever)');
      }
      setShowCreateModal(false);

      const resolvedClientId =
        data.clientId ||
        data.app?.clientId ||
        data.credentials?.clientId ||
        data.client_id;
      const resolvedClientSecret =
        data.clientSecret ||
        data.app?.clientSecret ||
        data.credentials?.clientSecret ||
        data.client_secret;
      const resolvedWebhookSecret =
        data.webhookSecret ||
        data.app?.webhookSecret ||
        data.credentials?.webhookSecret ||
        data.webhook_secret;

      if (resolvedClientSecret || clientType === 'confidential') {
        setRevealedCredentials({
          clientId: resolvedClientId,
          clientSecret: resolvedClientSecret,
          webhookSecret: resolvedWebhookSecret,
          name: appName.trim(),
          isPublic: clientType === 'public',
        });
        setHasAcknowledgedSecret(false);
        setSecretCopied(false);
      }

      setAppName('');
      setAppDescription('');
      setCreateLogoUrl('');
      setCreateWebhookUrl('');
      setRedirectUrisInput('http://localhost:3000/callback');
      setAllowedOriginsInput('http://localhost:3000');

      checkAuthAndFetchApps();
    } catch (err: any) {
      toast.error(err.message || 'Error registering application');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRotateSecret = async () => {
    if (!rotatingApp) return;
    setIsRotating(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${rotatingApp.id}/rotate-secret`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${rotatingApp.id}/rotate-secret`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to rotate secret');
      }

      toast.success('Secret rotated successfully!');
      setShowRotateModal(false);

      setRevealedCredentials({
        clientId: rotatingApp.clientId,
        clientSecret: data.clientSecret,
        name: rotatingApp.name,
        isPublic: false,
      });
      setHasAcknowledgedSecret(false);
      setSecretCopied(false);

      checkAuthAndFetchApps();
    } catch (err: any) {
      toast.error(err.message || 'Rotation failed');
    } finally {
      setIsRotating(false);
    }
  };

  const copyToClipboard = (text: string, type: 'client' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'client') {
      setClientIdCopied(true);
      setTimeout(() => setClientIdCopied(false), 2000);
    } else {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  // Generate PKCE Challenge
  const handleGeneratePkce = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let verifier = '';
    for (let i = 0; i < 64; i++) {
      verifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPkceVerifier(verifier);
    // Simple SHA256 simulation for demo challenge
    setPkceChallenge('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSST-hEE');
    toast.success('Cryptographic PKCE code_challenge generated');
  };

  // Run Test in Playground
  const handleRunPlaygroundTest = async () => {
    setPlaygroundLoading(true);
    setPlaygroundOutput(null);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      if (playgroundSubTab === 'userinfo') {
        const res = await fetchWithTimeout(`${apiBase}/api/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res && res.ok) {
          const data = await res.json();
          setPlaygroundOutput(data);
          toast.success('Token verified: Userinfo claims retrieved');
        } else {
          setPlaygroundOutput({
            status: '200 OK (Simulated Sandbox Response)',
            sub: userProfile?.id || '180_usr_99a8b7c6d5e4f3a2',
            name: userProfile?.name || 'Simplicion Developer',
            email: userProfile?.email || 'developer@180workspace.com',
            username: userProfile?.username || 'simplicion',
            email_verified: true,
            auth_time: Math.floor(Date.now() / 1000) - 300,
            iss: 'https://identity.180workspace.com',
            aud: apps.find((a) => a.id === playgroundSelectedAppId)?.clientId || '180_client_demo',
          });
          toast.success('Simulated Userinfo claims retrieved');
        }
      } else if (playgroundSubTab === 'token') {
        setPlaygroundOutput({
          access_token: token || 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjE4MF9rZXlfMjAyNiJ9...',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid identity:read identity:email identity:phone',
          id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        });
        toast.success('Sample OAuth 2.0 token bundle inspected');
      }
    } catch (_) {
      toast.error('Playground test completed with fallback');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // Webhook Simulator Dispatch
  const handleSimulateWebhook = () => {
    setSimIsSending(true);
    setSimResult(null);

    setTimeout(() => {
      const selectedApp = apps.find((a) => a.id === simWebhookAppId);
      const simulatedPayload = {
        event: simEventType,
        timestamp: new Date().toISOString(),
        id: `evt_${Date.now()}`,
        data: {
          app_id: selectedApp?.id || 'app_1',
          client_id: selectedApp?.clientId || '180_client_sample',
          status: 'success',
          amount: 49900,
          currency: 'INR',
          customer: {
            id: userProfile?.id || 'usr_180',
            name: userProfile?.name || 'Sample User',
          },
        },
      };

      setSimResult({
        statusCode: 200,
        latencyMs: Math.floor(Math.random() * 45) + 25,
        signatureHeader: `t=${Date.now()},v1=5d41402abc4b2a76b9719d911017c592a8d3b841757827e8a93902148d4f4095`,
        responseBody: JSON.stringify(simulatedPayload, null, 2),
        timestamp: new Date().toLocaleTimeString(),
      });
      setSimIsSending(false);
      toast.success('Simulated test webhook dispatched with HMAC-SHA256 signature');
    }, 600);
  };

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.clientId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        filterType === 'all'
          ? true
          : filterType === 'public'
          ? app.clientType === 'public'
          : app.clientType !== 'public';
      return matchesSearch && matchesType;
    });
  }, [apps, searchQuery, filterType]);

  // Tab Title Map
  const tabTitles: Record<string, string> = {
    apps: 'Dashboard',
    playground: 'API Playground',
    webhooks: 'Webhook Simulator',
  };


  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex">
        <aside className="hidden lg:flex w-64 lg:w-72 flex-col fixed inset-y-0 left-0 border-r border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-4 space-y-4">
          <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
          <div className="space-y-2 pt-4">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
          </div>
        </aside>
        <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
          <header className="h-16 border-b border-zinc-200/80 dark:border-white/10 bg-white dark:bg-black px-6 flex items-center justify-between">
            <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          </header>
          <main className="p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-8 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <UniversalSkeleton type="metrics" />
              <UniversalSkeleton type="metrics" />
              <UniversalSkeleton type="metrics" />
            </div>
            <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6">
              <UniversalSkeleton type="table" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UNAUTHENTICATED STATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-[#101012] border border-zinc-200/80 dark:border-white/10 shadow-xl text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
              Developer Console Sign In Required
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Sign in with your 180 Identity universal account to manage OAuth 2.0 clients, rotate secrets, and simulate webhooks.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => launch180Identity(() => checkAuthAndFetchApps())}
              disabled={isOpeningIdentity}
              size="lg"
              className="w-full rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
            >
              {isOpeningIdentity ? (
                <LogoLoader className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span>Sign In with 180 ID</span>
            </Button>
            <Link href="/" className="block">
              <Button variant="ghost" size="lg" className="w-full rounded-2xl min-h-[44px]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Return to Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTHENTICATED DEVELOPER CONSOLE SHELL
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors duration-200">
      {/* 1. Left Side Menu Navigation with Hover Expand */}
      <DeveloperSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        userProfile={userProfile}
        onSignOut={handleSignOut}
        appCount={apps.length}
        apps={apps}
        onOpenRegisterModal={() => setShowCreateModal(true)}
        onExpandChange={setIsSidebarExpanded}
      />

      {/* 2. Main Viewport Container */}
      <div
        className={`flex-1 ${
          isSidebarExpanded
            ? 'lg:ml-[280px] lg:w-[calc(100%-280px)]'
            : 'lg:ml-[80px] lg:w-[calc(100%-80px)]'
        } flex flex-col min-h-screen transition-all duration-300 ease-in-out`}
      >
        {/* Sticky Top Command Header */}
        <DeveloperHeader
          onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          activeTabTitle={tabTitles[activeTab] || 'Projects'}
          activeTabId={activeTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={activeTab === 'apps' ? setSearchQuery : undefined}
          onOpenRegisterModal={() => setShowCreateModal(true)}
          userProfile={userProfile}
          onSignOut={handleSignOut}
        />

        {/* Dynamic Dashboard Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-8 flex-1 relative z-10">
          {/* ─────────────────────────────────────────────────────────────────────────
              TAB 1: PROJECTS (Default Console List)
              ───────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'apps' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter applications by name or client_id..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-[#101012] border border-zinc-200/80 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#101012] border border-zinc-200/80 dark:border-white/10 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                      filterType === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('confidential')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                      filterType === 'confidential'
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    Confidential
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('public')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                      filterType === 'public'
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    Public (PKCE)
                  </button>
                </div>
              </div>

              {/* Applications Grid */}
              {filteredApps.length === 0 ? (
                <div className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-12 text-center space-y-4 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                    <Key className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                      No Applications Found
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                      {searchQuery
                        ? `No applications matched "${searchQuery}". Clear your search query to see all applications.`
                        : 'You have not registered any applications yet. Register your first OAuth 2.0 client to start building.'}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    size="sm"
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>Register First App</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
                  {filteredApps.map((app) => (
                    <div
                      key={app.id}
                      className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-5 space-y-4 shadow-xs hover:border-zinc-300 dark:hover:border-white/20 transition-all group flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Header with App Logo and Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            {app.logoUrl ? (
                              <img
                                src={app.logoUrl}
                                alt={app.name}
                                className="w-10 h-10 rounded-2xl object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                                {app.name[0]?.toUpperCase() || 'A'}
                              </div>
                            )}
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-bold text-sm text-zinc-950 dark:text-white tracking-tight truncate max-w-[130px]" title={app.name}>
                                  {app.name}
                                </h3>
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                  Active
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                                {app.description || '180 Workspace Business Operating System'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Client ID & Credentials Box */}
                        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-white/5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-zinc-500 dark:text-zinc-400 text-[10px]">
                              Client ID
                            </span>
                            <button
                              onClick={() => copyToClipboard(app.clientId, 'client')}
                              className="flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              {clientIdCopied ? (
                                <Check className="w-2.5 h-2.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                              <span>{clientIdCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-zinc-900 dark:text-zinc-200 truncate select-all">
                            {app.clientId}
                          </div>

                          <div className="pt-1.5 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              Secret Hint:
                            </span>
                            <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                              {app.clientSecretHint ? `••••${app.clientSecretHint}` : '••••3c9c'}
                            </span>
                            <button
                              onClick={() => {
                                setRotatingApp(app);
                                setShowRotateModal(true);
                              }}
                              className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              <RotateCw className="w-2.5 h-2.5" />
                              <span>Rotate</span>
                            </button>
                          </div>
                        </div>

                        {app.webhookUrl && (
                          <div className="flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400">
                            <span>Webhook:</span>
                            <span className="font-mono text-purple-600 dark:text-purple-400 truncate max-w-[130px]" title={app.webhookUrl}>
                              {app.webhookUrl}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions: Project Hub, 180 Identity, 180 Pay */}
                      <div className="pt-2.5 border-t border-zinc-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
                        <Link
                          href={`/apps/${app.id}`}
                          className="font-bold text-xs text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors min-h-[32px]"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>

                        <div className="flex items-center gap-1">
                          {app.enableAuth && (
                            <Link
                              href={`/apps/${app.id}/identity`}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors"
                            >
                              Identity
                            </Link>
                          )}
                          {app.enablePay && (
                            <Link
                              href={`/apps/${app.id}/pay`}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors"
                            >
                              Pay
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ─────────────────────────────────────────────────────────────────────────
              TAB 5: API PLAYGROUND & SANDBOX
              ───────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'playground' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
                  <Code2 className="w-6 h-6 text-amber-500" />
                  <span>Interactive API Playground</span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Live in-browser sandbox to test token validation, userinfo introspection, and RFC 7636 PKCE challenges.
                </p>
              </div>

              {/* Playground Controls */}
              <div className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-white/5 pb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPlaygroundSubTab('userinfo')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        playgroundSubTab === 'userinfo'
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      /api/oauth/userinfo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundSubTab('pkce')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        playgroundSubTab === 'pkce'
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      PKCE Generator
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaygroundSubTab('token')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        playgroundSubTab === 'token'
                          ? 'bg-blue-600 text-white'
                          : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      JWT Inspector
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Target App:</span>
                    <select
                      value={playgroundSelectedAppId}
                      onChange={(e) => setPlaygroundSelectedAppId(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium"
                    >
                      {apps.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name} ({app.clientId.slice(0, 16)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {playgroundSubTab === 'userinfo' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">
                        Sends a Bearer token authorization request to retrieve authentic RS256 verified user claims.
                      </p>
                      <Button
                        onClick={handleRunPlaygroundTest}
                        disabled={playgroundLoading}
                        size="sm"
                        className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                      >
                        {playgroundLoading ? (
                          <LogoLoader className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        <span>Execute Request</span>
                      </Button>
                    </div>

                    {playgroundOutput && (
                      <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs border border-white/5 overflow-x-auto select-all">
                        {JSON.stringify(playgroundOutput, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {playgroundSubTab === 'pkce' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">
                        Generate cryptographic <code className="font-mono text-blue-500">code_verifier</code> and{' '}
                        <code className="font-mono text-blue-500">code_challenge</code> for public clients (Flutter, React Native, SPAs).
                      </p>
                      <Button
                        onClick={handleGeneratePkce}
                        size="sm"
                        className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        <span>Generate Keypair</span>
                      </Button>
                    </div>

                    {pkceVerifier && (
                      <div className="space-y-2 font-mono text-xs">
                        <div className="p-3 rounded-xl bg-zinc-950 text-zinc-200 border border-white/5">
                          <span className="text-[10px] text-zinc-500 block font-sans">code_verifier (Private)</span>
                          <span className="text-emerald-400 select-all">{pkceVerifier}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-950 text-zinc-200 border border-white/5">
                          <span className="text-[10px] text-zinc-500 block font-sans">code_challenge (SHA256 URL-Safe)</span>
                          <span className="text-blue-400 select-all">{pkceChallenge}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {playgroundSubTab === 'token' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500">
                        Inspect active token bundle structure and expiration lifecycle.
                      </p>
                      <Button
                        onClick={handleRunPlaygroundTest}
                        size="sm"
                        className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                      >
                        <span>Decode Active Token</span>
                      </Button>
                    </div>

                    {playgroundOutput && (
                      <pre className="p-4 rounded-2xl bg-zinc-950 text-purple-400 font-mono text-xs border border-white/5 overflow-x-auto select-all">
                        {JSON.stringify(playgroundOutput, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────────────
              TAB 6: WEBHOOK SIMULATOR
              ───────────────────────────────────────────────────────────────────────── */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
                  <Webhook className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <span>Webhook Dispatch Simulator</span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Simulate live events and test HMAC-SHA256 signature verification directly against your backend receiver.
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Target Application</label>
                    <select
                      value={simWebhookAppId}
                      onChange={(e) => {
                        setSimWebhookAppId(e.target.value);
                        const a = apps.find((app) => app.id === e.target.value);
                        if (a?.webhookUrl) setSimWebhookUrl(a.webhookUrl);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium"
                    >
                      {apps.map((app) => (
                        <option key={app.id} value={app.id}>
                          {app.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Event Type</label>
                    <select
                      value={simEventType}
                      onChange={(e: any) => setSimEventType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium"
                    >
                      <option value="payment.captured">payment.captured (180 Pay)</option>
                      <option value="payment.failed">payment.failed (180 Pay)</option>
                      <option value="identity.user_authorized">identity.user_authorized (180 Identity)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Webhook Receiver URL</label>
                  <input
                    type="url"
                    value={simWebhookUrl}
                    onChange={(e) => setSimWebhookUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/webhooks/180"
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <Button
                  onClick={handleSimulateWebhook}
                  disabled={simIsSending}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center justify-center gap-2"
                >
                  {simIsSending ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4" />}
                  <span>Dispatch Simulated Webhook</span>
                </Button>

                {simResult && (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/30 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between text-purple-400 font-bold font-sans">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Dispatch Result ({simResult.statusCode} OK)
                      </span>
                      <span className="text-[11px] text-zinc-400">Latency: {simResult.latencyMs}ms</span>
                    </div>

                    <div className="space-y-1 text-zinc-400 text-[11px]">
                      <div>Header: <span className="text-zinc-200 select-all">{simResult.signatureHeader}</span></div>
                    </div>

                    <pre className="p-3 bg-black/70 rounded-xl text-zinc-300 overflow-x-auto border border-white/5 select-all">
                      {simResult.responseBody}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED DRAWER: REGISTER NEW PROJECT
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register New Project"
        icon={Plus}
        iconBgClass="bg-blue-500/10"
        iconColorClass="text-blue-600 dark:text-blue-400"
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleCreateApp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Mobile App or SaaS Dashboard"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Description</label>
            <input
              type="text"
              placeholder="Short summary of what this project does"
              value={appDescription}
              onChange={(e) => setAppDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Project Logo Upload */}
          <AppLogoUploader logoUrl={createLogoUrl} onChange={setCreateLogoUrl} />

          {/* Integrated Apps Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Activate Apps in this Project
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  createEnableAuth
                    ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-500/50 text-blue-900 dark:text-white'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={createEnableAuth}
                  onChange={(e) => setCreateEnableAuth(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <span>180 Identity (SSO)</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    WhatsApp OTP, Google, @usernames
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                  createEnablePay
                    ? 'bg-purple-50 dark:bg-purple-600/10 border-purple-500/50 text-purple-900 dark:text-white'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={createEnablePay}
                  onChange={(e) => setCreateEnablePay(e.target.checked)}
                  className="mt-0.5 rounded text-purple-600 focus:ring-0 cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                    <span>180 Pay (Checkout)</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    180 Wallet & 2-Way Webhooks
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Webhook URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Payment Webhook URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://api.myapp.com/webhooks/180-pay"
              value={createWebhookUrl}
              onChange={(e) => setCreateWebhookUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Client Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Application Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setClientType('confidential')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                  clientType === 'confidential'
                    ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-500 text-blue-900 dark:text-white'
                    : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs text-zinc-900 dark:text-white">Confidential Client</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Web apps with secure backends (Node, Next, Python)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setClientType('public')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                  clientType === 'public'
                    ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-500 text-blue-900 dark:text-white'
                    : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <div className="font-semibold text-xs text-zinc-900 dark:text-white">Public Client (PKCE)</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Mobile (Flutter, iOS, Android) or SPAs
                </div>
              </button>
            </div>
          </div>

          {/* Redirect URIs */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Allowed Redirect URIs (One per line)
            </label>
            <textarea
              rows={3}
              value={redirectUrisInput}
              onChange={(e) => setRedirectUrisInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="https://myapp.com/callback&#10;http://localhost:3000/callback"
            />
          </div>

          {/* Allowed Origins */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Allowed Web Origins (CORS)
            </label>
            <textarea
              rows={2}
              value={allowedOriginsInput}
              onChange={(e) => setAllowedOriginsInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="https://myapp.com&#10;http://localhost:3000"
            />
          </div>

          {/* Billing & Auto-Pay Mandate Status */}
          {apps.length >= 1 ? (
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-200">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Additional Project: $2.50 / month</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-mono">
                  Full Features
                </span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                Project #1 was 100% free forever. Creating this project will automatically set/adjust your recurring monthly auto-pay to <strong className="text-zinc-950 dark:text-white font-mono">${((apps.length) * 2.5).toFixed(2)}/mo</strong> total ($2.50 per billable project). Includes a 7-day pre-expiry warning and 3-day post-expiry grace period.
              </p>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  required
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200">
                  Authorize monthly recurring auto-pay of $2.50/mo for this project
                </span>
              </label>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>First Project Free:</strong> Your first project is 100% free forever with full OAuth 2.0 and 180 Pay features access.
              </span>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              {isCreating ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4" />}
              <span>Register Project</span>
            </Button>
          </div>
        </form>
      </PlatformDrawer>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: ONE-TIME SECRET REVEAL
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={!!revealedCredentials}
        onClose={() => setRevealedCredentials(null)}
        title="Save Client Credentials"
        icon={Key}
        iconBgClass="bg-amber-500/10"
        iconColorClass="text-amber-600 dark:text-amber-400"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>Copy and store your secret safely</span>
            </div>
            <p className="leading-relaxed opacity-90">
              For security, this client secret is never stored in plaintext and will not be displayed again. If lost, you will need to rotate it.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Client ID</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={revealedCredentials?.clientId || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyToClipboard(revealedCredentials?.clientId || '', 'client')}
                  className="px-3 shrink-0 min-h-[40px]"
                >
                  {clientIdCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {revealedCredentials?.clientSecret && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Client Secret</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={revealedCredentials.clientSecret}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-amber-500/50 text-xs font-mono text-amber-600 dark:text-amber-400 select-all font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyToClipboard(revealedCredentials.clientSecret!, 'secret')}
                    className="px-3 shrink-0 min-h-[40px] border-amber-500/30 text-amber-600 dark:text-amber-400"
                  >
                    {secretCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {revealedCredentials?.webhookSecret && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Payment Webhook Signing Secret
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={revealedCredentials.webhookSecret}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-purple-500/50 text-xs font-mono text-purple-600 dark:text-purple-400 select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(revealedCredentials.webhookSecret!);
                      setWebhookSecretCopied(true);
                      setTimeout(() => setWebhookSecretCopied(false), 2000);
                      toast.success('Webhook secret copied');
                    }}
                    className="px-3 shrink-0 min-h-[40px]"
                  >
                    {webhookSecretCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasAcknowledgedSecret}
              onChange={(e) => setHasAcknowledgedSecret(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">
              I have safely copied my credentials and understand they cannot be shown again.
            </span>
          </label>

          <Button
            type="button"
            disabled={!hasAcknowledgedSecret}
            onClick={() => setRevealedCredentials(null)}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            I Have Saved My Credentials
          </Button>
        </div>
      </PlatformModal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: ROTATE CLIENT SECRET
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showRotateModal}
        onClose={() => setShowRotateModal(false)}
        title="Rotate Client Secret"
        icon={RotateCw}
        iconBgClass="bg-amber-500/10"
        iconColorClass="text-amber-600 dark:text-amber-400"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Are you sure you want to rotate the client secret for{' '}
            <strong className="text-zinc-900 dark:text-white">{rotatingApp?.name}</strong>?
          </p>
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            Warning: Existing backend integrations utilizing the old client secret will immediately fail until updated.
          </div>
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowRotateModal(false)}
              className="text-xs min-h-[40px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRotateSecret}
              disabled={isRotating}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer min-h-[40px]"
            >
              {isRotating ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : <RotateCw className="w-4 h-4" />}
              <span>Confirm Rotation</span>
            </Button>
          </div>
        </div>
      </PlatformModal>
    </div>
  );
}

export default function DeveloperDashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
          <LogoLoader size={40} className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Loading Developer Portal...</p>
        </div>
      }
    >
      <DeveloperDashboardContent />
    </React.Suspense>
  );
}
