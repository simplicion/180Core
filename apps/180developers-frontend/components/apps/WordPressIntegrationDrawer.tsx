'use strict';

import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { DeveloperAppDetail } from './types';

interface WordPressIntegrationDrawerProps {
  app: DeveloperAppDetail;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export function WordPressIntegrationDrawer({
  app,
  isOpen,
  onClose,
  onOpenSettings,
}: WordPressIntegrationDrawerProps) {
  const [activeStep, setActiveStep] = useState(1);

  if (!isOpen) return null;

  const downloadUrl = '/downloads/180-core.zip';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  180 Core WordPress & WooCommerce Plugin
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Official v1.0.0
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Universal Identity SSO + Sovereign 180 Pay Gateway in a single no-code plugin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-full hover:bg-zinc-200/50 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Official Flagship Plugin Download Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-emerald-950/30 border border-indigo-500/30 dark:border-indigo-500/30 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">180 Core Official WordPress Plugin</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white">v1.0.0 Unified</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Single plugin for WordPress & WooCommerce. Install once, enter your project credentials, and toggle 180 Identity or 180 Pay on/off.
                </p>
              </div>

              <a
                href="/downloads/180-core.zip"
                download="180-core.zip"
                className="shrink-0 inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md hover:shadow-indigo-500/20 active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>Download 180-core.zip</span>
              </a>
            </div>
          </div>

          {/* Step-by-Step Setup Wizard */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Step-by-Step Setup Wizard
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {[
                { step: 1, title: '1. Download & Upload', desc: 'Add .zip in WP' },
                { step: 2, title: '2. Paste Keys', desc: 'Client ID & Secret' },
                { step: 3, title: '3. Enable Identity', desc: 'SSO Login button' },
                { step: 4, title: '4. Enable 180 Pay', desc: 'WooCommerce Gateway' },
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setActiveStep(s.step)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    activeStep === s.step
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="block text-xs font-bold">{s.title}</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{s.desc}</span>
                </button>
              ))}
            </div>

            {/* Step Content */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
              {activeStep === 1 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Upload 180-core.zip to WordPress</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    <li>Download the official <a href={downloadUrl} download="180-core.zip" className="text-indigo-500 font-semibold underline">180-core.zip</a> plugin above.</li>
                    <li>Log in to your WordPress Dashboard as Administrator.</li>
                    <li>Go to <span className="font-semibold">Plugins → Add New → Upload Plugin</span>.</li>
                    <li>Choose <span className="font-semibold">180-core.zip</span> and click <span className="font-semibold">Install Now</span>.</li>
                    <li>Click <span className="font-semibold">Activate Plugin</span>.</li>
                  </ol>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Enter Credentials in WordPress Admin</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    <li>In your WordPress left sidebar, click on <span className="font-semibold">180 Core</span>.</li>
                    <li>Under the <span className="font-semibold">Credentials & API</span> tab, paste your <span className="font-semibold">Client ID</span> and <span className="font-semibold">Client Secret</span> (copied from this project's overview).</li>
                    <li>Click <span className="font-semibold">Save Credentials</span>.</li>
                  </ol>
                </div>
              )}

              {activeStep === 3 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <span>Enable 180 Identity (SSO Login)</span>
                  </h4>
                  <p>In WordPress Admin under <span className="font-semibold">180 Core → 180 Identity</span>:</p>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    <li>Check <span className="font-semibold">Enable 1-Click login with 180 Core</span>.</li>
                    <li>Choose where the button should appear: <span className="font-semibold">wp-login.php</span>, WooCommerce My Account, or checkout.</li>
                    <li>Optionally place the login button anywhere in your theme using shortcode: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px]">[180_login]</code>.</li>
                  </ul>
                </div>
              )}

              {activeStep === 4 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500" />
                    <span>Enable 180 Pay WooCommerce Gateway</span>
                  </h4>
                  <p>In WordPress Admin under <span className="font-semibold">180 Core → 180 Pay</span> (or WooCommerce → Settings → Payments):</p>
                  <ul className="list-disc list-inside space-y-1.5 pl-1">
                    <li>Check <span className="font-semibold">Enable 180 Pay at WooCommerce checkout</span>.</li>
                    <li>Customize title or checkout description (e.g. <em>Pay with UPI, Cards, NetBanking, 180 Wallet</em>).</li>
                    <li>Click <span className="font-semibold">Save 180 Pay Settings</span>.</li>
                    <li>Orders will automatically transition to <span className="font-semibold">Processing</span> upon payment completion!</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
          <a
            href="https://180core.cloud/docs/products/180-core"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <span>View Full Documentation</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <Button onClick={onClose} variant="outline" className="px-5">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
