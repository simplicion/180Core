'use client';
/**
 * 180 Verify — hosted KYC page orchestrator.
 *
 * Flow: session bootstrap → documents (only those requested) → bank (if requested) → live face + active
 * liveness → server decision. All verification decisions are made server-side; this page never marks a
 * step as verified on its own.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { verifyApi, VerifyApiError } from '@/lib/verify/api';
import { planFromDocuments, type RequestPlan } from '@/lib/verify/docTypes';
import {
  isEmbedded,
  isExpired,
  postToParent,
  readBootstrapParams,
  setSessionInUrl,
  storeToken,
  toEpochMs,
} from '@/lib/verify/session';
import type { CompleteResponse, PublicSession } from '@/lib/verify/types';
import { VerifyChrome, type StepPill } from '@/components/verify/VerifyChrome';
import { FatalState, NoSession } from '@/components/verify/SessionStates';
import DocumentStep from '@/components/verify/DocumentStep';
import { emptyDraft, type DocDraft, type DocResult } from '@/components/verify/DocumentForm';
import BankStep, { type BankResult } from '@/components/verify/BankStep';
import LivenessStep from '@/components/verify/LivenessStep';
import ResultScreen from '@/components/verify/ResultScreen';
import { Spinner } from '@/components/verify/ui';

type Step = 'DOCUMENTS' | 'BANK' | 'LIVENESS' | 'RESULTS';
type Boot =
  | { kind: 'init' }
  | { kind: 'no-session' }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'fatal'; code: string; message?: string | null; retry?: boolean };

const TERMINAL = new Set(['APPROVED', 'MANUAL_REVIEW', 'REJECTED', 'COMPLETED']);

export default function VerifyClient() {
  const [boot, setBoot] = useState<Boot>({ kind: 'init' });
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ sessionId: string; token: string } | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [step, setStep] = useState<Step>('DOCUMENTS');
  const [drafts, setDrafts] = useState<Record<string, DocDraft>>({});
  const [docResults, setDocResults] = useState<Record<string, DocResult | null>>({});
  const [bankResult, setBankResult] = useState<BankResult | null>(null);
  const [finalResult, setFinalResult] = useState<CompleteResponse | null>(null);
  const [embedded, setEmbedded] = useState(false);
  const readyPostedRef = useRef(false);

  const parentOrigin = session?.parentOrigin ?? null;
  const plan: RequestPlan = useMemo(() => planFromDocuments(session?.documents), [session?.documents]);

  const fatal = useCallback(
    (code: string, message?: string | null, retry = false) => {
      setBoot({ kind: 'fatal', code, message, retry });
      if (creds && parentOrigin) postToParent(parentOrigin, { type: '180_VERIFY_ERROR', sessionId: creds.sessionId, code });
    },
    [creds, parentOrigin],
  );

  const loadSession = useCallback(async (sessionId: string, token: string) => {
    setBoot({ kind: 'loading' });
    setCreds({ sessionId, token });
    try {
      const s = await verifyApi.getSession(sessionId, token);
      const status = String(s?.status || '').toUpperCase();
      setSession(s);

      if (TERMINAL.has(status)) {
        const r = s.result;
        if (r && ['APPROVED', 'MANUAL_REVIEW', 'REJECTED'].includes(String(r.status))) {
          setFinalResult(r);
          setStep('RESULTS');
          setBoot({ kind: 'ready' });
        } else {
          setBoot({ kind: 'fatal', code: 'SESSION_COMPLETED' });
        }
        return;
      }
      if (status === 'EXPIRED' || isExpired(s.expiresAt)) {
        setBoot({ kind: 'fatal', code: 'SESSION_EXPIRED' });
        if (s.parentOrigin) postToParent(s.parentOrigin, { type: '180_VERIFY_ERROR', sessionId, code: 'SESSION_EXPIRED' });
        return;
      }

      const p = planFromDocuments(s.documents);
      const nextDrafts: Record<string, DocDraft> = {};
      const nextResults: Record<string, DocResult | null> = {};
      for (const d of p.docs) {
        nextDrafts[d.raw] = emptyDraft();
        const st = String(s.steps?.documents?.[d.raw]?.status || '').toUpperCase();
        nextResults[d.raw] = st === 'VERIFIED' ? { status: 'VERIFIED', fromSession: true } : null;
      }
      setDrafts(nextDrafts);
      setDocResults(nextResults);
      const bst = String(s.steps?.bank?.status || '').toUpperCase();
      const nextBank: BankResult | null =
        bst === 'VERIFIED' || bst === 'PENDING'
          ? { status: bst as BankResult['status'], registeredNameMasked: s.steps?.bank?.registeredNameMasked ?? null, nameMatch: null, errors: [] }
          : null;
      setBankResult(nextBank);

      const docsDone = p.docs.every((d) => nextResults[d.raw]?.status === 'VERIFIED');
      setStep(!docsDone ? 'DOCUMENTS' : p.bank && nextBank?.status !== 'VERIFIED' ? 'BANK' : 'LIVENESS');
      setBoot({ kind: 'ready' });

      if (!readyPostedRef.current && s.parentOrigin) {
        readyPostedRef.current = true;
        postToParent(s.parentOrigin, { type: '180_VERIFY_READY', sessionId });
      }
    } catch (err: any) {
      const code = err instanceof VerifyApiError ? err.code : 'NETWORK_ERROR';
      const transient = ['NETWORK_ERROR', 'NETWORK_TIMEOUT', 'REQUEST_FAILED', 'BAD_RESPONSE', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'].includes(code);
      setBoot({ kind: 'fatal', code, message: err?.message, retry: transient });
    }
  }, []);

  // Bootstrap once on mount (client-only: reads location + hash).
  useEffect(() => {
    setEmbedded(isEmbedded());
    const { sessionId, token } = readBootstrapParams();
    if (!sessionId) {
      setBoot({ kind: 'no-session' });
      return;
    }
    if (!token) {
      setBoot({ kind: 'fatal', code: 'INVALID_SESSION_TOKEN' });
      return;
    }
    void loadSession(sessionId, token);
  }, [loadSession]);

  // Esc inside the iframe → ask the host to close the sheet (the parent page can't see this keypress).
  useEffect(() => {
    if (!embedded || !creds || !parentOrigin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      postToParent(parentOrigin, { type: '180_VERIFY_CLOSE', sessionId: creds.sessionId });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [embedded, creds, parentOrigin]);

  // Session expiry while the user is mid-flow.
  useEffect(() => {
    const exp = toEpochMs(session?.expiresAt);
    if (boot.kind !== 'ready' || step === 'RESULTS' || exp === null) return;
    const ms = exp - Date.now();
    if (ms <= 0) {
      fatal('SESSION_EXPIRED');
      return;
    }
    const t = setTimeout(() => fatal('SESSION_EXPIRED'), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [session?.expiresAt, boot.kind, step, fatal]);

  const startDemo = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const { sessionId, sessionToken } = await verifyApi.createDemoSession();
      storeToken(sessionId, sessionToken);
      setSessionInUrl(sessionId);
      await loadSession(sessionId, sessionToken);
    } catch (err: any) {
      setDemoError(
        err instanceof VerifyApiError && err.status === 0
          ? 'Could not reach the verification server. Is the backend running?'
          : err?.message || 'Could not start a sandbox session.',
      );
    } finally {
      setDemoLoading(false);
    }
  };

  const onComplete = (r: CompleteResponse) => {
    setFinalResult(r);
    setStep('RESULTS');
    if (creds) postToParent(parentOrigin, { type: '180_VERIFY_COMPLETE', sessionId: creds.sessionId, status: r.status });
  };

  const onDone = () => {
    if (!creds) return;
    if (embedded) {
      postToParent(parentOrigin, { type: '180_VERIFY_CLOSE', sessionId: creds.sessionId });
    } else {
      try {
        window.close();
      } catch {
        /* not script-opened */
      }
    }
  };

  const pills: StepPill[] = [
    ...(plan.docs.length ? [{ id: 'DOCUMENTS', label: 'Docs' }] : []),
    ...(plan.bank ? [{ id: 'BANK', label: 'Bank' }] : []),
    { id: 'LIVENESS', label: 'Face' },
  ];
  const afterDocs: Step = plan.bank ? 'BANK' : 'LIVENESS';

  let body: React.ReactNode;
  if (boot.kind === 'init' || boot.kind === 'loading') {
    body = <Spinner label="Loading your verification…" />;
  } else if (boot.kind === 'no-session') {
    body = <NoSession onDemo={startDemo} loading={demoLoading} error={demoError} />;
  } else if (boot.kind === 'fatal') {
    body = (
      <FatalState
        code={boot.code}
        message={boot.message}
        onRetry={boot.retry && creds ? () => void loadSession(creds.sessionId, creds.token) : undefined}
      />
    );
  } else if (creds) {
    if (step === 'DOCUMENTS' && plan.docs.length) {
      body = (
        <DocumentStep
          sessionId={creds.sessionId}
          token={creds.token}
          docs={plan.docs}
          drafts={drafts}
          results={docResults}
          onDraftChange={(raw, patch) => setDrafts((d) => ({ ...d, [raw]: { ...(d[raw] ?? emptyDraft()), ...patch } }))}
          onResult={(raw, r) => setDocResults((s) => ({ ...s, [raw]: r }))}
          onFatal={(code) => fatal(code)}
          onContinue={() => setStep(afterDocs)}
          continueLabel={plan.bank ? 'Continue to bank verification' : 'Continue to face check'}
        />
      );
    } else if ((step === 'BANK' || (step === 'DOCUMENTS' && !plan.docs.length)) && plan.bank) {
      body = (
        <BankStep
          sessionId={creds.sessionId}
          token={creds.token}
          result={bankResult}
          onResult={setBankResult}
          onFatal={(code) => fatal(code)}
          onBack={plan.docs.length ? () => setStep('DOCUMENTS') : undefined}
          onContinue={() => setStep('LIVENESS')}
        />
      );
    } else if (step === 'RESULTS' && finalResult) {
      body = <ResultScreen result={finalResult} embedded={embedded} onDone={onDone} />;
    } else {
      body = (
        <LivenessStep
          sessionId={creds.sessionId}
          token={creds.token}
          onComplete={onComplete}
          onFatal={(code) => fatal(code)}
          onBack={plan.bank ? () => setStep('BANK') : plan.docs.length ? () => setStep('DOCUMENTS') : undefined}
        />
      );
    }
  }

  const sandbox = String(session?.environment || '').toLowerCase() === 'sandbox';
  const currentPill = boot.kind === 'ready' && step !== 'RESULTS' ? (step === 'DOCUMENTS' && !plan.docs.length ? (plan.bank ? 'BANK' : 'LIVENESS') : step) : null;

  return (
    <VerifyChrome steps={boot.kind === 'ready' ? pills : []} current={currentPill} sandbox={sandbox} appName={session?.appName}>
      {body}
    </VerifyChrome>
  );
}
