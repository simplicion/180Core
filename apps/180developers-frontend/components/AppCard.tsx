'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export interface AppCardProps {
  id?: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled?: boolean;
  status?: 'active' | 'disabled' | 'beta' | 'coming_soon';
  statusLabel?: string;
  protocol?: string;
  accentColor?: 'blue' | 'purple' | 'emerald' | 'amber' | 'indigo' | 'rose';
  actionLabel?: string;
  onClick?: () => void;
  href?: string;
  stats?: { label: string; value: string | number }[];
  className?: string;
  children?: React.ReactNode;
}

export function AppCard({
  name,
  description,
  icon: Icon,
  enabled,
  status,
  statusLabel,
  protocol,
  accentColor = 'blue',
  actionLabel = 'Open Dashboard',
  onClick,
  href,
  stats,
  className = '',
  children,
}: AppCardProps) {
  const isEnabled = enabled !== undefined ? enabled : status === 'active';

  // Accent styles map
  const colorMap = {
    blue: {
      activeBorder: 'border-blue-500/40 hover:border-blue-500/70',
      activeBg: 'bg-blue-500/5 hover:bg-blue-500/10',
      iconActive: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
      badgeActive: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      actionText: 'text-blue-600 dark:text-blue-400',
    },
    purple: {
      activeBorder: 'border-purple-500/40 hover:border-purple-500/70',
      activeBg: 'bg-purple-500/5 hover:bg-purple-500/10',
      iconActive: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
      badgeActive: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      actionText: 'text-purple-600 dark:text-purple-400',
    },
    emerald: {
      activeBorder: 'border-emerald-500/40 hover:border-emerald-500/70',
      activeBg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
      iconActive: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      badgeActive: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      actionText: 'text-emerald-600 dark:text-emerald-400',
    },
    amber: {
      activeBorder: 'border-amber-500/40 hover:border-amber-500/70',
      activeBg: 'bg-amber-500/5 hover:bg-amber-500/10',
      iconActive: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
      badgeActive: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      actionText: 'text-amber-600 dark:text-amber-400',
    },
    indigo: {
      activeBorder: 'border-indigo-500/40 hover:border-indigo-500/70',
      activeBg: 'bg-indigo-500/5 hover:bg-indigo-500/10',
      iconActive: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
      badgeActive: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      actionText: 'text-indigo-600 dark:text-indigo-400',
    },
    rose: {
      activeBorder: 'border-rose-500/40 hover:border-rose-500/70',
      activeBg: 'bg-rose-500/5 hover:bg-rose-500/10',
      iconActive: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
      badgeActive: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      actionText: 'text-rose-600 dark:text-rose-400',
    },
  };

  const scheme = colorMap[accentColor] || colorMap.blue;

  const cardContent = (
    <div
      className={`group relative p-6 rounded-3xl border transition-all duration-300 flex flex-col justify-between space-y-5 hover:shadow-lg hover:scale-[1.01] ${
        isEnabled
          ? `${scheme.activeBg} ${scheme.activeBorder} shadow-sm`
          : 'bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200 dark:border-white/10 opacity-75 hover:opacity-100'
      } ${className}`}
    >
      <div className="space-y-3.5">
        {/* Top bar with Icon and Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                isEnabled
                  ? scheme.iconActive
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white tracking-tight flex items-center gap-1.5">
                {name}
              </h3>
              {protocol && (
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {protocol}
                </p>
              )}
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide border uppercase ${
              isEnabled
                ? scheme.badgeActive
                : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-white/5'
            }`}
          >
            {statusLabel || (isEnabled ? 'Active' : 'Disabled')}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-600 dark:text-zinc-300/90 leading-relaxed">
          {description}
        </p>

        {/* Optional Stats */}
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="p-2 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/5 text-[11px]"
              >
                <div className="text-zinc-500 text-[10px] font-medium">{stat.label}</div>
                <div className="font-bold text-zinc-900 dark:text-white mt-0.5">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>

      {/* Card Footer with protocol / action */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-200/80 dark:border-white/5 text-xs">
        <span className="text-[11px] font-medium text-zinc-500">
          {isEnabled ? 'Ready for production' : 'Configuration available'}
        </span>
        <span
          className={`font-semibold text-xs flex items-center gap-1 group-hover:underline ${scheme.actionText}`}
        >
          <span>{actionLabel}</span>
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {cardContent}
      </Link>
    );
  }

  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined} className="cursor-pointer focus:outline-none">
      {cardContent}
    </div>
  );
}

export default AppCard;
