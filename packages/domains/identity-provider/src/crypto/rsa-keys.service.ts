'use strict';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_ID = process.env.OAUTH_KEY_ID || '180-identity-2026-v1';

function resolveKeyFilePath(): string {
    const candidatePaths = [
        process.env.OAUTH_KEY_FILE_PATH,
        path.resolve(process.cwd(), 'packages', 'keys', 'oauth-rsa-key.json'),
        path.resolve(process.cwd(), '..', 'packages', 'keys', 'oauth-rsa-key.json'),
        path.resolve(process.cwd(), '..', '..', 'packages', 'keys', 'oauth-rsa-key.json'),
        path.resolve(process.cwd(), 'keys', 'oauth-rsa-key.json'),
        path.resolve(process.cwd(), '..', 'keys', 'oauth-rsa-key.json'),
        path.resolve(process.cwd(), '..', '..', 'keys', 'oauth-rsa-key.json'),
        path.resolve(__dirname, '../../../../packages/keys/oauth-rsa-key.json'),
        path.resolve(__dirname, '../../../../keys/oauth-rsa-key.json'),
        path.resolve(__dirname, '../../../keys/oauth-rsa-key.json'),
        path.resolve(__dirname, '../../keys/oauth-rsa-key.json'),
    ].filter(Boolean) as string[];

    for (const p of candidatePaths) {
        try {
            if (fs.existsSync(p)) return p;
        } catch (_) {}
    }
    return path.resolve(process.cwd(), 'packages', 'keys', 'oauth-rsa-key.json');
}

const KEY_FILE_PATH = resolveKeyFilePath();
const KEYS_DIR = path.dirname(KEY_FILE_PATH);

let privateKeyPem: string | null = null;
let publicKeyPem: string | null = null;
let cachedJwks: { keys: any[] } | null = null;

/**
 * Initialize RSA 2048-bit Keypair for RS256 Asymmetric OIDC Token Signing
 */
export function initializeKeys(): void {
    // 1. Check if provided via Environment Variables (Preferred for Cloud/Production)
    if (process.env.OAUTH_RSA_PRIVATE_KEY && process.env.OAUTH_RSA_PUBLIC_KEY) {
        try {
            let priv = process.env.OAUTH_RSA_PRIVATE_KEY.trim();
            let pub = process.env.OAUTH_RSA_PUBLIC_KEY.trim();

            if (!priv.includes('-----BEGIN') && !priv.includes('PRIVATE KEY')) {
                priv = Buffer.from(priv, 'base64').toString('utf8');
            }
            if (!pub.includes('-----BEGIN') && !pub.includes('PUBLIC KEY')) {
                pub = Buffer.from(pub, 'base64').toString('utf8');
            }

            privateKeyPem = priv;
            publicKeyPem = pub;
            cachedJwks = null;
            console.log('[RSAKeysService] Loaded RSA keypair from environment variables');
            return;
        } catch (e: any) {
            console.warn('[RSAKeysService] Failed parsing env RSA keys, falling back to persistent storage:', e.message);
        }
    }

    // 2. Check if persistent key file exists on disk
    if (fs.existsSync(KEY_FILE_PATH)) {
        try {
            const raw = fs.readFileSync(KEY_FILE_PATH, 'utf8');
            const data = JSON.parse(raw);
            if (data.privateKey && data.publicKey) {
                privateKeyPem = data.privateKey;
                publicKeyPem = data.publicKey;
                cachedJwks = null;
                return;
            }
        } catch (e: any) {
            console.warn('[RSAKeysService] Failed reading cached key file, regenerating:', e.message);
        }
    }

    // 3. Generate fresh RSA 2048-bit keypair
    try {
        if (!fs.existsSync(KEYS_DIR)) {
            fs.mkdirSync(KEYS_DIR, { recursive: true });
        }

        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        privateKeyPem = privateKey;
        publicKeyPem = publicKey;
        cachedJwks = null;

        fs.writeFileSync(KEY_FILE_PATH, JSON.stringify({
            kid: KEY_ID,
            createdAt: new Date().toISOString(),
            privateKey: privateKeyPem,
            publicKey: publicKeyPem
        }, null, 2), { mode: 0o600 });

        console.log('[RSAKeysService] Successfully generated fresh RSA 2048-bit keypair to', KEY_FILE_PATH);
    } catch (err: any) {
        console.error('[RSAKeysService] Error generating RSA keypair:', err);
        throw err;
    }
}

// Initial key load
initializeKeys();

/**
 * Returns RSA Private Key PEM
 */
export function getPrivateKey(): string {
    if (!privateKeyPem) initializeKeys();
    return privateKeyPem!;
}

/**
 * Returns RSA Public Key PEM
 */
export function getPublicKey(): string {
    if (!publicKeyPem) initializeKeys();
    return publicKeyPem!;
}

/**
 * Returns Active Key ID
 */
export function getKeyId(): string {
    return KEY_ID;
}

/**
 * Returns RFC 7517 compliant JSON Web Key Set (JWKS)
 */
export function getJwks(): { keys: any[] } {
    if (cachedJwks) return cachedJwks;

    const pubKey = getPublicKey();
    const keyObject = crypto.createPublicKey(pubKey);
    const jwk = keyObject.export({ format: 'jwk' }) as any;

    cachedJwks = {
        keys: [
            {
                kty: 'RSA',
                use: 'sig',
                alg: 'RS256',
                kid: KEY_ID,
                n: jwk.n,
                e: jwk.e
            }
        ]
    };

    return cachedJwks;
}

export const RsaKeysService = {
    initializeKeys,
    ensureKeys: initializeKeys,
    getPrivateKey,
    getPublicKey,
    getKeyId,
    getJwks,
};
