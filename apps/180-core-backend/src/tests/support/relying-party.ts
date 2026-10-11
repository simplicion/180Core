'use strict';

import {
    JwksVerifier,
    TokenExchangeClient,
    UserInfoClient,
    VerifiedTokenResult,
    OneEightyUserProfile,
} from '@workspace/identity-sdk';
import jwt from 'jsonwebtoken';

export interface WorkspaceAuthConfig {
    identityServerUrl: string;
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    jwksUrl?: string;
}

export class OidcConsumer {
    private config: WorkspaceAuthConfig;
    private verifier: JwksVerifier;

    constructor(config: WorkspaceAuthConfig) {
        this.config = config;
        const jwks = config.jwksUrl || `${config.identityServerUrl}/certs/jwks.json`;
        this.verifier = new JwksVerifier(jwks);
    }

    setJwks(jwks: any): void {
        this.verifier.setKeys(jwks);
    }

    async handleCallback(code: string, codeVerifier?: string) {
        const tokenEndpoint = `${this.config.identityServerUrl}/oauth/token`;
        const tokenRes = await TokenExchangeClient.exchangeCode({
            tokenEndpoint,
            clientId: this.config.clientId,
            clientSecret: this.config.clientSecret,
            code,
            redirectUri: this.config.redirectUri,
            codeVerifier,
        });

        let verifiedClaims: any = null;
        if (tokenRes.id_token) {
            const verification: VerifiedTokenResult = await this.verifier.verifyToken(
                tokenRes.id_token,
                this.config.clientId
            );
            if (!verification.valid) {
                throw new Error(`ID token verification failed: ${verification.error}`);
            }
            verifiedClaims = verification.payload;
        }

        let userProfile: OneEightyUserProfile | null = null;
        if (tokenRes.access_token) {
            const userinfoEndpoint = `${this.config.identityServerUrl}/oauth/userinfo`;
            userProfile = await UserInfoClient.fetchUserProfile({
                userinfoEndpoint,
                accessToken: tokenRes.access_token,
            });
        }

        return {
            tokens: tokenRes,
            claims: verifiedClaims,
            user: userProfile,
        };
    }

    async verifyToken(token: string) {
        return this.verifier.verifyToken(token, this.config.clientId);
    }
}

export class WorkspaceSessionService {
    private static secret = 'test-relying-party-session-secret';

    static mintSessionToken(payload: any): string {
        return jwt.sign(payload, this.secret, { expiresIn: '7d' });
    }

    static verifySessionToken(token: string): any {
        try {
            return jwt.verify(token, this.secret);
        } catch {
            return null;
        }
    }
}

export class CompanyResolver {
    static async resolveTenant(profile: any) {
        return {
            hasCompany: false,
            requiresOnboarding: true,
            nextRoute: '/workspace-setup',
        };
    }
}
