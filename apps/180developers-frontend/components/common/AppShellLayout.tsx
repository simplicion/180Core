'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import DeveloperHeader from '@/components/layout/DeveloperHeader';

export interface AppShellLayoutProps {
  sidebar: React.ReactNode;
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: 'blue' | 'purple' | 'emerald' | 'amber';
  breadcrumbs?: { label: string; href?: string }[];
  action?: React.ReactNode;
}

export function AppShellLayout({
  sidebar,
  bottomNav,
  children,
  title,
  badge,
  badgeColor = 'blue',
  breadcrumbs,
  action,
}: AppShellLayoutProps) {
  const { project, projectId, loading, isSidebarExpanded, userProfile, refreshProject } = useProject();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getBadgeClasses = (color: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'amber':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
  };

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
          <p className="text-xs text-zinc-500 font-medium">Loading console...</p>
        </div>
      </div>
    );
  }

  if (!loading && !project) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-2xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Project Console Unavailable</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Unable to load project workspace. Please ensure you are signed in and have access to this application.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={() => refreshProject()}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const defaultBreadcrumbs = [
    { label: 'Projects', href: '/dashboard' },
    { label: project?.name || 'Project', href: `/apps/${projectId}` },
    { label: title },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex transition-colors duration-200">
      {/* 1. App Dedicated Sidebar */}
      {sidebar}

      {/* 2. Main Viewport Container */}
      <div
        className={`flex-1 ${
          isSidebarExpanded
            ? 'lg:ml-[280px] lg:w-[calc(100%-280px)]'
            : 'lg:ml-[80px] lg:w-[calc(100%-80px)]'
        } flex flex-col min-h-screen transition-all duration-300 ease-in-out`}
      >
        <DeveloperHeader
          onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          activeTabTitle={title}
          userProfile={userProfile}
          breadcrumbs={breadcrumbs || defaultBreadcrumbs}
          onSignOut={() => {
            localStorage.removeItem('platform_auth_token');
            window.location.href = '/';
          }}
        />

        {/* Content Viewport with pb-28 on mobile so bottom nav never overlaps */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 flex-1 pb-28 lg:pb-8">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                  {title}
                </h1>
                {badge && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getBadgeClasses(
                      badgeColor
                    )}`}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Project: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{project?.name}</span>{' '}
                <span className="font-mono text-[10px]">({project?.clientId})</span>
              </p>
            </div>

            {action && <div className="shrink-0">{action}</div>}
          </div>

          {children}
        </main>
      </div>

      {/* 3. Mobile Native Bottom Navigation */}
      {bottomNav}
    </div>
  );
}

export default AppShellLayout;
