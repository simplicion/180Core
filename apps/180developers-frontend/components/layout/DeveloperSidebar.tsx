'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Layers,
  LayoutDashboard,
  CreditCard,
  Code2,
  Webhook,
  FileCode2,
  LogOut,
  X,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export interface DeveloperSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  userProfile?: {
    name?: string;
    email?: string;
    username?: string;
  } | null;
  onSignOut: () => void;
  appCount: number;
  apps?: {
    id: string;
    name: string;
    clientId: string;
    enableAuth?: boolean;
    enablePay?: boolean;
    clientType?: string;
    logoUrl?: string;
  }[];
  currentAppId?: string;
  onOpenRegisterModal?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

interface NavToolItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: 'blue' | 'emerald' | 'purple' | 'amber' | 'zinc';
  isExternal?: boolean;
  href?: string;
}

export function DeveloperSidebar({
  activeTab,
  onTabChange,
  isMobileOpen,
  onMobileClose,
  userProfile,
  onSignOut,
  appCount,
  apps = [],
  currentAppId,
  onOpenRegisterModal,
  onExpandChange,
}: DeveloperSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isInsideAppDetail = pathname.startsWith('/apps');

  // Sidebar collapse & hover states (matching 180workspace platform behavior)
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);

  // Initialize collapse preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dev_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      } else {
        setIsCollapsed(true);
      }
    } catch (_) {}
  }, []);

  const isExpanded = !isCollapsed || isHovered;

  // Notify parent container of expansion change to synchronize viewport margin
  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('dev_sidebar_collapsed', String(next));
    } catch (_) {}
  };

  const isProjectsActive = activeTab === 'apps' || isInsideAppDetail;

  const handleRegisterNewProject = () => {
    if (onOpenRegisterModal) {
      onOpenRegisterModal();
    } else {
      window.dispatchEvent(new CustomEvent('open-register-modal'));
      if (isInsideAppDetail) {
        router.push('/dashboard?tab=apps&register=true');
      } else {
        onTabChange('apps');
      }
    }
    onMobileClose();
  };

  const handleToolClick = (item: NavToolItem) => {
    if (item.isExternal && item.href) {
      if (item.id === 'docs') {
        window.open(getDocsUrl(DOCS_LINKS.CORE_OVERVIEW), '_blank');
      } else {
        router.push(item.href);
      }
      onMobileClose();
      return;
    }

    if (isInsideAppDetail) {
      router.push(`/dashboard?tab=${item.id}`);
    } else {
      onTabChange(item.id);
    }
    onMobileClose();
  };

  const developerTools: NavToolItem[] = [
    {
      id: 'playground',
      label: 'API Playground',
      icon: Code2,
      badge: 'Interactive',
      badgeColor: 'amber',
    },
    {
      id: 'webhooks',
      label: 'Webhook Simulator',
      icon: Webhook,
      badge: 'HMAC-SHA256',
      badgeColor: 'purple',
    },
    {
      id: 'docs',
      label: 'API Docs & SDKs',
      icon: FileCode2,
      isExternal: true,
      href: getDocsUrl(DOCS_LINKS.CORE_OVERVIEW),
    },
  ];

  const getBadgeClasses = (color: NavToolItem['badgeColor'] = 'zinc') => {
    switch (color) {
      case 'blue':
        return 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'emerald':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'purple':
        return 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'amber':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10';
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/95 dark:bg-[#101012] backdrop-blur-xl border-r border-zinc-200/80 dark:border-white/10 select-none overflow-x-hidden">
      {/* 1. Header with Official 180 Logo & Expand/Collapse Toggle */}
      <div className="p-3.5 border-b border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-2 shrink-0 min-h-[64px]">
        {isExpanded ? (
          <>
            <Link
              href="/dashboard"
              onClick={onMobileClose}
              className="flex items-center gap-2.5 p-1 rounded-xl group transition-all min-h-[44px] min-w-0"
            >
              <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <img
                  src="/black-icon.svg"
                  alt="180 Developers"
                  className="w-5 h-5 object-contain dark:invert"
                />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white whitespace-nowrap block">
                  180 Developers
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  Console
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title={isCollapsed ? 'Pin Sidebar Expanded' : 'Collapse Sidebar'}
              aria-label="Toggle Sidebar Collapse"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <Link
            href="/dashboard"
            onClick={onMobileClose}
            className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center mx-auto hover:scale-105 transition-all shadow-xs"
            title="180 Developers"
          >
            <img
              src="/black-icon.svg"
              alt="180 Developers"
              className="w-5 h-5 object-contain dark:invert"
            />
          </Link>
        )}

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Close Navigation"
          aria-label="Close Navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5 text-xs hidden-scrollbar">
        {/* Projects Section with Sub-Dropdown */}
        <div className="space-y-1">
          {isExpanded && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
              Command
            </p>
          )}

          {/* Main "Dashboard" Button & Projects Sub-Dropdown Trigger */}
          <div
            className={`w-full flex items-center justify-between p-1.5 rounded-xl transition-all duration-200 font-semibold group min-h-[44px] ${
              isProjectsActive && pathname === '/dashboard'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900 border border-transparent'
            } ${!isExpanded ? 'justify-center p-2' : ''}`}
          >
            {/* Direct Dashboard Link */}
            <Link
              href="/dashboard"
              onClick={onMobileClose}
              className="flex items-center gap-2.5 min-w-0 flex-1 px-1 py-1 cursor-pointer"
              title={!isExpanded ? 'Dashboard' : undefined}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isProjectsActive && pathname === '/dashboard'
                    ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
              </div>
              {isExpanded && <span className="truncate text-left text-sm font-bold">Dashboard</span>}
            </Link>

            {isExpanded && (
              <div className="flex items-center gap-1.5 shrink-0 pr-1">
                {appCount > 0 && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isProjectsActive && pathname === '/dashboard'
                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    {appCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProjectsOpen(!isProjectsOpen);
                  }}
                  className="p-1 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  title={isProjectsOpen ? 'Collapse Projects List' : 'Expand Projects List'}
                  aria-label="Toggle Projects Dropdown"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isProjectsOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* Sub-menu: Register Project & List of Projects */}
          {isExpanded && isProjectsOpen && (
            <div className="space-y-1 pl-4 pr-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Option 1: Register New Project */}
              <button
                type="button"
                onClick={handleRegisterNewProject}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 transition-colors cursor-pointer min-h-[38px] group"
              >
                <div className="w-5 h-5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
                </div>
                <span className="truncate">Register New Project</span>
              </button>

              {/* Option 2: Registered Projects List */}
              {apps && apps.length > 0 ? (
                <div className="space-y-0.5 pt-1">
                  {apps.map((proj) => {
                    const isSelected =
                      currentAppId === proj.id ||
                      pathname === `/apps/${proj.id}` ||
                      pathname.startsWith(`/apps/${proj.id}/`);
                    return (
                      <Link
                        key={proj.id}
                        href={`/apps/${proj.id}`}
                        onClick={onMobileClose}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[36px] group/item ${
                          isSelected
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-2xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60'
                        }`}
                        title={proj.name}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isSelected
                                ? 'bg-white dark:bg-zinc-950'
                                : 'bg-zinc-300 dark:bg-zinc-600 group-hover/item:bg-zinc-500'
                            }`}
                          />
                          <span className="truncate">{proj.name}</span>
                        </div>

                        {/* Active Apps Under Project Badges */}
                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          {proj.enableAuth && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                                isSelected
                                  ? 'bg-white/20 text-white dark:bg-black/15 dark:text-zinc-950 border-white/20 dark:border-black/20'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                              title="180 Identity Enabled"
                            >
                              Auth
                            </span>
                          )}
                          {proj.enablePay && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                                isSelected
                                  ? 'bg-white/20 text-white dark:bg-black/15 dark:text-zinc-950 border-white/20 dark:border-black/20'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                              title="180 Pay Enabled"
                            >
                              Pay
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-600 italic">
                  No registered projects yet
                </div>
              )}
            </div>
          )}

          {/* Billing & Subscriptions Navigation Link */}
          <Link
            href="/billing"
            onClick={onMobileClose}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 font-semibold group cursor-pointer min-h-[44px] ${
              pathname === '/billing'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900 border border-transparent'
            } ${!isExpanded ? 'justify-center' : ''}`}
            title={!isExpanded ? 'Billing & Plans' : undefined}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  pathname === '/billing'
                    ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800'
                }`}
              >
                <CreditCard className="w-4 h-4" />
              </div>
              {isExpanded && <span className="truncate text-left text-sm font-bold">Billing & Plans</span>}
            </div>

            {isExpanded && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            )}
          </Link>
        </div>

        {/* Developer Tools Section */}
        <div className="space-y-1 pt-2">
          {isExpanded && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
              Developer Tools
            </p>
          )}

          {developerTools.map((item) => {
            const isActive = !item.isExternal && activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleToolClick(item)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 font-semibold group cursor-pointer min-h-[44px] ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900 border border-transparent'
                } ${!isExpanded ? 'justify-center' : ''}`}
                title={!isExpanded ? item.label : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {isExpanded && <span className="truncate text-left">{item.label}</span>}
                </div>

                {isExpanded && (
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {item.badge && (
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getBadgeClasses(
                          item.badgeColor
                        )}`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.isExternal && (
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400 opacity-60" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3. Developer Account Profile Widget */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
        {isExpanded ? (
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/10 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-zinc-700/50 dark:border-white/20">
              {userProfile?.name?.[0]?.toUpperCase() ||
                userProfile?.email?.[0]?.toUpperCase() ||
                'D'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                {userProfile?.name || 'Developer'}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
                {userProfile?.email || '@developer'}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign Out of Developer Console"
              aria-label="Sign Out"
              className="p-2 rounded-xl text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignOut}
            title={userProfile?.name ? `Sign Out (${userProfile.name})` : 'Sign Out'}
            aria-label="Sign Out"
            className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs mx-auto shadow-xs border border-zinc-700/50 dark:border-white/20 hover:opacity-90 transition-opacity cursor-pointer"
          >
            {userProfile?.name?.[0]?.toUpperCase() ||
              userProfile?.email?.[0]?.toUpperCase() ||
              'D'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar with Hover Expand (matching 180workspace) */}
      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 shadow-xs transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-[280px]' : 'w-[80px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden transition-opacity duration-300"
          onClick={onMobileClose}
        >
          <div
            className="w-72 max-w-[85vw] h-full shadow-2xl transition-transform duration-300 animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default DeveloperSidebar;
