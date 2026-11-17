'use client';

import React from 'react';
import Link from 'next/link';
import { OneEightyCoreLogo } from '@workspace/ui';
import { API_URL, developerLink, docsLink, profileLink } from '@/lib/urls';

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200/80 dark:border-white/10 bg-white dark:bg-black transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-zinc-200/80 dark:border-white/10">
          {/* Brand Column */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="inline-flex items-center">
              <OneEightyCoreLogo variant="compact" height={28} />
            </Link>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm">
              Sovereign identity, government document &amp; AI biometric verification, and dual-gateway
              payment infrastructure engineered for modern web and mobile applications.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono tracking-wide">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>180CORE.CLOUD SOVEREIGN INFRASTRUCTURE</span>
            </div>
          </div>

          {/* Products */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
              Products
            </h3>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li>
                <Link href="/identity" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  180 Identity (OIDC)
                </Link>
              </li>
              <li>
                <Link href="/identity#verify" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  180 Verify (KYC)
                </Link>
              </li>
              <li>
                <Link href="/pay" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  180 Pay Checkout
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Security &amp; Compliance
                </Link>
              </li>
            </ul>
          </div>

          {/* Ecosystem */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
              Platform Portals
            </h3>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li>
                <a
                  href={developerLink('/dashboard')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Developer Console
                </a>
              </li>
              <li>
                <a
                  href={profileLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  180 Profile &amp; Wallet
                </a>
              </li>
              <li>
                <a
                  href={docsLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Documentation Hub
                </a>
              </li>
              <li>
                <a
                  href={`${API_URL}/.well-known/openid-configuration`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-mono"
                >
                  OIDC Discovery (.well-known)
                </a>
              </li>
            </ul>
          </div>

          {/* Standards */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
              Standards &amp; Specs
            </h3>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              <li>RFC 7519 / RS256 JWKS</li>
              <li>RFC 7636 PKCE (S256)</li>
              <li>HMAC-SHA256 Webhooks</li>
              <li>FIDO2 / WebAuthn Passkeys</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-500">
          <p>© {new Date().getFullYear()} 180 Core Platform · 180 Workspace. All rights reserved.</p>
          <p className="font-mono text-[11px]">api.180core.cloud · profile.180core.cloud · developer.180core.cloud</p>
        </div>
      </div>
    </footer>
  );
}
