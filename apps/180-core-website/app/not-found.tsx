import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Home } from 'lucide-react';
import { Button } from '@workspace/ui';
import { docsLink } from '@/lib/urls';

export default function NotFound() {
  return (
    <section
      role="alert"
      aria-live="polite"
      className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center space-y-6"
    >
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-200/70 dark:bg-white/10 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
        404 · PAGE NOT FOUND
      </span>
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 dark:text-white">
        This route does not exist on 180 Core.
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Return to the home page or jump straight to the 180 Core documentation hub.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button asChild className="h-11 rounded-xl px-5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            <span>Return Home</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-11 rounded-xl px-5 text-xs font-semibold">
          <a href={docsLink()} target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-4 w-4 mr-2" />
            <span>Documentation Hub</span>
          </a>
        </Button>
        <Button variant="ghost" asChild className="h-11 rounded-xl px-5 text-xs font-semibold">
          <Link href="/identity">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>Explore Products</span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
