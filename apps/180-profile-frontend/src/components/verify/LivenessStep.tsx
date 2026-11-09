'use client';

import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, RefreshCw, ScanFace, ShieldCheck, Smile, Sun } from 'lucide-react';
import { VerifyApiError, verifyApi } from '@/lib/verify/api';
import { humanError } from '@/lib/verify/errors';
import type { CapturedFrame, CompleteBody, CompleteResponse, LivenessChallenge } from '@/lib/verify/types';
import LivenessCamera, { type LivenessAbort } from './LivenessCamera';
import { FATAL_CODES } from './DocumentStep';
import { Button, Notice, Spinner, StepTitle } from './ui';

interface Props {
  sessionId: string;
  token: string;
  onComplete: (r: CompleteResponse) => void;
  onFatal: (code: string) => void;
  onBack?: () => void;
}

type Phase = 'intro' | 'fetching' | 'running' | 'submitting' | 'error';

const ABORT_TEXT: Record<LivenessAbort, string> = {
  FACE_LOST: "We lost sight of your face, so we've restarted the face check. Keep your face in the oval.",
  MULTIPLE_FACES: "We saw more than one face, so we've restarted. Make sure only you are in view.",
  EXPIRED: "Time ran out, so we've started a fresh face check.",
};
const MAX_AUTO_RESTARTS = 3;
const RETRYABLE_SUBMIT = new Set(['BIOMETRICS_ENGINE_UNAVAILABLE', 'PROVIDER_UNAVAILABLE', 'NETWORK_ERROR', 'NETWORK_TIMEOUT', 'RATE_LIMITED']);

export default function LivenessStep({ sessionId, token, onComplete, onFatal, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [challenge, setChallenge] = useState<LivenessChallenge | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; text: string; canResubmit: boolean } | null>(null);
  const restartsRef = useRef(0);
  const pendingRef = useRef<CompleteBody | null>(null);

  const fail = (err: any, canResubmit: boolean) => {
    const code = err instanceof VerifyApiError ? err.code : 'NETWORK_ERROR';
    if (FATAL_CODES.has(code)) {
      onFatal(code);
      return;
    }
    const h = humanError(code, err?.message);
    setError({ code, text: `${h.title}. ${h.fix}`, canResubmit: canResubmit && RETRYABLE_SUBMIT.has(code) });
    setPhase('error');
  };

  const fetchChallenge = async () => {
    setPhase('fetching');
    setError(null);
    pendingRef.current = null;
    try {
      const c = await verifyApi.createChallenge(sessionId, token);
      if (!c?.challengeId || !Array.isArray(c.steps)) throw new VerifyApiError(200, 'BAD_RESPONSE', 'Unexpected response from the server.');
      setChallenge(c);
      setPhase('running');
    } catch (err) {
      fail(err, false);
    }
  };

  const start = () => {
    restartsRef.current = 0;
    setNotice(null);
    void fetchChallenge();
  };

  const onAbort = (reason: LivenessAbort) => {
    restartsRef.current += 1;
    setNotice(ABORT_TEXT[reason]);
    if (restartsRef.current > MAX_AUTO_RESTARTS) {
      setChallenge(null);
      setPhase('intro');
      return;
    }
    void fetchChallenge();
  };

  const submit = async (body: CompleteBody) => {
    pendingRef.current = body;
    setPhase('submitting');
    setError(null);
    try {
      const res = await verifyApi.complete(sessionId, token, body);
      const status = String(res?.status || '').toUpperCase();
      if (status === 'APPROVED' || status === 'MANUAL_REVIEW' || status === 'REJECTED') {
        pendingRef.current = null;
        onComplete({ ...res, status: status as CompleteResponse['status'] });
        return;
      }
      throw new VerifyApiError(422, res?.error_code || 'BAD_RESPONSE', res?.error_message || 'Unexpected response from the server.');
    } catch (err: any) {
      if (err instanceof VerifyApiError && err.code === 'CHALLENGE_EXPIRED') {
        setNotice(ABORT_TEXT.EXPIRED);
        void fetchChallenge();
        return;
      }
      fail(err, true);
    }
  };

  const onFinished = (selfie: string, frames: CapturedFrame[]) => {
    if (!challenge) return;
    setNotice(null);
    void submit({ challengeId: challenge.challengeId, selfie, frames });
  };

  return (
    <div className="space-y-4">
      <StepTitle title="Live face check" subtitle="We confirm you're a real person and match your face to your ID photo." />

      {notice && phase !== 'intro' && <Notice tone="warn">{notice}</Notice>}

      {phase === 'intro' && (
        <div className="space-y-4">
          {notice && <Notice tone="warn">{notice}</Notice>}
          <ul className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 text-[11px] text-zinc-300">
            <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex gap-2">
              <Sun className="w-4 h-4 text-amber-300 shrink-0" aria-hidden /> Face a light source; avoid bright windows behind you.
            </li>
            <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex gap-2">
              <ScanFace className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden /> Remove sunglasses, masks or caps.
            </li>
            <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex gap-2">
              <Eye className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden /> Follow the prompts: blink, smile or turn
              <span className="inline-flex gap-0.5" aria-hidden>
                <ArrowLeft className="w-3.5 h-3.5" />
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </li>
            <li className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex gap-2">
              <Smile className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden /> Only you should be in view.
            </li>
          </ul>
          <div className="flex gap-2">
            {onBack && (
              <Button variant="secondary" className="w-1/3" onClick={onBack}>
                Back
              </Button>
            )}
            <Button className="flex-1" onClick={start}>
              <ShieldCheck className="w-4 h-4" aria-hidden /> Start face check
            </Button>
          </div>
          <p className="text-[10px] text-zinc-500 text-center">Your camera turns on only during this step.</p>
        </div>
      )}

      {phase === 'fetching' && <Spinner label="Preparing your face check…" />}

      {phase === 'running' && challenge && (
        <LivenessCamera key={challenge.challengeId} challenge={challenge} onFinished={onFinished} onAbort={onAbort} />
      )}

      {phase === 'submitting' && <Spinner label="Matching your face and finishing verification…" />}

      {phase === 'error' && error && (
        <Notice
          tone="error"
          title="We couldn't finish the face check"
          action={
            <div className="flex flex-wrap gap-2">
              {error.canResubmit && pendingRef.current && (
                <Button onClick={() => pendingRef.current && submit(pendingRef.current)}>
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Retry
                </Button>
              )}
              <Button variant="secondary" onClick={start}>
                Start face check again
              </Button>
            </div>
          }
        >
          {error.text}
        </Notice>
      )}
    </div>
  );
}
