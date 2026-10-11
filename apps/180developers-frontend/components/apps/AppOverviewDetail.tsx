'use client';

import React from 'react';
import {
  Key,
  Copy,
  Check,
  RotateCw,
  Zap,
  Shield,
  CreditCard,
  Code2,
  Settings,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { AppCard } from '../AppCard';
import { DeveloperAppDetail } from './types';

export interface AppOverviewDetailProps {
  app: DeveloperAppDetail;
  enableAuth: boolean;
  enablePay: boolean;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  onOpenIdentity: () => void;
  onOpenPay: () => void;
  onRotateSecretClick: () => void;
  onOpenSettings?: () => void;
  // Optional backwards-compatible props
  name?: string;
  setName?: (val: string) => void;
  description?: string;
  setDescription?: (val: string) => void;
  logoUrl?: string;
  setLogoUrl?: (val: string) => void;
  redirectUrisInput?: string;
  setRedirectUrisInput?: (val: string) => void;
  allowedOriginsInput?: string;
  setAllowedOriginsInput?: (val: string) => void;
  onSave?: (e?: React.SyntheticEvent) => void;
  saving?: boolean;
  onRevokeTokens?: () => void;
  isRevoking?: boolean;
  onDeleteAppClick?: () => void;
}

export function AppOverviewDetail({
  app,
  enableAuth,
  enablePay,
  copiedKey,
  copyToClipboard,
  onOpenIdentity,
  onOpenPay,
  onRotateSecretClick,
  onOpenSettings,
}: AppOverviewDetailProps) {
  return (
    <div className="space-y-8">
      {/* 1. Project Credentials Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-sm dark:shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-900 dark:text-white" />
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">Project Credentials</h2>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Project Settings</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Client ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Project Client ID</label>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white">
              <span className="flex-1 truncate">{app.clientId}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(app.clientId, 'client')}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors p-1"
                title="Copy Client ID"
              >
                {copiedKey === 'client' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Client Secret */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Client Secret</label>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex-1 truncate">
                {app.clientSecretHint ? `••••••••••••${app.clientSecretHint}` : 'Public PKCE Client'}
              </span>
              {app.clientSecretHint && (
                <button
                  type="button"
                  onClick={onRotateSecretClick}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Rotate</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. My Apps: Activated Apps Under this Project */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>My Apps</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Activated services powered by this project. Click an app to inspect live telemetry and configurations.
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 self-start sm:self-auto">
            Single Client ID Architecture
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* App Card 1: 180 Identity */}
          <AppCard
            name="180 Identity"
            description="Universal authentication with WhatsApp OTP, Google SSO, and unified @usernames. Issues RS256 asymmetric JWKS tokens."
            icon={Shield}
            enabled={enableAuth}
            protocol="OAuth 2.0 / OIDC Protocol"
            accentColor="blue"
            actionLabel="Open Dashboard"
            onClick={onOpenIdentity}
          />

          {/* App Card 2: 180 Pay */}
          <AppCard
            name="180 Pay"
            description="1-Click 180 Wallet & UPI checkout popup. Dedicated 180 Pay engine processes payments with 2-way verification."
            icon={CreditCard}
            enabled={enablePay}
            protocol="180 Wallet Checkout"
            accentColor="purple"
            actionLabel="Open Dashboard"
            onClick={onOpenPay}
          />
        </div>
      </div>


    </div>
  );
}

export default AppOverviewDetail;
