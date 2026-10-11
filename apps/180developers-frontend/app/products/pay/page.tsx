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
  const [activeCodeTab, setActiveCodeTab] = useState<'checkout' | 'webhook' | 'node' | 'python'>('checkout');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestCheckout = () => {
    launch180Pay({
      sessionId: 'sess_demo_' + Math.random().toString(36).substring(2, 10),
      amount: 499.0,
      currency: 'INR',
      title: '180 Developer Pro License',
      description: 'Instant 1-Click Checkout Demo',
      onSuccess: (res) => {
        setPaymentResult(res);
        setShowDemoModal(true);
        toast.success(`Payment confirmed! Transaction: ${res.transactionId || 'tx_demo'}`);
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
          <span>180 Wallet & 1-Click Checkout Gateway</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.1]">
          Universal Payments.{' '}
          <br />
          <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-300 dark:to-indigo-300 bg-clip-text text-transparent">
            1-Click Popup Checkout & 2-Way Webhooks.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Accept payments instantly from customers using their 180 Profile prepaid wallet balance or UPI/Cards. 
          Zero customer drop-off with cryptographically signed 2-way verification webhooks.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Button
            onClick={handleTestCheckout}
            disabled={isOpeningPay}
            size="lg"
            className="w-full sm:w-auto rounded-2xl px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {isOpeningPay ? (
              <span>Opening 180 Pay Popup...</span>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Try 1-Click Checkout Demo (₹499)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </>
            )}
          </Button>

          <a
            href={getDocsUrl(DOCS_LINKS.PAY_QUICKSTART)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto rounded-2xl px-8 py-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-sm border border-zinc-200 dark:border-white/10 shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Read 180 Pay Documentation</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
          </a>
        </div>

        {/* Feature Pill Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 text-left">
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

      {/* ── Code Implementation Snippets ───────────────────────────────────── */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Integration Code & Webhooks
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Trigger checkout popups and verify payment webhooks with Node.js or Python
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto">
            {(['checkout', 'webhook', 'node', 'python'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveCodeTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  activeCodeTab === tab
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {tab === 'checkout' ? '1. Frontend Checkout' : tab === 'webhook' ? '2. Webhook Handler' : tab === 'node' ? 'Node.js Express' : 'Python FastAPI'}
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
                {activeCodeTab === 'checkout' ? 'checkout.ts' : activeCodeTab === 'webhook' ? 'webhook-server.ts' : activeCodeTab === 'node' ? 'server.ts' : 'payment_handler.py'}
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
            {activeCodeTab === 'checkout' && `// 1. Frontend: Trigger 1-Click 180 Pay Checkout Popup
import { OneEightyPay } from '@workspace/identity-sdk';

export async function handlePurchase(productId: string) {
  // Step 1: Create checkout session on your backend
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, amount: 499, currency: 'INR' }),
  });
  const { sessionId } = await res.json();

  // Step 2: Open standalone 180 Pay popup modal
  const payment = await OneEightyPay.checkout({
    sessionId,
    title: 'Pro Plan Monthly License',
    amount: 499,
    currency: 'INR',
  });

  console.log('Payment Authorized by User:', payment.transactionId);
}`}

            {activeCodeTab === 'webhook' && `// 2. Developer Backend: 2-Way Payment Verification Webhook Handler
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

app.post('/api/webhooks/180-pay', (req, res) => {
  const signature = req.headers['x-180-signature'];
  const webhookSecret = process.env.ONE_EIGHTY_WEBHOOK_SECRET; // whsec_...

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  const { event, data } = req.body;
  if (event === 'payment.captured') {
    console.log('Payment Confirmed for:', data.customerEmail);
    console.log('Amount Credited:', data.amount);
    // Fulfill order in your database!
  }

  res.json({ received: true });
});`}

            {activeCodeTab === 'node' && `// Node.js Express Create Checkout Session Endpoint
import express from 'express';

const app = express();

app.post('/api/create-checkout-session', async (req, res) => {
  const { amount, currency, title } = req.body;

  const response = await fetch('https://services.180workspace.com/api/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${process.env.ONE_EIGHTY_CLIENT_SECRET}\`,
    },
    body: JSON.stringify({
      clientId: process.env.ONE_EIGHTY_CLIENT_ID,
      amount,
      currency: currency || 'INR',
      title,
      returnUrl: 'https://myapp.com/checkout/success',
      cancelUrl: 'https://myapp.com/checkout/cancel',
    }),
  });

  const session = await response.json();
  res.json({ sessionId: session.id });
});`}

            {activeCodeTab === 'python' && `# Python FastAPI Webhook & Signature Verification
import hmac
import hashlib
import json
from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()
WEBHOOK_SECRET = "whsec_YOUR_SECRET"

@app.post("/webhooks/180-pay")
async def handle_180_webhook(request: Request, x_180_signature: str = Header(None)):
    raw_body = await request.body()
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(x_180_signature or "", expected_sig):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    payload = json.loads(raw_body)
    if payload.get("event") == "payment.captured":
        # Fulfill product
        print("Payment captured:", payload["data"]["transactionId"])

    return {"status": "success"}`}
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
              Payment was authorized from the user's 180 wallet. Webhook dispatched with <code className="text-emerald-500 font-mono">X-180-Signature</code>.
            </p>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-2 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Session ID:</span>{' '}
                <span className="text-purple-600 dark:text-purple-400 truncate">{paymentResult.sessionId}</span>
              </div>
              <div>
                <span className="text-zinc-500">Transaction ID:</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400 truncate">{paymentResult.transactionId || 'tx_demo_captured'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Amount:</span>{' '}
                <span className="font-bold text-zinc-900 dark:text-white">₹499.00 INR</span>
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
