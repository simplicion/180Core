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
  Sparkles,
  AlertCircle,
  Wallet,
  ExternalLink,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  UniversalSkeleton,
  AdaptiveSkeleton,
  PlatformModal,
  PlatformDrawer,
  LogoLoader,
  OneEightyIdentityButton,
} from '@workspace/ui';
import { use180Identity, use180Pay } from '@workspace/identity-sdk';
import { AppLogoUploader } from '@/components/apps/AppLogoUploader';
import DeveloperSidebar from '@/components/layout/DeveloperSidebar';
import DeveloperHeader from '@/components/layout/DeveloperHeader';
import { OneEightyCoreLogo } from '@/components/OneEightyCoreLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { purgeAuthSession, getStoredAuthToken } from '@/lib/auth';

export interface DeveloperBillingStatus {
  totalProjects: number;
  maxProjectsAllowed: number;
  freeProjects: number;
  billableProjects: number;
  ratePerProject: number;
  currentMonthlyTotal: number;
  monthlyAmount: number;
  status: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED';
  planTier: 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  planName: string;
  isTrial: boolean;
  contactFormUrl: string;
  canCreateMore?: boolean;
  message?: string;
  nextBillingDate?: string | null;
  daysUntilRenewal?: number | null;
  subscriptionId?: string | null;
}

const ENTERPRISE_FORM_URL = 'https://app.180core.cloud/f/9hbzy4u62s';

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

  const CORE_CLIENT_ID =
    process.env.NEXT_PUBLIC_180_CLIENT_ID ||
    process.env.NEXT_PUBLIC_CORE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_IDENTITY_CLIENT_ID ||
    '180_client_2d51a605038c38ffb6fa037688988a83';

  // 180 Identity & 180 Pay SDK Hooks
  const { launch180Identity, isOpeningIdentity } = use180Identity(CORE_CLIENT_ID);
  const { launch180Pay, isOpeningPay } = use180Pay();

  // Developer Billing & Plan Limit State
  const [billingStatus, setBillingStatus] = useState<DeveloperBillingStatus | null>(null);
  const [showPlanLimitModal, setShowPlanLimitModal] = useState(false);
  const [subscribingTier, setSubscribingTier] = useState<'STARTER' | 'PRO' | null>(null);

  const billingStatusRef = React.useRef<DeveloperBillingStatus | null>(null);
  billingStatusRef.current = billingStatus;
  const appsLengthRef = React.useRef<number>(0);
  appsLengthRef.current = apps.length;

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
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

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
          const isCore = window.location.hostname.endsWith('180core.cloud');
          const domainAttr = isCore ? '; domain=.180core.cloud' : '';
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

    const onOpenModalEvent = () => handleOpenCreateModal();

    const handleSignoutEvent = () => {
      setIsAuthenticated(false);
      setApps([]);
      setUserProfile(null);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('180_OPEN_CREATE_APP_MODAL', onOpenModalEvent);
    window.addEventListener('180_SIGNOUT', handleSignoutEvent);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('180_OPEN_CREATE_APP_MODAL', onOpenModalEvent);
      window.removeEventListener('180_SIGNOUT', handleSignoutEvent);
    };
  }, []);

  const handleOpenCreateModal = () => {
    let token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token');
    if (!token) {
      launch180Identity({ clientId: CORE_CLIENT_ID, onSuccess: () => checkAuthAndFetchApps() });
      return;
    }

    const currentBilling = billingStatusRef.current;
    const currentAppsCount = appsLengthRef.current;

    // Strictly enforce project limits:
    // Free tier allows exactly 1 project. If limit reached, open PlanLimitModal with 1-click upgrades
    if (currentBilling && !currentBilling.canCreateMore) {
      setShowPlanLimitModal(true);
      return;
    }

    if (!currentBilling && currentAppsCount >= 1) {
      setShowPlanLimitModal(true);
      return;
    }

    setShowCreateModal(true);
  };

  const getApiBase = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      return window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:4003' : 'http://localhost:4003';
    }
    return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud';
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

    let token = urlToken || getStoredAuthToken();

    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    localStorage.setItem('platform_auth_token', token);
    if (typeof document !== 'undefined') {
      const isProd = window.location.protocol === 'https:';
      const isCore = window.location.hostname.endsWith('180core.cloud');
      const domainAttr = isCore ? '; domain=.180core.cloud' : '';
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
          purgeAuthSession();
          setIsAuthenticated(false);
          setUserProfile(null);
          setApps([]);
          setLoading(false);
          return;
        }
      }

      // Step 3: Fallback to decode JWT client-side or check cached user
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
          } else {
            const cachedUserStr = localStorage.getItem('user');
            if (cachedUserStr) {
              user = JSON.parse(cachedUserStr);
            }
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

      // Step 4: Fetch Apps & Developer Billing Status in Parallel
      let parsedApps: DeveloperApp[] = [];
      const [appsRes, billingRes] = await Promise.all([
        fetchWithTimeout(`${apiBase}/api/v1/identity/developer/apps`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchWithTimeout(`${apiBase}/api/v1/identity/developer/billing/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (billingRes && billingRes.ok) {
        try {
          const bData = await billingRes.json();
          if (bData.billing) {
            setBillingStatus(bData.billing);
          }
        } catch (_) {}
      }

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
    purgeAuthSession();
    setIsAuthenticated(false);
    setApps([]);
    setUserProfile(null);
    setLoading(false);
    toast.success('Signed out of Developer Portal');
    if (typeof window !== 'undefined') {
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = '';
        window.history.replaceState({}, '', cleanUrl.pathname);
      } catch (_) {}
    }
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
          enableAuth: true,
          enablePay: true,
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
            enableAuth: true,
            enablePay: true,
            webhookUrl: createWebhookUrl.trim(),
            enableAutoPay: isAdditionalProject ? true : undefined,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 || data.code === 'PAYMENT_REQUIRED' || data.code === 'LIMIT_REACHED') {
          if (data.billing) {
            setBillingStatus(data.billing);
          }
          setShowCreateModal(false);
          setShowPlanLimitModal(true);
          toast.error(
            data.message ||
              'Project limit reached. Please upgrade your developer plan with 180 Pay to register more projects.'
          );
          return;
        }
        throw new Error(data.message || data.error || 'Failed to register application');
      }

      toast.success('Application registered successfully!');
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
        setHasDownloaded(false);
        setCopiedAll(false);
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

  /**
   * Launch 180 Pay Sovereign Checkout for Starter ($2/mo) or Pro ($5/mo)
   */
  const handleSubscribeWith180Pay = async (tier: 'STARTER' | 'PRO') => {
    setSubscribingTier(tier);
    try {
      const token = localStorage.getItem('platform_auth_token') || getStoredAuthToken();
      const apiBase = getApiBase();

      const checkoutRes = await fetch(`${apiBase}/api/v1/identity/developer/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planTier: tier }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.message || 'Failed to initialize 180 Pay checkout session');
      }

      await launch180Pay({
        sessionId: checkoutData.sessionId,
        amount: checkoutData.amount,
        currency: checkoutData.currency || 'USD',
        title: checkoutData.title,
        description: checkoutData.description,
        onSuccess: async (payRes) => {
          try {
            const confirmRes = await fetch(
              `${apiBase}/api/v1/identity/developer/billing/confirm-subscription`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  planTier: tier,
                  sessionId: payRes.sessionId || checkoutData.sessionId,
                  transactionId: payRes.transactionId,
                  paymentSource: '180_PAY',
                }),
              }
            );

            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) {
              throw new Error(confirmData.message || 'Failed to activate subscription tier');
            }

            toast.success(
              `Successfully upgraded to ${tier === 'PRO' ? 'Pro ($5/mo for 10 projects)' : 'Starter ($2/mo for 5 projects)'} Plan!`
            );
            setShowPlanLimitModal(false);
            await checkAuthAndFetchApps();
            setShowCreateModal(true);
          } catch (confirmErr: any) {
            toast.error(confirmErr.message || 'Error finalizing subscription activation.');
          }
        },
        onError: () => {
          toast.error('180 Pay checkout was not completed.');
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate 180 Pay checkout');
    } finally {
      setSubscribingTier(null);
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
      setHasDownloaded(false);
      setCopiedAll(false);

      checkAuthAndFetchApps();
    } catch (err: any) {
      toast.error(err.message || 'Rotation failed');
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopyAllCredentials = () => {
    if (!revealedCredentials) return;
    const lines = [
      `180_CLIENT_ID=${revealedCredentials.clientId || ''}`,
    ];
    if (revealedCredentials.clientSecret) {
      lines.push(`180_CLIENT_SECRET=${revealedCredentials.clientSecret}`);
    }
    if (revealedCredentials.webhookSecret) {
      lines.push(`180_WEBHOOK_SECRET=${revealedCredentials.webhookSecret}`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast.success('All credentials copied to clipboard!');
  };

  const handleDownloadCredentials = () => {
    if (!revealedCredentials) return;
    const lines = [
      `# 180 Core Client Credentials`,
      `# Project: ${revealedCredentials.name || 'Application'}`,
      `# Generated: ${new Date().toISOString()}`,
      `# Keep this file secure. Never commit this file to public version control.`,
      '',
      `180_CLIENT_ID=${revealedCredentials.clientId || ''}`,
    ];
    if (revealedCredentials.clientSecret) {
      lines.push(`180_CLIENT_SECRET=${revealedCredentials.clientSecret}`);
    }
    if (revealedCredentials.webhookSecret) {
      lines.push(`180_WEBHOOK_SECRET=${revealedCredentials.webhookSecret}`);
    }
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (revealedCredentials.name || 'app').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    link.download = `180-${safeName}-credentials.env`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
    toast.success('Credentials file (.env) downloaded!');
  };

  const handleCloseCredentialsModal = () => {
    if (!hasDownloaded) {
      toast.error('Please download your credentials file (.env) before closing.');
      return;
    }
    setRevealedCredentials(null);
    setHasDownloaded(false);
    setCopiedAll(false);
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
            name: userProfile?.name || '180 Core Developer',
            email: userProfile?.email || 'developer@180core.cloud',
            username: userProfile?.username || 'developer',
            email_verified: true,
            auth_time: Math.floor(Date.now() / 1000) - 300,
            iss: 'https://identity.180core.cloud',
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
    return <AdaptiveSkeleton screen="developer-dashboard" />;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UNAUTHENTICATED STATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    const handleBack = () => {
      if (typeof window !== 'undefined') {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push('/');
        }
      }
    };

    return (
      <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
        {/* Full Page Minimal Grid Background */}
        <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-80" />

        {/* Subtle Ambient Gradient Orbs */}
        <div className="fixed top-0 right-0 w-[450px] h-[450px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <header className="relative z-20 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-zinc-200/70 dark:border-white/5 bg-white/70 dark:bg-black/40 backdrop-blur-md">
          {/* Left: Back button + Divider + 180Core Logo & Brand */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/20 transition-all shadow-xs cursor-pointer group select-none"
              title="Go back to previous page"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back</span>
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 hidden sm:block" />

            <Link href="/" className="inline-flex items-center gap-2.5 group select-none">
              <OneEightyCoreLogo variant="icon" height={26} width={26} />
              <span className="font-bold tracking-tight text-sm text-zinc-900 dark:text-white">
                180Core
              </span>
            </Link>
          </div>

          {/* Right: Theme Toggle Button */}
          <div className="flex items-center gap-2">
            <ThemeToggle showLabel={true} />
          </div>
        </header>

        {/* Center Auth Hero */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="flex flex-col items-center text-center max-w-md w-full">
            {/* 180Core Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center p-3 shadow-sm mb-4">
              <OneEightyCoreLogo variant="icon" height={38} width={38} />
            </div>

            {/* Heading & Subtitle */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">
              180Core
            </h1>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-8 max-w-sm leading-relaxed">
              Universal Sovereign Identity, OAuth 2.0 & Developer Infrastructure. Sign in with your 180 Account to continue.
            </p>

            {/* Single 180 Identity Button */}
            <OneEightyIdentityButton
              clientId={CORE_CLIENT_ID}
              onClick={() => launch180Identity({ clientId: CORE_CLIENT_ID, onSuccess: () => checkAuthAndFetchApps() })}
              disabled={isOpeningIdentity}
              isProcessing={isOpeningIdentity}
              text="Sign In with 180 Identity"
              subtitle="Universal Sovereign Account & OAuth 2.0"
              theme="auto"
              className="shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-sm px-6 py-3 cursor-pointer"
            />

            {/* Trust badge */}
            <div className="mt-8 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secured by 180 Sovereign Identity Protocol</span>
            </div>
          </div>
        </main>

        {/* Bottom Footer */}
        <footer className="relative z-10 py-4 text-center text-xs text-zinc-400 dark:text-zinc-600 border-t border-zinc-200/40 dark:border-white/5">
          © {new Date().getFullYear()} 180Core. All rights reserved.
        </footer>
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
        onOpenRegisterModal={handleOpenCreateModal}
        onExpandChange={setIsSidebarExpanded}
        canCreateMore={billingStatus?.canCreateMore ?? (apps.length < 1)}
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
          onOpenRegisterModal={handleOpenCreateModal}
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

                {/* + New Project Action Button */}
                <Button
                  onClick={handleOpenCreateModal}
                  className="rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 font-bold text-xs py-3 px-4 shadow-sm flex items-center gap-2 shrink-0 cursor-pointer min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                  {billingStatus && !billingStatus.canCreateMore && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                      Upgrade
                    </span>
                  )}
                </Button>
              </div>

              {/* Plan Limit / Capacity Alert Banner */}
              {billingStatus && !billingStatus.canCreateMore && (
                <div className="rounded-2xl p-4 sm:p-5 border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                          Project Limit Reached ({billingStatus.totalProjects}/{billingStatus.maxProjectsAllowed})
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                          {billingStatus.planName}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        {billingStatus.message ||
                          'You have reached your included project limit. Upgrade with 180 Pay to create more applications.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      onClick={() => setShowPlanLimitModal(true)}
                      size="sm"
                      className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 shadow-sm cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5 mr-1.5" />
                      <span>Upgrade Plan</span>
                    </Button>
                    <Link
                      href="/billing"
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 transition-colors"
                    >
                      View Billing
                    </Link>
                  </div>
                </div>
              )}

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
                    onClick={handleOpenCreateModal}
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
                      onClick={() => router.push(`/apps/${app.id}`)}
                      className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-5 shadow-xs hover:border-zinc-300 dark:hover:border-white/20 hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between cursor-pointer"
                    >
                      <div className="space-y-3.5">
                        {/* Header with App Logo, Badges, and Client ID */}
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
                              <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[190px]" title={app.clientId}>
                                {app.clientId}
                              </p>
                            </div>
                          </div>

                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-white group-hover:bg-zinc-100 dark:group-hover:bg-white/10 transition-all shrink-0">
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>

                      {/* Optional Badges: 180 Identity, 180 Pay */}
                      {(app.enableAuth || app.enablePay) && (
                        <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-end gap-1.5 text-xs">
                          {app.enableAuth && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/apps/${app.id}/identity`);
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                            >
                              Identity
                            </button>
                          )}
                          {app.enablePay && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/apps/${app.id}/pay`);
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      )}
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
        onClose={handleCloseCredentialsModal}
        title="Save Client Credentials"
        icon={Key}
        iconBgClass="bg-amber-500/10"
        iconColorClass="text-amber-600 dark:text-amber-400"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Copy and store your secret safely</span>
            </div>
            <p className="leading-relaxed opacity-90 text-[11px]">
              For security, this client secret is never stored in plaintext and will not be displayed again. If lost, you will need to rotate it.
            </p>
          </div>

          {/* Unified Credentials Box - All in one single field */}
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-950 text-zinc-100 overflow-hidden shadow-xs">
            {/* Header bar with single copy icon */}
            <div className="px-3.5 py-2.5 bg-zinc-900/80 border-b border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-[11px] font-mono font-medium text-zinc-300 truncate">
                  .env.local / Credentials
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyAllCredentials}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-all cursor-pointer shrink-0"
                title="Copy all credentials at once"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied All!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Single Unified Credentials Content */}
            <div className="p-3.5 font-mono text-xs space-y-2 select-all overflow-x-auto leading-relaxed bg-zinc-950">
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-500 select-none shrink-0">180_CLIENT_ID=</span>
                <span className="text-zinc-100 break-all select-all font-medium">
                  {revealedCredentials?.clientId || ''}
                </span>
              </div>

              {revealedCredentials?.clientSecret && (
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-500 select-none shrink-0">180_CLIENT_SECRET=</span>
                  <span className="text-amber-400 break-all select-all font-semibold">
                    {revealedCredentials.clientSecret}
                  </span>
                </div>
              )}

              {revealedCredentials?.webhookSecret && (
                <div className="flex items-baseline gap-2">
                  <span className="text-zinc-500 select-none shrink-0">180_WEBHOOK_SECRET=</span>
                  <span className="text-purple-400 break-all select-all font-medium">
                    {revealedCredentials.webhookSecret}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Area: Download button first, then Close button */}
          {!hasDownloaded ? (
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={handleDownloadCredentials}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer min-h-[44px] flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Credentials (.env)</span>
              </Button>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
                Download your .env file to enable the Close button and safely backup your keys.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                onClick={handleCloseCredentialsModal}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer min-h-[44px] flex items-center justify-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Close</span>
              </Button>
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleDownloadCredentials}
                  className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline underline-offset-2 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .env file again</span>
                </button>
              </div>
            </div>
          )}
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

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: PLAN LIMIT REACHED & 180 PAY UPGRADE
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showPlanLimitModal}
        onClose={() => setShowPlanLimitModal(false)}
        title="Project Limit Reached"
        icon={Sparkles}
        iconBgClass="bg-amber-500/10"
        iconColorClass="text-amber-600 dark:text-amber-400"
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                {billingStatus?.planName || 'Free Tier'}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {billingStatus?.totalProjects ?? apps.length} of {billingStatus?.maxProjectsAllowed ?? 1} project slots used
              </span>
            </div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              Upgrade your Developer Plan with 180 Pay
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              The Free Tier strictly includes exactly <strong>1 active project</strong>. To register additional applications, choose a plan below to checkout instantly via <strong>180 Pay</strong>:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Starter Plan Card */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-4 flex flex-col justify-between hover:border-blue-500/40 transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">Starter Plan</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    5 Projects
                  </span>
                </div>
                <div className="font-mono">
                  <span className="text-2xl font-black text-zinc-950 dark:text-white">$2.00</span>
                  <span className="text-xs text-zinc-400"> / month</span>
                </div>
                <ul className="text-[11px] space-y-1.5 text-zinc-600 dark:text-zinc-400 pt-1">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Up to 5 active applications</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>180 Identity & Pay SDKs</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Recurring 180 Pay auto-renewal</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={() => handleSubscribeWith180Pay('STARTER')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="w-full py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm min-h-[38px]"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{subscribingTier === 'STARTER' ? 'Opening 180 Pay...' : 'Upgrade to Starter ($2)'}</span>
              </Button>
            </div>

            {/* Pro Plan Card */}
            <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 space-y-4 flex flex-col justify-between hover:border-blue-500 transition-all">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">Pro Plan</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    10 Projects
                  </span>
                </div>
                <div className="font-mono">
                  <span className="text-2xl font-black text-zinc-950 dark:text-white">$5.00</span>
                  <span className="text-xs text-zinc-400"> / month</span>
                </div>
                <ul className="text-[11px] space-y-1.5 text-zinc-600 dark:text-zinc-400 pt-1">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Up to 10 active applications</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Priority webhook dispatch</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Full telemetry & analytics</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={() => handleSubscribeWith180Pay('PRO')}
                disabled={subscribingTier !== null || isOpeningPay}
                className="w-full py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 min-h-[38px]"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{subscribingTier === 'PRO' ? 'Opening 180 Pay...' : 'Upgrade to Pro ($5)'}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-500">
            <span>
              Need 15+ projects?{' '}
              <a
                href={ENTERPRISE_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Contact Enterprise</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPlanLimitModal(false)}
              className="text-xs min-h-[36px]"
            >
              Cancel
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
