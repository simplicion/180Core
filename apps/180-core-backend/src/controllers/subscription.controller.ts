'use strict';

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SubscriptionService, RecurringBillingEngine, RazorpaySubscriptionService } from '@workspace/payment-provider';
import { developersPrisma as prisma } from '@workspace/db-180core';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180-identity-jwt-secret-key-prod-super-secure';

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function extractUserIdFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if ((req as any).cookies?.platform_auth_token) {
    token = (req as any).cookies.platform_auth_token;
  }
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.id || decoded.sub || decoded.userId || null;
  } catch {
    return null;
  }
}

export class SubscriptionApiController {
  /**
   * POST /api/v1/subscriptions/plans
   * Create or update a reusable subscription plan (Open API for any developer)
   */
  static async createPlan(req: Request, res: Response) {
    try {
      const {
        clientId,
        clientSecret,
        planCode,
        name,
        description,
        amount,
        currency,
        interval,
        intervalCount,
        trialDays,
        metadata,
      } = req.body;

      if (!clientId || !clientSecret) {
        return res.status(401).json({
          success: false,
          error: 'clientId and clientSecret are required to manage subscription plans',
        });
      }

      const result = await SubscriptionService.createOrUpdatePlan({
        clientId,
        clientSecret,
        planCode,
        name,
        description,
        amount: Number(amount),
        currency,
        interval,
        intervalCount: intervalCount ? Number(intervalCount) : 1,
        trialDays: trialDays ? Number(trialDays) : 0,
        metadata,
      });

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[SubscriptionApiController:createPlan] Error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to create subscription plan',
      });
    }
  }

  /**
   * GET /api/v1/subscriptions/plans
   * Lists all public plans for a client application
   */
  static async listPlans(req: Request, res: Response) {
    try {
      const clientId = (req.query.clientId as string) || req.headers['x-client-id'] as string;
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'clientId query parameter or x-client-id header is required',
        });
      }

      const result = await SubscriptionService.listPlans(clientId);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[SubscriptionApiController:listPlans] Error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to list subscription plans',
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/sessions
   * Creates a recurring subscription checkout session
   */
  static async createSubscriptionSession(req: Request, res: Response) {
    try {
      const {
        clientId,
        clientSecret,
        planCode,
        amount,
        currency,
        title,
        description,
        returnUrl,
        cancelUrl,
        metadata,
      } = req.body;

      if (!clientId || !clientSecret || !planCode) {
        return res.status(400).json({
          success: false,
          error: 'clientId, clientSecret, and planCode are required',
        });
      }

      const session = await SubscriptionService.createSubscriptionSession({
        clientId,
        clientSecret,
        planCode,
        amount: amount ? Number(amount) : undefined,
        currency,
        title,
        description,
        returnUrl,
        cancelUrl,
        metadata,
      });

      return res.status(200).json(session);
    } catch (err: any) {
      console.error('[SubscriptionApiController:createSubscriptionSession] Error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to create subscription session',
      });
    }
  }

  /**
   * GET /api/v1/subscriptions/:id
   * Get details of a subscription for user portal or client app
   */
  static async getSubscription(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = extractUserIdFromRequest(req);
      const clientId = (req.query.clientId as string) || (req.headers['x-client-id'] as string);
      const clientSecret = (req.query.clientSecret as string) || (req.headers['x-client-secret'] as string);

      let appId: string | undefined;
      if (clientId && clientSecret) {
        const app = await prisma.oAuthApp.findUnique({ where: { clientId } });
        if (!app || !timingSafeCompare(hashSecret(clientSecret), app.clientSecretHash)) {
          return res.status(401).json({ success: false, error: 'Invalid client credentials' });
        }
        appId = app.id;
      }

      const result = await SubscriptionService.getSubscriptionDetails(id, appId, userId || undefined);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[SubscriptionApiController:getSubscription] Error:', err);
      return res.status(404).json({
        success: false,
        error: err.message || 'Subscription not found',
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/:id/cancel
   * Cancel an active subscription (From 180 Pay user modal or via Client API)
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { clientId, clientSecret, reason } = req.body || {};
      const userId = extractUserIdFromRequest(req);

      let appId: string | undefined;
      if (clientId && clientSecret) {
        const app = await prisma.oAuthApp.findUnique({ where: { clientId } });
        if (!app || !timingSafeCompare(hashSecret(clientSecret), app.clientSecretHash)) {
          return res.status(401).json({ success: false, error: 'Invalid client credentials' });
        }
        appId = app.id;
      } else if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required: provide Bearer token or clientId/clientSecret',
        });
      }

      const result = await SubscriptionService.cancelSubscription(
        id,
        appId,
        reason || 'Subscriber cancelled via 180 Pay bottom sheet',
        userId || undefined
      );
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[SubscriptionApiController:cancelSubscription] Error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to cancel subscription',
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/run-billing-cycle
   * Trigger recurring billing cycle (Internal Worker or Cron)
   */
  static async runBillingCycle(req: Request, res: Response) {
    try {
      const cronSecret = process.env.CRON_SECRET || process.env.BILLING_CRON_SECRET;
      if (cronSecret) {
        const authHeader = req.headers['authorization'];
        const cronKey = (req.headers['x-cron-key'] || req.headers['x-cron-secret']) as string;
        const bearer = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const token = bearer || cronKey;
        if (token !== cronSecret) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized: Invalid cron secret (pass Authorization: Bearer <secret> or x-cron-key: <secret>)',
          });
        }
      }

      const result = await RecurringBillingEngine.runRecurringBillingCycle();
      return res.status(200).json({
        success: true,
        message: 'Recurring billing cycle executed successfully',
        data: result,
      });
    } catch (err: any) {
      console.error('[SubscriptionApiController:runBillingCycle] Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Recurring billing cycle failed',
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/razorpay-webhook
   * Razorpay server-to-server webhook endpoint for recurring subscription events
   */
  static async handleRazorpayWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);

      // Verify Razorpay signature
      if (signature) {
        const isValid = RazorpaySubscriptionService.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
          console.warn('[SubscriptionApiController:handleRazorpayWebhook] Invalid webhook signature');
          return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
        }
      }

      const result = await RazorpaySubscriptionService.handleRazorpaySubscriptionWebhook(req.body);
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      console.error('[SubscriptionApiController:handleRazorpayWebhook] Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Webhook processing failed',
      });
    }
  }

  /**
   * GET /api/v1/subscriptions/entitlements
   * Fetches active user subscription entitlements and issues a cryptographically
   * signed Subscription Entitlement Token (JWT) for offline 0ms verification.
   */
  static async getUserEntitlements(req: Request, res: Response) {
    try {
      const clientId = (req.headers['x-client-id'] || req.query.clientId) as string;
      const clientSecret = (req.headers['x-client-secret'] || req.query.clientSecret) as string;
      let targetUserId = (req.query.userId as string) || extractUserIdFromRequest(req);

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'x-client-id header or clientId query parameter is required',
        });
      }

      const app = await prisma.oAuthApp.findUnique({
        where: { clientId },
      });

      if (!app || !app.isActive) {
        return res.status(404).json({ success: false, error: 'OAuth application not found or inactive' });
      }

      // If clientSecret is provided, verify it
      if (clientSecret) {
        const isValid = timingSafeCompare(hashSecret(clientSecret), app.clientSecretHash);
        if (!isValid) {
          return res.status(401).json({ success: false, error: 'Invalid client credentials' });
        }
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: 'userId query parameter or valid User Bearer token is required',
        });
      }

      // Find most recent active or trialing subscription for this app and user
      const subscription = await (prisma as any).recurringSubscription.findFirst({
        where: {
          appId: app.id,
          userId: targetUserId,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        return res.status(200).json({
          success: true,
          hasActiveSubscription: false,
          entitlements: {
            status: 'NONE',
            planCode: null,
            planName: null,
            features: [],
            isPro: false,
            isEnterprise: false,
          },
          entitlementToken: null,
          expiresAt: null,
        });
      }

      const planMetadata = (subscription.plan?.metadata as any) || {};
      const features: string[] = Array.isArray(planMetadata.featureKeys)
        ? planMetadata.featureKeys
        : Array.isArray(planMetadata.features)
          ? planMetadata.features
          : [];

      const planCode = subscription.plan?.planCode || '';
      const isEnterprise = planCode.includes('enterprise');
      const isPro = isEnterprise || planCode.includes('pro');

      const now = Math.floor(Date.now() / 1000);
      const periodEndSec = Math.floor(new Date(subscription.currentPeriodEnd).getTime() / 1000);
      const expSec = Math.max(now + 300, periodEndSec); // At least 5 mins

      // Sign the Entitlement Token using the app's secret hash so developer can verify offline
      const signingKey = app.clientSecretHash || JWT_SECRET;
      const entitlementPayload = {
        iss: '180-pay',
        aud: app.clientId,
        sub: targetUserId,
        subscriptionId: subscription.id,
        planCode: subscription.plan.planCode,
        planName: subscription.plan.name,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
        features,
        isPro,
        isEnterprise,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingDate: subscription.nextBillingDate,
        iat: now,
        exp: expSec,
      };

      const entitlementToken = jwt.sign(entitlementPayload, signingKey);

      return res.status(200).json({
        success: true,
        hasActiveSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planCode: subscription.plan.planCode,
          planName: subscription.plan.name,
          amount: subscription.amount,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          nextBillingDate: subscription.nextBillingDate,
          features,
          isPro,
          isEnterprise,
          metadata: planMetadata,
        },
        entitlementToken,
        expiresAt: subscription.currentPeriodEnd,
      });
    } catch (err: any) {
      console.error('[SubscriptionApiController:getUserEntitlements] Error:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to retrieve entitlements',
      });
    }
  }

  /**
   * POST /api/v1/subscriptions/verify-token
   * Verifies a Subscription Entitlement Token (SET) and checks real-time database revocation
   */
  static async verifyEntitlementToken(req: Request, res: Response) {
    try {
      const { token, clientId } = req.body || {};
      if (!token) {
        return res.status(400).json({ success: false, error: 'token is required in request body' });
      }

      // 1. Decode token to inspect claims
      const unverified = jwt.decode(token) as any;
      if (!unverified || !unverified.aud) {
        return res.status(400).json({ success: false, valid: false, error: 'Invalid or malformed entitlement token' });
      }

      const targetClientId = clientId || unverified.aud;
      const app = await prisma.oAuthApp.findUnique({
        where: { clientId: targetClientId },
      });

      if (!app) {
        return res.status(404).json({ success: false, valid: false, error: 'Associated application not found' });
      }

      // 2. Cryptographic signature check
      const signingKey = app.clientSecretHash || JWT_SECRET;
      let decoded: any;
      try {
        decoded = jwt.verify(token, signingKey);
      } catch (jwtErr: any) {
        return res.status(401).json({
          success: false,
          valid: false,
          error: `Token verification failed: ${jwtErr.message}`,
        });
      }

      // 3. Optional realtime revocation / status check in database
      const liveSub = await (prisma as any).recurringSubscription.findUnique({
        where: { id: decoded.subscriptionId },
        include: { plan: true },
      });

      const isActive = liveSub && (liveSub.status === 'ACTIVE' || liveSub.status === 'TRIALING');

      return res.status(200).json({
        success: true,
        valid: true,
        isActive: !!isActive,
        status: liveSub ? liveSub.status : 'NOT_FOUND',
        claims: decoded,
        revoked: !isActive,
      });
    } catch (err: any) {
      console.error('[SubscriptionApiController:verifyEntitlementToken] Error:', err);
      return res.status(500).json({
        success: false,
        valid: false,
        error: err.message || 'Verification process failed',
      });
    }
  }
}


