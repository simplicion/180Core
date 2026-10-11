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
} from 'lucide-react';
import { HelpIcon } from '@workspace/ui';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';

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
    localStorage.removeItem('platform_auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
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
            className="flex items-center gap-3 group min-h-[44px] shrink-0 cursor-pointer"
          >
            <div className="w-9 h-9 min-w-[36px] min-h-[36px] max-w-[36px] max-h-[36px] rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/90 dark:border-zinc-700 shadow-2xs shrink-0 flex items-center justify-center p-1.5 overflow-hidden group-hover:border-slate-300 transition-colors">
              <img
                src="/black-icon.svg"
                alt="180 Logo"
                className="w-full h-full object-contain block dark:hidden group-hover:scale-105 transition-transform"
              />
              <img
                src="/white-icon.svg"
                alt="180 Logo"
                className="w-full h-full object-contain hidden dark:block group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                180 Profile
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                  Universal
                </span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Identity &amp; Universal Wallet</span>
            </div>
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
        <div className="flex items-center gap-2 sm:gap-3">
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
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name || 'User'}
                        className="w-full h-full rounded-full object-cover bg-white"
                      />
                    ) : (
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-blue-700 font-bold text-xs group-hover:bg-blue-50">
                        {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 hidden sm:block ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Popover */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200/90 shadow-xl py-1.5 z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                    {/* User info card */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1.5px] overflow-hidden shrink-0">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover bg-white" />
                        ) : (
                          <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                            {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
                          </div>
                        )}
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
