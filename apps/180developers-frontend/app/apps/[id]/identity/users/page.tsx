'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { IdentitySidebar } from '@/components/identity/IdentitySidebar';
import { IdentityBottomNav } from '@/components/identity/IdentityBottomNav';
import { IdentityUsersView } from '@/components/identity/IdentityUsersView';

export default function IdentityUsersPage() {
  return (
    <AppShellLayout
      sidebar={<IdentitySidebar />}
      bottomNav={<IdentityBottomNav />}
      title="Authenticated Users Directory"
      badge="Directory"
      badgeColor="blue"
    >
      <IdentityUsersView />
    </AppShellLayout>
  );
}
