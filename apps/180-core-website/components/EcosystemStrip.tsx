'use client';

import React from 'react';
import { ArrowUpRight, BookOpen, Globe2, Server, Terminal, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@workspace/ui';
import { API_URL, developerLink, docsLink, profileLink } from '@/lib/urls';

const PORTALS = [
  {
    name: 'Developer Console',
    host: 'developer.180core.cloud',
    href: developerLink('/dashboard'),
    description: 'Provision OAuth clients, manage API keys, inspect HMAC webhooks, and configure pricing tables.',
    icon: Terminal,
    badge: 'Developers',
  },
  {
    name: '180 Profile & Wallet',
    host: 'profile.180core.cloud',
    href: profileLink(),
    description: 'End-user sovereign identity passport, passkeys, connected apps, receipts, and wallet top-ups.',
    icon: UserCheck,
    badge: 'End Users',
  },
  {
    name: 'Documentation Hub',
    host: 'developer.180core.cloud/docs',
    href: docsLink(),
    description: 'Integration guides, OIDC PKCE handshakes, SDK reference, and AI master prompts.',
    icon: BookOpen,
    badge: 'Reference',
  },
  {
    name: 'Core API Gateway',
    host: 'api.180core.cloud',
    href: `${API_URL}/.well-known/openid-configuration`,
    description: 'OpenID Connect discovery, RS256 JWKS, checkout sessions, and recurring subscription engine.',
    icon: Server,
    badge: 'REST / OIDC',
  },
];

export function EcosystemStrip() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Globe2 className="h-3.5 w-3.5" />
            180core.cloud Ecosystem
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
            Purpose-Built Surfaces Under One Roof
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md">
          Each subsystem is independently deployed and isolated across dedicated subdomains for
          security and speed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PORTALS.map((portal) => {
          const Icon = portal.icon;
          return (
            <a
              key={portal.name}
              href={portal.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block focus:outline-none"
            >
              <Card className="h-full interactive-lift bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10 group-hover:border-blue-500/40 group-hover:shadow-md shadow-sm">
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-105 transition-all duration-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10">
                        {portal.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-1">
                        <span>{portal.name}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                      </h3>
                      <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                        {portal.host}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {portal.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
