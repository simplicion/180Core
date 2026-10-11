'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} 180 Workspace Inc. Universal Identity &amp; Prepaid Wallet Protocol.</p>
        <div className="flex items-center gap-5">
          <Link href="/profile" className="hover:text-slate-900 transition-colors min-h-[36px] flex items-center">
            Privacy & Security
          </Link>
          <Link href="/transactions" className="hover:text-slate-900 transition-colors min-h-[36px] flex items-center">
            Payment Terms
          </Link>
          <Link href="/connected-apps" className="hover:text-slate-900 transition-colors min-h-[36px] flex items-center">
            Connected Apps
          </Link>
          <a
            href="https://developers.180workspace.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors min-h-[36px] flex items-center"
          >
            Developer API
          </a>
        </div>
      </div>
    </footer>
  );
}
