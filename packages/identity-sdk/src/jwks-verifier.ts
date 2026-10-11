'use strict';

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface JwksKey {
  kty: string;
  use: string;
  alg: string;
  kid: string;
  n: string;
  e: string;
}

export interface JwksResponse {
  keys: JwksKey[];
}

export interface VerifiedTokenResult {
  valid: boolean;
  payload?: any;
  error?: string;
}

/**
 * Converts JWK RSA modulus and exponent to PEM format
 */
function jwkToPem(key: JwksKey): string {
  const keyObject = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: key.n,
      e: key.e,
    },
    format: 'jwk',
  });
  return keyObject.export({ format: 'pem', type: 'spki' }).toString();
}

export class JwksVerifier {
  private jwksUrl: string;
  private cachedKeys: Map<string, string> = new Map();
  private lastFetchTime: number = 0;
  private cacheTtlMs: number = 1000 * 60 * 60; // 1 hour

  constructor(jwksUrl: string = 'https://180identity.180workspace.com/certs/jwks.json') {
    this.jwksUrl = jwksUrl;
  }

  /**
   * Manually seed public keys (useful for testing or offline environments)
   */
  setKeys(jwks: JwksResponse): void {
    this.cachedKeys.clear();
    for (const k of jwks.keys) {
      try {
        const pem = jwkToPem(k);
        this.cachedKeys.set(k.kid, pem);
      } catch (err) {
        console.error(`[JwksVerifier] Failed to parse key ${k.kid}:`, err);
      }
    }
    this.lastFetchTime = Date.now();
  }

  /**
   * Fetch JWKS from remote endpoint
   */
  async refreshKeys(): Promise<void> {
    const res = await fetch(this.jwksUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch JWKS from ${this.jwksUrl}: ${res.statusText}`);
    }
    const data: JwksResponse = await res.json();
    this.setKeys(data);
  }

  /**
   * Verify RS256 JWT Token using public key matching the token's kid
   */
  async verifyToken(token: string, expectedAudience?: string): Promise<VerifiedTokenResult> {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return { valid: false, error: 'Invalid JWT format' };
      }

      const kid = decoded.header.kid;
      if (!kid) {
        return { valid: false, error: 'Token missing kid header' };
      }

      // Check if key exists in cache, or if cache is stale
      if (!this.cachedKeys.has(kid) || Date.now() - this.lastFetchTime > this.cacheTtlMs) {
        try {
          await this.refreshKeys();
        } catch {
          // In testing or without network, ignore if already present
        }
      }

      const publicKeyPem = this.cachedKeys.get(kid);
      if (!publicKeyPem) {
        return { valid: false, error: `Public key with kid '${kid}' not found in JWKS` };
      }

      const payload = jwt.verify(token, publicKeyPem, {
        algorithms: ['RS256'],
        audience: expectedAudience,
      });

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }
}
