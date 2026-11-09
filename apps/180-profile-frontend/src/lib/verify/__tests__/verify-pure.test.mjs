/**
 * 180 Verify — unit tests for the pure helpers (no browser needed).
 *
 *   node --test src/lib/verify/__tests__/        (Node ≥ 22.18 / 23.6 — native TypeScript type-stripping)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  laplacianVariance,
  meanAbsDiff,
  luminanceStats,
  edgeCoverage,
  evaluateDocFrame,
  containerRectToSource,
  cardGuideRect,
  ID1_ASPECT,
} from '../imageQuality.ts';
import { estimateYawDeg, estimateYawFromDepthDeg, noseCheekRatio, estimateRollDeg } from '../headPose.ts';
import { stepBlink, initialBlink, createEngine, advanceEngine, retryStep, LIVENESS_T } from '../livenessEngine.ts';
import { planFromDocuments, validateDocNumber, validateDob, maskAadhaar } from '../docTypes.ts';

// ---------- helpers ----------
function checkerboard(w, h, cell) {
  const g = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) * 255;
  return g;
}
function boxBlur(g, w, h, r) {
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          s += g[yy * w + xx];
          n++;
        }
      out[y * w + x] = s / n;
    }
  return out;
}

// ---------- sharpness ----------
test('laplacian variance: flat image is 0', () => {
  assert.equal(laplacianVariance(new Uint8ClampedArray(64 * 64).fill(128), 64, 64), 0);
});

test('laplacian variance: sharp > blurred > more blurred', () => {
  const w = 96;
  const h = 64;
  const sharp = checkerboard(w, h, 6);
  const b1 = boxBlur(sharp, w, h, 1);
  const b3 = boxBlur(sharp, w, h, 3);
  const vs = laplacianVariance(sharp, w, h);
  const v1 = laplacianVariance(b1, w, h);
  const v3 = laplacianVariance(b3, w, h);
  assert.ok(vs > v1 && v1 > v3, `${vs} > ${v1} > ${v3}`);
  assert.ok(vs > 1000);
  assert.ok(v3 < vs / 10);
});

test('meanAbsDiff and luminance stats', () => {
  const a = new Uint8ClampedArray([0, 10, 20, 30]);
  const b = new Uint8ClampedArray([0, 20, 20, 50]);
  assert.equal(meanAbsDiff(a, b), 7.5);
  const lum = luminanceStats(new Uint8ClampedArray([255, 255, 0, 100]));
  assert.equal(lum.saturatedFraction, 0.5);
  assert.equal(lum.mean, 152.5);
});

test('edge coverage: full-frame texture ≈ 0.9, centred small patch is small', () => {
  const w = 100;
  const h = 60;
  const full = checkerboard(w, h, 4);
  const cov = edgeCoverage(full, w, h);
  assert.ok(cov.x > 0.85, `x=${cov.x}`);
  const small = new Uint8ClampedArray(w * h).fill(100);
  for (let y = 25; y < 35; y++) for (let x = 40; x < 60; x++) small[y * w + x] = (x + y) % 2 ? 255 : 0;
  const cs = edgeCoverage(small, w, h);
  assert.ok(cs.x < 0.3, `x=${cs.x}`);
});

test('evaluateDocFrame ordering and readiness', () => {
  const good = {
    sharpness: 300,
    recentMaxSharpness: 320,
    lum: { mean: 140, saturatedFraction: 0.001, darkFraction: 0 },
    coverage: { x: 0.9, y: 0.85, density: 0.1 },
    stillForMs: 800,
    facePresent: true,
  };
  assert.equal(evaluateDocFrame(good).ready, true);
  assert.equal(evaluateDocFrame({ ...good, stillForMs: 300 }).issue, 'MOVING');
  assert.equal(evaluateDocFrame({ ...good, lum: { ...good.lum, saturatedFraction: 0.1 } }).issue, 'GLARE');
  assert.equal(evaluateDocFrame({ ...good, coverage: { x: 0.4, y: 0.4, density: 0.05 } }).issue, 'TOO_FAR');
  assert.equal(evaluateDocFrame({ ...good, sharpness: 40 }).issue, 'BLURRY');
  assert.equal(evaluateDocFrame({ ...good, facePresent: false }).issue, 'NO_FACE');
  assert.equal(evaluateDocFrame({ ...good, facePresent: null }).ready, true);
  assert.equal(evaluateDocFrame({ ...good, lum: { ...good.lum, mean: 30 } }).issue, 'TOO_DARK');
});

test('cover mapping: guide rect maps into source pixels', () => {
  // 1080x1920 portrait video shown in a 360x270 box (object-fit: cover)
  const g = cardGuideRect(360, 270);
  assert.ok(Math.abs(g.w / g.h - ID1_ASPECT) < 1e-9);
  const s = containerRectToSource(g, 1080, 1920, 360, 270);
  assert.ok(Math.abs(s.w / s.h - ID1_ASPECT) < 1e-6);
  assert.ok(s.x >= 0 && s.x + s.w <= 1080 && s.y >= 0 && s.y + s.h <= 1920);
  // centred vertically in source
  assert.ok(Math.abs(s.y + s.h / 2 - 960) < 1);
});

// ---------- yaw sign ----------
/**
 * Synthesises landmarks for a head rotated by `yawDeg` about the vertical axis, projected orthographically
 * into the RAW (unmirrored) frame. Head space: +x = image right when frontal, +d = toward the camera.
 * Positive yaw rotates the nose toward +x (image right) == user turns to THEIR OWN LEFT.
 */
function headLandmarks(yawDeg) {
  const t = (yawDeg * Math.PI) / 180;
  const W = 7.6; // half face width (canonical units)
  const proj = (x, y, d) => {
    const xr = x * Math.cos(t) + d * Math.sin(t);
    const dr = -x * Math.sin(t) + d * Math.cos(t);
    return { x: 0.5 + xr / 40, y: 0.5 + y / 40, z: -dr / 40 }; // MediaPipe z: smaller = closer
  };
  const lm = [];
  lm[1] = proj(0, 0, 7.6); // nose tip
  lm[234] = proj(-W, -1, 0); // subject-right cheek → image left
  lm[454] = proj(W, -1, 0); // subject-left cheek → image right
  lm[33] = proj(-4.5, -3, 3);
  lm[263] = proj(4.5, -3, 3);
  lm[10] = proj(0, -9, 4);
  lm[152] = proj(0, 9, 3);
  return lm;
}

test('yaw ≈ 0 when frontal', () => {
  assert.ok(Math.abs(estimateYawDeg(headLandmarks(0))) < 0.5);
  assert.ok(Math.abs(noseCheekRatio(headLandmarks(0)) - 0.5) < 1e-9);
});

test('TURN_LEFT (user turns to own left → nose to IMAGE RIGHT) gives positive yaw', () => {
  const lm = headLandmarks(25);
  assert.ok(lm[1].x > 0.5, 'nose moved toward image right');
  const yaw = estimateYawDeg(lm);
  assert.ok(yaw > LIVENESS_T.turnYawDeg, `yaw=${yaw}`);
  assert.ok(estimateYawFromDepthDeg(lm) > 15, 'depth cross-check agrees');
});

test('TURN_RIGHT gives negative yaw beyond threshold', () => {
  const yaw = estimateYawDeg(headLandmarks(-25));
  assert.ok(yaw < -LIVENESS_T.turnYawDeg, `yaw=${yaw}`);
  assert.ok(estimateYawFromDepthDeg(headLandmarks(-25)) < -15);
});

test('yaw estimate tracks true yaw within a few degrees and is index-order independent', () => {
  for (const deg of [-30, -18, -10, 10, 18, 30]) {
    const est = estimateYawDeg(headLandmarks(deg));
    assert.ok(Math.abs(est - deg) < 3, `true=${deg} est=${est}`);
    const swapped = headLandmarks(deg);
    [swapped[234], swapped[454]] = [swapped[454], swapped[234]];
    assert.ok(Math.abs(estimateYawDeg(swapped) - est) < 1e-9);
  }
});

test('mirroring the frame flips the sign (why we must use the RAW frame)', () => {
  const lm = headLandmarks(25).map((p) => (p ? { ...p, x: 1 - p.x } : p));
  assert.ok(estimateYawDeg(lm) < -LIVENESS_T.turnYawDeg);
});

test('roll ≈ 0 for level eyes', () => {
  assert.ok(Math.abs(estimateRollDeg(headLandmarks(0), 640, 480)) < 0.5);
});

// ---------- blink state machine ----------
test('blink: open → closed → open completes; capture on reopen frame', () => {
  let s = initialBlink();
  s = stepBlink(s, 0.6, 0.6, 0); // starts closed: must wait for open first
  assert.equal(s.phase, 'WAIT_OPEN');
  s = stepBlink(s, 0.05, 0.08, 10);
  assert.equal(s.phase, 'OPEN');
  s = stepBlink(s, 0.3, 0.3, 20); // half-closed: nothing
  assert.equal(s.phase, 'OPEN');
  s = stepBlink(s, 0.7, 0.8, 30);
  assert.equal(s.phase, 'CLOSED');
  s = stepBlink(s, 0.3, 0.1, 40); // one eye still partly closed
  assert.equal(s.phase, 'CLOSED');
  s = stepBlink(s, 0.1, 0.1, 50);
  assert.equal(s.phase, 'DONE');
});

test('blink: one-eye wink does not count', () => {
  let s = stepBlink(initialBlink(), 0.05, 0.05, 0);
  s = stepBlink(s, 0.9, 0.05, 10);
  assert.equal(s.phase, 'OPEN');
});

test('blink: eyes held shut too long re-arms', () => {
  let s = stepBlink(initialBlink(), 0.05, 0.05, 0);
  s = stepBlink(s, 0.9, 0.9, 100);
  s = stepBlink(s, 0.9, 0.9, 100 + LIVENESS_T.blinkMaxClosedMs + 1);
  assert.equal(s.phase, 'WAIT_OPEN');
});

// ---------- engine ----------
const baseObs = {
  faceCount: 1,
  yaw: 0,
  roll: 0,
  noseV: 0.55,
  blinkL: 0.05,
  blinkR: 0.05,
  smileL: 0.05,
  smileR: 0.05,
  cx: 0.5,
  cy: 0.46,
  widthRatio: 0.8,
  brightness: 130,
};

function run(state, frames) {
  const events = [];
  for (const [t, o] of frames) {
    const r = advanceEngine(state, { ...baseObs, ...o }, t);
    state = r.state;
    events.push(...r.events.map((e) => ({ ...e, t })));
  }
  return { state, events };
}

test('engine: align → selfie → BLINK → TURN_LEFT → SMILE → done', () => {
  let s = createEngine(['BLINK', 'TURN_LEFT', 'SMILE'], 0);
  const frames = [];
  let t = 0;
  for (; t <= 900; t += 66) frames.push([t, {}]); // align hold
  for (let i = 0; i < 6; i++) frames.push([(t += 66), {}]); // dwell, eyes open
  frames.push([(t += 66), { blinkL: 0.8, blinkR: 0.75 }]);
  frames.push([(t += 66), { blinkL: 0.1, blinkR: 0.1 }]); // reopen → capture
  for (let i = 0; i < 6; i++) frames.push([(t += 66), { yaw: 25 }]);
  for (let i = 0; i < 6; i++) frames.push([(t += 66), { smileL: 0.8, smileR: 0.75 }]);
  const r = run(s, frames);
  const types = r.events.map((e) => (e.type === 'CAPTURE_STEP' ? `${e.type}:${e.step}` : e.type));
  assert.deepEqual(types, ['CAPTURE_SELFIE', 'CAPTURE_STEP:BLINK', 'CAPTURE_STEP:TURN_LEFT', 'CAPTURE_STEP:SMILE', 'DONE']);
  assert.equal(r.state.phase, 'DONE');
});

test('engine: TURN_LEFT is not satisfied by turning right', () => {
  let s = createEngine(['TURN_LEFT'], 0);
  const frames = [];
  let t = 0;
  for (; t <= 900; t += 66) frames.push([t, {}]);
  for (let i = 0; i < 20; i++) frames.push([(t += 66), { yaw: -30 }]);
  const r = run(s, frames);
  assert.ok(!r.events.some((e) => e.type === 'CAPTURE_STEP'));
});

test('engine: face lost > 1.5s during steps aborts; brief loss does not', () => {
  let s = createEngine(['SMILE'], 0);
  const frames = [];
  let t = 0;
  for (; t <= 900; t += 66) frames.push([t, {}]);
  frames.push([(t += 66), { faceCount: 0 }]);
  frames.push([(t += 500), { faceCount: 0 }]);
  frames.push([(t += 66), {}]); // back
  let r = run(s, frames);
  assert.ok(!r.events.some((e) => e.type === 'ABORT'));
  r = run(r.state, [[t + 100, { faceCount: 0 }], [t + 1700, { faceCount: 0 }]]);
  assert.deepEqual(r.events.map((e) => e.type), ['ABORT']);
  assert.equal(r.state.abortReason, 'FACE_LOST');
});

test('engine: two faces during steps aborts', () => {
  let s = createEngine(['BLINK'], 0);
  const frames = [];
  let t = 0;
  for (; t <= 900; t += 66) frames.push([t, {}]);
  frames.push([(t += 66), { faceCount: 2 }]);
  frames.push([(t += 66), { faceCount: 2 }]);
  const r = run(s, frames);
  assert.equal(r.state.abortReason, 'MULTIPLE_FACES');
});

test('engine: step timeout after 8s, then retry resumes', () => {
  let s = createEngine(['SMILE'], 0);
  const frames = [];
  let t = 0;
  for (; t <= 900; t += 66) frames.push([t, {}]);
  for (let i = 0; i < 130; i++) frames.push([(t += 66), {}]);
  let r = run(s, frames);
  assert.equal(r.state.phase, 'STEP_TIMEOUT');
  s = retryStep(r.state, t + 10);
  r = run(s, [
    [t + 400, { smileL: 0.8, smileR: 0.8 }],
    [t + 470, { smileL: 0.8, smileR: 0.8 }],
    [t + 640, { smileL: 0.8, smileR: 0.8 }],
  ]);
  assert.ok(r.events.some((e) => e.type === 'DONE'));
});

test('engine: alignment requires centred, sized, lit, frontal face', () => {
  let s = createEngine(['NEUTRAL'], 0);
  const r = run(s, [
    [0, { widthRatio: 0.3 }],
    [100, { cx: 0.8 }],
    [200, { brightness: 20 }],
    [300, { yaw: 25 }],
  ]);
  assert.equal(r.state.phase, 'ALIGN');
  assert.equal(r.state.guidance, 'LOOK_STRAIGHT');
});

// ---------- doc validation ----------
test('document request plan + validation', () => {
  const p = planFromDocuments(['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH', 'VOTER', 'XYZ']);
  assert.deepEqual(p.docs.map((d) => d.kind), ['PAN', 'DL', 'VOTER_ID']);
  assert.equal(p.docs[1].raw, 'DRIVING_LICENSE');
  assert.equal(p.bank, true);
  assert.deepEqual(p.unknown, ['XYZ']);
  assert.equal(validateDocNumber('PAN', 'abcde1234f'), null);
  assert.ok(validateDocNumber('PAN', 'ABCD1234F'));
  assert.equal(validateDocNumber('VOTER_ID', 'ABC1234567'), null);
  assert.equal(validateDocNumber('DL', 'MH-14 20110012345'), null);
  assert.equal(validateDocNumber('AADHAAR', '1234 5678 9012'), null);
  assert.equal(maskAadhaar('123456789012'), 'XXXX XXXX 9012');
  assert.ok(validateDob('2999-01-01', false));
  assert.equal(validateDob('1990-02-28', true), null);
  assert.ok(validateDob('1990-02-30', true));
});
