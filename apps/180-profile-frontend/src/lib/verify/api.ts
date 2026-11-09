/**
 * 180 Verify — thin client for the public verification-session API.
 * Every call (except demo creation) is authorised with the per-session bearer token (`st`).
 * Nothing in here logs request/response bodies (they contain PII).
 */
import type {
  BankSubmitBody,
  BankSubmitResponse,
  CompleteBody,
  CompleteResponse,
  DocumentSubmitBody,
  DocumentSubmitResponse,
  LivenessChallenge,
  PublicSession,
} from './types';

export const CORE_BACKEND_URL = (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003').replace(/\/+$/, '');
const BASE = `${CORE_BACKEND_URL}/api/v1/identity/verify/session`;

export class VerifyApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: any;
  constructor(status: number, code: string, message: string, body?: any) {
    super(message);
    this.name = 'VerifyApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Unwraps `{status:'SUCCESS', data:{...}}` envelopes while tolerating bare payloads. */
function unwrap<T>(json: any): T {
  if (json && typeof json === 'object' && json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
    return json.data as T;
  }
  return json as T;
}

function codeFromBody(status: number, json: any): string {
  const raw =
    json?.error_code ||
    json?.code ||
    json?.error?.code ||
    (Array.isArray(json?.errors) && json.errors[0]?.code) ||
    (typeof json?.error === 'string' && /^[A-Z0-9_]+$/.test(json.error) ? json.error : null);
  if (raw) return String(raw);
  if (status === 401 || status === 403) return 'INVALID_SESSION_TOKEN';
  if (status === 404) return 'SESSION_NOT_FOUND';
  if (status === 410) return 'SESSION_EXPIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502) return 'PROVIDER_UNAVAILABLE';
  if (status === 503) return 'BIOMETRICS_ENGINE_UNAVAILABLE';
  return 'REQUEST_FAILED';
}

function messageFromBody(json: any, fallback: string): string {
  const m = json?.error_message || json?.message || (typeof json?.error === 'string' ? json.error : json?.error?.message);
  return typeof m === 'string' && m.length < 400 ? m : fallback;
}

interface RequestOpts {
  token?: string | null;
  body?: unknown;
  method?: 'GET' | 'POST';
  timeoutMs?: number;
  /** Return the parsed body for these non-2xx statuses instead of throwing (e.g. 422 business rejections). */
  passStatuses?: number[];
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs ?? 30000) : null;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller?.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    throw new VerifyApiError(
      0,
      aborted ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR',
      aborted ? 'The verification server took too long to respond.' : 'Could not reach the verification server.',
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok && !(opts.passStatuses || []).includes(res.status)) {
    throw new VerifyApiError(res.status, codeFromBody(res.status, json), messageFromBody(json, `Request failed (${res.status}).`), json);
  }
  if (json === null) {
    throw new VerifyApiError(res.status, 'BAD_RESPONSE', 'The verification server sent an unexpected response.');
  }
  return unwrap<T>(json);
}

export interface DemoSessionResponse {
  sessionId: string;
  sessionToken: string;
}

export const verifyApi = {
  async createDemoSession(): Promise<DemoSessionResponse> {
    const raw = await request<any>('/demo', { method: 'POST', body: {} });
    const sessionId = raw?.sessionId || raw?.session_id || raw?.id;
    const sessionToken = raw?.sessionToken || raw?.session_token || raw?.st || raw?.token;
    if (!sessionId || !sessionToken) {
      throw new VerifyApiError(200, 'BAD_RESPONSE', 'Demo session response was missing an id or token.');
    }
    return { sessionId: String(sessionId), sessionToken: String(sessionToken) };
  },

  getSession(sessionId: string, token: string): Promise<PublicSession> {
    return request<PublicSession>(`/${encodeURIComponent(sessionId)}/public`, { token, timeoutMs: 15000 });
  },

  submitDocument(sessionId: string, token: string, body: DocumentSubmitBody): Promise<DocumentSubmitResponse> {
    return request<DocumentSubmitResponse>(`/${encodeURIComponent(sessionId)}/documents`, {
      token,
      body,
      timeoutMs: 45000,
      passStatuses: [422],
    });
  },

  submitBank(sessionId: string, token: string, body: BankSubmitBody): Promise<BankSubmitResponse> {
    return request<BankSubmitResponse>(`/${encodeURIComponent(sessionId)}/bank`, {
      token,
      body,
      timeoutMs: 45000,
      passStatuses: [422],
    });
  },

  createChallenge(sessionId: string, token: string): Promise<LivenessChallenge> {
    return request<LivenessChallenge>(`/${encodeURIComponent(sessionId)}/liveness/challenge`, {
      token,
      body: {},
      timeoutMs: 15000,
    });
  },

  complete(sessionId: string, token: string, body: CompleteBody): Promise<CompleteResponse> {
    return request<CompleteResponse>(`/${encodeURIComponent(sessionId)}/complete`, {
      token,
      body,
      timeoutMs: 90000,
      passStatuses: [422],
    });
  },
};
