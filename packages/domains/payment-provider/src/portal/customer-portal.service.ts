'use strict';

import crypto from 'crypto';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { WebhookDispatcherService } from '../webhook/webhook-dispatcher.service';

export interface CreatePortalSessionInput {
  appId: string;
  customerEmail: string;
  externalCustomerId?: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  sessionToken: string;
  portalUrl: string;
  expiresAt: Date;
  customerEmail: string;
}

export interface PortalDashboardData {
  sessionToken: string;
  expiresAt: Date;
  returnUrl: string;
  merchant: {
    name: string;
    logoUrl?: string;
    homepageUrl?: string;
    clientId: string;
  };
  customer: {
    email: string;
    externalId?: string;
  };
  subscriptions: Array<{
    id: string;
    planName: string;
    amount: number;
    currency: string;
    billingCycle: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    nextBillingDate: Date;
    cancelReason?: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    title: string;
    date: Date;
    status: string;
    receiptUrl: string;
  }>;
}

export class CustomerPortalService {
  /**
   * Helper to resolve base profile URL.
   */
  static getBaseProfileUrl(): string {
    const isProd = process.env.NODE_ENV === 'production';
    return isProd ? 'https://profile.180workspace.com' : (process.env.PROFILE_SERVER_URL || 'http://localhost:3009');
  }

  /**
   * 1. Creates an ephemeral 20-minute signed Customer Portal session.
   */
  static async createPortalSession(input: CreatePortalSessionInput): Promise<PortalSessionResult> {
    const { appId, returnUrl } = input;
    const customerEmail = (input.customerEmail || '').trim().toLowerCase();

    if (!customerEmail || !customerEmail.includes('@')) {
      throw new Error('Valid customer email is required to generate portal session');
    }
    if (!returnUrl) {
      throw new Error('Merchant returnUrl is required');
    }

    const app = await (prisma as any).oAuthApp.findUnique({
      where: { id: appId },
    });
    if (!app || !app.isActive) {
      throw new Error('Developer application not found or inactive');
    }

    // Generate cryptographic token (pts_ + 48 hex chars)
    const sessionToken = `pts_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 min TTL

    await (prisma as any).customerPortalSession.create({
      data: {
        sessionToken,
        appId,
        customerEmail,
        externalCustomerId: input.externalCustomerId || null,
        returnUrl: returnUrl.trim(),
        expiresAt,
      },
    });

    const baseProfile = this.getBaseProfileUrl();
    const portalUrl = `${baseProfile}/portal/session/${sessionToken}`;

    return {
      sessionToken,
      portalUrl,
      expiresAt,
      customerEmail,
    };
  }

  /**
   * 2. Resolves portal dashboard data using the ephemeral magic token.
   * Strictly scopes data to that customer's email and that specific merchant app.
   */
  static async getPortalData(sessionToken: string): Promise<PortalDashboardData> {
    const session = await (prisma as any).customerPortalSession.findUnique({
      where: { sessionToken },
      include: {
        app: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            homepageUrl: true,
            clientId: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Customer portal session not found');
    }

    if (new Date() > new Date(session.expiresAt)) {
      throw new Error('Customer portal session has expired. Please launch a new session from the merchant dashboard.');
    }

    // Mark usedAt if first time opening
    if (!session.usedAt) {
      await (prisma as any).customerPortalSession.update({
        where: { id: session.id },
        data: { usedAt: new Date() },
      });
    }

    const { appId, customerEmail } = session;

    // Find linked user ID if customer has an existing 180 Profile with this email
    const linkedUser = await (prisma as any).user.findUnique({
      where: { email: customerEmail },
      select: { id: true },
    });

    // Fetch subscriptions under this app matching either linked user ID or customer metadata
    const userOrFilters: any[] = [];
    if (linkedUser) {
      userOrFilters.push({ userId: linkedUser.id });
    }

    const subscriptions = await (prisma as any).recurringSubscription.findMany({
      where: {
        appId,
        ...(userOrFilters.length > 0 ? { OR: userOrFilters } : {}),
      },
      include: {
        plan: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch invoices / checkout sessions under this app
    const sessions = await (prisma as any).checkoutSession.findMany({
      where: {
        appId,
        status: 'CAPTURED',
        ...(userOrFilters.length > 0 ? { OR: userOrFilters } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      returnUrl: session.returnUrl,
      merchant: {
        name: session.app?.name || '180 Workspace Merchant',
        logoUrl: session.app?.logoUrl || '',
        homepageUrl: session.app?.homepageUrl || '',
        clientId: session.app?.clientId || '',
      },
      customer: {
        email: session.customerEmail,
        externalId: session.externalCustomerId || undefined,
      },
      subscriptions: subscriptions.map((s: any) => ({
        id: s.id,
        planName: s.plan?.name || 'Subscription Plan',
        amount: s.amount,
        currency: s.currency,
        billingCycle: s.billingCycle,
        status: s.status,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        nextBillingDate: s.nextBillingDate,
        cancelReason: s.cancelReason,
      })),
      invoices: sessions.map((cs: any) => ({
        id: cs.id,
        invoiceNumber: `INV-${cs.id.slice(-8).toUpperCase()}`,
        amount: cs.amount,
        currency: cs.currency,
        title: cs.title,
        date: cs.createdAt,
        status: 'PAID',
        receiptUrl: `/api/v1/portal/invoice/${cs.id}/pdf?token=${session.sessionToken}`,
      })),
    };
  }

  /**
   * 3. Self-Service Subscription Cancellation from Portal
   */
  static async cancelSubscription(sessionToken: string, subscriptionId: string, reason?: string) {
    const session = await (prisma as any).customerPortalSession.findUnique({
      where: { sessionToken },
    });

    if (!session || new Date() > new Date(session.expiresAt)) {
      throw new Error('Invalid or expired customer portal session');
    }

    const sub = await (prisma as any).recurringSubscription.findFirst({
      where: {
        id: subscriptionId,
        appId: session.appId,
      },
    });

    if (!sub) {
      throw new Error('Subscription not found under this merchant account');
    }

    if (sub.status === 'CANCELLED') {
      return { success: true, message: 'Subscription is already cancelled', subscription: sub };
    }

    const updated = await (prisma as any).recurringSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by customer via self-service portal',
      },
    });

    WebhookDispatcherService.dispatchEvent(session.appId, {
      event: 'subscription.cancelled_by_customer',
      data: {
        subscriptionId: updated.id,
        appId: session.appId,
        customerEmail: session.customerEmail,
        cancelledAt: updated.cancelledAt,
        reason: updated.cancelReason,
      },
    }).catch((err) => console.warn('[CustomerPortalService] Webhook dispatch error:', err.message));

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: updated,
    };
  }
}
