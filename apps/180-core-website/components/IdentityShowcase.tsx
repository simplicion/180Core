'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  CreditCard as DLIcon,
  ExternalLink,
  Eye,
  FileText,
  Key,
  Lock,
  ScanLine,
  Shield,
  Smartphone,
  Users,
} from 'lucide-react';
import { Button, Card, CardContent, PlatformModal } from '@workspace/ui';
import { use180Identity, OneEightyVerify } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';
import { DEMO_CLIENT_ID, developerLink, docsLink } from '@/lib/urls';

type IdentityCodeTab = 'nextauth' | 'verify' | 'react' | 'node' | 'python' | 'flutter';

const CODE_SNIPPETS: Record<IdentityCodeTab, { label: string; filename: string; code: string }> = {
  nextauth: {
    label: 'NextAuth.js',
    filename: 'pages/api/auth/[...nextauth].ts',
    code: `// NextAuth.js OIDC Configuration (RFC 6749 / OpenID Connect)
import NextAuth from 'next-auth';

export const authOptions = {
  providers: [
    {
      id: '180-identity',
      name: '180 Identity',
      type: 'oauth',
      wellKnown: 'https://api.180core.cloud/.well-known/openid-configuration',
      clientId: process.env.ONE_EIGHTY_CLIENT_ID,
      clientSecret: process.env.ONE_EIGHTY_CLIENT_SECRET,
      authorization: { params: { scope: 'openid identity:profile identity:email' } },
      idToken: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.avatarUrl,
        };
      },
    },
  ],
};

export default NextAuth(authOptions);`,
  },
  verify: {
    label: '180 Verify',
    filename: 'verify.ts (Client SDK)',
    code: `// 180 Verify: Sovereign Document, Bank & Face Match Integration
import { OneEightyVerify } from '@workspace/identity-sdk';

export function runCitizenVerification() {
  OneEightyVerify.launch({
    clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID!,
    documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
    onSuccess: ({ sessionId, status }) => {
      console.log('Verification Complete:', status, sessionId);
    },
    onError: (err) => {
      console.error('Verification failed:', err.message);
    },
  });
}`,
  },
  react: {
    label: 'React / Web SDK',
    filename: 'App.tsx',
    code: `// Option A: React / Next.js Component Hook
import { use180Identity, OneEightyIdentity } from '@workspace/identity-sdk';

export function LoginButton() {
  const { isOpeningIdentity } = use180Identity();

  const handleSignIn = () => {
    OneEightyIdentity.openBottomSheet({
      clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID!,
      onSuccess: async (auth) => {
        await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: auth.code }),
        });
      },
    });
  };

  return (
    <button onClick={handleSignIn} disabled={isOpeningIdentity}>
      {isOpeningIdentity ? 'Connecting...' : 'Continue with 180 Profile'}
    </button>
  );
}

// Option B: Vanilla HTML Script Tag
// <script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.js" async></script>`,
  },
  node: {
    label: 'Node.js Express',
    filename: 'authController.ts',
    code: `// Node.js Asymmetric RS256 JWT Verification via Remote JWKS
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://api.180core.cloud/certs/jwks.json'));

export async function verify180BearerToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    algorithms: ['RS256'],
    issuer: 'https://profile.180core.cloud',
    audience: process.env.ONE_EIGHTY_CLIENT_ID,
  });
  return payload;
}`,
  },
  python: {
    label: 'Python FastAPI',
    filename: 'auth.py',
    code: `# Python FastAPI Token Verification with PyJWT & Remote JWKS
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

app = FastAPI()
security = HTTPBearer()
jwks_client = PyJWKClient("https://api.180core.cloud/certs/jwks.json")

def verify_180_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer="https://profile.180core.cloud",
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid RS256 token: {str(e)}")`,
  },
  flutter: {
    label: 'Flutter Mobile',
    filename: 'auth_service.dart',
    code: `// Flutter Mobile (Android / iOS): OAuth 2.0 + PKCE (S256)
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

Future<void> signInWith180Mobile() async {
  final authUrl = 'https://profile.180core.cloud/oauth/authorize'
      '?client_id=YOUR_CLIENT_ID'
      '&redirect_uri=myapp://oauth-callback'
      '&response_type=code'
      '&code_challenge=S256_CHALLENGE'
      '&code_challenge_method=S256'
      '&scope=openid identity:profile';

  final result = await FlutterWebAuth2.authenticate(
    url: authUrl,
    callbackUrlScheme: 'myapp',
  );

  final code = Uri.parse(result).queryParameters['code'];
  // Exchange code at: https://api.180core.cloud/api/oauth/token
}`,
  },
};

const AUTH_CAPABILITIES = [
  {
    icon: Smartphone,
    title: 'WhatsApp OTP & Google SSO',
    description:
      'Users log in with their verified phone number via WhatsApp or Google with 1 tap. No passwords to remember or reset.',
  },
  {
    icon: Lock,
    title: 'Zero Shared Secrets',
    description:
      'Tokens are signed with RSA-2048 private keys. Your server verifies JWTs locally using public JWKS without contacting auth servers.',
  },
  {
    icon: Users,
    title: 'Universal Identity Passport',
    description:
      'Users carry their verified profile (@username, avatar, KYC, and 180 wallet) seamlessly across all ecosystem applications.',
  },
];

const VERIFY_MODULES = [
  {
    icon: FileText,
    title: 'Income Tax PAN',
    detail: "10-Digit PAN validation, registered name, father's name, and Aadhaar seeding status via API Setu.",
  },
  {
    icon: DLIcon,
    title: 'MoRTH DL & RC',
    detail: 'Parivahan registry check: validity dates, vehicle classes (LMV/MCWG), and Vehicle RC fitness.',
  },
  {
    icon: Building2,
    title: 'Bank IMPS & UPI',
    detail: 'Razorpay ₹1 penny drop and NPCI UPI VPA lookup to prove bank account ownership.',
  },
  {
    icon: Eye,
    title: 'ArcFace Biometrics',
    detail: '512-D normalized vector face match with eye-blink liveness anti-spoofing.',
  },
];

export function IdentityShowcase() {
  const { launch180Identity, isOpeningIdentity } = use180Identity(DEMO_CLIENT_ID);
  const [activeCodeTab, setActiveCodeTab] = useState<IdentityCodeTab>('nextauth');
  const [copied, setCopied] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [authPayload, setAuthPayload] = useState<any>(null);

  const activeSnippet = CODE_SNIPPETS[activeCodeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet.code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Clipboard access unavailable');
    }
  };

  const handleLaunchAuth = () => {
    launch180Identity({
      clientId: DEMO_CLIENT_ID,
      onSuccess: (res) => {
        setAuthPayload(res);
        setShowDemoModal(true);
        toast.success(`Authenticated as ${res.user?.name || res.user?.phone || res.user?.email || '180 User'}`);
      },
      onError: (err) => {
        toast.error(err?.message || 'Unable to open 180 Identity');
      },
    });
  };

  const handleLaunchVerify = () => {
    OneEightyVerify.launch({
      clientId: DEMO_CLIENT_ID,
      documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
      onSuccess: (res) => {
        setAuthPayload(res);
        setShowDemoModal(true);
        toast.success(`180 Verify ${res.status} (Session: ${res.sessionId})`);
      },
      onError: (err) => {
        toast.error(err?.message || 'Unable to open 180 Verify');
      },
    });
  };

  return (
    <div className="space-y-20 py-12 md:py-16 animate-page-enter">
      {/* Breadcrumb & Hero */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-7">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex items-center justify-center gap-2 text-xs">
          <Link
            href="/"
            className="font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>180 Core</span>
          </Link>
          <span className="text-zinc-400">•</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">Products</span>
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-500 dark:text-zinc-400">180 Identity</span>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <Shield className="h-3.5 w-3.5" />
          <span>Universal Authentication Protocol</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.08]">
          Universal Authentication.{' '}
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
            One-Tap WhatsApp &amp; Google SSO.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Provide your users instant passwordless access with their universal 180 Profile. Standard
          OpenID Connect 1.0, RFC 7636 PKCE, and cryptographic RS256 asymmetric token verification.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            type="button"
            size="lg"
            onClick={handleLaunchAuth}
            disabled={isOpeningIdentity}
            className="w-full sm:w-auto h-12 rounded-2xl px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25"
          >
            <Key className="h-4 w-4 mr-2" />
            <span>{isOpeningIdentity ? 'Connecting...' : 'Launch Live 180 Identity Popup'}</span>
            <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-75" />
          </Button>

          <Button
            type="button"
            size="lg"
            onClick={handleLaunchVerify}
            className="w-full sm:w-auto h-12 rounded-2xl px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25"
          >
            <ScanLine className="h-4 w-4 mr-2" />
            <span>Launch 180 Verify Bottom Sheet</span>
            <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-75" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            asChild
            className="w-full sm:w-auto h-12 rounded-2xl px-6 text-xs font-semibold"
          >
            <a href={docsLink('identity-verify')} target="_blank" rel="noopener noreferrer">
              <Code2 className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
              <span>Verification Docs</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5 text-zinc-400" />
            </a>
          </Button>
        </div>

        {/* Highlight Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 text-left">
          {[
            { value: 'RS256', label: 'Asymmetric JWKS Keys', color: 'text-zinc-950 dark:text-white' },
            { value: '1-Tap', label: 'WhatsApp & Google Login', color: 'text-blue-600 dark:text-blue-400' },
            { value: 'OIDC 1.0', label: 'Standard Spec Compliant', color: 'text-emerald-600 dark:text-emerald-400' },
            { value: 'PKCE', label: 'Mobile & SPA Security', color: 'text-purple-600 dark:text-purple-400' },
          ].map((stat) => (
            <div
              key={stat.value}
              className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-1"
            >
              <div className={`text-2xl font-black font-mono tracking-tight ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Architectural Advantages */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
            Why Switch to 180 Identity?
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Eliminate traditional database credential leaks and password friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {AUTH_CAPABILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="bg-white dark:bg-zinc-950 border-zinc-200/80 dark:border-white/10">
                <CardContent className="p-6 space-y-3">
                  <div className="h-11 w-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">{item.title}</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 180 Verify Suite */}
      <section id="verify" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-emerald-500/25 p-6 sm:p-10 space-y-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Sovereign Document &amp; Biometric Suite
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
                180 Verify: Trustless Citizen KYC
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Official API Setu Government Registries, Razorpay IMPS Penny Drop, ArcFace AI Face
                Match, and strict DOB/Name multi-attribute consensus.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Button
                type="button"
                onClick={handleLaunchVerify}
                className="h-11 rounded-xl px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                <ScanLine className="h-4 w-4 mr-1.5" />
                <span>Launch Bottom Sheet</span>
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-11 rounded-xl px-5 text-xs font-semibold"
              >
                <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
                  <span>Enable in Console</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VERIFY_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.title}
                  className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/10 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-950 dark:text-white">
                    <Icon className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>{mod.title}</span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {mod.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Code Implementation Snippets */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
              Drop-In Integration in &lt;30 Lines
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Choose your framework to view client and backend integration code
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto">
            {(Object.keys(CODE_SNIPPETS) as IdentityCodeTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCodeTab(tab)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeCodeTab === tab
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {CODE_SNIPPETS[tab].label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-zinc-400">{activeSnippet.filename}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-9 px-3 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-white/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <pre className="text-xs sm:text-sm text-zinc-200 overflow-x-auto leading-relaxed font-mono">
            <code>{activeSnippet.code}</code>
          </pre>
        </div>
      </section>

      {/* Demo Result Modal */}
      <PlatformModal
        isOpen={showDemoModal && !!authPayload}
        onClose={() => setShowDemoModal(false)}
        title="180 Identity Verification Complete"
        icon={CheckCircle2}
        iconBgClass="bg-emerald-500/10"
        iconColorClass="text-emerald-600 dark:text-emerald-400"
        maxWidthClass="max-w-md"
      >
        {authPayload && (
          <div className="space-y-4 text-zinc-900 dark:text-white">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Your application received the verified 180 Identity / Verify payload.
            </p>
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-2 text-xs font-mono">
              {authPayload.user?.name && (
                <div>
                  <span className="text-zinc-500">Name:</span>{' '}
                  <span className="font-bold">{authPayload.user.name}</span>
                </div>
              )}
              {authPayload.sessionId && (
                <div>
                  <span className="text-zinc-500">Session ID:</span>{' '}
                  <span className="text-emerald-500">{authPayload.sessionId}</span>
                </div>
              )}
              {authPayload.status && (
                <div>
                  <span className="text-zinc-500">Status:</span>{' '}
                  <span className="text-blue-500 font-bold">{authPayload.status}</span>
                </div>
              )}
              {authPayload.code && (
                <div>
                  <span className="text-zinc-500">Auth Code:</span>{' '}
                  <span className="text-purple-500 break-all">{authPayload.code}</span>
                </div>
              )}
            </div>
            <Button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
            >
              Done &amp; Return
            </Button>
          </div>
        )}
      </PlatformModal>
    </div>
  );
}
