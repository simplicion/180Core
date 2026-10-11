'use strict';

import crypto from 'crypto';
import axios from 'axios';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { RazorpaySubscriptionService } from './razorpay-subscription.service';

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

export interface CreatePlanInput {
  clientId: string;
  clientSecret: string;
  planCode: string;
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  interval?: 'MONTHLY' | 'YEARLY' | 'WEEKLY';
  intervalCount?: number;
  trialDays?: number;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionSessionInput {
  clientId: string;
  clientSecret: string;
  planCode: string;
  amount?: number;
  currency?: string;
  title?: string;
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
  expiresInMinutes?: number;
  paymentSource?: 'WALLET' | 'RAZORPAY_RECURRING' | 'HYBRID';
}

export class SubscriptionService {
  /**
   * Helper to authenticate developer OAuth credentials
   */
  private static async authenticateApp(clientId: string, clientSecret: string) {
    const app = await (prisma as any).oAuthApp.findUnique({
      where: { clientId },
    });

    if (!app || !app.isActive) {
      throw new Error('Invalid or inactive OAuth client credentials');
    }

    const isValidSecret = timingSafeCompare(hashSecret(clientSecret), app.clientSecretHash);
    if (!isValidSecret) {
      throw new Error('Invalid client secret');
    }

    if (app.enablePay === false) {
      throw new Error('180 Pay is currently disabled for this application.');
    }

    return app;
  }

  /**
   * 1. Register or update a reusable subscription plan (Open API for any developer)
   * Also automatically provisions a corresponding plan in Razorpay Subscriptions
   */
  static async createOrUpdatePlan(input: CreatePlanInput) {
    const {
      clientId,
      clientSecret,
      planCode,
      name,
      description = '',
      amount,
      currency = 'USD',
      interval = 'MONTHLY',
      intervalCount = 1,
      trialDays = 0,
      metadata = {},
    } = input;

    if (!planCode || !name || !amount || amount <= 0) {
      throw new Error('planCode, name, and valid amount (>0) are required');
    }

    const app = await this.authenticateApp(clientId, clientSecret);

    // Sync with Razorpay Subscriptions Plan API
    let razorpayPlanId: string | null = null;
    try {
      razorpayPlanId = await RazorpaySubscriptionService.syncPlanWithRazorpay({
        planCode: planCode.toLowerCase().trim(),
        name,
        description,
        amount,
        currency,
        interval,
      });
    } catch (err: any) {
      console.warn('[SubscriptionService] Razorpay plan sync non-blocking note:', err.message);
    }

    let plan;
    try {
      plan = await (prisma as any).subscriptionPlan.upsert({
        where: {
          appId_planCode: {
            appId: app.id,
            planCode: planCode.toLowerCase().trim(),
          },
        },
        update: {
          name,
          description,
          amount: Math.round(amount * 100) / 100,
          currency: currency.toUpperCase(),
          interval,
          intervalCount,
          trialDays,
          razorpayPlanId: razorpayPlanId || undefined,
          metadata,
          isActive: true,
        },
        create: {
          appId: app.id,
          planCode: planCode.toLowerCase().trim(),
          name,
          description,
          amount: Math.round(amount * 100) / 100,
          currency: currency.toUpperCase(),
          interval,
          intervalCount,
          trialDays,
          razorpayPlanId,
          metadata,
          isActive: true,
        },
      });
    } catch (upsertErr: any) {
      if (upsertErr.message?.includes('razorpayPlanId')) {
        plan = await (prisma as any).subscriptionPlan.upsert({
          where: {
            appId_planCode: {
              appId: app.id,
              planCode: planCode.toLowerCase().trim(),
            },
          },
          update: {
            name,
            description,
            amount: Math.round(amount * 100) / 100,
            currency: currency.toUpperCase(),
            interval,
            intervalCount,
            trialDays,
            metadata: { ...metadata, razorpayPlanId },
            isActive: true,
          },
          create: {
            appId: app.id,
            planCode: planCode.toLowerCase().trim(),
            name,
            description,
            amount: Math.round(amount * 100) / 100,
            currency: currency.toUpperCase(),
            interval,
            intervalCount,
            trialDays,
            metadata: { ...metadata, razorpayPlanId },
            isActive: true,
          },
        });
        if (razorpayPlanId) {
          try {
            await (prisma as any).$executeRawUnsafe(
              `UPDATE "SubscriptionPlan" SET "razorpayPlanId" = $1 WHERE "id" = $2`,
              razorpayPlanId,
              plan.id
            );
            plan.razorpayPlanId = razorpayPlanId;
          } catch (_) {}
        }
      } else {
        throw upsertErr;
      }
    }

    return {
      success: true,
      data: plan,
    };
  }

  /**
   * 2. List all available plans for a developer app
   */
  static async listPlans(clientId: string) {
    const app = await (prisma as any).oAuthApp.findUnique({
      where: { clientId },
      select: { id: true, name: true },
    });

    if (!app) {
      throw new Error('OAuth app not found');
    }

    const plans = await (prisma as any).subscriptionPlan.findMany({
      where: { appId: app.id, isActive: true },
      orderBy: { amount: 'asc' },
    });

    return {
      success: true,
      data: plans,
    };
  }

  /**
   * 3. Create a recurring Subscription Checkout Session
   */
  static async createSubscriptionSession(input: CreateSubscriptionSessionInput) {
    const {
      clientId,
      clientSecret,
      planCode,
      amount: overrideAmount,
      currency: overrideCurrency,
      title: overrideTitle,
      description,
      returnUrl,
      cancelUrl,
      metadata,
      expiresInMinutes = 60,
      paymentSource = 'WALLET',
    } = input;

    const app = await this.authenticateApp(clientId, clientSecret);

    const plan = await (prisma as any).subscriptionPlan.findUnique({
      where: {
        appId_planCode: {
          appId: app.id,
          planCode: planCode.toLowerCase().trim(),
        },
      },
    });

    if (!plan || !plan.isActive) {
      throw new Error(`Subscription plan "${planCode}" not found or inactive`);
    }

    const finalAmount = overrideAmount !== undefined && overrideAmount > 0 
      ? Math.round(overrideAmount * 100) / 100 
      : plan.amount;
    const finalCurrency = (overrideCurrency || plan.currency || 'USD').toUpperCase();
    const finalTitle = overrideTitle || `${plan.name} (${plan.interval.toLowerCase()} subscription)`;

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // If Razorpay plan ID is missing, try provisioning now
    let razorpayPlanId = plan.razorpayPlanId;
    if (!razorpayPlanId) {
      try {
        razorpayPlanId = await RazorpaySubscriptionService.syncPlanWithRazorpay({
          planCode: plan.planCode,
          name: plan.name,
          description: plan.description || '',
          amount: finalAmount,
          currency: finalCurrency,
          interval: plan.interval,
        });
        await (prisma as any).subscriptionPlan.update({
          where: { id: plan.id },
          data: { razorpayPlanId },
        });
      } catch (_) {}
    }

    // Provision Razorpay recurring subscription if backed by Razorpay
    let razorpaySub: any = null;
    if (razorpayPlanId) {
      try {
        razorpaySub = await RazorpaySubscriptionService.createRazorpaySubscription({
          razorpayPlanId,
          notes: {
            appId: app.id,
            planCode: plan.planCode,
            clientCompanyId: metadata?.companyId || '',
          },
        });
      } catch (_) {}
    }

    const session = await (prisma as any).checkoutSession.create({
      data: {
        appId: app.id,
        amount: finalAmount,
        currency: finalCurrency,
        status: 'PENDING',
        mode: 'subscription',
        planId: plan.id,
        billingInterval: plan.interval,
        title: finalTitle,
        description: description || plan.description || '',
        returnUrl: returnUrl || '',
        cancelUrl: cancelUrl || '',
        metadata: {
          ...(metadata || {}),
          planCode: plan.planCode,
          planId: plan.id,
          planTier: plan.planCode.includes('enterprise') 
            ? 'ENTERPRISE' 
            : plan.planCode.includes('pro') 
              ? 'PRO' 
              : 'STARTER',
          interval: plan.interval,
          paymentSource,
          razorpayPlanId,
          razorpaySubscriptionId: razorpaySub?.id || null,
          isSubscription: true,
        },
        expiresAt,
      },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            isVerified: true,
          },
        },
      },
    });

    const checkoutBase = process.env.PROFILE_FRONTEND_URL || 'https://pay.180workspace.com';

    return {
      success: true,
      sessionId: session.id,
      amount: session.amount,
      currency: session.currency,
      interval: plan.interval,
      planCode: plan.planCode,
      paymentSource,
      razorpaySubscriptionId: razorpaySub?.id || null,
      expiresAt: session.expiresAt,
      checkoutUrl: `${checkoutBase}/checkout/${session.id}`,
    };
  }

  /**
   * 4. Activate Subscription upon successful checkout capture
   */
  static async activateSubscriptionFromSession(sessionId: string, userId: string, tx: any = prisma) {
    const client = tx || prisma;
    const session = await client.checkoutSession.findUnique({
      where: { id: sessionId },
      include: { app: true },
    });

    if (!session || session.mode !== 'subscription' || !session.planId) {
      return null;
    }

    const plan = await client.subscriptionPlan.findUnique({
      where: { id: session.planId },
    });

    if (!plan) return null;

    const startDate = new Date();
    const nextBillingDate = new Date(startDate);
    if (plan.interval === 'YEARLY') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else if (plan.interval === 'WEEKLY') {
      nextBillingDate.setDate(nextBillingDate.getDate() + 7);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    const subMetadata = (session.metadata as any) || {};

    let sub;
    try {
      sub = await client.recurringSubscription.create({
        data: {
          appId: session.appId,
          planId: plan.id,
          userId,
          status: 'ACTIVE',
          billingCycle: plan.interval,
          amount: session.amount,
          currency: session.currency,
          currentPeriodStart: startDate,
          currentPeriodEnd: nextBillingDate,
          nextBillingDate,
          lastPaymentId: session.id,
          paymentSource: subMetadata.paymentSource || 'WALLET',
          razorpaySubscriptionId: subMetadata.razorpaySubscriptionId || null,
          metadata: subMetadata,
        },
      });
    } catch (createErr: any) {
      if (createErr.message?.includes('paymentSource') || createErr.message?.includes('razorpaySubscriptionId')) {
        sub = await client.recurringSubscription.create({
          data: {
            appId: session.appId,
            planId: plan.id,
            userId,
            status: 'ACTIVE',
            billingCycle: plan.interval,
            amount: session.amount,
            currency: session.currency,
            currentPeriodStart: startDate,
            currentPeriodEnd: nextBillingDate,
            nextBillingDate,
            lastPaymentId: session.id,
            metadata: subMetadata,
          },
        });
        const ps = subMetadata.paymentSource || 'WALLET';
        const rzpSubId = subMetadata.razorpaySubscriptionId || null;
        try {
          await client.$executeRawUnsafe(
            `UPDATE "RecurringSubscription" SET "paymentSource" = $1, "razorpaySubscriptionId" = $2 WHERE "id" = $3`,
            ps,
            rzpSubId,
            sub.id
          );
          sub.paymentSource = ps;
          sub.razorpaySubscriptionId = rzpSubId;
        } catch (_) {}
      } else {
        throw createErr;
      }
    }

    // Dispatch webhook event asynchronously
    this.dispatchSubscriptionWebhook(session.appId, {
      event: 'subscription.activated',
      data: {
        subscriptionId: sub.id,
        sessionId: session.id,
        planCode: plan.planCode,
        planName: plan.name,
        amount: sub.amount,
        currency: sub.currency,
        billingCycle: sub.billingCycle,
        currentPeriodStart: sub.currentPeriodStart.toISOString(),
        currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
        nextBillingDate: sub.nextBillingDate.toISOString(),
        status: sub.status,
        paymentSource: sub.paymentSource,
        userId,
        metadata: session.metadata,
        timestamp: new Date().toISOString(),
      },
    }).catch((err) => {
      console.warn('[SubscriptionService] Failed to dispatch subscription.activated webhook:', err.message);
    });

    return sub;
  }

  /**
   * 4.5 Get subscription details (for 180 Pay management bottom sheet / portal)
   */
  static async getSubscriptionDetails(subscriptionId: string, appId?: string, userId?: string) {
    const where: any = { id: subscriptionId };
    if (appId) where.appId = appId;
    if (userId) where.userId = userId;

    const sub = await (prisma as any).recurringSubscription.findFirst({
      where,
      include: {
        plan: true,
        app: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            clientId: true,
          },
        },
      },
    });

    if (!sub) {
      throw new Error('Subscription not found or unauthorized');
    }

    return {
      success: true,
      subscription: {
        id: sub.id,
        planCode: sub.plan.planCode,
        planName: sub.plan.name,
        description: sub.plan.description,
        amount: sub.plan.amount,
        currency: sub.plan.currency,
        interval: sub.plan.interval,
        intervalCount: sub.plan.intervalCount,
        status: sub.status,
        paymentSource: sub.paymentSource,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        nextBillingDate: sub.nextBillingDate,
        nextBillingAt: sub.nextBillingDate || sub.nextBillingAt,
        startedAt: sub.createdAt || sub.startedAt,
        createdAt: sub.createdAt,
        cancelledAt: sub.cancelledAt,
        cancelReason: sub.cancelReason,
        metadata: sub.metadata,
        app: sub.app,
      },
    };
  }

  /**
   * 5. Cancel an active subscription
   * Cancels in 180 Pay AND automatically triggers bank mandate cancellation in Razorpay
   */
  static async cancelSubscription(subscriptionId: string, appId?: string, reason = 'User requested cancellation', userId?: string) {
    const where: any = { id: subscriptionId };
    if (appId) where.appId = appId;
    if (userId) where.userId = userId;

    const sub = await (prisma as any).recurringSubscription.findFirst({
      where,
      include: { plan: true },
    });

    if (!sub) {
      throw new Error('Subscription not found');
    }

    // 1. Cancel in Razorpay if backed by Razorpay mandate
    if (sub.razorpaySubscriptionId) {
      try {
        await RazorpaySubscriptionService.cancelRazorpaySubscription(sub.razorpaySubscriptionId, true);
        console.log(`[SubscriptionService] Revoked Razorpay mandate for subscription ${sub.razorpaySubscriptionId}`);
      } catch (rzpErr: any) {
        console.warn(`[SubscriptionService] Razorpay cancellation note: ${rzpErr.message}`);
      }
    }

    // 2. Mark local subscription cancelled
    const updated = await (prisma as any).recurringSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    // 3. Dispatch subscription.cancelled webhook to the developer application
    this.dispatchSubscriptionWebhook(sub.appId, {
      event: 'subscription.cancelled',
      data: {
        subscriptionId: sub.id,
        planCode: sub.plan.planCode,
        status: 'CANCELLED',
        cancelledAt: updated.cancelledAt,
        cancelReason: reason,
        metadata: sub.metadata,
      },
    }).catch(() => {});

    return {
      success: true,
      data: updated,
    };
  }

  /**
   * 6. Universal Webhook Dispatcher with HMAC-SHA256 signature
   */
  static async dispatchSubscriptionWebhook(appId: string, payload: any) {
    const endpoints = await (prisma as any).webhookEndpoint.findMany({
      where: { appId, isActive: true },
    });

    if (!endpoints.length) return;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadString = JSON.stringify(payload);

    for (const ep of endpoints) {
      try {
        const signPayload = `${timestamp}.${payloadString}`;
        const signature = crypto.createHmac('sha256', ep.secret).update(signPayload).digest('hex');

        await axios.post(ep.url, payload, {
          timeout: 7000,
          headers: {
            'Content-Type': 'application/json',
            'x-180-signature': `t=${timestamp},v1=${signature}`,
            'x-180-event': payload.event,
          },
        });
      } catch (err: any) {
        console.warn(`[Webhook Delivery Failed] ${ep.url}:`, err.message);
      }
    }
  }
}
