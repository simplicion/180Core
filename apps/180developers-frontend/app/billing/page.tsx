'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DeveloperSidebar from '@/components/layout/DeveloperSidebar';
import DeveloperHeader from '@/components/layout/DeveloperHeader';
import { BillingView } from '@/components/billing/BillingView';

export default function BillingPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [apps, setApps] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('platform_auth_token');
        if (!token) return;

        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const apiBase = isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com');

        const [userRes, appsRes] = await Promise.all([
          fetch(`${apiBase}/api/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
          fetch(`${apiBase}/api/v1/identity/developer/apps`, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null),
        ]);

        if (userRes && userRes.ok) {
          const u = await userRes.json();
          setUserProfile(u.user || u);
        }

        if (appsRes && appsRes.ok) {
          const a = await appsRes.json();
          setApps(a.apps || a || []);
        }
      } catch (_) {}
    };

    fetchUserData();
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('platform_auth_token');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors duration-200">
      <DeveloperSidebar
        activeTab="billing"
        onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        appCount={apps.length}
        apps={apps}
        onExpandChange={setIsSidebarExpanded}
        userProfile={userProfile}
        onSignOut={handleSignOut}
      />
      <div
        className={`flex-1 ${
          isSidebarExpanded
            ? 'lg:ml-[280px] lg:w-[calc(100%-280px)]'
            : 'lg:ml-[80px] lg:w-[calc(100%-80px)]'
        } flex flex-col min-h-screen transition-all duration-300 ease-in-out`}
      >
        <DeveloperHeader
          onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          activeTabTitle="Billing & Subscriptions"
          activeTabId="billing"
          onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
          userProfile={userProfile}
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Billing & Subscriptions' },
          ]}
          onSignOut={handleSignOut}
        />
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          <BillingView />
        </main>
      </div>
    </div>
  );
}
