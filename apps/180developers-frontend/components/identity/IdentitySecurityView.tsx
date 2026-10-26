'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Clock,
  Save,
  Loader2,
  ShieldCheck,
  Info,
  Mail,
  Smartphone,
  MessageSquare,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export function IdentitySecurityView() {
  const { project, saveSettings, saving } = useProject();

  const [enableGoogleAuth, setEnableGoogleAuth] = useState<boolean>(
    project?.enableGoogleAuth !== false
  );
  const [enableLinkedInAuth, setEnableLinkedInAuth] = useState<boolean>(
    project?.enableLinkedInAuth !== false
  );
  const [enableGitHubAuth, setEnableGitHubAuth] = useState<boolean>(
    project?.enableGitHubAuth !== false
  );
  const [accessTokenTtl, setAccessTokenTtl] = useState<number>(
    project?.accessTokenTtl || 900
  );
  const [refreshTokenDays, setRefreshTokenDays] = useState<number>(
    project?.refreshTokenDays || 7
  );

  useEffect(() => {
    if (project) {
      if (project.enableGoogleAuth !== undefined) {
        setEnableGoogleAuth(project.enableGoogleAuth !== false);
      }
      if (project.enableLinkedInAuth !== undefined) {
        setEnableLinkedInAuth(project.enableLinkedInAuth !== false);
      }
      if (project.enableGitHubAuth !== undefined) {
        setEnableGitHubAuth(project.enableGitHubAuth !== false);
      }
      if (project.accessTokenTtl !== undefined) {
        setAccessTokenTtl(project.accessTokenTtl);
      }
      if (project.refreshTokenDays !== undefined) {
        setRefreshTokenDays(project.refreshTokenDays);
      }
    }
  }, [project]);

  const handleSave = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();

    await saveSettings({
      enableGoogleAuth,
      enableLinkedInAuth,
      enableGitHubAuth,
      enableEmailAuth: true, // Always enabled
      enableWhatsappAuth: false, // Coming soon
      enableSmsAuth: false, // Coming soon
      accessTokenTtl,
      refreshTokenDays,
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        {/* Header with Title and Save Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-500" />
              <span>Identity Security, Auth Methods & Token Policies</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Configure active sign-in channels and cryptographic token expiration lifespans.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95 shrink-0"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Security Rules</span>
          </button>
        </div>

        {/* 1. Authentication Providers & Login Methods */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Authentication Providers & Login Methods
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
              Sovereign Auth Modes
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Control which verification channels appear inside your client&apos;s Sovereign Auth pop-up and bottom sheet.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* 1. Email Authentication (Always Active) */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      Email Authentication
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      Always Active
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    Standard email and password login with account recovery.
                  </p>
                </div>
              </div>

              {/* Locked Active Toggle */}
              <div className="shrink-0" title="Email authentication is mandatory and cannot be disabled">
                <div className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent bg-blue-600 opacity-60 cursor-not-allowed">
                  <span className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0" />
                </div>
              </div>
            </div>

            {/* 2. Google Authentication (Configurable) */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-4 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      Google Authentication
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        enableGoogleAuth
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {enableGoogleAuth ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    One-tap Google Identity Services sign-in for seamless onboarding.
                  </p>
                </div>
              </div>

              {/* Interactive Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={enableGoogleAuth}
                onClick={() => setEnableGoogleAuth(!enableGoogleAuth)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableGoogleAuth ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title={enableGoogleAuth ? 'Disable Google Sign-In' : 'Enable Google Sign-In'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enableGoogleAuth ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3. LinkedIn Authentication (Configurable) */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-4 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/10 border border-[#0A66C2]/20 flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-5 h-5 text-[#0A66C2] fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46v-8.37M7.85 6.27a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      LinkedIn Authentication
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        enableLinkedInAuth
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {enableLinkedInAuth ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    Professional OAuth 2.0 &amp; OpenID Connect verification with verified member credentials.
                  </p>
                </div>
              </div>

              {/* Interactive Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={enableLinkedInAuth}
                onClick={() => setEnableLinkedInAuth(!enableLinkedInAuth)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableLinkedInAuth ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title={enableLinkedInAuth ? 'Disable LinkedIn Sign-In' : 'Enable LinkedIn Sign-In'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enableLinkedInAuth ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 4. GitHub Authentication (Configurable) */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-4 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white/10 border border-zinc-700 dark:border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      GitHub Authentication
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        enableGitHubAuth
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700'
                      }`}
                    >
                      {enableGitHubAuth ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    Developer OAuth login with verified GitHub profile, public repositories, and organizations.
                  </p>
                </div>
              </div>

              {/* Interactive Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={enableGitHubAuth}
                onClick={() => setEnableGitHubAuth(!enableGitHubAuth)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableGitHubAuth ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title={enableGitHubAuth ? 'Disable GitHub Sign-In' : 'Enable GitHub Sign-In'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enableGitHubAuth ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3. WhatsApp OTP Authentication (Coming Soon) */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-4 opacity-75">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      WhatsApp OTP
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    Passwordless sign-in via verified WhatsApp security codes.
                  </p>
                </div>
              </div>

              {/* Disabled Coming Soon Toggle */}
              <div className="shrink-0" title="WhatsApp OTP is under active integration">
                <div className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent bg-zinc-200 dark:bg-zinc-800 opacity-60 cursor-not-allowed">
                  <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white/70 shadow ring-0" />
                </div>
              </div>
            </div>

            {/* 4. SMS OTP Authentication (Coming Soon) */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-4 opacity-75">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      SMS OTP
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    Carrier-delivered one-time numeric passcode authentication.
                  </p>
                </div>
              </div>

              {/* Disabled Coming Soon Toggle */}
              <div className="shrink-0" title="SMS OTP is under active integration">
                <div className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent bg-zinc-200 dark:bg-zinc-800 opacity-60 cursor-not-allowed">
                  <span className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white/70 shadow ring-0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Token Lifecycle & Expiration Configuration */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-white/5">
            <Clock className="w-4 h-4 text-blue-500" />
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
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono cursor-pointer"
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
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white font-mono cursor-pointer"
              >
                <option value={1}>1 Day</option>
                <option value={7}>7 Days (Standard)</option>
                <option value={30}>30 Days (Extended)</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-start gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
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
