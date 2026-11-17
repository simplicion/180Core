'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Home, RefreshCw } from 'lucide-react';
import { Button } from '@workspace/ui';
import { docsLink } from '@/lib/urls';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center space-y-6"
    >
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-mono font-bold text-rose-500">
        UNEXPECTED ERROR
      </span>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
        Something went wrong while rendering this page.
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {error?.message || 'An unexpected client error occurred.'}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button
          type="button"
          onClick={() => reset()}
          className="h-11 rounded-xl px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          <span>Try Again</span>
        </Button>
        <Button variant="outline" asChild className="h-11 rounded-xl px-5 text-xs font-semibold">
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            <span>Return Home</span>
          </Link>
        </Button>
        <Button variant="ghost" asChild className="h-11 rounded-xl px-5 text-xs font-semibold">
          <a href={docsLink()} target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-4 w-4 mr-2" />
            <span>Help &amp; Docs</span>
          </a>
        </Button>
      </div>
    </section>
  );
}
