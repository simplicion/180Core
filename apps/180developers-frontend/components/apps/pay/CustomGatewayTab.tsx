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
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getAuthToken } from '@/lib/api-config';

interface GatewaySettings {
  customGatewayType: 'NONE' | 'RAZORPAY' | 'STRIPE';
  customGatewayKeyId: string;
  customGatewayWebhookSecret: string;
  customPayDomain: string;
  customDomainStatus: string;
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

  const [gatewayType, setGatewayType] = useState<'NONE' | 'RAZORPAY' | 'STRIPE'>('NONE');
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [payDomain, setPayDomain] = useState('');
  const [domainStatus, setDomainStatus] = useState('PENDING_DNS');
  const [hasSecret, setHasSecret] = useState(false);

  const [showSecret, setShowSecret] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const apiBase = getApiBase();
      const token = getAuthToken();
      const res = await fetch(`${apiBase}/api/v1/developer/apps/${appId}/gateway`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const d: GatewaySettings = data.data;
        setGatewayType(d.customGatewayType || 'NONE');
        setKeyId(d.customGatewayKeyId || '');
        setWebhookSecret(d.customGatewayWebhookSecret || '');
        setPayDomain(d.customPayDomain || '');
        setDomainStatus(d.customDomainStatus || 'PENDING_DNS');
        setHasSecret(d.hasSecret || false);
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
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Gateway settings saved successfully!');
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
          toast(data.message || 'DNS record not yet detected. Propagation may take a few minutes.', { icon: '⏳' });
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

        {/* Processing Mode Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Payment Processing Architecture
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Managed Processing */}
            <div
              onClick={() => setGatewayType('NONE')}
              className={`rounded-2xl p-4 border cursor-pointer transition-all ${
                gatewayType === 'NONE'
                  ? 'border-purple-600 bg-purple-500/5 ring-1 ring-purple-600'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-zinc-950 dark:text-white">180 Managed Processing</span>
                {gatewayType === 'NONE' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Default. 180 Workspace collects funds and automatically manages merchant settlements via RazorpayX.
              </p>
            </div>

            {/* Custom Razorpay */}
            <div
              onClick={() => setGatewayType('RAZORPAY')}
              className={`rounded-2xl p-4 border cursor-pointer transition-all ${
                gatewayType === 'RAZORPAY'
                  ? 'border-purple-600 bg-purple-500/5 ring-1 ring-purple-600'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-zinc-950 dark:text-white">Custom Razorpay (BYOG)</span>
                {gatewayType === 'RAZORPAY' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Funds settle 100% directly into your verified Razorpay account. Zero PA intermediary holding.
              </p>
            </div>

            {/* Custom Stripe */}
            <div
              onClick={() => setGatewayType('STRIPE')}
              className={`rounded-2xl p-4 border cursor-pointer transition-all ${
                gatewayType === 'STRIPE'
                  ? 'border-purple-600 bg-purple-500/5 ring-1 ring-purple-600'
                  : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-zinc-950 dark:text-white">Custom Stripe (BYOG)</span>
                {gatewayType === 'STRIPE' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Direct international card and Apple Pay processing deposited straight into your Stripe bank account.
              </p>
            </div>
          </div>
        </div>

        {/* Custom Credentials Form */}
        {gatewayType !== 'NONE' && (
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
              {payDomain ? 'Configured' : 'Default (pay.180workspace.com)'}
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
                <div>Target: <span className="text-emerald-400">cname.180workspace.com</span></div>
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
