/**
 * 180 Verify - short-lived, in-process cache of document face crops.
 *
 * Images are NEVER written to the database. Crops live here for at most SESSION_TTL_MS and are
 * purged when the session completes. LIMITATION: this is per-process memory; with more than one
 * backend instance, /documents and /complete for a session must hit the same instance (sticky
 * sessions) or this must be replaced by an encrypted shared cache (e.g. Redis with TTL).
 */

import { SESSION_TTL_MS } from './config';

interface Entry {
  faces: Map<string, string>; // docType -> face crop (base64 / data URL)
  expiresAt: number;
}

const store = new Map<string, Entry>();

function sweep(now = Date.now()): void {
  for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
}

const timer = setInterval(sweep, 60 * 1000);
if (typeof (timer as any).unref === 'function') (timer as any).unref();

export const FaceCache = {
  set(sessionId: string, docType: string, faceBase64: string, ttlMs = SESSION_TTL_MS): void {
    let e = store.get(sessionId);
    if (!e || e.expiresAt <= Date.now()) {
      e = { faces: new Map(), expiresAt: Date.now() + ttlMs };
      store.set(sessionId, e);
    }
    e.faces.set(docType, faceBase64);
  },

  remove(sessionId: string, docType: string): void {
    store.get(sessionId)?.faces.delete(docType);
  },

  list(sessionId: string): { docType: string; photoBase64: string }[] {
    const e = store.get(sessionId);
    if (!e) return [];
    if (e.expiresAt <= Date.now()) {
      store.delete(sessionId);
      return [];
    }
    return [...e.faces.entries()].map(([docType, photoBase64]) => ({ docType, photoBase64 }));
  },

  purge(sessionId: string): void {
    store.delete(sessionId);
  },

  size(): number {
    return store.size;
  },
};
