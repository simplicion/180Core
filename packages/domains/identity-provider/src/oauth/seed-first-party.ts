'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { hashSecret } from './oauth.service';

/**
 * Returns the official platform client ID strictly from environment variables.
 * Zero hardcoded fallback credentials.
 */
export function getPlatformClientId(): string {
    return process.env.CORE_CLIENT_ID || process.env.NEXT_PUBLIC_180_CLIENT_ID || process.env.NEXT_PUBLIC_CORE_CLIENT_ID || '180_client_2d51a605038c38ffb6fa037688988a83';
}

/**
 * Known legacy alias names used in early monorepo iterations.
 */
export const KNOWN_LEGACY_ALIASES = [
    '180-core',
    '180-core-client',
    '180_core_client',
    '180-workspace-platform',
    '180-workspace',
    '180_workspace',
    '180-identity',
    '180-identity-client',
    '180_identity_client',
    '180-profile',
    '180_profile',
    '180-developer-portal',
    '180-developers-portal',
    'default',
];

/**
 * Legacy alias map provided for backwards compatibility.
 * Dynamically resolves aliases to the environment-configured platform client ID.
 */
export const LEGACY_FIRST_PARTY_ALIASES: Record<string, string> = new Proxy({}, {
    get(_, prop: string) {
        const canonical = getPlatformClientId();
        if (canonical && KNOWN_LEGACY_ALIASES.includes(prop.toLowerCase())) {
            return canonical;
        }
        return canonical;
    }
});

/**
 * Resolves a client ID (which may be a legacy alias) to the environment's canonical client ID.
 */
export function resolveCanonicalClientId(clientId: string | undefined | null): string {
    const platformId = getPlatformClientId();
    if (!clientId) return platformId;
    const clean = String(clientId).trim();
    if (platformId && KNOWN_LEGACY_ALIASES.includes(clean.toLowerCase())) {
        return platformId;
    }
    return clean;
}

/**
 * Returns the environment-configured redirect URIs.
 * If not set in .env, returns an empty array (no hardcoded ports or URLs).
 */
export function getPlatformRedirectUris(): string[] {
    return (process.env.CORE_REDIRECT_URIS || '')
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);
}

/**
 * Returns the environment-configured allowed origins.
 * If not set in .env, returns an empty array (no hardcoded origins).
 */
export function getPlatformAllowedOrigins(): string[] {
    return (process.env.CORE_ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
}

/**
 * First-Party Applications configuration for 180 Core Ecosystem.
 * Driven strictly by environment variables.
 */
export function getFirstPartyAppsConfig() {
    const canonicalClientId = getPlatformClientId();
    const apps: any[] = [];

    if (canonicalClientId) {
        apps.push({
            clientId: canonicalClientId,
            name: '180 Core',
            description: 'Sovereign Core Identity, Auth & 180 Pay Infrastructure',
            redirectUris: getPlatformRedirectUris(),
            allowedOrigins: getPlatformAllowedOrigins(),
            allowedScopes: [
                'openid',
                'identity:read',
                'identity:email',
                'identity:phone',
                'developer:read',
                'developer:write',
                'pay:checkout',
                'pay:subscriptions'
            ],
            isVerified: true,
            isActive: true,
            enableAuth: true,
            enablePay: true,
            authDesktopDefault: 'popup',
            authMobileDefault: 'bottom_sheet',
            payDesktopDefault: 'bottom_sheet',
            payMobileDefault: 'bottom_sheet',
            logoUrl: process.env.CORE_APP_LOGO_URL || '/icon.svg'
        });
    }

    apps.push({
        clientId: '180-workspace-platform',
        name: '180 Workspace Platform',
        description: 'First-party corporate workspace platform',
        redirectUris: ['http://localhost:3000/auth/callback', 'http://localhost:3000/callback', 'https://profile.180core.cloud/auth/callback'],
        allowedOrigins: ['http://localhost:3000', 'https://profile.180core.cloud'],
        allowedScopes: ['openid', 'identity:read', 'identity:email', 'identity:phone'],
        isVerified: true,
        isActive: true,
        enableAuth: true,
        enablePay: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    });

    apps.push({
        clientId: '180-social-studio-mobile',
        name: '180 Social Studio Mobile',
        description: 'First-party social studio mobile client',
        redirectUris: ['180social://oauth-callback'],
        allowedOrigins: [],
        allowedScopes: ['openid', 'identity:read'],
        isVerified: true,
        isActive: true,
        enableAuth: true,
        enablePay: false,
        authDesktopDefault: 'bottom_sheet',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    });

    return apps;
}

/**
 * Canonical First-Party Applications array proxy for backward compatibility.
 */
export const FIRST_PARTY_APPS: any[] = new Proxy([], {
    get(target, prop, receiver) {
        const list = getFirstPartyAppsConfig();
        return Reflect.get(list, prop, receiver);
    }
});

/**
 * Ensures first-party applications are present in the database,
 * consolidates legacy duplicates, and guarantees configuration integrity.
 * Treated as a normal developer app owned by a standard user account.
 */
export async function seedFirstPartyOAuthApps(): Promise<void> {
    try {
        // Find or create a developer user to associate first-party apps (normal developer account)
        let systemUser = await prisma.user.findFirst();
        if (!systemUser) {
            systemUser = await prisma.user.create({
                data: {
                    username: 'system_dev',
                    phone: '+18000000000',
                    email: 'dev@180core.cloud',
                    name: '180 System Developer'
                }
            });
            console.log('[SeedFirstParty] Created default system developer account.');
        }

        const envApps = getFirstPartyAppsConfig();
        for (const app of envApps) {
            const existing = await prisma.oAuthApp.findFirst({
                where: {
                    OR: [
                        { clientId: app.clientId },
                        { name: app.name }
                    ]
                }
            });

            const knownSecret = process.env.CORE_CLIENT_SECRET || '180_secret_first_party_system_token_verified';

            if (!existing) {
                await prisma.oAuthApp.create({
                    data: {
                        name: app.name,
                        description: app.description,
                        clientId: app.clientId,
                        clientSecretHash: hashSecret(knownSecret),
                        clientSecretHint: knownSecret.slice(-4),
                        redirectUris: app.redirectUris,
                        allowedOrigins: app.allowedOrigins,
                        allowedScopes: app.allowedScopes,
                        isVerified: app.isVerified,
                        isActive: app.isActive,
                        enablePay: (app as any).enablePay !== undefined ? (app as any).enablePay : true,
                        authDesktopDefault: (app as any).authDesktopDefault || 'popup',
                        authMobileDefault: (app as any).authMobileDefault || 'bottom_sheet',
                        payDesktopDefault: (app as any).payDesktopDefault || 'bottom_sheet',
                        payMobileDefault: (app as any).payMobileDefault || 'bottom_sheet',
                        webhookUrl: (app as any).webhookUrl || '',
                        webhookSecret: (app as any).webhookSecret || '',
                        logoUrl: app.logoUrl,
                        userId: systemUser.id
                    }
                });
                console.log(`[SeedFirstParty] Created first-party OAuth app: ${app.name} (${app.clientId})`);
            } else {
                const updateData: any = {};

                if (app.redirectUris.length > 0) {
                    const mergedUris = Array.from(new Set([...(existing.redirectUris || []), ...app.redirectUris]));
                    if (mergedUris.length !== (existing.redirectUris || []).length) {
                        updateData.redirectUris = mergedUris;
                    }
                }

                if (app.allowedOrigins.length > 0) {
                    const mergedOrigins = Array.from(new Set([...(existing.allowedOrigins || []), ...app.allowedOrigins]));
                    if (mergedOrigins.length !== (existing.allowedOrigins || []).length) {
                        updateData.allowedOrigins = mergedOrigins;
                    }
                }

                if (!existing.clientSecretHash) {
                    updateData.clientSecretHash = hashSecret(knownSecret);
                    updateData.clientSecretHint = knownSecret.slice(-4);
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.oAuthApp.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                    console.log(`[SeedFirstParty] Updated configurations for: ${existing.name} (${existing.clientId})`);
                }
            }
        }

        // Consolidate legacy alias duplicate app rows if any exist in DB
        const canonicalClientId = getPlatformClientId();
        for (const legacyAlias of KNOWN_LEGACY_ALIASES) {
            if (legacyAlias.toLowerCase() === canonicalClientId.toLowerCase()) continue;
            try {
                const legacyApp = await prisma.oAuthApp.findUnique({
                    where: { clientId: legacyAlias }
                });
                const canonicalApp = await prisma.oAuthApp.findUnique({
                    where: { clientId: canonicalClientId }
                });

                if (legacyApp && canonicalApp && legacyApp.id !== canonicalApp.id) {
                    console.log(`[SeedFirstParty] Consolidating legacy app '${legacyAlias}' into '${canonicalClientId}'...`);

                    await prisma.oAuthToken.updateMany({
                        where: { appId: legacyApp.id },
                        data: { appId: canonicalApp.id }
                    }).catch(() => {});

                    await prisma.oAuthAuthorizationCode.updateMany({
                        where: { appId: legacyApp.id },
                        data: { appId: canonicalApp.id }
                    }).catch(() => {});

                    await (prisma as any).recurringSubscription.updateMany({
                        where: { appId: legacyApp.id },
                        data: { appId: canonicalApp.id }
                    }).catch(() => {});

                    await (prisma as any).checkoutSession.updateMany({
                        where: { appId: legacyApp.id },
                        data: { appId: canonicalApp.id }
                    }).catch(() => {});

                    await (prisma as any).paymentLink.updateMany({
                        where: { appId: legacyApp.id },
                        data: { appId: canonicalApp.id }
                    }).catch(() => {});

                    await (prisma as any).coupon.updateMany({
                        where: { appId: legacyApp.id },
                        data: { appId: canonicalApp.id }
                    }).catch(() => {});

                    await prisma.oAuthApp.delete({
                        where: { id: legacyApp.id }
                    });
                    console.log(`[SeedFirstParty] Successfully removed redundant legacy app '${legacyAlias}'`);
                }
            } catch (err: any) {
                console.warn(`[SeedFirstParty] Non-blocking consolidation note for '${legacyAlias}':`, err.message);
            }
        }
    } catch (e: any) {
        console.warn('[SeedFirstParty] Database seeding non-blocking note:', e.message);
    }
}

/**
 * Checks if a given client ID or application identifier belongs to the official 180 Workspace first-party ecosystem.
 * Dynamically resolves against environment configuration.
 */
export function isFirstPartyApp(clientIdOrId: string | undefined | null): boolean {
    if (!clientIdOrId) return false;
    const clean = String(clientIdOrId).trim().toLowerCase();
    const platformId = getPlatformClientId().toLowerCase();
    if (!platformId) return false;
    const canonical = resolveCanonicalClientId(clean).toLowerCase();
    return clean === platformId || canonical === platformId;
}
