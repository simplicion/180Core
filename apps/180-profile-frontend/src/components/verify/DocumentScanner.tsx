'use client';
/**
 * 180 Verify — rear-camera ID card scanner with auto-capture.
 *
 * Auto-capture fires when ALL of these hold on the guide-region crop (analysed at ~8 fps on a 320px canvas):
 *   1. framed   — strong-gradient content spans ≥72% of the guide width (card fills the frame)
 *   2. lighting — mean luminance in [70, 215] and <2% saturated (glare) pixels
 *   3. sharp    — Laplacian variance ≥140, or ≥60 and ≥75% of the best focus seen in the last 3 s
 *   4. stable   — frame-to-frame mean abs diff (80px thumbnails) ≤6 for ≥600 ms
 *   5. face     — (photo IDs only) BlazeFace finds a portrait on the card crop within the last second
 * A manual shutter appears after 8 s, and file upload is always available as a fallback.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImageUp, RefreshCw, X } from 'lucide-react';
import {
  DOC_ISSUE_TEXT,
  DOC_THRESHOLDS,
  ID1_ASPECT,
  cardGuideRect,
  containerRectToSource,
  edgeCoverage,
  evaluateDocFrame,
  laplacianVariance,
  luminanceStats,
  meanAbsDiff,
  toGrayscale,
  type Rect,
} from '@/lib/verify/imageQuality';
import { cropToJpeg, fileToJpeg } from '@/lib/verify/image';
import { CAMERA_ERROR_TEXT, useCamera } from '@/lib/verify/useCamera';
import { cardHasFace, getFaceDetector } from '@/lib/verify/faceLandmarker';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import { Button, Notice, cx } from './ui';

export interface ScanResult {
  image: string;
  faceDetected: boolean | null;
  source: 'camera' | 'upload';
}

interface Props {
  docLabel: string;
  requireFace: boolean;
  onCapture: (r: ScanResult) => void;
  onCancel: () => void;
}

const ANALYSIS_W = 320;
const ANALYSIS_H = Math.round(ANALYSIS_W / ID1_ASPECT);
const THUMB_W = 80;
const THUMB_H = Math.round(THUMB_W / ID1_ASPECT);
const FACE_W = 480;
const FACE_H = Math.round(FACE_W / ID1_ASPECT);
const FRAME_INTERVAL_MS = 125; // ~8 fps
const MANUAL_AFTER_MS = 8000;
const FACE_CHECK_INTERVAL_MS = 350;
const OUTPUT_LONG_EDGE = 1600;

type DetectorState = 'loading' | 'ready' | 'failed' | 'off';

function ctx2d(c: HTMLCanvasElement) {
  return c.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
}

function expand(r: Rect, frac: number, vw: number, vh: number): Rect {
  const dx = r.w * frac;
  const dy = r.h * frac;
  const x = Math.max(0, r.x - dx);
  const y = Math.max(0, r.y - dy);
  return { x, y, w: Math.min(vw - x, r.w + 2 * dx), h: Math.min(vh - y, r.h + 2 * dy) };
}

export default function DocumentScanner({ docLabel, requireFace, onCapture, onCancel }: Props) {
  const [mode, setMode] = useState<'camera' | 'preview'>('camera');
  const [preview, setPreview] = useState<ScanResult | null>(null);
  const [guidance, setGuidance] = useState<string>('Starting camera…');
  const [ready, setReady] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detectorState, setDetectorState] = useState<DetectorState>(requireFace ? 'loading' : 'off');
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const lastFaceSeenRef = useRef<number>(0);
  const faceMissesRef = useRef<number>(0);

  const cam = useCamera({ enabled: mode === 'camera', facingMode: 'environment', width: 1920, height: 1080 });

  // Lazy-load the card-portrait detector.
  useEffect(() => {
    if (!requireFace) return;
    let alive = true;
    getFaceDetector()
      .then((d) => {
        if (!alive) return;
        detectorRef.current = d;
        setDetectorState('ready');
      })
      .catch(() => alive && setDetectorState('failed'));
    return () => {
      alive = false;
    };
  }, [requireFace]);

  // Track the rendered size of the viewport for the guide overlay.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Manual shutter fallback timer.
  useEffect(() => {
    if (mode !== 'camera' || cam.status !== 'live') {
      setShowManual(false);
      return;
    }
    const t = setTimeout(() => setShowManual(true), MANUAL_AFTER_MS);
    return () => clearTimeout(t);
  }, [mode, cam.status]);

  const sourceRect = useCallback((): Rect | null => {
    const video = cam.videoRef.current;
    const el = containerRef.current;
    if (!video || !el || !video.videoWidth) return null;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    return containerRectToSource(cardGuideRect(cw, ch), video.videoWidth, video.videoHeight, cw, ch);
  }, [cam.videoRef]);

  const finishCapture = useCallback(
    (faceDetected: boolean | null) => {
      const video = cam.videoRef.current;
      const r = sourceRect();
      if (!video || !r) return;
      try {
        const image = cropToJpeg(video, expand(r, 0.04, video.videoWidth, video.videoHeight), OUTPUT_LONG_EDGE, 0.85);
        try {
          navigator.vibrate?.(50);
        } catch {
          /* unsupported */
        }
        setPreview({ image, faceDetected, source: 'camera' });
        setMode('preview');
      } catch {
        setUploadError('Could not capture the photo. Please try again or upload one.');
      }
    },
    [cam.videoRef, sourceRect],
  );

  // Analysis loop.
  useEffect(() => {
    if (mode !== 'camera' || cam.status !== 'live') return;
    const video = cam.videoRef.current;
    if (!video) return;

    const analysis = document.createElement('canvas');
    analysis.width = ANALYSIS_W;
    analysis.height = ANALYSIS_H;
    const thumb = document.createElement('canvas');
    thumb.width = THUMB_W;
    thumb.height = THUMB_H;
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = FACE_W;
    faceCanvas.height = FACE_H;
    const scratch = document.createElement('canvas');
    const actx = ctx2d(analysis);
    const tctx = ctx2d(thumb);
    const fctx = faceCanvas.getContext('2d');
    if (!actx || !tctx || !fctx) return;

    let raf = 0;
    let last = 0;
    let prevThumb: Uint8ClampedArray | null = null;
    let stillSince: number | null = null;
    let lastFaceCheck = 0;
    const sharpHistory: Array<{ t: number; v: number }> = [];
    let lastText = '';
    let lastReady = false;
    let captured = false;
    lastFaceSeenRef.current = 0;
    faceMissesRef.current = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (captured || now - last < FRAME_INTERVAL_MS) return;
      if (video.readyState < 2 || !video.videoWidth) return;
      last = now;
      const r = sourceRect();
      if (!r || r.w < 10 || r.h < 10) return;

      actx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, ANALYSIS_W, ANALYSIS_H);
      const gray = toGrayscale(actx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H).data, ANALYSIS_W, ANALYSIS_H);
      const sharpness = laplacianVariance(gray, ANALYSIS_W, ANALYSIS_H);
      const lum = luminanceStats(gray);
      const coverage = edgeCoverage(gray, ANALYSIS_W, ANALYSIS_H);

      tctx.drawImage(analysis, 0, 0, THUMB_W, THUMB_H);
      const tg = toGrayscale(tctx.getImageData(0, 0, THUMB_W, THUMB_H).data, THUMB_W, THUMB_H);
      const diff = prevThumb ? meanAbsDiff(prevThumb, tg) : 255;
      prevThumb = tg;
      if (diff <= DOC_THRESHOLDS.stillDiffMax) {
        if (stillSince === null) stillSince = now;
      } else stillSince = null;

      sharpHistory.push({ t: now, v: sharpness });
      while (sharpHistory.length && now - sharpHistory[0].t > 3000) sharpHistory.shift();
      const recentMax = sharpHistory.reduce((m, s) => Math.max(m, s.v), 0);

      const detector = detectorRef.current;
      let facePresent: boolean | null = null;
      if (requireFace && detector) {
        facePresent = now - lastFaceSeenRef.current < 1000;
      }

      const verdict = evaluateDocFrame({
        sharpness,
        recentMaxSharpness: recentMax,
        lum,
        coverage,
        stillForMs: stillSince === null ? 0 : now - stillSince,
        facePresent: true, // face handled below so we can debounce its message
      });

      // Portrait check only once the image is otherwise usable (saves CPU on low-end devices).
      if (requireFace && detector && verdict.checks.framed && verdict.checks.lighting && now - lastFaceCheck > FACE_CHECK_INTERVAL_MS) {
        lastFaceCheck = now;
        fctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, FACE_W, FACE_H);
        if (cardHasFace(detector, faceCanvas, scratch)) {
          lastFaceSeenRef.current = now;
          faceMissesRef.current = 0;
          facePresent = true;
        } else {
          faceMissesRef.current += 1;
        }
      }

      const detectorPending = requireFace && detectorState === 'loading' && !detector;
      const faceOk = !requireFace || !detector ? !detectorPending : facePresent === true;

      let text: string;
      let isReady = false;
      if (!verdict.ready) {
        text = DOC_ISSUE_TEXT[verdict.issue!];
      } else if (!faceOk) {
        text = detectorPending || faceMissesRef.current < 3 ? 'Hold steady — looking for the photo…' : DOC_ISSUE_TEXT.NO_FACE;
      } else {
        text = 'Perfect — capturing…';
        isReady = true;
      }

      if (text !== lastText) {
        lastText = text;
        setGuidance(text);
      }
      if (isReady !== lastReady) {
        lastReady = isReady;
        setReady(isReady);
      }
      if (isReady) {
        captured = true;
        finishCapture(requireFace && detector ? true : null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, cam.status, cam.videoRef, requireFace, detectorState, sourceRect, finishCapture]);

  const manualCapture = () => {
    const detector = detectorRef.current;
    const seen = lastFaceSeenRef.current > 0 && performance.now() - lastFaceSeenRef.current < 1500;
    finishCapture(requireFace && detector ? seen : null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setBusy(true);
    try {
      const { dataUrl, canvas } = await fileToJpeg(file, OUTPUT_LONG_EDGE, 0.85);
      let faceDetected: boolean | null = null;
      if (requireFace) {
        try {
          const detector = detectorRef.current || (await getFaceDetector());
          const small = document.createElement('canvas');
          const s = Math.min(1, 640 / Math.max(canvas.width, canvas.height));
          small.width = Math.round(canvas.width * s);
          small.height = Math.round(canvas.height * s);
          small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
          faceDetected = cardHasFace(detector, small, document.createElement('canvas'));
        } catch {
          faceDetected = null;
        }
      }
      setPreview({ image: dataUrl, faceDetected, source: 'upload' });
      setMode('preview');
    } catch (err: any) {
      setUploadError(err?.message || 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  };

  const guide = box.w ? cardGuideRect(box.w, box.h) : null;
  const camError = cam.status === 'error' && cam.error;

  return (
    <div className="space-y-3" role="group" aria-label={`Scan ${docLabel}`}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} aria-hidden tabIndex={-1} />

      {mode === 'camera' && (
        <>
          <div
            ref={containerRef}
            className="relative w-full aspect-[4/3] max-h-[52vh] rounded-2xl overflow-hidden bg-black border border-zinc-800"
          >
            <video
              ref={cam.videoRef}
              playsInline
              muted
              autoPlay
              aria-label="Rear camera preview"
              className="absolute inset-0 w-full h-full object-cover"
            />

            {guide && !camError && (
              <div
                aria-hidden
                className={cx(
                  'absolute rounded-xl border-2 transition-colors duration-200',
                  ready ? 'border-emerald-400' : 'border-white/70',
                )}
                style={{
                  left: guide.x,
                  top: guide.y,
                  width: guide.w,
                  height: guide.h,
                  boxShadow: '0 0 0 9999px rgba(9,9,11,0.55)',
                }}
              >
                <div className="absolute left-2 bottom-2 w-[28%] h-[58%] rounded-md border border-dashed border-white/30" />
              </div>
            )}

            {camError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center gap-3 bg-zinc-950/90">
                <p className="text-xs text-zinc-300">{CAMERA_ERROR_TEXT[cam.error!]}</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {cam.error !== 'insecure' && cam.error !== 'unsupported' && (
                    <Button variant="secondary" onClick={cam.retry}>
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Try camera again
                    </Button>
                  )}
                  <Button onClick={() => fileRef.current?.click()} loading={busy}>
                    <ImageUp className="w-3.5 h-3.5" aria-hidden /> Upload a photo
                  </Button>
                </div>
              </div>
            ) : cam.status === 'needs-gesture' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70">
                <Button onClick={cam.resume}>
                  <Camera className="w-4 h-4" aria-hidden /> Tap to start camera
                </Button>
              </div>
            ) : (
              <div className="absolute top-2 inset-x-2 flex justify-center pointer-events-none">
                <p
                  aria-live="polite"
                  role="status"
                  className={cx(
                    'px-3 py-1.5 rounded-lg text-[11px] font-semibold backdrop-blur-md border',
                    ready ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' : 'bg-black/70 text-zinc-100 border-white/10',
                  )}
                >
                  {cam.status === 'starting' ? 'Starting camera…' : cam.status === 'paused' ? 'Camera paused' : guidance}
                </p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-zinc-500 text-center">
            Place the <strong className="text-zinc-300">front</strong> of your {docLabel} inside the frame on a dark, flat surface. It
            captures automatically.
          </p>

          {uploadError && <Notice tone="error">{uploadError}</Notice>}

          <div className="flex gap-2">
            <Button variant="secondary" className="w-1/3" onClick={onCancel}>
              <X className="w-3.5 h-3.5" aria-hidden /> Cancel
            </Button>
            {showManual && cam.status === 'live' ? (
              <Button className="flex-1" onClick={manualCapture}>
                <Camera className="w-4 h-4" aria-hidden /> Take photo now
              </Button>
            ) : (
              <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()} loading={busy}>
                <ImageUp className="w-3.5 h-3.5" aria-hidden /> Upload instead
              </Button>
            )}
          </div>
        </>
      )}

      {mode === 'preview' && preview && (
        <>
          <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.image} alt={`Captured ${docLabel}`} className="w-full h-auto" />
          </div>
          {requireFace && preview.faceDetected === false && (
            <Notice tone="warn" title="We couldn't see the photo on your card">
              Make sure the front side with your portrait is visible and free of glare. You can still use this image.
            </Notice>
          )}
          {preview.faceDetected === true && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Card photo detected
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="w-1/3"
              onClick={() => {
                setPreview(null);
                setReady(false);
                setMode('camera');
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Retake
            </Button>
            <Button variant="success" className="flex-1" onClick={() => onCapture(preview)}>
              <CheckCircle2 className="w-4 h-4" aria-hidden /> Use this photo
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
