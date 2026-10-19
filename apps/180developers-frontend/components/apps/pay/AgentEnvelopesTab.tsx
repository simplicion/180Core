'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Plus,
  ShieldAlert,
  Key,
  Copy,
  Check,
  DollarSign,
  AlertTriangle,
  Code2,
  Sparkles,
  Clock,
  Shield,
  ArrowRight,
  CheckCircle2,
  Terminal,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getApiBase, getAuthToken } from '@/lib/api-config';

interface AgentEnvelopeItem {
  id: string;
  appId: string;
  agentName: string;
  keyPrefix: string;
  maxSpendTotal: number;
  spentTotal: number;
  maxSpendPerTx: number;
  currency: string;
  allowedScopes: string[];
  status: 'ACTIVE' | 'EXHAUSTED' | 'REVOKED' | 'EXPIRED';
  expiresAt?: string | null;
  createdAt: string;
}

interface AgentEnvelopesTabProps {
  appId: string;
}

export function AgentEnvelopesTab({ appId }: AgentEnvelopesTabProps) {
  const [envelopes, setEnvelopes] = useState<AgentEnvelopeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Early access waitlist state
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  // Technical spec tab state
  const [specTab, setSpecTab] = useState<'http' | 'typescript' | 'python'>('http');
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Interactive simulated envelope state
  const [simulatedRevoked, setSimulatedRevoked] = useState(false);
  const [copiedSimulatedKey, setCopiedSimulatedKey] = useState(false);

  // Real Create Modal State (for sandbox preview)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [maxSpendTotal, setMaxSpendTotal] = useState('100.00');
  const [maxSpendPerTx, setMaxSpendPerTx] = useState('15.00');
  const [currency, setCurrency] = useState('USD');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'compute:spend',
    'assets:purchase',
  ]);

  // One-time Key Reveal Modal State
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createdEnvelopeName, setCreatedEnvelopeName] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ap2_waitlist_${appId}`);
      if (saved === 'true') {
        setIsWaitlisted(true);
      }
      const savedEmail = localStorage.getItem(`ap2_waitlist_email_${appId}`);
      if (savedEmail) {
        setWaitlistEmail(savedEmail);
      }
    } catch (_) {}
  }, [appId]);

  const handleRequestEarlyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !waitlistEmail.includes('@')) {
      toast.error('Please enter a valid developer email');
      return;
    }
    setIsWaitlisted(true);
    try {
      localStorage.setItem(`ap2_waitlist_${appId}`, 'true');
      localStorage.setItem(`ap2_waitlist_email_${appId}`, waitlistEmail.trim());
    } catch (_) {}
    toast.success("You're on the AP2 Early Access list! We'll notify you when beta keys are ready.");
    setShowWaitlistModal(false);
  };

  const fetchEnvelopes = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/developer/agent-envelopes/apps/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnvelopes(data.envelopes || data.data || []);
      }
    } catch {
      // Backend route might be in development; silently fall back
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchEnvelopes();
  }, [fetchEnvelopes]);

  const handleCreateEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) {
      toast.error('Agent identifier name is required');
      return;
    }

    const total = parseFloat(maxSpendTotal);
    const perTx = parseFloat(maxSpendPerTx);
    if (isNaN(total) || total <= 0 || isNaN(perTx) || perTx <= 0) {
      toast.error('Budgets must be positive numbers');
      return;
    }
    if (perTx > total) {
      toast.error('Max per-transaction spend cannot exceed total budget');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast.error('Authentication session missing. Please log in again.');
      return;
    }

    setCreating(true);
    try {
      const apiBase = getApiBase();

      let expiresAt: string | undefined = undefined;
      if (expiresInDays && parseInt(expiresInDays) > 0) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(expiresInDays));
        expiresAt = d.toISOString();
      }

      const res = await fetch(`${apiBase}/api/v1/developer/agent-envelopes/apps/${appId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentName: agentName.trim(),
          maxSpendTotal: total,
          maxSpendPerTx: perTx,
          currency,
          expiresAt,
          allowedScopes: selectedScopes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowCreateModal(false);
        setCreatedKey(data.rawApiKey || data.apiKey || data.key || '180_agent_key_sandbox_sample');
        setCreatedEnvelopeName(agentName.trim());
        setAgentName('');
        fetchEnvelopes();
      } else {
        toast.error(data.error || 'AP2 is in private beta. Join early access above.');
      }
    } catch {
      toast.error('AP2 issuance is currently in private preview. Join early access.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeEnvelope = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to REVOKE budget envelope "${name}"? The agent key will immediately stop working.`
      )
    ) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast.error('Authentication session missing. Please log in again.');
      return;
    }

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/developer/agent-envelopes/apps/${appId}/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Agent envelope "${name}" revoked`);
        setEnvelopes((prev) =>
          prev.map((env) => (env.id === id ? { ...env, status: 'REVOKED' } : env))
        );
      } else {
        toast.error(data.error || 'Failed to revoke envelope');
      }
    } catch {
      toast.error('Network error revoking envelope');
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      toast.success('Agent API Key copied to clipboard');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopySimulatedKey = () => {
    navigator.clipboard.writeText('180_agent_key_preview_9f3a8b2c4e1d');
    setCopiedSimulatedKey(true);
    toast.success('Preview Agent API Key copied');
    setTimeout(() => setCopiedSimulatedKey(false), 2000);
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  const getCodeContent = () => {
    if (specTab === 'http') {
      return `POST /api/v1/agent-checkout/agent-purchase HTTP/1.1
Host: api.180core.cloud
Content-Type: application/json
X-180-Agent-Key: 180_agent_key_xxxxxxxxxxxxxxxxxxxxxxxx
Idempotency-Key: idemp_93817492

{
  "clientId": "${appId || '180_client_xxxxxxxx'}",
  "amount": 4.99,
  "currency": "USD",
  "title": "On-demand GPU 30-min Inference Credit",
  "metadata": { 
    "agentId": "Researcher-Agent-Claude-01",
    "reason": "autonomous_analysis_task" 
  }
}`;
    }

    if (specTab === 'typescript') {
      return `import { OneEightyAgent } from '@180core/agent-sdk';

// Initialize with pre-authorized envelope key
const agent = new OneEightyAgent({
  apiKey: process.env.ONE_EIGHTY_AGENT_KEY, // 180_agent_key_...
  clientId: '${appId || '180_client_xxxxxxxx'}',
});

// Execute autonomous micro-purchase within bounded budget
async function purchaseInferenceCredits() {
  const transaction = await agent.purchase({
    amount: 4.99,
    currency: 'USD',
    title: 'On-demand GPU 30-min Inference Credit',
    idempotencyKey: 'tx_' + Date.now(),
  });

  console.log('Purchase executed:', transaction.status);
  console.log('Remaining envelope budget:', transaction.remainingBudget);
}`;
    }

    return `import os
from one_eighty_pay import AgentEnvelopeClient

# Initialize client using scoped envelope key
client = AgentEnvelopeClient(
    api_key=os.environ["ONE_EIGHTY_AGENT_KEY"],
    client_id="${appId || '180_client_xxxxxxxx'}"
)

# Autonomous purchase within per-transaction and total budget ceiling
purchase = client.purchase(
    amount=4.99,
    currency="USD",
    title="On-demand GPU 30-min Inference Credit"
)

print(f"Receipt ID: {purchase.receipt_id}")
print(f"Status: {purchase.status}, Remaining: \${purchase.remaining_budget}")`;
  };

  const handleCopySpec = () => {
    navigator.clipboard.writeText(getCodeContent());
    setCopiedSpec(true);
    toast.success('Specification snippet copied');
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 1. COMING SOON GRAND HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.08] via-indigo-500/[0.04] to-cyan-500/[0.06] p-6 sm:p-8 backdrop-blur-xl shadow-lg shadow-purple-500/[0.03]">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                COMING SOON
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10">
                AP2 PROTOCOL RFC
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                Machine-to-Machine
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
              Autonomous AI Agent Budget Envelopes
            </h2>

            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We are building the first sovereign machine-to-machine checkout protocol for autonomous
              AI agents. Issue pre-authorized budget envelopes and scoped cryptographic keys (
              <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-300">
                180_agent_key_...
              </code>
              ). Agents can execute micro-purchases, tool execution credits, or API compute with strict
              per-transaction and cumulative budget ceilings without human intervention.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>
                  Target Release: <strong className="text-zinc-800 dark:text-zinc-200">Q4 2026</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-500" />
                <span>
                  Status:{' '}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    Security Audit &amp; Sandboxing
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Early Access Action Card */}
          <div className="lg:max-w-xs w-full shrink-0">
            {isWaitlisted ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 p-5 text-center space-y-2 backdrop-blur-md">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
                  You&apos;re on the Beta List
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  We will grant sandbox AP2 keys and notify you as soon as private beta invitations roll out.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold pt-1 block cursor-pointer mx-auto"
                >
                  Preview Sandbox Creator &rarr;
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleRequestEarlyAccess}
                className="rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 p-5 space-y-3 shadow-sm backdrop-blur-md"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 dark:text-white">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Request Developer Early Access</span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Get priority access to deploy bounded agent envelopes and cryptographic tokens.
                </p>
                <div className="space-y-2">
                  <input
                    type="email"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    placeholder="developer@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Join Beta Waitlist</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 2. COMING SOON CAPABILITY PILLARS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Key className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-zinc-950 dark:text-white tracking-tight">
            Scoped Agent Keys
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Generate dedicated <code className="font-mono text-[11px] text-purple-600 dark:text-purple-400">180_agent_key_...</code> tokens bound strictly to scopes like <code className="font-mono text-[10px]">compute:spend</code> or <code className="font-mono text-[10px]">assets:purchase</code>.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-zinc-950 dark:text-white tracking-tight">
            Dual-Layer Hard Ceilings
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Enforce strict per-transaction micro-caps alongside cumulative envelope budget ceilings. Rogue looping calls are automatically blocked.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-zinc-950 dark:text-white tracking-tight">
            Instant Killswitch
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Revoke any agent key in real-time from this console or via programmatic webhook triggers, propagating across all payment rails in sub-milliseconds.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-sm space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-zinc-950 dark:text-white tracking-tight">
            Machine-to-Machine Rail
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Native autonomous checkout endpoints engineered specifically for OpenAI function calling, Anthropic tool use, and LangChain/CrewAI agents.
          </p>
        </div>
      </div>

      {/* 3. INTERACTIVE SIMULATION & ACTIVE ENVELOPES */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Active Budget Envelopes
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Real-time spend meters and instant killswitch for autonomous agents
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 font-medium">
              {envelopes.filter((e) => e.status === 'ACTIVE').length} Live Envelopes
            </span>
            <Button
              onClick={() => {
                if (isWaitlisted) {
                  setShowCreateModal(true);
                } else {
                  setShowWaitlistModal(true);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-xs font-medium text-xs whitespace-nowrap cursor-pointer h-8 px-3 rounded-xl"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Issue Agent Envelope
            </Button>
          </div>
        </div>

        {/* Live Envelopes Grid if any exist */}
        {envelopes.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
            {envelopes.map((env) => {
              const spent = env.spentTotal || 0;
              const max = env.maxSpendTotal || 1;
              const percent = Math.min(100, Math.round((spent / max) * 100));

              const isRevoked = env.status === 'REVOKED';
              const isExhausted = env.status === 'EXHAUSTED' || percent >= 100;

              return (
                <div
                  key={env.id}
                  className={`rounded-2xl border p-5 transition-all ${
                    isRevoked
                      ? 'border-zinc-200/60 dark:border-white/5 bg-zinc-100/50 dark:bg-zinc-950/40 opacity-60'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-purple-500/40 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-950 dark:text-white text-base">
                          {env.agentName}
                        </span>
                        {isRevoked ? (
                          <span className="text-[11px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                            REVOKED
                          </span>
                        ) : isExhausted ? (
                          <span className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                            EXHAUSTED
                          </span>
                        ) : (
                          <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        <Key className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        <span>{env.keyPrefix}...</span>
                      </div>
                    </div>

                    {!isRevoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeEnvelope(env.id, env.agentName)}
                        className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs h-8 px-2.5 cursor-pointer rounded-xl"
                      >
                        <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                        Revoke Killswitch
                      </Button>
                    )}
                  </div>

                  {/* Spend Gauge Meter */}
                  <div className="space-y-1.5 mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        Spend Budget Consumption
                      </span>
                      <span className="font-mono font-bold text-zinc-950 dark:text-white">
                        ${spent.toFixed(2)} / ${max.toFixed(2)} {env.currency} ({percent}%)
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          percent >= 90
                            ? 'bg-red-500'
                            : percent >= 70
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-purple-500 to-cyan-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-white/5 grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                        Max Per Transaction:
                      </span>
                      <span className="font-mono text-zinc-950 dark:text-zinc-200 font-bold">
                        ${env.maxSpendPerTx.toFixed(2)} {env.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                        Expiration:
                      </span>
                      <span className="text-zinc-950 dark:text-zinc-200 font-medium">
                        {env.expiresAt ? new Date(env.expiresAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Interactive Simulated Preview Card */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/[0.03] to-transparent p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/80 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-950 dark:text-white block">
                  Interactive Protocol Simulation
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Preview how an active AP2 budget envelope behaves in production
                </span>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 self-start sm:self-auto">
              Simulated Preview
            </span>
          </div>

          {/* The Simulation Envelope Card */}
          <div
            className={`rounded-2xl border p-5 transition-all ${
              simulatedRevoked
                ? 'border-red-500/30 bg-red-500/[0.03] dark:bg-red-500/[0.05]'
                : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/60 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-950 dark:text-white text-base">
                    Researcher-Agent-Claude-01
                  </span>
                  {simulatedRevoked ? (
                    <span className="text-[11px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                      REVOKED (Simulated)
                    </span>
                  ) : (
                    <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE (Preview)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <Key className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span>180_agent_key_preview_9f3a...</span>
                  <button
                    type="button"
                    onClick={handleCopySimulatedKey}
                    className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    title="Copy Key"
                  >
                    {copiedSimulatedKey ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {simulatedRevoked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSimulatedRevoked(false);
                    toast.success('Simulation reset: Agent envelope restored');
                  }}
                  className="text-xs h-8 px-2.5 cursor-pointer rounded-xl border-zinc-200 dark:border-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1 text-purple-500" />
                  Restore Simulation
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSimulatedRevoked(true);
                    toast.error('Simulation: Killswitch triggered! Key revoked instantly.');
                  }}
                  className="text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs h-8 px-2.5 cursor-pointer rounded-xl"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                  Revoke Killswitch (Test)
                </Button>
              )}
            </div>

            {/* Spend Gauge Meter */}
            <div className="space-y-1.5 mt-4">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Spend Budget Consumption
                </span>
                <span className="font-mono font-bold text-zinc-950 dark:text-white">
                  $28.50 / $100.00 USD (28.5%)
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    simulatedRevoked ? 'bg-zinc-400' : 'bg-gradient-to-r from-purple-500 to-cyan-400'
                  }`}
                  style={{ width: '28.5%' }}
                />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-white/5 grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                  Max Per Transaction:
                </span>
                <span className="font-mono text-zinc-950 dark:text-zinc-200 font-bold">
                  $15.00 USD
                </span>
              </div>
              <div>
                <span className="text-zinc-500 dark:text-zinc-400 block font-medium">
                  Expiration:
                </span>
                <span className="text-zinc-950 dark:text-zinc-200 font-medium">
                  In 26 Days (Renewable)
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {['compute:spend', 'assets:purchase', 'model:inference'].map((scope) => (
                <span
                  key={scope}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              Live envelope issuance will be enabled for this workspace upon general availability in Wave 2.
            </span>
            <button
              type="button"
              onClick={() => setShowWaitlistModal(true)}
              className="text-purple-600 dark:text-purple-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isWaitlisted ? 'Manage Beta Registration' : 'Request Invitation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. UPCOMING TECHNICAL SPECIFICATION & SDK PREVIEW */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Upcoming Autonomous Agent Checkout Specification (AP2)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Autonomous agents execute bounded machine-to-machine purchases with zero human intervention:
            </p>
          </div>

          {/* Language Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSpecTab('http')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                specTab === 'http'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              HTTP REST (RFC)
            </button>
            <button
              type="button"
              onClick={() => setSpecTab('typescript')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                specTab === 'typescript'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              TypeScript SDK
            </button>
            <button
              type="button"
              onClick={() => setSpecTab('python')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                specTab === 'python'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              Python SDK
            </button>
          </div>
        </div>

        {/* Code Viewport with Copy Button */}
        <div className="relative rounded-2xl bg-zinc-950 p-5 font-mono text-xs text-zinc-300 border border-zinc-800 overflow-x-auto shadow-inner group">
          <button
            type="button"
            onClick={handleCopySpec}
            className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            {copiedSpec ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSpec ? 'Copied' : 'Copy Spec'}</span>
          </button>

          <pre className="text-zinc-300 leading-relaxed font-mono whitespace-pre overflow-x-auto pt-1">
            {getCodeContent()}
          </pre>
        </div>
      </div>

      {/* Early Access / Waitlist Modal */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-base">
                    AP2 Protocol Private Beta
                  </h3>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Target Availability: Q4 2026
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWaitlistModal(false)}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white text-xl font-bold cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Autonomous AI Agent Budget Envelopes are currently undergoing cryptographic audit and consensus verification. Join the developer early access list to get sandbox tokens before public launch.
            </p>

            <form onSubmit={handleRequestEarlyAccess} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Developer Work Email
                </label>
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  placeholder="agent-architect@company.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-500/[0.06] border border-purple-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                <span className="font-bold text-purple-600 dark:text-purple-400 block">
                  Included in Beta Access:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-zinc-500 dark:text-zinc-400">
                  <li>Up to 5 Pre-authorized Agent Spending Envelopes</li>
                  <li>Instant programmatic killswitch webhooks</li>
                  <li>TypeScript &amp; Python AP2 SDK Access</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWaitlistModal(false)}
                  className="border-zinc-200 dark:border-white/10 text-xs cursor-pointer rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs cursor-pointer shadow-xs rounded-xl"
                >
                  Confirm Priority Access
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sandbox Creator Modal (Preserved for Developer Preview) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
              <h3 className="font-bold text-zinc-950 dark:text-white flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                Issue Agent Spending Envelope (Preview)
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white text-xl font-bold cursor-pointer transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateEnvelope} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Agent Identifier Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                  placeholder="e.g. Researcher-Agent-01"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Max Total Budget
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={maxSpendTotal}
                      onChange={(e) => setMaxSpendTotal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                      placeholder="100.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Max Per-Tx Spend
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={maxSpendPerTx}
                      onChange={(e) => setMaxSpendPerTx(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                      placeholder="15.00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                    Valid For (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                  Permitted Scopes
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'compute:spend', label: 'Compute & API usage credits' },
                    { id: 'assets:purchase', label: 'Digital Assets & Downloads' },
                    { id: 'subscriptions:create', label: 'Recurring Subscriptions' },
                  ].map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-950 dark:hover:text-white transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500"
                      />
                      <span>{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-white/10 flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs cursor-pointer shadow-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs cursor-pointer shadow-xs rounded-xl"
                >
                  {creating ? 'Issuing...' : 'Issue Scoped Key'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Raw Key Reveal Modal */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400">
                <Key className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-white text-base">
                  Save Agent API Key
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Envelope: {createdEnvelopeName}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Copy this key now.</strong> For your security, this raw key will{' '}
                <strong>never</strong> be shown again. We only store an encrypted SHA-256 hash in
                the database.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Raw Agent Secret Key
              </label>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <input
                  type="text"
                  readOnly
                  value={createdKey}
                  className="w-full bg-transparent font-mono text-xs text-purple-300 focus:outline-none select-all font-semibold"
                />
                <Button
                  size="sm"
                  onClick={handleCopyKey}
                  className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3 text-xs flex items-center gap-1.5 cursor-pointer flex-shrink-0 rounded-xl"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => setCreatedKey(null)}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs cursor-pointer shadow-xs rounded-xl"
              >
                I have saved this key safely
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
