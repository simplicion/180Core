'use client';

import React from 'react';
import {
  ArrowRight,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { Button, Card, CardContent } from '@workspace/ui';
import { API_URL, developerLink, docsLink } from '@/lib/urls';

const SECURITY_CONTROLS = [
  {
    icon: KeyRound,
    title: 'Asymmetric RSA-256 Signing & JWKS Rotation',
    description:
      'Every access and ID token is signed with RS256 private keys. Public verification keys are published at /.well-known/jwks.json with safe rotation grace periods.',
  },
  {
    icon: Lock,
    title: 'Mandatory RFC 7636 PKCE (S256)',
    description:
      'All authorization code grants enforce SHA-256 Proof Key for Code Exchange to prevent authorization code interception on SPAs and native mobile apps.',
  },
  {
    icon: Webhook,
    title: 'HMAC-SHA256 Signed Webhooks & Replay Defense',
    description:
      'Downstream payment, subscription, and verification webhooks are signed using per-application secrets in X-180-Signature with timestamp tolerance checks.',
  },
  {
    icon: ShieldCheck,
    title: 'Short-Lived Tokens & Central Revocation',
    description:
      '15-minute ephemeral access tokens paired with 7-day rotating refresh tokens and instant session revocation via /api/oauth/revoke or the console.',
  },
  {
    icon: ShieldAlert,
    title: 'Zero Hardcoded Secrets & Strict Isolation',
    description:
      'Per-application tenant and username isolation, Helmet security headers, distributed rate limiting, and dynamic KMS/environment secret injection.',
  },
  {
    icon: FileCheck2,
    title: 'Sovereign Compliance Architecture',
    description:
      'Engineered with consent-first OAuth flows, immutable double-entry ledger auditing, and DPDP Act 2023 & RBI-ready data handling boundaries.',
  },
];

const DISCOVERY_ENDPOINTS = [
  { label: 'OIDC Discovery Document', path: '/.well-known/openid-configuration' },
  { label: 'JSON Web Key Set (JWKS)', path: '/.well-known/jwks.json' },
  { label: 'API Gateway Health', path: '/health' },
];

export function SecurityShowcase() {
  return (
    <div className="space-y-16 py-12 md:py-20">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <Lock className="h-3.5 w-3.5" />
          <span>Cryptography &amp; Security Doctrine</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.08]">
          Built on Open Standards.{' '}
          <span className="bg-gradient-to-r from-emerald-500 via-blue-600 to-indigo-600 dark:from-emerald-400 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
            Verifiable by Design.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Relying parties never store user passwords, shared JWT secrets, or raw card numbers. Every
          handshake and ledger entry is cryptographically verifiable.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SECURITY_CONTROLS.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10">
              <CardContent className="p-6 space-y-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">{item.title}</h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Public Discovery Endpoints */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Public Cryptographic Endpoints
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white">
                  Inspect Live Discovery Metadata
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild className="h-11 rounded-xl px-4 text-xs font-semibold">
                  <a href={docsLink('identity-jwks')} target="_blank" rel="noopener noreferrer">
                    <span>JWKS Guide</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button asChild className="h-11 rounded-xl px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white">
                  <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
                    <span>Developer Console</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {DISCOVERY_ENDPOINTS.map((ep) => (
                <a
                  key={ep.path}
                  href={`${API_URL}${ep.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/10 hover:border-blue-500/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-950 dark:text-white">{ep.label}</div>
                    <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 truncate mt-0.5">
                      {ep.path}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-400 shrink-0" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
