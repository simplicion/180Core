'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { PayWebhooksView } from '@/components/pay/PayWebhooksView';

export default function PayWebhooksPage() {
  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Webhooks & Event Deliveries"
      badge="Realtime HTTP"
      badgeColor="purple"
    >
      <PayWebhooksView />
    </AppShellLayout>
  );
}
