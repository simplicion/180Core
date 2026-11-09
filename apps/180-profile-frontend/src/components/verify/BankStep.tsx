'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronRight, RefreshCw } from 'lucide-react';
import { ACCOUNT_RE, IFSC_RE, VPA_RE } from '@/lib/verify/docTypes';
import { VerifyApiError, verifyApi } from '@/lib/verify/api';
import { humanError } from '@/lib/verify/errors';
import type { BankSubmitBody, BankSubmitResponse } from '@/lib/verify/types';
import { FATAL_CODES } from './DocumentStep';
import { Button, Field, Notice, StatusChip, StepTitle, cx, inputClass } from './ui';

export type BankResult = Pick<BankSubmitResponse, 'status' | 'registeredNameMasked' | 'nameMatch' | 'errors'>;

interface Props {
  sessionId: string;
  token: string;
  result: BankResult | null;
  onResult: (r: BankResult) => void;
  onFatal: (code: string) => void;
  onBack?: () => void;
  onContinue: () => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 60000;

export default function BankStep({ sessionId, token, result, onResult, onFatal, onBack, onContinue }: Props) {
  const [mode, setMode] = useState<'UPI' | 'ACCOUNT'>('UPI');
  const [vpa, setVpa] = useState('');
  const [account, setAccount] = useState('');
  const [account2, setAccount2] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    // Resuming a session whose bank check is still pending → keep polling.
    if (result?.status === 'PENDING') void poll();
    return () => {
      if (pollRef.current) pollRef.current.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errs: Record<string, string> = {};
  if (touched) {
    if (mode === 'UPI') {
      if (!VPA_RE.test(vpa.trim())) errs.vpa = 'Enter a UPI ID like name@bank';
    } else {
      if (!ACCOUNT_RE.test(account)) errs.account = 'Account number must be 9–18 digits';
      else if (account !== account2) errs.account2 = 'Account numbers do not match';
      if (!IFSC_RE.test(ifsc)) errs.ifsc = 'IFSC must look like HDFC0001234';
    }
  }

  const poll = async () => {
    if (pollRef.current) pollRef.current.cancelled = true;
    const token$ = { cancelled: false };
    pollRef.current = token$;
    setPolling(true);
    setPollTimedOut(false);
    const started = Date.now();
    try {
      while (!token$.cancelled && Date.now() - started < POLL_MAX_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (token$.cancelled) return;
        try {
          const s = await verifyApi.getSession(sessionId, token);
          const b = s.steps?.bank;
          const st = String(b?.status || '').toUpperCase();
          if (st === 'VERIFIED' || st === 'REJECTED') {
            onResult({ status: st as BankResult['status'], registeredNameMasked: b?.registeredNameMasked ?? null, nameMatch: null, errors: [] });
            return;
          }
        } catch (err: any) {
          if (err instanceof VerifyApiError && FATAL_CODES.has(err.code)) {
            onFatal(err.code);
            return;
          }
          // transient — keep polling
        }
      }
      if (!token$.cancelled) setPollTimedOut(true);
    } finally {
      if (!token$.cancelled) setPolling(false);
    }
  };

  const submit = async () => {
    setTouched(true);
    const body: BankSubmitBody =
      mode === 'UPI' ? { mode: 'UPI', vpa: vpa.trim() } : { mode: 'ACCOUNT', accountNumber: account, ifsc: ifsc.trim().toUpperCase() };
    const invalid =
      mode === 'UPI' ? !VPA_RE.test(vpa.trim()) : !ACCOUNT_RE.test(account) || account !== account2 || !IFSC_RE.test(ifsc);
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verifyApi.submitBank(sessionId, token, body);
      const st = String(res?.status || '').toUpperCase();
      if (st !== 'VERIFIED' && st !== 'REJECTED' && st !== 'PENDING') {
        throw new VerifyApiError(200, 'BAD_RESPONSE', 'Unexpected response from the server.');
      }
      onResult({ status: st as BankResult['status'], registeredNameMasked: res.registeredNameMasked ?? null, nameMatch: res.nameMatch ?? null, errors: res.errors ?? [] });
      if (st === 'PENDING') void poll();
    } catch (err: any) {
      // Never mark verified on error.
      const code = err instanceof VerifyApiError ? err.code : 'NETWORK_ERROR';
      if (FATAL_CODES.has(code)) {
        onFatal(code);
        return;
      }
      const h = humanError(code, err?.message);
      setError(`${h.title}. ${h.fix}`);
    } finally {
      setBusy(false);
    }
  };

  const verified = result?.status === 'VERIFIED';
  const pending = result?.status === 'PENDING';
  const rejected = result?.status === 'REJECTED';
  const tabs: Array<{ id: 'UPI' | 'ACCOUNT'; label: string }> = [
    { id: 'UPI', label: 'UPI ID' },
    { id: 'ACCOUNT', label: 'Account + IFSC' },
  ];

  return (
    <div className="space-y-4">
      <StepTitle title="Verify your bank account" subtitle="We confirm the account holder name matches your documents. No money is debited from you." />

      {verified ? (
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" aria-hidden /> Bank account
            </span>
            <StatusChip tone="ok">Verified</StatusChip>
          </div>
          {result?.registeredNameMasked && (
            <p className="text-[11px] text-zinc-400">
              Account holder: <span className="font-mono text-zinc-200">{result.registeredNameMasked}</span>
            </p>
          )}
          {result?.nameMatch && (
            <StatusChip tone={result.nameMatch.passed ? 'ok' : 'bad'}>
              Name match {Math.round(result.nameMatch.score <= 1 ? result.nameMatch.score * 100 : result.nameMatch.score)}%
            </StatusChip>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800" role="tablist" aria-label="Bank verification method">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={mode === t.id}
                disabled={busy || polling}
                onClick={() => {
                  setMode(t.id);
                  setTouched(false);
                }}
                className={cx(
                  'flex-1 min-h-[40px] py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                  mode === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            {mode === 'UPI' ? (
              <Field id="bank-vpa" label="UPI ID" error={errs.vpa} hint="Checked in real time with NPCI.">
                <input
                  id="bank-vpa"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value.replace(/\s/g, ''))}
                  aria-invalid={!!errs.vpa}
                  className={`${inputClass(!!errs.vpa)} font-mono`}
                  placeholder="name@bank"
                />
              </Field>
            ) : (
              <>
                <Field id="bank-acc" label="Account number" error={errs.account}>
                  <input
                    id="bank-acc"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={18}
                    value={account}
                    onChange={(e) => setAccount(e.target.value.replace(/[^0-9]/g, ''))}
                    aria-invalid={!!errs.account}
                    className={`${inputClass(!!errs.account)} font-mono`}
                  />
                </Field>
                <Field id="bank-acc2" label="Confirm account number" error={errs.account2}>
                  <input
                    id="bank-acc2"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={18}
                    value={account2}
                    onChange={(e) => setAccount2(e.target.value.replace(/[^0-9]/g, ''))}
                    aria-invalid={!!errs.account2}
                    className={`${inputClass(!!errs.account2)} font-mono`}
                  />
                </Field>
                <Field id="bank-ifsc" label="IFSC code" error={errs.ifsc}>
                  <input
                    id="bank-ifsc"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={11}
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    aria-invalid={!!errs.ifsc}
                    className={`${inputClass(!!errs.ifsc)} font-mono`}
                    placeholder="HDFC0001234"
                  />
                </Field>
              </>
            )}

            {rejected && (
              <Notice tone="error" title="Bank verification failed">
                <ul className="list-disc pl-4 space-y-1">
                  {(result?.errors?.length ? result.errors : [{ code: 'BANK_ACCOUNT_INVALID', message: '' }]).map((e, i) => {
                    const h = humanError(e.code, e.message);
                    return (
                      <li key={i}>
                        {h.title}. <span className="opacity-80">{h.fix}</span>
                      </li>
                    );
                  })}
                </ul>
              </Notice>
            )}

            {pending && (
              <Notice tone="info" title={pollTimedOut ? 'Your bank is taking longer than usual' : 'Waiting for your bank to confirm…'}>
                {pollTimedOut ? (
                  <Button variant="secondary" onClick={() => void poll()}>
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Check again
                  </Button>
                ) : (
                  'This usually takes a few seconds.'
                )}
              </Notice>
            )}

            {error && <Notice tone="error">{error}</Notice>}

            <Button className="w-full" variant="secondary" onClick={submit} loading={busy || (pending && polling)} disabled={pending && polling}>
              {!busy && <Building2 className="w-3.5 h-3.5" aria-hidden />}
              {busy ? 'Checking with bank…' : rejected ? 'Try again' : 'Verify bank account'}
            </Button>
          </div>
        </>
      )}

      <div className="flex gap-2">
        {onBack && (
          <Button variant="secondary" className="w-1/3" onClick={onBack}>
            Back
          </Button>
        )}
        <Button className="flex-1" disabled={!verified} onClick={onContinue}>
          {verified ? 'Continue to face check' : 'Verify bank to continue'}
          {verified && <ChevronRight className="w-4 h-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
