'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { hashSecret } from './oauth.service';

export const FIRST_PARTY_APPS = [
    {
        clientId: '180-workspace-platform',
        name: '180 Workspace',
        description: 'Unified Business Operating System & Collaboration Suite',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3001/callback',
            'http://localhost:3001/oauth/callback',
            'http://localhost:3002/callback',
            'http://localhost:3002/oauth/callback',
            'http://localhost:3003/callback',
            'http://localhost:3003/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3009/callback',
            'http://localhost:3009/oauth/callback',
            'https://180workspace.com/callback',
            'https://180workspace.com/oauth/callback',
            'https://*.180workspace.com/callback',
            'https://*.180workspace.com/oauth/callback'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'http://localhost:3003',
            'http://127.0.0.1:3003',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'https://180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    },
    {
        clientId: '180_client_70d751541f05347fe803ec8e128f5e83',
        name: '180workspace',
        description: 'First-party application client for 180 Workspace web platform',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3001/callback',
            'http://localhost:3001/oauth/callback',
            'http://localhost:3002/callback',
            'http://localhost:3002/oauth/callback',
            'http://localhost:3003/callback',
            'http://localhost:3003/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3009/callback',
            'http://localhost:3009/oauth/callback',
            'https://180workspace.com/callback',
            'https://180workspace.com/oauth/callback',
            'https://app.180workspace.com/callback',
            'https://app.180workspace.com/oauth/callback',
            'https://*.180workspace.com/callback',
            'https://*.180workspace.com/oauth/callback'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'http://localhost:3003',
            'http://127.0.0.1:3003',
            'http://localhost:3004',
            'http://127.0.0.1:3004',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'https://180workspace.com',
            'https://app.180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone'
        ],
        isVerified: true,
        isActive: true,
        enablePay: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    },
    {
        clientId: '180_client_5cc136397553836e34eb37ce22d13a53',
        name: '180 Workspace Core Client',
        description: 'First-party application client for 180 Workspace web platform',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3001/callback',
            'http://localhost:3001/oauth/callback',
            'http://localhost:3002/callback',
            'http://localhost:3002/oauth/callback',
            'http://localhost:3003/callback',
            'http://localhost:3003/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3009/callback',
            'http://localhost:3009/oauth/callback',
            'https://180workspace.com/callback',
            'https://180workspace.com/oauth/callback',
            'https://*.180workspace.com/callback',
            'https://*.180workspace.com/oauth/callback'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'http://localhost:3003',
            'http://127.0.0.1:3003',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'https://180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    },
    {
        clientId: '180-social-studio-mobile',
        name: '180 Social Studio',
        description: 'Multi-Channel Social Media Automation & Analytics',
        redirectUris: [
            'workspace180://oauth/callback',
            'workspace180://oauth-callback',
            '180social://oauth-callback',
            '180social://oauth/callback',
            'socialstudio://oauth-callback',
            'socialstudio://oauth/callback',
            'http://localhost:3007/#/oauth-callback',
            'http://localhost:3007/oauth-callback',
            'http://localhost:3000/social/callback'
        ],
        allowedOrigins: [
            'http://localhost:3007',
            'http://127.0.0.1:3007',
            'http://localhost:3000'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/social-studio.png'
    },
    {
        clientId: '180_client_266753c1171df1e2c4a391483fd2e02e',
        name: '180 Social Studio',
        description: 'Multi-Channel Social Media Automation & Analytics',
        redirectUris: [
            'workspace180://oauth/callback',
            'workspace180://oauth-callback',
            '180social://oauth-callback',
            '180social://oauth/callback',
            'socialstudio://oauth-callback',
            'socialstudio://oauth/callback',
            'https://social.180workspace.com/#/oauth-callback',
            'http://localhost:3007/#/oauth-callback',
            'http://localhost:3007/oauth-callback',
            'http://localhost:3000/callback',
            'http://localhost:3000/social/callback'
        ],
        allowedOrigins: [
            'http://localhost:3007',
            'http://127.0.0.1:3007',
            'https://social.180workspace.com',
            'http://localhost:3000'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone',
            'social:publish'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/social-studio.png'
    },
    {
        clientId: '180-traffic-director',
        name: '180 Traffic Director',
        description: 'Enterprise Edge Traffic Router, Safe Reverse Proxy & Bot Armor',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3006/callback',
            'http://localhost:3006/oauth/callback',
            'http://localhost:3009/callback',
            'http://localhost:3002/callback',
            'https://traffic.180workspace.com/callback',
            'https://traffic.180workspace.com/oauth/callback',
            'https://traffic-director.180workspace.com/callback',
            'https://trafficdirector.180workspace.com/callback',
            'https://*.180workspace.com/callback'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://localhost:3006',
            'http://127.0.0.1:3006',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'http://localhost:3002',
            'https://traffic.180workspace.com',
            'https://traffic-director.180workspace.com',
            'https://trafficdirector.180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
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
        webhookUrl: process.env.TRAFFIC_DIRECTOR_WEBHOOK_URL || 'http://localhost:4002/api/v1/traffic-director/billing/webhook',
        webhookSecret: process.env.TRAFFIC_DIRECTOR_WEBHOOK_SECRET || '180_webhook_traffic_director_prod_sec_991823',
        logoUrl: '/icon.svg'
    },
    {
        clientId: '180-developers-portal',
        name: '180 Developers Console',
        description: 'Developer Console & API Management for 180 Workspace Ecosystem',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3008/dashboard',
            'http://127.0.0.1:3008/callback',
            'http://127.0.0.1:3008/oauth/callback',
            'http://127.0.0.1:3008/dashboard',
            'http://localhost:3002/callback',
            'https://developers.180workspace.com/callback',
            'https://developers.180workspace.com/oauth/callback',
            'https://developers.180workspace.com/dashboard',
            'https://*.180workspace.com/callback',
            'https://*.180workspace.com/oauth/callback',
            'https://*.180workspace.com/dashboard'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3004',
            'http://127.0.0.1:3004',
            'http://localhost:4321',
            'http://127.0.0.1:4321',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'https://180workspace.com',
            'https://developers.180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone',
            'developer:read',
            'developer:write'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/black-icon.svg'
    },
    {
        clientId: '180-developer-portal',
        name: '180 Developers Console',
        description: 'Developer Console & API Management for 180 Workspace Ecosystem',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3008/dashboard',
            'http://127.0.0.1:3008/callback',
            'http://127.0.0.1:3008/oauth/callback',
            'http://127.0.0.1:3008/dashboard',
            'http://localhost:3002/callback',
            'https://developers.180workspace.com/callback',
            'https://developers.180workspace.com/oauth/callback',
            'https://developers.180workspace.com/dashboard',
            'https://*.180workspace.com/callback',
            'https://*.180workspace.com/oauth/callback',
            'https://*.180workspace.com/dashboard'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3004',
            'http://127.0.0.1:3004',
            'http://localhost:4321',
            'http://127.0.0.1:4321',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'https://180workspace.com',
            'https://developers.180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone',
            'developer:read',
            'developer:write'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/black-icon.svg'
    },
    {
        clientId: '180-core-client',
        name: '180 Core Sovereign Client',
        description: 'Sovereign Core Identity and Developer Infrastructure',
        redirectUris: [
            'http://localhost:3000/callback',
            'http://localhost:3000/oauth/callback',
            'http://localhost:3008/callback',
            'http://localhost:3008/oauth/callback',
            'http://localhost:3008/dashboard',
            'http://127.0.0.1:3008/callback',
            'http://127.0.0.1:3008/oauth/callback',
            'http://127.0.0.1:3008/dashboard',
            'http://localhost:3002/callback',
            'https://developers.180workspace.com/callback',
            'https://developers.180workspace.com/oauth/callback',
            'https://developers.180workspace.com/dashboard',
            'https://*.180workspace.com/callback',
            'https://*.180workspace.com/oauth/callback',
            'https://*.180workspace.com/dashboard'
        ],
        allowedOrigins: [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3004',
            'http://127.0.0.1:3004',
            'http://localhost:4321',
            'http://127.0.0.1:4321',
            'http://localhost:3008',
            'http://127.0.0.1:3008',
            'http://localhost:3009',
            'http://127.0.0.1:3009',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'https://180workspace.com',
            'https://developers.180workspace.com',
            'https://*.180workspace.com'
        ],
        allowedScopes: [
            'openid',
            'identity:read',
            'identity:email',
            'identity:phone',
            'developer:read',
            'developer:write'
        ],
        isVerified: true,
        isActive: true,
        authDesktopDefault: 'popup',
        authMobileDefault: 'bottom_sheet',
        payDesktopDefault: 'bottom_sheet',
        payMobileDefault: 'bottom_sheet',
        logoUrl: '/icon.svg'
    }
];

/**
 * Ensures first-party applications are present in the database.
 */
export async function seedFirstPartyOAuthApps(): Promise<void> {
    try {
        // Find a system user or admin to associate first-party apps
        const systemUser = await prisma.user.findFirst({
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
                app.clientId === '180_client_70d751541f05347fe803ec8e128f5e83'
                    ? (process.env.ONE_EIGHTY_CLIENT_SECRET || '180_secret_a58c34e77528dc342871ecc66c41e9f06522223896b851a4338eee40e2bc2276')
                    : app.clientId === '180-traffic-director'
                        ? (process.env.TRAFFIC_DIRECTOR_CLIENT_SECRET || '180_secret_traffic_director_prod_key_771829')
                        : app.clientId === '180_client_5cc136397553836e34eb37ce22d13a53'
                            ? (process.env.ONE_EIGHTY_CLIENT_SECRET || '180_secret_workspace_core_prod_key_5cc136')
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

                if (app.clientId === '180_client_70d751541f05347fe803ec8e128f5e83' || app.clientId === '180_client_5cc136397553836e34eb37ce22d13a53') {
                    updateData.clientSecretHash = hashSecret(knownSecret);
                    updateData.clientSecretHint = knownSecret.slice(-4);
                    updateData.isActive = true;
                    updateData.enablePay = true;
                }

                if (app.clientId === '180-traffic-director') {
                    updateData.clientSecretHash = hashSecret(knownSecret);
                    updateData.clientSecretHint = knownSecret.slice(-4);
                    updateData.enablePay = true;
                    updateData.isActive = true;

                    const targetWebhookUrl = process.env.TRAFFIC_DIRECTOR_WEBHOOK_URL || (existing.webhookUrl ? existing.webhookUrl : (app as any).webhookUrl);
                    const targetWebhookSecret = process.env.TRAFFIC_DIRECTOR_WEBHOOK_SECRET || (existing.webhookSecret ? existing.webhookSecret : (app as any).webhookSecret);

                    if (targetWebhookUrl && targetWebhookUrl !== existing.webhookUrl) {
                        updateData.webhookUrl = targetWebhookUrl;
                    }
                    if (targetWebhookSecret && targetWebhookSecret !== existing.webhookSecret) {
                        updateData.webhookSecret = targetWebhookSecret;
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.oAuthApp.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                    console.log(`[SeedFirstParty] Updated configurations for: ${app.name} (${app.clientId})`);
                }
            }

            // Seed default subscription plans for 180 Traffic Director
            if (app.clientId === '180-traffic-director') {
                const targetApp = await prisma.oAuthApp.findUnique({ where: { clientId: app.clientId } });
                if (targetApp) {
                    if (!targetApp.enablePay) {
                        await prisma.oAuthApp.update({
                            where: { id: targetApp.id },
                            data: { enablePay: true }
                        });
                    }

                    const DEFAULT_TRAFFIC_PLANS = [
                        {
                            planCode: 'traffic-starter',
                            name: 'Traffic Director Starter',
                            description: 'Max 2 Smart Links with Anycast Routing & Bot Shields',
                            amount: 25.0,
                            currency: 'USD',
                            interval: 'MONTHLY'
                        },
                        {
                            planCode: 'traffic-pro',
                            name: 'Traffic Director Pro',
                            description: 'Max 5 Smart Links with Dynamic Shield & AdBot Cloaking',
                            amount: 50.0,
                            currency: 'USD',
                            interval: 'MONTHLY'
                        },
                        {
                            planCode: 'traffic-enterprise',
                            name: 'Traffic Director Enterprise',
                            description: 'Unlimited Smart Links with Dedicated Tor RAM Sets',
                            amount: 75.0,
                            currency: 'USD',
                            interval: 'MONTHLY'
                        }
                    ];

                    for (const plan of DEFAULT_TRAFFIC_PLANS) {
                        await (prisma as any).subscriptionPlan.upsert({
                            where: {
                                appId_planCode: {
                                    appId: targetApp.id,
                                    planCode: plan.planCode
                                }
                            },
                            update: {
                                name: plan.name,
                                description: plan.description,
                                amount: plan.amount,
                                currency: plan.currency,
                                interval: plan.interval,
                                isActive: true
                            },
                            create: {
                                appId: targetApp.id,
                                planCode: plan.planCode,
                                name: plan.name,
                                description: plan.description,
                                amount: plan.amount,
                                currency: plan.currency,
                                interval: plan.interval,
                                isActive: true
                            }
                        });
                    }
                }
            }

            // Seed default subscription plans for 180 Workspace Platform (180 Pay)
            if (app.clientId === '180_client_70d751541f05347fe803ec8e128f5e83' || app.clientId === '180-workspace-platform') {
                const targetApp = await prisma.oAuthApp.findUnique({ where: { clientId: app.clientId } });
                if (targetApp) {
                    if (!targetApp.enablePay) {
                        await prisma.oAuthApp.update({
                            where: { id: targetApp.id },
                            data: { enablePay: true }
                        });
                    }

                    const DEFAULT_WORKSPACE_PLANS = [
                        {
                            planCode: '180-kickstart',
                            name: '180 Kickstart',
                            description: 'Essential workspace foundations with unified Work Graph data isolation for solopreneurs and early ventures.',
                            amount: 10.0,
                            currency: 'USD',
                            interval: 'MONTHLY',
                            trialDays: 0,
                            metadata: {
                                features: [
                                    { text: 'Access to 5 Core Applications', included: true },
                                    { text: 'Up to 2 Team Members', included: true },
                                    { text: '1 Active Website / Custom CNAME', included: true },
                                    { text: '1 GB Cloud Storage', included: true },
                                    { text: 'Standard Community & Ticket Support', included: true },
                                    { text: 'Unified Work Graph Data Isolation', included: true }
                                ],
                                isPopular: false,
                                badgeText: 'Essential',
                                yearlyAmount: 96
                            }
                        },
                        {
                            planCode: '180-momentum',
                            name: '180 Momentum',
                            description: 'Expanded application capacity, AI copilot intelligence, and custom SMTP email routing for scaling businesses.',
                            amount: 17.0,
                            currency: 'USD',
                            interval: 'MONTHLY',
                            trialDays: 14,
                            metadata: {
                                features: [
                                    { text: 'Access to 7 Applications', included: true },
                                    { text: 'Up to 5 Team Members', included: true },
                                    { text: 'Up to 5 Active Websites', included: true },
                                    { text: '10 GB Cloud Storage', included: true },
                                    { text: 'Orbit AI Copilot Access', included: true },
                                    { text: 'Custom Email SMTP Integration', included: true },
                                    { text: 'Priority Email & Ticket Support', included: true },
                                    { text: 'Cross-App Event Triggers & Workflows', included: true }
                                ],
                                isPopular: true,
                                badgeText: 'Most Popular',
                                yearlyAmount: 163
                            }
                        },
                        {
                            planCode: '180-limitless',
                            name: '180 Limitless',
                            description: 'Complete unrestricted access to all 15+ applications, 20 team seats, and sub-5ms edge traffic routing.',
                            amount: 20.0,
                            currency: 'USD',
                            interval: 'MONTHLY',
                            trialDays: 14,
                            metadata: {
                                features: [
                                    { text: 'Unlimited Access to All 15+ Applications', included: true },
                                    { text: 'Up to 20 Team Members Included', included: true },
                                    { text: 'Unlimited Websites & Automated SSL', included: true },
                                    { text: '20 GB High-Speed Cloud Storage', included: true },
                                    { text: 'Sub-5ms Traffic Director & Bot Shield', included: true },
                                    { text: 'Dedicated Team & Priority Support', included: true },
                                    { text: 'Orbit AI Copilot Full Capabilities', included: true },
                                    { text: 'Custom Email SMTP & Webhook Integrations', included: true },
                                    { text: 'Enterprise Multi-Tenant Security & RBAC', included: true }
                                ],
                                isPopular: false,
                                badgeText: 'Scale & Enterprise',
                                yearlyAmount: 192
                            }
                        }
                    ];

                    for (const plan of DEFAULT_WORKSPACE_PLANS) {
                        await (prisma as any).subscriptionPlan.upsert({
                            where: {
                                appId_planCode: {
                                    appId: targetApp.id,
                                    planCode: plan.planCode
                                }
                            },
                            update: {
                                name: plan.name,
                                description: plan.description,
                                amount: plan.amount,
                                currency: plan.currency,
                                interval: plan.interval,
                                trialDays: plan.trialDays,
                                metadata: plan.metadata,
                                isActive: true
                            },
                            create: {
                                appId: targetApp.id,
                                planCode: plan.planCode,
                                name: plan.name,
                                description: plan.description,
                                amount: plan.amount,
                                currency: plan.currency,
                                interval: plan.interval,
                                trialDays: plan.trialDays,
                                metadata: plan.metadata,
                                isActive: true
                            }
                        });
                    }

                    // Upsert PricingTableConfig
                    await (prisma as any).pricingTableConfig.upsert({
                        where: { appId: targetApp.id },
                        update: {
                            headline: '180workspace Plans & Pricing',
                            subheadline: 'Choose the plan that fits your growth with no per-seat penalties or hidden fees.',
                            theme: 'auto',
                            accentColor: '#6366f1',
                            billingIntervals: ['MONTHLY', 'YEARLY'],
                            yearlyDiscountPct: 20,
                            planCards: DEFAULT_WORKSPACE_PLANS.map(p => ({
                                planCode: p.planCode,
                                name: p.name,
                                description: p.description,
                                amount: p.amount,
                                yearlyAmount: p.metadata.yearlyAmount,
                                currency: p.currency,
                                interval: p.interval,
                                trialDays: p.trialDays,
                                isPopular: p.metadata.isPopular,
                                badgeText: p.metadata.badgeText,
                                features: p.metadata.features,
                                buttonText: p.trialDays > 0 ? 'Start 14-Day Free Trial' : 'Get Started',
                                isFree: false
                            })),
                            customCss: ''
                        },
                        create: {
                            appId: targetApp.id,
                            headline: '180workspace Plans & Pricing',
                            subheadline: 'Choose the plan that fits your growth with no per-seat penalties or hidden fees.',
                            theme: 'auto',
                            accentColor: '#6366f1',
                            billingIntervals: ['MONTHLY', 'YEARLY'],
                            yearlyDiscountPct: 20,
                            planCards: DEFAULT_WORKSPACE_PLANS.map(p => ({
                                planCode: p.planCode,
                                name: p.name,
                                description: p.description,
                                amount: p.amount,
                                yearlyAmount: p.metadata.yearlyAmount,
                                currency: p.currency,
                                interval: p.interval,
                                trialDays: p.trialDays,
                                isPopular: p.metadata.isPopular,
                                badgeText: p.metadata.badgeText,
                                features: p.metadata.features,
                                buttonText: p.trialDays > 0 ? 'Start 14-Day Free Trial' : 'Get Started',
                                isFree: false
                            })),
                            customCss: ''
                        }
                    });
                }
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
    if (
        clean === '180-core' ||
        clean === '180-workspace-platform' ||
        clean === '180workspace' ||
        clean === '180_client_70d751541f05347fe803ec8e128f5e83' ||
        clean === '180_client_266753c1171df1e2c4a391483fd2e02e'
    ) {
        return true;
    }
    return FIRST_PARTY_APPS.some(
        a => a.clientId.toLowerCase() === clean || (a as any).id?.toLowerCase() === clean || a.name.toLowerCase() === clean
    );
}
