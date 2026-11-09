'use client';

import React from 'react';
import { ChevronRight, FlaskConical, Lock, ScanLine } from 'lucide-react';
import { cx } from './ui';

export interface StepPill {
  id: string;
  label: string;
}

export function VerifyChrome({
  steps,
  current,
  sandbox,
  appName,
  children,
}: {
  steps: StepPill[];
  current: string | null;
  sandbox: boolean;
  appName?: string | null;
  children: React.ReactNode;
}) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white font-sans flex flex-col">
      <header className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ScanLine className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight">180 Verify</h1>
              <p className="text-[11px] text-zinc-400 truncate">{appName ? `Identity check for ${appName}` : 'Identity verification'}</p>
            </div>
          </div>
          {steps.length > 0 && currentIdx >= 0 && (
            <nav aria-label="Progress" className="hidden min-[400px]:flex items-center gap-1 text-[11px] font-mono text-zinc-400">
              {steps.map((s, i) => (
                <React.Fragment key={s.id}>
                  {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600" aria-hidden />}
                  <span
                    aria-current={i === currentIdx ? 'step' : undefined}
                    className={cx('px-2 py-0.5 rounded-full', i === currentIdx && 'bg-indigo-500/20 text-indigo-300 font-bold', i < currentIdx && 'text-emerald-400')}
                  >
                    {s.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          )}
          {steps.length > 0 && currentIdx >= 0 && (
            <span className="min-[400px]:hidden text-[11px] font-mono text-zinc-400" aria-label={`Step ${currentIdx + 1} of ${steps.length}`}>
              {currentIdx + 1}/{steps.length}
            </span>
          )}
        </div>
      </header>

      {sandbox && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 text-amber-200 text-[11px] font-semibold px-4 py-1.5 flex items-center justify-center gap-1.5" role="note">
          <FlaskConical className="w-3.5 h-3.5" aria-hidden /> Sandbox — test data only
        </div>
      )}

      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-5">{children}</main>

      <footer className="px-4 py-3 border-t border-zinc-900 text-center text-[10px] text-zinc-500 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3 text-zinc-600" aria-hidden />
        <span>Encrypted session · Data used only for this verification (DPDP Act 2023)</span>
      </footer>
    </div>
  );
}
