/**
 * 180 Verify — lazy MediaPipe Tasks Vision loader.
 *
 * Assets are self-hosted under /verify-models (populated by
 * `node src/lib/verify/scripts/fetch-verify-models.mjs`, see that file). If they are missing we fall back
 * to the official jsDelivr (wasm) and Google storage (models) URLs.
 *
 * GPU delegate is tried first; CPU is the fallback (also used if the GPU instance throws at runtime).
 */
import type { FaceDetector, FaceLandmarker } from '@mediapipe/tasks-vision';

type WasmFileset = Awaited<ReturnType<typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks>>;

/** Must match the installed @mediapipe/tasks-vision version (used only for the CDN fallback). */
export const TASKS_VISION_VERSION = '0.10.35';

const LOCAL_BASE = '/verify-models';
const LOCAL = {
  wasmDir: `${LOCAL_BASE}/wasm`,
  wasmProbe: `${LOCAL_BASE}/wasm/vision_wasm_internal.wasm`,
  landmarker: `${LOCAL_BASE}/face_landmarker.task`,
  detector: `${LOCAL_BASE}/blaze_face_short_range.tflite`,
};
const REMOTE = {
  wasmDir: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
  landmarker: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  detector: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
};

type VisionModule = typeof import('@mediapipe/tasks-vision');

let visionModulePromise: Promise<VisionModule> | null = null;
let filesetPromise: Promise<WasmFileset> | null = null;
let landmarkerPromise: Promise<LoadedLandmarker> | null = null;
let detectorPromise: Promise<FaceDetector> | null = null;
const probeCache = new Map<string, Promise<boolean>>();

export interface LoadedLandmarker {
  landmarker: FaceLandmarker;
  delegate: 'GPU' | 'CPU';
}

function loadVisionModule(): Promise<VisionModule> {
  if (!visionModulePromise) {
    visionModulePromise = import('@mediapipe/tasks-vision').catch((err) => {
      visionModulePromise = null;
      throw err;
    });
  }
  return visionModulePromise;
}

/** True when a self-hosted asset exists (and is not an SPA HTML fallback). */
function probe(path: string): Promise<boolean> {
  let p = probeCache.get(path);
  if (!p) {
    p = fetch(path, { method: 'HEAD', cache: 'no-cache' })
      .then((r) => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
      .catch(() => false);
    probeCache.set(path, p);
  }
  return p;
}

async function resolveAsset(local: string, remote: string): Promise<string> {
  return (await probe(local)) ? new URL(local, window.location.origin).href : remote;
}

async function getFileset(): Promise<WasmFileset> {
  if (!filesetPromise) {
    filesetPromise = (async () => {
      const vision = await loadVisionModule();
      const local = await probe(LOCAL.wasmProbe);
      const base = local ? new URL(LOCAL.wasmDir, window.location.origin).href : REMOTE.wasmDir;
      return vision.FilesetResolver.forVisionTasks(base);
    })().catch((err) => {
      filesetPromise = null;
      throw err;
    });
  }
  return filesetPromise;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function createLandmarker(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  const [vision, fileset, modelPath] = await Promise.all([
    loadVisionModule(),
    getFileset(),
    resolveAsset(LOCAL.landmarker, REMOTE.landmarker),
  ]);
  return vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: 'VIDEO',
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** Shared VIDEO-mode FaceLandmarker (numFaces 2, blendshapes on). */
export function getFaceLandmarker(): Promise<LoadedLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async (): Promise<LoadedLandmarker> => {
      if (webglAvailable()) {
        try {
          return { landmarker: await createLandmarker('GPU'), delegate: 'GPU' };
        } catch {
          /* fall through to CPU */
        }
      }
      return { landmarker: await createLandmarker('CPU'), delegate: 'CPU' };
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Replace a GPU landmarker that failed at runtime with a CPU one. */
export async function downgradeLandmarkerToCpu(): Promise<LoadedLandmarker> {
  const current = landmarkerPromise ? await landmarkerPromise.catch(() => null) : null;
  if (current?.delegate === 'CPU') return current;
  try {
    current?.landmarker.close();
  } catch {
    /* ignore */
  }
  landmarkerPromise = createLandmarker('CPU').then((landmarker) => ({ landmarker, delegate: 'CPU' as const }));
  landmarkerPromise.catch(() => {
    landmarkerPromise = null;
  });
  return landmarkerPromise;
}

/** Shared IMAGE-mode BlazeFace short-range detector, used to confirm a portrait is visible on ID cards. */
export function getFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const [vision, fileset, modelPath] = await Promise.all([
        loadVisionModule(),
        getFileset(),
        resolveAsset(LOCAL.detector, REMOTE.detector),
      ]);
      // CPU: the detector runs a few times per second on small canvases; avoids a second GL context.
      return vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

/**
 * Looks for a face on a card image. Runs on the full crop and on its left/right halves
 * (the portrait occupies only ~25–35% of the card height, which is small for BlazeFace).
 */
export function cardHasFace(detector: FaceDetector, source: HTMLCanvasElement, scratch: HTMLCanvasElement): boolean {
  const run = (img: HTMLCanvasElement) => {
    try {
      return detector.detect(img).detections.some((d) => (d.categories?.[0]?.score ?? 0) >= 0.5);
    } catch {
      return false;
    }
  };
  if (run(source)) return true;
  const w = source.width;
  const h = source.height;
  const half = Math.round(w * 0.55);
  const ctx = scratch.getContext('2d');
  if (!ctx) return false;
  scratch.width = half;
  scratch.height = h;
  for (const sx of [0, w - half]) {
    ctx.drawImage(source, sx, 0, half, h, 0, 0, half, h);
    if (run(scratch)) return true;
  }
  return false;
}
