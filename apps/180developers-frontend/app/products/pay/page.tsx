'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Webhook,
  ShieldCheck,
  Zap,
  ArrowRight,
  Play,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Code2,
  Sparkles,
  Server,
  Layers,
  ArrowLeft,
  DollarSign,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, PlatformModal, AILogoIcon } from '@workspace/ui';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';
import { use180Pay } from '@workspace/identity-sdk';

export default function PayProductPage() {
  const { launch180Pay, isOpeningPay } = use180Pay();
  const [activeCodeTab, setActiveCodeTab] = useState<'checkout' | 'server-session' | 'flutter' | 'webhook' | 'node' | 'python'>('checkout');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  // Dynamic universal checkout state — fully agnostic to amount, currency, and merchant
  const [testAmount, setTestAmount] = useState<string>('49.00');
  const [testCurrency, setTestCurrency] = useState<string>('USD');
  const [testTitle, setTestTitle] = useState<string>('Pro Developer Subscription');
  const [testOrderId, setTestOrderId] = useState<string>(() => 'ord_dev_' + Math.random().toString(36).substring(2, 8));

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestCheckout = () => {
    const rawVal = testAmount.trim();
    const parsedAmount = rawVal === '' ? 0 : parseFloat(rawVal);
    const amountVal = isNaN(parsedAmount) ? 0 : parsedAmount;
    const curVal = (testCurrency || 'USD').toUpperCase();
    const dynamicOrderId = testOrderId || ('ord_dev_' + Math.random().toString(36).substring(2, 8));

    launch180Pay({
      sessionId: 'sess_demo_' + Math.random().toString(36).substring(2, 10),
      amount: amountVal,
      currency: curVal,
      title: testTitle || 'Dynamic Merchant Order',
      orderId: dynamicOrderId,
      description: 'Production-grade Universal Checkout Demo',
      metadata: {
        merchantOrderId: dynamicOrderId,
        testMode: 'sandbox',
      },
      onSuccess: (res) => {
        setPaymentResult({
          ...res,
          amount: amountVal,
          currency: curVal,
          orderId: dynamicOrderId,
          title: testTitle || 'Dynamic Merchant Order',
        });
        setShowDemoModal(true);
        toast.success(`Payment confirmed! Order: ${dynamicOrderId}`);
      },
    });
  };

  return (
    <div className="space-y-20 py-4 pb-20">
      {/* ── Breadcrumb & Hero ──────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto text-center space-y-8 pt-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Developer Platform</span>
          </Link>
          <span className="text-zinc-400">•</span>
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Products</span>
          <span className="text-zinc-400">•</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">180 Pay</span>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold">
          <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Universal 1-Click Sovereign Payment Gateway</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.1]">
          Universal Payments.{' '}
          <br />
          <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-300 dark:to-indigo-300 bg-clip-text text-transparent">
            Any Currency. Any Sovereign Amount.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Production-grade gateway for developers worldwide. Accept dynamic orders in any currency (USD, EUR, GBP, INR, etc.) 
          with instant 1-click sovereign wallet deduction and cryptographically signed 2-way verification webhooks.
        </p>

        {/* ── Interactive Live Checkout Testbench (Universal Amount & Currency) ── */}
        <div className="max-w-2xl mx-auto p-5 rounded-3xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 shadow-xl backdrop-blur-xl text-left space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Interactive Universal Sandbox Tester
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">Dynamic Gateway Sandbox</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Currency (ISO)</label>
              <select
                value={testCurrency}
                onChange={(e) => setTestCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="SGD">SGD ($)</option>
              </select>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Amount (Any Value)</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Preset Samples</label>
              <div className="flex items-center gap-1.5 pt-0.5">
                {[
                  { label: 'Free $0', amt: '0.00' },
                  { label: '$9.99', amt: '9.99' },
                  { label: '$49', amt: '49.00' },
                  { label: '$199', amt: '199.00' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setTestAmount(preset.amt)}
                    className="flex-1 py-1 px-1.5 rounded-lg text-[10px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Order / Product Title</label>
            <input
              type="text"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              placeholder="e.g. Acme Subscription, Coffee Roastery Bundle, etc."
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Hero Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              onClick={handleTestCheckout}
              disabled={isOpeningPay}
              size="lg"
              className="w-full sm:flex-1 rounded-2xl py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isOpeningPay ? (
                <span>Opening 180 Pay Gateway...</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>
                    Test Checkout ({testCurrency} {testAmount || '0.00'})
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </>
              )}
            </Button>

            <a
              href={getDocsUrl(DOCS_LINKS.PAY_QUICKSTART)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto rounded-2xl px-5 py-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs border border-zinc-200 dark:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>API Reference</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>
        </div>

        {/* Feature Pill Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-left">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">1-Click</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Popup Wallet Checkout</div>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">HMAC-256</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">2-Way Signed Webhooks</div>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">Auto-Topup</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Inline Razorpay Top-Up</div>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">Zero Code</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Toggle via Developer Console</div>
          </div>
        </div>
      </section>

      {/* ── 2-Way Payment Verification Flow ──────────────────────────────── */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            2-Way Payment Verification
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            How 180 Pay ensures guaranteed payment fulfillment with zero chargebacks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 shadow-sm hover:border-purple-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
              1
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base">Step 1: Session & 1-Click Popup</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Your server creates a checkout session. The frontend opens the standalone 180 Pay popup where the user authorizes with 1 tap.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 shadow-sm hover:border-emerald-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              2
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base">Step 2: Signed Webhook Dispatch</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              180 Pay debits user wallet and immediately dispatches an HMAC SHA-256 signed webhook (<code className="text-emerald-500">X-180-Signature</code>) to your server.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 shadow-sm hover:border-blue-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              3
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base">Step 3: Instant Product Unlock</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Your backend validates the cryptographic signature with your webhook secret and fulfills the user's order automatically.
            </p>
          </div>
        </div>
      </section>

      {/* ── Developer Architecture & Currency Standard Guide ───────────────── */}
      <section className="max-w-5xl mx-auto space-y-4">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-pink-500/5 border border-purple-500/20 shadow-sm backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-500/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="font-bold text-sm text-zinc-950 dark:text-white">
                180 Ecosystem Architecture & Currency Standard
              </h3>
            </div>
            <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full font-semibold">
              CRITICAL INTEGRATION RULES
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Rule 1: Whole Currency Units */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span>1. Whole Currency Units (Not Smallest Units)</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                Unlike legacy gateways (Stripe/Razorpay) that require paise or cents (e.g. <code className="text-red-500">49900</code>), 
                180 Pay universally operates on <span className="font-bold text-zinc-900 dark:text-zinc-100">whole currency units</span>. 
                Pass <code className="text-emerald-500 font-bold">amount=499</code> for ₹499 INR or <code className="text-emerald-500 font-bold">amount=49.00</code> for $49 USD. 
                Passing 49900 without unit flags will generate a ₹49,900 checkout order!
              </p>
            </div>

            {/* Rule 2: Dual Domain Directory */}
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                <Server className="w-3.5 h-3.5 text-blue-500" />
                <span>2. Unified Domain Directory</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                • <strong className="text-purple-600 dark:text-purple-400">Hosted UIs:</strong> <code className="text-zinc-700 dark:text-zinc-300 font-mono">https://auth.180workspace.com/checkout</code> or <code className="text-zinc-700 dark:text-zinc-300 font-mono">/auth/login</code><br />
                • <strong className="text-blue-600 dark:text-blue-400">Core REST APIs:</strong> <code className="text-zinc-700 dark:text-zinc-300 font-mono">https://api.180core.cloud/api/v1/pay/checkout-session</code> and <code className="text-zinc-700 dark:text-zinc-300 font-mono">/api/oauth/token</code>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Code Implementation Snippets ───────────────────────────────────── */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Integration Code & Webhooks
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Client popups, server-to-server checkout sessions, Flutter apps, and Fastify / Express webhooks
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto">
            {(['checkout', 'server-session', 'flutter', 'webhook', 'node', 'python'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveCodeTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                  activeCodeTab === tab
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {tab === 'checkout'
                  ? '1. Frontend Checkout'
                  : tab === 'server-session'
                  ? '2. Server-Side Session'
                  : tab === 'flutter'
                  ? '3. Flutter / Dart'
                  : tab === 'webhook'
                  ? '4. Fastify & Express Webhook'
                  : tab === 'node'
                  ? 'Node.js (Raw)'
                  : 'Python FastAPI'}
              </button>
            ))}
          </div>
        </div>

        {/* Code Terminal */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-zinc-500">
                {activeCodeTab === 'checkout'
                  ? 'checkout.ts'
                  : activeCodeTab === 'server-session'
                  ? 'create-session.ts (Fastify 5.x / Express)'
                  : activeCodeTab === 'flutter'
                  ? '180_integration_service.dart'
                  : activeCodeTab === 'webhook'
                  ? 'webhook-server.ts (Fastify & Express)'
                  : activeCodeTab === 'node'
                  ? 'server.ts'
                  : 'payment_handler.py'}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard('code', 'payCode')}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedKey === 'payCode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'payCode' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <pre className="text-xs sm:text-sm text-zinc-300 overflow-x-auto leading-relaxed font-mono">
            {activeCodeTab === 'checkout' && `// 1. Frontend: Universal 1-Click Sovereign Checkout (NPM or CDN Script Tag)
// Fully dynamic — pass any sovereign amount, any ISO currency, and any merchant order ID
import { OneEightyPay } from '@workspace/identity-sdk';

export function handlePurchase(order: { id: string; amount: number; currency: string; title: string }) {
  // uxMode: 'bottom_sheet' provides native in-DOM mobile-friendly slide-up sheet (No popup blockers!)
  OneEightyPay.openBottomSheet({
    amount: order.amount,       // Whole currency units (e.g. 19.99, 499.00, or 0 for trials)
    currency: order.currency,   // Any ISO 4217 code (USD, EUR, INR, GBP, CAD, AUD, etc.)
    title: order.title,         // Your dynamic product/service title
    orderId: order.id,          // Your internal merchant order ID
    description: 'Instant sovereign checkout via 180 Pay',
    metadata: {
      merchantOrderId: order.id,
      catalogItem: order.title,
    },
    onSuccess: (res) => {
      console.log('Payment successful! Transaction:', res.transactionId, 'Order:', res.orderId);
      window.location.href = \`/checkout/success?orderId=\${res.orderId || order.id}\`;
    },
    onCancel: () => console.log('Checkout dismissed by customer')
  });
}

// Option B: Vanilla JavaScript / HTML via CDN Script Tag
// <script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.js" async></script>
// window.OneEightyPay.openBottomSheet({
//   amount: 499, // Whole currency units (e.g. ₹499 INR)
//   currency: 'INR',
//   title: 'Pro Developer Plan',
//   orderId: 'ord_12345'
// });`}

            {activeCodeTab === 'server-session' && `// Server-Side Signed Checkout Session Creation (Fastify 5.x & Express)
// Prevents clients from tampering with amounts in URL query strings!
// Endpoint: POST https://api.180core.cloud/api/v1/pay/checkout-session

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface CreateOrderBody {
  orderId: string;
  amount: number;       // Whole units: 499 for ₹499 INR, 49.00 for $49.00 USD
  currency: string;     // 'INR', 'USD', 'EUR', etc.
  title: string;
  returnUrl?: string;
}

export async function createCheckoutSession(req: FastifyRequest<{ Body: CreateOrderBody }>, reply: FastifyReply) {
  const { orderId, amount, currency, title, returnUrl } = req.body;

  // IMPORTANT: 180 Pay expects WHOLE units (e.g. 499 for ₹499), NOT paise or cents!
  const response = await fetch('https://api.180core.cloud/api/v1/pay/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${process.env.ONE_EIGHTY_CLIENT_SECRET}\`,
    },
    body: JSON.stringify({
      client_id: process.env.ONE_EIGHTY_CLIENT_ID,
      client_secret: process.env.ONE_EIGHTY_CLIENT_SECRET,
      amount: amount,             // Whole units (499 = ₹499)
      currency: currency || 'INR',
      title: title || \`Order #\${orderId}\`,
      order_id: orderId,
      return_url: returnUrl || 'http://localhost:3000/checkout/success',
      cancel_url: 'http://localhost:3000/checkout/cancel',
    }),
  });

  const sessionData = await response.json();
  if (!response.ok || sessionData.error) {
    throw new Error(sessionData.error_description || sessionData.error || 'Failed to create 180 Pay session');
  }

  // Returns: { sessionId: 'sess_...', checkoutUrl: 'https://auth.180workspace.com/checkout?sessionId=...' }
  return reply.send({
    sessionId: sessionData.sessionId,
    checkoutUrl: sessionData.checkoutUrl,
  });
}`}

            {activeCodeTab === 'flutter' && `// Flutter 3.24+ / Dart 3.5+ Integration for 180 Identity & 180 Pay
// Dependencies: url_launcher: ^6.3.0

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OneEightyIntegrationService {
  static const String clientId = 'YOUR_180_CLIENT_ID';

  // ==========================================================================
  // 1. 180 Identity: Hosted OAuth 2.0 / SSO Login
  // ==========================================================================
  static Future<void> launchHostedLogin({required String redirectUri}) async {
    final uri = Uri.parse(
      'https://auth.180workspace.com/auth/login?'
      'client_id=\$clientId&'
      'redirect_uri=\${Uri.encodeComponent(redirectUri)}&'
      'response_type=code&'
      'scope=openid+identity:read+identity:email+identity:phone&'
      'state=flutter_auth'
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication, webOnlyWindowName: '_self');
    }
  }

  // ==========================================================================
  // 2. 180 Pay: Hosted 1-Click Sovereign Checkout
  // CRITICAL: 'amountInRupees' expects WHOLE currency units (e.g. 499 for ₹499),
  // NEVER smallest units like paise or cents!
  // ==========================================================================
  static Future<void> launchCheckout({
    required String orderId,
    required int amountInRupees,
    required String title,
    required String returnUrl,
    String? sessionId, // Optional: returned from your server's checkout-session call
  }) async {
    final checkoutUri = sessionId != null
      ? Uri.parse('https://auth.180workspace.com/checkout?sessionId=\$sessionId&order_id=\$orderId')
      : Uri.parse(
          'https://auth.180workspace.com/checkout?'
          'clientId=\$clientId&'
          'amount=\$amountInRupees&' // Whole currency units (e.g. 499 = ₹499 INR)
          'currency=INR&'
          'title=\${Uri.encodeComponent(title)}&'
          'order_id=\$orderId&'
          'redirect_uri=\${Uri.encodeComponent(returnUrl)}'
        );

    if (await canLaunchUrl(checkoutUri)) {
      await launchUrl(checkoutUri, mode: LaunchMode.externalApplication, webOnlyWindowName: '_blank');
    }
  }
}`}

            {activeCodeTab === 'webhook' && `// Cryptographic 2-Way Payment Verification (Express & Fastify)
// Using @workspace/identity-sdk turnkey helper (Zero math or serialization errors)

// --- Option A: Fastify Backend ---
// npm install @fastify/raw-body
// import Fastify from 'fastify';
// import rawBody from '@fastify/raw-body';
// import { constructWebhookEvent } from '@workspace/identity-sdk';
//
// const fastify = Fastify();
// await fastify.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });
//
// fastify.post('/api/v1/billing/webhook/180pay', { config: { rawBody: true } }, async (req, reply) => {
//   const event = constructWebhookEvent(
//     req.rawBody,
//     req.headers['x-180-signature'],
//     process.env.ONE_EIGHTY_WEBHOOK_SECRET,
//     req.headers['x-180-timestamp']
//   );
//   return { received: true };
// });

// --- Option B: Express Backend ---
import express from 'express';
import { Sovereign180Pay } from '@workspace/identity-sdk';

const app = express();
// CRITICAL: Capture raw body buffer for the webhook route BEFORE express.json()
app.use('/api/webhooks/180-pay', express.raw({ type: '*/*' }));
app.use(express.json());

const WEBHOOK_SECRET = process.env.ONE_EIGHTY_WEBHOOK_SECRET; // whsec_...

app.post('/api/webhooks/180-pay', (req, res) => {
  try {
    const rawBody = req.body; // Buffer from express.raw()
    const signature = req.headers['x-180-signature'];
    const timestamp = req.headers['x-180-timestamp'];

    // constructEvent validates timestamp replay attack (<300s) & timing-safe HMAC pre-image
    const event = Sovereign180Pay.constructEvent(
      rawBody,
      signature,
      WEBHOOK_SECRET,
      timestamp
    );

    if (event.event === 'payment.captured' || event.type === 'payment.succeeded') {
      const { amount, currency, orderId, customerEmail, transactionId } = event.data || {};
      console.log(\`Payment Confirmed: \${currency} \${amount} for order \${orderId}\`);
      console.log('Customer:', customerEmail, 'TxID:', transactionId);
      // Fulfill order in your database dynamically!
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    // Detailed error message explains clock drift (>300s) vs raw byte buffer alteration
    res.status(401).json({ error: err.message });
  }
});`}

            {activeCodeTab === 'node' && `// Node.js Express Complete Server: Native HMAC Verification & Dynamic Order Fulfillment
const express = require('express');
const crypto = require('crypto');
const app = express();

const WEBHOOK_SECRET = process.env.ONE_EIGHTY_WEBHOOK_SECRET;

// 1. MUST mount raw body parser before express.json() for HMAC verification
app.use('/api/webhooks/180-pay', express.raw({ type: '*/*' }));
app.use(express.json());

// 2. Turnkey HMAC-SHA256 Webhook Verification Route with Replay Defense
app.post('/api/webhooks/180-pay', (req, res) => {
  try {
    const rawBody = req.body ? req.body.toString('utf8') : '';
    const signature = req.headers['x-180-signature'];
    const timestamp = req.headers['x-180-timestamp'];

    if (!signature || !WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Missing security headers or secret' });
    }

    // 5-minute replay attack defense (300s)
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        return res.status(401).json({ error: 'Timestamp expired' });
      }
    }

    // Canonical payload: \`\${timestamp}.\${rawBody}\`
    const signPayload = timestamp ? \`\${timestamp}.\${rawBody}\` : rawBody;
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(signPayload).digest('hex');

    // Constant-time length-safe comparison (Never throws RangeError)
    const bufA = Buffer.from(signature);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    const event = JSON.parse(rawBody);
    const { amount, currency, orderId, customerEmail } = event.data || {};
    console.log(\`Order \${orderId} fulfilled: \${currency} \${amount} for \${customerEmail}\`);
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});`}

            {activeCodeTab === 'python' && `# Python FastAPI Webhook & Signature Verification with Timestamp Pre-Image
import hmac
import hashlib
import json
import time
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()
WEBHOOK_SECRET = "whsec_YOUR_SECRET"

@app.post("/webhooks/180-pay")
async def handle_180_webhook(
    request: Request,
    x_180_signature: str = Header(None),
    x_180_timestamp: str = Header(None)
):
    raw_body = await request.body()
    if not x_180_signature or not WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing signature header")

    # 5-minute replay window
    if x_180_timestamp:
        if abs(int(time.time()) - int(x_180_timestamp)) > 300:
            raise HTTPException(status_code=401, detail="Expired timestamp")
        payload = f"{x_180_timestamp}.".encode("utf-8") + raw_body
    else:
        payload = raw_body

    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(x_180_signature.strip(), expected_sig):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    payload_data = json.loads(raw_body)
    data = payload_data.get("data", {})
    print(f"Order {data.get('orderId')} confirmed: {data.get('currency')} {data.get('amount')}")
    return {"received": True}`}
          </pre>
        </div>
      </section>

      {/* ── Demo Result Modal ──────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showDemoModal && !!paymentResult}
        onClose={() => setShowDemoModal(false)}
        title="180 Pay Authorization Captured"
        icon={CheckCircle2}
        iconBgClass="bg-emerald-500/10"
        iconColorClass="text-emerald-600 dark:text-emerald-400"
        maxWidthClass="max-w-md"
      >
        {paymentResult && (
          <div className="space-y-4 text-zinc-900 dark:text-white">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Payment was authorized from the user's sovereign wallet. Webhook dispatched with <code className="text-emerald-500 font-mono">X-180-Signature</code>.
            </p>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-2 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Order ID:</span>{' '}
                <span className="text-purple-600 dark:text-purple-400 truncate">{paymentResult.orderId || paymentResult.sessionId}</span>
              </div>
              <div>
                <span className="text-zinc-500">Transaction ID:</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400 truncate">{paymentResult.transactionId || 'tx_demo_captured'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Captured Amount:</span>{' '}
                <span className="font-bold text-zinc-900 dark:text-white">
                  {paymentResult.currency} {Number(paymentResult.amount).toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setShowDemoModal(false)}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg cursor-pointer"
            >
              Done & Return
            </Button>
          </div>
        )}
      </PlatformModal>
    </div>
  );
}
