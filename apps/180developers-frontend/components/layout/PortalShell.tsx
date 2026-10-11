'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '../Navbar';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDeveloperConsole =
    pathname.startsWith('/dashboard') || pathname.startsWith('/apps');

  if (isDeveloperConsole) {
    // Render full-bleed developer console without marketing navbar/footer
    return <div className="min-h-screen flex flex-col">{children}</div>;
  }

  // Render standard marketing layout for public pages
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
            <a
              href="/products/identity"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              180 Identity
            </a>
            <span>•</span>
            <a
              href="/products/pay"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              180 Pay
            </a>
            <span>•</span>
            <a
              href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Documentation
            </a>
          </div>
          <div>© {new Date().getFullYear()} 180 Developers. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}

export default PortalShell;
