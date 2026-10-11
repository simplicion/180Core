import React from 'react';
import Link from 'next/link';
import { Terminal, Code2, ArrowLeft, Home, BookOpen, ExternalLink } from 'lucide-react';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-center space-y-6 shadow-xl dark:shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-zinc-900 border border-blue-100 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
          <Terminal className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 tracking-widest uppercase">
            404 Error • Endpoint Not Found
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Developer Resource Not Found
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            The documentation page, application ID, or endpoint requested does not exist or has been relocated.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <Link
            href="/"
            className="w-full py-3 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Applications Dashboard</span>
          </Link>

          <a
            href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 min-h-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Integration Guides & SDK Docs</span>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 ml-1" />
          </a>

          <a
            href="https://profile.180workspace.com"
            className="w-full py-3 min-h-[44px] rounded-xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-white/5 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-purple-500" />
            <span>Switch to 180 Profile</span>
          </a>
        </div>
      </div>
    </div>
  );
}
