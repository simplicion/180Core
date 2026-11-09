'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../Navbar';
import Link from 'next/link';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 1. Full-bleed developer console (no marketing navbar/footer)
  const isDeveloperConsole = pathname.startsWith('/dashboard') || pathname.startsWith('/apps');
  if (isDeveloperConsole) {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  // 2. Main Master Landing Page: Single focused landing page with NO cluttered top navigation
  if (pathname === '/') {
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  // 3. Documentation Hub: Dedicated full-bleed container with top Navbar
  if (pathname.startsWith('/docs')) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  // 4. Standard Product & Marketing Pages (180 Identity, 180 Pay, etc.)
  return (
    <>
      {/* Global Marketing Navigation Bar */}
      <Navbar />

      {/* Page Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-black py-8 text-xs text-zinc-600 dark:text-zinc-500 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-zinc-900 dark:text-zinc-300">
              180 Developers
            </span>
            <span>•</span>
            <Link
              href="/products/identity"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              180 Identity
            </Link>
            <span>•</span>
            <Link
              href="/products/pay"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              180 Pay
            </Link>
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
