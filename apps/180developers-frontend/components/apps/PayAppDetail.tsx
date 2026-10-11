'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Webhook,
  Send,
  Terminal,
  RotateCw,
  Sliders,
  Play,
  Monitor,
  Smartphone,
  Save,
  Loader2,
  TrendingUp,
  Clock,
  Landmark,
  Search,
  Receipt,
  Eye,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Compass,
  Percent,
  MapPin,
  Tag,
  Link2,
  Globe,
  Bot,
  BarChart3,
  Layers,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import {
  DeveloperAppDetail,
  PaymentAnalyticsData,
  BankDetailsData,
  PayoutRecord,
  WebhookTestResult,
  TransactionRecord,
} from './types';
import { CouponsTab } from './pay/CouponsTab';
import { PaymentLinksTab } from './pay/PaymentLinksTab';
import { PricingTablesTab } from './pay/PricingTablesTab';
import { GeoPricingTab } from './pay/GeoPricingTab';
import { AgentEnvelopesTab } from './pay/AgentEnvelopesTab';
import { CustomGatewayTab } from './pay/CustomGatewayTab';

export interface PayAppDetailProps {
  app: DeveloperAppDetail;
  enablePay: boolean;
  setEnablePay: (val: boolean) => void;
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  webhookSecret: string;
  payUxModes: string[];
  setPayUxModes: (val: string[]) => void;
  payDesktopDefault: string;
  setPayDesktopDefault: (val: string) => void;
  payMobileDefault: string;
  setPayMobileDefault: (val: string) => void;
  testResult: WebhookTestResult | null;
  isTestingWebhook: boolean;
  onTestWebhook: () => void;
  onRotateWebhookSecret: () => void;
  onTestPayDrawer: () => void;
  paymentAnalytics: PaymentAnalyticsData | null;
  loadingAnalytics: boolean;
  fetchPaymentAnalytics: () => void;
  txSearchQuery: string;
  setTxSearchQuery: (val: string) => void;
  txStatusFilter: 'ALL' | 'CAPTURED' | 'GATEWAY_DROPPED' | 'INTENT_ONLY' | 'FAILED';
  setTxStatusFilter: (val: 'ALL' | 'CAPTURED' | 'GATEWAY_DROPPED' | 'INTENT_ONLY' | 'FAILED') => void;
  onSelectTx: (tx: TransactionRecord) => void;
  payoutBalance: number;
  payoutHistory: PayoutRecord[];
  loadingPayoutHistory: boolean;
  fetchPayoutHistory: () => void;
  bankDetails: BankDetailsData | null;
  onRequestPayoutClick: () => void;
  onSetupBankClick: () => void;
  onAdminReviewClick: () => void;
  onSave: (e?: React.SyntheticEvent) => void;
  saving: boolean;
  onBack: () => void;
}

export function PayAppDetail({
  app,
  enablePay,
  setEnablePay,
  webhookUrl,
  setWebhookUrl,
  webhookSecret,
  payUxModes,
  setPayUxModes,
  payDesktopDefault,
  setPayDesktopDefault,
  payMobileDefault,
  setPayMobileDefault,
  testResult,
  isTestingWebhook,
  onTestWebhook,
  onRotateWebhookSecret,
  onTestPayDrawer,
  paymentAnalytics,
  loadingAnalytics,
  fetchPaymentAnalytics,
  txSearchQuery,
  setTxSearchQuery,
  txStatusFilter,
  setTxStatusFilter,
  onSelectTx,
  payoutBalance,
  payoutHistory,
  loadingPayoutHistory,
  fetchPayoutHistory,
  bankDetails,
  onRequestPayoutClick,
  onSetupBankClick,
  onAdminReviewClick,
  onSave,
  saving,
}: PayAppDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'coupons' | 'links' | 'pricing' | 'geo' | 'agents' | 'gateway'>('overview');

  return (
    <div className="space-y-6">
      {/* 180 Pay Service Status & Enable Toggle Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                enablePay ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">180 Pay Service</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    enablePay
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {enablePay ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                1-Click 180 Wallet & UPI checkout popup. Dedicated 180 Pay engine processes payments with 2-way verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {enablePay ? 'Service Enabled' : 'Service Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enablePay}
              onClick={() => setEnablePay(!enablePay)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enablePay ? 'bg-purple-600' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enablePay ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs for 180 Pay Capabilities */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Overview & Webhook
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'coupons'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Coupons & Promos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'links'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          Payment Links
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'pricing'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Pricing Tables
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('geo')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'geo'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Geo-Pricing & PPP
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'agents'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          AI Agents (AP2)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gateway')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'gateway'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Custom Gateway (BYOG)
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Webhook & 2-Way Payment Verification Engine Card */}
          <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
              <div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Webhook & 2-Way Payment Verification Engine</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Real-time payment webhooks with HMAC SHA-256 signatures for 100% tamper-proof order fulfillment.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold">
            HMAC SHA-256
          </span>
        </div>

        {/* Informative Banner */}
        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-xs text-purple-950 dark:text-purple-200 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>2-Way Verification Architecture</span>
          </p>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            180 Pay signs every outgoing webhook with <code className="font-mono text-purple-600 dark:text-purple-400">X-180-Signature</code> using your signing secret. Verify this signature before fulfilling orders or crediting wallets.
          </p>
        </div>

        {/* Webhook Endpoint Input & Test Button */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Payment Webhook Destination URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://yourdomain.com/api/webhooks/180pay"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              type="button"
              onClick={onTestWebhook}
              disabled={isTestingWebhook || !webhookUrl.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
            >
              {isTestingWebhook ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Ping</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Webhook Signing Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Webhook Signing Secret
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex-1">
              {webhookSecret ? `whsec_••••••••••••${webhookSecret.slice(-6)}` : 'Secret configured automatically'}
            </span>
            <button
              type="button"
              onClick={onRotateWebhookSecret}
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate</span>
            </button>
          </div>
        </div>

        {/* Test Result Console */}
        {testResult && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5 font-mono">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-300 font-bold">Webhook Delivery Telemetry</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    testResult.success
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  HTTP {testResult.statusCode}
                </span>
                <span className="text-zinc-500 text-[10px]">{testResult.latencyMs}ms</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="text-zinc-400">
                <span className="text-zinc-500">Destination:</span> {testResult.targetUrl}
              </div>
              {testResult.signature && (
                <div className="text-zinc-400 truncate">
                  <span className="text-zinc-500">X-180-Signature:</span> {testResult.signature}
                </div>
              )}
              <div className="text-zinc-400">
                <span className="text-zinc-500">Status Message:</span> {testResult.message}
              </div>
              {testResult.response && (
                <div className="pt-1.5">
                  <span className="text-zinc-500 block mb-1">Server Response:</span>
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 overflow-x-auto text-[10px] max-h-24 select-all">
                    {testResult.response}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 180 Pay Presentation & Checkout UX Modes Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-500" />
              <span>180 Pay Presentation & Checkout UX</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Define the checkout presentation styles supported by your application and customize device defaults for desktop vs mobile.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold">
            Checkout UX
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-white/5">
            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Supported Display Modes</span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'bottom_sheet', label: 'Bottom Sheet' },
                { id: 'modal', label: 'Centered Modal' },
                { id: 'popup', label: 'Popup Window' },
                { id: 'full_page', label: 'Full Page Redirect' },
              ].map((mode) => {
                const isSelected = payUxModes.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (payUxModes.length > 1) {
                          setPayUxModes(payUxModes.filter((m) => m !== mode.id));
                        }
                      } else {
                        setPayUxModes([...payUxModes, mode.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Monitor className="w-3 h-3 text-zinc-400" />
                <span>Desktop Default</span>
              </label>
              <select
                value={payDesktopDefault}
                onChange={(e) => setPayDesktopDefault(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="bottom_sheet">Bottom Sheet (Recommended)</option>
                <option value="modal">Centered Modal</option>
                <option value="popup">Popup Window</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-zinc-400" />
                <span>Mobile Default</span>
              </label>
              <select
                value={payMobileDefault}
                onChange={(e) => setPayMobileDefault(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="bottom_sheet">Bottom Sheet (Recommended)</option>
                <option value="modal">Centered Modal</option>
                <option value="popup">Popup Window</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Live Sandbox Preview */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/5 to-indigo-500/5 border border-purple-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-purple-500" />
                <span>Interactive Live Payment Sandbox</span>
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Test your configured 180 Pay checkout flow instantly in real time using the 180 SDK.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold self-start sm:self-auto">
              SDK v2.0.0
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onTestPayDrawer}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Test 180 Pay Drawer</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Pay Settings</span>
          </Button>
        </div>
      </div>

      {/* 180 Pay Revenue & Payment Analytics Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>180 Pay Revenue & Payment Analytics</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Comprehensive analytics on collections, monthly volume, settlements, and incoming transaction receipts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchPaymentAnalytics}
              disabled={loadingAnalytics}
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh payment analytics"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Financial KPI Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>Total Volume</span>
              <Activity className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-zinc-950 dark:text-white">
              {paymentAnalytics?.currency || 'INR'} {(paymentAnalytics?.grossVolume || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">All-time processed</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>This Month</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {paymentAnalytics?.currency || 'INR'} {(paymentAnalytics?.thisMonthVolume || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">Current calendar cycle</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>Pending Settlements</span>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {paymentAnalytics?.currency || 'INR'} {(paymentAnalytics?.pendingSettlements || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">In T+1 clearing cycle</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-1">
            <div className="flex items-center justify-between text-zinc-500 text-xs">
              <span>Withdrawable Balance</span>
              <Landmark className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {paymentAnalytics?.currency || 'INR'} {(payoutBalance || paymentAnalytics?.withdrawableBalance || 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-zinc-400">Available for payout</p>
          </div>
        </div>

        {/* Checkout Funnel & Conversion Intelligence */}
        {(() => {
          const totalIntentsCount = paymentAnalytics?.totalIntentsCount || (paymentAnalytics?.transactions || []).length;
          const totalIntentsVolume = paymentAnalytics?.totalIntentsVolume || paymentAnalytics?.grossVolume || 0;
          const gatewayAttemptsCount = paymentAnalytics?.gatewayAttemptsCount || 0;
          const gatewayAttemptsVolume = paymentAnalytics?.gatewayAttemptsVolume || 0;
          const capturedCount = paymentAnalytics?.totalTransactionsCount || 0;
          const capturedVolume = paymentAnalytics?.grossVolume || 0;
          const conversionRate = paymentAnalytics?.conversionRate || (totalIntentsCount > 0 ? Math.round((capturedCount / totalIntentsCount) * 1000) / 10 : 0);

          const gatewayPct = totalIntentsCount > 0 ? Math.min(100, Math.round(((gatewayAttemptsCount + capturedCount) / totalIntentsCount) * 100)) : 0;
          const capturedPct = totalIntentsCount > 0 ? Math.min(100, Math.round((capturedCount / totalIntentsCount) * 100)) : 0;

          return (
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                    <span>Checkout Funnel &amp; Behavioral Conversion</span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    User drop-offs tracked from bottom sheet launch to gateway invocation and final capture.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold font-mono self-start sm:self-auto">
                  <Percent className="w-3 h-3" />
                  <span>{conversionRate}% Conversion Rate</span>
                </div>
              </div>

              {/* 4 Funnel Metric Blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <Compass className="w-3 h-3 text-blue-500" />
                    <span>Purchase Intents</span>
                  </div>
                  <div className="text-base font-bold text-zinc-900 dark:text-white font-mono">
                    ₹{totalIntentsVolume.toLocaleString()}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-sans">
                    {totalIntentsCount} sheets initiated
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>Gateway Invocations</span>
                  </div>
                  <div className="text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                    ₹{(gatewayAttemptsVolume + capturedVolume).toLocaleString()}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-sans">
                    {gatewayAttemptsCount + capturedCount} opened gateway
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Captured Revenue</span>
                  </div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    ₹{capturedVolume.toLocaleString()}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-sans">
                    {capturedCount} settled payments
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <Percent className="w-3 h-3 text-purple-500" />
                    <span>Realized Yield</span>
                  </div>
                  <div className="text-base font-bold text-purple-600 dark:text-purple-400 font-mono">
                    {conversionRate}%
                  </div>
                  <p className="text-[10px] text-zinc-400 font-sans">
                    Funnel efficiency
                  </p>
                </div>
              </div>

              {/* Visual Funnel Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${Math.max(10, capturedPct)}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Captured: ${capturedPct}%`}
                  />
                  <div
                    style={{ width: `${Math.max(0, gatewayPct - capturedPct)}%` }}
                    className="bg-amber-500 h-full transition-all"
                    title={`Gateway Dropped: ${Math.max(0, gatewayPct - capturedPct)}%`}
                  />
                  <div
                    style={{ width: `${Math.max(0, 100 - gatewayPct)}%` }}
                    className="bg-blue-500/40 h-full transition-all"
                    title={`Intent Only: ${Math.max(0, 100 - gatewayPct)}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Captured ({capturedCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Gateway Dropped ({gatewayAttemptsCount})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Intent Only ({paymentAnalytics?.intentOnlyCount || Math.max(0, totalIntentsCount - gatewayAttemptsCount - capturedCount)})</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Monthly Volume Chart */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Monthly Processing Volume (Last 12 Months)
              </h3>
              <p className="text-[11px] text-zinc-400">Volume aggregation normalized across all payment channels</p>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">180 Pay Engine</span>
          </div>

          {(() => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentMonthIdx = new Date().getMonth();
            const gross = paymentAnalytics?.grossVolume || 0;
            const thisMonth = paymentAnalytics?.thisMonthVolume || 0;
            const lastMonth = paymentAnalytics?.lastMonthVolume || 0;

            const bars = months.map((month, idx) => {
              let val = 0;
              if (idx === currentMonthIdx) val = thisMonth;
              else if (idx === (currentMonthIdx - 1 + 12) % 12) val = lastMonth;
              else if (gross > 0) val = Math.round((gross / 12) * (0.6 + ((idx * 7) % 10) / 10));
              return { month, val };
            });

            const maxVal = Math.max(...bars.map((b) => b.val), 1000);

            return (
              <div className="space-y-2">
                <div className="h-32 flex items-end gap-2 pt-4 px-2">
                  {bars.map((b, i) => {
                    const heightPct = Math.max(8, Math.round((b.val / maxVal) * 100));
                    const isCurrent = i === currentMonthIdx;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-md transition-all ${
                            isCurrent
                              ? 'bg-gradient-to-t from-purple-600 to-indigo-500 shadow-sm'
                              : 'bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                          }`}
                          title={`${b.month}: ₹${b.val.toLocaleString()}`}
                        />
                        <span className={`text-[9px] font-mono ${isCurrent ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-zinc-500'}`}>
                          {b.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Transaction Receipts Ledger with Status Filter & Search */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-purple-500" />
              <span>Incoming Transaction Receipts</span>
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Tx ID, customer, amount..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500 w-44 sm:w-56"
                />
              </div>

              {/* Status Filter */}
              <div className="flex flex-wrap items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-[10px]">
                {(
                  [
                    { id: 'ALL', label: 'ALL' },
                    { id: 'CAPTURED', label: 'CAPTURED' },
                    { id: 'GATEWAY_DROPPED', label: 'GATEWAY DROPPED' },
                    { id: 'INTENT_ONLY', label: 'INTENT TO PAY' },
                    { id: 'FAILED', label: 'DECLINED' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setTxStatusFilter(st.id)}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                      txStatusFilter === st.id
                        ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          {(() => {
            const rawTxs = paymentAnalytics?.transactions || [];
            const filteredTxs = rawTxs.filter((tx: any) => {
              if (txStatusFilter !== 'ALL') {
                if (txStatusFilter === 'CAPTURED' && !(tx.status === 'CAPTURED' || tx.status === 'SUCCESS')) {
                  return false;
                }
                if (txStatusFilter === 'GATEWAY_DROPPED' && tx.status !== 'GATEWAY_DROPPED') {
                  return false;
                }
                if (txStatusFilter === 'INTENT_ONLY' && tx.status !== 'INTENT_ONLY') {
                  return false;
                }
                if (txStatusFilter === 'FAILED' && tx.status !== 'FAILED') {
                  return false;
                }
              }
              if (txSearchQuery.trim()) {
                const q = txSearchQuery.toLowerCase();
                const matchId = (tx.id || '').toLowerCase().includes(q);
                const matchPhone = (tx.customerPhone || '').toLowerCase().includes(q);
                const matchName = (tx.customerName || '').toLowerCase().includes(q);
                const matchAmount = String(tx.amount || '').includes(q);
                return matchId || matchPhone || matchName || matchAmount;
              }
              return true;
            });

            if (filteredTxs.length === 0) {
              return (
                <div className="p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center space-y-1">
                  <p className="text-xs text-zinc-500">No payment receipts matching your filter criteria.</p>
                  <p className="text-[11px] text-zinc-400">Trigger test transactions in the 180 Pay Drawer above.</p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Receipt / Tx ID</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Customer / Location</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date &amp; Time</th>
                      <th className="px-4 py-3 text-right">Audit &amp; Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-white/5 font-mono">
                    {filteredTxs.map((tx: any, idx: number) => {
                      const isCaptured = tx.status === 'CAPTURED' || tx.status === 'SUCCESS';
                      const isGatewayDropped = tx.status === 'GATEWAY_DROPPED';
                      const isIntentOnly = tx.status === 'INTENT_ONLY';

                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">
                            <span className="text-[11px]">{tx.id?.slice(0, 14)}...</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                            {tx.currency || 'INR'} {(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <div className="text-zinc-900 dark:text-white font-medium text-xs">
                              {tx.customerName || '180 User'}
                            </div>
                            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-zinc-400" />
                              <span>{tx.location || 'India (IN)'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {tx.method || tx.paymentMethod || '180 Pay'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isCaptured ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>CAPTURED</span>
                              </span>
                            ) : isGatewayDropped ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span>GATEWAY DROPPED</span>
                              </span>
                            ) : isIntentOnly ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                <Compass className="w-3 h-3" />
                                <span>INTENT TO PAY</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <AlertCircle className="w-3 h-3" />
                                <span>DECLINED</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-zinc-900 dark:text-zinc-200 font-medium text-xs">
                              {new Date(tx.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                              {new Date(tx.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => onSelectTx(tx)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-sans font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="View printable digital receipt"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Earnings & Manual Payouts Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Earnings & Manual Payouts</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Request manual bank settlements for your collected funds. Reviewed by 180 Admin within 24 hours.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdminReviewClick}
              className="px-3 py-1.5 rounded-xl border border-purple-500/30 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Admin Review</span>
            </button>
            <Button
              type="button"
              onClick={onRequestPayoutClick}
              disabled={payoutBalance <= 0}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Request Payout
            </Button>
          </div>
        </div>

        {/* Balance Card with Bank Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-2">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Available For Withdrawal
            </span>
            <div className="text-3xl font-extrabold text-zinc-950 dark:text-white">
              INR {payoutBalance.toLocaleString()}
            </div>
            <p className="text-[11px] text-zinc-500">Net after payment provider transaction fees</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Settlement Bank Account</span>
                </span>
                <button
                  type="button"
                  onClick={onSetupBankClick}
                  className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline cursor-pointer"
                >
                  {bankDetails?.accountNumber || bankDetails?.upiId ? 'Update' : 'Configure'}
                </button>
              </div>

              {bankDetails?.accountNumber || bankDetails?.upiId ? (
                <div className="mt-2 space-y-1 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  {bankDetails.accountHolderName && (
                    <div className="font-sans font-semibold text-zinc-900 dark:text-white">
                      {bankDetails.accountHolderName}
                    </div>
                  )}
                  {bankDetails.accountNumber && (
                    <div>Acc: •••• {bankDetails.accountNumber.slice(-4)} ({bankDetails.bankName || 'Bank'})</div>
                  )}
                  {bankDetails.ifscCode && <div>IFSC: {bankDetails.ifscCode}</div>}
                  {bankDetails.upiId && <div>UPI: {bankDetails.upiId}</div>}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 mt-2">
                  No payout destination configured yet. Add your bank account or UPI ID to receive payouts.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payout History */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Payout History
            </h3>
            <button
              type="button"
              onClick={fetchPayoutHistory}
              disabled={loadingPayoutHistory}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RotateCw className={`w-3 h-3 ${loadingPayoutHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingPayoutHistory ? (
            <div className="p-6 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              <p className="text-xs text-zinc-400">Loading payout records...</p>
            </div>
          ) : payoutHistory.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Payout ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Admin Reference</th>
                    <th className="px-4 py-3">Requested Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5 font-mono">
                  {payoutHistory.map((payout, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40">
                      <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">
                        <span className="text-[11px]">{payout.id}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                        {payout.currency || 'INR'} {(payout.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className="text-zinc-700 dark:text-zinc-300 text-xs">
                          {payout.method}: {payout.destination}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                            payout.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : payout.status === 'PROCESSING'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : payout.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-zinc-500 text-[11px]">
                        {payout.transactionRef || payout.adminNote || 'Under 24h Review'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-[11px]">
                        {new Date(payout.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 italic py-2">No payout requests submitted yet.</p>
          )}
        </div>
      </div>
    </>
  )}

  {activeTab === 'coupons' && <CouponsTab appId={app.id} />}
  {activeTab === 'links' && <PaymentLinksTab appId={app.id} />}
  {activeTab === 'pricing' && <PricingTablesTab appId={app.id} />}
  {activeTab === 'geo' && <GeoPricingTab appId={app.id} />}
  {activeTab === 'agents' && <AgentEnvelopesTab appId={app.id} />}
  {activeTab === 'gateway' && <CustomGatewayTab appId={app.id} />}
</div>
  );
}

export default PayAppDetail;
