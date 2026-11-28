'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { useProject } from '@/context/ProjectContext';
import { CustomGatewayTab } from '@/components/apps/pay/CustomGatewayTab';

export default function PayGatewaysPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Payment Rails & Direct UPI"
      badge="Routing & Gateways"
      badgeColor="purple"
    >
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <CustomGatewayTab appId={projectId} />
      </div>
    </AppShellLayout>
  );
}
