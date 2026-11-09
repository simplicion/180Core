/**
 * 180 Verify - session persistence (Postgres via Prisma; in-memory implementation for tests).
 * Rows contain masked identifiers and registry attributes only. No images, no full Aadhaar numbers,
 * no raw provider payloads.
 */

import { MAX_COMPLETE_ATTEMPTS } from './config';
import type { DataSource, DocType, Gender } from './types';

export type SessionStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED' | 'EXPIRED';
export const FINAL_STATUSES: SessionStatus[] = ['APPROVED', 'MANUAL_REVIEW', 'REJECTED', 'EXPIRED'];

export interface StepError {
  code: string;
  message: string;
}

export interface DocStep {
  status: 'VERIFIED' | 'REJECTED';
  source: DataSource;
  numberMasked?: string;
  faceDetected: boolean;
  /** Registry-sourced attributes only (never copied from user input). */
  registry: { name?: string; dob?: string; fatherName?: string; gender?: Gender; docStatus?: string; validTill?: string };
  /** Self-declared attributes (Aadhaar only). */
  declared?: { name?: string; dob?: string; fatherName?: string; gender?: Gender };
  nameMatch: { score: number; passed: boolean };
  dobMatch?: boolean;
  fatherMatch?: { score: number; passed: boolean };
  /** name passed only via issuer attestation (live API Setu without echoed name) -> review */
  nameAttestedOnly?: boolean;
  /** strictNameMatching=false and name below threshold -> review */
  nameReview?: boolean;
  errors: StepError[];
  provider?: string;
  submittedAt: string;
}

export interface BankStep {
  status: 'VERIFIED' | 'REJECTED' | 'PENDING';
  mode: 'UPI' | 'ACCOUNT';
  refMasked: string;
  ifsc?: string;
  validationId?: string;
  registeredNameMasked?: string;
  nameMatch: { score: number; passed: boolean };
  errors: StepError[];
  submittedAt: string;
}

export interface FaceStep {
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
  faceMatchConfidence?: number | null;
  livenessScore?: number | null;
  antiSpoofApplied?: boolean;
  lastErrorCode?: string;
}

export interface SessionSteps {
  documents: Partial<Record<DocType, DocStep>>;
  bank?: BankStep;
  face?: FaceStep;
}

export interface SessionRecord {
  id: string;
  appId: string | null;
  clientId: string;
  status: SessionStatus;
  environment: 'sandbox' | 'live';
  documents: DocType[];
  strictNameMatching: boolean;
  parentOrigin: string | null;
  redirectUri: string | null;
  tokenJti: string;
  steps: SessionSteps;
  docAttempts: Record<string, number>;
  bankAttempts: number;
  completeAttempts: number;
  challengeId: string | null;
  challengeSteps: string[];
  challengeExpiresAt: Date | null;
  challengeUsedAt: Date | null;
  challengeCount: number;
  verdict: any | null;
  failureCode: string | null;
  signedResult: string | null;
  expiresAt: Date;
  completedAt: Date | null;
  resultFetchedAt: Date | null;
  createdAt: Date;
}

export type NewSession = Omit<SessionRecord, 'createdAt' | 'completedAt' | 'resultFetchedAt' | 'verdict' | 'failureCode' | 'signedResult' | 'challengeId' | 'challengeSteps' | 'challengeExpiresAt' | 'challengeUsedAt' | 'challengeCount' | 'bankAttempts' | 'completeAttempts' | 'docAttempts' | 'steps'>;

export interface SessionStore {
  create(rec: NewSession): Promise<SessionRecord>;
  get(id: string): Promise<SessionRecord | null>;
  update(id: string, patch: Partial<SessionRecord>): Promise<SessionRecord>;
  /** Atomically marks the challenge used and claims one complete attempt. false if already used/expired/exhausted. */
  consumeChallenge(id: string, challengeId: string, now: Date): Promise<boolean>;
  /** Atomically claims one complete attempt (sessions without FACE_MATCH). */
  claimCompleteAttempt(id: string): Promise<boolean>;
  /** Gives back an attempt after an infrastructure failure (503/502). */
  releaseCompleteAttempt(id: string): Promise<void>;
  addEvent(sessionId: string, type: string, data?: Record<string, unknown>): Promise<void>;
}

function blankSteps(): SessionSteps {
  return { documents: {} };
}

// ─── In-memory store (tests / local without Postgres) ──────────────────────────
export class InMemorySessionStore implements SessionStore {
  public rows = new Map<string, SessionRecord>();
  public events: { sessionId: string; type: string; data?: any; at: Date }[] = [];

  async create(rec: NewSession): Promise<SessionRecord> {
    const row: SessionRecord = {
      ...rec,
      steps: blankSteps(),
      docAttempts: {},
      bankAttempts: 0,
      completeAttempts: 0,
      challengeId: null,
      challengeSteps: [],
      challengeExpiresAt: null,
      challengeUsedAt: null,
      challengeCount: 0,
      verdict: null,
      failureCode: null,
      signedResult: null,
      completedAt: null,
      resultFetchedAt: null,
      createdAt: new Date(),
    };
    this.rows.set(row.id, structuredClone(row));
    return structuredClone(row);
  }

  async get(id: string): Promise<SessionRecord | null> {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }

  async update(id: string, patch: Partial<SessionRecord>): Promise<SessionRecord> {
    const r = this.rows.get(id);
    if (!r) throw new Error('session not found');
    const next = { ...r, ...structuredClone(patch) };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async consumeChallenge(id: string, challengeId: string, now: Date): Promise<boolean> {
    const r = this.rows.get(id);
    if (!r || r.challengeId !== challengeId || r.challengeUsedAt || !r.challengeExpiresAt || r.challengeExpiresAt <= now) return false;
    if (r.completeAttempts >= MAX_COMPLETE_ATTEMPTS || FINAL_STATUSES.includes(r.status)) return false;
    r.challengeUsedAt = now;
    r.completeAttempts += 1;
    return true;
  }

  async claimCompleteAttempt(id: string): Promise<boolean> {
    const r = this.rows.get(id);
    if (!r || r.completeAttempts >= MAX_COMPLETE_ATTEMPTS || FINAL_STATUSES.includes(r.status)) return false;
    r.completeAttempts += 1;
    return true;
  }

  async releaseCompleteAttempt(id: string): Promise<void> {
    const r = this.rows.get(id);
    if (r && r.completeAttempts > 0) r.completeAttempts -= 1;
  }

  async addEvent(sessionId: string, type: string, data?: Record<string, unknown>): Promise<void> {
    this.events.push({ sessionId, type, data, at: new Date() });
  }
}

// ─── Prisma store ───────────────────────────────────────────────────────────
export class PrismaSessionStore implements SessionStore {
  private client(): any {
    // Lazy require: importing @workspace/db-180core throws when DATABASE_URL is unset (tests).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const db = require('@workspace/db-180core');
    return db.corePrisma || db.developersPrisma || db.default;
  }

  private map(row: any): SessionRecord | null {
    if (!row) return null;
    return {
      ...row,
      steps: (row.steps && typeof row.steps === 'object' ? row.steps : blankSteps()) as SessionSteps,
      docAttempts: (row.docAttempts || {}) as Record<string, number>,
    } as SessionRecord;
  }

  async create(rec: NewSession): Promise<SessionRecord> {
    const row = await this.client().verificationSession.create({
      data: { ...rec, steps: blankSteps(), docAttempts: {} },
    });
    return this.map(row)!;
  }

  async get(id: string): Promise<SessionRecord | null> {
    return this.map(await this.client().verificationSession.findUnique({ where: { id } }));
  }

  async update(id: string, patch: Partial<SessionRecord>): Promise<SessionRecord> {
    const { id: _ignore, createdAt: _c, ...data } = patch as any;
    return this.map(await this.client().verificationSession.update({ where: { id }, data }))!;
  }

  async consumeChallenge(id: string, challengeId: string, now: Date): Promise<boolean> {
    const r = await this.client().verificationSession.updateMany({
      where: {
        id,
        challengeId,
        challengeUsedAt: null,
        challengeExpiresAt: { gt: now },
        completeAttempts: { lt: MAX_COMPLETE_ATTEMPTS },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      data: { challengeUsedAt: now, completeAttempts: { increment: 1 } },
    });
    return r.count === 1;
  }

  async claimCompleteAttempt(id: string): Promise<boolean> {
    const r = await this.client().verificationSession.updateMany({
      where: { id, completeAttempts: { lt: MAX_COMPLETE_ATTEMPTS }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { completeAttempts: { increment: 1 } },
    });
    return r.count === 1;
  }

  async releaseCompleteAttempt(id: string): Promise<void> {
    await this.client().verificationSession.updateMany({
      where: { id, completeAttempts: { gt: 0 } },
      data: { completeAttempts: { decrement: 1 } },
    });
  }

  async addEvent(sessionId: string, type: string, data?: Record<string, unknown>): Promise<void> {
    try {
      await this.client().verificationAuditEvent.create({ data: { sessionId, type, data: (data as any) ?? undefined } });
    } catch (err: any) {
      console.warn(`[180Verify] audit event ${type} not recorded: ${err?.message}`);
    }
  }
}

let current: SessionStore | null = null;

export function sessionStore(): SessionStore {
  if (!current) current = new PrismaSessionStore();
  return current;
}

/** Test hook. */
export function setSessionStore(store: SessionStore | null): void {
  current = store;
}
