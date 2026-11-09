'use client';
/**
 * 180 Verify — front camera + MediaPipe FaceLandmarker active-liveness runner.
 *
 * Preview is MIRRORED with CSS only; every captured frame is drawn from the RAW video (unmirrored).
 * Per-frame observations are fed into the pure engine in lib/verify/livenessEngine.ts.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Eye, Loader2, RefreshCw, ScanFace, Smile } from 'lucide-react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { downgradeLandmarkerToCpu, getFaceLandmarker } from '@/lib/verify/faceLandmarker';
import {
  blendshapeMap,
  estimateRollDeg,
  estimateYawDeg,
  landmarkBounds,
  noseVerticalRatio,
} from '@/lib/verify/headPose';
import {
  LIVENESS_T,
  advanceEngine,
  createEngine,
  retryStep,
  type AbortReason,
  type EngineState,
  type FaceObservation,
  type Guidance,
} from '@/lib/verify/livenessEngine';
import { sourcePointToContainer } from '@/lib/verify/imageQuality';
import { videoFrameToJpeg } from '@/lib/verify/image';
import { CAMERA_ERROR_TEXT, useCamera } from '@/lib/verify/useCamera';
import { toEpochMs } from '@/lib/verify/session';
import type { CapturedFrame, ChallengeStep, LivenessChallenge } from '@/lib/verify/types';
import { Button, Notice, cx } from './ui';

export type LivenessAbort = AbortReason | 'EXPIRED';

interface Props {
  challenge: LivenessChallenge;
  onFinished: (selfie: string, frames: CapturedFrame[]) => void;
  onAbort: (reason: LivenessAbort) => void;
}

/** Oval guide in container-normalised coordinates (container is 3:4 portrait). */
const OVAL = { cx: LIVENESS_T.ovalCx, cy: LIVENESS_T.ovalCy, rx: 0.31 };
const FRAME_WIDTH = 640;
const JPEG_Q = 0.85;

const STEP_UI: Record<ChallengeStep, { text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  NEUTRAL: { text: 'Look straight at the camera', Icon: ScanFace },
  BLINK: { text: 'Blink slowly', Icon: Eye },
  // Preview is mirrored, so turning to the user's own left moves the head toward the SCREEN's left.
  TURN_LEFT: { text: 'Slowly turn your head to your left', Icon: ArrowLeft },
  TURN_RIGHT: { text: 'Slowly turn your head to your right', Icon: ArrowRight },
  SMILE: { text: 'Smile', Icon: Smile },
};

const GUIDANCE_TEXT: Partial<Record<Guidance, string>> = {
  NO_FACE: 'Position your face inside the oval',
  MULTIPLE_FACES: 'Only one person should be in view',
  MOVE_CLOSER: 'Move a little closer',
  MOVE_BACK: 'Move back a little',
  CENTER: 'Centre your face in the oval',
  TOO_DARK: 'Find better lighting — face a window or lamp',
  TOO_BRIGHT: 'Too bright — avoid strong light on your face',
  LOOK_STRAIGHT: 'Look straight at the camera',
  HOLD_STILL: 'Hold still…',
};

interface UiState {
  phase: EngineState['phase'];
  stepIndex: number;
  guidance: Guidance;
}

export default function LivenessCamera({ challenge, onFinished, onAbort }: Props) {
  const [model, setModel] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modelAttempt, setModelAttempt] = useState(0);
  const [ui, setUi] = useState<UiState>({ phase: 'ALIGN', stepIndex: 0, guidance: 'NO_FACE' });
  const [done, setDone] = useState(false);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EngineState>(createEngine(challenge.steps, 0));
  const selfieRef = useRef<string | null>(null);
  const framesRef = useRef<CapturedFrame[]>([]);
  const cbRef = useRef({ onFinished, onAbort });
  cbRef.current = { onFinished, onAbort };

  const cam = useCamera({ enabled: !done, facingMode: 'user', width: 640, height: 480 });
  const expiresAtMs = toEpochMs(challenge.expiresAt);

  useEffect(() => {
    let alive = true;
    setModel('loading');
    getFaceLandmarker()
      .then((l) => {
        if (!alive) return;
        landmarkerRef.current = l.landmarker;
        setModel('ready');
      })
      .catch(() => alive && setModel('error'));
    return () => {
      alive = false;
    };
  }, [modelAttempt]);

  // Detection loop
  useEffect(() => {
    if (model !== 'ready' || cam.status !== 'live' || done) return;
    const video = cam.videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    engineRef.current = createEngine(challenge.steps, performance.now());
    selfieRef.current = null;
    framesRef.current = [];

    const capCanvas = document.createElement('canvas');
    const lumCanvas = document.createElement('canvas');
    lumCanvas.width = 24;
    lumCanvas.height = 24;
    const lumCtx = lumCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);

    let raf = 0;
    let last = 0;
    let lastTs = 0;
    let interval = 66; // ~15 fps; adapts down on slow devices
    let avgCost = 0;
    let frameNo = 0;
    let failures = 0;
    let finished = false;
    let lastUi: UiState = { phase: 'ALIGN', stepIndex: 0, guidance: 'NO_FACE' };
    setUi(lastUi);

    const pushUi = (s: EngineState) => {
      if (s.phase !== lastUi.phase || s.stepIndex !== lastUi.stepIndex || s.guidance !== lastUi.guidance) {
        lastUi = { phase: s.phase, stepIndex: s.stepIndex, guidance: s.guidance };
        setUi(lastUi);
      }
    };

    const capture = () => videoFrameToJpeg(video, FRAME_WIDTH, JPEG_Q, capCanvas);

    const tick = (now: number) => {
      if (finished) return;
      raf = requestAnimationFrame(tick);
      if (now - last < interval || video.readyState < 2 || !video.videoWidth) return;
      last = now;

      if (expiresAtMs !== null && Date.now() >= expiresAtMs - 500) {
        finished = true;
        cbRef.current.onAbort('EXPIRED');
        return;
      }
      const lm = landmarkerRef.current;
      if (!lm) return;
      if (engineRef.current.phase === 'STEP_TIMEOUT') return;

      const ts = Math.max(now, lastTs + 1);
      lastTs = ts;
      const t0 = performance.now();
      let result;
      try {
        result = lm.detectForVideo(video, ts);
        failures = 0;
      } catch {
        failures += 1;
        if (failures === 3) {
          downgradeLandmarkerToCpu()
            .then((l) => (landmarkerRef.current = l.landmarker))
            .catch(() => setModel('error'));
        }
        if (failures > 12) {
          finished = true;
          setModel('error');
        }
        return;
      }
      const cost = performance.now() - t0;
      avgCost = avgCost ? avgCost * 0.9 + cost * 0.1 : cost;
      interval = avgCost > 45 ? 110 : avgCost > 25 ? 80 : 66;
      frameNo += 1;

      const faces = result.faceLandmarks || [];
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      let obs: FaceObservation;

      if (faces.length === 1) {
        const pts = faces[0];
        const bs = blendshapeMap(result.faceBlendshapes?.[0]?.categories);
        const b = landmarkBounds(pts)!;
        const tl = sourcePointToContainer(b.minX, b.minY, vw, vh, cw, ch);
        const br = sourcePointToContainer(b.maxX, b.maxY, vw, vh, cw, ch);
        // Mirror X into display space (preview is mirrored).
        const cxDisp = 1 - (tl.x + br.x) / 2;
        const cyDisp = (tl.y + br.y) / 2;
        const widthRatio = (br.x - tl.x) / (2 * OVAL.rx);

        let brightness: number | null = null;
        if (lumCtx && frameNo % 4 === 0) {
          const sx = Math.max(0, b.minX * vw);
          const sy = Math.max(0, b.minY * vh);
          const sw = Math.min(vw - sx, (b.maxX - b.minX) * vw);
          const sh = Math.min(vh - sy, (b.maxY - b.minY) * vh);
          if (sw > 4 && sh > 4) {
            lumCtx.drawImage(video, sx, sy, sw, sh, 0, 0, 24, 24);
            const d = lumCtx.getImageData(0, 0, 24, 24).data;
            let sum = 0;
            for (let i = 0; i < d.length; i += 4) sum += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
            brightness = sum / (d.length / 4);
          }
        }

        obs = {
          faceCount: 1,
          yaw: estimateYawDeg(pts) ?? 0,
          roll: estimateRollDeg(pts, vw, vh) ?? 0,
          noseV: noseVerticalRatio(pts),
          blinkL: bs.eyeBlinkLeft ?? 0,
          blinkR: bs.eyeBlinkRight ?? 0,
          smileL: bs.mouthSmileLeft ?? 0,
          smileR: bs.mouthSmileRight ?? 0,
          cx: cxDisp,
          cy: cyDisp,
          widthRatio,
          brightness,
        };
      } else {
        obs = { faceCount: faces.length, yaw: 0, roll: 0, noseV: null, blinkL: 0, blinkR: 0, smileL: 0, smileR: 0, cx: 0, cy: 0, widthRatio: 0, brightness: null };
      }

      const { state, events } = advanceEngine(engineRef.current, obs, now);
      engineRef.current = state;

      for (const ev of events) {
        if (ev.type === 'CAPTURE_SELFIE') {
          selfieRef.current = capture();
        } else if (ev.type === 'CAPTURE_STEP') {
          const image = capture();
          framesRef.current.push({ step: ev.step, image, capturedAt: new Date().toISOString() });
          if (ev.step === 'NEUTRAL') selfieRef.current = image; // selfie = the NEUTRAL frontal frame
          try {
            navigator.vibrate?.(30);
          } catch {
            /* ignore */
          }
        } else if (ev.type === 'ABORT') {
          finished = true;
          cbRef.current.onAbort(ev.reason);
        } else if (ev.type === 'DONE') {
          finished = true;
          setDone(true);
          const selfie = selfieRef.current || capture();
          cbRef.current.onFinished(selfie, framesRef.current.slice());
        }
      }
      pushUi(state);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      finished = true;
      cancelAnimationFrame(raf);
    };
    // challenge identity drives a full restart (parent remounts with key=challengeId anyway)
  }, [model, cam.status, cam.videoRef, challenge.steps, done, expiresAtMs]);

  const retry = () => {
    if (expiresAtMs !== null && expiresAtMs - Date.now() < LIVENESS_T.stepTimeoutMs / 2) {
      onAbort('EXPIRED');
      return;
    }
    engineRef.current = retryStep(engineRef.current, performance.now());
    setUi({ phase: engineRef.current.phase, stepIndex: engineRef.current.stepIndex, guidance: engineRef.current.guidance });
  };

  const step = ui.phase === 'STEPS' || ui.phase === 'STEP_TIMEOUT' ? challenge.steps[ui.stepIndex] : null;
  const stepUi = step ? STEP_UI[step] : null;
  const overrideText =
    ui.phase === 'ALIGN' || ui.guidance !== 'DO_STEP' ? GUIDANCE_TEXT[ui.guidance] ?? null : null;
  const instruction =
    ui.phase === 'DONE' ? 'Done — checking…' : ui.phase === 'STEP_TIMEOUT' ? "We didn't catch that" : step && !overrideText ? stepUi!.text : overrideText ?? 'Get ready';
  const ovalTone =
    ui.phase === 'DONE' ? 'stroke-emerald-400' : ui.phase === 'STEPS' && ui.guidance === 'DO_STEP' ? 'stroke-indigo-400' : ui.guidance === 'HOLD_STILL' ? 'stroke-emerald-400' : 'stroke-zinc-400';
  const camError = cam.status === 'error' && cam.error;

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative w-[min(100%,340px,42vh)] mx-auto aspect-[3/4] rounded-3xl overflow-hidden bg-black border border-zinc-800">
        <video
          ref={cam.videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Front camera preview (mirrored)"
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        />

        {/* Oval guide with dimmed surround */}
        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          <defs>
            <mask id="oval-mask">
              <rect width="300" height="400" fill="white" />
              <ellipse cx={OVAL.cx * 300} cy={OVAL.cy * 400} rx={OVAL.rx * 300} ry={OVAL.rx * 300 * 1.3} fill="black" />
            </mask>
          </defs>
          <rect width="300" height="400" fill="rgba(9,9,11,0.6)" mask="url(#oval-mask)" />
          <ellipse
            cx={OVAL.cx * 300}
            cy={OVAL.cy * 400}
            rx={OVAL.rx * 300}
            ry={OVAL.rx * 300 * 1.3}
            fill="none"
            strokeWidth={3}
            className={cx('transition-colors duration-200', ovalTone)}
          />
        </svg>

        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center gap-3 bg-zinc-950/90">
            <p className="text-xs text-zinc-300">{CAMERA_ERROR_TEXT[cam.error!]}</p>
            <p className="text-[10px] text-zinc-500">A live camera is required for the face check. You can also open this link on your phone.</p>
            {cam.error !== 'insecure' && cam.error !== 'unsupported' && (
              <Button variant="secondary" onClick={cam.retry}>
                <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Try again
              </Button>
            )}
          </div>
        ) : cam.status === 'needs-gesture' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70">
            <Button onClick={cam.resume}>
              <Camera className="w-4 h-4" aria-hidden /> Tap to start camera
            </Button>
          </div>
        ) : model === 'loading' || cam.status === 'starting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/60" role="status" aria-live="polite">
            <Loader2 className="w-6 h-6 text-indigo-400 motion-safe:animate-spin" aria-hidden />
            <p className="text-[11px] text-zinc-300">{model === 'loading' ? 'Loading face check…' : 'Starting camera…'}</p>
          </div>
        ) : null}

        {!camError && model === 'ready' && cam.status === 'live' && (
          <div className="absolute bottom-3 inset-x-3 flex justify-center">
            <p
              role="status"
              aria-live="assertive"
              className={cx(
                'px-3 py-2 rounded-xl text-xs font-semibold backdrop-blur-md border flex items-center gap-2 text-center',
                ui.phase === 'STEPS' && ui.guidance === 'DO_STEP'
                  ? 'bg-indigo-950/80 text-indigo-100 border-indigo-400/30'
                  : 'bg-black/75 text-zinc-100 border-white/10',
              )}
            >
              {stepUi && !overrideText && ui.phase === 'STEPS' && <stepUi.Icon className="w-4 h-4 shrink-0" />}
              <span>{instruction}</span>
            </p>
          </div>
        )}
      </div>

      {/* Step progress */}
      <ol className="flex items-center justify-center gap-1.5" aria-label="Face check progress">
        {challenge.steps.map((s, i) => {
          const complete = ui.phase === 'DONE' || i < ui.stepIndex;
          const current = (ui.phase === 'STEPS' || ui.phase === 'STEP_TIMEOUT') && i === ui.stepIndex;
          return (
            <li
              key={`${s}-${i}`}
              aria-label={`${STEP_UI[s]?.text ?? s}: ${complete ? 'done' : current ? 'in progress' : 'pending'}`}
              className={cx(
                'h-1.5 rounded-full transition-all',
                complete ? 'w-6 bg-emerald-400' : current ? 'w-8 bg-indigo-400' : 'w-6 bg-zinc-700',
              )}
            />
          );
        })}
      </ol>

      {model === 'error' && (
        <Notice
          tone="error"
          title="The face check could not start on this device"
          action={
            <Button variant="secondary" onClick={() => setModelAttempt((n) => n + 1)}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Retry
            </Button>
          }
        >
          Check your connection, or try a recent version of Chrome or Safari.
        </Notice>
      )}

      {ui.phase === 'STEP_TIMEOUT' && (
        <Notice tone="warn" title={`We didn't detect: ${step ? STEP_UI[step].text.toLowerCase() : 'that'}`} action={<Button onClick={retry}>Try this step again</Button>}>
          Keep your face in the oval and make the movement clearly.
        </Notice>
      )}
    </div>
  );
}
