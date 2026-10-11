'use client';

import React, { useState } from 'react';
import {
  Lock,
  Globe,
  Clock,
  Save,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export function IdentitySecurityView() {
  const { project, saveSettings, saving } = useProject();

  const [redirectUrisInput, setRedirectUrisInput] = useState(
    (project?.redirectUris || []).join('\n')
  );
  const [allowedOriginsInput, setAllowedOriginsInput] = useState(
    (project?.allowedOrigins || []).join('\n')
  );
  const [accessTokenTtl, setAccessTokenTtl] = useState<number>(
    project?.accessTokenTtl || 900
  );
  const [refreshTokenDays, setRefreshTokenDays] = useState<number>(
    project?.refreshTokenDays || 7
  );

  const handleSave = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();

    const redirectUris = redirectUrisInput
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    const allowedOrigins = allowedOriginsInput
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    await saveSettings({
      redirectUris,
      allowedOrigins,
      accessTokenTtl,
      refreshTokenDays,
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500" />
              <span>Identity Security, Whitelisting & Token Policies</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Strictly restrict where users can authenticate and control token expiration windows.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Security Rules</span>
          </button>
        </div>

        {/* 1. Whitelisted Callback URIs & CORS Origins */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500" />
              <span>OAuth 2.0 Redirect URIs (One per line)</span>
            </label>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Only authorized callback endpoints can receive OAuth authorization codes and tokens.
            </p>
            <textarea
              rows={4}
              value={redirectUrisInput}
              onChange={(e) => setRedirectUrisInput(e.target.value)}
              placeholder="https://yourapp.com/api/auth/callback&#10;http://localhost:3000/callback"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              <span>Allowed Web Origins (CORS) (One per line)</span>
            </label>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Domains permitted to make cross-origin token exchange and session validation requests.
            </p>
            <textarea
              rows={4}
              value={allowedOriginsInput}
              onChange={(e) => setAllowedOriginsInput(e.target.value)}
              placeholder="https://yourapp.com&#10;http://localhost:3000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>
        </div>

        {/* 2. Token Lifecycle & Expiration Configuration */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-white/5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Token Lifespan Policies</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Access Token Lifetime (Seconds)
              </label>
              <select
                value={accessTokenTtl}
                onChange={(e) => setAccessTokenTtl(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
              >
                <option value={300}>5 Minutes (Strict Security)</option>
                <option value={900}>15 Minutes (OAuth 2.0 Standard)</option>
                <option value={3600}>1 Hour</option>
                <option value={86400}>24 Hours</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Refresh Token Validity (Days)
              </label>
              <select
                value={refreshTokenDays}
                onChange={(e) => setRefreshTokenDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono"
              >
                <option value={1}>1 Day</option>
                <option value={7}>7 Days (Standard)</option>
                <option value={30}>30 Days (Extended)</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-start gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              All tokens are signed using standard RS256 asymmetric cryptographic keys verifiable via your public JWKS endpoint.
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}

export default IdentitySecurityView;
