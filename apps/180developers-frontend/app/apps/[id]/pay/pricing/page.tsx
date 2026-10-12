'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { PricingTablesTab } from '@/components/apps/pay/PricingTablesTab';
import { useProject } from '@/context/ProjectContext';

export default function PayPricingPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Embeddable Pricing Tables"
      badge="Tier Builder"
      badgeColor="purple"
      fullWidth
    >
      <PricingTablesTab appId={projectId} />
    </AppShellLayout>
  );
}
