'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { IdentitySidebar } from '@/components/identity/IdentitySidebar';
import { IdentityBottomNav } from '@/components/identity/IdentityBottomNav';
import { IdentityLogsView } from '@/components/identity/IdentityLogsView';

export default function IdentityLogsPage() {
  return (
    <AppShellLayout
      sidebar={<IdentitySidebar />}
      bottomNav={<IdentityBottomNav />}
      title="Real-Time Auth Telemetry"
      badge="Live Stream"
      badgeColor="emerald"
    >
      <IdentityLogsView />
    </AppShellLayout>
  );
}
