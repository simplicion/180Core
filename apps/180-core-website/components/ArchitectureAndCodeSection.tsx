'use client';

import React, { useState } from 'react';
import { Check, Code2, Copy, Lock, Server, ShieldCheck, Terminal, Webhook } from 'lucide-react';
import { Button, Card, CardContent } from '@workspace/ui';
import toast from 'react-hot-toast';

type TabId = 'auth' | 'verify' | 'elements' | 'webhook';

const CODE_SNIPPETS: Record<TabId, { label: string; filename: string; code: string }> = {
  auth: {
    label: '180 Identity SDK',
    filename: 'auth.ts',
    code: `import { OneEighty } from '@workspace/identity-sdk';

await OneEighty.signIn({
  clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID!,
  uxMode: 'bottom_sheet', // 'bottom_sheet' | 'popup' | 'redirect'
  onSuccess: ({ tokens, user }) => {
    console.log('Verified RS256 Access Token:', tokens.accessToken);
    console.log('User:', user.email);
  },
});`,
  },
  verify: {
    label: '180 Verify SDK',
    filename: 'verify.ts',
    code: `import { OneEightyVerify } from '@workspace/identity-sdk';

await OneEightyVerify.launch({
  clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID!,
  documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
  onSuccess: (session) => {
    console.log('Verified Citizen KYC:', session.status);
    console.log('Session ID:', session.sessionId);
  },
});`,
  },
  elements: {
    label: 'Web Components',
    filename: 'index.html',
    code: `<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.min.js"></script>

<one-eighty-auth-button
  client-id="180_client_your_app_id"
  ux-mode="bottom_sheet"
  label="Sign in with 180"
></one-eighty-auth-button>

<one-eighty-verify-button
  client-id="180_client_your_app_id"
  documents="PAN,DRIVING_LICENSE,FACE_MATCH"
  label="Verify Identity with 180"
></one-eighty-verify-button>`,
  },
  webhook: {
    label: 'HMAC Webhooks',
    filename: 'verify-webhook.ts',
    code: `import crypto from 'crypto';

export function verify180Webhook(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}`,
  },
};

const ARCHITECTURE_PILLARS = [
  {
    icon: Lock,
    title: 'Asymmetric RS256 JWKS',
    description:
      'Tokens are signed with RSA private keys and verified locally against /.well-known/jwks.json with zero shared secrets.',
  },
  {
    icon: ShieldCheck,
    title: 'Per-App Identity Isolation',
    description:
      'Usernames and consent scopes are isolated per OAuth client, preventing cross-application collisions or leaks.',
  },
  {
    icon: Webhook,
    title: 'Replay-Safe Webhooks',
    description:
      'Every identity, authentication, and KYC event carries an X-180-Signature HMAC-SHA256 digest and timestamp validation.',
  },
  {
    icon: Server,
    title: 'Web, Mobile & Server Native',
    description:
      'Drop-in TypeScript SDK, framework-agnostic Web Components, mobile WebView bridges, and standard OAuth 2.0 REST APIs.',
  },
];

export function ArchitectureAndCodeSection() {
  const [activeTab, setActiveTab] = useState<TabId>('auth');
  const [copied, setCopied] = useState(false);

  const snippet = CODE_SNIPPETS[activeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      toast.success('Snippet copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Clipboard access unavailable');
    }
  };

  return (
    <section className="border-y border-zinc-200/80 dark:border-white/10 bg-white/60 dark:bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 space-y-12">
        <div className="max-w-2xl space-y-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Developer Experience
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
            One SDK. Every Surface.
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Integrate authentication and citizen KYC in minutes without building login forms, OTP popups, biometric scanners, or verification screens.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Code Showcase */}
          <Card className="lg:col-span-7 bg-zinc-950 border-zinc-800 text-zinc-100 overflow-hidden shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-zinc-900/80">
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(CODE_SNIPPETS) as TabId[]).map((tabId) => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === tabId
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {CODE_SNIPPETS[tabId].label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-9 px-3 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/10"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <CardContent className="p-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 text-[11px] font-mono text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-blue-400" />
                  {snippet.filename}
                </span>
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Code2 className="h-3 w-3" />
                  @workspace/identity-sdk
                </span>
              </div>
              <pre className="p-5 text-xs leading-relaxed overflow-x-auto text-zinc-200 font-mono">
                <code>{snippet.code}</code>
              </pre>
            </CardContent>
          </Card>

          {/* Architectural Guarantees */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {ARCHITECTURE_PILLARS.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="group interactive-lift bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10 hover:border-blue-500/35 hover:shadow-md shadow-sm"
                >
                  <CardContent className="p-5 flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{item.title}</h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
