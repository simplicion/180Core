'use client';

import React, { useId, useState } from 'react';
import { Calendar, Camera, CheckCircle2, EyeOff, FileText, RefreshCw, ShieldCheck, User } from 'lucide-react';
import {
  DOC_CONFIG,
  cleanDocNumber,
  maskAadhaar,
  validateDob,
  validateDocNumber,
  validateName,
  type RequestedDoc,
} from '@/lib/verify/docTypes';
import type { DocumentSubmitResponse } from '@/lib/verify/types';
import { humanError } from '@/lib/verify/errors';
import DocumentScanner, { type ScanResult } from './DocumentScanner';
import { Button, Field, Notice, StatusChip, inputClass } from './ui';

export interface DocDraft {
  number: string;
  name: string;
  dob: string;
  fatherName: string;
  gender: string;
  image: string | null;
  faceDetected: boolean | null;
  /** Aadhaar only: kept after the full number is cleared post-verification. */
  last4?: string;
}

export const emptyDraft = (): DocDraft => ({
  number: '',
  name: '',
  dob: '',
  fatherName: '',
  gender: '',
  image: null,
  faceDetected: null,
});

export type DocResult = Pick<DocumentSubmitResponse, 'status' | 'registry' | 'errors' | 'faceDetected'> & { fromSession?: boolean };

interface Props {
  doc: RequestedDoc;
  draft: DocDraft;
  onChange: (patch: Partial<DocDraft>) => void;
  result: DocResult | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}

export function validateDraft(doc: RequestedDoc, d: DocDraft): Record<string, string> {
  const cfg = DOC_CONFIG[doc.kind];
  const errs: Record<string, string> = {};
  const num = validateDocNumber(doc.kind, d.number);
  if (num) errs.number = num;
  const name = validateName(d.name, true);
  if (name) errs.name = name;
  const dob = validateDob(d.dob, cfg.dobRequired);
  if (dob) errs.dob = dob;
  const father = validateName(d.fatherName, false);
  if (father) errs.fatherName = father;
  if (cfg.photoId && !d.image) errs.image = 'Scan or upload the front of the card';
  return errs;
}

function pct(score: number | undefined) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return `${Math.round(score <= 1 ? score * 100 : score)}%`;
}

export default function DocumentForm({ doc, draft, onChange, result, submitting, submitError, onSubmit }: Props) {
  const cfg = DOC_CONFIG[doc.kind];
  const uid = useId();
  const [scanning, setScanning] = useState(false);
  const [touched, setTouched] = useState(false);
  const errors = touched ? validateDraft(doc, draft) : {};
  const verified = result?.status === 'VERIFIED';

  const submit = () => {
    setTouched(true);
    if (Object.keys(validateDraft(doc, draft)).length) return;
    onSubmit();
  };

  const onScan = (r: ScanResult) => {
    onChange({ image: r.image, faceDetected: r.faceDetected });
    setScanning(false);
  };

  const id = (k: string) => `${uid}-${k}`;
  const described = (k: string) => (errors[k] ? `${id(k)}-error` : undefined);

  if (verified) {
    const reg = result?.registry;
    const father = reg?.fatherMatch;
    const fatherPassed = typeof father === 'boolean' ? father : father?.passed;
    return (
      <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/25 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden /> {cfg.label}
          </span>
          <StatusChip tone="ok">Verified</StatusChip>
        </div>
        {reg?.nameMasked && <p className="text-[11px] text-zinc-400">Registry name: <span className="text-zinc-200 font-mono">{reg.nameMasked}</span></p>}
        <ul className="flex flex-wrap gap-1.5">
          {reg?.nameMatch && (
            <li>
              <StatusChip tone={reg.nameMatch.passed ? 'ok' : 'bad'}>Name {pct(reg.nameMatch.score) ?? (reg.nameMatch.passed ? 'match' : 'mismatch')}</StatusChip>
            </li>
          )}
          {typeof reg?.dobMatch === 'boolean' && (
            <li>
              <StatusChip tone={reg.dobMatch ? 'ok' : 'bad'}>DOB {reg.dobMatch ? 'match' : 'mismatch'}</StatusChip>
            </li>
          )}
          {typeof fatherPassed === 'boolean' && (
            <li>
              <StatusChip tone={fatherPassed ? 'ok' : 'bad'}>Relative {fatherPassed ? 'match' : 'mismatch'}</StatusChip>
            </li>
          )}
          {reg?.docStatus && (
            <li>
              <StatusChip tone={/ACTIVE|VALID/i.test(reg.docStatus) ? 'ok' : 'wait'}>{reg.docStatus}</StatusChip>
            </li>
          )}
          {typeof result?.faceDetected === 'boolean' && (
            <li>
              <StatusChip tone={result.faceDetected ? 'ok' : 'wait'}>{result.faceDetected ? 'Photo found' : 'No photo found'}</StatusChip>
            </li>
          )}
        </ul>
        {reg?.validTill && <p className="text-[10px] text-zinc-500">Valid till {reg.validTill}</p>}
        {doc.kind === 'AADHAAR' && draft.last4 && (
          <p className="text-[10px] text-zinc-500 font-mono">{maskAadhaar(`00000000${draft.last4}`)}</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 min-w-0">
          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden />
          <span className="truncate">{cfg.label}</span>
        </span>
        <span className="text-[10px] text-zinc-500 truncate">{cfg.issuer}</span>
      </div>

      {result?.status === 'REJECTED' && (
        <Notice tone="error" title="This document could not be verified">
          <ul className="space-y-1 list-disc pl-4">
            {(result.errors?.length ? result.errors : [{ code: 'VERIFICATION_FAILED', message: '' }]).map((e, i) => {
              const h = humanError(e.code, e.message);
              return (
                <li key={`${e.code}-${i}`}>
                  {h.title}. <span className="opacity-80">{h.fix}</span>
                </li>
              );
            })}
          </ul>
        </Notice>
      )}

      <Field
        id={id('number')}
        label={cfg.numberLabel}
        error={errors.number}
        hint={
          cfg.sensitiveNumber ? (
            <span className="flex items-center gap-1">
              <EyeOff className="w-3 h-3" aria-hidden />
              {draft.number ? `${maskAadhaar(draft.number)} · ` : ''}Sent once for verification, never stored.
            </span>
          ) : undefined
        }
      >
        {cfg.sensitiveNumber ? (
          <input
            id={id('number')}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={cfg.numberMaxLength}
            value={draft.number}
            onChange={(e) => onChange({ number: e.target.value.replace(/[^0-9 ]/g, '') })}
            aria-invalid={!!errors.number}
            aria-describedby={errors.number ? described('number') : `${id('number')}-hint`}
            className={`${inputClass(!!errors.number)} font-mono tracking-widest`}
            placeholder="•••• •••• ••••"
          />
        ) : (
          <input
            id={id('number')}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={cfg.numberMaxLength}
            value={draft.number}
            onChange={(e) => onChange({ number: e.target.value.toUpperCase() })}
            onBlur={() => draft.number && onChange({ number: cleanDocNumber(doc.kind, draft.number) })}
            aria-invalid={!!errors.number}
            aria-describedby={described('number')}
            className={`${inputClass(!!errors.number)} font-mono tracking-wider`}
            placeholder={cfg.numberPlaceholder}
          />
        )}
      </Field>

      <Field id={id('name')} label={`Full name (as on ${cfg.shortLabel})`} error={errors.name}>
        <input
          id={id('name')}
          type="text"
          autoComplete="name"
          autoCapitalize="characters"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value.toUpperCase() })}
          aria-invalid={!!errors.name}
          aria-describedby={described('name')}
          className={inputClass(!!errors.name)}
          placeholder="FULL NAME"
        />
      </Field>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
        <Field
          id={id('dob')}
          label={
            <>
              <Calendar className="w-3 h-3 text-indigo-400" aria-hidden /> Date of birth{cfg.dobRequired ? '' : ' (optional)'}
            </>
          }
          error={errors.dob}
        >
          <input
            id={id('dob')}
            type="date"
            autoComplete="bday"
            value={draft.dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange({ dob: e.target.value })}
            aria-invalid={!!errors.dob}
            aria-describedby={described('dob')}
            className={`${inputClass(!!errors.dob)} text-xs [color-scheme:dark]`}
          />
        </Field>
        <Field
          id={id('father')}
          label={
            <>
              <User className="w-3 h-3 text-indigo-400" aria-hidden /> {cfg.relativeLabel} (optional)
            </>
          }
          error={errors.fatherName}
        >
          <input
            id={id('father')}
            type="text"
            autoComplete="off"
            value={draft.fatherName}
            onChange={(e) => onChange({ fatherName: e.target.value.toUpperCase() })}
            aria-invalid={!!errors.fatherName}
            className={`${inputClass(!!errors.fatherName)} text-xs`}
            placeholder="NAME"
          />
        </Field>
      </div>

      {cfg.showGender && (
        <Field id={id('gender')} label="Gender (optional)">
          <select
            id={id('gender')}
            value={draft.gender}
            onChange={(e) => onChange({ gender: e.target.value })}
            className={`${inputClass(false)} text-xs`}
          >
            <option value="">Prefer not to say</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other / Transgender</option>
          </select>
        </Field>
      )}

      {cfg.photoId && (
        <div className="space-y-2">
          {scanning ? (
            <DocumentScanner docLabel={cfg.label} requireFace={cfg.photoId} onCapture={onScan} onCancel={() => setScanning(false)} />
          ) : draft.image ? (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.image} alt={`${cfg.label} photo`} className="w-20 h-auto rounded-md border border-zinc-800" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-zinc-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden /> Card photo ready
                </p>
                {draft.faceDetected === false && <p className="text-[10px] text-amber-300">Portrait not detected — consider rescanning.</p>}
              </div>
              <Button variant="ghost" className="!min-h-[36px] !px-2" onClick={() => setScanning(true)} aria-label={`Rescan ${cfg.label}`}>
                <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Rescan
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="w-full border-dashed" onClick={() => setScanning(true)}>
              <Camera className="w-4 h-4 text-indigo-400" aria-hidden /> Scan front of {cfg.shortLabel}
            </Button>
          )}
          {errors.image && !scanning && (
            <p className="text-[10px] text-red-400" role="alert">
              {errors.image}
            </p>
          )}
        </div>
      )}

      {submitError && <Notice tone="error">{submitError}</Notice>}

      {!scanning && (
        <Button className="w-full" onClick={submit} loading={submitting}>
          {submitting ? 'Checking with registry…' : `Verify ${cfg.shortLabel}`}
        </Button>
      )}
    </div>
  );
}
