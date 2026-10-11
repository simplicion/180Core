'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Settings,
  Copy,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';
import {
  UniversalSkeleton,
} from '@workspace/ui';
import { OneEightyIdentity, OneEightyPay } from '@workspace/identity-sdk';
import {
  DeveloperAppDetail,
  WebhookTestResult,
  AppOverviewDetail,
  IdentityAppDetail,
  PayAppDetail,
  AppModals,
  ProjectSettingsDrawer,
} from '@/components/apps';
import DeveloperSidebar from '@/components/layout/DeveloperSidebar';
import DeveloperHeader from '@/components/layout/DeveloperHeader';

interface AppDetailClientProps {
  initialView?: 'overview' | 'identity' | 'pay';
}

export default function AppDetailClient({ initialView }: AppDetailClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Resilient appId extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialAppId = () => {
    const pId = params?.id as string;
    if (pId && pId !== 'default') return pId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/apps\/([^\/\?#]+)/);
      if (match && match[1] && match[1] !== 'default') return match[1];
    }
    return pId || '';
  };

  const [appId, setAppId] = useState<string>(getInitialAppId);

  useEffect(() => {
    const currentId = getInitialAppId();
    if (currentId && currentId !== appId) {
      setAppId(currentId);
    }
  }, [params?.id]);

  const [app, setApp] = useState<DeveloperAppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sub-view navigation: overview shows app cards, identity/pay have dedicated sub-pages with sidebars
  const paramView = searchParams?.get('view') as 'overview' | 'identity' | 'pay' | null;

  useEffect(() => {
    if (paramView === 'identity' && appId) {
      router.replace(`/apps/${appId}/identity`);
    } else if (paramView === 'pay' && appId) {
      router.replace(`/apps/${appId}/pay`);
    }
  }, [paramView, appId, router]);

  const [activeView, setActiveView] = useState<'overview' | 'identity' | 'pay'>(
    initialView || 'overview'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [apps, setApps] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  const navigateView = (view: 'overview' | 'identity' | 'pay') => {
    if (view === 'identity') {
      router.push(`/apps/${appId}/identity`);
    } else if (view === 'pay') {
      router.push(`/apps/${appId}/pay`);
    } else {
      setActiveView('overview');
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', `/apps/${appId}`);
      }
    }
  };

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [redirectUrisInput, setRedirectUrisInput] = useState('');
  const [allowedOriginsInput, setAllowedOriginsInput] = useState('');
  const [allowedScopes, setAllowedScopes] = useState<string[]>([]);

  // Services & Webhook State
  const [enableAuth, setEnableAuth] = useState(true);
  const [enablePay, setEnablePay] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // UX Display Modes & Device Defaults State
  const [authUxModes, setAuthUxModes] = useState<string[]>(['popup']);
  const [payUxModes, setPayUxModes] = useState<string[]>(['bottom_sheet']);
  const [authDesktopDefault, setAuthDesktopDefault] = useState<string>('popup');
  const [authMobileDefault, setAuthMobileDefault] = useState<string>('bottom_sheet');
  const [payDesktopDefault, setPayDesktopDefault] = useState<string>('bottom_sheet');
  const [payMobileDefault, setPayMobileDefault] = useState<string>('bottom_sheet');

  // Token Lifecycle & Expiration Preferences State
  const [accessTokenTtl, setAccessTokenTtl] = useState<number>(900); // 15 mins standard
  const [refreshTokenDays, setRefreshTokenDays] = useState<number>(7); // 7 days standard

  // Test Webhook Dispatcher State
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  // Secret Rotation Modal
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [newSecretRevealed, setNewSecretRevealed] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [hasAcknowledgedSecret, setHasAcknowledgedSecret] = useState(false);

  // Danger Zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Payout states
  const [payoutBalance, setPayoutBalance] = useState<number>(0);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK_TRANSFER'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [bankAccNumber, setBankAccNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  // Real-Time Auth Logs & Live Users Telemetry
  const [authLogs, setAuthLogs] = useState<{ logs: any[]; totalUsers: number; activeSessionsCount: number } | null>(null);
  const [loadingAuthLogs, setLoadingAuthLogs] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  // Financial Analytics & Transactions Ledger
  const [paymentAnalytics, setPaymentAnalytics] = useState<{
    grossVolume: number;
    thisMonthVolume: number;
    lastMonthVolume: number;
    pendingSettlements: number;
    withdrawableBalance: number;
    currency: string;
    totalTransactionsCount: number;
    transactions: any[];
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Settlement Bank Details State
  const [bankDetails, setBankDetails] = useState<{
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  } | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  // Payment Transactions Search & Filtering
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState<'ALL' | 'CAPTURED' | 'GATEWAY_DROPPED' | 'INTENT_ONLY' | 'FAILED'>('ALL');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Admin Payout Review
  const [showAdminPayoutModal, setShowAdminPayoutModal] = useState(false);
  const [adminPayouts, setAdminPayouts] = useState<any[]>([]);
  const [loadingAdminPayouts, setLoadingAdminPayouts] = useState(false);
  const [updatingPayoutId, setUpdatingPayoutId] = useState<string | null>(null);
  const [payoutAdminNote, setPayoutAdminNote] = useState('');
  const [payoutTxRef, setPayoutTxRef] = useState('');

  const getApiBase = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com');
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response | null> => {
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

  const fetchAuthLogs = async () => {
    setLoadingAuthLogs(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const res = await fetchWithTimeout(`${apiBase}/api/v1/developer/apps/${appId}/auth-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data.success) setAuthLogs(data.data);
      }
    } catch (_) {}
    finally { setLoadingAuthLogs(false); }
  };

  const fetchPaymentAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const res = await fetchWithTimeout(`${apiBase}/api/v1/developer/apps/${appId}/payment-analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setPaymentAnalytics(data.data);
          if (data.data.withdrawableBalance !== undefined) {
            setPayoutBalance(data.data.withdrawableBalance);
          }
        }
      }
    } catch (_) {}
    finally { setLoadingAnalytics(false); }
  };

  const fetchBankDetails = async () => {
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const res = await fetchWithTimeout(`${apiBase}/api/v1/developer/apps/${appId}/bank-details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res && res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setBankDetails(data.data);
          if (data.data.accountHolderName) setBankHolder(data.data.accountHolderName);
          if (data.data.accountNumber) setBankAccNumber(data.data.accountNumber);
          if (data.data.ifscCode) setBankIfsc(data.data.ifscCode);
          if (data.data.upiId) setUpiId(data.data.upiId);
        }
      }
    } catch (_) {}
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankHolder || (!bankAccNumber && !upiId)) {
      toast.error('Account holder name and Account Number or UPI ID are required');
      return;
    }
    setSavingBank(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/developer/apps/${appId}/bank-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountHolderName: bankHolder,
          accountNumber: bankAccNumber,
          ifscCode: bankIfsc,
          upiId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save bank details');
      toast.success('Settlement bank account saved successfully!');
      setBankDetails(data.data);
      setShowBankModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Error saving bank details');
    } finally {
      setSavingBank(false);
    }
  };

  const handleOpenPayoutModal = () => {
    if (!bankDetails || (!bankDetails.accountNumber && !bankDetails.upiId)) {
      toast('Please set up your settlement bank details first', { icon: '🏦' });
      setShowBankModal(true);
      return;
    }
    if (bankDetails.upiId) {
      setPayoutMethod('UPI');
      setUpiId(bankDetails.upiId);
    } else {
      setPayoutMethod('BANK_TRANSFER');
      setBankHolder(bankDetails.accountHolderName || '');
      setBankAccNumber(bankDetails.accountNumber || '');
      setBankIfsc(bankDetails.ifscCode || '');
    }
    setShowPayoutModal(true);
  };

  const handleRevokeUserSession = async (targetUserId: string, userName: string) => {
    if (!confirm(`Revoke active token session for ${userName}? The user will be required to re-authenticate with 180 Identity.`)) {
      return;
    }
    setRevokingUserId(targetUserId);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/developer/apps/${appId}/users/${targetUserId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to revoke user session');
      toast.success(`Session for ${userName} has been terminated`);
      fetchAuthLogs();
    } catch (err: any) {
      toast.error(err.message || 'Error revoking session');
    } finally {
      setRevokingUserId(null);
    }
  };

  const fetchAdminPayoutsAndAnalytics = async () => {
    setLoadingAdminPayouts(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const [payoutsRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/developer/admin/payouts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        if (data.success) setAdminPayouts(data.data || []);
      }
    } catch (_) {}
    finally { setLoadingAdminPayouts(false); }
  };

  const handleOpenAdminPayoutModal = () => {
    setShowAdminPayoutModal(true);
    fetchAdminPayoutsAndAnalytics();
  };

  const handleUpdateAdminPayoutStatus = async (payoutId: string, status: string) => {
    setUpdatingPayoutId(payoutId);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/developer/admin/payouts/${payoutId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          adminNote: payoutAdminNote || undefined,
          transactionRef: payoutTxRef || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update payout status');
      toast.success(`Payout marked as ${status}!`);
      fetchAdminPayoutsAndAnalytics();
      setPayoutAdminNote('');
      setPayoutTxRef('');
    } catch (err: any) {
      toast.error(err.message || 'Error updating payout status');
    } finally {
      setUpdatingPayoutId(null);
    }
  };

  const handleTestAuthModal = () => {
    if (!app) return;
    OneEightyIdentity.openPopup({
      clientId: app.clientId,
      uxMode: 'popup',
      onSuccess: (res) => toast.success(`Auth modal test passed! Code: ${res.code.slice(0, 10)}...`),
      onCancel: () => toast('Auth modal closed', { icon: 'ℹ️' }),
    });
  };

  const handleTestAuthBottomSheet = () => {
    if (!app) return;
    OneEightyIdentity.openBottomSheet({
      clientId: app.clientId,
      uxMode: 'bottom_sheet',
      onSuccess: (res) => toast.success(`Auth bottom sheet test passed! User: ${res.user?.name || res.code.slice(0, 8)}`),
      onCancel: () => toast('Auth bottom sheet closed', { icon: 'ℹ️' }),
    });
  };

  const handleTestPayBottomSheet = () => {
    OneEightyPay.openBottomSheet({
      amount: 499,
      currency: 'INR',
      title: `${app?.name || 'Developer App'} Premium Checkout`,
      description: 'Sandbox verification session',
      onSuccess: (res) => toast.success(`Payment test passed! TxID: ${res.transactionId || res.sessionId}`),
      onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
    });
  };

  useEffect(() => {
    if (appId && appId !== 'default') {
      fetchAppDetails();
      fetchPayouts();
      fetchAuthLogs();
      fetchPaymentAnalytics();
      fetchBankDetails();
    }
  }, [appId]);

  useEffect(() => {
    const fetchAllAppsAndProfile = async () => {
      try {
        const token = localStorage.getItem('platform_auth_token');
        if (!token) return;
        const apiBase = getApiBase();

        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          try {
            setUserProfile(JSON.parse(cachedUser));
          } catch (_) {}
        }

        let listRes = await fetchWithTimeout(`${apiBase}/api/v1/identity/developer/apps`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listRes || !listRes.ok) {
          listRes = await fetchWithTimeout(`${apiBase}/api/oauth/developer/apps`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        if (listRes && listRes.ok) {
          const listData = await listRes.json();
          const parsed = (listData.apps || listData || []).map((a: any) => ({
            id: a.id,
            name: a.name,
            clientId: a.clientId,
            logoUrl: a.logoUrl,
            enableAuth: a.enableAuth ?? true,
            enablePay: a.enablePay ?? true,
          }));
          setApps(parsed);
        }
      } catch (_) {}
    };

    fetchAllAppsAndProfile();
  }, []);

  const fetchPayouts = async () => {
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      let res = await fetchWithTimeout(`${apiBase}/api/v1/identity/developer/apps/${appId}/payouts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res || !res.ok) {
        res = await fetchWithTimeout(`${apiBase}/api/oauth/developer/apps/${appId}/payouts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data.success) {
          setPayoutBalance(data.data.availableBalance || 0);
          setPayouts(data.data.payouts || []);
        }
      }
    } catch (e) {}
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(payoutAmount);
    if (!amountNum || amountNum < 100) {
      toast.error('Minimum payout amount is ₹100');
      return;
    }
    if (amountNum > payoutBalance) {
      toast.error('Requested amount exceeds available balance');
      return;
    }

    setIsRequestingPayout(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();
      let res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          payoutMethod,
          accountDetails:
            payoutMethod === 'UPI'
              ? { upiId }
              : { accountNumber: bankAccNumber, ifscCode: bankIfsc, accountHolderName: bankHolder },
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to submit payout request');

      toast.success('Payout request submitted for review!');
      setShowPayoutModal(false);
      setPayoutAmount('');
      fetchPayouts();
    } catch (err: any) {
      toast.error(err.message || 'Payout request failed');
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const fetchAppDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) {
        throw new Error('Failed to load application details');
      }

      const data = await res.json();
      const appData = data.app;
      setApp(appData);
      setName(appData.name);
      setDescription(appData.description || '');
      setLogoUrl(appData.logoUrl || '');
      setRedirectUrisInput((appData.redirectUris || []).join('\n'));
      setAllowedOriginsInput((appData.allowedOrigins || []).join('\n'));
      setAllowedScopes(appData.allowedScopes || []);
      setEnableAuth(appData.enableAuth ?? true);
      setEnablePay(appData.enablePay ?? true);
      setWebhookUrl(appData.webhookUrl || '');
      setWebhookSecret(appData.webhookSecret || '');
      setAuthUxModes(appData.authUxModes || ['popup']);
      setPayUxModes(appData.payUxModes || ['bottom_sheet']);
      setAuthDesktopDefault(appData.authDesktopDefault || 'popup');
      setAuthMobileDefault(appData.authMobileDefault || 'bottom_sheet');
      setPayDesktopDefault(appData.payDesktopDefault || 'bottom_sheet');
      setPayMobileDefault(appData.payMobileDefault || 'bottom_sheet');
      setAccessTokenTtl(appData.accessTokenTtl || 900);
      setRefreshTokenDays(appData.refreshTokenDays || 7);
    } catch (err: any) {
      toast.error(err.message || 'Error loading application');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveChanges = async (e?: React.FormEvent | React.SyntheticEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('App name cannot be empty');
      return;
    }
    if (!logoUrl.trim()) {
      toast.error('App logo URL is strictly required');
      return;
    }

    const redirectUris = redirectUrisInput
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    const isProd = window.location.protocol === 'https:';
    for (const uri of redirectUris) {
      if (isProd && !uri.startsWith('https://') && !uri.startsWith('http://localhost') && !uri.startsWith('http://127.0.0.1')) {
        if (!uri.includes('://')) {
          toast.error(`Invalid redirect URI format: ${uri}`);
          return;
        }
      }
    }

    const allowedOrigins = allowedOriginsInput
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${appId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          logoUrl: logoUrl.trim() || undefined,
          redirectUris,
          allowedOrigins,
          allowedScopes,
          enableAuth,
          enablePay,
          webhookUrl: webhookUrl.trim(),
          authUxModes,
          payUxModes,
          authDesktopDefault,
          authMobileDefault,
          payDesktopDefault,
          payMobileDefault,
          accessTokenTtl,
          refreshTokenDays,
        }),
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            logoUrl: logoUrl.trim() || undefined,
            redirectUris,
            allowedOrigins,
            allowedScopes,
            enableAuth,
            enablePay,
            webhookUrl: webhookUrl.trim(),
            authUxModes,
            payUxModes,
            authDesktopDefault,
            authMobileDefault,
            payDesktopDefault,
            payMobileDefault,
            accessTokenTtl,
            refreshTokenDays,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to save settings');
      }

      toast.success('Configuration saved successfully');
      fetchAppDetails();
    } catch (err: any) {
      toast.error(err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast.error('Please specify a webhook destination URL first');
      return;
    }

    setIsTestingWebhook(true);
    setTestResult(null);

    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${appId}/test-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}/test-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: webhookUrl.trim() }),
        });
      }

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
        toast.success(`Webhook test delivered! HTTP ${data.statusCode} (${data.latencyMs}ms)`);
      } else {
        toast.error(`Webhook test responded with HTTP ${data.statusCode}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch test webhook');
      setTestResult({
        success: false,
        statusCode: 0,
        latencyMs: 0,
        signature: '',
        targetUrl: webhookUrl,
        message: err.message,
        response: 'Connection or timeout error reaching webhook endpoint',
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleRotateSecret = async () => {
    setIsRotating(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${appId}/rotate-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}/rotate-secret`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Rotation failed');

      setNewSecretRevealed(data.clientSecret);
      setSecretCopied(false);
      setHasAcknowledgedSecret(false);
      fetchAppDetails();
    } catch (err: any) {
      toast.error(err.message || 'Rotation failed');
    } finally {
      setIsRotating(false);
    }
  };

  const handleRevokeTokens = async () => {
    if (!confirm('Are you sure you want to revoke all issued tokens for this application? All active user sessions using this app will be terminated.')) {
      return;
    }

    setIsRevoking(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${appId}/revoke-tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}/revoke-tokens`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) throw new Error('Revocation failed');
      toast.success('All active tokens revoked successfully');
    } catch (err: any) {
      toast.error(err.message || 'Token revocation failed');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDeleteApp = async () => {
    if (deleteConfirmText !== app?.name) {
      toast.error('Application name does not match');
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const apiBase = getApiBase();

      let res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${appId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        res = await fetch(`${apiBase}/api/oauth/developer/apps/${appId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) throw new Error('Deletion failed');
      toast.success('Application deleted');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors duration-200">
        <DeveloperSidebar
          activeTab="apps"
          onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
          isMobileOpen={false}
          onMobileClose={() => {}}
          appCount={apps.length || 1}
          apps={apps}
          currentAppId={appId}
          onExpandChange={setIsSidebarExpanded}
          userProfile={userProfile}
          onSignOut={() => {
            localStorage.removeItem('platform_auth_token');
            router.push('/');
          }}
        />
        <div
          className={`flex-1 ${
            isSidebarExpanded
              ? 'lg:ml-[280px] lg:w-[calc(100%-280px)]'
              : 'lg:ml-[80px] lg:w-[calc(100%-80px)]'
          } flex flex-col min-h-screen transition-all duration-300 ease-in-out`}
        >
          <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
            <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 shadow-sm">
              <UniversalSkeleton type="form" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-12 text-center space-y-4 max-w-lg mx-auto shadow-sm dark:shadow-2xl">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Project not found</p>
          <Link href="/dashboard" className="text-xs text-zinc-900 dark:text-white font-bold hover:underline">
            Return to Projects List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors duration-200">
      <DeveloperSidebar
        activeTab="apps"
        onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        appCount={apps.length || 1}
        apps={apps}
        currentAppId={appId}
        onExpandChange={setIsSidebarExpanded}
        userProfile={userProfile}
        onSignOut={() => {
          localStorage.removeItem('platform_auth_token');
          router.push('/');
        }}
      />
      <div
        className={`flex-1 ${
          isSidebarExpanded
            ? 'lg:ml-[280px] lg:w-[calc(100%-280px)]'
            : 'lg:ml-[80px] lg:w-[calc(100%-80px)]'
        } flex flex-col min-h-screen transition-all duration-300 ease-in-out`}
      >
        <DeveloperHeader
          onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          activeTabTitle={app.name}
          onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
          userProfile={userProfile}
          breadcrumbs={[
            { label: 'Projects', href: '/dashboard' },
            { label: app.name },
          ]}
          onSignOut={() => {
            localStorage.removeItem('platform_auth_token');
            router.push('/');
          }}
        />
        <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-8 flex-1">
          {/* Dynamic Header */}
          <div className="space-y-3 pb-6 border-b border-zinc-200 dark:border-white/10">
            {activeView === 'overview' ? (
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Projects</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => navigateView('overview')}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:underline flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to {app.name}</span>
              </button>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                    {activeView === 'overview' ? app.name : activeView === 'identity' ? '180 Identity' : '180 Pay'}
                  </h1>
                  {activeView === 'overview' && app.isVerified && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                  {activeView === 'identity' && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${enableAuth ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                      {enableAuth ? 'Active' : 'Disabled'}
                    </span>
                  )}
                  {activeView === 'pay' && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${enablePay ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                      {enablePay ? 'Active' : 'Disabled'}
                    </span>
                  )}
                  {activeView === 'overview' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {activeView === 'overview'
                      ? `Client ID: ${app.clientId}`
                      : activeView === 'identity'
                      ? 'Universal login, WhatsApp OTP, Google SSO & unified @usernames'
                      : '180 Wallet & UPI checkout with 2-way verification'}
                  </p>
                  {activeView === 'overview' && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(app.clientId, 'client_hdr')}
                      className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                      title="Copy Client ID"
                    >
                      {copiedKey === 'client_hdr' ? (
                        <span className="text-[10px] text-emerald-500 font-sans font-bold">Copied</span>
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={
                    activeView === 'pay'
                      ? getDocsUrl(DOCS_LINKS.PAY_QUICKSTART)
                      : activeView === 'identity'
                      ? getDocsUrl(DOCS_LINKS.IDENTITY_QUICKSTART)
                      : getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 min-h-[44px] flex items-center gap-1.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shadow-sm transition-all cursor-pointer"
                >
                  <span>
                    {activeView === 'pay'
                      ? '180 Pay Docs'
                      : activeView === 'identity'
                      ? '180 Identity Docs'
                      : 'SDK Documentation'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>
                {activeView === 'overview' && (
                  <button
                    type="button"
                    onClick={() => setIsSettingsDrawerOpen(true)}
                    className="px-3.5 py-2 min-h-[44px] flex items-center gap-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shadow-sm transition-all cursor-pointer group"
                    title="Project Settings"
                    aria-label="Open Project Settings"
                  >
                    <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                    <span>Settings</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              VIEW 1: OVERVIEW HUB (Credentials, Reusable App Cards, Quickstart)
              ═══════════════════════════════════════════════════════════════════════ */}
          {activeView === 'overview' && (
            <AppOverviewDetail
              app={app}
              enableAuth={enableAuth}
              enablePay={enablePay}
              copiedKey={copiedKey}
              copyToClipboard={copyToClipboard}
              onOpenIdentity={() => navigateView('identity')}
              onOpenPay={() => navigateView('pay')}
              onRotateSecretClick={() => setShowRotateModal(true)}
              onOpenSettings={() => setIsSettingsDrawerOpen(true)}
            />
          )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 2: DEDICATED 180 IDENTITY DETAIL PAGE
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'identity' && (
        <IdentityAppDetail
          app={app}
          enableAuth={enableAuth}
          setEnableAuth={setEnableAuth}
          authUxModes={authUxModes}
          setAuthUxModes={setAuthUxModes}
          authDesktopDefault={authDesktopDefault}
          setAuthDesktopDefault={setAuthDesktopDefault}
          authMobileDefault={authMobileDefault}
          setAuthMobileDefault={setAuthMobileDefault}
          accessTokenTtl={accessTokenTtl}
          setAccessTokenTtl={setAccessTokenTtl}
          refreshTokenDays={refreshTokenDays}
          setRefreshTokenDays={setRefreshTokenDays}
          authLogs={authLogs}
          loadingAuthLogs={loadingAuthLogs}
          fetchAuthLogs={fetchAuthLogs}
          handleRevokeUserSession={handleRevokeUserSession}
          revokingUserId={revokingUserId}
          copiedKey={copiedKey}
          copyToClipboard={copyToClipboard}
          onTestPopup={handleTestAuthModal}
          onTestBottomSheet={handleTestAuthBottomSheet}
          onSave={handleSaveChanges}
          saving={saving}
          onBack={() => navigateView('overview')}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 3: DEDICATED 180 PAY DETAIL PAGE
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'pay' && (
        <PayAppDetail
          app={app}
          enablePay={enablePay}
          setEnablePay={setEnablePay}
          webhookUrl={webhookUrl}
          setWebhookUrl={setWebhookUrl}
          webhookSecret={webhookSecret}
          payUxModes={payUxModes}
          setPayUxModes={setPayUxModes}
          payDesktopDefault={payDesktopDefault}
          setPayDesktopDefault={setPayDesktopDefault}
          payMobileDefault={payMobileDefault}
          setPayMobileDefault={setPayMobileDefault}
          testResult={testResult}
          isTestingWebhook={isTestingWebhook}
          onTestWebhook={handleTestWebhook}
          onRotateWebhookSecret={() => {
            setShowRotateModal(true);
          }}
          onTestPayDrawer={handleTestPayBottomSheet}
          paymentAnalytics={paymentAnalytics}
          loadingAnalytics={loadingAnalytics}
          fetchPaymentAnalytics={fetchPaymentAnalytics}
          txSearchQuery={txSearchQuery}
          setTxSearchQuery={setTxSearchQuery}
          txStatusFilter={txStatusFilter}
          setTxStatusFilter={setTxStatusFilter}
          onSelectTx={(tx) => setSelectedTx(tx)}
          payoutBalance={payoutBalance}
          payoutHistory={payouts}
          loadingPayoutHistory={false}
          fetchPayoutHistory={fetchPayouts}
          bankDetails={bankDetails}
          onRequestPayoutClick={handleOpenPayoutModal}
          onSetupBankClick={() => setShowBankModal(true)}
          onAdminReviewClick={handleOpenAdminPayoutModal}
          onSave={handleSaveChanges}
          saving={saving}
          onBack={() => navigateView('overview')}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CENTRALIZED MODALS (SECRET ROTATION, PAYOUTS, BANK, DELETE, AUDIT)
          ═══════════════════════════════════════════════════════════════════════ */}
      <AppModals
        app={app}
        showRotateModal={showRotateModal}
        setShowRotateModal={setShowRotateModal}
        isRotating={isRotating}
        handleRotateSecret={handleRotateSecret}
        newSecretRevealed={newSecretRevealed}
        setNewSecretRevealed={setNewSecretRevealed}
        secretCopied={secretCopied}
        setSecretCopied={setSecretCopied}
        hasAcknowledgedSecret={hasAcknowledgedSecret}
        setHasAcknowledgedSecret={setHasAcknowledgedSecret}
        copyToClipboard={copyToClipboard}
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        handleDeleteApp={handleDeleteApp}
        isDeleting={isDeleting}
        showPayoutModal={showPayoutModal}
        setShowPayoutModal={setShowPayoutModal}
        payoutBalance={payoutBalance}
        payoutAmount={payoutAmount}
        setPayoutAmount={setPayoutAmount}
        payoutMethod={payoutMethod}
        setPayoutMethod={setPayoutMethod}
        upiId={upiId}
        setUpiId={setUpiId}
        bankAccNumber={bankAccNumber}
        setBankAccNumber={setBankAccNumber}
        bankIfsc={bankIfsc}
        setBankIfsc={setBankIfsc}
        bankHolder={bankHolder}
        setBankHolder={setBankHolder}
        handleRequestPayout={handleRequestPayout}
        isRequestingPayout={isRequestingPayout}
        showBankModal={showBankModal}
        setShowBankModal={setShowBankModal}
        handleSaveBankDetails={handleSaveBankDetails}
        savingBank={savingBank}
        selectedTx={selectedTx}
        setSelectedTx={setSelectedTx}
        copiedKey={copiedKey}
        showAdminPayoutModal={showAdminPayoutModal}
        setShowAdminPayoutModal={setShowAdminPayoutModal}
        adminPayouts={adminPayouts}
        loadingAdminPayouts={loadingAdminPayouts}
        updatingPayoutId={updatingPayoutId}
        payoutTxRef={payoutTxRef}
        setPayoutTxRef={setPayoutTxRef}
        payoutAdminNote={payoutAdminNote}
        setPayoutAdminNote={setPayoutAdminNote}
        handleUpdateAdminPayoutStatus={handleUpdateAdminPayoutStatus}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          UNIVERSAL PROJECT SETTINGS DRAWER
          ═══════════════════════════════════════════════════════════════════════ */}
      <ProjectSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        app={app}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        redirectUrisInput={redirectUrisInput}
        setRedirectUrisInput={setRedirectUrisInput}
        allowedOriginsInput={allowedOriginsInput}
        setAllowedOriginsInput={setAllowedOriginsInput}
        onSave={handleSaveChanges}
        saving={saving}
        onRevokeTokens={handleRevokeTokens}
        isRevoking={isRevoking}
        onDeleteAppClick={() => {
          setIsSettingsDrawerOpen(false);
          setShowDeleteModal(true);
        }}
        copiedKey={copiedKey}
        copyToClipboard={copyToClipboard}
        onRotateSecretClick={() => {
          setIsSettingsDrawerOpen(false);
          setShowRotateModal(true);
        }}
      />
        </main>
      </div>
    </div>
  );
}
