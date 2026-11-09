'use client';
/**
 * 180 Verify — single-owner camera hook.
 *
 * - Exactly one MediaStream per hook instance; opening is race-safe (a stream that resolves after the
 *   effect was cleaned up is stopped immediately).
 * - Tracks are stopped when `enabled` turns false, on unmount, and while the tab is hidden; the stream
 *   is reopened when the tab becomes visible again.
 * - Errors are classified so the UI can show a precise message.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraErrorKind = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'unknown';
export type CameraStatus = 'idle' | 'starting' | 'live' | 'paused' | 'needs-gesture' | 'error';

export interface UseCameraOptions {
  enabled: boolean;
  facingMode: 'user' | 'environment';
  width?: number;
  height?: number;
}

export function cameraSupportIssue(): CameraErrorKind | null {
  if (typeof window === 'undefined') return null;
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  return null;
}

export function classifyCameraError(err: any): CameraErrorKind {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in-use';
  return 'unknown';
}

export const CAMERA_ERROR_TEXT: Record<CameraErrorKind, string> = {
  insecure: 'The camera only works over a secure (HTTPS) connection.',
  unsupported: 'This browser does not support camera access.',
  denied:
    'Camera permission was blocked. Allow camera access in your browser settings (and, if this page is inside another app, that app must allow the camera), then try again.',
  'not-found': 'No suitable camera was found on this device.',
  'in-use': 'The camera is being used by another app. Close it and try again.',
  unknown: 'The camera could not be started.',
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

export function useCamera({ enabled, facingMode, width, height }: UseCameraOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraErrorKind | null>(null);
  const [hidden, setHidden] = useState<boolean>(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  const [attempt, setAttempt] = useState(0);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    if (hidden) {
      setStatus('paused');
      return;
    }
    const issue = cameraSupportIssue();
    if (issue) {
      setError(issue);
      setStatus('error');
      return;
    }

    let cancelled = false;
    setStatus('starting');
    setError(null);

    (async () => {
      let stream: MediaStream | null = null;
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          ...(width ? { width: { ideal: width } } : {}),
          ...(height ? { height: { ideal: height } } : {}),
        },
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // Some devices reject resolution hints — retry with the bare facing mode.
        if (!cancelled && (err?.name === 'OverconstrainedError' || err?.name === 'NotReadableError')) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facingMode } } });
          } catch (err2) {
            err = err2;
          }
        }
        if (!stream) {
          if (!cancelled) {
            setError(classifyCameraError(err));
            setStatus('error');
          }
          return;
        }
      }

      if (cancelled) {
        stopStream(stream);
        return;
      }
      stopStream(streamRef.current);
      streamRef.current = stream;

      // Best-effort continuous autofocus for document scanning.
      const track = stream.getVideoTracks()[0];
      try {
        const caps: any = (track as any)?.getCapabilities?.();
        if (caps?.focusMode?.includes?.('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        }
      } catch {
        /* optional */
      }

      const video = videoRef.current;
      if (!video) {
        stopStream(stream);
        streamRef.current = null;
        if (!cancelled) {
          setError('unknown');
          setStatus('error');
        }
        return;
      }
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.srcObject = stream;
      const onMeta = () => setDims({ w: video.videoWidth, h: video.videoHeight });
      video.onloadedmetadata = onMeta;
      video.onresize = onMeta;
      try {
        await video.play();
        if (!cancelled) setStatus('live');
      } catch (err: any) {
        if (cancelled) return;
        // iOS Safari: autoplay blocked until a user gesture.
        setStatus(err?.name === 'NotAllowedError' ? 'needs-gesture' : 'live');
      }
    })();

    return () => {
      cancelled = true;
      const v = videoRef.current;
      if (v) {
        v.onloadedmetadata = null;
        v.onresize = null;
        try {
          v.pause();
        } catch {
          /* ignore */
        }
        v.srcObject = null;
      }
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [enabled, hidden, facingMode, width, height, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  /** For the iOS "tap to start" case. */
  const resume = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      setStatus('live');
    } catch {
      /* stays needs-gesture */
    }
  }, []);

  return { videoRef, status, error, retry, resume, dims, streamRef };
}
