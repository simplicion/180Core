'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Layers,
  Landmark,
  ArrowDownToLine,
  Receipt,
  Headphones,
  ShieldCheck,
  Search,
  Moon,
  Sun,
  Activity,
  ChevronRight,
  ExternalLink,
  Bell,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { FloatingSupportWidget } from './FloatingSupportWidget';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Executive Pulse', href: '/', icon: LayoutDashboard },
  { name: 'Developer Directory', href: '/developers', icon: Users, badge: 'Roster' },
  { name: 'Global App Fleet', href: '/apps', icon: Layers, badge: 'Fleet' },
  { name: '180 Pay Treasury', href: '/treasury', icon: Landmark },
  {
    name: 'Settlement Desk',
    href: '/payouts',
    icon: ArrowDownToLine,
    badge: 'Desk',
    badgeColor: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  },
  { name: 'Transactions Ledger', href: '/transactions', icon: Receipt },
  {
    name: 'Universal Support Desk',
    href: '/support',
    icon: Headphones,
    badge: 'Live',
    badgeColor: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  },
  { name: 'Security & Audit Logs', href: '/settings', icon: ShieldCheck },
];

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);
  const [pulseData, setPulseData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const currentDark = document.documentElement.classList.contains('dark');
    setIsDark(currentDark);
    fetchPulse();
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const fetchPulse = async () => {
    try {
      setIsRefreshing(true);
      const res = await adminApi.getOverview();
      if (res.success) {
        setPulseData(res.data || res);
      }
    } catch (e) {
      console.error('Failed to load pulse metrics', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('180_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('180_theme', 'light');
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 selection:bg-blue-600 selection:text-white">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              180
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                180 CORE
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Master Governance Console</p>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-xl text-zinc-500 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Pulse Ticker */}
        <div className="px-5 py-3 mx-4 my-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">Core Cluster</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {(pulseData?.totalDevelopers ?? pulseData?.overview?.totalDevelopers) ? `${pulseData?.totalDevelopers ?? pulseData?.overview?.totalDevelopers} Devs Online` : 'Operational'}
          </span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group min-h-[44px] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                      isActive
                        ? 'text-white'
                        : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-zinc-200'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeColor || 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom System Stats & External Portals */}
        <div className="p-4 border-t border-zinc-200 dark:border-white/10 space-y-3">
          <div className="text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Sovereign Treasury</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-white">
              ${((pulseData?.totalGmv ?? pulseData?.overview?.totalGmv) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <a
              href="http://localhost:3008"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors min-h-[40px]"
            >
              <span>Dev Portal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="http://localhost:3009"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors min-h-[40px]"
            >
              <span>180 Identity</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 sticky top-0 z-30 border-b border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between gap-4">
          {/* Mobile Hamburger & Breadcrumb */}
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">180 Core</span>
            {pathname === '/' ? (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
                <span className="font-semibold text-zinc-900 dark:text-white">Executive Pulse</span>
              </>
            ) : pathname.startsWith('/developers') ? (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
                <Link href="/developers" className="hover:text-blue-500 transition-colors">
                  Developers
                </Link>
                {pathname.includes('/projects/') ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
                    <Link
                      href={`/developers/${pathname.split('/')[2]}`}
                      className="hover:text-blue-500 transition-colors"
                    >
                      Developer Profile
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
                    <span className="font-semibold text-zinc-900 dark:text-white">Project Deep-Dive</span>
                  </>
                ) : pathname !== '/developers' ? (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
                    <span className="font-semibold text-zinc-900 dark:text-white">Developer Profile</span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
                <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                  {pathname.replace('/', '').replace(/-/g, ' ')}
                </span>
              </>
            )}
          </div>

          {/* Quick Actions & Header Profile */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPulse}
              title="Refresh Live Telemetry"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            <button
              onClick={toggleTheme}
              title="Toggle Dark / Light Theme"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:border-white/10" />

            <div className="flex items-center gap-2.5 pl-1">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                SA
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white leading-tight">Super Admin</div>
                <div className="text-[10px] text-zinc-500 leading-tight">admin@180core.cloud</div>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport Children Container */}
        <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">{children}</main>
      </div>

      {/* Floating Support Desk Widget */}
      <FloatingSupportWidget />
    </div>
  );
}
