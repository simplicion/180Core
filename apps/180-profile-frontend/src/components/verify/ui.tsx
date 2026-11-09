'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost';

const BTN: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25',
  secondary: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25',
  ghost: 'bg-transparent hover:bg-zinc-900 text-zinc-300',
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        BTN[variant],
        className,
      )}
    >
      {loading && <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="text-[10px] text-red-400 mt-1" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[10px] text-zinc-500 mt-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = (invalid?: boolean) =>
  cx(
    'w-full px-3 py-2 rounded-xl bg-zinc-950 border text-sm text-white placeholder:text-zinc-600',
    'focus:outline-none focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500',
    invalid ? 'border-red-500/70' : 'border-zinc-800',
  );

export type ChipTone = 'ok' | 'bad' | 'wait' | 'idle';

export function StatusChip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  const map: Record<ChipTone, string> = {
    ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    bad: 'bg-red-500/10 text-red-400 border-red-500/25',
    wait: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    idle: 'bg-zinc-800/60 text-zinc-400 border-zinc-700',
  };
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? XCircle : tone === 'wait' ? Clock : null;
  return (
    <span className={cx('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', map[tone])}>
      {Icon && <Icon className="w-3 h-3" aria-hidden />}
      {children}
    </span>
  );
}

export function Notice({
  tone = 'warn',
  title,
  children,
  action,
}: {
  tone?: 'warn' | 'error' | 'info' | 'ok';
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const map = {
    warn: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
    error: 'bg-red-500/10 border-red-500/25 text-red-200',
    info: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-200',
    ok: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
  } as const;
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? Clock : AlertTriangle;
  return (
    <div className={cx('p-3 rounded-xl border text-xs flex gap-2', map[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[11px] opacity-90">{children}</div>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3" role="status" aria-live="polite">
      <div className="w-9 h-9 border-2 border-indigo-500 border-t-transparent rounded-full motion-safe:animate-spin" aria-hidden />
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}

export function StepTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
