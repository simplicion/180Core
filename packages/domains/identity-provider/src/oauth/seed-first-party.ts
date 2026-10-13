'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { hashSecret } from './oauth.service';

/**
 * Mapping of legacy first-party app client IDs to their canonical IDs.
 * Ensures 100% backwards compatibility for legacy OAuth callbacks and external integrations.
 */
export const LEGACY_FIRST_PARTY_ALIASES: Record<string, string> = {
    '180-developer-portal': '180-developers-portal',
    '180_client_70d751541f05347fe803ec8e128f5e83': '180-workspace-platform',
    '180_client_5cc136397553836e34eb37ce22d13a53': '180-workspace-platform',
    '180_client_266753c1171df1e2c4a391483fd2e02e': '180-social-studio-mobile',
    '180_client_b26aee801c22cb3295f041ff2a3597db': '180-traffic-director',
};

/**
 * Resolves a client ID (which may be a legacy alias) to its canonical primary client ID.
 */
export function resolveCanonicalClientId(clientId: string | undefined | null): string {
    if (!clientId) return '';
    const clean = String(clientId).trim();
    return LEGACY_FIRST_PARTY_ALIASES[clean] || clean;
}

/**
 * Canonical First-Party Applications for 180 Core Ecosystem.
 * Sovereign Core Identity, Auth & 180 Pay Infrastructure.
 */
export const FIRST_PARTY_APPS = [
    {
        clientId: '180-core-client',
        name: '180 Core',
        description: 'Sovereign Core Identity, Auth & 180 Pay Infrastructure',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3001/callback',
            'http://localhost:3001/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3008/dashboard',
            'http://localhost:3009/callback',
            'http://localhost:3009/oauth/callback',
            'http://127.0.0.1:3000/callback',
            'http://127.0.0.1:3000/oauth/callback',
            'http://127.0.0.1:3008/callback',
            'http://127.0.0.1:3008/oauth/callback',
            'http://127.0.0.1:3008/dashboard',
            'http://127.0.0.1:3009/callback',
            'http://127.0.0.1:3009/oauth/callback',
            'https://180core.cloud/callback',
            'https://180core.cloud/oauth/callback',
            'https://*.180core.cloud/callback',
            'https://*.180core.cloud/oauth/callback',
            'https://developer.180core.cloud/callback',
            'https://developer.180core.cloud/oauth/callback',
            'https://developer.180core.cloud/dashboard',
            'https://profile.180core.cloud/callback',
            'https://profile.180core.cloud/oauth/callback',
            'https://admin.180core.cloud/callback',
            'https://admin.180core.cloud/oauth/callback'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3004',
            'http://127.0.0.1:3004',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'https://180core.cloud',
            'https://*.180core.cloud',
            'https://developer.180core.cloud',
            'https://profile.180core.cloud',
            'https://admin.180core.cloud',
            'https://api.180core.cloud'
        ],
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
        enablePay: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    }
];

/**
 * Ensures first-party applications are present in the database,
 * consolidates legacy duplicates, and guarantees configuration integrity.
 */
export async function seedFirstPartyOAuthApps(): Promise<void> {
    try {
        // Find a system user or admin to associate first-party apps (prioritizing admin@180core.cloud)
        const systemUser = await prisma.user.findFirst({
            where: { email: 'admin@180core.cloud' }
        }) || await prisma.user.findFirst({
            where: { role: 'SUPERADMIN' }
        }) || await prisma.user.findFirst();

        if (!systemUser) {
            console.log('[SeedFirstParty] No user record available yet for app seeding, will seed on first boot.');
            return;
        }

        for (const app of FIRST_PARTY_APPS) {
            const existing = await prisma.oAuthApp.findUnique({
                where: { clientId: app.clientId }
            });

            const knownSecret =
                app.clientId === '180-core-client'
                    ? (process.env.CORE_CLIENT_SECRET || '180_secret_core_prod_key_991823')
                    : app.clientId === '180-workspace-platform'
                        ? (process.env.ONE_EIGHTY_CLIENT_SECRET || '180_secret_a58c34e77528dc342871ecc66c41e9f06522223896b851a4338eee40e2bc2276')
                        : app.clientId === '180-traffic-director'
                            ? (process.env.TRAFFIC_DIRECTOR_CLIENT_SECRET || '180_secret_traffic_director_prod_key_771829')
                            : `180_secret_${app.clientId}`;

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
                // Ensure redirect URIs, allowed origins, and UX default modes stay up-to-date
                const mergedUris = Array.from(new Set([...(existing.redirectUris || []), ...app.redirectUris]));
                const mergedOrigins = Array.from(new Set([...(existing.allowedOrigins || []), ...app.allowedOrigins]));
                const updateData: any = {};

                if (mergedUris.length !== (existing.redirectUris || []).length || mergedOrigins.length !== (existing.allowedOrigins || []).length) {
                    updateData.redirectUris = mergedUris;
                    updateData.allowedOrigins = mergedOrigins;
                    updateData.isActive = true;
                }

                if (!existing.authDesktopDefault) {
                    updateData.authDesktopDefault = (app as any).authDesktopDefault || 'popup';
                }
                if (!existing.authMobileDefault) {
                    updateData.authMobileDefault = (app as any).authMobileDefault || 'bottom_sheet';
                }

                if (app.clientId === '180-core-client') {
                    updateData.name = app.name;
                    updateData.description = app.description;
                    updateData.clientSecretHash = hashSecret(knownSecret);
                    updateData.clientSecretHint = knownSecret.slice(-4);
                    updateData.allowedScopes = app.allowedScopes;
                    updateData.isActive = true;
                    updateData.enablePay = true;
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.oAuthApp.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                    console.log(`[SeedFirstParty] Updated configurations for: ${app.name} (${app.clientId})`);
                }
            }
        }

        // Consolidate and clean up legacy first-party duplicate app rows
        for (const [legacyClientId, canonicalClientId] of Object.entries(LEGACY_FIRST_PARTY_ALIASES)) {
            try {
                const legacyApp = await prisma.oAuthApp.findUnique({
                    where: { clientId: legacyClientId }
                });
                const canonicalApp = await prisma.oAuthApp.findUnique({
                    where: { clientId: canonicalClientId }
                });

                if (legacyApp && canonicalApp && legacyApp.id !== canonicalApp.id) {
                    console.log(`[SeedFirstParty] Consolidating legacy app '${legacyClientId}' into '${canonicalClientId}'...`);

                    // Safely repoint any active tokens, codes, and subscriptions to canonical app
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

                    // Merge redirect URIs and allowed origins
                    const mergedUris = Array.from(new Set([...(canonicalApp.redirectUris || []), ...(legacyApp.redirectUris || [])]));
                    const mergedOrigins = Array.from(new Set([...(canonicalApp.allowedOrigins || []), ...(legacyApp.allowedOrigins || [])]));
                    await prisma.oAuthApp.update({
                        where: { id: canonicalApp.id },
                        data: {
                            redirectUris: mergedUris,
                            allowedOrigins: mergedOrigins
                        }
                    }).catch(() => {});

                    // Delete redundant legacy row
                    await prisma.oAuthApp.delete({
                        where: { id: legacyApp.id }
                    });
                    console.log(`[SeedFirstParty] Successfully removed redundant legacy app '${legacyClientId}'`);
                }
            } catch (err: any) {
                console.warn(`[SeedFirstParty] Non-blocking consolidation note for '${legacyClientId}':`, err.message);
            }
        }
    } catch (e: any) {
        console.warn('[SeedFirstParty] Database seeding non-blocking note:', e.message);
    }
}

/**
 * Checks if a given client ID or application identifier belongs to the official 180 Workspace first-party ecosystem.
 * First-party applications are trusted by default and do not require user-granted OAuth consent screens.
 */
export function isFirstPartyApp(clientIdOrId: string | undefined | null): boolean {
    if (!clientIdOrId) return false;
    const clean = String(clientIdOrId).trim().toLowerCase();
    const canonical = resolveCanonicalClientId(clean).toLowerCase();
    if (
        clean === '180-core' ||
        clean === '180-core-client' ||
        canonical === '180-core-client'
    ) {
        return true;
    }
    return FIRST_PARTY_APPS.some(
        a => a.clientId.toLowerCase() === clean || a.clientId.toLowerCase() === canonical || (a as any).id?.toLowerCase() === clean || a.name.toLowerCase() === clean
    );
}
