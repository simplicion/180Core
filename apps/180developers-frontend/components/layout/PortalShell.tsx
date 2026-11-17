'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../Navbar';
import Link from 'next/link';

const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://180core.cloud').replace(/\/+$/, '');

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 1. Full-bleed developer console & root redirect (no marketing navbar/footer)
  const isDeveloperConsole =
    pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/apps');
  if (isDeveloperConsole) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  // 2. Documentation Hub: Dedicated full-bleed container with top Navbar
  if (pathname.startsWith('/docs')) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  // 3. Developer Portal Secondary Pages (Billing, Callbacks, etc.)
  return (
    <>
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>

      <footer className="border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-black py-8 text-xs text-zinc-600 dark:text-zinc-500 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-zinc-900 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              180 Core
            </a>
            <span>•</span>
            <a
              href={`${WEBSITE_URL}/products/identity`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              180 Identity
            </a>
            <span>•</span>
            <a
              href={`${WEBSITE_URL}/products/pay`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              180 Pay
            </a>
            <span>•</span>
            <Link
              href="/docs"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Documentation
            </Link>
            <span>•</span>
            <Link
              href="/dashboard"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Console
            </Link>
          </div>
          <div>© {new Date().getFullYear()} 180 Core Platform. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}

export default PortalShell;
