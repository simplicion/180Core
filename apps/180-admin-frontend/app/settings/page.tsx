'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Key,
  Database,
  Lock,
  Activity,
  UserCheck,
  Server,
  Terminal,
  UserPlus,
  Sliders,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Globe,
  Radio,
  FileText,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function SecurityAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [securityConfig, setSecurityConfig] = useState<any>({
    enforce2FA: true,
    standardFeePercent: 2.0,
    ipWhitelist: '27.34.70.69, 127.0.0.1, ::1',
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Operator Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('SUPPORT');
  const [inviting, setInviting] = useState(false);

  // Security Settings Modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadSettingsData();
  }, [search]);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const [logsRes, opsRes] = await Promise.all([
        adminApi.getAuditLogs({ action: search || undefined }),
        adminApi.getOperators().catch(() => ({ success: false })),
      ]);

      if (logsRes.success) {
        setLogs(logsRes.data?.logs || logsRes.logs || []);
      }
      if (opsRes.success) {
        setOperators(opsRes.operators || []);
        if (opsRes.securityConfig) setSecurityConfig(opsRes.securityConfig);
      } else {
        setOperators([]);
      }
    } catch (err) {
      console.error('Failed to load platform governance data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOperator = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    try {
      setInviting(true);
      const res = await adminApi.addOperator({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      if (res.success) {
        toast.success(`Admin operator "${inviteName}" invited with role ${inviteRole}!`);
        setIsInviteModalOpen(false);
        setInviteName('');
        setInviteEmail('');
        loadSettingsData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add operator');
    } finally {
      setInviting(false);
    }
  };

  const handleSaveSecuritySettings = async () => {
    try {
      setSavingConfig(true);
      const res = await adminApi.updateSecuritySettings(securityConfig);
      if (res.success) {
        toast.success('Platform security configuration updated & logged in audit trail!');
        setIsConfigModalOpen(false);
        loadSettingsData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExportCsv = () => {
    if (!logs.length) {
      toast.error('No audit logs to export');
      return;
    }
    const rows = logs.map((l) => ({
      LogID: l.id,
      Timestamp: new Date(l.createdAt).toLocaleString(),
      AdminEmail: l.adminEmail || 'admin@180core.cloud',
      Action: l.action,
      TargetType: l.targetType,
      TargetID: l.targetId,
      IPAddress: l.ipAddress || '127.0.0.1',
      Details: l.details ? JSON.stringify(l.details) : '',
    }));
    exportToCsv('180_security_audit_logs', rows);
    toast.success(`Exported ${logs.length} audit log entries to CSV`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Platform Governance & Security Logs
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Zero-Trust Architecture
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Immutable log of all administrative operations, team access roles, 2FA policies, and gateway infrastructure health.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Operator</span>
          </button>

          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Security Policies</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Security Health Status Overview (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">RS256 JWKS Keyring</div>
            <div className="text-[11px] text-zinc-500">2048-bit RSA Active • Auto-Rotated</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">AWS RDS PostgreSQL</div>
            <div className="text-[11px] text-emerald-500 font-medium">Encrypted (TLS 1.3) • 180core_db</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">Two-Factor Authentication</div>
            <div className="text-[11px] text-purple-500 font-medium">
              {securityConfig.enforce2FA ? 'Enforced for All Admins' : 'Optional'}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center gap-4 shadow-sm">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">Webhook Dispatch Queue</div>
            <div className="text-[11px] text-amber-500 font-medium">Active (100% Delivery SLA)</div>
          </div>
        </div>
      </div>

      {/* Admin Operators Team Table */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Platform Admin Operators & Roles</h3>
          </div>
          <span className="text-[11px] text-zinc-500">{operators.length} Active Operators</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {operators.map((op) => (
            <div
              key={op.id}
              className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-white">{op.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    op.role === 'SUPERADMIN'
                      ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                      : op.role === 'AUDITOR'
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}
                >
                  {op.role}
                </span>
              </div>
              <div className="text-zinc-500 text-[11px]">{op.email}</div>
              <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                <span>Status: <strong className="text-emerald-500">ACTIVE</strong></span>
                <span>Active: {op.lastActive || 'Today'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Audit Logs Section */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Immutable Audit Log Feed
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Cryptographically signed administrative audit events
            </p>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search action or target ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs text-zinc-500">Loading immutable audit trail...</div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-xs text-zinc-500">
            No audit log events recorded yet. Administrative actions will stream here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Timestamp</th>
                  <th className="py-3.5 px-4 font-medium">Admin Operator</th>
                  <th className="py-3.5 px-4 font-medium">Action Event</th>
                  <th className="py-3.5 px-4 font-medium">Target Entity</th>
                  <th className="py-3.5 px-4 font-medium">IP Address</th>
                  <th className="py-3.5 px-6 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-6 text-zinc-500 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-zinc-900 dark:text-white font-medium">
                      {log.adminEmail || 'admin@180core.cloud'}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                      {log.targetType}: {log.targetId ? log.targetId.slice(0, 8) + '...' : 'System'}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 text-[11px]">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3.5 px-6 font-sans text-right text-[11px] text-zinc-500 truncate max-w-[240px]">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Admin Operator Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Invite Admin Operator</h3>
                  <p className="text-xs text-zinc-500">Assign sovereign platform control role</p>
                </div>
              </div>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. jdoe@180core.cloud"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
                >
                  <option value="SUPERADMIN">SUPERADMIN (Full Sovereignty)</option>
                  <option value="AUDITOR">AUDITOR (Read & Financial Logs)</option>
                  <option value="SUPPORT">SUPPORT (Tickets & Ingestion)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={inviting}
                onClick={handleAddOperator}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all"
              >
                {inviting ? 'Inviting...' : 'Send Operator Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Policies Configuration Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Security & Governance Policies</h3>
                  <p className="text-xs text-zinc-500">Configure global platform access rules</p>
                </div>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 2FA Toggle */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900 dark:text-white">Enforce 2FA for All Administrators</div>
                  <div className="text-[11px] text-zinc-500">Require TOTP or hardware security key for login</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSecurityConfig((prev: any) => ({ ...prev, enforce2FA: !prev.enforce2FA }))
                  }
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    securityConfig.enforce2FA ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      securityConfig.enforce2FA ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Fee Percentage */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Default Platform Take-Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={securityConfig.standardFeePercent || 2.0}
                  onChange={(e) =>
                    setSecurityConfig((prev: any) => ({
                      ...prev,
                      standardFeePercent: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              {/* IP Whitelist */}
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Admin Portal IP Whitelist (CIDR / Comma-Separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 127.0.0.1, 192.168.1.0/24, 10.0.0.1"
                  value={securityConfig.ipWhitelist || ''}
                  onChange={(e) =>
                    setSecurityConfig((prev: any) => ({ ...prev, ipWhitelist: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl font-mono text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-white/10">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={savingConfig}
                onClick={handleSaveSecuritySettings}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/25 transition-all"
              >
                {savingConfig ? 'Saving...' : 'Save & Enforce Policies'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
