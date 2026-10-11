'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Users, Activity, Lock, Webhook } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export function IdentityBottomNav() {
  const pathname = usePathname();
  const { projectId } = useProject();

  const navItems = [
    {
      label: 'Overview',
      href: `/apps/${projectId}/identity`,
      icon: Shield,
      exact: true,
    },
    {
      label: 'Users',
      href: `/apps/${projectId}/identity/users`,
      icon: Users,
    },
    {
      label: 'Logs',
      href: `/apps/${projectId}/identity/logs`,
      icon: Activity,
    },
    {
      label: 'Security',
      href: `/apps/${projectId}/identity/security`,
      icon: Lock,
    },
    {
      label: 'Webhooks',
      href: `/apps/${projectId}/identity/webhooks`,
      icon: Webhook,
    },
  ];

  return (
    <nav
      aria-label="Identity Mobile Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-[#101012]/95 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 shadow-lg px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 min-h-[48px] rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'text-zinc-950 dark:text-white font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 w-8 h-1 rounded-full bg-zinc-900 dark:bg-white shadow-xs animate-in fade-in zoom-in-75 duration-200" />
              )}
              <Icon className="w-4 h-4 mb-1" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default IdentityBottomNav;
