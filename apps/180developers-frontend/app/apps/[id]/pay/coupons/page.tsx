'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { CouponsTab } from '@/components/apps/pay/CouponsTab';
import { useProject } from '@/context/ProjectContext';

export default function PayCouponsPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Coupons & Promotional Discounts"
      badge="Growth Engine"
      badgeColor="emerald"
    >
      <div className="p-6">
        <CouponsTab appId={projectId} />
      </div>
    </AppShellLayout>
  );
}
