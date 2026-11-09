/**
 * 180 Verify — browser drop-in engine.
 *
 * Flow:
 *   1. `POST {apiBaseUrl}/api/v1/identity/verify/session` (the request Origin must be a
 *      registered origin of the app) → `{ sessionId, verifyUrl, ... }`.
 *   2. Open `verifyUrl` in a sandboxed iframe (80vh bottom sheet on mobile, centered
 *      modal on desktop) with `allow="camera; fullscreen"`.
 *   3. Listen for `180_VERIFY_*` postMessages. A message is only accepted when
 *      `event.origin === new URL(verifyUrl).origin`, `event.source === iframe.contentWindow`
 *      AND `data.sessionId` matches the session we created.
 *
 * SECURITY: the outcome reported here (`onSuccess({ sessionId, status })`) is produced in
 * the end user's browser and can be forged. It is NOT proof of verification. Your backend
 * must call `fetchVerificationResult()` (from `@workspace/identity-sdk/verify-server`) to
 * obtain the signed result and the verified profile.
 */

import {
  VERIFY_DOCUMENT_TYPES,
  VerifyClientError,
  VerifyClientResult,
  VerifyDocumentType,
  VerifySessionResponse,
} from './verify-types';

export const VERIFY_MESSAGE_TYPES = {
  READY: '180_VERIFY_READY',
  COMPLETE: '180_VERIFY_COMPLETE',
  CLOSE: '180_VERIFY_CLOSE',
  ERROR: '180_VERIFY_ERROR',
} as const;

export type VerifyInboundMessage =
  | { type: '180_VERIFY_READY'; sessionId: string }
  | { type: '180_VERIFY_COMPLETE'; sessionId: string; status: string }
  | { type: '180_VERIFY_CLOSE'; sessionId: string }
  | { type: '180_VERIFY_ERROR'; sessionId: string; code: string };

export interface VerifyMessageFilterContext {
  /** `new URL(verifyUrl).origin` */
  expectedOrigin: string;
  /** Session id returned by `POST /session` */
  sessionId: string;
  /** `iframe.contentWindow` of the verification iframe */
  iframeWindow: unknown;
}

/**
 * Strict postMessage gate. Returns a sanitized message (only whitelisted fields are copied)
 * or `null` when the event must be ignored.
 */
export function filterVerifyMessage(
  event: { origin?: string; source?: unknown; data?: unknown } | null | undefined,
  ctx: VerifyMessageFilterContext
): VerifyInboundMessage | null {
  if (!event || !ctx || !ctx.expectedOrigin || !ctx.sessionId) return null;
  if (event.origin !== ctx.expectedOrigin) return null;
  if (!ctx.iframeWindow || event.source !== ctx.iframeWindow) return null;

  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (typeof data.sessionId !== 'string' || data.sessionId !== ctx.sessionId) return null;

  const sessionId = ctx.sessionId;
  switch (data.type) {
    case VERIFY_MESSAGE_TYPES.READY:
      return { type: VERIFY_MESSAGE_TYPES.READY, sessionId };
    case VERIFY_MESSAGE_TYPES.COMPLETE:
      if (typeof data.status !== 'string' || !data.status) return null;
      return { type: VERIFY_MESSAGE_TYPES.COMPLETE, sessionId, status: data.status };
    case VERIFY_MESSAGE_TYPES.CLOSE:
      return { type: VERIFY_MESSAGE_TYPES.CLOSE, sessionId };
    case VERIFY_MESSAGE_TYPES.ERROR:
      return {
        type: VERIFY_MESSAGE_TYPES.ERROR,
        sessionId,
        code: typeof data.code === 'string' && data.code ? data.code.slice(0, 64) : 'VERIFICATION_ERROR',
      };
    default:
      return null;
  }
}

export type VerifyOutcome =
  | { kind: 'ready' }
  | { kind: 'success'; result: VerifyClientResult }
  | { kind: 'error'; error: VerifyClientError }
  | { kind: 'close' };

/** Maps an accepted message to what the SDK does with it. */
export function resolveVerifyOutcome(msg: VerifyInboundMessage): VerifyOutcome {
  switch (msg.type) {
    case VERIFY_MESSAGE_TYPES.READY:
      return { kind: 'ready' };
    case VERIFY_MESSAGE_TYPES.CLOSE:
      return { kind: 'close' };
    case VERIFY_MESSAGE_TYPES.ERROR:
      return {
        kind: 'error',
        error: { code: msg.code, message: `180 Verify reported an error (${msg.code})`, sessionId: msg.sessionId },
      };
    case VERIFY_MESSAGE_TYPES.COMPLETE: {
      if (msg.status === 'APPROVED' || msg.status === 'MANUAL_REVIEW') {
        return { kind: 'success', result: { sessionId: msg.sessionId, status: msg.status } };
      }
      if (msg.status === 'REJECTED') {
        return {
          kind: 'error',
          error: { code: 'VERIFICATION_REJECTED', message: 'Verification was rejected', sessionId: msg.sessionId },
        };
      }
      return {
        kind: 'error',
        error: {
          code: 'VERIFICATION_FAILED',
          message: `Verification ended with status ${msg.status}`,
          sessionId: msg.sessionId,
        },
      };
    }
  }
}

const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');

/**
 * Returns the origin of the hosted verification page. Only https (or http on loopback
 * for local development) is accepted.
 */
export function getVerifyOrigin(verifyUrl: string): string {
  const url = new URL(verifyUrl);
  if (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname))) {
    return url.origin;
  }
  throw new Error(`[180 Verify] Refusing to load verifyUrl with insecure or unsupported scheme: ${url.protocol}`);
}

export function validateVerifyDocuments(documents: unknown): VerifyClientError | null {
  if (!Array.isArray(documents) || documents.length === 0) {
    return { code: 'INVALID_DOCUMENTS', message: '`documents` must be a non-empty array' };
  }
  const unknownDocs = documents.filter((d) => !VERIFY_DOCUMENT_TYPES.includes(d as VerifyDocumentType));
  if (unknownDocs.length) {
    return {
      code: 'INVALID_DOCUMENTS',
      message: `Unsupported document type(s): ${unknownDocs.join(', ')}. Allowed: ${VERIFY_DOCUMENT_TYPES.join(', ')}`,
    };
  }
  return null;
}

export class VerifyRequestError extends Error {
  code: string;
  httpStatus?: number;
  constructor(code: string, message: string, httpStatus?: number) {
    super(message);
    this.name = 'VerifyRequestError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface RequestVerificationSessionInput {
  apiBaseUrl: string;
  clientId: string;
  documents: VerifyDocumentType[];
  strictNameMatching?: boolean;
  /** Defaults to `window.location.origin`. */
  parentOrigin?: string;
  fetchImpl?: typeof fetch;
}

/** Browser-side session creation (no secret; authorized by the registered Origin). */
export async function requestVerificationSession(input: RequestVerificationSessionInput): Promise<VerifySessionResponse> {
  const fetchFn = input.fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) throw new VerifyRequestError('FETCH_UNAVAILABLE', 'fetch is not available in this environment');
  const parentOrigin =
    input.parentOrigin || (typeof window !== 'undefined' && window.location ? window.location.origin : '');

  let res: Response;
  try {
    res = await fetchFn(`${input.apiBaseUrl.replace(/\/+$/, '')}/api/v1/identity/verify/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({
        clientId: input.clientId,
        documents: input.documents,
        ...(input.strictNameMatching !== undefined ? { strictNameMatching: Boolean(input.strictNameMatching) } : {}),
        parentOrigin,
      }),
    });
  } catch (err: any) {
    throw new VerifyRequestError('NETWORK_ERROR', `Could not reach 180 Verify: ${err?.message || 'network error'}`);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const code =
      (body && (body.code || body.errorCode || (typeof body.error === 'string' ? body.error : undefined))) ||
      (res.status === 403 ? 'ORIGIN_NOT_ALLOWED' : `HTTP_${res.status}`);
    const message = (body && (body.message || body.error_description || body.error)) || `Session creation failed (${res.status})`;
    throw new VerifyRequestError(String(code), String(message), res.status);
  }

  const session = body && (body.data && body.data.sessionId ? body.data : body);
  if (!session || typeof session.sessionId !== 'string' || typeof session.verifyUrl !== 'string') {
    throw new VerifyRequestError('INVALID_SESSION_RESPONSE', 'Session response is missing sessionId or verifyUrl', res.status);
  }
  return session as VerifySessionResponse;
}

/* ── Surface (iframe in bottom sheet / modal) ─────────────────────────────── */

const VERIFY_STYLE_ID = '__180_verify_styles__';

/** Sandbox tokens: scripts + same-origin (camera/storage), forms, popups (bank/DigiLocker flows). No top navigation. */
export const VERIFY_IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups';
export const VERIFY_IFRAME_ALLOW = 'camera; fullscreen';

const injectVerifyCSS = () => {
  if (typeof document === 'undefined' || document.getElementById(VERIFY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = VERIFY_STYLE_ID;
  style.textContent = `
    @keyframes one-eighty-verify-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      [data-180-verify-root], [data-180-verify-root] * { transition: none !important; animation-duration: 0.01ms !important; }
    }
  `;
  document.head.appendChild(style);
};

const detectMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

export interface VerifySurfaceOptions {
  verifyUrl: string;
  sessionId: string;
  title?: string;
  /** Called for every accepted, filtered message. */
  onOutcome: (outcome: VerifyOutcome) => void;
  /** User dismissed the surface (close button, backdrop, Esc, drag down). */
  onDismiss: () => void;
}

export interface VerifySurfaceHandle {
  /** Tears down the surface immediately (iframe removed → camera released) and animates out. */
  destroy(): void;
  iframe: HTMLIFrameElement;
}

export function openVerifySurface(opts: VerifySurfaceOptions): VerifySurfaceHandle {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('[180 Verify] The verification surface can only be rendered in a browser');
  }
  const expectedOrigin = getVerifyOrigin(opts.verifyUrl);
  injectVerifyCSS();

  const isMobile = detectMobile();
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const titleId = `__180_verify_title_${Math.random().toString(36).slice(2, 10)}`;

  const root = document.createElement('div');
  root.setAttribute('data-180-verify-root', '');
  root.style.cssText = `
    position: fixed; inset: 0; z-index: 999999; display: flex; flex-direction: column;
    justify-content: ${isMobile ? 'flex-end' : 'center'}; align-items: center;
    opacity: 0; transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const backdrop = document.createElement('div');
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.cssText = `
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); cursor: pointer;
  `;

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.tabIndex = -1;
  const closedTransform = isMobile ? 'translateY(100%)' : 'scale(0.96)';
  const openTransform = isMobile ? 'translateY(0)' : 'scale(1)';
  dialog.style.cssText = `
    position: relative; z-index: 1000000; width: 100%;
    max-width: ${isMobile ? '100%' : 'min(480px, calc(100vw - 32px))'};
    height: ${isMobile ? '80vh' : 'min(720px, 90vh)'};
    background: #09090b; color: #fafafa; border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: ${isMobile ? '24px 24px 0 0' : '24px'};
    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.65), 0 20px 48px rgba(0, 0, 0, 0.85);
    display: flex; flex-direction: column; overflow: hidden; outline: none;
    transform: ${closedTransform}; transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1); will-change: transform;
  `;
  if (isMobile) dialog.style.height = '80dvh'; // ignored by browsers without dvh support → stays 80vh

  const header = document.createElement('div');
  header.style.cssText = `
    flex-shrink: 0; padding: 10px 16px 8px; display: flex; flex-direction: column; align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #09090b; position: relative;
    ${isMobile ? 'cursor: grab; touch-action: none;' : ''}
  `;
  if (isMobile) {
    const grabBar = document.createElement('div');
    grabBar.setAttribute('aria-hidden', 'true');
    grabBar.style.cssText = 'width: 44px; height: 4px; border-radius: 9999px; background: rgba(255, 255, 255, 0.22); margin-bottom: 8px;';
    header.appendChild(grabBar);
  }
  const titleEl = document.createElement('div');
  titleEl.id = titleId;
  titleEl.textContent = opts.title || '180 Verify';
  titleEl.style.cssText = 'font-size: 13px; font-weight: 700; color: #f4f4f5; letter-spacing: -0.01em; padding: 2px 32px;';
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close verification');
  closeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  closeBtn.style.cssText = `
    position: absolute; right: 14px; top: ${isMobile ? '12px' : '6px'}; background: transparent; border: none;
    color: #a1a1aa; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; border-radius: 6px;
  `;
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.cssText = 'flex: 1; width: 100%; position: relative; background: #09090b; overflow: hidden;';

  const skeleton = document.createElement('div');
  skeleton.setAttribute('role', 'status');
  skeleton.style.cssText = `
    position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; color: #71717a; font-size: 12px; background: #09090b; z-index: 1; transition: opacity 0.2s ease;
  `;
  skeleton.innerHTML =
    '<div style="width: 24px; height: 24px; border: 2.5px solid rgba(255, 255, 255, 0.15); border-top-color: #f4f4f5; border-radius: 50%; animation: one-eighty-verify-spin 0.8s linear infinite;"></div><span>Starting secure verification…</span>';

  const iframe = document.createElement('iframe');
  iframe.title = opts.title || '180 Verify';
  iframe.setAttribute('allow', VERIFY_IFRAME_ALLOW);
  iframe.setAttribute('sandbox', VERIFY_IFRAME_SANDBOX);
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.style.cssText = 'width: 100%; height: 100%; border: none; background: transparent; display: block;';

  body.appendChild(skeleton);
  body.appendChild(iframe);
  dialog.appendChild(header);
  dialog.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(dialog);

  // Body scroll lock
  const html = document.documentElement;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = document.body.style.overflow;
  html.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  document.body.appendChild(root);
  iframe.src = opts.verifyUrl;

  let destroyed = false;

  const hideSkeleton = () => {
    skeleton.style.opacity = '0';
    setTimeout(() => {
      skeleton.style.display = 'none';
    }, 200);
  };

  const onMessage = (event: MessageEvent) => {
    if (destroyed) return;
    const msg = filterVerifyMessage(event, {
      expectedOrigin,
      sessionId: opts.sessionId,
      iframeWindow: iframe.contentWindow,
    });
    if (!msg) return;
    const outcome = resolveVerifyOutcome(msg);
    if (outcome.kind === 'ready') hideSkeleton();
    opts.onOutcome(outcome);
  };

  const dismiss = () => {
    if (!destroyed) opts.onDismiss();
  };

  const focusables = (): HTMLElement[] => [closeBtn, iframe];

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      dismiss();
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Focus leaving the dialog (e.g. tabbing out of the iframe) is pulled back in.
  const onFocusIn = (e: FocusEvent) => {
    if (destroyed) return;
    const target = e.target as Node | null;
    if (target && !root.contains(target)) {
      closeBtn.focus();
    }
  };

  // Drag-to-dismiss (mobile bottom sheet)
  let dragStartY: number | null = null;
  let dragDelta = 0;
  let dragStartTime = 0;
  const onPointerDown = (e: PointerEvent) => {
    if (e.target && closeBtn.contains(e.target as Node)) return;
    dragStartY = e.clientY;
    dragDelta = 0;
    dragStartTime = Date.now();
    dialog.style.transition = 'none';
    header.style.cursor = 'grabbing';
    try {
      header.setPointerCapture(e.pointerId);
    } catch (_) {}
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragStartY === null) return;
    const delta = e.clientY - dragStartY;
    dragDelta = delta < 0 ? delta * 0.2 : delta;
    dialog.style.transform = `translateY(${dragDelta}px)`;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragStartY === null) return;
    dragStartY = null;
    header.style.cursor = 'grab';
    dialog.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
    try {
      header.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const velocity = dragDelta / Math.max(1, Date.now() - dragStartTime);
    if (dragDelta > 100 || (dragDelta > 30 && velocity > 0.6)) {
      dismiss();
    } else {
      dialog.style.transform = openTransform;
    }
  };

  closeBtn.addEventListener('click', dismiss);
  backdrop.addEventListener('click', dismiss);
  window.addEventListener('message', onMessage);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('focusin', onFocusIn, true);
  if (isMobile) {
    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', onPointerUp);
    header.addEventListener('pointercancel', onPointerUp);
  }

  requestAnimationFrame(() => {
    if (destroyed) return;
    root.style.opacity = '1';
    dialog.style.transform = openTransform;
    try {
      dialog.focus({ preventScroll: true });
    } catch (_) {
      dialog.focus();
    }
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    closeBtn.removeEventListener('click', dismiss);
    backdrop.removeEventListener('click', dismiss);
    window.removeEventListener('message', onMessage);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('focusin', onFocusIn, true);
    header.removeEventListener('pointerdown', onPointerDown);
    header.removeEventListener('pointermove', onPointerMove);
    header.removeEventListener('pointerup', onPointerUp);
    header.removeEventListener('pointercancel', onPointerUp);

    // Remove the iframe right away so the camera stream is released immediately.
    try {
      iframe.src = 'about:blank';
      iframe.remove();
    } catch (_) {}

    html.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;

    dialog.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
    dialog.style.transform = closedTransform;
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';
    setTimeout(() => {
      try {
        root.remove();
      } catch (_) {}
    }, 300);

    if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
      try {
        previouslyFocused.focus({ preventScroll: true });
      } catch (_) {}
    }
  };

  return { destroy, iframe };
}

/* ── Launcher (session + surface + callbacks) ─────────────────────────────── */

export interface VerifyLaunchOptions {
  clientId: string;
  documents: VerifyDocumentType[];
  strictNameMatching?: boolean;
  /** 180 Core API base URL (e.g. https://api.180core.cloud). */
  apiBaseUrl: string;
  title?: string;
  /**
   * Fires for status APPROVED or MANUAL_REVIEW with `{ sessionId, status }` only.
   * NOT proof of verification — verify server-side with `fetchVerificationResult()`.
   */
  onSuccess?: (result: VerifyClientResult) => void;
  /** Fires on errors; REJECTED is reported as code `VERIFICATION_REJECTED`. */
  onError?: (error: VerifyClientError) => void;
  /** Fires when the surface is dismissed without a completion (user or hosted page closed it). */
  onClose?: () => void;
  fetchImpl?: typeof fetch;
}

export interface VerifyController {
  /** Resolves with the client result on success, or `null` on error/close. Never rejects. */
  promise: Promise<VerifyClientResult | null>;
  /** Closes the surface. `onClose` fires unless `{ silent: true }`. */
  close(options?: { silent?: boolean }): void;
  getSessionId(): string | undefined;
}

let activeController: VerifyController | null = null;

export function startVerification(options: VerifyLaunchOptions): VerifyController {
  let settled = false;
  let surface: VerifySurfaceHandle | null = null;
  let sessionId: string | undefined;
  let resolvePromise!: (value: VerifyClientResult | null) => void;
  const promise = new Promise<VerifyClientResult | null>((resolve) => {
    resolvePromise = resolve;
  });

  const safeCall = (fn: (() => void) | undefined) => {
    try {
      fn?.();
    } catch (err) {
      console.error('[180 Verify] callback threw:', err);
    }
  };

  const settle = (
    outcome: { kind: 'success'; result: VerifyClientResult } | { kind: 'error'; error: VerifyClientError } | { kind: 'close'; silent?: boolean }
  ) => {
    if (settled) return;
    settled = true;
    if (surface) {
      surface.destroy();
      surface = null;
    }
    if (activeController === controller) activeController = null;
    if (outcome.kind === 'success') {
      safeCall(() => options.onSuccess?.(outcome.result));
      resolvePromise(outcome.result);
    } else if (outcome.kind === 'error') {
      safeCall(() => options.onError?.(outcome.error));
      resolvePromise(null);
    } else {
      if (!outcome.silent) safeCall(() => options.onClose?.());
      resolvePromise(null);
    }
  };

  const controller: VerifyController = {
    promise,
    close: (closeOpts) => settle({ kind: 'close', silent: Boolean(closeOpts && closeOpts.silent) }),
    getSessionId: () => sessionId,
  };

  if (activeController) activeController.close({ silent: true });
  activeController = controller;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    settle({ kind: 'error', error: { code: 'BROWSER_ONLY', message: '180 Verify can only be launched in a browser' } });
    return controller;
  }
  if (!options.clientId) {
    settle({ kind: 'error', error: { code: 'MISSING_CLIENT_ID', message: '`clientId` is required' } });
    return controller;
  }
  const docError = validateVerifyDocuments(options.documents);
  if (docError) {
    settle({ kind: 'error', error: docError });
    return controller;
  }

  requestVerificationSession({
    apiBaseUrl: options.apiBaseUrl,
    clientId: options.clientId,
    documents: options.documents,
    strictNameMatching: options.strictNameMatching,
    fetchImpl: options.fetchImpl,
  })
    .then((session) => {
      if (settled) return; // closed while the session was being created
      sessionId = session.sessionId;
      surface = openVerifySurface({
        verifyUrl: session.verifyUrl,
        sessionId: session.sessionId,
        title: options.title,
        onDismiss: () => settle({ kind: 'close' }),
        onOutcome: (outcome) => {
          if (outcome.kind === 'ready') return;
          settle(outcome);
        },
      });
    })
    .catch((err: any) => {
      settle({
        kind: 'error',
        error: {
          code: err?.code || 'SESSION_CREATE_FAILED',
          message: err?.message || 'Could not start verification',
          ...(sessionId ? { sessionId } : {}),
        },
      });
    });

  return controller;
}
