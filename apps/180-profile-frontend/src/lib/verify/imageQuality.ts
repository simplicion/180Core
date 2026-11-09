/**
 * 180 Verify — pure image-quality metrics used by the document auto-capture loop.
 * Operates on raw RGBA buffers / grayscale arrays so it runs in node tests and in the browser alike.
 * No runtime imports.
 */

/** RGBA (ImageData.data) → luma (BT.601), one byte per pixel. */
export function toGrayscale(rgba: ArrayLike<number>, width: number, height: number): Uint8ClampedArray {
  const n = width * height;
  const out = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  }
  return out;
}

/**
 * Variance of the 4-neighbour Laplacian over the interior pixels.
 * Classic focus measure: sharp, in-focus text/edges → high variance; blur → low.
 */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/** Mean absolute per-pixel difference of two equally-sized grayscale frames (0–255). */
export function meanAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 255;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += Math.abs(a[i] - b[i]);
  return acc / n;
}

export interface LuminanceStats {
  mean: number;
  /** Fraction (0–1) of pixels at or above the saturation threshold. */
  saturatedFraction: number;
  /** Fraction (0–1) of near-black pixels. */
  darkFraction: number;
}

export function luminanceStats(gray: ArrayLike<number>, saturationLevel = 250, darkLevel = 15): LuminanceStats {
  const n = gray.length;
  if (!n) return { mean: 0, saturatedFraction: 0, darkFraction: 1 };
  let sum = 0;
  let sat = 0;
  let dark = 0;
  for (let i = 0; i < n; i++) {
    const v = gray[i];
    sum += v;
    if (v >= saturationLevel) sat++;
    if (v <= darkLevel) dark++;
  }
  return { mean: sum / n, saturatedFraction: sat / n, darkFraction: dark / n };
}

/**
 * Horizontal / vertical extent of "edgy" content inside the guide, using the 5th–95th percentile
 * of strong-gradient pixel positions. A card that fills the guide spans ~0.8–1.0 of both axes;
 * a card held too far away only covers the middle.
 */
export function edgeCoverage(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  gradientThreshold = 40,
): { x: number; y: number; density: number } {
  const xs = new Uint32Array(width);
  const ys = new Uint32Array(height);
  let total = 0;
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + width] - gray[i - width];
      if (Math.abs(gx) + Math.abs(gy) >= gradientThreshold) {
        xs[x]++;
        ys[y]++;
        total++;
      }
    }
  }
  if (total < 20) return { x: 0, y: 0, density: total / Math.max(1, width * height) };
  const span = (hist: Uint32Array, len: number) => {
    const lo = total * 0.05;
    const hi = total * 0.95;
    let acc = 0;
    let p5 = 0;
    let p95 = len - 1;
    let foundLo = false;
    for (let i = 0; i < len; i++) {
      acc += hist[i];
      if (!foundLo && acc >= lo) {
        p5 = i;
        foundLo = true;
      }
      if (acc >= hi) {
        p95 = i;
        break;
      }
    }
    return Math.max(0, p95 - p5) / len;
  };
  return { x: span(xs, width), y: span(ys, height), density: total / (width * height) };
}

// ---------------------------------------------------------------------------
// Frame evaluation for document auto-capture
// ---------------------------------------------------------------------------

export const DOC_THRESHOLDS = {
  /** Absolute focus floor (Laplacian variance on a ~320px-wide grayscale crop). */
  sharpnessMin: 60,
  /** Comfortably sharp regardless of history. */
  sharpnessGood: 140,
  /** Must also be within this fraction of the best focus seen recently. */
  sharpnessRelative: 0.75,
  /** Mean abs diff between consecutive 80px frames considered "still". */
  stillDiffMax: 6,
  /** How long the frame must stay still before auto-capture. */
  stableMs: 600,
  brightnessMin: 70,
  brightnessMax: 215,
  glareMaxFraction: 0.02,
  coverageMin: 0.72,
  edgeDensityMin: 0.01,
};

export type DocIssue = 'NO_CARD' | 'TOO_FAR' | 'TOO_DARK' | 'TOO_BRIGHT' | 'GLARE' | 'BLURRY' | 'MOVING' | 'NO_FACE';

export interface DocFrameInput {
  sharpness: number;
  recentMaxSharpness: number;
  lum: LuminanceStats;
  coverage: { x: number; y: number; density: number };
  /** ms the scene has been continuously still. */
  stillForMs: number;
  /** null = not required / detector unavailable. */
  facePresent: boolean | null;
}

export interface DocFrameVerdict {
  ready: boolean;
  issue: DocIssue | null;
  checks: { sharp: boolean; stable: boolean; lighting: boolean; framed: boolean; face: boolean };
}

/** Ordered so the most actionable instruction wins. */
export function evaluateDocFrame(input: DocFrameInput, t = DOC_THRESHOLDS): DocFrameVerdict {
  const framedPresence = input.coverage.density >= t.edgeDensityMin;
  const framedSize = input.coverage.x >= t.coverageMin && input.coverage.y >= t.coverageMin * 0.85;
  const tooDark = input.lum.mean < t.brightnessMin;
  const tooBright = input.lum.mean > t.brightnessMax;
  const glare = input.lum.saturatedFraction > t.glareMaxFraction;
  const sharp =
    input.sharpness >= t.sharpnessGood ||
    (input.sharpness >= t.sharpnessMin && input.sharpness >= input.recentMaxSharpness * t.sharpnessRelative);
  const stable = input.stillForMs >= t.stableMs;
  const face = input.facePresent !== false;

  const checks = {
    sharp,
    stable,
    lighting: !tooDark && !tooBright && !glare,
    framed: framedPresence && framedSize,
    face,
  };

  let issue: DocIssue | null = null;
  if (!framedPresence) issue = 'NO_CARD';
  else if (tooDark) issue = 'TOO_DARK';
  else if (tooBright) issue = 'TOO_BRIGHT';
  else if (!framedSize) issue = 'TOO_FAR';
  else if (glare) issue = 'GLARE';
  else if (input.stillForMs < 200) issue = 'MOVING';
  else if (!sharp) issue = 'BLURRY';
  else if (!stable) issue = 'MOVING';
  else if (!face) issue = 'NO_FACE';

  return { ready: issue === null, issue, checks };
}

export const DOC_ISSUE_TEXT: Record<DocIssue, string> = {
  NO_CARD: 'Place the front of your card inside the frame',
  TOO_FAR: 'Move closer — fill the frame with the card',
  TOO_DARK: 'Too dark — move to a brighter spot',
  TOO_BRIGHT: 'Too bright — avoid direct light',
  GLARE: 'Reduce glare — tilt the card slightly',
  BLURRY: 'Hold steady — focusing…',
  MOVING: 'Hold steady',
  NO_FACE: 'Photo on card not visible',
};

// ---------------------------------------------------------------------------
// Geometry: map an on-screen rect to source-video pixels under `object-fit: cover`
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * For a video of `vw×vh` drawn with object-fit: cover into a `cw×ch` box, returns the
 * source-pixel rect corresponding to the container-pixel rect `r`.
 */
export function containerRectToSource(r: Rect, vw: number, vh: number, cw: number, ch: number): Rect {
  const scale = Math.max(cw / vw, ch / vh);
  const visW = cw / scale;
  const visH = ch / scale;
  const offX = (vw - visW) / 2;
  const offY = (vh - visH) / 2;
  const x = Math.max(0, offX + r.x / scale);
  const y = Math.max(0, offY + r.y / scale);
  const w = Math.min(vw - x, r.w / scale);
  const h = Math.min(vh - y, r.h / scale);
  return { x, y, w, h };
}

/** Inverse of the above for a normalised source point → normalised container point (unmirrored). */
export function sourcePointToContainer(nx: number, ny: number, vw: number, vh: number, cw: number, ch: number): { x: number; y: number } {
  const scale = Math.max(cw / vw, ch / vh);
  const visW = cw / scale;
  const visH = ch / scale;
  const offX = (vw - visW) / 2;
  const offY = (vh - visH) / 2;
  return { x: (nx * vw - offX) / visW, y: (ny * vh - offY) / visH };
}

/** ID-1 card (85.6 × 54 mm) guide centred in the container. */
export const ID1_ASPECT = 85.6 / 54;

export function cardGuideRect(cw: number, ch: number, widthFraction = 0.86): Rect {
  let w = cw * widthFraction;
  let h = w / ID1_ASPECT;
  if (h > ch * 0.86) {
    h = ch * 0.86;
    w = h * ID1_ASPECT;
  }
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}
