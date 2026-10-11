import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _s3Client: S3Client | null = null;

export const getS3Client = (): S3Client => {
    if (!_s3Client) {
        const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT || '';
        const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || '';
        const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || '';

        _s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint || undefined,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            maxAttempts: 2,
        });
    }
    return _s3Client;
};

export const s3Client = new Proxy({} as S3Client, {
    get(_target, prop) {
        const client = getS3Client();
        const value = (client as any)[prop];
        return typeof value === 'function' ? value.bind(client) : value;
    }
});

export type R2StorageCategory =
    | 'voiceforce/recordings'
    | 'voiceforce/samples'
    | 'documents'
    | 'finance/invoices'
    | 'crm/attachments'
    | 'advertising/reels'
    | 'brands/avatars'
    | 'general';

/**
 * Generates an enterprise multi-tenant object key for Cloudflare R2
 */
export const buildR2Key = (category: R2StorageCategory | string, companyId: string, filename: string): string => {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e6);
    return `${category}/${companyId}/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
};

/**
 * Computes public CDN URL for an R2 object key
 */
export const getR2PublicUrl = (key: string): string => {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || '180workspace';
    const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.REELS_CDN_URL;
    return publicUrlBase 
        ? `${publicUrlBase}/${key}`
        : `https://${bucketName}.r2.dev/${key}`;
};

export const uploadBufferToR2 = async (buffer: Buffer, key: string, mimetype: string) => {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('R2 Bucket name is not configured');
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
    });

    await s3Client.send(command);

    const publicUrl = getR2PublicUrl(key);

    return {
        url: publicUrl,
        key: key
    };
};

export const getPresignedUploadUrl = async (key: string, mimetype: string) => {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('R2 Bucket name is not configured');
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: mimetype,
    });

    const signedUrl = await getSignedUrl(s3Client as any, command, { expiresIn: 3600 });
    return signedUrl;
};

/**
 * Generates a signed, time-limited download URL for confidential files (invoices, payroll, contracts)
 */
export const getPresignedDownloadUrl = async (key: string, expiresInSeconds = 3600): Promise<string> => {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('R2 Bucket name is not configured');
    }

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    return await getSignedUrl(s3Client as any, command, { expiresIn: expiresInSeconds });
};

/**
 * Extracts a clean R2 storage object key from a full URL, relative path, or key.
 */
export const extractR2KeyFromUrl = (urlOrKey: string): string | null => {
    if (!urlOrKey || typeof urlOrKey !== 'string') return null;
    const trimmed = urlOrKey.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;

    try {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            const parsed = new URL(trimmed);
            const pathName = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
            return pathName || null;
        }
        return trimmed.replace(/^\/+/, '');
    } catch {
        return trimmed.replace(/^\/+/, '');
    }
};

/**
 * Deletes a single object from Cloudflare R2 / S3.
 */
export const deleteObjectFromR2 = async (keyOrUrl: string): Promise<boolean> => {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        console.warn('[R2 Storage] Bucket name not configured; skipping deleteObjectFromR2');
        return false;
    }

    const key = extractR2KeyFromUrl(keyOrUrl);
    if (!key) return false;

    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        await s3Client.send(command);
        return true;
    } catch (err: any) {
        console.error(`[R2 Storage] Failed to delete object "${key}":`, err.message);
        return false;
    }
};

/**
 * Bulk deletes multiple objects from Cloudflare R2 / S3 in batches of up to 1000.
 */
export const deleteObjectsFromR2 = async (keysOrUrls: string[]): Promise<{ deleted: number; errors: any[] }> => {
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        console.warn('[R2 Storage] Bucket name not configured; skipping deleteObjectsFromR2');
        return { deleted: 0, errors: ['R2 Bucket name not configured'] };
    }

    if (!Array.isArray(keysOrUrls) || keysOrUrls.length === 0) {
        return { deleted: 0, errors: [] };
    }

    const uniqueKeys = Array.from(
        new Set(
            keysOrUrls
                .map(k => extractR2KeyFromUrl(k))
                .filter((k): k is string => Boolean(k) && typeof k === 'string' && k.length > 0)
        )
    );

    if (uniqueKeys.length === 0) {
        return { deleted: 0, errors: [] };
    }

    let deletedCount = 0;
    const errors: any[] = [];

    // S3 DeleteObjects supports up to 1000 objects per call
    const batchSize = 1000;
    for (let i = 0; i < uniqueKeys.length; i += batchSize) {
        const batch = uniqueKeys.slice(i, i + batchSize);
        try {
            const command = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: batch.map(Key => ({ Key })),
                    Quiet: true,
                },
            });
            const sendPromise = s3Client.send(command);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('R2 delete request timed out after 10000ms')), 10000)
            );
            await Promise.race([sendPromise, timeoutPromise]);
            deletedCount += batch.length;
            console.log(`[R2 Storage] Purged batch of ${batch.length} files from bucket "${bucketName}".`);
        } catch (err: any) {
            console.error(`[R2 Storage] Error deleting batch of ${batch.length} objects:`, err.message);
            errors.push({ batchSize: batch.length, error: err.message });
        }
    }

    return { deleted: deletedCount, errors };
};

/**
 * Uploads an enterprise call recording with multi-tenant company prefix to Cloudflare R2
 */
export const uploadCallRecording = async (
    buffer: Buffer,
    companyId: string,
    callSessionId: string,
    mimetype = 'audio/webm'
) => {
    const ext = mimetype.includes('webm') ? 'webm' : mimetype.includes('mp4') ? 'mp4' : mimetype.includes('ogg') ? 'ogg' : 'mp3';
    const key = `voiceforce/recordings/${companyId}/${callSessionId}.${ext}`;
    return await uploadBufferToR2(buffer, key, mimetype);
};

export const R2Service = {
    uploadBufferToR2,
    uploadCallRecording,
    getPresignedUploadUrl,
    getPresignedDownloadUrl,
    getR2PublicUrl,
    buildR2Key,
    extractR2KeyFromUrl,
    deleteObjectFromR2,
    deleteObjectsFromR2,
};

