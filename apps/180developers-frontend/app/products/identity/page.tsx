'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Key,
  Smartphone,
  Lock,
  ArrowRight,
  Play,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  ExternalLink,
  Code2,
  Sparkles,
  Server,
  Layers,
  ArrowLeft,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, PlatformModal, AILogoIcon } from '@workspace/ui';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';
import { use180Identity } from '@workspace/identity-sdk';

export default function IdentityProductPage() {
  const { launch180Identity, isOpeningIdentity } = use180Identity();
  const [activeCodeTab, setActiveCodeTab] = useState<'nextauth' | 'react' | 'node' | 'python' | 'flutter'>('nextauth');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [authPayload, setAuthPayload] = useState<any>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestAuth = () => {
    launch180Identity({
      clientId: '180-developer-portal',
      onSuccess: (res) => {
        setAuthPayload(res);
        setShowDemoModal(true);
        toast.success(`Authenticated as ${res.user?.name || res.user?.phone || '180 User'}`);
      },
    });
  };

  return (
    <div className="space-y-20 py-4 pb-20">
      {/* ── Breadcrumb & Hero ──────────────────────────────────────────────── */}
      <section className="relative max-w-5xl mx-auto text-center space-y-8 pt-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex items-center justify-center gap-2">
          <Link
            href="/"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Developer Platform</span>
          </Link>
          <span className="text-zinc-400">•</span>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Products</span>
          <span className="text-zinc-400">•</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">180 Identity</span>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-md bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Universal Authentication Protocol</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.1]">
          Universal Authentication.{' '}
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
            One-Tap WhatsApp & Google SSO.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Provide your users instant passwordless access with their universal 180 Profile. 
          Standard OpenID Connect 1.0, RFC 7636 PKCE, and cryptographic RS256 asymmetric token verification.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Button
            onClick={handleTestAuth}
            disabled={isOpeningIdentity}
            size="lg"
            className="w-full sm:w-auto rounded-2xl px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {isOpeningIdentity ? (
              <span>Connecting to 180 Identity...</span>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Launch Live 180 Identity Popup</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </>
            )}
          </Button>

          <a
            href={getDocsUrl(DOCS_LINKS.IDENTITY_QUICKSTART)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto rounded-2xl px-8 py-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-sm border border-zinc-200 dark:border-white/10 shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Read Integration Docs</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
          </a>
        </div>

        {/* Feature Pill Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 text-left">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">RS256</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Asymmetric JWKS Keys</div>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">1-Tap</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">WhatsApp & Google Login</div>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">OIDC 1.0</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Standard Spec Compliant</div>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm space-y-1 backdrop-blur-md">
            <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">PKCE</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Mobile & SPA Security</div>
          </div>
        </div>
      </section>

      {/* ── Core Architectural Advantages ─────────────────────────────────── */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Why Switch to 180 Identity?
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Eliminate traditional database credential leaks and password friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 shadow-sm hover:border-blue-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base">WhatsApp OTP & Google SSO</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Users log in with their verified phone number via WhatsApp or Google with 1 tap. No passwords to remember or reset.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 shadow-sm hover:border-indigo-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base">Zero Shared Secrets</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Tokens are signed with RSA-2048 private keys. Your server verifies JWTs locally using public JWKS without contacting auth servers.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 space-y-3 shadow-sm hover:border-purple-500/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-950 dark:text-white text-base">Universal Identity Passport</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Users carry their verified profile (@username, avatar, KYC, and 180 wallet) seamlessly across all ecosystem applications.
            </p>
          </div>
        </div>
      </section>

      {/* ── Code Implementation Snippets ───────────────────────────────────── */}
      <section className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Drop-In Integration in &lt;30 Lines
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Choose your framework to view client and backend integration code
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10 overflow-x-auto">
            {(['nextauth', 'react', 'node', 'python', 'flutter'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveCodeTab(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  activeCodeTab === tab
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {tab === 'nextauth' ? 'NextAuth.js' : tab === 'react' ? 'React / Web SDK' : tab === 'node' ? 'Node.js Express' : tab === 'python' ? 'Python FastAPI' : 'Flutter Mobile'}
              </button>
            ))}
          </div>
        </div>

        {/* Code Terminal */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs font-mono text-zinc-500">
                {activeCodeTab === 'nextauth' ? 'pages/api/auth/[...nextauth].ts' : activeCodeTab === 'react' ? 'App.tsx' : activeCodeTab === 'node' ? 'authController.ts' : activeCodeTab === 'python' ? 'auth.py' : 'auth_service.dart'}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard('code', 'activeCode')}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedKey === 'activeCode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'activeCode' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <pre className="text-xs sm:text-sm text-zinc-300 overflow-x-auto leading-relaxed font-mono">
            {activeCodeTab === 'nextauth' && `// NextAuth.js OIDC Configuration
import NextAuth from 'next-auth';

export const authOptions = {
  providers: [
    {
      id: '180-identity',
      name: '180 Identity',
      type: 'oauth',
      wellKnown: 'https://auth.180workspace.com/.well-known/openid-configuration',
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

export default NextAuth(authOptions);`}

            {activeCodeTab === 'react' && `// Drop-in React Hook Integration
import { use180Identity } from '@workspace/identity-sdk';

export function LoginButton() {
  const { launch180Identity, isOpeningIdentity } = use180Identity();

  const handleSignIn = () => {
    launch180Identity({
      clientId: 'YOUR_CLIENT_ID',
      onSuccess: (auth) => {
        console.log('Authenticated 180 User:', auth.user);
        console.log('Access Token:', auth.token);
      },
      onError: (err) => console.error('Sign-in error:', err),
    });
  };

  return (
    <button onClick={handleSignIn} disabled={isOpeningIdentity}>
      {isOpeningIdentity ? 'Connecting...' : 'Sign In with 180 ID'}
    </button>
  );
}`}

            {activeCodeTab === 'node' && `// Node.js Express Asymmetric RS256 JWT Token Verification
import express from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const app = express();
const client = jwksClient({
  jwksUri: 'https://auth.180workspace.com/.well-known/jwks.json',
  cache: true,
  rateLimit: true,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// Protected API Route
app.get('/api/protected', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid 180 Token' });
    res.json({ message: 'Authorized user', user: decoded });
  });
});`}

            {activeCodeTab === 'python' && `# Python FastAPI Token Verification with PyJWT
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

app = FastAPI()
security = HTTPBearer()
jwks_client = PyJWKClient("https://auth.180workspace.com/.well-known/jwks.json")

def verify_180_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="YOUR_CLIENT_ID"
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/user-profile")
def get_user_profile(user: dict = Depends(verify_180_token)):
    return {"status": "authorized", "user": user}`}

            {activeCodeTab === 'flutter' && `// Flutter Mobile PKCE Authentication
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

Future<void> signInWith180() async {
  final codeVerifier = generateRandomString(64);
  final codeChallenge = sha256Base64Url(codeVerifier);

  final authUrl = 'https://auth.180workspace.com/oauth/authorize'
      '?client_id=YOUR_CLIENT_ID'
      '&redirect_uri=myapp://oauth-callback'
      '&response_type=code'
      '&code_challenge=$codeChallenge'
      '&code_challenge_method=S256'
      '&scope=openid identity:profile';

  final result = await FlutterWebAuth2.authenticate(
    url: authUrl,
    callbackUrlScheme: 'myapp',
  );

  final code = Uri.parse(result).queryParameters['code'];
  // Exchange auth code + code_verifier with /api/v1/identity/oauth/token!
}`}
          </pre>
        </div>
      </section>

      {/* ── Demo Result Modal ──────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showDemoModal && !!authPayload}
        onClose={() => setShowDemoModal(false)}
        title="180 Identity Authentication Successful"
        icon={CheckCircle2}
        iconBgClass="bg-emerald-500/10"
        iconColorClass="text-emerald-600 dark:text-emerald-400"
        maxWidthClass="max-w-md"
      >
        {authPayload && (
          <div className="space-y-4 text-zinc-900 dark:text-white">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Your application received the verified 180 Identity payload and tokens.
            </p>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 space-y-2 text-xs font-mono">
              <div>
                <span className="text-zinc-500">Name:</span>{' '}
                <span className="font-bold text-zinc-900 dark:text-white">{authPayload.user?.name || 'Verified User'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Subject ID:</span>{' '}
                <span className="text-blue-600 dark:text-blue-400 truncate">{authPayload.user?.id || 'usr_180_universal'}</span>
              </div>
              <div>
                <span className="text-zinc-500">Auth Code:</span>{' '}
                <span className="text-purple-600 dark:text-purple-400 truncate">{authPayload.code}</span>
              </div>
            </div>

            <Button
              onClick={() => setShowDemoModal(false)}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg cursor-pointer"
            >
              Done & Return
            </Button>
          </div>
        )}
      </PlatformModal>
    </div>
  );
}
