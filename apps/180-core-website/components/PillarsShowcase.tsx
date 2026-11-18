'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, CreditCard, Shield } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui';

const IDENTITY_POINTS = [
  {
    title: 'Universal OIDC & WebAuthn',
    detail: '1-tap WhatsApp OTP (MSG91), SMS OTP, Google SSO, FIDO2 Passkeys, and RS256 JWKS verification.',
  },
  {
    title: '180 Verify (API Setu Registries)',
    detail: 'Direct verification for Income Tax PAN, MoRTH Driving License & RC, GSTIN, and Voter ID (EPIC).',
  },
  {
    title: 'Bank & UPI Account Proof',
    detail: 'Razorpay IMPS penny-drop fund account validation and NPCI UPI VPA ownership checks.',
  },
  {
    title: 'ArcFace AI Biometrics',
    detail: '512-D normalized face matching comparing live selfie against ID photos with multi-attribute consensus.',
  },
];

const PAY_POINTS = [
  {
    title: 'Dual-Gateway Routing & BYOG',
    detail: 'Razorpay (UPI, Netbanking, Domestic Cards) and Stripe (Global Cards, Apple Pay, Google Pay), or bring your own gateway.',
  },
  {
    title: 'Dynamic Geo-Pricing (PPP)',
    detail: 'Automatic country detection and Purchasing Power Parity currency localization across 135+ currencies.',
  },
  {
    title: 'Sovereign Double-Entry Ledger',
    detail: 'Balanced debit/credit entries across user wallets, platform escrows, and merchant settlements.',
  },
  {
    title: 'Subscriptions & Embeddable Tables',
    detail: 'Automated recurring billing cycles, dunning, coupons, customer portals, and drop-in pricing components.',
  },
];

export function PillarsShowcase() {
  const [focus, setFocus] = useState<'IDENTITY' | 'PAY'>('IDENTITY');

  return (
    <section id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Two Sovereign Pillars
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
            Zero Custom Screens Required.
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Delegate authentication, citizen KYC, and multi-currency monetization to 180 Core&apos;s
            adaptive bottom sheets, modals, and mobile WebView bridges.
          </p>
        </div>

        <div className="inline-flex p-1.5 rounded-2xl bg-zinc-200/70 dark:bg-zinc-900 border border-zinc-300/80 dark:border-white/10 self-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFocus('IDENTITY')}
            className={`h-11 rounded-xl px-4 text-xs font-bold ${
              focus === 'IDENTITY'
                ? 'bg-blue-600 text-white hover:bg-blue-500 hover:text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            180 Identity
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFocus('PAY')}
            className={`h-11 rounded-xl px-4 text-xs font-bold ${
              focus === 'PAY'
                ? 'bg-purple-600 text-white hover:bg-purple-500 hover:text-white shadow-md'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            180 Pay
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar 01: 180 Identity */}
        <Card
          className={`group interactive-lift flex flex-col justify-between bg-white dark:bg-zinc-950 ${
            focus === 'IDENTITY'
              ? 'border-blue-500/40 ring-2 ring-blue-500/15'
              : 'border-zinc-200/80 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
          }`}
        >
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <Shield className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Pillar 01
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-zinc-950 dark:text-white">
                180 Identity &amp; Verify
              </CardTitle>
              <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5">
                OpenID Connect 1.0 identity provider with per-app identity isolation and turnkey government + biometric KYC.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {IDENTITY_POINTS.map((point) => (
              <div key={point.title} className="flex items-start gap-2.5 text-xs leading-relaxed">
                <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-zinc-600 dark:text-zinc-400">
                  <strong className="text-zinc-950 dark:text-white">{point.title}:</strong> {point.detail}
                </p>
              </div>
            ))}
          </CardContent>

          <CardFooter>
            <Button
              asChild
              className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20"
            >
              <Link href="/identity">
                <span>Explore 180 Identity</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Pillar 02: 180 Pay */}
        <Card
          className={`group interactive-lift flex flex-col justify-between bg-white dark:bg-zinc-950 ${
            focus === 'PAY'
              ? 'border-purple-500/40 ring-2 ring-purple-500/15'
              : 'border-zinc-200/80 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
          }`}
        >
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                <CreditCard className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Pillar 02
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-zinc-950 dark:text-white">
                180 Pay &amp; Sovereign Ledger
              </CardTitle>
              <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5">
                Adaptive 1-click checkout, double-entry wallet ledger, recurring subscriptions, and signed webhooks.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {PAY_POINTS.map((point) => (
              <div key={point.title} className="flex items-start gap-2.5 text-xs leading-relaxed">
                <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                <p className="text-zinc-600 dark:text-zinc-400">
                  <strong className="text-zinc-950 dark:text-white">{point.title}:</strong> {point.detail}
                </p>
              </div>
            ))}
          </CardContent>

          <CardFooter>
            <Button
              asChild
              className="w-full h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20"
            >
              <Link href="/pay">
                <span>Explore 180 Pay</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
