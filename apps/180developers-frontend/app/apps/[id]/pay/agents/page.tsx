'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { AgentEnvelopesTab } from '@/components/apps/pay/AgentEnvelopesTab';
import { useProject } from '@/context/ProjectContext';

export default function PayAgentsPage() {
  const { projectId } = useProject();

  return (
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="Autonomous AI Agent Budget Envelopes"
      badge="Autonomous Agents"
      badgeColor="purple"
    >
      <div className="p-6">
        <AgentEnvelopesTab appId={projectId} />
      </div>
    </AppShellLayout>
  );
}
