'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { IdentitySidebar } from '@/components/identity/IdentitySidebar';
import { IdentityBottomNav } from '@/components/identity/IdentityBottomNav';
import { IdentityWebhooksView } from '@/components/identity/IdentityWebhooksView';

export default function IdentityWebhooksPage() {
  return (
    <AppShellLayout
      sidebar={<IdentitySidebar />}
      bottomNav={<IdentityBottomNav />}
      title="Identity Webhooks & Auth Events"
      badge="Real-Time Sync"
      badgeColor="blue"
    >
      <IdentityWebhooksView />
    </AppShellLayout>
  );
}
