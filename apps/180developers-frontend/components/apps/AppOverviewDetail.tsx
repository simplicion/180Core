'use client';

import React, { useState } from 'react';
import {
  Zap,
  Shield,
  CreditCard,
  Puzzle,
  Download,
  BookOpen,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { AppCard } from '../AppCard';
import { DeveloperAppDetail } from './types';
import { WordPressIntegrationDrawer } from './WordPressIntegrationDrawer';

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
  onOpenSettings,
}: AppOverviewDetailProps) {
  const [isWpDrawerOpen, setIsWpDrawerOpen] = useState(false);

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

      {/* Integrations & CMS Plugins Section */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-indigo-500" />
              <span>Integrations & CMS Plugins</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Zero-code plugins and pre-built modules to integrate 180 Core with WordPress, WooCommerce, and Shopify.
            </p>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 self-start sm:self-auto">
            Plug & Play Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Integration 1: WordPress & WooCommerce */}
          <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 flex flex-col justify-between space-y-5 hover:border-indigo-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    WordPress 5.6+
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    WooCommerce
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  180 Core for WordPress & WooCommerce
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Unified plugin providing 1-Click Universal Identity login plus sovereign WooCommerce 180 Pay gateway (UPI, QR, Cards, 180 Wallet).
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ✓ Universal Identity SSO
                </span>
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ✓ 180 Pay Gateway
                </span>
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ✓ [180_login] Shortcode
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                onClick={() => setIsWpDrawerOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs transition-all shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Setup Guide & Keys</span>
              </button>
              <a
                href="/downloads/180-core.zip"
                download="180-core.zip"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .zip</span>
              </a>
            </div>
          </div>

          {/* Integration 2: Shopify & Headless Checkout */}
          <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 flex flex-col justify-between space-y-5 hover:border-purple-500/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-lg border border-purple-500/20">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  No-Code Storefront
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Shopify & Custom Storefronts
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Accept payments on Shopify, static landing pages, or custom sites using Hosted Payment Links, Buy Buttons, and embeddable pricing tables.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ✓ Hosted Payment Links
                </span>
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ✓ Embeddable Pricing Tiers
                </span>
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  ✓ 1-Click Buy Buttons
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onOpenPay}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/10 hover:bg-zinc-900/20 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-900 dark:text-white font-semibold text-xs transition-all"
              >
                <span>Manage 180 Pay Links & Tiers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WordPress & WooCommerce Setup Drawer Modal */}
      <WordPressIntegrationDrawer
        app={app}
        isOpen={isWpDrawerOpen}
        onClose={() => setIsWpDrawerOpen(false)}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

export default AppOverviewDetail;
