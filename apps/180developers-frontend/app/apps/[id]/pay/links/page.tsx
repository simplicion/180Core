'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { PaymentLinksTab } from '@/components/apps/pay/PaymentLinksTab';
import { useProject } from '@/context/ProjectContext';

export default function PayLinksPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Hosted Payment Links"
      badge="Direct Checkout"
      badgeColor="purple"
    >
      <div className="p-6">
        <PaymentLinksTab appId={projectId} />
      </div>
    </AppShellLayout>
  );
}
