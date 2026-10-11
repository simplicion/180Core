'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  Code2,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  User,
  LogOut,
  ChevronDown,
  Activity,
  Check,
  Copy,
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import toast from 'react-hot-toast';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export interface DeveloperHeaderProps {
  onMobileToggle: () => void;
  activeTabTitle?: string;
  activeTabId?: string;
  onTabChange?: (tab: string) => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onOpenRegisterModal?: () => void;
  userProfile?: {
    name?: string;
    email?: string;
    username?: string;
  } | null;
  onSignOut?: () => void;
  breadcrumbs?: { label: string; href?: string }[];
}

export function DeveloperHeader({
  onMobileToggle,
  activeTabTitle = 'Dashboard',
  activeTabId = 'apps',
  onTabChange,
  searchQuery,
  onSearchChange,
  onOpenRegisterModal,
  userProfile,
  onSignOut,
  breadcrumbs,
}: DeveloperHeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getProfileUrl = () => {
    if (typeof window === 'undefined') return 'http://localhost:3009';
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3009' : 'https://profile.180workspace.com';
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-zinc-200/80 dark:border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors duration-200 shadow-2xs">
      {/* Left Area: Mobile Menu Button & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMobileToggle}
          className="lg:hidden p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
          <Link
            href="/dashboard"
            className="hover:text-zinc-900 dark:hover:text-white transition-colors truncate hidden sm:inline"
          >
            Developer Console
          </Link>
          <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">/</span>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.label}>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-zinc-900 dark:hover:text-white transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-zinc-950 dark:text-white font-bold truncate">
                    {crumb.label}
                  </span>
                )}
                {idx < breadcrumbs.length - 1 && (
                  <span className="text-zinc-300 dark:text-zinc-700">/</span>
                )}
              </React.Fragment>
            ))
          ) : (
            <span className="text-zinc-950 dark:text-white font-bold truncate">
              {activeTabTitle}
            </span>
          )}
        </div>

      </div>

      {/* Right Area: ThemeToggle, User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Account Popover Dropdown */}
        {userProfile && (
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 transition-all cursor-pointer min-h-[40px]"
              title="Account Menu"
              aria-label="Account Menu"
            >
              <span className="text-xs font-bold text-zinc-900 dark:text-white max-w-[90px] truncate hidden md:inline">
                {userProfile.name || 'Developer'}
              </span>
              <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shadow-xs border border-zinc-700/50 dark:border-white/20">
                {userProfile.name?.[0]?.toUpperCase() ||
                  userProfile.email?.[0]?.toUpperCase() ||
                  'D'}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${
                  userMenuOpen ? 'rotate-180 text-zinc-900 dark:text-white' : ''
                }`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#101012] border border-zinc-200 dark:border-white/10 shadow-xl p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="p-3 border-b border-zinc-100 dark:border-white/5 space-y-0.5">
                  <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                    {userProfile.name || 'Developer Account'}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
                    {userProfile.email || 'developer@180workspace.com'}
                  </p>
                  {userProfile.username && (
                    <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      @{userProfile.username}
                    </span>
                  )}
                </div>

                <div className="py-1">
                  <a
                    href={getProfileUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>180 Universal Profile</span>
                    </span>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>

                  <a
                    href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Developer Docs & SDK</span>
                    </span>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                </div>

                {onSignOut && (
                  <div className="pt-1 border-t border-zinc-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default DeveloperHeader;
