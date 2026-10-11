'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { IdentitySidebar } from '@/components/identity/IdentitySidebar';
import { IdentityBottomNav } from '@/components/identity/IdentityBottomNav';
import { IdentitySecurityView } from '@/components/identity/IdentitySecurityView';

export default function IdentitySecurityPage() {
  return (
    <AppShellLayout
      sidebar={<IdentitySidebar />}
      bottomNav={<IdentityBottomNav />}
      title="Security, Whitelist & Tokens"
      badge="Zero-Trust"
      badgeColor="blue"
    >
      <IdentitySecurityView />
    </AppShellLayout>
  );
}
