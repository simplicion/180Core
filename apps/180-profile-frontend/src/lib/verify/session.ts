/**
 * 180 Verify — session bootstrap helpers and parent-frame messaging.
 *
 * The session token arrives in the URL fragment (`#st=...`) so it is never sent to servers in the
 * Referer or request line. We move it into sessionStorage (scoped to this tab) and strip the hash.
 */

const TOKEN_KEY = (sessionId: string) => `180_verify_st:${sessionId}`;

export interface BootstrapParams {
  sessionId: string | null;
  token: string | null;
}

function safeStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function storeToken(sessionId: string, token: string) {
  try {
    safeStorage()?.setItem(TOKEN_KEY(sessionId), token);
  } catch {
    /* private mode etc. */
  }
}

export function readStoredToken(sessionId: string): string | null {
  try {
    return safeStorage()?.getItem(TOKEN_KEY(sessionId)) ?? null;
  } catch {
    return null;
  }
}

/** Reads `session_id` (query) and `st` (hash), persists the token, and strips the hash from the URL. */
export function readBootstrapParams(): BootstrapParams {
  const url = new URL(window.location.href);
  const sessionId = (url.searchParams.get('session_id') || '').trim() || null;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  let token = (hash.get('st') || '').trim() || null;

  if (url.hash) {
    try {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    } catch {
      /* ignore */
    }
  }
  if (sessionId && token) storeToken(sessionId, token);
  if (sessionId && !token) token = readStoredToken(sessionId);
  return { sessionId, token };
}

/** After creating a demo session, reflect it in the URL so a reload resumes it. */
export function setSessionInUrl(sessionId: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('session_id', sessionId);
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  } catch {
    /* ignore */
  }
}

export function isExpired(expiresAt: string | number | null | undefined, now = Date.now()): boolean {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return false;
  const t = typeof expiresAt === 'number' ? (expiresAt < 1e12 ? expiresAt * 1000 : expiresAt) : Date.parse(expiresAt);
  return Number.isFinite(t) && t <= now;
}

export function toEpochMs(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const t = typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

// ---------------------------------------------------------------------------
// Parent messaging — minimal payloads, exact target origin only.
// ---------------------------------------------------------------------------

export type ParentMessage =
  | { type: '180_VERIFY_READY'; sessionId: string }
  | { type: '180_VERIFY_COMPLETE'; sessionId: string; status: string }
  | { type: '180_VERIFY_CLOSE'; sessionId: string }
  | { type: '180_VERIFY_ERROR'; sessionId: string; code: string };

export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

/** Accepts only a bare https/http origin (no path, no wildcard). */
export function normaliseOrigin(origin: string | null | undefined): string | null {
  if (!origin || typeof origin !== 'string' || origin === '*' || origin === 'null') return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.origin === origin.replace(/\/+$/, '') ? u.origin : null;
  } catch {
    return null;
  }
}

/** Posts to the session's parentOrigin only; silently does nothing when not embedded or origin unknown. */
export function postToParent(parentOrigin: string | null | undefined, message: ParentMessage) {
  if (typeof window === 'undefined' || !isEmbedded()) return;
  const origin = normaliseOrigin(parentOrigin);
  if (!origin) return;
  try {
    window.parent.postMessage(message, origin);
  } catch {
    /* ignore */
  }
}
