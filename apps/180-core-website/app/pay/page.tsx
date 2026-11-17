import React from 'react';
import type { Metadata } from 'next';
import { PayShowcase } from '@/components/PayShowcase';

export const metadata: Metadata = {
  title: '180 Pay & Sovereign Ledger',
  description:
    'Dual-gateway Razorpay + Stripe checkout, BYOG, dynamic Purchasing Power Parity across 135+ currencies, subscriptions, and double-entry ledgers.',
};

export default function PayPage() {
  return <PayShowcase />;
}
