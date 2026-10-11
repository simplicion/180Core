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
} from 'lucide-react';
import { UserProfile } from '../types';

interface MobileBottomNavProps {
  user: UserProfile | null;
  balance: number | null;
}

export function MobileBottomNav({ user, balance }: MobileBottomNavProps) {
  const pathname = usePathname();

  // If user is not authenticated, don't show the authenticated bottom nav
  if (!user) return null;

  const navItems = [
    {
      label: 'Overview',
      href: '/',
      icon: Grid,
      match: pathname === '/',
    },
    {
      label: 'Wallet',
      href: '/wallet',
      icon: Wallet,
      match: pathname === '/wallet',
      badge: balance !== null ? `₹${balance > 999 ? `${(balance / 1000).toFixed(1)}k` : balance.toFixed(0)}` : undefined,
    },
    {
      label: 'Activity',
      href: '/transactions',
      icon: Receipt,
      match: pathname === '/transactions',
    },
    {
      label: 'Apps',
      href: '/connected-apps',
      icon: AppWindow,
      match: pathname === '/connected-apps',
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: User,
      match: pathname === '/profile' || pathname === '/settings',
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-white/10 shadow-[0_-8px_25px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_25px_rgba(0,0,0,0.4)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors duration-200"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = item.match;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 min-h-[50px] rounded-xl transition-all duration-200 active:scale-92 cursor-pointer ${
                isActive ? 'text-zinc-950 dark:text-white font-bold' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 font-medium'
              }`}
            >
              {/* Active Indicator Bar / Pill on top */}
              {isActive && (
                <div className="absolute top-0 w-8 h-1 rounded-full bg-zinc-950 dark:bg-white shadow-xs animate-in fade-in zoom-in-75 duration-200" />
              )}

              {/* Icon Container with Badge */}
              <div className="relative">
                <div
                  className={`w-9 h-7 rounded-lg flex items-center justify-center transition-all ${
                    isActive ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white' : 'text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>

                {item.badge && !isActive && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[9px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/10 shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] tracking-tight leading-tight mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
