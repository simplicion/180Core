/**
 * 180 Identity - Biometrics client
 * Location: apps/180-core-backend/src/services/biometrics.service.ts
 *
 * Typed HTTP client for the Python face-biometrics engine in
 * apps/180-biometrics-service (SCRFD detection + ArcFace recognition +
 * MiniFASNet passive anti-spoof, all ONNX).
 *
 * Env:
 *   BIOMETRICS_SERVICE_URL      default http://127.0.0.1:8090
 *   BIOMETRICS_SERVICE_KEY      shared secret sent as X-Biometrics-Key
 *   BIOMETRICS_TIMEOUT_MS       default 15000
 *
 * There is deliberately NO local fallback: if the engine cannot be reached,
 * returns 5xx, rejects our key or returns a malformed body, callers get a
 * BiometricsUnavailableError and must not approve anything.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';

// --------------------------------------------------------------------------
// Errors
// --------------------------------------------------------------------------

export class BiometricsUnavailableError extends Error {
  code = 'BIOMETRICS_ENGINE_UNAVAILABLE';
  constructor(message = 'Biometrics engine is unavailable', cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'BiometricsUnavailableError';
  }
}

/** The engine rejected the request itself (bad / oversized image, too many frames...). HTTP 4xx. */
export class BiometricsRequestError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'BiometricsRequestError';
    this.status = status;
    this.code = code || 'BIOMETRICS_BAD_REQUEST';
  }
}

// --------------------------------------------------------------------------
// Types (public contract - other modules code against these)
// --------------------------------------------------------------------------

export interface FaceMatchComparisonItem {
  documentType: string;
  similarityScore: number;
  confidencePercentage: number;
  isMatch: boolean;
  faceFound: boolean;
}

export interface FaceMatchResult {
  overallMatch: boolean;
  overallConfidence: number;
  verdict: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
  comparisons: FaceMatchComparisonItem[];
  crossDocument: { a: string; b: string; similarity: number; consistent: boolean }[];
  mismatchReason?: string;
  thresholds: { match: number; review: number };
}

export interface DocumentFaceCropResult {
  hasFace: boolean;
  faceCount: number;
  faceBase64?: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export type LivenessStep = 'NEUTRAL' | 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SMILE';

export interface LivenessResult {
  passed: boolean;
  score: number;
  antiSpoofApplied: boolean;
  reasons: string[];
  perFrame: {
    step: LivenessStep;
    faceFound: boolean;
    faceCount: number;
    yaw: number;
    spoofScore: number | null;
    sameIdentityAsFirst: boolean;
  }[];
}

type BBox = { x: number; y: number; width: number; height: number };

// --------------------------------------------------------------------------
// Response validation helpers (throw BiometricsUnavailableError on mismatch)
// --------------------------------------------------------------------------

const LIVENESS_STEPS: readonly LivenessStep[] = ['NEUTRAL', 'BLINK', 'TURN_LEFT', 'TURN_RIGHT', 'SMILE'];
const VERDICTS = ['APPROVE', 'MANUAL_REVIEW', 'REJECT'] as const;

function bad(what: string): never {
  throw new BiometricsUnavailableError(`Biometrics engine returned a malformed response (${what})`);
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function num(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(what);
  return v as number;
}
function bool(v: unknown, what: string): boolean {
  if (typeof v !== 'boolean') bad(what);
  return v as boolean;
}
function str(v: unknown, what: string): string {
  if (typeof v !== 'string') bad(what);
  return v as string;
}
function arr(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) bad(what);
  return v as unknown[];
}
function obj(v: unknown, what: string): Record<string, unknown> {
  if (!isObj(v)) bad(what);
  return v as Record<string, unknown>;
}
function bbox(v: unknown, what: string): BBox {
  const o = obj(v, what);
  return {
    x: num(o.x, `${what}.x`),
    y: num(o.y, `${what}.y`),
    width: num(o.width, `${what}.width`),
    height: num(o.height, `${what}.height`),
  };
}

// --------------------------------------------------------------------------
// HTTP plumbing
// --------------------------------------------------------------------------

const DEFAULT_URL = 'http://127.0.0.1:8090';

function client(): AxiosInstance {
  // Read env lazily so dotenv load order / tests can change it.
  const baseURL = (process.env.BIOMETRICS_SERVICE_URL || DEFAULT_URL).replace(/\/+$/, '');
  const timeout = Number(process.env.BIOMETRICS_TIMEOUT_MS) || 15_000;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.BIOMETRICS_SERVICE_KEY) headers['X-Biometrics-Key'] = process.env.BIOMETRICS_SERVICE_KEY;
  return axios.create({
    baseURL,
    timeout,
    headers,
    maxBodyLength: 80 * 1024 * 1024,
    maxContentLength: 20 * 1024 * 1024,
    // Never let axios follow redirects off-box with image payloads.
    maxRedirects: 0,
  });
}

async function call(method: 'get' | 'post', path: string, body?: unknown): Promise<unknown> {
  try {
    const res = method === 'get' ? await client().get(path) : await client().post(path, body);
    return res.data;
  } catch (err) {
    const ax = err as AxiosError<any>;
    if (ax && ax.isAxiosError) {
      const status = ax.response?.status;
      if (status === undefined) {
        // ECONNREFUSED, timeout, DNS, socket reset...
        throw new BiometricsUnavailableError(
          `Biometrics engine unreachable (${ax.code || 'network error'})`,
          err
        );
      }
      if (status >= 500 || status === 401 || status === 403) {
        // 401/403 = key misconfiguration between backend and engine -> treat as outage.
        throw new BiometricsUnavailableError(`Biometrics engine error (HTTP ${status})`, err);
      }
      const data = ax.response?.data;
      const detail = isObj(data) && isObj(data.detail) ? data.detail : data;
      const code = isObj(detail) && typeof detail.error === 'string' ? detail.error : 'BIOMETRICS_BAD_REQUEST';
      const message =
        isObj(detail) && typeof detail.message === 'string' ? detail.message : `Biometrics request rejected (HTTP ${status})`;
      throw new BiometricsRequestError(status, code, message);
    }
    throw new BiometricsUnavailableError('Biometrics engine call failed', err);
  }
}

/** Accepts raw base64 or a data URL; the engine strips `data:image/...;base64,` itself. */
function requireImage(image: string, what: string): string {
  if (typeof image !== 'string' || image.trim().length === 0) {
    throw new BiometricsRequestError(400, 'INVALID_IMAGE', `${what} image is empty`);
  }
  return image;
}

// --------------------------------------------------------------------------
// Service
// --------------------------------------------------------------------------

export class BiometricsService {
  static async health(): Promise<{ ok: boolean; models: { detector: boolean; recognizer: boolean; antiSpoof: boolean } }> {
    const d = obj(await call('get', '/health'), 'health');
    const m = obj(d.models, 'health.models');
    const models = {
      detector: bool(m.detector, 'models.detector'),
      recognizer: bool(m.recognizer, 'models.recognizer'),
      antiSpoof: bool(m.antiSpoof, 'models.antiSpoof'),
    };
    return { ok: d.status === 'ok' && models.detector && models.recognizer, models };
  }

  static async detect(image: string): Promise<{
    imageWidth: number;
    imageHeight: number;
    faces: { bbox: BBox; score: number; yaw: number; pitch: number }[];
  }> {
    const d = obj(await call('post', '/v1/detect', { image: requireImage(image, 'detect') }), 'detect');
    return {
      imageWidth: num(d.imageWidth, 'imageWidth'),
      imageHeight: num(d.imageHeight, 'imageHeight'),
      faces: arr(d.faces, 'faces').map((f, i) => {
        const o = obj(f, `faces[${i}]`);
        return {
          bbox: bbox(o.bbox, `faces[${i}].bbox`),
          score: num(o.score, `faces[${i}].score`),
          yaw: num(o.yaw, `faces[${i}].yaw`),
          pitch: num(o.pitch, `faces[${i}].pitch`),
        };
      }),
    };
  }

  static async extractFaceFromDocument(image: string): Promise<DocumentFaceCropResult> {
    const d = obj(await call('post', '/v1/extract-face', { image: requireImage(image, 'document') }), 'extract-face');
    const out: DocumentFaceCropResult = {
      hasFace: bool(d.hasFace, 'hasFace'),
      faceCount: num(d.faceCount, 'faceCount'),
      confidence: num(d.confidence, 'confidence'),
    };
    if (out.hasFace) {
      out.faceBase64 = str(d.faceBase64, 'faceBase64');
      out.boundingBox = bbox(d.boundingBox, 'boundingBox');
    }
    return out;
  }

  static async evaluateLiveness(frames: { step: LivenessStep; image: string }[]): Promise<LivenessResult> {
    if (!Array.isArray(frames) || frames.length === 0) {
      throw new BiometricsRequestError(400, 'NO_FRAMES', 'At least one liveness frame is required');
    }
    const body = {
      frames: frames.map((f, i) => {
        if (!LIVENESS_STEPS.includes(f.step)) {
          throw new BiometricsRequestError(400, 'INVALID_STEP', `Invalid liveness step at frame ${i}`);
        }
        return { step: f.step, image: requireImage(f.image, `frame ${i}`) };
      }),
    };
    const d = obj(await call('post', '/v1/liveness', body), 'liveness');
    return {
      passed: bool(d.passed, 'passed'),
      score: num(d.score, 'score'),
      antiSpoofApplied: bool(d.antiSpoofApplied, 'antiSpoofApplied'),
      reasons: arr(d.reasons, 'reasons').map((r, i) => str(r, `reasons[${i}]`)),
      perFrame: arr(d.perFrame, 'perFrame').map((p, i) => {
        const o = obj(p, `perFrame[${i}]`);
        const step = str(o.step, `perFrame[${i}].step`) as LivenessStep;
        if (!LIVENESS_STEPS.includes(step)) bad(`perFrame[${i}].step`);
        return {
          step,
          faceFound: bool(o.faceFound, `perFrame[${i}].faceFound`),
          faceCount: num(o.faceCount, `perFrame[${i}].faceCount`),
          yaw: num(o.yaw, `perFrame[${i}].yaw`),
          spoofScore: o.spoofScore === null ? null : num(o.spoofScore, `perFrame[${i}].spoofScore`),
          sameIdentityAsFirst: bool(o.sameIdentityAsFirst, `perFrame[${i}].sameIdentityAsFirst`),
        };
      }),
    };
  }

  static async matchFaces(
    probeImage: string,
    references: { docType: string; photoBase64: string }[]
  ): Promise<FaceMatchResult> {
    if (!Array.isArray(references) || references.length === 0) {
      throw new BiometricsRequestError(400, 'NO_REFERENCES', 'At least one reference document photo is required');
    }
    const body = {
      probe: requireImage(probeImage, 'probe'),
      references: references.map((r) => ({
        docType: String(r.docType || 'UNKNOWN'),
        image: requireImage(r.photoBase64, `reference ${r.docType}`),
      })),
    };
    const d = obj(await call('post', '/v1/match', body), 'match');
    const verdict = str(d.verdict, 'verdict') as FaceMatchResult['verdict'];
    if (!VERDICTS.includes(verdict)) bad('verdict');
    const t = obj(d.thresholds, 'thresholds');
    const result: FaceMatchResult = {
      overallMatch: bool(d.overallMatch, 'overallMatch'),
      overallConfidence: num(d.overallConfidence, 'overallConfidence'),
      verdict,
      comparisons: arr(d.comparisons, 'comparisons').map((c, i) => {
        const o = obj(c, `comparisons[${i}]`);
        return {
          documentType: str(o.documentType, `comparisons[${i}].documentType`),
          similarityScore: num(o.similarityScore, `comparisons[${i}].similarityScore`),
          confidencePercentage: num(o.confidencePercentage, `comparisons[${i}].confidencePercentage`),
          isMatch: bool(o.isMatch, `comparisons[${i}].isMatch`),
          faceFound: bool(o.faceFound, `comparisons[${i}].faceFound`),
        };
      }),
      crossDocument: arr(d.crossDocument, 'crossDocument').map((c, i) => {
        const o = obj(c, `crossDocument[${i}]`);
        return {
          a: str(o.a, `crossDocument[${i}].a`),
          b: str(o.b, `crossDocument[${i}].b`),
          similarity: num(o.similarity, `crossDocument[${i}].similarity`),
          consistent: bool(o.consistent, `crossDocument[${i}].consistent`),
        };
      }),
      thresholds: { match: num(t.match, 'thresholds.match'), review: num(t.review, 'thresholds.review') },
    };
    if (d.mismatchReason !== undefined && d.mismatchReason !== null) {
      result.mismatchReason = str(d.mismatchReason, 'mismatchReason');
    }
    // Defence in depth: never report APPROVE without a consistent overallMatch.
    if (result.verdict === 'APPROVE' && !result.overallMatch) bad('verdict/overallMatch mismatch');
    return result;
  }
}

export default BiometricsService;
