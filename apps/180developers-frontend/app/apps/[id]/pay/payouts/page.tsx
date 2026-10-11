'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { PayPayoutsView } from '@/components/pay/PayPayoutsView';

export default function PayPayoutsPage() {
  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Settlements & Instant Payouts"
      badge="Treasury"
      badgeColor="emerald"
    >
      <PayPayoutsView />
    </AppShellLayout>
  );
}
