'use client';

import React from 'react';
import { Webhook, Send, CheckCircle2 } from 'lucide-react';
import { Button, LogoLoader } from '@workspace/ui';

interface DeveloperApp {
  id: string;
  name: string;
  webhookUrl?: string;
}

interface WebhookSimulatorTabProps {
  apps: DeveloperApp[];
  simWebhookAppId: string;
  setSimWebhookAppId: (id: string) => void;
  simWebhookUrl: string;
  setSimWebhookUrl: (url: string) => void;
  simEventType: 'payment.captured' | 'payment.failed' | 'identity.user_authorized';
  setSimEventType: (type: 'payment.captured' | 'payment.failed' | 'identity.user_authorized') => void;
  handleSimulateWebhook: () => void;
  simIsSending: boolean;
  simResult: {
    statusCode: number;
    latencyMs: number;
    signatureHeader: string;
    responseBody: string;
    timestamp: string;
  } | null;
}

export default function WebhookSimulatorTab({
  apps,
  simWebhookAppId,
  setSimWebhookAppId,
  simWebhookUrl,
  setSimWebhookUrl,
  simEventType,
  setSimEventType,
  handleSimulateWebhook,
  simIsSending,
  simResult,
}: WebhookSimulatorTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
          <Webhook className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <span>Webhook Dispatch Simulator</span>
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Simulate live events and test HMAC-SHA256 signature verification directly against your backend receiver.
        </p>
      </div>

      <div className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Target Application</label>
            <select
              value={simWebhookAppId}
              onChange={(e) => {
                setSimWebhookAppId(e.target.value);
                const a = apps.find((app) => app.id === e.target.value);
                if (a?.webhookUrl) setSimWebhookUrl(a.webhookUrl);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium"
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Event Type</label>
            <select
              value={simEventType}
              onChange={(e: any) => setSimEventType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium"
            >
              <option value="payment.captured">payment.captured (180 Pay)</option>
              <option value="payment.failed">payment.failed (180 Pay)</option>
              <option value="identity.user_authorized">identity.user_authorized (180 Identity)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Webhook Receiver URL</label>
          <input
            type="url"
            value={simWebhookUrl}
            onChange={(e) => setSimWebhookUrl(e.target.value)}
            placeholder="https://api.yourdomain.com/webhooks/180"
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <Button
          onClick={handleSimulateWebhook}
          disabled={simIsSending}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          {simIsSending ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4" />}
          <span>Dispatch Simulated Webhook</span>
        </Button>

        {simResult && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-purple-500/30 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-purple-400 font-bold font-sans">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Dispatch Result ({simResult.statusCode} OK)
              </span>
              <span className="text-[11px] text-zinc-400">Latency: {simResult.latencyMs}ms</span>
            </div>

            <div className="space-y-1 text-zinc-400 text-[11px]">
              <div>Header: <span className="text-zinc-200 select-all">{simResult.signatureHeader}</span></div>
            </div>

            <pre className="p-3 bg-black/70 rounded-xl text-zinc-300 overflow-x-auto border border-white/5 select-all">
              {simResult.responseBody}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
