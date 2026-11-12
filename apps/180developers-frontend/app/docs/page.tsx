'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Shield,
  CreditCard,
  Key,
  Code2,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  Terminal,
  Lock,
  Layers,
  Sparkles,
  Server,
  Cpu,
  UserCheck,
  Building2,
  ScanLine,
  Eye,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

type DocSection =
  | 'overview'
  | 'quickstart'
  | 'identity-sso'
  | 'identity-jwks'
  | 'identity-verify'
  | 'identity-sdk'
  | 'pay-checkout'
  | 'pay-ppp'
  | 'pay-subscriptions'
  | 'pay-webhooks'
  | 'pay-sdk'
  | 'api-reference';

interface DocItem {
  id: DocSection;
  title: string;
  category: 'Getting Started' | '180 Identity' | '180 Pay' | 'API Reference';
  badge?: string;
}

const DOCS_NAV: DocItem[] = [
  // Getting Started
  { id: 'overview', title: 'Platform Architecture & Overview', category: 'Getting Started' },
  { id: 'quickstart', title: '5-Minute Quickstart', category: 'Getting Started' },

  // 180 Identity
  { id: 'identity-sso', title: 'Universal SSO & WhatsApp OTP', category: '180 Identity', badge: 'OIDC' },
  { id: 'identity-jwks', title: 'Token Lifecycle & RS256 JWKS', category: '180 Identity', badge: 'Security' },
  { id: 'identity-verify', title: '180 Verify (Gov, Bank & Biometrics)', category: '180 Identity', badge: 'New' },
  { id: 'identity-sdk', title: 'Identity SDK & Bottom Sheet', category: '180 Identity' },

  // 180 Pay
  { id: 'pay-checkout', title: 'Universal 1-Click Checkout', category: '180 Pay', badge: 'Dual-Gateway' },
  { id: 'pay-ppp', title: 'Dynamic PPP (135+ Currencies)', category: '180 Pay' },
  { id: 'pay-subscriptions', title: 'Recurring Subscriptions & Ledger', category: '180 Pay' },
  { id: 'pay-webhooks', title: 'HMAC SHA-256 Webhooks', category: '180 Pay', badge: 'Security' },
  { id: 'pay-sdk', title: 'Pay SDK & Web Components', category: '180 Pay' },

  // API Reference
  { id: 'api-reference', title: 'REST Endpoints & Schemas', category: 'API Reference' },
];

function DocsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialSection = (searchParams.get('section') as DocSection) || 'overview';

  const [activeSection, setActiveSection] = useState<DocSection>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const s = searchParams.get('section') as DocSection;
    if (s && DOCS_NAV.some((item) => item.id === s)) {
      setActiveSection(s);
    }
  }, [searchParams]);

  const selectSection = (id: DocSection) => {
    setActiveSection(id);
    router.push(`/docs?section=${id}`, { scroll: false });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredNav = DOCS_NAV.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['Getting Started', '180 Identity', '180 Pay', 'API Reference'] as const;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex font-sans transition-colors duration-200">
      {/* ── SIDEBAR NAVIGATION ────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-zinc-200 dark:border-white/10 p-6 hidden md:flex flex-col justify-between sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-zinc-50/70 dark:bg-zinc-950/70 backdrop-blur-md">
        <div className="space-y-6">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Navigation Categories */}
          <nav className="space-y-6">
            {categories.map((cat) => {
              const items = filteredNav.filter((i) => i.category === cat);
              if (items.length === 0) return null;

              return (
                <div key={cat} className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block px-2">
                    {cat}
                  </span>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectSection(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                          activeSection === item.id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-white'
                        }`}
                      >
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                              activeSection === item.id
                                ? 'bg-white/20 text-white'
                                : 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-zinc-200 dark:border-white/10 text-[11px] text-zinc-500 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span>Sovereign Security Standard</span>
          </div>
          <p>OIDC 1.0 • RS256 • DPDP Act 2023</p>
        </div>
      </aside>

      {/* ── MAIN DOCUMENTATION CONTENT ────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto p-6 md:p-12 space-y-10 min-w-0">
        {/* Mobile Category Selector */}
        <div className="md:hidden">
          <select
            value={activeSection}
            onChange={(e) => selectSection(e.target.value as DocSection)}
            className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold"
          >
            {DOCS_NAV.map((i) => (
              <option key={i.id} value={i.id}>
                {i.category}: {i.title}
              </option>
            ))}
          </select>
        </div>

        {/* SECTION 1: OVERVIEW */}
        {activeSection === 'overview' && (
          <article className="space-y-6">
            <div className="space-y-2 border-b border-zinc-200 dark:border-white/10 pb-6">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Getting Started
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
                Platform Architecture & Overview
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                180 Core provides enterprise-grade sovereign identity, document & biometric verification, and global payment infrastructure.
              </p>
            </div>

            <div className="prose prose-zinc dark:prose-invert max-w-none text-xs sm:text-sm space-y-4">
              <p>
                Modern applications waste thousands of engineering hours building authentication screens, OTP providers, KYC workflows, and payment checkouts. 180 Core solves this by decoupling the identity and payment layers into an autonomous, sovereign engine.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose pt-2">
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                    <Shield className="w-4 h-4" /> 180 Identity & Verify
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    OIDC / OAuth 2.0 PKCE Universal SSO, WhatsApp 1-tap login, WebAuthn Passkeys, and the 180 Verify suite (API Setu, Razorpay Penny Drop, ArcFace Face Match, and strict DOB/Name matching).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 shadow-xs">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                    <CreditCard className="w-4 h-4" /> 180 Pay & Ledger
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Dual-Gateway checkout (Razorpay + Stripe), real-time Purchasing Power Parity (PPP) in 135+ currencies, automated subscriptions, and cryptographic HMAC webhooks.
                  </p>
                </div>
              </div>

              <h3 className="text-base font-bold text-zinc-950 dark:text-white pt-4">Zero-Custom-Screen Architecture</h3>
              <p>
                Relying applications do not need to design, code, or maintain login or checkout screens. The official <code className="text-xs bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded">@workspace/identity-sdk</code> provides turnkey bottom sheets (80% viewport) and popups that handle end-to-end user workflows and post signed responses back to your app.
              </p>
            </div>
          </article>
        )}

        {/* SECTION 2: QUICKSTART */}
        {activeSection === 'quickstart' && (
          <article className="space-y-6">
            <div className="space-y-2 border-b border-zinc-200 dark:border-white/10 pb-6">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Getting Started
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
                5-Minute Quickstart
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Install the SDK and integrate 180 Identity or 180 Pay with single-line hooks.
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm">
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">1. Install Client SDK</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 flex items-center justify-between text-zinc-300 font-mono text-xs">
                  <span>npm install @workspace/identity-sdk</span>
                  <button
                    onClick={() => copyToClipboard('npm install @workspace/identity-sdk', 'install')}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">2. Launch 180 Identity SSO</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 relative font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`import { use180Identity } from '@workspace/identity-sdk';

export function LoginButton() {
  const { launch180Identity } = use180Identity('YOUR_CLIENT_ID');

  return (
    <button onClick={() => launch180Identity({
      onSuccess: (res) => console.log('Logged in:', res.user)
    })}>
      Sign In with 180
    </button>
  );
}`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">3. Launch 180 Pay Checkout</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 relative font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`import { use180Pay } from '@workspace/identity-sdk';

export function CheckoutButton() {
  const { launch180Pay } = use180Pay();

  return (
    <button onClick={() => launch180Pay({
      amount: 49.00,
      currency: 'USD',
      title: 'Pro Subscription',
      onSuccess: (res) => console.log('Payment complete:', res.sessionId)
    })}>
      Pay with 180 Pay
    </button>
  );
}`}</pre>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* SECTION 3: 180 VERIFY */}
        {activeSection === 'identity-verify' && (
          <article className="space-y-6">
            <div className="space-y-2 border-b border-zinc-200 dark:border-white/10 pb-6">
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                180 Identity Suite
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
                180 Verify: Sovereign Documents, Banking & Biometrics
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Official Government of India (API Setu) registry lookups, Razorpay IMPS Penny Drop, ArcFace AI face matching, and strict multi-attribute cross-document consensus.
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Multi-Attribute Consistency Engine Active
                </div>
                <p className="text-xs leading-relaxed">
                  180 Verify strictly checks <strong>Date of Birth (DOB)</strong>, <strong>Father's Name</strong>, and <strong>Gender</strong> in addition to Name across PAN, DL, Aadhaar, and Bank records. If conflicting DOBs or names are presented, the request is immediately rejected with <code className="bg-emerald-950/20 px-1 py-0.5 rounded font-mono">DOCUMENT_DOB_MISMATCH</code>.
                </p>
              </div>

              {/* Supported Registries */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">Supported Verification Modules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <span className="font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" /> Income Tax PAN
                    </span>
                    <p className="text-[11px] text-zinc-500">10-Digit PAN validation, registered legal name, father's name, and Aadhaar seeding status.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <span className="font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-500" /> MoRTH Driving License & RC
                    </span>
                    <p className="text-[11px] text-zinc-500">Parivahan registry check: validity dates, vehicle classes (LMV, MCWG), and Vehicle RC fitness.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <span className="font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" /> Bank IMPS Penny Drop & UPI
                    </span>
                    <p className="text-[11px] text-zinc-500">Razorpay fund validation deposits ₹1 into user account to retrieve official bank holder name.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                    <span className="font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-indigo-500" /> ArcFace AI Biometrics
                    </span>
                    <p className="text-[11px] text-zinc-500">512-D normalized vector cosine similarity comparing live camera selfie to ID card photos with eye-blink liveness.</p>
                  </div>
                </div>
              </div>

              {/* Code Example: Full KYC Orchestration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-zinc-950 dark:text-white">Full KYC Orchestration API</h3>
                  <span className="text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">POST /api/v1/identity/verify/full-kyc</span>
                </div>

                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`// Request Payload: Full Multi-Document KYC
const response = await fetch('https://api.180core.cloud/api/v1/identity/verify/full-kyc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pan: { number: 'ABCDE1234F', name: 'PRINCE KUMAR', dob: '1995-06-15' },
    dl: { number: 'DL-1420110012345', dob: '15/06/1995', fatherName: 'RAMESH KUMAR' },
    bank: { accountNumber: '112233445566', ifsc: 'HDFC0000001' },
    liveSelfie: 'data:image/jpeg;base64,...',
    options: { eyeBlinkDetected: true }
  })
});

const data = await response.json();
console.log(data.status); // "APPROVED"`}</pre>
                </div>
              </div>

              {/* SDK One-Liner */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">One-Liner Client SDK Bottom Sheet</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`import { OneEightyVerify } from '@workspace/identity-sdk';

// Automatically opens 80% screen adaptive resident verification sheet
OneEightyVerify.launch({
  documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
  onSuccess: (profile) => {
    console.log('Verified Citizen Profile:', profile);
  }
});`}</pre>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* SECTION 4: 180 PAY CHECKOUT */}
        {activeSection === 'pay-checkout' && (
          <article className="space-y-6">
            <div className="space-y-2 border-b border-zinc-200 dark:border-white/10 pb-6">
              <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                180 Pay Suite
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
                Universal 1-Click Checkout
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Hybrid routing between Razorpay (Domestic) and Stripe (Global) with zero custom checkout screens.
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm">
              <p>
                180 Pay dynamically assesses the customer's region, currency, and device. Domestic Indian transactions route via Razorpay (UPI auto-pay, netbanking, cards), while international orders route via Stripe (Apple Pay, Google Pay, global credit cards).
              </p>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">Launch Universal Checkout (React)</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`import { use180Pay } from '@workspace/identity-sdk';

export function BuyProduct() {
  const { launch180Pay } = use180Pay();

  const handleCheckout = () => {
    launch180Pay({
      amount: 49.00,
      currency: 'USD',
      title: 'Pro Developer Plan',
      orderId: 'ord_12345',
      onSuccess: (res) => {
        alert('Order completed: ' + res.transactionId);
      }
    });
  };

  return <button onClick={handleCheckout}>Pay with 180 Pay</button>;
}`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">HTML / Web Component Drop-In</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`<!-- Drop-in Web Component for static HTML or Shopify -->
<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.js"></script>

<one-eighty-pay-button
  amount="49.00"
  currency="USD"
  title="Pro Developer Plan"
  client-id="YOUR_CLIENT_ID">
</one-eighty-pay-button>`}</pre>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* SECTION 5: WEBHOOKS */}
        {activeSection === 'pay-webhooks' && (
          <article className="space-y-6">
            <div className="space-y-2 border-b border-zinc-200 dark:border-white/10 pb-6">
              <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Security & Events
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
                Cryptographic Webhook Verification
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Verify HMAC SHA-256 signatures with replay attack protection.
              </p>
            </div>

            <div className="space-y-6 text-xs sm:text-sm">
              <p>
                All webhook requests dispatched by 180 Core carry the <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">X-180-Signature</code> header. Verify it using your webhook secret to prevent tampering.
              </p>

              <div className="space-y-2">
                <h3 className="font-bold text-sm text-zinc-950 dark:text-white">Node.js Express Webhook Verification</h3>
                <div className="rounded-2xl bg-zinc-950 p-4 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto">
                  <pre>{`import express from 'express';
import crypto from 'crypto';

const app = express();

app.post('/api/webhooks/180', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-180-signature'];
  const secret = process.env.ONE_EIGHTY_WEBHOOK_SECRET;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(req.body).digest('hex');

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    const event = JSON.parse(req.body.toString());
    console.log('Verified Event:', event.type);
    res.status(200).send('OK');
  } else {
    res.status(401).send('Invalid signature');
  }
});`}</pre>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* DEFAULT FALLBACK SECTION */}
        {(activeSection === 'identity-sso' ||
          activeSection === 'identity-jwks' ||
          activeSection === 'identity-sdk' ||
          activeSection === 'pay-ppp' ||
          activeSection === 'pay-subscriptions' ||
          activeSection === 'pay-sdk' ||
          activeSection === 'api-reference') && (
          <article className="space-y-6">
            <div className="space-y-2 border-b border-zinc-200 dark:border-white/10 pb-6">
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Specification & Reference
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
                {DOCS_NAV.find((n) => n.id === activeSection)?.title}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Detailed integration specification for 180 Core developers.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4 text-xs sm:text-sm">
              <p className="text-zinc-700 dark:text-zinc-300">
                To test live flows, you can launch the live product simulators from the product pages:
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/products/identity"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Shield className="w-3.5 h-3.5" /> 180 Identity Hub
                </Link>
                <Link
                  href="/products/pay"
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <CreditCard className="w-3.5 h-3.5" /> 180 Pay Hub
                </Link>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Terminal className="w-3.5 h-3.5" /> Developer Console
                </Link>
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Loading Documentation...</p>
          </div>
        </div>
      }
    >
      <DocsContent />
    </Suspense>
  );
}

