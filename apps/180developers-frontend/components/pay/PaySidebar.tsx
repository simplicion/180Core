'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  BarChart3,
  Landmark,
  Webhook,
  Tag,
  Link2,
  Layers,
  Globe,
  Bot,
  Sliders,
  ChevronLeft,
  ArrowLeft,
  X,
  Code2,
  ExternalLink,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export interface PaySidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function PaySidebar({
  isMobileOpen = false,
  onMobileClose = () => {},
}: PaySidebarProps) {
  const pathname = usePathname();
  const { project, projectId, isSidebarExpanded, setIsSidebarExpanded, payoutBalance } = useProject();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pay_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      } else {
        setIsCollapsed(true);
      }
    } catch (_) {}
  }, []);

  const isExpanded = !isCollapsed || isHovered;

  useEffect(() => {
    setIsSidebarExpanded(isExpanded);
  }, [isExpanded, setIsSidebarExpanded]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('pay_sidebar_collapsed', String(next));
    } catch (_) {}
  };

  const navItems = [
    {
      label: 'Overview & KPIs',
      href: `/apps/${projectId}/pay`,
      icon: BarChart3,
      exact: true,
    },
    {
      label: 'Payouts & Balance',
      href: `/apps/${projectId}/pay/payouts`,
      icon: CreditCard,
      badge: payoutBalance > 0 ? `₹${payoutBalance.toLocaleString()}` : undefined,
    },
    {
      label: 'Webhooks & Dispatcher',
      href: `/apps/${projectId}/pay/webhooks`,
      icon: Webhook,
    },
    {
      label: 'Coupons & Promos',
      href: `/apps/${projectId}/pay/coupons`,
      icon: Tag,
    },
    {
      label: 'Payment Links',
      href: `/apps/${projectId}/pay/links`,
      icon: Link2,
    },
    {
      label: 'Pricing Tables',
      href: `/apps/${projectId}/pay/pricing`,
      icon: Layers,
    },
    {
      label: 'Geo-Pricing & PPP',
      href: `/apps/${projectId}/pay/geo`,
      icon: Globe,
    },
    {
      label: 'Agent Envelopes',
      href: `/apps/${projectId}/pay/agents`,
      icon: Bot,
    },
    {
      label: 'Gateways & Routing',
      href: `/apps/${projectId}/pay/gateways`,
      icon: Sliders,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/95 dark:bg-[#101012] backdrop-blur-xl border-r border-zinc-200/80 dark:border-white/10 select-none overflow-x-hidden">
      {/* 1. App Header */}
      <div className="p-3.5 border-b border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-2 shrink-0 min-h-[64px]">
        {isExpanded ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-white whitespace-nowrap block truncate">
                180 Pay
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Checkout Engine
              </span>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <CreditCard className="w-5 h-5" />
          </div>
        )}

        {isExpanded && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
            title={isCollapsed ? 'Pin Sidebar Expanded' : 'Collapse Sidebar'}
            aria-label="Toggle Sidebar Collapse"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

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

      {/* 2. Parent Project Breadcrumb / Back Link */}
      <div className="px-2.5 pt-3 pb-1 border-b border-zinc-100 dark:border-white/5">
        <Link
          href={`/apps/${projectId}`}
          onClick={onMobileClose}
          className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${
            !isExpanded ? 'justify-center' : ''
          }`}
          title={`Back to ${project?.name || 'Project'}`}
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {isExpanded && <span className="truncate">Back to {project?.name || 'Project'}</span>}
        </Link>
      </div>

      {/* 3. Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 text-xs hidden-scrollbar">
        {isExpanded && (
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
            Payment Console
          </p>
        )}

        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 font-semibold group cursor-pointer min-h-[42px] ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900 border border-transparent'
              } ${!isExpanded ? 'justify-center' : ''}`}
              title={!isExpanded ? item.label : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {isExpanded && <span className="truncate text-left text-xs font-bold">{item.label}</span>}
              </div>

              {isExpanded && item.badge && (
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-1.5 ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 4. Bottom Footer Link */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-white/10 shrink-0">
        <a
          href={getDocsUrl(DOCS_LINKS.PAY_QUICKSTART)}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors ${
            !isExpanded ? 'justify-center' : ''
          }`}
          title="180 Pay Documentation"
        >
          <Code2 className="w-4 h-4 shrink-0 text-purple-500" />
          {isExpanded && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="truncate">Pay Docs</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </div>
          )}
        </a>
      </div>
    </div>
  );

  return (
    <>
      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden lg:block fixed top-0 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-[280px] shadow-2xl' : 'w-[80px]'
        }`}
      >
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default PaySidebar;
