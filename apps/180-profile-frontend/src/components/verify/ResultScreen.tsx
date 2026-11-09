'use client';

import React from 'react';
import { CheckCircle2, Clock, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { humanError } from '@/lib/verify/errors';
import type { CompleteResponse } from '@/lib/verify/types';
import { Button, cx } from './ui';

interface Props {
  result: CompleteResponse;
  embedded: boolean;
  onDone: () => void;
}

function pct(v: number | null | undefined) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return `${Math.round(v <= 1 ? v * 100 : v)}%`;
}

export default function ResultScreen({ result, embedded, onDone }: Props) {
  const { status, summary } = result;
  const checks = summary?.checks ?? [];
  const failed = status === 'REJECTED' ? humanError(result.error_code, result.error_message) : null;

  const head =
    status === 'APPROVED'
      ? { Icon: ShieldCheck, tone: 'emerald', title: "You're verified", text: 'Your identity was verified successfully.' }
      : status === 'MANUAL_REVIEW'
        ? { Icon: Clock, tone: 'amber', title: "We're reviewing your details", text: "A specialist will review your verification. You don't need to do anything else right now." }
        : { Icon: ShieldAlert, tone: 'red', title: failed?.title ?? 'Verification was not successful', text: failed?.fix ?? '' };

  const toneCls: Record<string, { card: string; icon: string }> = {
    emerald: { card: 'bg-emerald-950/30 border-emerald-500/30', icon: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    amber: { card: 'bg-amber-950/20 border-amber-500/30', icon: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    red: { card: 'bg-red-950/30 border-red-500/30', icon: 'bg-red-500/15 text-red-400 border-red-500/30' },
  };
  const t = toneCls[head.tone];
  const face = pct(summary?.faceMatchConfidence);
  const live = pct(summary?.livenessScore);

  return (
    <div className="space-y-4" aria-live="polite">
      <div className={cx('p-5 rounded-3xl border text-center space-y-3', t.card)}>
        <div className={cx('w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto', t.icon)}>
          <head.Icon className="w-8 h-8" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{head.title}</h2>
          {head.text && <p className="text-xs text-zinc-300 mt-1">{head.text}</p>}
          {summary?.fullNameMasked && (
            <p className="text-[11px] text-zinc-400 mt-1">
              Name on record: <span className="font-mono text-zinc-200">{summary.fullNameMasked}</span>
            </p>
          )}
          {status === 'REJECTED' && result.error_code && (
            <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
              {result.error_code}
            </span>
          )}
        </div>
      </div>

      {(checks.length > 0 || face || live) && (
        <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
          <h3 className="text-xs font-bold text-zinc-300">What we checked</h3>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-xs">
                {c.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-px" aria-label="Passed" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" aria-label="Failed" />
                )}
                <div className="min-w-0">
                  <p className="text-zinc-200">{c.label}</p>
                  {c.detail && <p className="text-[10px] text-zinc-500">{c.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
          {(face || live) && (
            <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-zinc-400">
              {face && <span className="px-2 py-0.5 rounded bg-zinc-800">Face match {face}</span>}
              {live && <span className="px-2 py-0.5 rounded bg-zinc-800">Liveness {live}</span>}
            </div>
          )}
        </div>
      )}

      <Button className="w-full" variant={status === 'APPROVED' ? 'success' : 'primary'} onClick={onDone}>
        Done
      </Button>
      {!embedded && <p className="text-[11px] text-zinc-500 text-center">You can now close this window and return to the app.</p>}
    </div>
  );
}
