'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Globe2,
  Layers,
  Repeat,
  Server,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Button, Card, CardContent, Input, PlatformModal } from '@workspace/ui';
import { use180Pay } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';
import { developerLink, docsLink } from '@/lib/urls';

type PayCodeTab = 'checkout' | 'server-session' | 'flutter' | 'webhook' | 'node' | 'python';

const CODE_SNIPPETS: Record<PayCodeTab, { label: string; filename: string; code: string }> = {
  checkout: {
    label: '1. Frontend Checkout',
    filename: 'checkout.ts',
    code: `// Universal 1-Click Sovereign Checkout (NPM or CDN Script Tag)
import { OneEightyPay } from '@workspace/identity-sdk';

export function handlePurchase(order: { id: string; amount: number; currency: string; title: string }) {
  OneEightyPay.openBottomSheet({
    amount: order.amount,       // Whole currency units (e.g. 499 for ₹499, 49.00 for $49)
    currency: order.currency,   // Any ISO 4217 code (USD, EUR, INR, GBP, CAD, AUD...)
    title: order.title,
    orderId: order.id,
    description: 'Instant sovereign checkout via 180 Pay',
    onSuccess: (res) => {
      console.log('Payment successful!', res.transactionId, res.orderId);
    },
  });
}`,
  },
  'server-session': {
    label: '2. Server Session',
    filename: 'create-session.ts',
    code: `// Server-Side Signed Checkout Session (POST https://api.180core.cloud/api/v1/pay/checkout-session)
const response = await fetch('https://api.180core.cloud/api/v1/pay/checkout-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${process.env.ONE_EIGHTY_CLIENT_SECRET}\`,
  },
  body: JSON.stringify({
    client_id: process.env.ONE_EIGHTY_CLIENT_ID,
    client_secret: process.env.ONE_EIGHTY_CLIENT_SECRET,
    amount: 499, // Whole units (499 = ₹499 INR)
    currency: 'INR',
    title: 'Pro Developer Plan',
    order_id: 'ord_12345',
    return_url: 'https://yourapp.com/checkout/success',
  }),
});
const { sessionId, checkoutUrl } = await response.json();`,
  },
  flutter: {
    label: '3. Flutter / Dart',
    filename: '180_integration_service.dart',
    code: `// Flutter 3.24+ / Dart Integration for 180 Pay Hosted Checkout
import 'package:url_launcher/url_launcher.dart';

Future<void> launch180Checkout({
  required String clientId,
  required String orderId,
  required int amountInRupees, // Whole units (e.g. 499 = ₹499)
  required String title,
  required String returnUrl,
}) async {
  final uri = Uri.parse(
    'https://profile.180core.cloud/checkout?'
    'clientId=\$clientId&amount=\$amountInRupees&currency=INR&'
    'title=\${Uri.encodeComponent(title)}&order_id=\$orderId&'
    'redirect_uri=\${Uri.encodeComponent(returnUrl)}',
  );
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}`,
  },
  webhook: {
    label: '4. SDK Webhook',
    filename: 'webhook-server.ts',
    code: `// Cryptographic 2-Way Payment Verification with Replay Defense
import express from 'express';
import { Sovereign180Pay } from '@workspace/identity-sdk';

const app = express();
app.use('/api/webhooks/180-pay', express.raw({ type: '*/*' }));

app.post('/api/webhooks/180-pay', (req, res) => {
  try {
    const event = Sovereign180Pay.constructEvent(
      req.body,
      req.headers['x-180-signature'],
      process.env.ONE_EIGHTY_WEBHOOK_SECRET!,
      req.headers['x-180-timestamp']
    );
    if (event.event === 'payment.captured') {
      console.log('Fulfill order:', event.data?.orderId);
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});`,
  },
  node: {
    label: 'Node.js (Raw)',
    filename: 'server.ts',
    code: `// Native Node.js HMAC-SHA256 Verification
import crypto from 'crypto';

export function verifyWebhook(rawBody: string, signature: string, timestamp: string, secret: string) {
  const payload = timestamp ? \`\${timestamp}.\${rawBody}\` : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const bufA = Buffer.from(signature);
  const bufB = Buffer.from(expected);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}`,
  },
  python: {
    label: 'Python FastAPI',
    filename: 'payment_handler.py',
    code: `# Python FastAPI HMAC-SHA256 Webhook Verification
import hmac, hashlib, time
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()

@app.post("/webhooks/180-pay")
async def handle_180_webhook(
    request: Request,
    x_180_signature: str = Header(None),
    x_180_timestamp: str = Header(None),
):
    raw_body = await request.body()
    if x_180_timestamp and abs(int(time.time()) - int(x_180_timestamp)) > 300:
        raise HTTPException(status_code=401, detail="Expired timestamp")
    payload = f"{x_180_timestamp}.".encode() + raw_body if x_180_timestamp else raw_body
    expected = hmac.new(WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest((x_180_signature or "").strip(), expected):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")
    return {"received": True}`,
  },
};

const PAY_CAPABILITIES = [
  {
    icon: CreditCard,
    title: 'Dual-Gateway Routing & BYOG',
    description:
      'Route India traffic through Razorpay (UPI, RuPay, Netbanking) and global cards through Stripe, or plug in your own merchant gateway keys.',
  },
  {
    icon: Globe2,
    title: 'Dynamic Geo-Pricing (PPP)',
    description:
      'Automatically detect visitor region and apply Purchasing Power Parity localization across 135+ currencies.',
  },
  {
    icon: Layers,
    title: 'Double-Entry Sovereign Ledger',
    description:
      'Every transaction writes balanced debit and credit ledger entries across user wallets, platform escrows, and merchant payouts.',
  },
  {
    icon: Repeat,
    title: 'Subscriptions & Customer Portal',
    description:
      'Built-in recurring billing scheduler with trials, grace windows, coupons, direct payment links, and embeddable pricing tables.',
  },
];

export function PayShowcase() {
  const { launch180Pay, isOpeningPay } = use180Pay();
  const [currency, setCurrency] = useState('USD');
  const [amount, setAmount] = useState('49.00');
  const [title, setTitle] = useState('Pro Developer Subscription');
  const [activeCodeTab, setActiveCodeTab] = useState<PayCodeTab>('checkout');
  const [copied, setCopied] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const activeSnippet = CODE_SNIPPETS[activeCodeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet.code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Clipboard access unavailable');
    }
  };

  const handleLaunchCheckout = () => {
    const parsed = parseFloat(amount);
    const safeAmount = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const orderId = `ord_web_${Math.random().toString(36).slice(2, 8)}`;

    launch180Pay({
      sessionId: `sess_demo_${Math.random().toString(36).slice(2, 10)}`,
      amount: safeAmount,
      currency,
      title: title.trim() || 'Dynamic Merchant Order',
      orderId,
      description: 'Production-grade Universal Checkout Demo',
      metadata: {
        merchantOrderId: orderId,
        testMode: 'sandbox',
      },
      onSuccess: (res) => {
        setPaymentResult({
          ...res,
          amount: safeAmount,
          currency,
          orderId,
          title: title.trim() || 'Dynamic Merchant Order',
        });
        setShowDemoModal(true);
        toast.success(`Payment confirmed! Order: ${orderId}`);
      },
    });
  };

  return (
    <div className="space-y-20 py-12 md:py-16 animate-page-enter">
      {/* Breadcrumb & Hero */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-7">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex items-center justify-center gap-2 text-xs">
          <Link
            href="/"
            className="font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>180 Core</span>
          </Link>
          <span className="text-zinc-400">•</span>
          <span className="font-semibold text-purple-600 dark:text-purple-400">Products</span>
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-500 dark:text-zinc-400">180 Pay</span>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold">
          <CreditCard className="h-3.5 w-3.5" />
          <span>Universal 1-Click Sovereign Payment Gateway</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.08]">
          Universal Payments.{' '}
          <br />
          <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-300 dark:to-indigo-300 bg-clip-text text-transparent">
            Any Currency. Any Sovereign Amount.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Production-grade gateway for developers worldwide. Accept dynamic orders in any currency
          (USD, EUR, GBP, INR, etc.) with instant 1-click sovereign wallet deduction and
          cryptographically signed 2-way verification webhooks.
        </p>

        {/* Interactive Universal Sandbox Tester */}
        <Card className="max-w-2xl mx-auto bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10 text-left shadow-xl">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Interactive Universal Sandbox Tester
              </span>
              <span className="text-[11px] font-mono text-zinc-500">Dynamic Gateway Sandbox</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4 space-y-1.5">
                <label htmlFor="pay-currency" className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  Currency (ISO)
                </label>
                <select
                  id="pay-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono font-semibold text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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

              <div className="sm:col-span-4 space-y-1.5">
                <label htmlFor="pay-amount" className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                  Amount (Whole Units)
                </label>
                <Input
                  id="pay-amount"
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block">
                  Preset Samples
                </span>
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    { label: '$0', amt: '0.00' },
                    { label: '$9.99', amt: '9.99' },
                    { label: '$49', amt: '49.00' },
                    { label: '$199', amt: '199.00' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAmount(preset.amt)}
                      className="flex-1 h-9 rounded-lg text-[10px] font-mono font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pay-title" className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                Order / Product Title
              </label>
              <Input
                id="pay-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-xl text-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                type="button"
                size="lg"
                onClick={handleLaunchCheckout}
                disabled={isOpeningPay}
                className="flex-1 h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25"
              >
                <Wallet className="h-4 w-4 mr-2" />
                <span>
                  {isOpeningPay
                    ? 'Opening 180 Pay Gateway...'
                    : `Test Checkout (${currency} ${amount || '0.00'})`}
                </span>
                <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-75" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-12 rounded-2xl px-5 text-xs font-semibold"
              >
                <a href={docsLink('pay-checkout')} target="_blank" rel="noopener noreferrer">
                  <Code2 className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                  <span>Checkout Docs</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5 text-zinc-400" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Highlight Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-left">
          {[
            { value: '1-Click', label: 'Popup Wallet Checkout', color: 'text-purple-600 dark:text-purple-400' },
            { value: 'HMAC-256', label: '2-Way Signed Webhooks', color: 'text-emerald-600 dark:text-emerald-400' },
            { value: 'Auto-Topup', label: 'Inline Razorpay Top-Up', color: 'text-blue-600 dark:text-blue-400' },
            { value: 'Zero Code', label: 'Toggle via Console', color: 'text-amber-600 dark:text-amber-400' },
          ].map((stat) => (
            <div
              key={stat.value}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-1"
            >
              <div className={`text-2xl font-black font-mono tracking-tight ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2-Way Payment Verification Flow */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
            2-Way Payment Verification
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Guaranteed payment fulfillment with signed cryptographic webhooks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: '1',
              title: 'Step 1: Session & 1-Click Popup',
              desc: 'Your server creates a checkout session. The frontend opens the standalone 180 Pay bottom sheet where the user authorizes with 1 tap.',
              accent: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
            },
            {
              step: '2',
              title: 'Step 2: Signed Webhook Dispatch',
              desc: '180 Pay settles the payment and immediately dispatches an HMAC SHA-256 signed webhook (X-180-Signature) to your backend.',
              accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
            },
            {
              step: '3',
              title: 'Step 3: Instant Product Unlock',
              desc: 'Your backend validates the signature with your webhook secret and fulfills the order automatically.',
              accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
            },
          ].map((item) => (
            <Card key={item.step} className="bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10">
              <CardContent className="p-6 space-y-3">
                <div className={`h-10 w-10 rounded-2xl border flex items-center justify-center font-black font-mono ${item.accent}`}>
                  {item.step}
                </div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">{item.title}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Capabilities + Currency Standard */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PAY_CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10">
                <CardContent className="p-6 space-y-3">
                  <div className="h-11 w-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">{item.title}</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-purple-500/25 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200/80 dark:border-white/10">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>180 Ecosystem Architecture &amp; Currency Standard</span>
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 self-start">
              Critical Integration Rules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/10 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span>1. Whole Currency Units (Not Paise / Cents)</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                180 Pay universally operates on whole currency units. Pass{' '}
                <code className="text-emerald-500 font-bold">amount=499</code> for ₹499 INR or{' '}
                <code className="text-emerald-500 font-bold">amount=49.00</code> for $49 USD.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/10 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-zinc-950 dark:text-white">
                <Server className="h-3.5 w-3.5 text-blue-500" />
                <span>2. Unified Domain Directory</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-mono text-[11px]">
                Hosted UI: https://profile.180core.cloud/checkout
                <br />
                REST API: https://api.180core.cloud/api/v1/pay/checkout-session
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Implementation Snippets */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
              Integration Code &amp; Webhooks
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Client popups, server-side checkout sessions, Flutter apps, and signed webhooks
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto">
            {(Object.keys(CODE_SNIPPETS) as PayCodeTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCodeTab(tab)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeCodeTab === tab
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {CODE_SNIPPETS[tab].label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-zinc-400">{activeSnippet.filename}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-9 px-3 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="text-xs sm:text-sm text-zinc-200 overflow-x-auto leading-relaxed font-mono">
            <code>{activeSnippet.code}</code>
          </pre>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-white">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-purple-400 uppercase tracking-wider">
              <ShieldCheck className="h-3.5 w-3.5" />
              Cryptographic Settlement Integrity
            </span>
            <h2 className="text-2xl font-black text-white">Configure 180 Pay in Your Console</h2>
            <p className="text-xs text-zinc-400">
              Create pricing tables, coupons, payment links, and signed webhook endpoints in minutes.
            </p>
          </div>
          <Button
            asChild
            className="h-12 rounded-2xl px-6 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs shrink-0"
          >
            <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
              <span>Open Developer Console</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Demo Result Modal */}
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
              Payment was authorized from the user&apos;s sovereign wallet. Webhook dispatched with{' '}
              <code className="text-emerald-500 font-mono">X-180-Signature</code>.
            </p>
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-2 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Order ID:</span>{' '}
                <span className="text-purple-500">{paymentResult.orderId || paymentResult.sessionId}</span>
              </div>
              <div>
                <span className="text-zinc-500">Transaction ID:</span>{' '}
                <span className="text-emerald-500">{paymentResult.transactionId || 'tx_demo_captured'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Captured Amount:</span>{' '}
                <span className="font-bold">
                  {paymentResult.currency} {Number(paymentResult.amount).toFixed(2)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
            >
              Done &amp; Return
            </Button>
          </div>
        )}
      </PlatformModal>
    </div>
  );
}
