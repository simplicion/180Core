/**
 * 180 Verify — canvas helpers for producing JPEG data URLs from video frames and uploaded files.
 */
import type { Rect } from './imageQuality';

export function fitWithin(w: number, h: number, maxLongEdge: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (long <= maxLongEdge) return { w: Math.round(w), h: Math.round(h) };
  const s = maxLongEdge / long;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/** Draws `src` (a source-pixel rect of a video/image/canvas) to a JPEG, scaled so the long edge ≤ maxLongEdge. */
export function cropToJpeg(
  source: CanvasImageSource,
  src: Rect,
  maxLongEdge: number,
  quality = 0.85,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): string {
  const { w, h } = fitWithin(src.w, src.h, maxLongEdge);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, src.x, src.y, src.w, src.h, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Raw (UNMIRRORED) video frame → JPEG `targetWidth` px wide. The preview is mirrored with CSS only;
 * what we send is exactly what the sensor saw.
 */
export function videoFrameToJpeg(video: HTMLVideoElement, targetWidth = 640, quality = 0.85, canvas?: HTMLCanvasElement): string {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const w = Math.min(targetWidth, vw);
  const h = Math.round((vh / vw) * w);
  const c = canvas || document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(video, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

async function decodeFile(file: File): Promise<{ source: CanvasImageSource; w: number; h: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      return { source: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch {
      /* fall back to <img> (e.g. HEIC on some browsers) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Unsupported image'));
      img.src = url;
    });
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Uploaded image → JPEG data URL (long edge ≤ maxLongEdge) plus a canvas copy for analysis. */
export async function fileToJpeg(file: File, maxLongEdge = 1600, quality = 0.85): Promise<{ dataUrl: string; canvas: HTMLCanvasElement }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is too large (max 25 MB).');
  const { source, w, h, release } = await decodeFile(file);
  try {
    const canvas = document.createElement('canvas');
    const dataUrl = cropToJpeg(source, { x: 0, y: 0, w, h }, maxLongEdge, quality, canvas);
    return { dataUrl, canvas };
  } finally {
    release();
  }
}
