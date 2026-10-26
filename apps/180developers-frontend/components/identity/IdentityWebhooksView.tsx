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
  Sparkles,
  AlertTriangle,
  Info,
  Check,
  ChevronRight,
  Server,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

type CodeTab = 'nextjs' | 'express' | 'python';
type EventTab =
  | 'identity.user.signup'
  | 'identity.user.authenticated'
  | 'identity.user.phone_verified'
  | 'identity.session.revoked'
  | 'identity.test';
type TelemetryTab = 'payload' | 'headers' | 'response' | 'verification';

export function IdentityWebhooksView() {
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

  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('nextjs');
  const [activeEventTab, setActiveEventTab] = useState<EventTab>('identity.user.signup');
  const [testEventChoice, setTestEventChoice] = useState<EventTab>('identity.user.signup');
  const [telemetryTab, setTelemetryTab] = useState<TelemetryTab>('payload');
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

  const onTriggerTest = () => {
    handleTestWebhook({
      url: webhookUrl.trim(),
      event: testEventChoice,
    });
  };

  const appId = project?.id || '7697a348-7550-4229-9595-08ba67aa9755';

  const samplePayloads: Record<EventTab, object> = {
    'identity.user.signup': {
      id: 'evt_usr_1a2b3c4d5e6f',
      event: 'identity.user.signup',
      appId: appId,
      timestamp: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      data: {
        userId: 'usr_c394a1b0-9f5b-4b2a-8d1e-456789abcdef',
        username: 'alex.rivera_92',
        email: 'alex.rivera@example.com',
        phone: '+919876543210',
        phoneVerified: true,
        authMethod: 'whatsapp_otp',
        ipAddress: '203.0.113.195',
        createdAt: new Date().toISOString(),
      },
    },
    'identity.user.authenticated': {
      id: 'evt_auth_7a8b9c0d1e2f',
      event: 'identity.user.authenticated',
      appId: appId,
      timestamp: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      data: {
        userId: 'usr_c394a1b0-9f5b-4b2a-8d1e-456789abcdef',
        sessionId: 'sess_live_auth_44b55c66d7',
        ipAddress: '203.0.113.195',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        authMethod: 'google_oauth',
        authenticatedAt: new Date().toISOString(),
      },
    },
    'identity.user.phone_verified': {
      id: 'evt_vfy_9a0b1c2d3e4f',
      event: 'identity.user.phone_verified',
      appId: appId,
      timestamp: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      data: {
        userId: 'usr_c394a1b0-9f5b-4b2a-8d1e-456789abcdef',
        phone: '+919876543210',
        channel: 'whatsapp',
        verifiedAt: new Date().toISOString(),
      },
    },
    'identity.session.revoked': {
      id: 'evt_rvk_5e6f7a8b9c0d',
      event: 'identity.session.revoked',
      appId: appId,
      timestamp: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      data: {
        userId: 'usr_c394a1b0-9f5b-4b2a-8d1e-456789abcdef',
        sessionId: 'sess_live_auth_44b55c66d7',
        reason: 'user_signout',
        revokedAt: new Date().toISOString(),
      },
    },
    'identity.test': {
      id: 'evt_test_998877665544',
      event: 'identity.test',
      appId: appId,
      timestamp: Math.floor(Date.now() / 1000),
      createdAt: new Date().toISOString(),
      data: {
        ping: 'pong',
        service: '180 Identity Engine',
        appName: project?.name || 'My Application',
        environment: 'sandbox',
        message: 'Test webhook ping delivered from 180 Core Developer Console',
      },
    },
  };

  const codeSnippets: Record<CodeTab, { language: string; file: string; code: string }> = {
    nextjs: {
      language: 'typescript',
      file: 'app/api/webhooks/180-identity/route.ts',
      code: `import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    // 1. MUST read the raw unparsed request body string (do NOT use req.json() first)
    const rawBody = await req.text();

    // 2. Extract signature and timestamp headers
    let signature = req.headers.get('x-180-signature') || '';
    let timestamp = req.headers.get('x-180-timestamp') || '';
    const webhookSecret = process.env.ONE_EIGHTY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: 'ONE_EIGHTY_WEBHOOK_SECRET not configured' }, { status: 500 });
    }

    // Support compound header format: t=1728135600,v1=abcdef...
    if (signature.includes('t=') && signature.includes('v1=')) {
      const parts = signature.split(',');
      const tPart = parts.find((p) => p.trim().startsWith('t='));
      const vPart = parts.find((p) => p.trim().startsWith('v1='));
      if (tPart && !timestamp) timestamp = tPart.replace('t=', '').trim();
      if (vPart) signature = vPart.replace('v1=', '').trim();
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing x-180-signature header' }, { status: 400 });
    }

    // 3. Replay attack defense: reject requests older than 5 minutes (300 seconds)
    if (timestamp) {
      const currentEpoch = Math.floor(Date.now() / 1000);
      const parsedTimestamp = parseInt(timestamp, 10);
      if (isNaN(parsedTimestamp) || Math.abs(currentEpoch - parsedTimestamp) > 300) {
        return NextResponse.json({ error: 'Timestamp outside 5-minute replay window' }, { status: 401 });
      }
    }

    // 4. Compute expected HMAC-SHA256 signature
    // Canonical format: \`\${timestamp}.\${rawBody}\` (or rawBody fallback if no timestamp)
    const payloadToSign = timestamp ? \`\${timestamp}.\${rawBody}\` : rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadToSign)
      .digest('hex');

    // 5. Timing-safe constant-time comparison (guards against timing attacks)
    const sigBuffer = Buffer.from(signature.trim());
    const expBuffer = Buffer.from(expectedSignature.trim());

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return NextResponse.json({ error: 'Invalid cryptographic HMAC signature' }, { status: 401 });
    }

    // 6. Safe to parse verified JSON event payload
    const event = JSON.parse(rawBody);

    switch (event.event) {
      case 'identity.user.signup':
        await syncNewUserWithDatabase(event.data);
        break;
      case 'identity.user.authenticated':
        await recordUserLoginAudit(event.data);
        break;
      case 'identity.user.phone_verified':
        await updateUserPhoneStatus(event.data);
        break;
      case 'identity.session.revoked':
        await invalidateLocalSession(event.data);
        break;
      case 'identity.test':
        console.log('Received 180 Identity test handshake ping:', event.data.ping);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function syncNewUserWithDatabase(data: any) {
  console.log('New user created via 180 Identity:', data.userId, data.username, data.email);
}

async function recordUserLoginAudit(data: any) {
  console.log('User logged in:', data.userId, data.authMethod, data.ipAddress);
}

async function updateUserPhoneStatus(data: any) {
  console.log('Phone verified via WhatsApp/SMS:', data.userId, data.phone);
}

async function invalidateLocalSession(data: any) {
  console.log('Session revoked:', data.userId, data.sessionId);
}`,
    },
    express: {
      language: 'typescript',
      file: 'src/routes/identity-webhooks.ts',
      code: `import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// CRITICAL: Must use express.raw() BEFORE express.json() to capture raw buffer
router.post(
  '/api/webhooks/180-identity',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    try {
      const rawBody = req.body ? req.body.toString('utf-8') : '';
      let signature = (req.headers['x-180-signature'] as string) || '';
      let timestamp = (req.headers['x-180-timestamp'] as string) || '';
      const secret = process.env.ONE_EIGHTY_WEBHOOK_SECRET!;

      if (!secret) {
        return res.status(500).send('ONE_EIGHTY_WEBHOOK_SECRET not configured');
      }

      // Handle compound t=...,v1=... format
      if (signature.includes('t=') && signature.includes('v1=')) {
        const parts = signature.split(',');
        const tPart = parts.find((p) => p.trim().startsWith('t='));
        const vPart = parts.find((p) => p.trim().startsWith('v1='));
        if (tPart && !timestamp) timestamp = tPart.replace('t=', '').trim();
        if (vPart) signature = vPart.replace('v1=', '').trim();
      }

      if (!signature) {
        return res.status(400).send('Missing x-180-signature header');
      }

      // Replay defense window (300 seconds)
      if (timestamp) {
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
          return res.status(401).send('Timestamp expired');
        }
      }

      // Verify HMAC-SHA256 signature
      const payloadToSign = timestamp ? \`\${timestamp}.\${rawBody}\` : rawBody;
      const expected = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

      const sigBuf = Buffer.from(signature.trim());
      const expBuf = Buffer.from(expected.trim());

      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).send('Invalid cryptographic signature');
      }

      const event = JSON.parse(rawBody);
      console.log('Verified 180 Identity event:', event.event);

      // Respond with HTTP 200
      res.json({ received: true });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }
);

export default router;`,
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

@app.post("/api/webhooks/180-identity")
async def verify_identity_webhook(request: Request):
    # 1. Read raw binary body bytes
    raw_body = await request.body()
    signature = request.headers.get("x-180-signature", "")
    timestamp = request.headers.get("x-180-timestamp", "")

    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="ONE_EIGHTY_WEBHOOK_SECRET missing")

    # Handle compound t=...,v1=... format
    if "t=" in signature and "v1=" in signature:
        for part in signature.split(","):
            part = part.strip()
            if part.startswith("t=") and not timestamp:
                timestamp = part.replace("t=", "").strip()
            elif part.startswith("v1="):
                signature = part.replace("v1=", "").strip()

    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature header")

    # 2. 5-minute replay defense
    if timestamp:
        current_time = int(time.time())
        if abs(current_time - int(timestamp)) > 300:
            raise HTTPException(status_code=401, detail="Expired timestamp")

    # 3. Compute expected signature
    if timestamp:
        payload_to_sign = f"{timestamp}.".encode("utf-8") + raw_body
    else:
        payload_to_sign = raw_body

    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        payload_to_sign,
        hashlib.sha256
    ).hexdigest()

    # 4. Constant-time comparison
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    event = json.loads(raw_body.decode("utf-8"))
    print(f"Verified identity event: {event['event']}")
    
    return {"received": True}`,
    },
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* 1. Main Configuration Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Webhook className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                180 Identity Webhooks & Auth Event Sync
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 pl-10">
              Receive real-time notifications for user signups, logins, WhatsApp OTP verifications, and session updates.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getDocsUrl(DOCS_LINKS.IDENTITY_WEBHOOKS)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Identity Webhook Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Webhook URL</span>
            </button>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-950 dark:text-blue-200 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Server-to-Server User Synchronization</span>
          </p>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            When users authenticate through 180 Identity (Google SSO, Email, or WhatsApp 1-Tap), 180 Core sends an HTTP POST event to your webhook destination. Use this to automatically create corresponding rows in your database or CRM with zero manual setup.
          </p>
        </div>

        {/* Webhook Endpoint Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Identity Webhook Destination URL</span>
            <span className="text-[10px] text-zinc-400 font-normal">Endpoint receives real-time auth event payloads</span>
          </label>
          <input
            type="url"
            placeholder="https://yourdomain.com/api/webhooks/180-identity"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Webhook Signing Secret */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Webhook Signing Secret (HMAC SHA-256)</span>
            <span className="text-[10px] text-zinc-400 font-normal">Shared secret for signature verification</span>
          </label>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex-1 select-all truncate">
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
              className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate</span>
            </button>
          </div>
        </div>

        {/* Interactive Event Verification Dispatcher */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                <span>Test & Verify Webhook Dispatch</span>
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Select an authentic Identity auth event and dispatch a test payload to your endpoint with cryptographic signatures.
              </p>
            </div>

            <button
              type="button"
              onClick={onTriggerTest}
              disabled={isTestingWebhook || !webhookUrl.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
            >
              {isTestingWebhook ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Event...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Ping</span>
                </>
              )}
            </button>
          </div>

          {/* Event Picker Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(
              [
                { id: 'identity.user.signup', label: 'User Signup', tag: 'Signup' },
                { id: 'identity.user.authenticated', label: 'User Login', tag: 'Auth' },
                { id: 'identity.user.phone_verified', label: 'Phone Verified', tag: 'OTP' },
                { id: 'identity.session.revoked', label: 'Session Revoked', tag: 'Signout' },
                { id: 'identity.test', label: 'System Ping', tag: 'Handshake' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTestEventChoice(item.id as EventTab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  testEventChoice === item.id
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                    testEventChoice === item.id
                      ? 'bg-white/20 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {item.tag}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Delivery Telemetry & Verification Debugger */}
        {testResult && (
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs shadow-lg space-y-0">
            {/* Telemetry Header */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="text-zinc-200 font-bold">Live Delivery Telemetry & Verification Inspector</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    testResult.success
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  }`}
                >
                  HTTP {testResult.statusCode}
                </span>
                <span className="text-zinc-400 text-[10px] bg-zinc-800 px-2 py-0.5 rounded-md font-mono">
                  {testResult.latencyMs}ms
                </span>
              </div>
            </div>

            {/* Quick Meta Row */}
            <div className="px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
              <div className="flex items-center gap-2 truncate">
                <span className="text-zinc-500">Destination:</span>
                <span className="text-zinc-200 truncate">{testResult.targetUrl}</span>
              </div>
              <div className="flex items-center gap-3">
                {testResult.event && (
                  <div>
                    <span className="text-zinc-500">Event:</span>{' '}
                    <span className="text-blue-400 font-semibold">{testResult.event}</span>
                  </div>
                )}
                {testResult.timestamp && (
                  <div>
                    <span className="text-zinc-500">Timestamp:</span>{' '}
                    <span className="text-zinc-300">{testResult.timestamp}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-tabs for Telemetry Inspector */}
            <div className="flex items-center gap-1 px-4 pt-3 bg-zinc-950 border-b border-zinc-800 text-[11px]">
              <button
                type="button"
                onClick={() => setTelemetryTab('payload')}
                className={`px-3 py-1.5 font-sans font-semibold border-b-2 transition-all cursor-pointer ${
                  telemetryTab === 'payload'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Dispatched Payload
              </button>
              <button
                type="button"
                onClick={() => setTelemetryTab('headers')}
                className={`px-3 py-1.5 font-sans font-semibold border-b-2 transition-all cursor-pointer ${
                  telemetryTab === 'headers'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Security Headers Sent
              </button>
              <button
                type="button"
                onClick={() => setTelemetryTab('response')}
                className={`px-3 py-1.5 font-sans font-semibold border-b-2 transition-all cursor-pointer ${
                  telemetryTab === 'response'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Server Response Body
              </button>
              <button
                type="button"
                onClick={() => setTelemetryTab('verification')}
                className={`px-3 py-1.5 font-sans font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1 ${
                  telemetryTab === 'verification'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verification Guide</span>
              </button>
            </div>

            {/* Sub-tab 1: Dispatched Payload */}
            {telemetryTab === 'payload' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Exact JSON body transmitted:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          testResult.requestPayload || samplePayloads[testEventChoice],
                          null,
                          2
                        ),
                        'telemetry_payload'
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] cursor-pointer"
                  >
                    {copiedKey === 'telemetry_payload' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'telemetry_payload' ? 'Copied' : 'Copy Payload'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 overflow-x-auto text-[11px] leading-relaxed text-blue-300 max-h-[260px]">
                  <code>
                    {JSON.stringify(
                      testResult.requestPayload || samplePayloads[testEventChoice],
                      null,
                      2
                    )}
                  </code>
                </pre>
              </div>
            )}

            {/* Sub-tab 2: Security Headers */}
            {telemetryTab === 'headers' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>HTTP Request Headers attached to POST payload:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          testResult.headersSent || {
                            'Content-Type': 'application/json',
                            'X-180-Signature': testResult.signature,
                            'X-180-Timestamp': testResult.timestamp || Math.floor(Date.now() / 1000).toString(),
                            'X-180-Event': testResult.event || testEventChoice,
                            'x-180-signature': `t=${testResult.timestamp || Math.floor(Date.now() / 1000)},v1=${testResult.signature}`,
                            'User-Agent': '180-Webhook-Dispatcher/1.0',
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
                    <span className="text-zinc-200">application/json</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-500 font-bold shrink-0">X-180-Signature:</span>
                    <span className="text-emerald-400 truncate text-right font-mono">
                      {testResult.signature || 'Generated HMAC-SHA256'}
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
                    <span className="text-blue-400 font-bold">{testResult.event || testEventChoice}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-zinc-500 font-bold shrink-0">x-180-signature (Compound):</span>
                    <span className="text-zinc-400 truncate text-right font-mono text-[10px]">
                      t={testResult.timestamp || Math.floor(Date.now() / 1000)},v1={testResult.signature}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 3: Server Response */}
            {telemetryTab === 'response' && (
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Server Response Status: {testResult.message}</span>
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
                <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 overflow-x-auto text-[11px] leading-relaxed text-zinc-300 max-h-[220px]">
                  <code>
                    {testResult.response ||
                      (testResult.success
                        ? '{"received": true}'
                        : 'No response body returned or connection error.')}
                  </code>
                </pre>
              </div>
            )}

            {/* Sub-tab 4: Verification Debugger & Guide */}
            {telemetryTab === 'verification' && (
              <div className="p-4 space-y-3 font-sans text-xs">
                <div className="flex items-center gap-2 text-zinc-200 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>How to verify this webhook signature on your backend:</span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-[11px] font-mono">
                  <div className="text-zinc-400">
                    <span className="text-zinc-500 font-bold">1. Pre-image to Sign:</span>
                    <div className="p-2 mt-1 rounded bg-zinc-950 text-blue-300 truncate">
                      {testResult.timestamp || '<timestamp>'}.{JSON.stringify(testResult.requestPayload || samplePayloads[testEventChoice])}
                    </div>
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-zinc-500 font-bold">2. Shared Secret (HMAC-SHA256):</span>
                    <div className="p-2 mt-1 rounded bg-zinc-950 text-amber-300 font-mono truncate">
                      {webhookSecret || 'process.env.ONE_EIGHTY_WEBHOOK_SECRET'}
                    </div>
                  </div>
                  <div className="text-zinc-400">
                    <span className="text-zinc-500 font-bold">3. Resulting Expected Signature:</span>
                    <div className="p-2 mt-1 rounded bg-zinc-950 text-emerald-300 font-mono truncate">
                      {testResult.signature || 'Will match X-180-Signature exactly'}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 space-y-1.5 leading-relaxed">
                  <p className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Got HTTP 400 or 401 signature verification failure?</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1">
                    <li>
                      <strong>Do not parse JSON before signature check:</strong> Capture the raw body string using{' '}
                      <code className="text-zinc-300 font-mono">req.text()</code> (Next.js) or{' '}
                      <code className="text-zinc-300 font-mono">express.raw()</code> (Express).
                    </li>
                    <li>
                      <strong>Prefix with timestamp:</strong> Concatenate{' '}
                      <code className="text-zinc-300 font-mono">{`${'${timestamp}'}.${'${rawBody}'}`}</code> as the pre-image string.
                    </li>
                    <li>
                      <strong>Match the secret:</strong> Ensure your server environment uses the active Webhook Secret shown above.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Ready-to-Copy Verification Middleware Tabs */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Identity Verification Middleware Code</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Production-ready snippets to validate cryptographic HMAC-SHA256 signatures and sync user accounts:
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setActiveCodeTab('nextjs')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'nextjs'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
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
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Express.js
            </button>
            <button
              type="button"
              onClick={() => setActiveCodeTab('python')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCodeTab === 'python'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Python (FastAPI)
            </button>
          </div>
        </div>

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

      {/* 3. Authentic Event Payload Schemas */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>Identity Event Payloads & Schema Reference</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Exact JSON structures delivered to your webhook destination:
            </p>
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
            {(
              [
                'identity.user.signup',
                'identity.user.authenticated',
                'identity.user.phone_verified',
                'identity.session.revoked',
                'identity.test',
              ] as EventTab[]
            ).map((evt) => (
              <button
                key={evt}
                type="button"
                onClick={() => setActiveEventTab(evt)}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                  activeEventTab === evt
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {evt}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
            <span>
              Event Schema: <strong className="text-blue-400">{activeEventTab}</strong>
            </span>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  JSON.stringify(samplePayloads[activeEventTab], null, 2),
                  `payload_${activeEventTab}`
                )
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

          <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-blue-300 max-h-[300px]">
            <code>{JSON.stringify(samplePayloads[activeEventTab], null, 2)}</code>
          </pre>
        </div>
      </div>
    </form>
  );
}

export default IdentityWebhooksView;
