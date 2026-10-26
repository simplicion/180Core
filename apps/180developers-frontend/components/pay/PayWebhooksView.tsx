'use client';

import React, { useState, useMemo } from 'react';
import {
  Webhook,
  Send,
  RotateCw,
  Loader2,
  Terminal,
  Save,
  CheckCircle2,
  Copy,
  ExternalLink,
  Code2,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Check,
  Key,
  Layers,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';
import { usePlatformCurrency } from '@workspace/ui';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

type CodeTab = 'nextjs' | 'express' | 'fastify' | 'python';
type EventTab = 'payment.captured' | 'subscription.created' | 'subscription.renewed' | 'coupon.redeemed';
type TelemetryTab = 'payload' | 'headers' | 'response' | 'verification';

export function PayWebhooksView() {
  const {
    project,
    webhookUrl,
    setWebhookUrl,
    webhookSecret,
    testResult,
    isTestingWebhook,
    handleTestWebhook,
    handleRotateWebhookSecret,
    saveSettings,
    saving,
  } = useProject();

  const { activeCurrency, activeMeta } = usePlatformCurrency();

  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('nextjs');
  const [activeEventTab, setActiveEventTab] = useState<EventTab>('payment.captured');
  const [selectedTestEvent, setSelectedTestEvent] = useState<EventTab>('payment.captured');
  const [telemetryTab, setTelemetryTab] = useState<TelemetryTab>('payload');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Real Project Metadata
  const appId = project?.id || project?.clientId || '180_client_app';
  const appName = project?.name || 'Developer Project';
  const currency = ((project as any)?.currency || activeCurrency || 'USD').toUpperCase();
  const defaultAmount = (project as any)?.defaultAmount !== undefined ? Number((project as any).defaultAmount) : 49.0;
  const currencySymbol = activeMeta?.symbol || (currency === 'INR' ? '₹' : '$');
  const currentEpoch = Math.floor(Date.now() / 1000);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings({ webhookUrl: webhookUrl.trim() });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const onTriggerTest = () => {
    if (!webhookUrl.trim()) {
      toast.error('Please configure a destination webhook URL first');
      return;
    }
    handleTestWebhook({
      url: webhookUrl.trim(),
      event: selectedTestEvent,
    });
  };

  // Real dynamic sample payloads grounded in project data
  const samplePayloads: Record<EventTab, object> = useMemo(() => ({
    'payment.captured': {
      id: `evt_pay_${project?.clientId ? project.clientId.slice(-10) : 'live_8a9b0c'}`,
      event: 'payment.captured',
      appId,
      timestamp: currentEpoch,
      data: {
        sessionId: `sess_live_180pay_${project?.clientId ? project.clientId.slice(-8) : 'e7a8b9c0'}`,
        transactionId: `txn_ledg_${Date.now().toString(36)}`,
        amount: defaultAmount,
        currency,
        amountFormatted: `${currencySymbol}${defaultAmount.toFixed(2)}`,
        title: `${appName} Order Checkout`,
        customerEmail: 'alex.dev@example.com',
        customerName: 'Alex Dev',
        paymentMethod: 'card_visa',
        platformFeeAmount: Number((defaultAmount * 0.015).toFixed(2)),
        netPayoutAmount: Number((defaultAmount * 0.985).toFixed(2)),
        metadata: {
          orderId: `ord_${Date.now().toString(36)}`,
          planName: 'Enterprise Growth Tier',
        },
      },
    },
    'subscription.created': {
      id: `evt_sub_${project?.clientId ? project.clientId.slice(-10) : 'live_1a2b3c'}`,
      event: 'subscription.created',
      appId,
      timestamp: currentEpoch,
      data: {
        subscriptionId: `sub_live_${Date.now().toString(36)}`,
        planCode: 'pro-monthly',
        billingInterval: 'month',
        amount: defaultAmount,
        currency,
        currentPeriodStart: currentEpoch,
        currentPeriodEnd: currentEpoch + 30 * 86400,
        trialEnd: null,
        status: 'active',
        customerEmail: 'alex.dev@example.com',
      },
    },
    'subscription.renewed': {
      id: `evt_ren_${project?.clientId ? project.clientId.slice(-10) : 'live_3c4d5e'}`,
      event: 'subscription.renewed',
      appId,
      timestamp: currentEpoch,
      data: {
        subscriptionId: `sub_live_${Date.now().toString(36)}`,
        transactionId: `txn_ren_${Date.now().toString(36)}`,
        amount: defaultAmount,
        currency,
        nextBillingDate: currentEpoch + 30 * 86400,
        status: 'active',
        customerEmail: 'alex.dev@example.com',
      },
    },
    'coupon.redeemed': {
      id: `evt_cpn_${project?.clientId ? project.clientId.slice(-10) : 'live_7a8b9c'}`,
      event: 'coupon.redeemed',
      appId,
      timestamp: currentEpoch,
      data: {
        couponId: 'cpn_launch50_prod',
        couponCode: 'LAUNCH50',
        discountType: 'percentage',
        discountPercent: 50,
        discountAmount: Number((defaultAmount * 0.5).toFixed(2)),
        sessionId: `sess_live_180pay_${project?.clientId ? project.clientId.slice(-8) : 'e7a8b9c0'}`,
        customerEmail: 'alex.dev@example.com',
      },
    },
  }), [appId, appName, currency, defaultAmount, currencySymbol, currentEpoch, project?.clientId]);

  // Dynamic code snippets with real secret and dual-header support
  const codeSnippets: Record<CodeTab, { language: string; file: string; code: string }> = useMemo(() => ({
    nextjs: {
      language: 'typescript',
      file: 'app/api/webhooks/180-pay/route.ts',
      code: `import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Ensure your .env has:
// ONE_EIGHTY_WEBHOOK_SECRET="${webhookSecret || 'whsec_your_secret_here'}"

export async function POST(req: Request) {
  try {
    // 1. MUST capture raw unparsed body as string
    const rawBody = await req.text();
    const rawSignature = req.headers.get('x-180-signature') || req.headers.get('X-180-Signature');
    const timestamp = req.headers.get('x-180-timestamp') || req.headers.get('X-180-Timestamp');
    const webhookSecret = process.env.ONE_EIGHTY_WEBHOOK_SECRET;

    if (!rawSignature || !timestamp || !webhookSecret) {
      return NextResponse.json({ error: 'Missing security headers or secret' }, { status: 400 });
    }

    // 2. Reject replays older than 5 minutes (300 seconds)
    const currentEpoch = Math.floor(Date.now() / 1000);
    if (Math.abs(currentEpoch - parseInt(timestamp, 10)) > 300) {
      return NextResponse.json({ error: 'Timestamp outside 5-minute replay window' }, { status: 401 });
    }

    // 3. Normalize signature (handles raw hex or compound t=...,v1=... format)
    let signature = rawSignature.trim();
    if (signature.includes('v1=')) {
      const match = signature.match(/v1=([a-f0-9]+)/i);
      if (match) signature = match[1];
    }

    // 4. Compute expected HMAC SHA-256 signature
    const payloadToSign = \`\${timestamp}.\${rawBody}\`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadToSign)
      .digest('hex');

    // 5. Timing-safe constant-time comparison (Length-guarded to prevent RangeError)
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // 6. Authentic event confirmed - safe to parse JSON & fulfill
    const event = JSON.parse(rawBody);

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentSuccess(event.data);
        break;
      case 'subscription.created':
      case 'subscription.renewed':
        await handleSubscriptionActive(event.data);
        break;
      case 'coupon.redeemed':
        await handleCouponRedeemed(event.data);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handlePaymentSuccess(data: any) {
  // Fulfill digital order in your database
  console.log('Payment verified & captured:', data.sessionId, data.amount, data.currency);
}

async function handleSubscriptionActive(data: any) {
  // Grant customer access until currentPeriodEnd
  console.log('Subscription active:', data.subscriptionId, data.planCode);
}

async function handleCouponRedeemed(data: any) {
  console.log('Coupon redeemed:', data.couponCode, data.discountAmount);
}`,
    },
    express: {
      language: 'typescript',
      file: 'src/routes/webhooks.ts',
      code: `import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// CRITICAL: Express must capture raw body buffer BEFORE express.json()
router.post(
  '/180-pay',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    try {
      const rawBody = req.body ? req.body.toString('utf-8') : '';
      const rawSignature = (req.headers['x-180-signature'] || req.headers['X-180-Signature']) as string;
      const timestamp = (req.headers['x-180-timestamp'] || req.headers['X-180-Timestamp']) as string;
      const secret = process.env.ONE_EIGHTY_WEBHOOK_SECRET!;

      if (!rawSignature || !timestamp || !secret) {
        return res.status(400).send('Missing headers or secret');
      }

      // 5-minute replay defense
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        return res.status(401).send('Timestamp expired');
      }

      // Normalize signature
      let signature = rawSignature.trim();
      if (signature.includes('v1=')) {
        const match = signature.match(/v1=([a-f0-9]+)/i);
        if (match) signature = match[1];
      }

      const payload = \`\${timestamp}.\${rawBody}\`;
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      // Length-safe constant-time comparison
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).send('Cryptographic signature mismatch');
      }

      const event = JSON.parse(rawBody);
      // Fulfill order in your database
      console.log('Verified 180 Pay event:', event.event, event.data?.sessionId);
      res.json({ received: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }
);`,
    },
    fastify: {
      language: 'typescript',
      file: 'src/routes/webhooks.ts (Fastify 5.x)',
      code: `import Fastify from 'fastify';
import crypto from 'crypto';
import rawBody from '@fastify/raw-body';

const app = Fastify();

// CRITICAL: Fastify's default JSON parser re-serializes bodies, breaking HMAC verification.
// Preserving raw unparsed bytes via @fastify/raw-body is mandatory.
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

const WEBHOOK_SECRET = process.env.ONE_EIGHTY_WEBHOOK_SECRET!;

app.post('/api/webhooks/180-pay', { config: { rawBody: true } }, async (req, reply) => {
  try {
    const rawPayload = (req as any).rawBody || '';
    const rawSig = (req.headers['x-180-signature'] || req.headers['X-180-Signature']) as string;
    const timestamp = (req.headers['x-180-timestamp'] || req.headers['X-180-Timestamp']) as string;

    if (!rawSig || !WEBHOOK_SECRET) {
      return reply.code(400).send({ error: 'Missing security headers or secret' });
    }

    // 1. Replay attack check (300s window)
    if (timestamp) {
      const currentEpoch = Math.floor(Date.now() / 1000);
      if (Math.abs(currentEpoch - parseInt(timestamp, 10)) > 300) {
        return reply.code(401).send({ error: 'Timestamp expired (>300s drift)' });
      }
    }

    let signature = rawSig.trim();
    if (signature.includes('v1=')) {
      const match = signature.match(/v1=([a-f0-9]+)/i);
      if (match) signature = match[1];
    }

    // 2. Canonical pre-image format: \`\${timestamp}.\${rawPayload}\`
    const payloadToSign = timestamp ? \`\${timestamp}.\${rawPayload}\` : rawPayload;
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payloadToSign)
      .digest('hex');

    // 3. Constant-time length-safe comparison
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return reply.code(401).send({ error: 'Cryptographic signature mismatch' });
    }

    // 4. Safe to parse and fulfill
    const event = JSON.parse(rawPayload);
    return reply.code(200).send({ received: true });
  } catch (err: any) {
    return reply.code(500).send({ error: err.message });
  }
});`,
    },
    python: {
      language: 'python',
      file: 'main.py (FastAPI)',
      code: `from fastapi import FastAPI, Request, HTTPException
import hmac
import hashlib
import json
import time
import os

app = FastAPI()

# In your .env: ONE_EIGHTY_WEBHOOK_SECRET="${webhookSecret || 'whsec_your_secret_here'}"
WEBHOOK_SECRET = os.getenv("ONE_EIGHTY_WEBHOOK_SECRET")

@app.post("/api/webhooks/180-pay")
async def verify_180_webhook(request: Request):
    # 1. Capture raw unparsed byte stream
    raw_body = await request.body()
    raw_signature = request.headers.get("x-180-signature") or request.headers.get("X-180-Signature")
    timestamp = request.headers.get("x-180-timestamp") or request.headers.get("X-180-Timestamp")

    if not raw_signature or not timestamp or not WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing headers or secret")

    # 2. Replay check (300 seconds)
    current_time = int(time.time())
    if abs(current_time - int(timestamp)) > 300:
        raise HTTPException(status_code=401, detail="Expired timestamp")

    # Normalize signature if compound format t=...,v1=...
    signature = raw_signature.strip()
    if "v1=" in signature:
        for part in signature.split(","):
            if part.startswith("v1="):
                signature = part.replace("v1=", "")

    # 3. Compute expected HMAC SHA-256
    payload = f"{timestamp}.".encode("utf-8") + raw_body
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()

    # 4. Constant-time compare
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid cryptographic signature")

    # 5. Process authentic payment event
    event = json.loads(raw_body.decode("utf-8"))
    print(f"Verified 180 Pay event: {event['event']}")
    
    return {"received": True}`,
    },
  }), [webhookSecret]);

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* 1. Header & Configuration Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Webhook className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                180 Pay Webhook & 2-Way Payment Verification Engine
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 pl-10">
              Real-time payment event notifications signed with HMAC SHA-256 for instant order fulfillment and zero-spoofing security.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getDocsUrl(DOCS_LINKS.PAY_WEBHOOKS)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Full Webhook Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Webhook URL</span>
            </button>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-xs text-purple-950 dark:text-purple-200 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>How Backend Payment Verification Works</span>
          </p>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Never rely on frontend redirects alone to mark orders as paid. When a customer pays, 180 Pay transmits an HTTP POST to your webhook destination containing an <code className="font-mono text-purple-600 dark:text-purple-400">X-180-Signature</code> header. Your backend cryptographically checks this signature with your signing secret before granting access.
          </p>
        </div>

        {/* Webhook Endpoint Input & Test Dispatcher */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Payment Webhook Destination URL</span>
            <span className="text-[10px] text-zinc-400 font-normal">Must accept HTTP POST with raw JSON payload</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://yourdomain.com/api/webhooks/180-pay"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              type="button"
              onClick={onTriggerTest}
              disabled={isTestingWebhook || !webhookUrl.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0 active:scale-95"
              title="Dispatch test event to this endpoint"
            >
              {isTestingWebhook ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Ping...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Ping</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Event Selector Pills for Testing */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-zinc-500 font-medium">Event to Simulate:</span>
            {(
              [
                { id: 'payment.captured', label: 'Payment Captured' },
                { id: 'subscription.created', label: 'Subscription Created' },
                { id: 'subscription.renewed', label: 'Subscription Renewed' },
                { id: 'coupon.redeemed', label: 'Coupon Redeemed' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTestEvent(item.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                  selectedTestEvent === item.id
                    ? 'bg-purple-600 text-white font-bold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/5'
                }`}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>

        {/* Webhook Signing Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Webhook Signing Secret (HMAC SHA-256)</span>
            <span className="text-[10px] text-zinc-400 font-normal">Stored safely on server — keep confidential</span>
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex-1 select-all text-zinc-900 dark:text-zinc-200 font-mono">
              {webhookSecret ? webhookSecret : 'Secret configured automatically on project creation'}
            </span>

            {webhookSecret && (
              <button
                type="button"
                onClick={() => copyToClipboard(webhookSecret, 'secret')}
                className="px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedKey === 'secret' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'secret' ? 'Copied' : 'Copy Secret'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRotateWebhookSecret}
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate</span>
            </button>
          </div>

          {/* Quick .env copy hint */}
          {webhookSecret && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/5 text-[11px] font-mono text-zinc-500">
              <span className="truncate">ONE_EIGHTY_WEBHOOK_SECRET="{webhookSecret}"</span>
              <button
                type="button"
                onClick={() => copyToClipboard(`ONE_EIGHTY_WEBHOOK_SECRET="${webhookSecret}"`, 'env_snippet')}
                className="ml-2 text-purple-600 dark:text-purple-400 hover:underline shrink-0 flex items-center gap-1 cursor-pointer font-sans text-[11px]"
              >
                {copiedKey === 'env_snippet' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'env_snippet' ? 'Copied .env' : 'Copy .env variable'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Test Result Telemetry Console */}
        {testResult && (
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs shadow-xl">
            {/* Telemetry Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span className="text-zinc-200 font-bold">Live Webhook Delivery Telemetry</span>
                <span className="text-[10px] text-zinc-400 font-normal truncate max-w-xs">
                  → {testResult.targetUrl}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    testResult.success
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  HTTP {testResult.statusCode}
                </span>
                <span className="text-zinc-400 text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{testResult.latencyMs}ms</span>
                </span>
              </div>
            </div>

            {/* Telemetry Sub-Tabs */}
            <div className="flex items-center border-b border-zinc-800 bg-zinc-900/40 px-3 text-[11px]">
              {(
                [
                  { id: 'payload', label: 'Dispatched Payload (JSON)' },
                  { id: 'headers', label: 'Security Headers' },
                  { id: 'response', label: 'Server Response' },
                  { id: 'verification', label: 'Signature Diagnostics' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTelemetryTab(tab.id)}
                  className={`px-3 py-2 border-b-2 font-sans transition-all cursor-pointer ${
                    telemetryTab === tab.id
                      ? 'border-purple-500 text-purple-400 font-bold bg-zinc-900/60'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Dispatched Payload */}
            {telemetryTab === 'payload' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Actual JSON payload sent to your server:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(testResult.requestPayload || samplePayloads[selectedTestEvent], null, 2),
                        'telemetry_payload'
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] cursor-pointer"
                  >
                    {copiedKey === 'telemetry_payload' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'telemetry_payload' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 overflow-x-auto text-[11px] leading-relaxed text-purple-300 max-h-[260px] select-all">
                  <code>
                    {JSON.stringify(testResult.requestPayload || samplePayloads[selectedTestEvent], null, 2)}
                  </code>
                </pre>
              </div>
            )}

            {/* Tab 2: Security Headers */}
            {telemetryTab === 'headers' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>HTTP request headers attached to POST dispatch:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          testResult.headersSent || {
                            'Content-Type': 'application/json',
                            'X-180-Signature': testResult.signature,
                            'X-180-Timestamp': testResult.timestamp || Math.floor(Date.now() / 1000).toString(),
                            'X-180-Event': testResult.event || selectedTestEvent,
                            'x-180-signature': `t=${testResult.timestamp || Math.floor(Date.now() / 1000)},v1=${testResult.signature}`,
                            'User-Agent': '180-Pay-Webhook-Dispatcher/2.0',
                          },
                          null,
                          2
                        ),
                        'telemetry_headers'
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] cursor-pointer"
                  >
                    {copiedKey === 'telemetry_headers' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'telemetry_headers' ? 'Copied' : 'Copy Headers'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-2 text-[11px]">
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-500 font-bold shrink-0">Content-Type:</span>
                    <span className="text-zinc-200 font-mono">application/json</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-500 font-bold shrink-0">X-180-Signature:</span>
                    <span className="text-emerald-400 truncate text-right font-mono select-all">
                      {testResult.signature || 'HMAC-SHA256 signature'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-500 font-bold shrink-0">X-180-Timestamp:</span>
                    <span className="text-zinc-200 font-mono">
                      {testResult.timestamp || Math.floor(Date.now() / 1000)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-500 font-bold shrink-0">X-180-Event:</span>
                    <span className="text-purple-400 font-bold">{testResult.event || selectedTestEvent}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-zinc-500 font-bold shrink-0">x-180-signature (Compound):</span>
                    <span className="text-zinc-400 truncate text-right font-mono text-[10px] select-all">
                      t={testResult.timestamp || Math.floor(Date.now() / 1000)},v1={testResult.signature}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Server Response */}
            {telemetryTab === 'response' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Server response: {testResult.message}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      testResult.success
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    HTTP {testResult.statusCode}
                  </span>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 overflow-x-auto text-[11px] leading-relaxed text-zinc-300 max-h-[220px] select-all">
                  <code>
                    {testResult.response ||
                      (testResult.success
                        ? '{"received": true}'
                        : 'No response body returned or network error occurred.')}
                  </code>
                </pre>
              </div>
            )}

            {/* Tab 4: Cryptographic Verification Diagnostic */}
            {telemetryTab === 'verification' && (
              <div className="p-4 space-y-3 font-mono text-[11px]">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-purple-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Cryptographic Pre-image Canonical Match</span>
                  </div>
                  <p className="text-[10px] text-zinc-300">
                    Your backend must hash <code className="text-purple-300">timestamp + "." + rawBody</code> using your secret with SHA-256.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-2">
                  <div className="border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500 block text-[10px]">Active Signing Secret:</span>
                    <span className="text-zinc-200 font-mono select-all">
                      {webhookSecret || 'process.env.ONE_EIGHTY_WEBHOOK_SECRET'}
                    </span>
                  </div>
                  <div className="border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500 block text-[10px]">Expected HMAC-SHA256:</span>
                    <span className="text-emerald-400 font-mono break-all select-all">
                      {testResult.signature || 'HMAC signature'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Canonical Pre-Image Format:</span>
                    <span className="text-zinc-300 font-mono text-[10px]">
                      {testResult.timestamp || currentEpoch}.&lt;raw_json_string&gt;
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Verification Protocol & Checklist */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Cryptographic Verification Checklist (4 Pillars)</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Follow this exact protocol in your server handler to guarantee authentic transactions:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px]">1</span>
              <span>Raw Unparsed Body</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Extract the HTTP request body as an untouched string or Buffer. If your framework parses JSON before computing HMAC, whitespace differences will fail verification.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px]">2</span>
              <span>Replay Attack Shield (&lt; 300s)</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Read <code className="font-mono text-purple-600 dark:text-purple-400">X-180-Timestamp</code>. Reject any webhook dispatched more than 5 minutes ago to prevent malicious network interception and replay.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px]">3</span>
              <span>HMAC-SHA256 Signature</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Compute <code className="font-mono text-purple-600 dark:text-purple-400">HMAC_SHA256(timestamp + "." + rawBody, secret)</code>. This binds the timestamp to the payload and prevents header tampering.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px]">4</span>
              <span>Constant-Time Comparison</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Use <code className="font-mono text-purple-600 dark:text-purple-400">crypto.timingSafeEqual()</code> rather than <code className="font-mono">===</code> to prevent timing side-channel attacks on your server.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Ready-to-Copy Verification Code Tabs */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Copyable Backend Verification Code</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Drop this verification handler directly into your application router:
            </p>
          </div>

          {/* Framework Switcher */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setActiveCodeTab('nextjs')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'nextjs'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Next.js (App Router)
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab('express')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'express'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Express.js
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab('fastify')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'fastify'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Fastify 5.x
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab('python')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'python'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Python (FastAPI)
            </button>
          </div>
        </div>

        {/* Code block with copy action */}
        <div className="relative rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
            <span>{codeSnippets[activeCodeTab].file}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(codeSnippets[activeCodeTab].code, `code_${activeCodeTab}`)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-sans font-semibold text-[11px] transition-colors cursor-pointer"
            >
              {copiedKey === `code_${activeCodeTab}` ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-zinc-200 max-h-[380px]">
            <code>{codeSnippets[activeCodeTab].code}</code>
          </pre>
        </div>
      </div>

      {/* 4. Interactive Sample Event Payloads */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Event Payload Inspector (Real Project Data)</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Inspect sample payloads delivered by 180 Pay using your active App ID, currency, and format:
            </p>
          </div>

          {/* Event Selector */}
          <div className="flex flex-wrap gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
            {(['payment.captured', 'subscription.created', 'subscription.renewed', 'coupon.redeemed'] as EventTab[]).map(
              (evt) => (
                <button
                  key={evt}
                  type="button"
                  onClick={() => setActiveEventTab(evt)}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                    activeEventTab === evt
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {evt}
                </button>
              )
            )}
          </div>
        </div>

        <div className="relative rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
            <span>Event: <strong className="text-purple-400">{activeEventTab}</strong></span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(JSON.stringify(samplePayloads[activeEventTab], null, 2), `payload_${activeEventTab}`)
              }
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-sans font-semibold text-[11px] transition-colors cursor-pointer"
            >
              {copiedKey === `payload_${activeEventTab}` ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Copied JSON</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Payload JSON</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-purple-300 max-h-[300px]">
            <code>{JSON.stringify(samplePayloads[activeEventTab], null, 2)}</code>
          </pre>
        </div>
      </div>
    </form>
  );
}

export default PayWebhooksView;
