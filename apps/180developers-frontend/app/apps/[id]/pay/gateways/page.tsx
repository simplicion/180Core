'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { CustomGatewayTab } from '@/components/apps/pay/CustomGatewayTab';
import { useProject } from '@/context/ProjectContext';

export default function PayGatewaysPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Custom Payment Gateways & Routing"
      badge="Multi-Rail"
      badgeColor="purple"
    >
      <div className="p-6">
        <CustomGatewayTab appId={projectId} />
      </div>
    </AppShellLayout>
  );
}
