'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  CreditCard,
  Key,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Lock,
  Globe2,
  Sparkles,
  Zap,
  Layers,
  Terminal,
  Code2,
  BookOpen,
  UserCheck,
  Building2,
  ScanLine,
  Eye,
  Wallet,
  ChevronRight
} from 'lucide-react';
import { OneEightyCoreLogo } from '../components/OneEightyCoreLogo';
import ThemeToggle from '../components/ThemeToggle';
import { use180Identity, OneEightyVerify, use180Pay } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';

export default function MasterLandingPage() {
  const [activeProductMode, setActiveProductMode] = useState<'IDENTITY' | 'PAY'>('IDENTITY');

  const CORE_CLIENT_ID =
    process.env.NEXT_PUBLIC_180_CLIENT_ID ||
    process.env.NEXT_PUBLIC_CORE_CLIENT_ID ||
    '180_client_2d51a605038c38ffb6fa037688988a83';

  const { launch180Identity, isOpeningIdentity } = use180Identity(CORE_CLIENT_ID);
  const { launch180Pay, isOpeningPay } = use180Pay();

  // Test launchers
  const handleLaunchIdentityDemo = () => {
    launch180Identity({
      clientId: CORE_CLIENT_ID,
      onSuccess: (res) => {
        toast.success(`Authenticated: ${res.user?.name || res.user?.email || '180 User'}`);
      }
    });
  };

  const handleLaunchVerifyDemo = () => {
    OneEightyVerify.launch({
      clientId: CORE_CLIENT_ID,
      documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
      onSuccess: (res) => {
        toast.success(`180 Verify Complete! Verified: ${res.profile?.fullName || 'Citizen'}`);
      }
    });
  };

  const handleLaunchPayDemo = () => {
    launch180Pay({
      amount: 49.00,
      currency: 'USD',
      title: 'Pro Developer Pass',
      orderId: 'ord_demo_' + Math.random().toString(36).substring(2, 8),
      onSuccess: (res) => {
        toast.success(`Payment confirmed! Session: ${res.sessionId}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* ── MINIMAL TOP BAR (NO CLUTTERED NAVIGATION LINKS) ───────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo Only */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <OneEightyCoreLogo
              variant="compact"
              height={32}
              className="group-hover:scale-105 transition-transform duration-200"
            />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">
              Platform
            </span>
          </Link>

          {/* Right Action Controls (No Navigation Links) */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/docs"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors px-3 py-1.5 rounded-xl hidden sm:inline-flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>Docs</span>
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Developer Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-16">
        {/* ── HERO SECTION ────────────────────────────────────────────────── */}
        <section className="text-center max-w-4xl mx-auto space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-semibold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Sovereign Operating System for Identity & Payments</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.12]">
            Two Sovereign Pillars.{' '}
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
              Zero Custom Screens Required.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Integrate passwordless identity, government document & AI biometric verification, and global multi-currency checkout into your apps in under five minutes.
          </p>

          {/* 2-Mode Switcher Pills */}
          <div className="inline-flex p-1.5 rounded-2xl bg-zinc-200/80 dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveProductMode('IDENTITY')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeProductMode === 'IDENTITY'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>180 Identity & Verify</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveProductMode('PAY')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeProductMode === 'PAY'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>180 Pay & Checkout</span>
            </button>
          </div>
        </section>

        {/* ── THE TWO CORE PRODUCTS (IMMERSIVE 2-MODE SHOWCASE) ───────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* PRODUCT CARD 1: 180 IDENTITY */}
          <div
            className={`rounded-3xl border p-8 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
              activeProductMode === 'IDENTITY'
                ? 'bg-blue-500/[0.03] dark:bg-blue-950/20 border-blue-500/40 shadow-2xl shadow-blue-500/10 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="space-y-6">
              {/* Product Header */}
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-md">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  PILLAR 01
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                  180 Identity
                </h2>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                  Universal SSO, WebAuthn & 180 Verify Sovereign Suite
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
                  Universal passwordless authentication and turnkey government document, banking, and biometric verification suite powered by API Setu and ArcFace AI.
                </p>
              </div>

              {/* Exact Services List */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Universal OIDC & WebAuthn:</strong> 1-tap WhatsApp OTP, Google SSO, FIDO2 Passkeys, and RS256 JWKS tokens.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">180 Verify (API Setu Registries):</strong> Instant official lookups for Income Tax PAN, MoRTH DL & RC, GSTIN, and Voter ID (EPIC).
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Bank Account & UPI Proof:</strong> Razorpay IMPS ₹1 Penny Drop fund account verification & NPCI UPI VPA validation.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">ArcFace AI Biometrics:</strong> 512-D normalized vector face matching comparing live selfie against ID cards with eye-blink liveness.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Multi-Attribute Consensus:</strong> Cross-document consistency verification for Name, Date of Birth (DOB), Father's Name, and Gender.
                  </div>
                </div>
              </div>

              {/* Interactive Demo Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLaunchIdentityDemo}
                  disabled={isOpeningIdentity}
                  className="px-3.5 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Test SSO Popup</span>
                </button>
                <button
                  type="button"
                  onClick={handleLaunchVerifyDemo}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Test 180 Verify Bottom Sheet</span>
                </button>
              </div>
            </div>

            {/* Dedicated Page Link */}
            <div className="pt-8">
              <Link
                href="/products/identity"
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Enter 180 Identity Website</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* PRODUCT CARD 2: 180 PAY */}
          <div
            className={`rounded-3xl border p-8 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
              activeProductMode === 'PAY'
                ? 'bg-purple-500/[0.03] dark:bg-purple-950/20 border-purple-500/40 shadow-2xl shadow-purple-500/10 ring-2 ring-purple-500/20'
                : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
          >
            <div className="space-y-6">
              {/* Product Header */}
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shadow-md">
                  <CreditCard className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  PILLAR 02
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                  180 Pay
                </h2>
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-0.5">
                  Dual-Gateway Checkout, Dynamic PPP & Sovereign Ledger
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
                  Universal zero-custom-screen checkout engine supporting Razorpay + Stripe, automatic PPP localization in 135+ currencies, and double-entry balance ledgers.
                </p>
              </div>

              {/* Exact Services List */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Dual-Gateway Routing:</strong> Domestic India optimization (Razorpay: UPI, Cards, Netbanking) & Global (Stripe: Cards, Apple Pay, Google Pay).
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Dynamic PPP (135+ Currencies):</strong> Real-time Purchasing Power Parity pricing and country-specific discount calibration.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Sovereign Double-Entry Ledger:</strong> Real-time balance debits/credits, immutable ledger records, and instant 1-click in-app settlements.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Subscriptions & Metered Billing:</strong> Automated recurring cycles, customer billing portal, and grace-period handling.
                  </div>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-zinc-950 dark:text-white">Cryptographic Webhooks:</strong> HMAC SHA-256 signatures with timestamp tolerance and replay protection.
                  </div>
                </div>
              </div>

              {/* Interactive Demo Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLaunchPayDemo}
                  disabled={isOpeningPay}
                  className="px-3.5 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Test $49.00 USD Checkout</span>
                </button>
              </div>
            </div>

            {/* Dedicated Page Link */}
            <div className="pt-8">
              <Link
                href="/products/pay"
                className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Enter 180 Pay Website</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── DEVELOPER INTEGRATION & DOCUMENTATION TILES ───────────────────── */}
        <section className="pt-6">
          <div className="p-8 rounded-3xl bg-zinc-900 text-white border border-zinc-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                  Developer Resources
                </span>
                <h3 className="text-2xl font-black tracking-tight mt-1">
                  Ready to Integrate 180 Core?
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                  Explore full SDK tutorials, API documentation, Webhook signature verifiers, and manage your OAuth credentials in the console.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/docs"
                  className="px-5 py-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Documentation Hub (/docs)</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span>Open Developer Console</span>
                </Link>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-zinc-800">
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[11px] font-bold text-zinc-300 block">Universal Client SDK</span>
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">@workspace/identity-sdk</span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[11px] font-bold text-zinc-300 block">Asymmetric Tokens</span>
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">RS256 & Public JWKS</span>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[11px] font-bold text-zinc-300 block">Sovereign Compliance</span>
                <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">DPDP Act 2023 & RBI Ready</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── MINIMAL SOVEREIGN FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-black py-8 text-xs text-zinc-600 dark:text-zinc-500 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-zinc-900 dark:text-zinc-300">180 Core Platform</span>
            <span>•</span>
            <Link href="/products/identity" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              180 Identity
            </Link>
            <span>•</span>
            <Link href="/products/pay" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              180 Pay
            </Link>
            <span>•</span>
            <Link href="/docs" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Documentation
            </Link>
            <span>•</span>
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Console
            </Link>
          </div>
          <div>© {new Date().getFullYear()} 180 Workspace Platform. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
