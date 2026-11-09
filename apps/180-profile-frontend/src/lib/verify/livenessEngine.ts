/**
 * 180 Verify — active-liveness state machine (pure, deterministic, no runtime imports).
 *
 * The camera component feeds one FaceObservation per processed video frame; the engine decides
 * guidance, when to capture frames and when to abort. Keeping it pure makes it unit-testable
 * with synthetic observations (see __tests__/verify-pure.test.mjs).
 */
import type { ChallengeStep } from './types';

export interface FaceObservation {
  faceCount: number;
  /** Degrees; positive = user turned to their OWN LEFT (see headPose.ts). */
  yaw: number;
  roll: number;
  /** Nose vertical ratio (forehead→chin), null if unknown. */
  noseV: number | null;
  blinkL: number;
  blinkR: number;
  smileL: number;
  smileR: number;
  /** Face-box centre in container-normalised coords (0–1). Mirroring does not matter for centring. */
  cx: number;
  cy: number;
  /** Face-box width divided by the oval guide width. */
  widthRatio: number;
  /** Mean face luminance 0–255, or null when not sampled on this frame. */
  brightness: number | null;
}

export const LIVENESS_T = {
  ovalCx: 0.5,
  ovalCy: 0.46,
  centerTol: 0.13,
  widthMin: 0.55,
  widthMax: 1.08,
  /** Looser size floor during the action steps (turning narrows the face box). */
  stepWidthMin: 0.38,
  brightnessMin: 55,
  brightnessMax: 225,
  frontalYawMax: 10,
  frontalRollMax: 12,
  noseVMin: 0.36,
  noseVMax: 0.8,
  neutralYawMax: 8,
  neutralRollMax: 10,
  neutralExpressionMax: 0.35,
  alignHoldMs: 800,
  neutralHoldMs: 500,
  turnYawDeg: 18,
  turnHoldMs: 120,
  blinkClosed: 0.5,
  blinkOpen: 0.25,
  /** A "blink" held closed longer than this is not a blink — re-arm. */
  blinkMaxClosedMs: 1500,
  smileMin: 0.6,
  smileEachMin: 0.4,
  smileHoldMs: 150,
  stepMinDwellMs: 350,
  stepTimeoutMs: 8000,
  faceLostAbortMs: 1500,
  multiFaceFramesAbort: 2,
};

export type Guidance =
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'MOVE_CLOSER'
  | 'MOVE_BACK'
  | 'CENTER'
  | 'TOO_DARK'
  | 'TOO_BRIGHT'
  | 'LOOK_STRAIGHT'
  | 'HOLD_STILL'
  | 'DO_STEP'
  | 'DONE';

export type EnginePhase = 'ALIGN' | 'STEPS' | 'STEP_TIMEOUT' | 'DONE' | 'ABORTED';
export type AbortReason = 'FACE_LOST' | 'MULTIPLE_FACES';

// --- Blink sub-machine ------------------------------------------------------

export type BlinkPhase = 'WAIT_OPEN' | 'OPEN' | 'CLOSED' | 'DONE';

export interface BlinkState {
  phase: BlinkPhase;
  closedAt: number | null;
}

export function initialBlink(): BlinkState {
  return { phase: 'WAIT_OPEN', closedAt: null };
}

/**
 * WAIT_OPEN → OPEN (both eyes open) → CLOSED (both eyeBlink > closed) → DONE (both back below open).
 * DONE fires on the first eyes-open frame after the blink, which is the frame we capture.
 */
export function stepBlink(s: BlinkState, blinkL: number, blinkR: number, now: number, t = LIVENESS_T): BlinkState {
  const bothOpen = blinkL < t.blinkOpen && blinkR < t.blinkOpen;
  const bothClosed = blinkL > t.blinkClosed && blinkR > t.blinkClosed;
  switch (s.phase) {
    case 'WAIT_OPEN':
      return bothOpen ? { phase: 'OPEN', closedAt: null } : s;
    case 'OPEN':
      return bothClosed ? { phase: 'CLOSED', closedAt: now } : s;
    case 'CLOSED':
      if (s.closedAt !== null && now - s.closedAt > t.blinkMaxClosedMs) return { phase: 'WAIT_OPEN', closedAt: null };
      return bothOpen ? { phase: 'DONE', closedAt: s.closedAt } : s;
    default:
      return s;
  }
}

// --- Main engine ------------------------------------------------------------

export interface EngineState {
  phase: EnginePhase;
  steps: ChallengeStep[];
  stepIndex: number;
  stepStartedAt: number;
  alignOkSince: number | null;
  holdSince: number | null;
  blink: BlinkState;
  lastFaceAt: number;
  multiFaceFrames: number;
  brightness: number | null;
  guidance: Guidance;
  abortReason: AbortReason | null;
}

export type EngineEvent =
  | { type: 'CAPTURE_SELFIE' }
  | { type: 'CAPTURE_STEP'; step: ChallengeStep; index: number }
  | { type: 'STEP_TIMEOUT'; step: ChallengeStep; index: number }
  | { type: 'ABORT'; reason: AbortReason }
  | { type: 'DONE' };

export function createEngine(steps: ChallengeStep[], now: number): EngineState {
  return {
    phase: 'ALIGN',
    steps: steps.slice(),
    stepIndex: 0,
    stepStartedAt: now,
    alignOkSince: null,
    holdSince: null,
    blink: initialBlink(),
    lastFaceAt: now,
    multiFaceFrames: 0,
    brightness: null,
    guidance: 'NO_FACE',
    abortReason: null,
  };
}

export function currentStep(s: EngineState): ChallengeStep | null {
  return s.phase === 'STEPS' || s.phase === 'STEP_TIMEOUT' ? s.steps[s.stepIndex] ?? null : null;
}

/** Restart the current step after a timeout (same challenge). */
export function retryStep(s: EngineState, now: number): EngineState {
  if (s.phase !== 'STEP_TIMEOUT') return s;
  return { ...s, phase: 'STEPS', stepStartedAt: now, holdSince: null, blink: initialBlink(), lastFaceAt: now, guidance: 'DO_STEP' };
}

function positionGuidance(o: FaceObservation, widthMin: number, t: typeof LIVENESS_T): Guidance | null {
  if (o.widthRatio < widthMin) return 'MOVE_CLOSER';
  if (o.widthRatio > t.widthMax) return 'MOVE_BACK';
  if (Math.abs(o.cx - t.ovalCx) > t.centerTol || Math.abs(o.cy - t.ovalCy) > t.centerTol) return 'CENTER';
  return null;
}

function isFrontal(o: FaceObservation, yawMax: number, rollMax: number, t: typeof LIVENESS_T): boolean {
  const pitchOk = o.noseV === null || (o.noseV >= t.noseVMin && o.noseV <= t.noseVMax);
  return Math.abs(o.yaw) <= yawMax && Math.abs(o.roll) <= rollMax && pitchOk;
}

export function advanceEngine(
  prev: EngineState,
  o: FaceObservation,
  now: number,
  t = LIVENESS_T,
): { state: EngineState; events: EngineEvent[] } {
  if (prev.phase === 'DONE' || prev.phase === 'ABORTED' || prev.phase === 'STEP_TIMEOUT') return { state: prev, events: [] };

  const s: EngineState = { ...prev };
  const events: EngineEvent[] = [];
  if (o.brightness !== null) s.brightness = o.brightness;

  // ---- presence / multi-face bookkeeping (both phases) ----
  if (o.faceCount >= 2) {
    s.multiFaceFrames += 1;
    s.guidance = 'MULTIPLE_FACES';
    s.alignOkSince = null;
    s.holdSince = null;
    if (s.phase === 'STEPS' && s.multiFaceFrames >= t.multiFaceFramesAbort) {
      s.phase = 'ABORTED';
      s.abortReason = 'MULTIPLE_FACES';
      events.push({ type: 'ABORT', reason: 'MULTIPLE_FACES' });
    }
    return { state: s, events };
  }
  s.multiFaceFrames = 0;

  if (o.faceCount === 0) {
    s.guidance = 'NO_FACE';
    s.alignOkSince = null;
    s.holdSince = null;
    if (s.phase === 'STEPS' && now - s.lastFaceAt > t.faceLostAbortMs) {
      s.phase = 'ABORTED';
      s.abortReason = 'FACE_LOST';
      events.push({ type: 'ABORT', reason: 'FACE_LOST' });
    }
    return { state: s, events };
  }
  s.lastFaceAt = now;

  // ---- ALIGN: one centred, well-lit, frontal face held still ----
  if (s.phase === 'ALIGN') {
    let g = positionGuidance(o, t.widthMin, t);
    if (!g && s.brightness !== null && s.brightness < t.brightnessMin) g = 'TOO_DARK';
    if (!g && s.brightness !== null && s.brightness > t.brightnessMax) g = 'TOO_BRIGHT';
    if (!g && !isFrontal(o, t.frontalYawMax, t.frontalRollMax, t)) g = 'LOOK_STRAIGHT';
    if (g) {
      s.guidance = g;
      s.alignOkSince = null;
      return { state: s, events };
    }
    if (s.alignOkSince === null) s.alignOkSince = now;
    s.guidance = 'HOLD_STILL';
    if (now - s.alignOkSince >= t.alignHoldMs && s.brightness !== null) {
      events.push({ type: 'CAPTURE_SELFIE' });
      s.phase = s.steps.length ? 'STEPS' : 'DONE';
      s.stepIndex = 0;
      s.stepStartedAt = now;
      s.holdSince = null;
      s.blink = initialBlink();
      s.guidance = s.steps.length ? 'DO_STEP' : 'DONE';
      if (!s.steps.length) events.push({ type: 'DONE' });
    }
    return { state: s, events };
  }

  // ---- STEPS ----
  const step = s.steps[s.stepIndex];
  if (now - s.stepStartedAt > t.stepTimeoutMs) {
    s.phase = 'STEP_TIMEOUT';
    events.push({ type: 'STEP_TIMEOUT', step, index: s.stepIndex });
    return { state: s, events };
  }

  const posIssue = positionGuidance(o, t.stepWidthMin, t);
  if (posIssue === 'MOVE_CLOSER' || posIssue === 'MOVE_BACK') {
    s.guidance = posIssue;
    s.holdSince = null;
    return { state: s, events };
  }
  s.guidance = 'DO_STEP';

  const dwellOk = now - s.stepStartedAt >= t.stepMinDwellMs;
  let met = false;

  const held = (cond: boolean, holdMs: number) => {
    if (!cond) {
      s.holdSince = null;
      return false;
    }
    if (s.holdSince === null) s.holdSince = now;
    return now - s.holdSince >= holdMs;
  };

  switch (step) {
    case 'NEUTRAL': {
      const calm =
        isFrontal(o, t.neutralYawMax, t.neutralRollMax, t) &&
        Math.max(o.blinkL, o.blinkR) < t.neutralExpressionMax &&
        Math.max(o.smileL, o.smileR) < t.neutralExpressionMax &&
        posIssue === null;
      met = held(calm, t.neutralHoldMs);
      break;
    }
    case 'BLINK': {
      s.blink = stepBlink(s.blink, o.blinkL, o.blinkR, now, t);
      met = s.blink.phase === 'DONE';
      break;
    }
    case 'TURN_LEFT':
      met = held(o.yaw >= t.turnYawDeg, t.turnHoldMs);
      break;
    case 'TURN_RIGHT':
      met = held(o.yaw <= -t.turnYawDeg, t.turnHoldMs);
      break;
    case 'SMILE': {
      const avg = (o.smileL + o.smileR) / 2;
      met = held(avg >= t.smileMin && Math.min(o.smileL, o.smileR) >= t.smileEachMin, t.smileHoldMs);
      break;
    }
    default:
      met = false;
  }

  if (met && dwellOk) {
    events.push({ type: 'CAPTURE_STEP', step, index: s.stepIndex });
    s.stepIndex += 1;
    s.stepStartedAt = now;
    s.holdSince = null;
    s.blink = initialBlink();
    if (s.stepIndex >= s.steps.length) {
      s.phase = 'DONE';
      s.guidance = 'DONE';
      events.push({ type: 'DONE' });
    }
  } else if (met && !dwellOk && step === 'BLINK') {
    // Blink completed suspiciously fast after the step started (likely carried over) — re-arm.
    s.blink = initialBlink();
  }

  return { state: s, events };
}
