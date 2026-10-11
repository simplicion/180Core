'use client';

import React from 'react';
import {
  Shield,
  Users,
  Sliders,
  Play,
  RotateCw,
  UserX,
  Loader2,
  Save,
  Monitor,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { DeveloperAppDetail } from './types';

export interface IdentityAppDetailProps {
  app: DeveloperAppDetail;
  enableAuth: boolean;
  setEnableAuth: (val: boolean) => void;
  authUxModes: string[];
  setAuthUxModes: (val: string[]) => void;
  authDesktopDefault: string;
  setAuthDesktopDefault: (val: string) => void;
  authMobileDefault: string;
  setAuthMobileDefault: (val: string) => void;
  accessTokenTtl: number;
  setAccessTokenTtl: (val: number) => void;
  refreshTokenDays: number;
  setRefreshTokenDays: (val: number) => void;
  authLogs: { logs: any[]; totalUsers: number; activeSessionsCount: number } | null;
  loadingAuthLogs: boolean;
  fetchAuthLogs: () => void;
  handleRevokeUserSession: (targetUserId: string, userName: string) => Promise<void>;
  revokingUserId: string | null;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  onTestPopup: () => void;
  onTestBottomSheet: () => void;
  onSave: (e?: React.SyntheticEvent) => void;
  saving: boolean;
  onBack: () => void;
}

export function IdentityAppDetail({
  app,
  enableAuth,
  setEnableAuth,
  authUxModes,
  setAuthUxModes,
  authDesktopDefault,
  setAuthDesktopDefault,
  authMobileDefault,
  setAuthMobileDefault,
  accessTokenTtl,
  setAccessTokenTtl,
  refreshTokenDays,
  setRefreshTokenDays,
  authLogs,
  loadingAuthLogs,
  fetchAuthLogs,
  handleRevokeUserSession,
  revokingUserId,
  copiedKey,
  copyToClipboard,
  onTestPopup,
  onTestBottomSheet,
  onSave,
  saving,
}: IdentityAppDetailProps) {
  return (
    <div className="space-y-6">
      {/* 180 Identity Service Status & Enable Toggle Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                enableAuth ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">180 Identity Service</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    enableAuth
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {enableAuth ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Universal login with WhatsApp OTP, Google SSO, and unified @usernames. Issues RS256 asymmetric JWKS access tokens.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {enableAuth ? 'Service Enabled' : 'Service Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enableAuth}
              onClick={() => setEnableAuth(!enableAuth)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enableAuth ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enableAuth ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Connected Users & Universal Identities Console */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Connected Users & Universal Identities</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Real-time directory of users who have authorized and connected to this application via 180 Identity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{authLogs?.activeSessionsCount ?? 0} Active Sessions</span>
            </span>
            <button
              type="button"
              onClick={fetchAuthLogs}
              disabled={loadingAuthLogs}
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh users and session telemetry"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAuthLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div className="space-y-3">
          {loadingAuthLogs ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-zinc-400">Loading authorized identities...</p>
            </div>
          ) : authLogs && authLogs.logs && authLogs.logs.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Universal Identity</th>
                    <th className="px-4 py-3">App Username</th>
                    <th className="px-4 py-3">Verified Contact</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">Session Status</th>
                    <th className="px-4 py-3">Connected Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {authLogs.logs.map((log: any) => {
                    const isRevokingThis = revokingUserId === log.userId;
                    const appUsername = log.appSpecificUsernames?.[app?.id] || log.user?.username;

                    return (
                      <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-purple-600 text-xs overflow-hidden shrink-0">
                              {log.user?.avatar ? (
                                <img src={log.user.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                log.user?.name?.charAt(0) || 'U'
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-950 dark:text-white flex items-center gap-1 truncate">
                                <span>{log.user?.name || '180 User'}</span>
                                {log.user?.isVerified && (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">{log.authMethod || 'Universal OIDC'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {appUsername ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              @{appUsername}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px]">
                          {log.user?.email ? (
                            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                              <span>{log.user.email}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(log.user.email, `email_${log.id}`)}
                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                              >
                                {copiedKey === `email_${log.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Not shared</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <span>{log.userId?.slice(0, 10)}...</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.userId, `uid_${log.id}`)}
                              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                              title="Copy User ID"
                            >
                              {copiedKey === `uid_${log.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'ACTIVE_SESSION'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {log.status === 'ACTIVE_SESSION' ? 'Active Token' : 'Expired'}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                          {new Date(log.connectedSince || log.grantedAt || Date.now()).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {log.status === 'ACTIVE_SESSION' ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeUserSession(log.userId, log.user?.name || 'User')}
                              disabled={isRevokingThis}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                              title="Revoke active user session"
                            >
                              {isRevokingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserX className="w-3 h-3" />
                              )}
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center space-y-2">
              <p className="text-xs text-zinc-500">No users have signed into this app yet.</p>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                Embed the &lt;OneEightyAuthButton /&gt; or identity SDK to start authenticating users.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 180 Identity UX Display Modes, Device Defaults & Token Lifecycle */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-500" />
              <span>180 Identity Presentation & UX Modes</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Define the auth presentation styles supported by your application and customize device defaults for desktop vs mobile.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
            OAuth 2.0 UX
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-white/5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Supported Display Modes</span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'popup', label: 'Popup Window' },
                { id: 'bottom_sheet', label: 'Bottom Sheet (Drawer)' },
                { id: 'full_page', label: 'Full Page Redirect' },
              ].map((mode) => {
                const isSelected = authUxModes.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (authUxModes.length > 1) {
                          setAuthUxModes(authUxModes.filter((m) => m !== mode.id));
                        }
                      } else {
                        setAuthUxModes([...authUxModes, mode.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Monitor className="w-3 h-3 text-zinc-400" />
                <span>Desktop Default</span>
              </label>
              <select
                value={authDesktopDefault}
                onChange={(e) => setAuthDesktopDefault(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="popup">Popup Window (Recommended)</option>
                <option value="bottom_sheet">Bottom Sheet</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-zinc-400" />
                <span>Mobile Default</span>
              </label>
              <select
                value={authMobileDefault}
                onChange={(e) => setAuthMobileDefault(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="bottom_sheet">Bottom Sheet (Recommended)</option>
                <option value="popup">Popup Window</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Live Sandbox Preview */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-blue-500" />
                <span>Interactive Live Auth Sandbox</span>
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Trigger your configured 180 Identity auth flows in real time using the 180 SDK.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold self-start sm:self-auto">
              SDK v2.0.0
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onTestPopup}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Test Popup Modal</span>
            </button>
            <button
              type="button"
              onClick={onTestBottomSheet}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Test Bottom Sheet</span>
            </button>
          </div>
        </div>

        {/* Token Lifecycle Configuration */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-white/5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Token Lifecycle & Expiration Preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Access Token Lifetime</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{Math.round(accessTokenTtl / 60)} mins ({accessTokenTtl}s)</span>
              </label>
              <select
                value={accessTokenTtl}
                onChange={(e) => setAccessTokenTtl(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value={300}>5 minutes (300s) — High Security</option>
                <option value={900}>15 minutes (900s) — Standard (Recommended)</option>
                <option value={1800}>30 minutes (1800s)</option>
                <option value={3600}>1 hour (3600s)</option>
                <option value={86400}>24 hours (86400s)</option>
              </select>
              <p className="text-[10px] text-zinc-500">Short-lived asymmetric tokens prevent replay attacks and token interception.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Refresh Token Retention Cycle</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{refreshTokenDays} Days</span>
              </label>
              <select
                value={refreshTokenDays}
                onChange={(e) => setRefreshTokenDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value={1}>1 Day (24 hours)</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days — Standard (Recommended)</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days (Extended Session)</option>
              </select>
              <p className="text-[10px] text-zinc-500">180 Profile automatically exchanges and updates refresh tokens silently in the background.</p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Identity Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default IdentityAppDetail;
