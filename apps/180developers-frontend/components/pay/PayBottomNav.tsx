'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Receipt,
  CreditCard,
  Webhook,
  MoreHorizontal,
  X,
  Tag,
  Link2,
  Layers,
  Globe,
  Bot,
  Sliders,
  Landmark,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export function PayBottomNav() {
  const pathname = usePathname();
  const { projectId } = useProject();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentHash, setCurrentHash] = useState('');

  React.useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined') {
        setCurrentHash(window.location.hash);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const mainItems = [
    {
      label: 'Overview',
      href: `/apps/${projectId}/pay`,
      icon: BarChart3,
      exact: true,
    },
    {
      label: 'Activity',
      href: `/apps/${projectId}/pay#transactions`,
      icon: Receipt,
    },
    {
      label: 'Payouts',
      href: `/apps/${projectId}/pay/payouts`,
      icon: CreditCard,
    },
    {
      label: 'Webhooks',
      href: `/apps/${projectId}/pay/webhooks`,
      icon: Webhook,
    },
  ];

  const moreItems = [
    { label: 'Coupons & Promos', href: `/apps/${projectId}/pay/coupons`, icon: Tag },
    { label: 'Payment Links', href: `/apps/${projectId}/pay/links`, icon: Link2 },
    { label: 'Pricing Tables', href: `/apps/${projectId}/pay/pricing`, icon: Layers },
    { label: 'Geo-Pricing & PPP', href: `/apps/${projectId}/pay/geo`, icon: Globe },
    { label: 'Agent Envelopes', href: `/apps/${projectId}/pay/agents`, icon: Bot },
    { label: 'Gateways & Routing', href: `/apps/${projectId}/pay/gateways`, icon: Sliders },
  ];

  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* Mobile More Sheet */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setShowMoreMenu(false)}
          />
          <div className="relative bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10 rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 z-10 pb-24">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
              <span className="font-bold text-sm text-zinc-950 dark:text-white">
                180 Pay Capabilities
              </span>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMoreMenu(false)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-transparent shadow-xs'
                        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Nav Bar */}
      <nav
        aria-label="180 Pay Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#101012]/95 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 shadow-lg px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
          {mainItems.map((item) => {
            const isActivity = item.href.includes('#transactions');
            const isOverview = item.exact;
            const isPayOverviewPath = pathname === `/apps/${projectId}/pay`;

            let isActive = false;
            if (isActivity) {
              isActive = isPayOverviewPath && currentHash === '#transactions';
            } else if (isOverview) {
              isActive = isPayOverviewPath && currentHash !== '#transactions';
            } else {
              isActive = pathname.startsWith(item.href);
            }

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (isActivity) {
                    if (isPayOverviewPath) {
                      e.preventDefault();
                      const el = document.getElementById('transactions');
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                        window.history.replaceState(null, '', `/apps/${projectId}/pay#transactions`);
                        setCurrentHash('#transactions');
                      }
                    }
                  } else if (isOverview && isPayOverviewPath) {
                    if (currentHash === '#transactions') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      window.history.replaceState(null, '', `/apps/${projectId}/pay`);
                      setCurrentHash('');
                    }
                  }
                }}
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

          {/* More trigger */}
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-1 min-h-[48px] rounded-xl transition-all duration-200 cursor-pointer ${
              isMoreActive || showMoreMenu
                ? 'text-zinc-950 dark:text-white font-bold'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
            }`}
          >
            {isMoreActive && (
              <div className="absolute top-0 w-8 h-1 rounded-full bg-zinc-900 dark:bg-white shadow-xs" />
            )}
            <MoreHorizontal className="w-4 h-4 mb-1" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default PayBottomNav;
