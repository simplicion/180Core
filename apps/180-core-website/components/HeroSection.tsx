'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck,
  Key,
  ScanLine,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { use180Identity, OneEightyVerify } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';
import { DEMO_CLIENT_ID, developerLink, docsLink } from '@/lib/urls';

export function HeroSection() {
  const { launch180Identity, isOpeningIdentity } = use180Identity(DEMO_CLIENT_ID);

  const handleIdentityDemo = () => {
    launch180Identity({
      clientId: DEMO_CLIENT_ID,
      onSuccess: (res) => {
        toast.success(`Authenticated as ${res.user?.name || res.user?.email || '180 User'}`);
      },
      onError: (err) => {
        toast.error(err?.message || 'Unable to launch 180 Identity popup');
      },
    });
  };

  const handleVerifyDemo = () => {
    OneEightyVerify.launch({
      clientId: DEMO_CLIENT_ID,
      documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
      onSuccess: (res) => {
        toast.success(`180 Verify ${res.status} (Session: ${res.sessionId})`);
      },
      onError: (err) => {
        toast.error(err?.message || 'Unable to launch 180 Verify');
      },
    });
  };

  return (
    <section className="relative overflow-hidden border-b border-zinc-200/80 dark:border-white/10">
      <div className="marketing-grid-bg absolute inset-0 pointer-events-none opacity-80" />
      <div className="absolute -top-24 left-1/2 w-[560px] h-[360px] bg-blue-600/15 dark:bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-ambient" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-4xl mx-auto text-center space-y-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-semibold shadow-sm backdrop-blur-md animate-page-enter">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Sovereign Identity, Passkeys &amp; Official KYC Verification</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.06] animate-stagger-1">
            The Sovereign Core for{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
              Identity &amp; Auth.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed animate-stagger-2">
            Ship passwordless OpenID Connect login, official API Setu &amp; ArcFace AI verification,
            and FIDO2 biometric passkeys — with zero custom authentication screens.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 animate-stagger-3">
            <Button
              size="lg"
              asChild
              className="group w-full sm:w-auto h-12 rounded-2xl px-7 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25"
            >
              <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
                <span>Start Building Free</span>
                <ArrowRight className="h-4 w-4 ml-2 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </Button>

            <Button
              variant="outline"
              size="lg"
              asChild
              className="group w-full sm:w-auto h-12 rounded-2xl px-7 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white font-semibold text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <a href={docsLink()} target="_blank" rel="noopener noreferrer">
                <BookOpen className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110" />
                <span>Read Documentation</span>
              </a>
            </Button>
          </div>

          {/* Interactive Live SDK Bar */}
          <div className="pt-6 animate-stagger-4">
            <div className="inline-flex flex-col sm:flex-row items-center gap-2.5 p-2.5 rounded-2xl glass-panel shadow-sm">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-2.5">
                Live SDK Demos
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleIdentityDemo}
                  disabled={isOpeningIdentity}
                  className="h-11 rounded-xl px-3.5 text-xs font-semibold border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
                >
                  <Key className="h-3.5 w-3.5 mr-1.5" />
                  <span>{isOpeningIdentity ? 'Opening...' : '180 Identity'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyDemo}
                  className="h-11 rounded-xl px-3.5 text-xs font-semibold border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <ScanLine className="h-3.5 w-3.5 mr-1.5" />
                  <span>180 Verify</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Protocol Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-8 text-left">
            {[
              { title: 'OIDC + PKCE', sub: 'RFC 7636 S256', icon: Shield, accent: 'text-blue-600 dark:text-blue-400' },
              { title: 'RS256 JWKS', sub: 'Asymmetric Keys', icon: Key, accent: 'text-indigo-600 dark:text-indigo-400' },
              { title: 'ArcFace AI', sub: '512-D Face Match', icon: ScanLine, accent: 'text-purple-600 dark:text-purple-400' },
              { title: 'API Setu KYC', sub: 'Official Registries', icon: FileCheck, accent: 'text-emerald-600 dark:text-emerald-400' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href="/identity"
                  className="group interactive-lift p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 hover:border-blue-500/40 hover:shadow-md shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black font-mono text-zinc-950 dark:text-white">
                      {item.title}
                    </span>
                    <Icon className={`h-4 w-4 ${item.accent} transition-transform duration-200 group-hover:scale-110`} />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{item.sub}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
