'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '@workspace/ui';
import { developerLink, docsLink } from '@/lib/urls';

export function FinalCtaSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 dark:bg-zinc-950 border border-zinc-800 dark:border-white/10 p-8 sm:p-12 md:p-16 text-white shadow-2xl">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-blue-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ready for Production
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Build on Sovereign Infrastructure Today.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Create your first OAuth application, generate scoped API keys, and test live 180
              Identity &amp; 180 Verify flows directly from the Developer Console.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button
              size="lg"
              asChild
              className="h-12 rounded-2xl px-6 bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs"
            >
              <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
                <Terminal className="h-4 w-4 mr-2 text-blue-600" />
                <span>Open Developer Console</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </a>
            </Button>

            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-12 rounded-2xl px-6 border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs"
            >
              <a href={docsLink()} target="_blank" rel="noopener noreferrer">
                <BookOpen className="h-4 w-4 mr-2" />
                <span>Explore Docs</span>
              </a>
            </Button>
          </div>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 pt-8 mt-8 border-t border-white/10">
          <Link
            href="/identity"
            className="interactive-lift p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-blue-500/40"
          >
            <span className="text-xs font-bold text-white block">180 Identity &amp; Auth</span>
            <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block">
              OIDC · PKCE · Passkeys · Zero Shared Secrets
            </span>
          </Link>
          <Link
            href="/identity#verify"
            className="interactive-lift p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-emerald-500/40"
          >
            <span className="text-xs font-bold text-white block">180 Verify &amp; KYC</span>
            <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block">
              API Setu · ArcFace AI · PAN · DL · Bank IMPS
            </span>
          </Link>
          <Link
            href="/security"
            className="interactive-lift p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-purple-500/40"
          >
            <span className="text-xs font-bold text-white block">Security Doctrine</span>
            <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block">
              RS256 JWKS · HMAC-256 · DPDP Ready
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
