'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Grid,
  Receipt,
  AppWindow,
  User,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Sparkles,
  LifeBuoy,
} from 'lucide-react';
import { HelpIcon } from '@workspace/ui';
import { OneEightyCoreLogo } from './OneEightyCoreLogo';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';
import { purgeAuthSession } from '@/lib/auth';
import { resolveUserAvatar, getFallbackAvatar } from '@/lib/avatar';

interface HeaderProps {
  balance: number | null;
  user: UserProfile | null;
}

export function Header({ balance, user }: HeaderProps) {
  const pathname = usePathname();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on route change or outside click
  useEffect(() => {
    setUserDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [userDropdownOpen]);

  const handleSignOut = () => {
    purgeAuthSession();
    toast.success('Signed out of 180 Profile');
    window.location.href = '/';
  };

  const navItems = [
    { label: 'Overview', href: '/', icon: Grid },
    { label: 'Transactions', href: '/transactions', icon: Receipt },
    { label: 'Connected Apps', href: '/connected-apps', icon: AppWindow },
    { label: 'Profile & Security', href: '/profile', icon: User },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Logo & Platform Name: Always visible across all screen sizes */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group min-h-[44px] shrink-0 cursor-pointer"
          >
            <OneEightyCoreLogo
              variant="compact"
              height={30}
              className="group-hover:scale-105 transition-transform duration-200"
            />
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-md">
              Universal Identity
            </span>
          </Link>

          {/* Breadcrumb: Visible when navigating subpages */}
          {user && pathname !== '/' && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium select-none pl-2 border-l border-slate-200">
              <Link href="/" className="hover:text-blue-600 transition-colors">Overview</Link>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-slate-900">
                {pathname === '/wallet'
                  ? 'Wallet & Balance'
                  : pathname === '/transactions'
                  ? 'Transactions'
                  : pathname === '/connected-apps'
                  ? 'Connected Apps'
                  : pathname === '/profile'
                  ? 'Profile & Security'
                  : 'Dashboard'}
              </span>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Quick Support Trigger Button: Placed in Top Header so it never hides the navigation UI */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('180_OPEN_SUPPORT'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer select-none"
            title="Quick Support"
            aria-label="Open Quick Support"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <LifeBuoy className="w-3 h-3 text-white" />
            </div>
            <span className="hidden sm:inline text-xs font-medium">Support</span>
          </button>

          {user ? (
            <>
              {/* Centralized Help Icon */}
              <HelpIcon slug="180-profile" helpText="180 Profile Docs & Security" className="hidden sm:flex min-h-[38px] min-w-[38px]" />

              {/* User Avatar with Interactive Dropdown Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-blue-400/50 hover:bg-slate-50 transition-all cursor-pointer focus:outline-none group"
                  title="Account Menu"
                  aria-label="User Account Menu"
                  aria-expanded={userDropdownOpen}
                >
                  <div className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1.5px] shadow-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                    <img
                      src={resolveUserAvatar(user)}
                      alt={user.name || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover bg-white"
                      onError={(e) => {
                        const fallback = getFallbackAvatar(user.name || user.username || user.email || 'User');
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                    />
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 hidden sm:block ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Popover */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200/90 shadow-xl py-1.5 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                    {/* User info card */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1.5px] overflow-hidden shrink-0">
                        <img
                          src={resolveUserAvatar(user)}
                          alt={user.name || ''}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-full object-cover bg-white"
                          onError={(e) => {
                            const fallback = getFallbackAvatar(user.name || user.username || user.email || 'User');
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 truncate">{user.name || 'User'}</div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">
                          @{user.username || (user.email ? user.email.split('@')[0] : 'user')}
                        </div>
                      </div>
                    </div>

                    {/* Navigation Options */}
                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-colors"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Profile &amp; Security</span>
                      </Link>

                      <Link
                        href="/transactions"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-colors"
                      >
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <span>Wallet &amp; Transactions</span>
                      </Link>

                      <Link
                        href="/connected-apps"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-colors"
                      >
                        <AppWindow className="w-4 h-4 text-slate-400" />
                        <span>Connected Apps</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          window.dispatchEvent(new Event('180_OPEN_SUPPORT'));
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-purple-600 hover:bg-purple-50/70 transition-colors cursor-pointer text-left"
                      >
                        <LifeBuoy className="w-4 h-4 text-purple-500" />
                        <span>Quick Support</span>
                      </button>
                    </div>

                    {/* Sign Out Button in Dropdown */}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleSignOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50/80 transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center px-4 py-2 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                Sign In with 180
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
