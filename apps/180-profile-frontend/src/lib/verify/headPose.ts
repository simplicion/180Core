/**
 * 180 Verify — head-pose estimation from MediaPipe FaceLandmarker landmarks (pure, no imports).
 *
 * COORDINATE CONVENTION (the backend relies on this):
 *   Landmarks come from the RAW, UNMIRRORED camera frame (x: 0 = image left, 1 = image right).
 *   A camera facing the user sees the user's own left side on the IMAGE'S RIGHT.
 *   So when the user turns their head to THEIR OWN LEFT, the nose tip moves toward the IMAGE'S RIGHT
 *   relative to the cheek contour.
 *
 *   estimateYawDeg() > 0  ⇔  user turned to THEIR OWN LEFT   (TURN_LEFT)
 *   estimateYawDeg() < 0  ⇔  user turned to THEIR OWN RIGHT  (TURN_RIGHT)
 *
 * The on-screen preview is mirrored (CSS scaleX(-1)), so in the preview a TURN_LEFT looks like the head
 * turning toward the SCREEN'S LEFT — that is why the TURN_LEFT instruction shows a left arrow.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export const LM = {
  NOSE_TIP: 1,
  /** Cheek contour points — one on each side of the face (subject-right ≈ 234, subject-left ≈ 454). */
  CHEEK_A: 234,
  CHEEK_B: 454,
  EYE_OUTER_A: 33,
  EYE_OUTER_B: 263,
  FOREHEAD: 10,
  CHIN: 152,
} as const;

/**
 * Horizontal position of the nose tip between the two cheek contour points, in [0,1]
 * measured from the IMAGE-LEFT cheek. ~0.5 when frontal. Index-order independent (sorted by x).
 */
export function noseCheekRatio(lm: Landmark[]): number | null {
  const nose = lm[LM.NOSE_TIP];
  const a = lm[LM.CHEEK_A];
  const b = lm[LM.CHEEK_B];
  if (!nose || !a || !b) return null;
  const left = a.x <= b.x ? a : b;
  const right = a.x <= b.x ? b : a;
  const span = right.x - left.x;
  if (span <= 1e-6) return null;
  return (nose.x - left.x) / span;
}

/**
 * Yaw in degrees; positive = user turned to their OWN LEFT (nose toward image right in the raw frame).
 * Model: cheek points at (±w, z0), nose tip at (0, zn) in head space; for yaw θ the projected ratio is
 * r = 0.5 + (zn − z0)·tanθ / (2w). For the MediaPipe canonical face (zn − z0) ≈ w, hence θ ≈ atan(2(r − 0.5)).
 */
export function estimateYawDeg(lm: Landmark[]): number | null {
  const r = noseCheekRatio(lm);
  if (r === null) return null;
  return (Math.atan(2 * (r - 0.5)) * 180) / Math.PI;
}

/**
 * Independent cross-check using landmark depth (MediaPipe z: smaller = closer to camera).
 * Turning to the user's own left pushes the image-right cheek away (z up) and pulls the image-left one closer.
 * Same sign convention as estimateYawDeg.
 */
export function estimateYawFromDepthDeg(lm: Landmark[]): number | null {
  const a = lm[LM.CHEEK_A];
  const b = lm[LM.CHEEK_B];
  if (!a || !b || typeof a.z !== 'number' || typeof b.z !== 'number') return null;
  const left = a.x <= b.x ? a : b;
  const right = a.x <= b.x ? b : a;
  return (Math.atan2((right.z as number) - (left.z as number), right.x - left.x) * 180) / Math.PI;
}

/** In-plane head tilt in degrees from the outer eye corners (needs frame dims for true angle). */
export function estimateRollDeg(lm: Landmark[], frameW = 1, frameH = 1): number | null {
  const a = lm[LM.EYE_OUTER_A];
  const b = lm[LM.EYE_OUTER_B];
  if (!a || !b) return null;
  const left = a.x <= b.x ? a : b;
  const right = a.x <= b.x ? b : a;
  return (Math.atan2((right.y - left.y) * frameH, (right.x - left.x) * frameW) * 180) / Math.PI;
}

/** Vertical nose position between forehead and chin (≈0.5–0.65 when looking straight ahead). */
export function noseVerticalRatio(lm: Landmark[]): number | null {
  const top = lm[LM.FOREHEAD];
  const chin = lm[LM.CHIN];
  const nose = lm[LM.NOSE_TIP];
  if (!top || !chin || !nose) return null;
  const span = chin.y - top.y;
  if (span <= 1e-6) return null;
  return (nose.y - top.y) / span;
}

export function landmarkBounds(lm: Landmark[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!lm.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Blendshape scores by name → number, from MediaPipe `faceBlendshapes[i].categories`. */
export function blendshapeMap(categories: Array<{ categoryName?: string; score: number }> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of categories || []) if (c.categoryName) out[c.categoryName] = c.score;
  return out;
}
