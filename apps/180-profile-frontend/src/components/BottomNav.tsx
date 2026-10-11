'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Receipt, AppWindow, User } from 'lucide-react';

interface BottomNavProps {
  user: any;
}

export function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();

  if (!user) return null;

  const items = [
    { label: 'Overview', href: '/', icon: LayoutGrid },
    { label: 'Wallet', href: '/transactions', icon: Receipt },
    { label: 'Apps', href: '/connected-apps', icon: AppWindow },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-bottom"
    >
      <div className="grid grid-cols-4 h-15 max-w-md mx-auto px-2">
        {items.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-all py-1 rounded-xl select-none ${
                isActive
                  ? 'text-blue-600 font-bold scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 shadow-2xs'
                    : 'text-slate-400'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] tracking-tight leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
