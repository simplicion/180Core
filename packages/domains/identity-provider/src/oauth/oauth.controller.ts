'use strict';

import jwt from 'jsonwebtoken';
import { developersPrisma as prisma } from '@workspace/db-180core';
import {
    generateRandomToken,
    hashSecret,
    verifyCodeChallenge,
    signIdToken,
    verifyIdToken,
    getJwks,
    ISSUER
} from './oauth.service';
import { FIRST_PARTY_APPS, isFirstPartyApp } from './seed-first-party';
import { UsernameService } from '../user/username.service';

/**
 * Architectural Best Practice: First-Party Ecosystem Auto-Whitelisting
 * 180 Workspace and official client apps (Pitch in 180, Social Studio, Developer Portal)
 * are recognized first-party origins.
 */
function isFirstPartyOrigin(origin: string | undefined): boolean {
    if (!origin || typeof origin !== 'string') return false;
    try {
        const clean = origin.trim().toLowerCase();
        if (clean === 'null' || clean === '*' || clean === '') return false;
        const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
        const host = parsed.hostname;

        // Local development environments on any port
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
            return true;
        }

        // 180 Ecosystem domains
        if (host === '180workspace.com' || host.endsWith('.180workspace.com')) {
            return true;
        }

        // Environment configured main domain
        const mainDomain = (process.env.NEXT_PUBLIC_MAIN_DOMAIN || '').toLowerCase();
        if (mainDomain && (host === mainDomain || host.endsWith(`.${mainDomain}`))) {
            return true;
        }

        const issuerHost = (() => {
            try { return new URL(ISSUER).hostname.toLowerCase(); } catch (e) { return ''; }
        })();
        if (issuerHost && (host === issuerHost || host.endsWith(`.${issuerHost}`))) {
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}

export class OAuthController {
    /**
     * 1. Validate Authorize Request before rendering Consent / Login Screen
     */
    static async validateAuthorize(req: any, res: any) {
        try {
            const { client_id, redirect_uri, scope, state, response_type, display, ux_mode } = req.query;

            if (!client_id) {
                return res.status(400).json({ error: 'invalid_request', error_description: 'Missing client_id parameter' });
            }

            let app: any = null;
            try {
                app = await prisma.oAuthApp.findUnique({
                    where: { clientId: String(client_id) },
                    include: { user: true }
                });
            } catch (e) {
                app = null;
            }

            const fp = FIRST_PARTY_APPS.find(a => a.clientId === String(client_id));
            if (fp) {
                if (!app) {
                    app = {
                        id: fp.clientId,
                        name: fp.name,
                        description: fp.description,
                        clientId: fp.clientId,
                        redirectUris: fp.redirectUris,
                        allowedOrigins: fp.allowedOrigins,
                        allowedScopes: fp.allowedScopes,
                        logoUrl: fp.logoUrl,
                        homepageUrl: 'https://180workspace.com',
                        isVerified: true,
                        isActive: true,
                        company: null,
                        user: null
                    } as any;
                } else {
                    app.redirectUris = Array.from(new Set([...(app.redirectUris || []), ...fp.redirectUris]));
                    app.allowedOrigins = Array.from(new Set([...(app.allowedOrigins || []), ...fp.allowedOrigins]));
                }
            }

            if (!app || !app.isActive) {
                return res.status(400).json({
                    error: 'unauthorized_client',
                    error_description: `OAuth Application with Client ID '${client_id}' was not found or is currently inactive.`,
                    details: {
                        type: 'CLIENT_NOT_FOUND',
                        clientId: String(client_id),
                        hint: `Verify that the Client ID matches an active application in your 180 Developer Portal.`
                    }
                });
            }

            if (app.enableAuth === false) {
                return res.status(403).json({
                    error: 'unauthorized_client',
                    error_description: `180 Identity Authentication is disabled for application '${app.name}'.`,
                    details: {
                        type: 'AUTH_DISABLED',
                        clientId: app.clientId,
                        appName: app.name,
                        hint: `Enable 180 Identity in the application settings under 180 Developer Portal.`
                    }
                });
            }

            // Redirect URI validation (RFC 9700 Open Redirector Defense)
            if (redirect_uri && app.redirectUris && app.redirectUris.length > 0) {
                const isMatch = app.redirectUris.some((uri: string) => {
                    const cleanRegistered = uri.trim();
                    const cleanTarget = String(redirect_uri).trim();
                    if (cleanRegistered === '*') return true;
                    if (cleanRegistered.toLowerCase() === cleanTarget.toLowerCase()) return true;
                    try {
                        const parsedRegistered = new URL(cleanRegistered);
                        const parsedTarget = new URL(cleanTarget);
                        return parsedRegistered.origin.toLowerCase() === parsedTarget.origin.toLowerCase() &&
                               parsedRegistered.pathname === parsedTarget.pathname;
                    } catch (e) {
                        return false;
                    }
                });
                if (!isMatch) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: `The redirect URI '${redirect_uri}' is not registered for application '${app.name || 'Application'}' (${app.clientId}).`,
                        details: {
                            type: 'REDIRECT_URI_MISMATCH',
                            requestedUri: String(redirect_uri),
                            appName: app.name,
                            clientId: app.clientId,
                            registeredUris: app.redirectUris || [],
                            allowedOrigins: app.allowedOrigins || [],
                            hint: `Add '${redirect_uri}' to the Allowed Redirect URIs list of '${app.name}' in your 180 Developer Portal.`
                        }
                    });
                }
            }

            // Origin validation
            let requestOrigin = req.query.origin as string;
            if (!requestOrigin && redirect_uri) {
                try {
                    const parsed = new URL(String(redirect_uri));
                    if (parsed.origin && parsed.origin !== 'null') {
                        requestOrigin = parsed.origin;
                    }
                } catch (e) {}
            }
            if (!requestOrigin || requestOrigin === 'null') {
                requestOrigin = req.headers.origin || (req.headers.referer ? (() => { try { return new URL(req.headers.referer).origin; } catch (e) { return ''; } })() : '');
            }
            if (requestOrigin === 'null') {
                requestOrigin = '';
            }

            const isFirstParty = isFirstPartyOrigin(requestOrigin);

            // Native/mobile apps with custom schemes (e.g. workspace180://, 180social://) do not have web origins
            const isCustomSchemeRedirect = redirect_uri && !String(redirect_uri).startsWith('http://') && !String(redirect_uri).startsWith('https://');

            if (!isCustomSchemeRedirect && !isFirstParty && requestOrigin && app.allowedOrigins && app.allowedOrigins.length > 0) {
                let normalizedReqOrigin = '';
                try {
                    normalizedReqOrigin = new URL(requestOrigin.startsWith('http') ? requestOrigin : `https://${requestOrigin}`).origin.toLowerCase();
                } catch (e) {
                    normalizedReqOrigin = requestOrigin.trim().toLowerCase();
                }

                const isOriginMatch = app.allowedOrigins.some((orig: string) => {
                    const cleanOrig = orig.trim().toLowerCase();
                    if (cleanOrig === '*') return true;
                    try {
                        const normalizedAllowed = new URL(cleanOrig.startsWith('http') ? cleanOrig : `https://${cleanOrig}`).origin.toLowerCase();
                        return normalizedAllowed === normalizedReqOrigin;
                    } catch (e) {
                        return cleanOrig === normalizedReqOrigin;
                    }
                });
                if (!isOriginMatch) {
                    return res.status(400).json({
                        error: 'unauthorized_client',
                        error_description: `The origin '${requestOrigin}' is not whitelisted for application '${app.name || 'Application'}' (${app.clientId}).`,
                        details: {
                            type: 'ORIGIN_MISMATCH',
                            requestedOrigin: String(requestOrigin),
                            appName: app.name,
                            clientId: app.clientId,
                            allowedOrigins: app.allowedOrigins || [],
                            registeredUris: app.redirectUris || [],
                            hint: `Add '${requestOrigin}' to the Allowed Origins list of '${app.name}' in your 180 Developer Portal.`
                        }
                    });
                }
            }

            const targetRedirectUri = redirect_uri || (app.redirectUris.length > 0 ? app.redirectUris[0] : '');
            const requestedScopes = scope ? String(scope).split(' ').filter(Boolean) : ['identity:read'];

            // Check if user is currently authenticated
            const userId = req.user?.id;
            let hasConsented = false;
            let userDetails = null;

            if (userId) {
                const userRecord = req.user || await prisma.user.findUnique({
                    where: { id: userId }
                });

                if (userRecord) {
                    const nameParts = (userRecord.name || '').trim().split(/\s+/);
                    userDetails = {
                        id: userRecord.id,
                        name: userRecord.name || '',
                        given_name: nameParts[0] || '',
                        family_name: nameParts.slice(1).join(' ') || '',
                        username: userRecord.username || '',
                        email: userRecord.email,
                        avatarUrl: userRecord.avatarUrl || '',
                        headline: userRecord.headline || ''
                    };
                }

                const existingConsent = await prisma.oAuthConsent.findUnique({
                    where: {
                        appId_userId: {
                            appId: app.id,
                            userId
                        }
                    }
                });

                if (existingConsent) {
                    const hasAllScopes = requestedScopes.every(s => existingConsent.scopes.includes(s));
                    if (hasAllScopes) {
                        hasConsented = true;
                    }
                }
            }

            const isMobileReq = /Android|iPhone|iPad|iPod|Mobile/i.test(req.headers['user-agent'] || '');
            const authDesktopDefault = (app as any).authDesktopDefault || 'popup';
            const authMobileDefault = (app as any).authMobileDefault || 'bottom_sheet';
            const payDesktopDefault = (app as any).payDesktopDefault || 'bottom_sheet';
            const payMobileDefault = (app as any).payMobileDefault || 'bottom_sheet';

            const clientPayload = {
                id: app.id,
                clientId: app.clientId,
                name: app.name,
                description: app.description,
                logoUrl: app.logoUrl || app.company?.logoUrl || '',
                developerName: app.company?.name || app.user?.name || '180 Developer',
                isVerified: app.isVerified,
                homepageUrl: app.homepageUrl || '',
                redirectUris: app.redirectUris,
                allowedScopes: app.allowedScopes,
                authDesktopDefault,
                authMobileDefault,
                payDesktopDefault,
                payMobileDefault
            };

            const computedDefaultUx = isMobileReq ? authMobileDefault : authDesktopDefault;

            return res.json({
                success: true,
                app: clientPayload,
                client: clientPayload,
                client_id,
                redirect_uri: targetRedirectUri,
                scopes: requestedScopes,
                state: state || '',
                response_type: response_type || 'code',
                display: display || '',
                ux_mode: ux_mode || computedDefaultUx,
                authDesktopDefault,
                authMobileDefault,
                payDesktopDefault,
                payMobileDefault,
                hasConsented,
                isAuthenticated: Boolean(userId),
                user: userDetails
            });
        } catch (err: any) {
            console.error('[OAuthController] validateAuthorize error:', err);
            return res.status(500).json({ error: 'server_error', error_description: err.message });
        }
    }

    /**
     * 1.1 Public Application Metadata & UX Configuration
     */
    static async getAppPublicConfig(req: any, res: any) {
        try {
            const clientId = req.params?.clientId || req.query?.client_id;
            if (!clientId) {
                return res.status(400).json({ error: 'invalid_request', error_description: 'Missing clientId parameter' });
            }

            let app: any = null;
            try {
                app = await prisma.oAuthApp.findUnique({
                    where: { clientId: String(clientId) },
                    include: { user: true }
                });
            } catch (e) {
                app = null;
            }

            const fp = FIRST_PARTY_APPS.find(a => a.clientId === String(clientId));
            if (fp) {
                if (!app) {
                    app = {
                        id: fp.clientId,
                        name: fp.name,
                        description: fp.description,
                        clientId: fp.clientId,
                        redirectUris: fp.redirectUris,
                        allowedOrigins: fp.allowedOrigins,
                        allowedScopes: fp.allowedScopes,
                        logoUrl: fp.logoUrl,
                        homepageUrl: 'https://180workspace.com',
                        isVerified: true,
                        isActive: true,
                        authDesktopDefault: (fp as any).authDesktopDefault || 'popup',
                        authMobileDefault: (fp as any).authMobileDefault || 'bottom_sheet',
                        payDesktopDefault: (fp as any).payDesktopDefault || 'bottom_sheet',
                        payMobileDefault: (fp as any).payMobileDefault || 'bottom_sheet',
                        user: null,
                    } as any;
                }
            }

            if (!app || !app.isActive) {
                return res.status(404).json({ error: 'client_not_found', error_description: `OAuth Application '${clientId}' was not found or is inactive.` });
            }

            return res.json({
                success: true,
                clientId: app.clientId,
                name: app.name,
                description: app.description || '',
                logoUrl: app.logoUrl || '',
                developerName: app.user?.name || '180 Developer',
                isVerified: app.isVerified,
                authDesktopDefault: (app as any).authDesktopDefault || 'popup',
                authMobileDefault: (app as any).authMobileDefault || 'bottom_sheet',
                payDesktopDefault: (app as any).payDesktopDefault || 'bottom_sheet',
                payMobileDefault: (app as any).payMobileDefault || 'bottom_sheet',
            });
        } catch (err: any) {
            console.error('[OAuthController] getAppPublicConfig error:', err);
            return res.status(500).json({ error: 'server_error', error_description: err.message });
        }
    }

    /**
     * 2. Submit User Consent (Allow / Deny)
     */
    static async submitConsent(req: any, res: any) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'unauthorized', error_description: 'User must be authenticated to grant consent' });
            }

            const { client_id, redirect_uri, scope, state, action, code_challenge, code_challenge_method, nonce, ux_mode } = req.body;

            if (!client_id) {
                return res.status(400).json({ error: 'invalid_request', error_description: 'Missing client_id' });
            }

            let app: any = null;
            try {
                app = await prisma.oAuthApp.findUnique({
                    where: { clientId: String(client_id) }
                });
            } catch (e) {
                app = null;
            }

            const fp = FIRST_PARTY_APPS.find(a => a.clientId === String(client_id));
            if (fp) {
                if (!app) {
                    app = {
                        id: fp.clientId,
                        name: fp.name,
                        description: fp.description,
                        clientId: fp.clientId,
                        redirectUris: fp.redirectUris,
                        allowedOrigins: fp.allowedOrigins,
                        allowedScopes: fp.allowedScopes,
                        logoUrl: fp.logoUrl,
                        homepageUrl: 'https://180workspace.com',
                        isVerified: true,
                        isActive: true
                    } as any;
                } else {
                    app.redirectUris = Array.from(new Set([...(app.redirectUris || []), ...fp.redirectUris]));
                    app.allowedOrigins = Array.from(new Set([...(app.allowedOrigins || []), ...fp.allowedOrigins]));
                }
            }

            if (!app || !app.isActive) {
                return res.status(400).json({ error: 'unauthorized_client', error_description: 'OAuth application not found or disabled' });
            }

            const user = req.user || await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                return res.status(404).json({ error: 'user_not_found', error_description: 'Authenticated user not found' });
            }

            const targetRedirectUri = redirect_uri || (app.redirectUris.length > 0 ? app.redirectUris[0] : '');
            const requestedScopes = scope ? (Array.isArray(scope) ? scope : String(scope).split(' ').filter(Boolean)) : ['identity:read'];

            // Validate redirect URI in submitConsent (RFC 9700 Open Redirector Defense)
            if (redirect_uri && app.redirectUris && app.redirectUris.length > 0) {
                const isMatch = app.redirectUris.some((uri: string) => {
                    const cleanRegistered = uri.trim();
                    const cleanTarget = String(redirect_uri).trim();
                    if (cleanRegistered === '*') return true;
                    if (cleanRegistered.toLowerCase() === cleanTarget.toLowerCase()) return true;
                    try {
                        const parsedRegistered = new URL(cleanRegistered);
                        const parsedTarget = new URL(cleanTarget);
                        return parsedRegistered.origin.toLowerCase() === parsedTarget.origin.toLowerCase() &&
                               parsedRegistered.pathname === parsedTarget.pathname;
                    } catch (e) {
                        return false;
                    }
                });
                if (!isMatch) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: `Redirect URI '${redirect_uri}' is not registered for application '${app.name || 'Application'}' (${app.clientId}).`,
                        details: {
                            type: 'REDIRECT_URI_MISMATCH',
                            requestedUri: String(redirect_uri),
                            appName: app.name,
                            clientId: app.clientId,
                            registeredUris: app.redirectUris || [],
                            allowedOrigins: app.allowedOrigins || [],
                            hint: `Add '${redirect_uri}' to the Allowed Redirect URIs list of '${app.name}' in your 180 Developer Portal.`
                        }
                    });
                }
            }

            // User denied access
            if (action === 'deny') {
                let denyRedirectUrl = '';
                if (targetRedirectUri) {
                    try {
                        const parsedUrl = new URL(targetRedirectUri);
                        parsedUrl.searchParams.set('error', 'access_denied');
                        parsedUrl.searchParams.set('error_description', 'The user denied the authorization request');
                        if (state) parsedUrl.searchParams.set('state', state);
                        denyRedirectUrl = parsedUrl.toString();
                    } catch (e) {
                        denyRedirectUrl = targetRedirectUri;
                    }
                }

                return res.json({
                    success: false,
                    action: 'deny',
                    redirectUri: denyRedirectUrl
                });
            }

            // User allowed access -> Save / Upsert consent
            await prisma.oAuthConsent.upsert({
                where: {
                    appId_userId: {
                        appId: app.id,
                        userId
                    }
                },
                create: {
                    appId: app.id,
                    userId,
                    scopes: requestedScopes
                },
                update: {
                    scopes: requestedScopes,
                    updatedAt: new Date()
                }
            });

            // Generate 5-minute single-use authorization code
            const code = generateRandomToken('180_code', 32);
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

            await prisma.oAuthAuthorizationCode.create({
                data: {
                    code,
                    appId: app.id,
                    userId,
                    redirectUri: targetRedirectUri || 'https://180workspace.com/oauth/callback',
                    scopes: requestedScopes,
                    codeChallenge: code_challenge || null,
                    codeChallengeMethod: code_challenge_method || 'S256',
                    expiresAt
                }
            });

            // Provision isolated app-scoped username
            let appScopedUsername = user.username || '';
            try {
                const appIdentity = await UsernameService.provisionAppUsername(app.id, userId, user.username);
                if (appIdentity && appIdentity.username) {
                    appScopedUsername = appIdentity.username;
                }
            } catch (e: any) {
                console.warn('[OAuthController:submitConsent] Error provisioning app username:', e.message);
            }

            // Generate signed RS256 JWT ID Token
            const userWithAppScope = {
                ...user,
                appScopedUsername
            };
            const idToken = signIdToken(userWithAppScope, app.clientId, nonce);

            let allowRedirectUrl = '';
            if (targetRedirectUri) {
                try {
                    const parsedUrl = new URL(targetRedirectUri);
                    parsedUrl.searchParams.set('code', code);
                    if (state) parsedUrl.searchParams.set('state', state);
                    allowRedirectUrl = parsedUrl.toString();
                } catch (e) {
                    allowRedirectUrl = targetRedirectUri;
                }
            }

            return res.json({
                success: true,
                action: 'allow',
                code,
                id_token: idToken,
                credential: idToken,
                state: state || '',
                ux_mode: ux_mode || 'popup',
                redirectUri: allowRedirectUrl,
                user: {
                    id: user.id,
                    name: user.name || '',
                    username: user.username || '',
                    email: user.email,
                    avatarUrl: user.avatarUrl || ''
                }
            });
        } catch (err: any) {
            console.error('[OAuthController] submitConsent error:', err);
            return res.status(500).json({ error: 'server_error', error_description: err.message });
        }
    }

    /**
     * 3. Exchange Authorization Code for Access Token (RFC 6749)
     */
    static async exchangeToken(req: any, res: any) {
        try {
            const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = req.body;

            // Handle Authorization Code Grant
            if (grant_type === 'authorization_code') {
                if (!code) {
                    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing code parameter' });
                }

                const authCode = await prisma.oAuthAuthorizationCode.findUnique({
                    where: { code },
                    include: { app: true, user: true }
                });

                if (!authCode) {
                    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code is invalid or expired' });
                }

                if (authCode.usedAt || authCode.expiresAt < new Date()) {
                    return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code has already been used or expired' });
                }

                // Verify client identification
                const targetClientId = client_id || authCode.app.clientId;
                if (authCode.app.clientId !== targetClientId) {
                    return res.status(400).json({ error: 'invalid_client', error_description: 'client_id does not match the authorization code' });
                }

                // PKCE Verification if challenge was registered
                if (authCode.codeChallenge) {
                    if (!code_verifier) {
                        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE code_verifier is required' });
                    }
                    const isPkceValid = verifyCodeChallenge(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod || 'S256');
                    if (!isPkceValid) {
                        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE code_verifier verification failed' });
                    }
                } else if (client_secret) {
                    // Confidential Client secret verification
                    const hashed = hashSecret(client_secret);
                    if (authCode.app.clientSecretHash !== hashed) {
                        return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client_secret' });
                    }
                }

                // Mark code as used immediately (single-use defense)
                await prisma.oAuthAuthorizationCode.update({
                    where: { id: authCode.id },
                    data: { usedAt: new Date() }
                });

                // Issue Access Token & Refresh Token
                const accessToken = generateRandomToken('180_acc', 32);
                const newRefreshToken = generateRandomToken('180_ref', 32);
                const appSettings = (authCode.app as any)?.bankDetails as any;
                const accessLifetime = (appSettings?.accessTokenTtl && Number(appSettings.accessTokenTtl) > 0)
                    ? Number(appSettings.accessTokenTtl)
                    : 900; // 15 minutes standard (RFC 6749 compliant)
                const expiresAt = new Date(Date.now() + accessLifetime * 1000);

                await prisma.oAuthToken.create({
                    data: {
                        accessToken,
                        refreshToken: newRefreshToken,
                        tokenType: 'Bearer',
                        scopes: authCode.scopes,
                        appId: authCode.app.id,
                        userId: authCode.user.id,
                        expiresAt
                    }
                });

                // Auto-upsert consent record (implicit consent for first-party & authorized apps)
                try {
                    await prisma.oAuthConsent.upsert({
                        where: {
                            appId_userId: {
                                appId: authCode.app.id,
                                userId: authCode.user.id
                            }
                        },
                        create: {
                            appId: authCode.app.id,
                            userId: authCode.user.id,
                            scopes: authCode.scopes
                        },
                        update: {
                            scopes: authCode.scopes,
                            updatedAt: new Date()
                        }
                    });
                } catch (_) {}

                let appScopedUsername = authCode.user.username || '';
                try {
                    const appUser = await prisma.appUserIdentity.findUnique({
                        where: {
                            appId_userId: {
                                appId: authCode.app.id,
                                userId: authCode.user.id
                            }
                        }
                    });
                    if (appUser && appUser.username) {
                        appScopedUsername = appUser.username;
                    }
                } catch (_) {}

                const idToken = signIdToken({ ...authCode.user, appScopedUsername }, authCode.app.clientId);

                return res.json({
                    access_token: accessToken,
                    token_type: 'Bearer',
                    expires_in: accessLifetime,
                    refresh_token: newRefreshToken,
                    id_token: idToken,
                    scope: authCode.scopes.join(' ')
                });
            }

            // Handle Refresh Token Grant
            if (grant_type === 'refresh_token') {
                if (!refresh_token) {
                    return res.status(400).json({ error: 'invalid_request', error_description: 'Missing refresh_token' });
                }

                const existingToken = await prisma.oAuthToken.findUnique({
                    where: { refreshToken: refresh_token },
                    include: { app: true, user: true }
                });

                if (!existingToken || existingToken.revokedAt) {
                    return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token is invalid or revoked' });
                }

                // Enforce 7-Day (or configured) Refresh Token Lifecycle
                const appSettings = (existingToken.app as any)?.bankDetails as any;
                const refreshLifetimeDays = (appSettings?.refreshTokenDays && Number(appSettings.refreshTokenDays) > 0)
                    ? Number(appSettings.refreshTokenDays)
                    : 7; // 7 days standard cycle
                const maxRefreshAgeMs = refreshLifetimeDays * 24 * 3600 * 1000;

                if (Date.now() - new Date(existingToken.createdAt).getTime() > maxRefreshAgeMs) {
                    return res.status(400).json({
                        error: 'invalid_grant',
                        error_description: `Refresh token has expired (${refreshLifetimeDays}-day lifecycle). User must re-authenticate.`
                    });
                }

                // Rotate refresh token
                const newAccessToken = generateRandomToken('180_acc', 32);
                const rotatedRefreshToken = generateRandomToken('180_ref', 32);
                const accessLifetime = (appSettings?.accessTokenTtl && Number(appSettings.accessTokenTtl) > 0)
                    ? Number(appSettings.accessTokenTtl)
                    : 900; // 15 minutes standard
                const expiresAt = new Date(Date.now() + accessLifetime * 1000);

                await prisma.oAuthToken.update({
                    where: { id: existingToken.id },
                    data: {
                        accessToken: newAccessToken,
                        refreshToken: rotatedRefreshToken,
                        expiresAt,
                        updatedAt: new Date()
                    }
                });

                const idToken = signIdToken(existingToken.user, existingToken.app.clientId);

                return res.json({
                    access_token: newAccessToken,
                    token_type: 'Bearer',
                    expires_in: accessLifetime,
                    refresh_token: rotatedRefreshToken,
                    id_token: idToken,
                    scope: existingToken.scopes.join(' ')
                });
            }

            return res.status(400).json({ error: 'unsupported_grant_type', error_description: `Grant type '${grant_type}' is not supported` });
        } catch (err: any) {
            console.error('[OAuthController] exchangeToken error:', err);
            return res.status(500).json({ error: 'server_error', error_description: err.message });
        }
    }

    /**
     * 4. UserInfo Endpoint (OIDC Standard)
     */
    static async getUserInfo(req: any, res: any) {
        try {
            let user = req.user;

            if (!user) {
                const authHeader = req.headers.authorization || '';
                const token = authHeader.replace(/^Bearer\s+/i, '').trim();

                if (!token) {
                    return res.status(401).json({ error: 'invalid_token', error_description: 'Missing Bearer token' });
                }

                // Check if token is an access token from DB
                const dbToken = await prisma.oAuthToken.findUnique({
                    where: { accessToken: token },
                    include: { user: true, app: true }
                });

                if (dbToken) {
                    if (dbToken.revokedAt || dbToken.expiresAt <= new Date()) {
                        return res.status(401).json({ error: 'invalid_token', error_description: 'Token has been revoked or expired' });
                    }
                    if (!isFirstPartyApp(dbToken.app?.clientId)) {
                        const consent = await prisma.oAuthConsent.findUnique({
                            where: {
                                appId_userId: {
                                    appId: dbToken.appId,
                                    userId: dbToken.userId
                                }
                            }
                        });
                        if (!consent) {
                            return res.status(401).json({ error: 'consent_revoked', error_description: 'User access for this application has been revoked' });
                        }
                    }
                    user = dbToken.user;
                }

                // Check if token is platform JWT
                if (!user) {
                    try {
                        const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180-identity-jwt-secret-key-prod-super-secure';
                        const decoded: any = jwt.verify(token, JWT_SECRET);
                        const targetUserId = decoded.id || decoded.sub || decoded.userId;
                        if (targetUserId) {
                            user = await prisma.user.findUnique({ where: { id: targetUserId } });
                        }
                    } catch (e) {}
                }

                // If not found in DB, check if it's a signed JWT ID token
                if (!user) {
                    const verified = verifyIdToken(token);
                    const targetUserId = verified.payload?.sub || verified.payload?.id || verified.payload?.userId;
                    const tokenAud = verified.payload?.aud;
                    if (verified.valid && targetUserId) {
                        if (tokenAud && typeof tokenAud === 'string' && tokenAud !== '180-core' && !isFirstPartyApp(tokenAud)) {
                            const app = await prisma.oAuthApp.findFirst({
                                where: { OR: [{ clientId: tokenAud }, { id: tokenAud }] }
                            });
                            if (app && !isFirstPartyApp(app.clientId)) {
                                const consent = await prisma.oAuthConsent.findUnique({
                                    where: {
                                        appId_userId: {
                                            appId: app.id,
                                            userId: targetUserId
                                        }
                                    }
                                });
                                if (!consent) {
                                    return res.status(401).json({ error: 'consent_revoked', error_description: 'User access for this application has been revoked' });
                                }
                            }
                        }
                        user = await prisma.user.findUnique({
                            where: { id: targetUserId }
                        });
                    }
                }
            }

            if (!user) {
                return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired or invalid' });
            }

            const nameParts = (user.name || '').trim().split(/\s+/);

            return res.json({
                sub: user.id,
                id: user.id,
                name: user.name || '',
                given_name: nameParts[0] || '',
                family_name: nameParts.slice(1).join(' ') || '',
                username: user.username || '',
                email: user.email,
                email_verified: Boolean(user.isEmailVerified),
                phone: user.phone || null,
                picture: user.avatarUrl || '',
                avatarUrl: user.avatarUrl || '',
                headline: user.headline || '',
                age: user.age || null,
                isOnboarded: Boolean(user.isOnboarded),
                user: {
                    id: user.id,
                    sub: user.id,
                    name: user.name || '',
                    email: user.email,
                    username: user.username || '',
                    avatarUrl: user.avatarUrl || '',
                },
                location: (user.latitude && user.longitude) ? {
                    latitude: user.latitude,
                    longitude: user.longitude,
                    city: user.city || '',
                    country: user.country || ''
                } : null
            });
        } catch (err: any) {
            console.error('[OAuthController] getUserInfo error:', err);
            return res.status(500).json({ error: 'server_error', error_description: err.message });
        }
    }

    /**
     * 5. OpenID Connect Discovery (.well-known/openid-configuration)
     */
    static getOpenIdConfiguration(req: any, res: any) {
        const issuer = ISSUER;
        return res.json({
            issuer,
            authorization_endpoint: `${issuer}/oauth/authorize`,
            token_endpoint: `${issuer}/oauth/token`,
            userinfo_endpoint: `${issuer}/oauth/userinfo`,
            jwks_uri: `${issuer}/.well-known/jwks.json`,
            revocation_endpoint: `${issuer}/oauth/revoke`,
            response_types_supported: ['code', 'token', 'id_token', 'code id_token'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256', 'HS256'],
            scopes_supported: [
                'openid',
                'identity:read',
                'identity:email',
                'identity:phone',
                'pitch:read',
                'pitch:write',
                'messages:send'
            ],
            token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
            claims_supported: [
                'sub',
                'iss',
                'aud',
                'exp',
                'iat',
                'name',
                'given_name',
                'family_name',
                'username',
                'email',
                'email_verified',
                'phone',
                'picture',
                'avatarUrl',
                'headline',
                'age',
                'isOnboarded',
                'location'
            ]
        });
    }

    /**
     * 6. Public JWKS Endpoint (.well-known/jwks.json)
     */
    static getJwks(req: any, res: any) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
        return res.json(getJwks());
    }

    /**
     * 7. Direct Token Verification Endpoint
     */
    static async verifyToken(req: any, res: any) {
        const token = req.body?.token || req.query?.token;
        const expectedClientId = req.body?.client_id || req.query?.client_id || null;

        if (!token) {
            return res.status(400).json({ valid: false, error: 'Token is required' });
        }

        // 1. Check if token is an OAuth access token stored in DB
        const dbToken = await prisma.oAuthToken.findUnique({
            where: { accessToken: token },
            include: { app: true }
        });

        if (dbToken) {
            if (dbToken.revokedAt || dbToken.expiresAt <= new Date()) {
                return res.status(401).json({ valid: false, error: 'Token has been revoked or expired' });
            }
            if (!isFirstPartyApp(dbToken.app?.clientId)) {
                const consent = await prisma.oAuthConsent.findUnique({
                    where: {
                        appId_userId: {
                            appId: dbToken.appId,
                            userId: dbToken.userId
                        }
                    }
                });
                if (!consent) {
                    return res.status(401).json({ valid: false, error: 'Application authorization has been revoked' });
                }
            }
            return res.json({
                valid: true,
                payload: {
                    sub: dbToken.userId,
                    aud: dbToken.app.clientId,
                    scopes: dbToken.scopes,
                    exp: Math.floor(dbToken.expiresAt.getTime() / 1000)
                }
            });
        }

        // 2. Cryptographic ID Token verification
        const result = verifyIdToken(token, expectedClientId);
        if (result.valid && result.payload?.sub) {
            const clientId = result.payload?.aud || expectedClientId;
            if (clientId && typeof clientId === 'string' && clientId !== '180-core' && !isFirstPartyApp(clientId)) {
                const app = await prisma.oAuthApp.findFirst({
                    where: { OR: [{ clientId }, { id: clientId }] }
                });
                if (app && !isFirstPartyApp(app.clientId)) {
                    const consent = await prisma.oAuthConsent.findUnique({
                        where: {
                            appId_userId: {
                                appId: app.id,
                                userId: result.payload.sub
                            }
                        }
                    });
                    if (!consent) {
                        return res.status(401).json({ valid: false, error: 'Application authorization has been revoked' });
                    }
                }
            }
        }
        return res.json(result);
    }

    /**
     * 8. Token Revocation Endpoint (RFC 7009)
     */
    static async revokeToken(req: any, res: any) {
        try {
            const { token, token_type_hint } = req.body;
            if (!token) {
                return res.status(400).json({ error: 'invalid_request', error_description: 'Missing token parameter' });
            }

            if (token_type_hint === 'refresh_token') {
                await prisma.oAuthToken.updateMany({
                    where: { refreshToken: token },
                    data: { revokedAt: new Date() }
                });
            } else {
                await prisma.oAuthToken.updateMany({
                    where: { accessToken: token },
                    data: { revokedAt: new Date() }
                });
            }

            return res.status(200).json({ success: true, message: 'Token revoked successfully' });
        } catch (err: any) {
            return res.status(500).json({ error: 'server_error', error_description: err.message });
        }
    }

    /**
     * 9. List Authorized Applications for Current User
     */
    static async listAuthorizedApps(req: any, res: any) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const consents = await prisma.oAuthConsent.findMany({
                where: { userId },
                include: { app: true },
                orderBy: { updatedAt: 'desc' }
            });

            const apps = consents.map((c) => {
                let logo = c.app.logoUrl || undefined;
                let displayName = c.app.name;
                const clientId = c.app.clientId;
                const lowerName = (displayName || '').toLowerCase();
                const lowerClient = (clientId || '').toLowerCase();

                // Smart first-party metadata and logo resolution
                if (lowerName.includes('social') || lowerClient.includes('social') || lowerClient.includes('266753c1171df1e2c4a391483fd2e02e')) {
                    logo = '/social-studio.png';
                    displayName = '180 Social Studio';
                } else if (lowerName.includes('developer') || lowerClient.includes('developer')) {
                    logo = '/black-icon.svg';
                    displayName = '180 Developers Console';
                } else if (lowerName.includes('traffic') || lowerClient.includes('traffic')) {
                    logo = '/icon.svg';
                    displayName = '180 Traffic Director';
                } else if (!logo || logo === '/icon.svg') {
                    logo = '/icon.svg';
                }

                const description = c.app.description || (
                    lowerName.includes('social')
                        ? 'Multi-Channel Social Media Automation & Analytics'
                        : lowerName.includes('developer')
                            ? 'Developer Console & API Management for 180 Workspace'
                            : 'Authorized Sovereign 180 application'
                );

                return {
                    id: c.id,
                    name: displayName,
                    description,
                    clientId: c.app.clientId,
                    scopes: c.scopes,
                    authorizedAt: c.grantedAt.toISOString(),
                    logo,
                    lastActive: c.updatedAt.toISOString(),
                    status: 'active'
                };
            });

            return res.json({ success: true, apps });
        } catch (err: any) {
            console.error('[OAuthController] listAuthorizedApps error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 10. Revoke an Authorized Application for Current User & Terminate Active App Sessions
     */
    static async revokeAuthorizedApp(req: any, res: any) {
        try {
            const userId = req.user?.id;
            const { clientId } = req.params;
            if (!userId || !clientId) {
                return res.status(400).json({ success: false, error: 'invalid_request', message: 'clientId is required' });
            }

            const app = await prisma.oAuthApp.findFirst({
                where: {
                    OR: [
                        { clientId },
                        { id: clientId }
                    ]
                }
            });

            if (app) {
                // 1. Delete user consent records
                await prisma.oAuthConsent.deleteMany({
                    where: { userId, appId: app.id }
                });

                // 2. Mark all issued OAuth tokens as revoked immediately
                await prisma.oAuthToken.updateMany({
                    where: { userId, appId: app.id },
                    data: { revokedAt: new Date() }
                });

                // 3. Delete any active authorization codes
                await prisma.oAuthAuthorizationCode.deleteMany({
                    where: { userId, appId: app.id }
                }).catch(() => {});

                // 4. Invalidate global session if applicable for first-party clients
                try {
                    const { prisma: globalPrisma } = require('@workspace/db');
                    if (globalPrisma?.session && (app.clientId.includes('workspace') || app.clientId.includes('developer'))) {
                        await globalPrisma.session.deleteMany({
                            where: { userId }
                        }).catch(() => {});
                    }
                } catch (_) {}

                // 5. Back-channel Logout Webhook (OpenID Connect Back-Channel Logout 1.0)
                if (app.webhookUrl) {
                    try {
                        const axios = require('axios');
                        axios.post(app.webhookUrl, {
                            event: 'auth.session_revoked',
                            clientId: app.clientId,
                            userId,
                            timestamp: new Date().toISOString()
                        }, {
                            headers: {
                                'Content-Type': 'application/json',
                                ...(app.webhookSecret ? { 'X-180-Signature': app.webhookSecret } : {})
                            },
                            timeout: 2500
                        }).catch((e: any) => console.warn(`[OAuthController] Webhook dispatch warning for ${app.clientId}:`, e?.message));
                    } catch (_) {}
                }
            }

            return res.json({ success: true, message: `Access for ${clientId} revoked successfully` });
        } catch (err: any) {
            console.error('[OAuthController] revokeAuthorizedApp error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }
}

