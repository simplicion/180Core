'use client';

import React from 'react';
import { FlaskConical, Link2Off, RefreshCw, ShieldAlert } from 'lucide-react';
import { humanError } from '@/lib/verify/errors';
import { Button, Notice } from './ui';

export function NoSession({ onDemo, loading, error }: { onDemo: () => void; loading: boolean; error: string | null }) {
  return (
    <div className="space-y-5 pt-4">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
          <Link2Off className="w-6 h-6 text-zinc-400" aria-hidden />
        </div>
        <h2 className="text-base font-bold">No verification session</h2>
        <p className="text-xs text-zinc-400">
          Open this page from the app that asked you to verify. Developers can try the full flow with a sandbox session.
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button className="w-full" onClick={onDemo} loading={loading}>
        {!loading && <FlaskConical className="w-4 h-4" aria-hidden />} Start sandbox demo
      </Button>
    </div>
  );
}

export function FatalState({ code, message, onRetry }: { code: string; message?: string | null; onRetry?: () => void }) {
  const h = humanError(code, message);
  return (
    <div className="space-y-4 pt-4 text-center" role="alert">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-6 h-6 text-red-400" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-bold">{h.title}</h2>
        <p className="text-xs text-zinc-400">{h.fix}</p>
        <p className="text-[10px] font-mono text-zinc-600">{code}</p>
      </div>
      {onRetry && h.retryable && (
        <Button variant="secondary" className="w-full" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}
