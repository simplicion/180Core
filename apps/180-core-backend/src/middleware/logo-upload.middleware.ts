'use strict';

import type { NextFunction, Request, Response } from 'express';
// @ts-ignore
import multer from 'multer';

export const APP_LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const SUPPORTED_LOGO_MIMES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

/** Checks magic bytes and sanitizes SVG markup */
export function inspectLogoBuffer(buffer: Buffer, mimetype: string): string | null {
  if (!buffer || buffer.length === 0) return 'The uploaded logo file is empty.';
  if (buffer.length > APP_LOGO_MAX_BYTES) {
    return `The logo file exceeds the ${APP_LOGO_MAX_BYTES / 1024 / 1024}MB limit.`;
  }

  const b = buffer;
  switch (mimetype) {
    case 'image/png':
      return b.length > 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG'
        ? null
        : 'The file is not a valid PNG image.';
    case 'image/jpeg':
    case 'image/jpg':
      return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
        ? null
        : 'The file is not a valid JPEG image.';
    case 'image/webp':
      return b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP'
        ? null
        : 'The file is not a valid WebP image.';
    case 'image/gif':
      return b.length > 6 && (b.toString('latin1', 0, 6) === 'GIF87a' || b.toString('latin1', 0, 6) === 'GIF89a')
        ? null
        : 'The file is not a valid GIF image.';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return b.length > 4 && b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02)
        ? null
        : 'The file is not a valid ICO image.';
    case 'image/svg+xml': {
      const text = b.toString('utf8').replace(/^\uFEFF/, '');
      if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)) {
        return 'The file is not a valid SVG document.';
      }
      if (/<script[\s>]|<foreignObject[\s>]|\son[a-z]+\s*=|javascript:|<!ENTITY|(xlink:)?href\s*=\s*["']\s*(https?:|data:(?!image\/(png|jpeg|webp))|\/\/)/i.test(text)) {
        return 'SVG logos cannot contain scripts, active event handlers, external entities, or external references for security.';
      }
      return null;
    }
    default:
      return `Unsupported image type '${mimetype}'. Allowed: PNG, JPEG, WebP, SVG, GIF, ICO.`;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: APP_LOGO_MAX_BYTES, files: 1 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.fieldname === 'logo' || file.fieldname === 'file') {
      if (SUPPORTED_LOGO_MIMES[file.mimetype]) {
        return cb(null, true);
      }
      const err: any = new Error(`Unsupported image type '${file.mimetype}'. Please upload PNG, JPEG, WebP, SVG, GIF, or ICO.`);
      err.code = 'UNSUPPORTED_MEDIA';
      return cb(err, false);
    }
    const err: any = new Error(`Unexpected field '${file.fieldname}'. Upload as multipart field "logo" or "file".`);
    err.code = 'BAD_UPLOAD';
    return cb(err, false);
  },
});

export const logoUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const handler = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  handler(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          error: 'FILE_TOO_LARGE',
          message: `The logo exceeds the maximum ${APP_LOGO_MAX_BYTES / 1024 / 1024}MB limit.`,
        });
      }
      if (err.code === 'UNSUPPORTED_MEDIA') {
        return res.status(415).json({
          success: false,
          error: 'UNSUPPORTED_MEDIA',
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'BAD_UPLOAD',
        message: err.message || 'Malformed upload payload',
      });
    }

    const files = (req as any).files;
    const file = files?.logo?.[0] || files?.file?.[0] || (req as any).file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE',
        message: 'No file received. Please attach an image in the multipart field "logo" or "file".',
      });
    }

    (req as any).file = file;
    next();
  });
};
