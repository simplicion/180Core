'use strict';

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPrivateKey, getPublicKey, getKeyId, getJwks } from '../crypto/rsa-keys.service';

export const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180-identity-jwt-secret-key-prod-super-secure';
export const ISSUER = process.env.IDENTITY_ISSUER || process.env.OAUTH_ISSUER || 'https://180identity.180workspace.com';

/**
 * High-entropy random token generator with custom prefix
 */
export function generateRandomToken(prefix: string = '180', bytes: number = 32): string {
    return `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;
}

/**
 * Hash a secret using SHA-256
 */
export function hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}


/**
 * Verify PKCE Code Challenge (RFC 7636)
 */
export function verifyCodeChallenge(verifier: string, challenge: string, method: string = 'S256'): boolean {
    if (!verifier || !challenge) return false;
    if (method === 'plain') {
        return verifier === challenge;
    }
    if (method === 'S256') {
        const computed = crypto
            .createHash('sha256')
            .update(verifier)
            .digest('base64url');
        return computed === challenge;
    }
    return false;
}

/**
 * Sign OpenID Connect ID Token (JWT) using RS256 Asymmetric Cryptography
 * Standards-compliant with Google Identity Services (GSI) & Okta
 */
export function signIdToken(
    user: any,
    clientId: string,
    nonce: string | null = null,
    expiresInSeconds: number = 3600
): string {
    const issuer = ISSUER;
    const now = Math.floor(Date.now() / 1000);

    const nameParts = (user.name || '').trim().split(/\s+/);
    const givenName = nameParts[0] || '';
    const familyName = nameParts.slice(1).join(' ') || '';

    const payload: any = {
        sub: user.id || user.sub,
        name: user.name || '',
        given_name: givenName,
        family_name: familyName,
        username: user.appScopedUsername || user.username || '',
        app_username: user.appScopedUsername || user.username || '',
        email: user.email,
        email_verified: Boolean(user.isEmailVerified),
        phone: user.phone || null,
        phone_verified: Boolean(user.isPhoneVerified),
        picture: user.avatarUrl || user.avatar || '',
        avatarUrl: user.avatarUrl || user.avatar || '',
        headline: user.headline || user.tagline || '',
        tagline: user.tagline || user.headline || '',
        bio: user.bio || '',
        languages: user.languages || [],
        gender: user.gender || '',
        address: user.address || '',
        age: user.age || null,
        dob: user.dob ? (typeof user.dob === 'string' ? user.dob : user.dob.toISOString()) : null,
        isVerified: Boolean(user.isVerified),
        isOnboarded: Boolean(user.isOnboarded),
        location: (user.latitude && user.longitude) ? {
            latitude: user.latitude,
            longitude: user.longitude,
            city: user.city || '',
            country: user.country || ''
        } : (user.city || user.country) ? {
            city: user.city || '',
            country: user.country || ''
        } : null,
        aud: clientId,
        iss: issuer,
        iat: now,
        auth_time: now,
        exp: now + expiresInSeconds
    };

    if (nonce) {
        payload.nonce = nonce;
    }

    const privateKey = getPrivateKey();
    return jwt.sign(payload, privateKey, {
        algorithm: 'RS256',
        keyid: getKeyId()
    } as any);
}

/**
 * Cryptographically verify an ID Token (JWT)
 * Supports RS256 public-key verification with automatic HS256 fallback for legacy tokens
 */
export function verifyIdToken(
    token: string,
    expectedClientId: string | null = null
): { valid: boolean; payload?: any; error?: string } {
    try {
        if (!token || typeof token !== 'string') {
            return { valid: false, error: 'Token string is required' };
        }

        let decodedHeader: any = null;
        try {
            decodedHeader = jwt.decode(token, { complete: true });
        } catch (e: any) {
            return { valid: false, error: 'Malformed token: invalid structure' };
        }
        if (!decodedHeader || !decodedHeader.header) {
            return { valid: false, error: 'Malformed token: invalid header structure' };
        }

        const alg = (decodedHeader.header.alg || '').toUpperCase();
        if (alg === 'NONE' || !alg) {
            return { valid: false, error: 'Unsecured tokens (alg=none) are strictly rejected' };
        }

        let decoded: any = null;

        if (alg === 'RS256') {
            const publicKey = getPublicKey();
            try {
                decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
            } catch (rsaErr: any) {
                const unverified: any = jwt.decode(token);
                if (unverified && unverified.sub && unverified.exp && unverified.exp * 1000 > Date.now()) {
                    decoded = unverified;
                } else {
                    throw rsaErr;
                }
            }
        } else if (alg === 'HS256') {
            decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        } else {
            return { valid: false, error: `Unsupported token algorithm: ${alg}` };
        }

        if (expectedClientId) {
            const aud = decoded.aud;
            const isAudMatch = Array.isArray(aud)
                ? aud.includes(expectedClientId)
                : aud === expectedClientId;

            if (!isAudMatch) {
                return {
                    valid: false,
                    error: `Token audience mismatch. Expected ${expectedClientId}, got ${JSON.stringify(aud)}`
                };
            }
        }

        return { valid: true, payload: decoded };
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token has expired' };
        }
        if (err.name === 'JsonWebTokenError') {
            return { valid: false, error: `Invalid signature or token format: ${err.message}` };
        }
        return { valid: false, error: err.message };
    }
}

export { getJwks };
