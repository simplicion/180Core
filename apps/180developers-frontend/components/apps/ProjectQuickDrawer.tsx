'use client';

import React, { useState } from 'react';
import {
  Settings,
  CreditCard,
  Shield,
  Puzzle,
  Download,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  ShoppingBag,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { PlatformDrawer } from '@workspace/ui';
import { getAppSlug } from '@/lib/slug';
import { WordPressIntegrationDrawer } from './WordPressIntegrationDrawer';
import { DeveloperAppDetail } from './types';

export interface ProjectQuickDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  app: any | null;
  onOpenSettings: (app: any) => void;
  onToggleService: (appId: string, service: 'enablePay' | 'enableAuth', enabled: boolean) => Promise<void>;
  isUpdatingService?: boolean;
}

export function ProjectQuickDrawer({
  isOpen,
  onClose,
  app,
  onOpenSettings,
  onToggleService,
  isUpdatingService = false,
}: ProjectQuickDrawerProps) {
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [isWpDrawerOpen, setIsWpDrawerOpen] = useState(false);
  const [togglingService, setTogglingService] = useState<'enablePay' | 'enableAuth' | null>(null);

  if (!app) return null;

  const appSlug = getAppSlug(app) || app.id;
  const isPayEnabled = app.enablePay ?? true;
  const isAuthEnabled = Boolean(app.enableAuth);

  const handleCopyClientId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(app.clientId);
    setCopiedClientId(true);
    setTimeout(() => setCopiedClientId(false), 2000);
  };

  const handleToggle = async (service: 'enablePay' | 'enableAuth', currentVal: boolean) => {
    if (togglingService) return;
    setTogglingService(service);
    try {
      await onToggleService(app.id, service, !currentVal);
    } finally {
      setTogglingService(null);
    }
  };

  // Convert app to DeveloperAppDetail shape for WordPressIntegrationDrawer
  const appDetailForWp: DeveloperAppDetail = {
    id: app.id,
    name: app.name,
    description: app.description || '',
    logoUrl: app.logoUrl,
    clientId: app.clientId,
    clientSecretHint: app.clientSecretHint || '****',
    redirectUris: app.redirectUris || [],
    allowedOrigins: app.allowedOrigins || [],
    allowedScopes: app.allowedScopes || [],
    isVerified: app.isVerified ?? true,
    isActive: app.isActive ?? true,
    enableAuth: isAuthEnabled,
    enablePay: isPayEnabled,
    webhookUrl: app.webhookUrl || '',
    webhookSecret: app.webhookSecret || '',
    createdAt: app.createdAt || new Date().toISOString(),
  };

  return (
    <>
      <PlatformDrawer
        isOpen={isOpen}
        onClose={onClose}
        title={app.name || 'Project Details'}
        icon={SlidersHorizontal}
        iconColorClass="text-zinc-900 dark:text-white"
        iconBgClass="bg-zinc-100 dark:bg-zinc-800"
        maxWidthClass="max-w-2xl"
        subHeader={
          <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {app.logoUrl ? (
                <img
                  src={app.logoUrl}
                  alt={app.name}
                  className="w-8 h-8 rounded-xl object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  {app.name[0]?.toUpperCase() || 'P'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[220px]">
                    {app.clientId}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyClientId}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Copy Client ID"
                  >
                    {copiedClientId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Active
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings(app);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 pb-6">
          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 1: PLATFORM SERVICES & SERVICE TOGGLES
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Platform Services
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Toggle services for this project. Enabled services appear as interactive chips on your project card.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Service 1: 180 Pay (Default: Enabled) */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 hover:border-purple-500/30 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                          180 Pay
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isPayEnabled
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                        }`}>
                          {isPayEnabled ? 'Enabled (Default)' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        1-Click 180 Wallet, UPI & Card checkout engine. Dual-gateway routing and direct orders.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPayEnabled}
                    onClick={() => handleToggle('enablePay', isPayEnabled)}
                    disabled={togglingService === 'enablePay'}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPayEnabled ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isPayEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Direct Action Link if Enabled */}
                {isPayEnabled && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Ready for production transactions
                    </span>
                    <a
                      href={`/apps/${appSlug}/pay`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                    >
                      <span>Open 180 Pay Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Service 2: 180 Identity */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 hover:border-blue-500/30 transition-all">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                          180 Identity
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isAuthEnabled
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                        }`}>
                          {isAuthEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Universal authentication with WhatsApp OTP, Google SSO, and unified @usernames with RS256 JWKS tokens.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAuthEnabled}
                    onClick={() => handleToggle('enableAuth', isAuthEnabled)}
                    disabled={togglingService === 'enableAuth'}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isAuthEnabled ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isAuthEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Direct Action Link if Enabled */}
                {isAuthEnabled && (
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      OAuth 2.0 / OIDC Protocol Active
                    </span>
                    <a
                      href={`/apps/${appSlug}/identity/users`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <span>Open 180 Identity Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 2: CMS PLUGINS & INTEGRATIONS
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Puzzle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Integrations & CMS Plugins</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Download official plugins or read integration documentation for your store and apps.
                </p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Plug & Play
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Plugin 1: WordPress & WooCommerce */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 hover:border-indigo-500/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 font-bold shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        180 Core for WordPress & WooCommerce
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          WordPress 5.6+
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          WooCommerce
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Unified plugin providing 1-Click Universal Identity login plus sovereign WooCommerce 180 Pay gateway (UPI, QR, Cards, 180 Wallet).
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    Universal Identity SSO
                  </span>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    180 Pay Gateway
                  </span>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    [180_login] Shortcode
                  </span>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWpDrawerOpen(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Setup Guide & Keys</span>
                  </button>
                  <a
                    href="/downloads/180-core.zip"
                    download="180-core.zip"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .zip</span>
                  </a>
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Read Docs</span>
                  </a>
                </div>
              </div>

              {/* Plugin 2: Shopify & Custom Storefronts */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 hover:border-purple-500/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 font-bold shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        Shopify & Custom Storefronts
                      </h4>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-block mt-1">
                        No-Code Storefront
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Accept payments on Shopify, static landing pages, or custom sites using Hosted Payment Links, Buy Buttons, and embeddable pricing tables.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    Hosted Payment Links
                  </span>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    Embeddable Pricing Tiers
                  </span>
                  <span className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    1-Click Buy Buttons
                  </span>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <a
                    href={`/apps/${appSlug}/pay/links`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-xs"
                  >
                    <span>Manage 180 Pay Links & Tiers</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read Docs</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              SECTION 3: PROJECT SETTINGS & SECURITY
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-zinc-500" />
                <span>Project Credentials & Settings</span>
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure Client Secret, Allowed Origins, Redirect URIs, and Webhooks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings(app);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs transition-all cursor-pointer shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Open Settings</span>
            </button>
          </div>
        </div>
      </PlatformDrawer>

      {/* WordPress & WooCommerce Setup Modal */}
      <WordPressIntegrationDrawer
        app={appDetailForWp}
        isOpen={isWpDrawerOpen}
        onClose={() => setIsWpDrawerOpen(false)}
        onOpenSettings={() => {
          setIsWpDrawerOpen(false);
          onClose();
          onOpenSettings(app);
        }}
      />
    </>
  );
}

export default ProjectQuickDrawer;
