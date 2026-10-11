'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Grid,
  Receipt,
  AppWindow,
  User,
  Wallet,
  ShieldCheck,
  ExternalLink,
  LogOut,
  ChevronRight,
  Plus,
  Code2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';

interface DesktopSidebarProps {
  user: UserProfile | null;
  balance: number | null;
}

export function DesktopSidebar({ user, balance }: DesktopSidebarProps) {
  const pathname = usePathname();

  const handleSignOut = () => {
    localStorage.removeItem('platform_auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    toast.success('Signed out of 180 Profile');
    window.location.href = '/';
  };

  const navItems = [
    { label: 'Overview', href: '/', icon: Grid, description: 'Profile & Passport' },
    {
      label: 'Wallet & Balance',
      href: '/wallet',
      icon: Wallet,
      description: 'Prepaid 180 Ledger',
      badge: balance !== null ? `₹${balance.toFixed(2)}` : '₹0.00',
    },
    { label: 'Transactions', href: '/transactions', icon: Receipt, description: 'History & Invoices' },
    { label: 'Connected Apps', href: '/connected-apps', icon: AppWindow, description: 'OAuth 2.0 Clients' },
    { label: 'Profile & Security', href: '/profile', icon: User, description: 'Identity & Keys' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-black/95 backdrop-blur-xl h-screen sticky top-0 z-30 select-none transition-colors duration-200">
      {/* 1. Brand Header */}
      <div className="p-5 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group min-h-[44px]">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center p-1.5 shadow-xs shrink-0 group-hover:scale-105 transition-all">
            <img
              src="/black-icon.svg"
              alt="180 Profile"
              className="w-5 h-5 object-contain block dark:hidden"
            />
            <img
              src="/white-icon.svg"
              alt="180 Profile"
              className="w-5 h-5 object-contain hidden dark:block"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              180 Profile
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 rounded-md">
                Universal
              </span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Universal Identity Protocol</span>
          </div>
        </Link>
      </div>

      {/* 2. User Passport Mini Card */}
      {user && (
        <div className="p-4 mx-3 mt-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-white/10 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-white/10 p-0.5 shadow-xs shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name || 'User'} className="w-full h-full rounded-2xl object-cover bg-white dark:bg-zinc-900" />
              ) : (
                <div className="w-full h-full bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-zinc-950 font-extrabold text-sm">
                  {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{user.name || 'Universal User'}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                @{user.username || (user.email ? user.email.split('@')[0] : 'user')}
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
              Verified Universal ID
            </span>
            <span className="text-slate-500 dark:text-zinc-400 font-mono text-[10px]">OAuth 2.0</span>
          </div>
        </div>
      )}

      {/* 3. Main Navigation Items */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
          Platform Menu
        </div>
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href ||
                (item.href === '/transactions' && pathname === '/wallet') ||
                (item.href === '/wallet' && pathname === '/wallet') ||
                (item.href === '/profile' && pathname === '/settings');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-black/20 dark:text-zinc-950'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-slate-200/80 dark:group-hover:bg-zinc-700 group-hover:text-slate-900 dark:group-hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="leading-tight">{item.label}</div>
                </div>
              </div>

              {item.badge ? (
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white dark:bg-black/15 dark:text-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10'
                  }`}
                >
                  {item.badge}
                </span>
              ) : (
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                    isActive ? 'text-white/70 dark:text-zinc-950/70' : 'text-slate-400 dark:text-zinc-500'
                  }`}
                />
              )}
            </Link>
          );
        })}

        {/* 4. Quick Balance & Top-Up Card */}
        <div className="pt-4 px-1">
          <div className="p-3.5 rounded-2xl bg-zinc-900 dark:bg-zinc-950 text-white border border-zinc-800 dark:border-white/10 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                <span>Prepaid Balance</span>
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                1-Click Ready
              </span>
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-white">
                ₹{balance !== null ? balance.toFixed(2) : '0.00'}
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Prepaid wallet shared across 180 ecosystem</p>
            </div>
            <Link
              href="/wallet"
              className="w-full py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Top Up Balance</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 5. Footer & Sign Out */}
      <div className="p-3 border-t border-slate-200/70 dark:border-white/10 space-y-1">
        <a
          href="https://developers.180workspace.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-purple-500" />
            <span>Developer API Portal</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
        </a>

        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}

export default DesktopSidebar;
