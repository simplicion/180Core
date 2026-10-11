'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { GeoPricingTab } from '@/components/apps/pay/GeoPricingTab';
import { useProject } from '@/context/ProjectContext';

export default function PayGeoPricingPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Geo-Pricing & Purchasing Power Parity"
      badge="Global Localization"
      badgeColor="emerald"
    >
      <div className="p-6">
        <GeoPricingTab appId={projectId} />
      </div>
    </AppShellLayout>
  );
}
