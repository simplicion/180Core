/**
 * 180 Verify - thin port over BiometricsService so the session flow can be tested with a fake
 * engine and tolerates the sync -> async transition of biometrics.service.ts.
 *
 * Contract (implemented by services/biometrics.service.ts):
 *   extractFaceFromDocument(image) -> { hasFace, faceCount, faceBase64?, confidence, boundingBox? }
 *   evaluateLiveness(frames)       -> { passed, score, antiSpoofApplied, reasons, perFrame }
 *   matchFaces(probe, refs)        -> { overallMatch, overallConfidence, verdict, comparisons, crossDocument, mismatchReason?, thresholds }
 *   health()                       -> { ok, models }
 * Errors with code 'BIOMETRICS_ENGINE_UNAVAILABLE' map to HTTP 503.
 */

import * as BiometricsModule from '../biometrics.service';

export type LivenessStep = 'NEUTRAL' | 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SMILE';

export interface FaceExtraction {
  hasFace: boolean;
  faceCount: number;
  faceBase64?: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface LivenessEvaluation {
  passed: boolean;
  score: number;
  antiSpoofApplied: boolean;
  reasons: string[];
  perFrame: any[];
}

export interface FaceMatchEvaluation {
  overallMatch: boolean;
  overallConfidence: number;
  verdict: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
  comparisons: { documentType: string; similarityScore: number; confidencePercentage: number; isMatch: boolean; faceFound: boolean }[];
  crossDocument?: any[];
  mismatchReason?: string;
  thresholds?: any;
}

export interface BiometricsPort {
  extractFaceFromDocument(image: string): Promise<FaceExtraction>;
  evaluateLiveness(frames: { step: LivenessStep; image: string }[]): Promise<LivenessEvaluation>;
  matchFaces(probe: string, references: { docType: string; photoBase64: string }[]): Promise<FaceMatchEvaluation>;
  health(): Promise<{ ok: boolean; models: any }>;
}

class EngineUnavailable extends Error {
  code = 'BIOMETRICS_ENGINE_UNAVAILABLE';
  constructor(msg: string) {
    super(msg);
    this.name = 'BiometricsUnavailableError';
  }
}

function resolveService(): any {
  const mod: any = BiometricsModule;
  return mod.BiometricsService || mod.default;
}

function call(method: string, ...args: any[]): Promise<any> {
  const svc = resolveService();
  if (!svc || typeof svc[method] !== 'function') {
    return Promise.reject(new EngineUnavailable(`BiometricsService.${method} is not available.`));
  }
  try {
    return Promise.resolve(svc[method](...args));
  } catch (err) {
    return Promise.reject(err);
  }
}

const defaultPort: BiometricsPort = {
  extractFaceFromDocument: (image) => call('extractFaceFromDocument', image),
  evaluateLiveness: (frames) => call('evaluateLiveness', frames),
  matchFaces: (probe, refs) => call('matchFaces', probe, refs),
  health: () => call('health'),
};

let override: BiometricsPort | null = null;

export function biometrics(): BiometricsPort {
  return override || defaultPort;
}

/** Test hook. Pass null to restore the real engine. */
export function setBiometricsPort(port: BiometricsPort | null): void {
  override = port;
}
