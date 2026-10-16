'use client';

import React from 'react';
import {
  Zap,
  Shield,
  CreditCard,
} from 'lucide-react';
import { AppCard } from '../AppCard';
import { DeveloperAppDetail } from './types';

export interface AppOverviewDetailProps {
  app: DeveloperAppDetail;
  enableAuth: boolean;
  enablePay: boolean;
  copiedKey?: string | null;
  copyToClipboard?: (text: string, key: string) => void;
  onOpenIdentity: () => void;
  onOpenPay: () => void;
  onRotateSecretClick?: () => void;
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
  onOpenIdentity,
  onOpenPay,
}: AppOverviewDetailProps) {
  return (
    <div className="space-y-8">
      {/* Activated Apps Under this Project */}
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
