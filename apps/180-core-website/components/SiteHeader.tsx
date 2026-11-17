'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BookOpen, Menu, Shield, CreditCard, Lock, User, X } from 'lucide-react';
import { Button, OneEightyCoreLogo } from '@workspace/ui';
import { ThemeToggle } from './ThemeToggle';
import { developerLink, docsLink, profileLink } from '@/lib/urls';

const NAV_ITEMS = [
  { href: '/identity', label: '180 Identity', icon: Shield },
  { href: '/pay', label: '180 Pay', icon: CreditCard },
  { href: '/security', label: 'Security', icon: Lock },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur-xl transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 group min-h-[44px]"
          onClick={() => setMobileOpen(false)}
        >
          <OneEightyCoreLogo
            variant="compact"
            height={30}
            className="group-hover:scale-[1.03] transition-transform duration-200"
          />
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            Core Cloud
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 min-h-[44px] inline-flex items-center rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-zinc-100 dark:bg-white/10 text-zinc-950 dark:text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <a
            href={docsLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 min-h-[44px] inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-white/5 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Docs</span>
          </a>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild className="h-11 rounded-xl px-4 text-xs font-semibold">
            <a href={profileLink()} target="_blank" rel="noopener noreferrer">
              <User className="h-3.5 w-3.5 mr-1.5" />
              180 Profile
            </a>
          </Button>
          <Button
            size="sm"
            asChild
            className="h-11 rounded-xl px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20"
          >
            <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
              <span>Developer Console</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        </div>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="h-11 w-11 rounded-xl border-zinc-200 dark:border-white/10"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl px-4 py-4 space-y-2 shadow-2xl">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-colors ${
                    active
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <a
              href={docsLink()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <BookOpen className="h-4 w-4" />
              <span>Documentation</span>
            </a>
          </nav>

          <div className="pt-3 mt-2 border-t border-zinc-200 dark:border-white/10 grid grid-cols-1 gap-2">
            <Button variant="outline" asChild className="h-11 rounded-xl w-full text-xs font-semibold">
              <a href={profileLink()} target="_blank" rel="noopener noreferrer">
                <User className="h-3.5 w-3.5 mr-1.5" />
                Open 180 Profile
              </a>
            </Button>
            <Button
              asChild
              className="h-11 rounded-xl w-full text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              <a href={developerLink('/dashboard')} target="_blank" rel="noopener noreferrer">
                <span>Open Developer Console</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
