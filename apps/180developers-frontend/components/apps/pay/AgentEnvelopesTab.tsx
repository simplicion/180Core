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

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [maxSpendTotal, setMaxSpendTotal] = useState('100.00');
  const [maxSpendPerTx, setMaxSpendPerTx] = useState('15.00');
  const [currency, setCurrency] = useState('USD');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['compute:spend', 'assets:purchase']);

  // One-time Key Reveal Modal State
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createdEnvelopeName, setCreatedEnvelopeName] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

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
      toast.error('Failed to load agent spending envelopes');
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
        setCreatedKey(data.rawApiKey || data.apiKey || data.key || '180_agent_key_sample');
        setCreatedEnvelopeName(agentName.trim());
        setAgentName('');
        fetchEnvelopes();
      } else {
        toast.error(data.error || 'Failed to issue agent envelope');
      }
    } catch {
      toast.error('Network error issuing agent envelope');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeEnvelope = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to REVOKE budget envelope "${name}"? The agent key will immediately stop working.`)) {
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

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & Protocol Overview Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                <Bot className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">
                Autonomous AI Agent Purchase Protocol (AP2)
              </h2>
              <span className="rounded-full bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                Machine-to-Machine
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Issue pre-authorized budget envelopes and scoped cryptographic keys (
              <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 px-1.5 py-0.5 rounded text-cyan-700 dark:text-cyan-300">
                180_agent_key_...
              </code>
              ) for autonomous AI agents. Agents can execute micro-purchases, tool execution credits, or API compute with strict per-transaction and cumulative budget ceilings without human intervention.
            </p>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white shadow-xs font-medium text-sm whitespace-nowrap self-start md:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Issue Agent Envelope
          </Button>
        </div>
      </div>

      {/* 2. Active Envelopes List Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">Active Budget Envelopes</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Real-time spend meters and instant killswitch for autonomous agents</p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 font-medium">
            {envelopes.filter((e) => e.status === 'ACTIVE').length} Active Envelopes
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-500 dark:text-zinc-400 text-sm">Loading agent envelopes...</div>
        ) : envelopes.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/20 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto mb-2">
              <Bot className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">No Agent Envelopes Issued</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Authorize your autonomous AI agents or background tasks with an envelope to allow them to buy APIs or assets within strict boundaries.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="outline"
                size="sm"
                className="border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Issue First Envelope
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-cyan-500/40 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-950 dark:text-white text-base">{env.agentName}</span>
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
                        <Key className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
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
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">Spend Budget Consumption</span>
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
                            : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-white/5 grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Max Per Transaction:</span>
                      <span className="font-mono text-zinc-950 dark:text-zinc-200 font-bold">
                        ${env.maxSpendPerTx.toFixed(2)} {env.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 dark:text-zinc-400 block font-medium">Expiration:</span>
                      <span className="text-zinc-950 dark:text-zinc-200 font-medium">
                        {env.expiresAt ? new Date(env.expiresAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Allowed Scopes */}
                  {env.allowedScopes && env.allowedScopes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {env.allowedScopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Integration Code Guide */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-2xl">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            <Code2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Autonomous Agent HTTP Request Specification
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Agents execute direct machine-to-machine checkout by calling the endpoint with their header key:
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-950 p-5 font-mono text-xs text-zinc-300 border border-zinc-800 overflow-x-auto space-y-2 shadow-inner">
          <div className="text-cyan-400 font-bold">POST /api/v1/agent-checkout/agent-purchase</div>
          <div className="text-zinc-500">Headers:</div>
          <div className="pl-4 text-zinc-400">
            <div>Content-Type: application/json</div>
            <div>X-180-Agent-Key: 180_agent_key_xxxxxxxxxxxxxxxxxxxxxxxx</div>
            <div>Idempotency-Key: idemp_93817492</div>
          </div>
          <div className="text-zinc-500">Body:</div>
          <div className="pl-4 text-emerald-400">
            {`{
  "appId": "${appId}",
  "amount": 4.99,
  "currency": "USD",
  "title": "On-demand GPU 30-min Inference Credit",
  "metadata": { "reason": "autonomous_analysis_task" }
}`}
          </div>
        </div>
      </div>

      {/* Issue Agent Envelope Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-4">
              <h3 className="font-bold text-zinc-950 dark:text-white flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Issue Agent Spending Envelope
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
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Agent Identifier Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                  placeholder="e.g. Researcher-Agent-01"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Max Total Budget</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={maxSpendTotal}
                      onChange={(e) => setMaxSpendTotal(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                      placeholder="100.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Max Per-Tx Spend</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={maxSpendPerTx}
                      onChange={(e) => setMaxSpendPerTx(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                      placeholder="15.00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">Valid For (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
                    placeholder="30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">Permitted Scopes</label>
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
                        className="rounded border-zinc-300 dark:border-zinc-700 text-cyan-600 focus:ring-cyan-500"
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
                  className="border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs cursor-pointer shadow-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white font-medium text-xs cursor-pointer shadow-xs"
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
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                <Key className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-zinc-950 dark:text-white text-base">Save Agent API Key</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Envelope: {createdEnvelopeName}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Copy this key now.</strong> For your security, this raw key will <strong>never</strong> be shown
                again. We only store an encrypted SHA-256 hash in the database.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">Raw Agent Secret Key</label>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                <input
                  type="text"
                  readOnly
                  value={createdKey}
                  className="w-full bg-transparent font-mono text-xs text-cyan-300 focus:outline-none select-all font-semibold"
                />
                <Button
                  size="sm"
                  onClick={handleCopyKey}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white h-8 px-3 text-xs flex items-center gap-1.5 cursor-pointer flex-shrink-0"
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
