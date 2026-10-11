'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { generateRandomToken, hashSecret } from '../oauth/oauth.service';
import { DeveloperBillingService } from './developer-billing.service';

export class DeveloperController {
    /**
     * Resolves all user IDs associated with the current session (by user ID and account email)
     */
    private static async resolveUserIds(req: any): Promise<string[]> {
        const userId = req.user?.id;
        if (!userId) return [];
        let userIds = [userId];
        const userEmail = req.user?.email;
        if (userEmail) {
            try {
                const matched = await prisma.user.findMany({
                    where: { email: { equals: userEmail, mode: 'insensitive' } },
                    select: { id: true }
                });
                if (matched?.length) {
                    userIds = Array.from(new Set([...userIds, ...matched.map((u: any) => u.id)]));
                }
            } catch (_) {}
        }
        return userIds;
    }

    /**
     * List all OAuth applications owned by the authenticated developer
     */
    static async listApps(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }

            const apps = await prisma.oAuthApp.findMany({
                where: { userId: { in: userIds } },
                include: {
                    _count: {
                        select: {
                            tokens: true,
                            consents: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            const sanitized = apps.map((app: any) => ({
                id: app.id,
                name: app.name,
                description: app.description,
                clientId: app.clientId,
                clientSecretHint: app.clientSecretHint,
                redirectUris: app.redirectUris,
                allowedOrigins: app.allowedOrigins,
                logoUrl: app.logoUrl,
                homepageUrl: app.homepageUrl,
                isVerified: app.isVerified,
                isActive: app.isActive,
                enableAuth: app.enableAuth ?? true,
                enablePay: app.enablePay ?? true,
                webhookUrl: app.webhookUrl || '',
                webhookSecret: app.webhookSecret || '',
                allowedScopes: app.allowedScopes,
                authUxModes: (app as any).authUxModes || ['popup'],
                payUxModes: (app as any).payUxModes || ['bottom_sheet'],
                authDesktopDefault: (app as any).authDesktopDefault || 'popup',
                authMobileDefault: (app as any).authMobileDefault || 'bottom_sheet',
                payDesktopDefault: (app as any).payDesktopDefault || 'bottom_sheet',
                payMobileDefault: (app as any).payMobileDefault || 'bottom_sheet',
                accessTokenTtl: ((app as any).bankDetails as any)?.accessTokenTtl || 900,
                refreshTokenDays: ((app as any).bankDetails as any)?.refreshTokenDays || 7,
                metrics: {
                    activeTokens: app._count.tokens,
                    authorizedUsers: app._count.consents
                },
                createdAt: app.createdAt,
                updatedAt: app.updatedAt
            }));

            return res.json({ success: true, apps: sanitized });
        } catch (err: any) {
            console.error('[DeveloperController] listApps error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Get a single OAuth application by ID or Client ID
     */
    static async getApp(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { id } = req.params;

            const app = await prisma.oAuthApp.findFirst({
                where: {
                    OR: [
                        { id, userId: { in: userIds } },
                        { clientId: id, userId: { in: userIds } }
                    ]
                },
                include: {
                    _count: {
                        select: {
                            tokens: true,
                            consents: true
                        }
                    }
                }
            });

            if (!app) {
                return res.status(404).json({ success: false, message: 'OAuth application not found' });
            }

            return res.json({
                success: true,
                app: {
                    id: app.id,
                    name: app.name,
                    description: app.description,
                    clientId: app.clientId,
                    clientSecretHint: app.clientSecretHint,
                    redirectUris: app.redirectUris,
                    allowedOrigins: app.allowedOrigins,
                    logoUrl: app.logoUrl,
                    homepageUrl: app.homepageUrl,
                    isVerified: app.isVerified,
                    isActive: app.isActive,
                    enableAuth: (app as any).enableAuth ?? true,
                    enablePay: (app as any).enablePay ?? true,
                    webhookUrl: (app as any).webhookUrl || '',
                    webhookSecret: (app as any).webhookSecret || '',
                    allowedScopes: app.allowedScopes,
                    authUxModes: (app as any).authUxModes || ['popup'],
                    payUxModes: (app as any).payUxModes || ['bottom_sheet'],
                    authDesktopDefault: (app as any).authDesktopDefault || 'popup',
                    authMobileDefault: (app as any).authMobileDefault || 'bottom_sheet',
                    payDesktopDefault: (app as any).payDesktopDefault || 'bottom_sheet',
                    payMobileDefault: (app as any).payMobileDefault || 'bottom_sheet',
                    accessTokenTtl: ((app as any).bankDetails as any)?.accessTokenTtl || 900,
                    refreshTokenDays: ((app as any).bankDetails as any)?.refreshTokenDays || 7,
                    metrics: {
                        activeTokens: app._count.tokens,
                        authorizedUsers: app._count.consents
                    },
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt
                }
            });
        } catch (err: any) {
            console.error('[DeveloperController] getApp error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Create a new OAuth application and generate Client ID + Secret + Webhook Secret
     */
    static async createApp(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const userId = userIds[0];

            // ─── SERVER-SIDE BILLING HARDENING ──────────────────────────────────
            // 1st project is 100% Free Forever with full features access.
            // Additional projects strictly require active subscription / auto-pay ($2.50/mo per extra project).
            let billingSummary: any;
            try {
                billingSummary = await DeveloperBillingService.assertCanCreateApp(userIds, {
                    enableAutoPay: Boolean(req.body.enableAutoPay),
                    paymentSource: req.body.paymentSource
                });
            } catch (billingErr: any) {
                if (billingErr.statusCode === 402 || billingErr.code === 'PAYMENT_REQUIRED') {
                    return res.status(402).json({
                        success: false,
                        code: 'PAYMENT_REQUIRED',
                        message: billingErr.message,
                        billing: billingErr.data
                    });
                }
                throw billingErr;
            }

            const {
                name,
                description,
                redirectUris = [],
                allowedOrigins = [],
                logoUrl,
                homepageUrl,
                allowedScopes,
                enableAuth = true,
                enablePay = true,
                webhookUrl = '',
                authUxModes = ['popup'],
                payUxModes = ['bottom_sheet'],
                authDesktopDefault = 'popup',
                authMobileDefault = 'bottom_sheet',
                payDesktopDefault = 'bottom_sheet',
                payMobileDefault = 'bottom_sheet'
            } = req.body;

            if (!name || String(name).trim().length < 2) {
                return res.status(400).json({ success: false, message: 'Application name is required (min 2 characters)' });
            }

            if (!logoUrl || !String(logoUrl).trim()) {
                return res.status(400).json({ success: false, message: 'Application logo URL is strictly required' });
            }

            // Generate client ID, high-entropy secret, and webhook secret
            const clientId = generateRandomToken('180_client', 16);
            const rawSecret = generateRandomToken('180_secret', 32);
            const clientSecretHash = hashSecret(rawSecret);
            const clientSecretHint = `...${rawSecret.slice(-4)}`;
            const webhookSecret = generateRandomToken('whsec', 24);

            const app = await prisma.oAuthApp.create({
                data: {
                    name: String(name).trim(),
                    description: description ? String(description).trim() : '',
                    clientId,
                    clientSecretHash,
                    clientSecretHint,
                    redirectUris: Array.isArray(redirectUris) ? redirectUris.filter(Boolean) : [],
                    allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins.filter(Boolean) : [],
                    logoUrl: logoUrl || '',
                    homepageUrl: homepageUrl || '',
                    allowedScopes: Array.isArray(allowedScopes) && allowedScopes.length > 0 ? allowedScopes : ['identity:read'],
                    enableAuth: Boolean(enableAuth),
                    enablePay: Boolean(enablePay),
                    webhookUrl: String(webhookUrl || '').trim(),
                    webhookSecret,
                    authUxModes: Array.isArray(authUxModes) ? authUxModes : ['popup'],
                    payUxModes: Array.isArray(payUxModes) ? payUxModes : ['bottom_sheet'],
                    authDesktopDefault: String(authDesktopDefault || 'popup'),
                    authMobileDefault: String(authMobileDefault || 'bottom_sheet'),
                    payDesktopDefault: String(payDesktopDefault || 'bottom_sheet'),
                    payMobileDefault: String(payMobileDefault || 'bottom_sheet'),
                    userId
                } as any
            });

            return res.status(201).json({
                success: true,
                message: 'Application created successfully. Store your Client Secret safely, it will not be shown again.',
                clientId: app.clientId,
                clientSecret: rawSecret,
                webhookSecret,
                credentials: {
                    clientId: app.clientId,
                    clientSecret: rawSecret,
                    webhookSecret
                },
                billing: billingSummary,
                app: {
                    id: app.id,
                    name: app.name,
                    clientId: app.clientId,
                    clientSecret: rawSecret, // RETURNED ONCE ON CREATION
                    webhookSecret,
                    enableAuth: (app as any).enableAuth,
                    enablePay: (app as any).enablePay,
                    webhookUrl: (app as any).webhookUrl,
                    redirectUris: app.redirectUris,
                    allowedScopes: app.allowedScopes,
                    authUxModes: (app as any).authUxModes,
                    payUxModes: (app as any).payUxModes,
                    authDesktopDefault: (app as any).authDesktopDefault,
                    authMobileDefault: (app as any).authMobileDefault,
                    payDesktopDefault: (app as any).payDesktopDefault,
                    payMobileDefault: (app as any).payMobileDefault
                }
            });
        } catch (err: any) {
            console.error('[DeveloperController] createApp error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Update an existing OAuth application (toggles, settings, webhooks)
     */
    static async updateApp(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { id } = req.params;
            const {
                name,
                description,
                redirectUris,
                allowedOrigins,
                logoUrl,
                homepageUrl,
                allowedScopes,
                isActive,
                enableAuth,
                enablePay,
                webhookUrl,
                authUxModes,
                payUxModes,
                authDesktopDefault,
                authMobileDefault,
                payDesktopDefault,
                payMobileDefault,
                accessTokenTtl,
                refreshTokenDays
            } = req.body;

            const app = await prisma.oAuthApp.findFirst({
                where: { id, userId: { in: userIds } }
            });

            if (!app) {
                return res.status(404).json({ success: false, message: 'OAuth application not found' });
            }

            let updatedBankDetails = (app.bankDetails as any) || {};
            if (accessTokenTtl !== undefined || refreshTokenDays !== undefined) {
                updatedBankDetails = {
                    ...updatedBankDetails,
                    ...(accessTokenTtl !== undefined && { accessTokenTtl: Math.max(60, Number(accessTokenTtl)) }),
                    ...(refreshTokenDays !== undefined && { refreshTokenDays: Math.max(1, Number(refreshTokenDays)) })
                };
            }

            const updated = await prisma.oAuthApp.update({
                where: { id },
                data: {
                    ...(name && { name: String(name).trim() }),
                    ...(description !== undefined && { description: String(description).trim() }),
                    ...(redirectUris && { redirectUris: Array.isArray(redirectUris) ? redirectUris.filter(Boolean) : [] }),
                    ...(allowedOrigins && { allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins.filter(Boolean) : [] }),
                    ...(logoUrl !== undefined && { logoUrl }),
                    ...(homepageUrl !== undefined && { homepageUrl }),
                    ...(allowedScopes && { allowedScopes }),
                    ...(isActive !== undefined && { isActive: Boolean(isActive) }),
                    ...(enableAuth !== undefined && { enableAuth: Boolean(enableAuth) }),
                    ...(enablePay !== undefined && { enablePay: Boolean(enablePay) }),
                    ...(webhookUrl !== undefined && { webhookUrl: String(webhookUrl).trim() }),
                    ...(authUxModes !== undefined && { authUxModes: Array.isArray(authUxModes) ? authUxModes : [] }),
                    ...(payUxModes !== undefined && { payUxModes: Array.isArray(payUxModes) ? payUxModes : [] }),
                    ...(authDesktopDefault !== undefined && { authDesktopDefault: String(authDesktopDefault) }),
                    ...(authMobileDefault !== undefined && { authMobileDefault: String(authMobileDefault) }),
                    ...(payDesktopDefault !== undefined && { payDesktopDefault: String(payDesktopDefault) }),
                    ...(payMobileDefault !== undefined && { payMobileDefault: String(payMobileDefault) }),
                    ...((accessTokenTtl !== undefined || refreshTokenDays !== undefined) && { bankDetails: updatedBankDetails })
                } as any
            });

            return res.json({
                success: true,
                message: 'Application updated successfully',
                app: {
                    id: updated.id,
                    name: updated.name,
                    clientId: updated.clientId,
                    enableAuth: (updated as any).enableAuth,
                    enablePay: (updated as any).enablePay,
                    webhookUrl: (updated as any).webhookUrl,
                    redirectUris: updated.redirectUris,
                    allowedScopes: updated.allowedScopes,
                    isActive: updated.isActive,
                    authUxModes: (updated as any).authUxModes,
                    payUxModes: (updated as any).payUxModes,
                    authDesktopDefault: (updated as any).authDesktopDefault,
                    authMobileDefault: (updated as any).authMobileDefault,
                    payDesktopDefault: (updated as any).payDesktopDefault,
                    payMobileDefault: (updated as any).payMobileDefault,
                    accessTokenTtl: ((updated as any).bankDetails as any)?.accessTokenTtl || 900,
                    refreshTokenDays: ((updated as any).bankDetails as any)?.refreshTokenDays || 7
                }
            });
        } catch (err: any) {
            console.error('[DeveloperController] updateApp error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Rotate Client Secret
     */
    static async rotateSecret(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { id } = req.params;

            const app = await prisma.oAuthApp.findFirst({
                where: { id, userId: { in: userIds } }
            });

            if (!app) {
                return res.status(404).json({ success: false, message: 'OAuth application not found' });
            }

            const newRawSecret = generateRandomToken('180_secret', 32);
            const clientSecretHash = hashSecret(newRawSecret);
            const clientSecretHint = `...${newRawSecret.slice(-4)}`;

            await prisma.oAuthApp.update({
                where: { id },
                data: {
                    clientSecretHash,
                    clientSecretHint
                }
            });

            return res.json({
                success: true,
                message: 'Client secret rotated successfully. Copy the new secret now.',
                clientSecret: newRawSecret
            });
        } catch (err: any) {
            console.error('[DeveloperController] rotateSecret error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Rotate Webhook Secret
     */
    static async rotateWebhookSecret(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { id } = req.params;

            const app = await prisma.oAuthApp.findFirst({
                where: { id, userId: { in: userIds } }
            });

            if (!app) {
                return res.status(404).json({ success: false, message: 'OAuth application not found' });
            }

            const newWebhookSecret = generateRandomToken('whsec', 24);

            await prisma.oAuthApp.update({
                where: { id },
                data: {
                    webhookSecret: newWebhookSecret
                } as any
            });

            return res.json({
                success: true,
                message: 'Webhook signing secret rotated successfully.',
                webhookSecret: newWebhookSecret
            });
        } catch (err: any) {
            console.error('[DeveloperController] rotateWebhookSecret error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Test Webhook Dispatch directly to Developer Server
     */
    static async testWebhook(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { id } = req.params;
            const axios = require('axios');
            const crypto = require('crypto');

            const app = await prisma.oAuthApp.findFirst({
                where: { id, userId: { in: userIds } }
            });

            if (!app) {
                return res.status(404).json({ success: false, message: 'OAuth application not found' });
            }

            const targetUrl = (app as any).webhookUrl || req.body?.url;
            if (!targetUrl || !targetUrl.startsWith('http')) {
                return res.status(400).json({ success: false, message: 'No valid webhook URL configured for this app' });
            }

            const signingSecret = (app as any).webhookSecret || app.clientSecretHash;
            const payload = {
                event: 'payment.test',
                id: `evt_test_${Date.now()}`,
                createdAt: new Date().toISOString(),
                data: {
                    sessionId: `cs_test_${generateRandomToken('180', 8)}`,
                    amount: 499.00,
                    currency: 'INR',
                    title: 'Test Webhook Verification Payment',
                    customer: {
                        name: '180 Test Customer',
                        email: 'test@180workspace.com'
                    },
                    metadata: {
                        tier: 'pro_monthly',
                        isSandbox: true
                    },
                    timestamp: new Date().toISOString()
                }
            };

            const payloadString = JSON.stringify(payload);
            const signature = crypto
                .createHmac('sha256', signingSecret)
                .update(payloadString)
                .digest('hex');

            const startTime = Date.now();
            let deliveryStatus = 'SUCCESS';
            let responseStatus = 200;
            let responseBody = '';

            try {
                const response = await axios.post(targetUrl, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-180-Signature': signature,
                        'X-180-Event': 'payment.test',
                        'User-Agent': '180-Webhook-Dispatcher/1.0'
                    },
                    timeout: 8000
                });
                responseStatus = response.status;
                responseBody = typeof response.data === 'string' ? response.data.slice(0, 500) : JSON.stringify(response.data).slice(0, 500);
            } catch (httpErr: any) {
                deliveryStatus = 'FAILED';
                responseStatus = httpErr.response?.status || 500;
                responseBody = httpErr.response?.data ? JSON.stringify(httpErr.response.data).slice(0, 500) : httpErr.message;
            }

            const latencyMs = Date.now() - startTime;

            return res.json({
                success: deliveryStatus === 'SUCCESS',
                targetUrl,
                event: 'payment.test',
                signature,
                statusCode: responseStatus,
                latencyMs,
                response: responseBody,
                message: deliveryStatus === 'SUCCESS' 
                    ? `Webhook verified successfully (HTTP ${responseStatus} in ${latencyMs}ms)` 
                    : `Webhook delivered with error (HTTP ${responseStatus} in ${latencyMs}ms)`
            });
        } catch (err: any) {
            console.error('[DeveloperController] testWebhook error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Delete an OAuth Application
     */
    static async deleteApp(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { id } = req.params;

            const app = await prisma.oAuthApp.findFirst({
                where: { id, userId: { in: userIds } }
            });

            if (!app) {
                return res.status(404).json({ success: false, message: 'OAuth application not found' });
            }

            await prisma.oAuthApp.delete({
                where: { id }
            });

            // Dynamically recalculate subscription for remaining projects
            await DeveloperBillingService.syncSubscriptionAfterAppDeletion(userIds);

            return res.json({ success: true, message: 'Application deleted successfully' });
        } catch (err: any) {
            console.error('[DeveloperController] deleteApp error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Get Developer Live Billing Status, 7-day pre-expiry warning, 3-day grace period, and lock status
     */
    static async getBillingStatus(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const billing = await DeveloperBillingService.getBillingStatus(userIds);
            return res.json({ success: true, billing });
        } catch (err: any) {
            console.error('[DeveloperController] getBillingStatus error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Activate or configure recurring auto-pay mandate for additional projects
     */
    static async setupAutoPay(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const { paymentSource } = req.body;
            const subscription = await DeveloperBillingService.activateAutoPay(userIds[0], { paymentSource });
            const billing = await DeveloperBillingService.getBillingStatus(userIds);
            return res.json({
                success: true,
                message: 'Auto-Pay subscription activated successfully. All billable projects are unlocked and active.',
                subscription,
                billing
            });
        } catch (err: any) {
            console.error('[DeveloperController] setupAutoPay error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Settle payment manually (e.g. if auto-pay failed or user pays via wallet / card directly)
     */
    static async settleManualPayment(req: any, res: any) {
        try {
            const userIds = await DeveloperController.resolveUserIds(req);
            if (!userIds.length) {
                return res.status(401).json({ success: false, message: 'Authentication required' });
            }
            const settlement = await DeveloperBillingService.settleManualPayment(userIds[0]);
            const billing = await DeveloperBillingService.getBillingStatus(userIds);
            return res.json({
                success: true,
                ...settlement,
                billing
            });
        } catch (err: any) {
            console.error('[DeveloperController] settleManualPayment error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Automated Dunning & Lockout Cycle (can be invoked by scheduled worker, cron, or admin)
     */
    static async runDunningCycle(req: any, res: any) {
        try {
            const result = await DeveloperBillingService.executeDunningCycle();
            return res.json({ success: true, ...result });
        } catch (err: any) {
            console.error('[DeveloperController] runDunningCycle error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }
}

