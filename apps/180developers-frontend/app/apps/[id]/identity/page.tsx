'use client';

import React from 'react';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { IdentitySidebar } from '@/components/identity/IdentitySidebar';
import { IdentityBottomNav } from '@/components/identity/IdentityBottomNav';
import { IdentityOverviewView } from '@/components/identity/IdentityOverviewView';

export default function IdentityOverviewPage() {
  return (
    <AppShellLayout
      sidebar={<IdentitySidebar />}
      bottomNav={<IdentityBottomNav />}
      title="180 Identity Overview"
      badge="OAuth 2.0 / OIDC"
      badgeColor="blue"
    >
      <IdentityOverviewView />
    </AppShellLayout>
  );
}
