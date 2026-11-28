'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Globe,
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
  RefreshCw,
  Server,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Copy,
  Check,
  BellRing,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getAuthToken } from '@/lib/api-config';

interface GatewaySettings {
  customGatewayType: 'NONE' | 'RAZORPAY' | 'STRIPE' | 'DIRECT_UPI';
  customGatewayKeyId: string;
  customGatewayWebhookSecret: string;
  customPayDomain: string;
  customDomainStatus: string;
  customUpiId?: string;
  customUpiName?: string;
  enableDirectUpi?: boolean;
  enablePlatformGateway?: boolean;
  hasSecret: boolean;
}

interface CustomGatewayTabProps {
  appId: string;
}

export function CustomGatewayTab({ appId }: CustomGatewayTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);

  const [enableDirectUpi, setEnableDirectUpi] = useState(true);
  const [enablePlatformGateway, setEnablePlatformGateway] = useState(true);
  const [gatewayType, setGatewayType] = useState<'NONE' | 'RAZORPAY' | 'STRIPE' | 'DIRECT_UPI'>('NONE');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [payDomain, setPayDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState('PENDING_DNS');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [hasSecret, setHasSecret] = useState(false);

  const [showSecret, setShowSecret] = useState(false);
  const [bankListener, setBankListener] = useState<{
    appId: string;
    clientId: string;
    webhookUrl: string;
    bankListenerSecret: string;
    inboundAlertAddress: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyText = (label: string, value: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value);
      setCopiedField(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const [res, listenerRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/developer/apps/${appId}/gateway`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch(`${apiBase}/api/v1/developer/apps/${appId}/bank-listener`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => null),
      ]);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const d: GatewaySettings = data.data;
        setGatewayType(d.customGatewayType || 'NONE');
        setKeyId(d.customGatewayKeyId || '');
        setWebhookSecret(d.customGatewayWebhookSecret || '');
        setPayDomain(d.customPayDomain || '');
        setDomainStatus(d.customDomainStatus || 'PENDING_DNS');
        setUpiId(d.customUpiId || '');
        setUpiName(d.customUpiName || '');
        setEnableDirectUpi(d.enableDirectUpi !== false);
        setEnablePlatformGateway(d.enablePlatformGateway !== false);
        setHasSecret(d.hasSecret || false);
      }
      if (listenerRes && listenerRes.ok) {
        const listenerData = await listenerRes.json();
        if (listenerData.success && listenerData.data) {
          setBankListener(listenerData.data);
        }
      }
    } catch {
      toast.error('Failed to load gateway settings');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (enableDirectUpi && !upiId.trim()) {
      toast.error('Please enter a valid receiving UPI ID (e.g. username@bank)');
      return;
    }
    if (!enableDirectUpi && !enablePlatformGateway) {
      toast.error('At least one payment rail (Direct UPI or 180 Pay Gateway) must be enabled.');
      return;
    }
    setSaving(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/api/v1/developer/apps/${appId}/gateway`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customGatewayType: gatewayType,
          customGatewayKeyId: keyId.trim(),
          customGatewaySecret: keySecret.trim() || undefined,
          customGatewayWebhookSecret: webhookSecret.trim(),
          customPayDomain: payDomain.trim(),
          customUpiId: upiId.trim(),
          customUpiName: upiName.trim(),
          enableDirectUpi,
          enablePlatformGateway,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Gateway & payment rail settings saved successfully!');
        if (keySecret) {
          setHasSecret(true);
          setKeySecret('');
        }
      } else {
        toast.error(data.error || 'Failed to save gateway settings');
      }
    } catch {
      toast.error('Network error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyCredentials = async () => {
    if (!keyId.trim()) {
      toast.error('Key ID is required for verification');
      return;
    }
    if (!keySecret.trim() && !hasSecret) {
      toast.error('Key Secret is required for verification');
      return;
    }

    setVerifying(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/api/v1/developer/apps/${appId}/gateway/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          keyId: keyId.trim(),
          keySecret: keySecret.trim(),
          gatewayType,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Credentials verified successfully!');
      } else {
        toast.error(data.error || 'Credentials verification failed');
      }
    } catch {
      toast.error('Could not verify credentials');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!payDomain.trim()) {
      toast.error('Please enter a custom subdomain first and save settings');
      return;
    }

    setVerifyingDomain(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/api/v1/developer/apps/${appId}/custom-domain/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDomainStatus(data.status || 'PENDING');
        if (data.verified) {
          toast.success(data.message || 'CNAME successfully verified!');
        } else {
          toast(data.message || 'DNS record not yet detected. Propagation may take a few minutes.');
        }
      } else {
        toast.error(data.error || 'Failed to verify DNS');
      }
    } catch {
      toast.error('Network error during DNS verification');
    } finally {
      setVerifyingDomain(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-8 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
        <span className="text-xs text-zinc-500 ml-2">Loading gateway settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview & Save Bar */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Bring Your Own Gateway (BYOG) & Custom Domain</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Route payments directly to your official Razorpay or Stripe account, and white-label checkout under your custom subdomain.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-purple-600/20"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Settings</span>
          </Button>
        </div>

        {/* Dual-Rail Payment Activation Panel */}
        <div className="space-y-6">
          <div className="border-b border-zinc-200 dark:border-white/10 pb-2">
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Payment Rails & Gateway Activation
            </label>
            <p className="text-xs text-zinc-500 mt-1">
              Configure which payment rails your checkout sheet presents to customers. You can enable Direct Native UPI, 180 Pay Gateway, or both simultaneously in dual-rail mode.
            </p>
          </div>

          {/* Rail 1: Direct Native UPI */}
          <div className={`rounded-2xl border transition-all p-5 space-y-4 ${
            enableDirectUpi
              ? 'border-purple-600/50 bg-purple-500/[0.03] dark:bg-purple-500/[0.05]'
              : 'border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/30'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-bold text-zinc-950 dark:text-white">
                    Rail 1: Direct Native UPI (Zero API Keys or Secrets)
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    enableDirectUpi
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {enableDirectUpi ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Customers pay directly to your personal or business bank account via Google Pay, PhonePe, Paytm, or dynamic QR code. Zero transaction cut and automatic verification.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEnableDirectUpi(!enableDirectUpi)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  enableDirectUpi ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enableDirectUpi ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {enableDirectUpi ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-purple-500/10">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Receiving UPI ID / VPA <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. yourname@okhdfc or business@icici"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    The UPI ID linked to your bank account where customer payments will directly land.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Display Business / Store Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Studio"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    The payee name shown to customers inside Google Pay, PhonePe, and Paytm.
                  </span>
                </div>

                {bankListener && (
                  <div className="sm:col-span-2 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06] p-4 space-y-3 mt-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-bold text-zinc-950 dark:text-white">
                          Zero-Typing Bank Alert Auto-Verification (Method A &amp; Method B)
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        Instant 2s Match
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      Connect your Bank Email Alert forwarder (Gmail/Outlook) or Android Notification Listener (MacroDroid/Tasker) to this endpoint. Incoming bank credit alerts automatically match and verify customer payments in real time without manual UTR entry.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Bank Listener Webhook URL
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-zinc-900 dark:text-zinc-100 truncate">
                            {bankListener.webhookUrl}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyText('Webhook URL', bankListener.webhookUrl)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer shrink-0"
                          >
                            {copiedField === 'Webhook URL' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                          Listener Secret Header (x-180-bank-secret)
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-zinc-900 dark:text-zinc-100 truncate">
                            {bankListener.bankListenerSecret}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyText('Listener Secret', bankListener.bankListenerSecret)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer shrink-0"
                          >
                            {copiedField === 'Listener Secret' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic pt-1">
                Direct UPI rail is currently disabled for this app. Customers will not see UPI app intent buttons or dynamic QR codes.
              </p>
            )}
          </div>

          {/* Rail 2: 180 Pay Gateway */}
          <div className={`rounded-2xl border transition-all p-5 space-y-4 ${
            enablePlatformGateway
              ? 'border-purple-600/50 bg-purple-500/[0.03] dark:bg-purple-500/[0.05]'
              : 'border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/30'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-bold text-zinc-950 dark:text-white">
                    Rail 2: 180 Pay Gateway (Cards, Netbanking & Aggregator)
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    enablePlatformGateway
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {enablePlatformGateway ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Accept Credit/Debit Cards, Netbanking, International Currencies, and Apple Pay via 180 Managed Processing or custom BYOG credentials.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEnablePlatformGateway(!enablePlatformGateway)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                  enablePlatformGateway ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enablePlatformGateway ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {enablePlatformGateway ? (
              <div className="space-y-4 pt-3 border-t border-purple-500/10">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Gateway Processing Architecture
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Managed Processing */}
                  <div
                    onClick={() => setGatewayType('NONE')}
                    className={`rounded-xl p-3.5 border cursor-pointer transition-all ${
                      gatewayType === 'NONE'
                        ? 'border-purple-600 bg-purple-500/10 ring-1 ring-purple-600'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-950 dark:text-white">180 Managed Processing</span>
                      {gatewayType === 'NONE' && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Default. 180 Core collects funds and automatically manages merchant settlements via RazorpayX.
                    </p>
                  </div>

                  {/* Custom Razorpay */}
                  <div
                    onClick={() => setGatewayType('RAZORPAY')}
                    className={`rounded-xl p-3.5 border cursor-pointer transition-all ${
                      gatewayType === 'RAZORPAY'
                        ? 'border-purple-600 bg-purple-500/10 ring-1 ring-purple-600'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-950 dark:text-white">Custom Razorpay (BYOG)</span>
                      {gatewayType === 'RAZORPAY' && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Funds settle 100% directly into your verified Razorpay account. Zero platform intermediary holding.
                    </p>
                  </div>

                  {/* Custom Stripe */}
                  <div
                    onClick={() => setGatewayType('STRIPE')}
                    className={`rounded-xl p-3.5 border cursor-pointer transition-all ${
                      gatewayType === 'STRIPE'
                        ? 'border-purple-600 bg-purple-500/10 ring-1 ring-purple-600'
                        : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-zinc-950 dark:text-white">Custom Stripe (BYOG)</span>
                      {gatewayType === 'STRIPE' && <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Direct international card and Apple Pay processing deposited straight into your Stripe bank account.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic pt-1">
                Gateway processing rail is disabled. Customers will only be able to pay via Direct Native UPI.
              </p>
            )}
          </div>
        </div>

        {/* Custom Gateway Credentials Form (Razorpay or Stripe) */}
        {(gatewayType === 'RAZORPAY' || gatewayType === 'STRIPE') && (
          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                <span>{gatewayType === 'RAZORPAY' ? 'Razorpay API Credentials' : 'Stripe API Credentials'}</span>
              </h3>
              <Button
                type="button"
                onClick={handleVerifyCredentials}
                disabled={verifying}
                className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
              >
                {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                <span>Verify Credentials</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  {gatewayType === 'RAZORPAY' ? 'Key ID (rzp_live_...)' : 'Publishable Key (pk_live_...)'}
                </label>
                <input
                  type="text"
                  placeholder={gatewayType === 'RAZORPAY' ? 'rzp_live_xxxxxxxxxxxxxx' : 'pk_live_xxxxxxxxxxxxxx'}
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  {gatewayType === 'RAZORPAY' ? 'Key Secret' : 'Secret Key (sk_live_...)'}
                  {hasSecret && <span className="text-emerald-500 ml-2 font-normal">(Configured on server)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={hasSecret ? '••••••••••••••••••••••••' : 'Enter secret key'}
                    value={keySecret}
                    onChange={(e) => setKeySecret(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Webhook Signing Secret (Optional)
              </label>
              <input
                type="text"
                placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxx"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* Custom Subdomain Section */}
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-500" />
              <span>Custom Checkout Subdomain (KYC Domain Whitelisting)</span>
            </h3>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                payDomain
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              {payDomain ? 'Configured' : 'Default (pay.180core.cloud)'}
            </span>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Payment gateways like Razorpay verify your business website during KYC onboarding. Connecting a subdomain like{' '}
            <code className="text-purple-600 dark:text-purple-400 font-mono">pay.yourdomain.com</code> ensures all checkout requests originate from your approved domain, eliminating origin rejection errors.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Your Custom Subdomain
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. pay.mysaasbrand.com"
                  value={payDomain}
                  onChange={(e) => setPayDomain(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Button
                  type="button"
                  onClick={handleVerifyDomain}
                  disabled={verifyingDomain || !payDomain}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3.5 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm"
                >
                  {verifyingDomain ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Verify DNS</span>
                </Button>
              </div>
            </div>

            {/* DNS Instructions Card */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Required DNS Record (Cloudflare / Namecheap / GoDaddy)
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    domainStatus === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {domainStatus === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {domainStatus === 'ACTIVE' ? 'CNAME Verified & Active' : 'Pending DNS Propagation'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-black/40 font-mono text-[11px] text-zinc-200 border border-white/5">
                <div>Type: <span className="text-purple-400">CNAME</span></div>
                <div>Host: <span className="text-purple-400">{payDomain ? payDomain.split('.')[0] : 'pay'}</span></div>
                <div>Target: <span className="text-emerald-400">cname.180core.cloud</span></div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                <span>SSL certificates are auto-provisioned via Let's Encrypt once your CNAME resolves.</span>
                {payDomain && domainStatus === 'ACTIVE' && (
                  <a
                    href={`https://${payDomain}/checkout/test`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium"
                  >
                    <span>Test on Subdomain</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
