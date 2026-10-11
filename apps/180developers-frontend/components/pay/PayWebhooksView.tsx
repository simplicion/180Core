'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

type CodeTab = 'nextjs' | 'express' | 'python';
type EventTab = 'payment.captured' | 'subscription.created' | 'subscription.renewed' | 'coupon.redeemed';

export function PayWebhooksView() {
  const {
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

  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('nextjs');
  const [activeEventTab, setActiveEventTab] = useState<EventTab>('payment.captured');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const codeSnippets: Record<CodeTab, { language: string; file: string; code: string }> = {
    nextjs: {
      language: 'typescript',
      file: 'app/api/webhooks/180-pay/route.ts',
      code: `import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    // 1. MUST capture raw unparsed body as string
    const rawBody = await req.text();
    const signature = req.headers.get('x-180-signature');
    const timestamp = req.headers.get('x-180-timestamp');
    const webhookSecret = process.env.ONE_EIGHTY_WEBHOOK_SECRET;

    if (!signature || !timestamp || !webhookSecret) {
      return NextResponse.json({ error: 'Missing security headers or secret' }, { status: 400 });
    }

    // 2. Reject replays older than 5 minutes (300 seconds)
    const currentEpoch = Math.floor(Date.now() / 1000);
    if (Math.abs(currentEpoch - parseInt(timestamp, 10)) > 300) {
      return NextResponse.json({ error: 'Timestamp outside 5-minute replay window' }, { status: 401 });
    }

    // 3. Compute expected HMAC SHA-256 signature
    const payloadToSign = \`\${timestamp}.\${rawBody}\`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadToSign)
      .digest('hex');

    // 4. Timing-safe constant-time comparison
    const sigBuffer = Buffer.from(signature, 'hex');
    const expBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // 5. Authentic event confirmed - safe to parse JSON & fulfill
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
}`,
    },
    express: {
      language: 'typescript',
      file: 'src/routes/webhooks.ts',
      code: `import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// CRITICAL: Express must NOT parse JSON prior to HMAC verification
router.post(
  '/180-pay',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const rawBody = req.body.toString('utf-8');
      const signature = req.headers['x-180-signature'] as string;
      const timestamp = req.headers['x-180-timestamp'] as string;
      const secret = process.env.ONE_EIGHTY_WEBHOOK_SECRET!;

      if (!signature || !timestamp || !secret) {
        return res.status(400).send('Missing headers or secret');
      }

      // 5-minute replay defense
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
        return res.status(401).send('Timestamp expired');
      }

      const payload = \`\${timestamp}.\${rawBody}\`;
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).send('Cryptographic signature mismatch');
      }

      const event = JSON.parse(rawBody);
      // Fulfill order
      res.json({ received: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }
);`,
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

WEBHOOK_SECRET = os.getenv("ONE_EIGHTY_WEBHOOK_SECRET")

@app.post("/api/webhooks/180-pay")
async def verify_180_webhook(request: Request):
    # 1. Capture raw unparsed byte stream
    raw_body = await request.body()
    signature = request.headers.get("x-180-signature")
    timestamp = request.headers.get("x-180-timestamp")

    if not signature or not timestamp or not WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing headers or secret")

    # 2. Replay check (300 seconds)
    current_time = int(time.time())
    if abs(current_time - int(timestamp)) > 300:
        raise HTTPException(status_code=401, detail="Expired timestamp")

    # 3. Compute expected HMAC SHA-256
    payload = f"{timestamp}.".encode("utf-8") + raw_body
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()

    # 4. Constant-time compare
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 5. Process authentic payment event
    event = json.loads(raw_body.decode("utf-8"))
    print(f"Verified payment event: {event['event']}")
    
    return {"received": True}`,
    },
  };

  const samplePayloads: Record<EventTab, object> = {
    'payment.captured': {
      id: 'evt_pay_9a8b7c6d5e4f',
      event: 'payment.captured',
      appId: '7697a348-7550-4229-9595-08ba67aa9755',
      timestamp: 1728135600,
      data: {
        sessionId: 'sess_live_180pay_e7a8b9c0d1',
        amount: 29900,
        currency: 'USD',
        amountFormatted: '$299.00',
        customerEmail: 'alex.dev@example.com',
        customerName: 'Alex Dev',
        paymentMethod: 'card_visa',
        platformFeeAmount: 448,
        netPayoutAmount: 29452,
        metadata: {
          organizationId: 'org_8192a',
          planName: 'Enterprise Growth Tier',
        },
      },
    },
    'subscription.created': {
      id: 'evt_sub_1a2b3c4d5e6f',
      event: 'subscription.created',
      appId: '7697a348-7550-4229-9595-08ba67aa9755',
      timestamp: 1728135600,
      data: {
        subscriptionId: 'sub_live_99a8b7c6',
        planCode: 'pro-monthly',
        billingInterval: 'month',
        amount: 250,
        currency: 'USD',
        currentPeriodStart: 1728135600,
        currentPeriodEnd: 1730727600,
        trialEnd: null,
        status: 'active',
      },
    },
    'subscription.renewed': {
      id: 'evt_ren_3c4d5e6f7a8b',
      event: 'subscription.renewed',
      appId: '7697a348-7550-4229-9595-08ba67aa9755',
      timestamp: 1730727600,
      data: {
        subscriptionId: 'sub_live_99a8b7c6',
        transactionId: 'txn_ren_44a55b66',
        amount: 250,
        currency: 'USD',
        nextBillingDate: 1733406000,
        status: 'active',
      },
    },
    'coupon.redeemed': {
      id: 'evt_cpn_7a8b9c0d1e2f',
      event: 'coupon.redeemed',
      appId: '7697a348-7550-4229-9595-08ba67aa9755',
      timestamp: 1728135600,
      data: {
        couponCode: 'LAUNCH50',
        discountType: 'percentage',
        discountPercent: 50,
        discountAmount: 14950,
        sessionId: 'sess_live_180pay_e7a8b9c0d1',
      },
    },
  };

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
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
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

        {/* Webhook Endpoint Input & Test Button */}
        <div className="space-y-2">
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
              onClick={handleTestWebhook}
              disabled={isTestingWebhook || !webhookUrl.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
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
        </div>

        {/* Webhook Signing Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Webhook Signing Secret (HMAC SHA-256)</span>
            <span className="text-[10px] text-zinc-400 font-normal">Stored safely on server — keep confidential</span>
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex-1 select-all">
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
        </div>

        {/* Test Result Console */}
        {testResult && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-300 font-bold">Live Webhook Delivery Telemetry</span>
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeCodeTab === 'express'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Express.js
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab('python')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
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
              <span>Event Payload Inspector</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Inspect sample payloads delivered by 180 Pay to your webhook endpoint:
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
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition-all ${
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
