'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCw, Home, BookOpen, ExternalLink } from 'lucide-react';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('180 Developers Frontend Error:', error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-[70vh] flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-center space-y-6 shadow-xl dark:shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 tracking-widest uppercase">
            Developer Runtime Exception
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Portal Rendering Error
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {error?.message || 'An unexpected error occurred while communicating with 180 Developer Services.'}
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span>Reload & Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full py-3 min-h-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Applications</span>
          </Link>

          <a
            href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 min-h-[44px] rounded-xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-white/5 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>View Documentation</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
}
