'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { DOC_CONFIG, cleanDocNumber, type RequestedDoc } from '@/lib/verify/docTypes';
import { VerifyApiError, verifyApi } from '@/lib/verify/api';
import { humanError } from '@/lib/verify/errors';
import type { DocumentSubmitBody } from '@/lib/verify/types';
import DocumentForm, { type DocDraft, type DocResult } from './DocumentForm';
import { Button, StatusChip, StepTitle, cx } from './ui';

interface Props {
  sessionId: string;
  token: string;
  docs: RequestedDoc[];
  drafts: Record<string, DocDraft>;
  results: Record<string, DocResult | null>;
  onDraftChange: (raw: string, patch: Partial<DocDraft>) => void;
  onResult: (raw: string, r: DocResult) => void;
  onFatal: (code: string) => void;
  onContinue: () => void;
  continueLabel: string;
}

export const FATAL_CODES = new Set(['SESSION_EXPIRED', 'SESSION_NOT_FOUND', 'INVALID_SESSION_TOKEN', 'SESSION_COMPLETED']);

export default function DocumentStep({ sessionId, token, docs, drafts, results, onDraftChange, onResult, onFatal, onContinue, continueLabel }: Props) {
  const firstPending = docs.find((d) => results[d.raw]?.status !== 'VERIFIED') ?? docs[0];
  const [active, setActive] = useState<string>(firstPending?.raw);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<string, string | null>>({});

  const allVerified = docs.every((d) => results[d.raw]?.status === 'VERIFIED');
  const activeDoc = docs.find((d) => d.raw === active) ?? docs[0];

  const submit = async (doc: RequestedDoc) => {
    const d = drafts[doc.raw];
    if (!d) return;
    setSubmitting(doc.raw);
    setSubmitErrors((s) => ({ ...s, [doc.raw]: null }));
    const body: DocumentSubmitBody = {
      docType: doc.raw,
      name: d.name.trim().replace(/\s+/g, ' '),
      ...(d.number ? { number: cleanDocNumber(doc.kind, d.number) } : {}),
      ...(d.dob ? { dob: d.dob } : {}),
      ...(d.fatherName.trim() ? { fatherName: d.fatherName.trim().replace(/\s+/g, ' ') } : {}),
      ...(d.gender ? { gender: d.gender } : {}),
      ...(d.image ? { image: d.image } : {}),
    };
    try {
      const res = await verifyApi.submitDocument(sessionId, token, body);
      if (res?.status !== 'VERIFIED' && res?.status !== 'REJECTED') throw new VerifyApiError(200, 'BAD_RESPONSE', 'Unexpected response from the server.');
      onResult(doc.raw, { status: res.status, registry: res.registry, errors: res.errors, faceDetected: res.faceDetected });
      if (res.status === 'VERIFIED') {
        if (doc.kind === 'AADHAAR') {
          const digits = cleanDocNumber('AADHAAR', d.number);
          onDraftChange(doc.raw, { number: '', last4: digits.slice(-4) });
        }
        const next = docs.find((x) => x.raw !== doc.raw && results[x.raw]?.status !== 'VERIFIED');
        if (next) setActive(next.raw);
      }
    } catch (err: any) {
      const code = err instanceof VerifyApiError ? err.code : 'NETWORK_ERROR';
      if (FATAL_CODES.has(code)) {
        onFatal(code);
        return;
      }
      const h = humanError(code, err?.message);
      setSubmitErrors((s) => ({ ...s, [doc.raw]: `${h.title}. ${h.fix}` }));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-4">
      <StepTitle
        title="Verify your documents"
        subtitle="Enter the details exactly as printed. We check them against the official registry and match the card photo to your face."
      />

      {docs.length > 1 && (
        <div className="flex gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-x-auto" role="tablist" aria-label="Documents">
          {docs.map((d) => {
            const st = results[d.raw]?.status;
            const selected = d.raw === activeDoc?.raw;
            return (
              <button
                key={d.raw}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(d.raw)}
                className={cx(
                  'flex-1 min-w-[84px] min-h-[40px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors flex flex-col items-center gap-0.5',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                  selected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200',
                )}
              >
                <span>{DOC_CONFIG[d.kind].shortLabel}</span>
                {st === 'VERIFIED' ? (
                  <StatusChip tone="ok">Verified</StatusChip>
                ) : st === 'REJECTED' ? (
                  <StatusChip tone="bad">Failed</StatusChip>
                ) : (
                  <StatusChip tone="idle">To do</StatusChip>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeDoc && (
        <div role={docs.length > 1 ? 'tabpanel' : undefined}>
          <DocumentForm
            key={activeDoc.raw}
            doc={activeDoc}
            draft={drafts[activeDoc.raw]}
            onChange={(patch) => onDraftChange(activeDoc.raw, patch)}
            result={results[activeDoc.raw] ?? null}
            submitting={submitting === activeDoc.raw}
            submitError={submitErrors[activeDoc.raw] ?? null}
            onSubmit={() => submit(activeDoc)}
          />
        </div>
      )}

      <Button className="w-full" disabled={!allVerified} onClick={onContinue}>
        {allVerified ? continueLabel : `Verify ${docs.length > 1 ? 'all documents' : 'your document'} to continue`}
        {allVerified && <ChevronRight className="w-4 h-4" aria-hidden />}
      </Button>
    </div>
  );
}
