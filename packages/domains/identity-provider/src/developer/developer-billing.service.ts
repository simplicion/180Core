'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';

export const DEV_TRIAL_DAYS = 30; // 30 days free trial access
export const DEV_STARTER_PRICE = 2.0; // $2 / month
export const DEV_STARTER_MAX_PROJECTS = 5; // 5 projects access
export const DEV_PRO_PRICE = 5.0; // $5 / month
export const DEV_PRO_MAX_PROJECTS = 10; // 10 projects access
export const ENTERPRISE_FORM_URL = 'https://app.180workspace.com/f/9hbzy4u62s';

export const DEV_PLAN_STARTER = 'DEV_STARTER_PLAN';
export const DEV_PLAN_PRO = 'DEV_PRO_PLAN';
export const DEV_PROJECT_PLAN_CODE = 'DEV_PER_PROJECT_PLAN';
export const RATE_PER_PROJECT = 2.5;
export const FREE_PROJECTS_LIMIT = 5; // Default trial projects limit
export const GRACE_PERIOD_DAYS = 3; // 3 days extra post-expiry
export const WARNING_DAYS = 7; // 7 days pre-expiry warning

export interface DeveloperBillingStatus {
  totalProjects: number;
  maxProjectsAllowed: number;
  freeProjects: number;
  billableProjects: number;
  ratePerProject: number;
  currentMonthlyTotal: number;
  monthlyAmount: number;
  status: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED';
  planTier: 'TRIAL' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  planName: string;
  isTrial: boolean;
  trialDaysLeft: number;
  trialEndsAt: string;
  subscriptionId?: string | null;
  nextBillingDate?: string | null;
  daysUntilRenewal?: number | null;
  warningActive: boolean;
  warningDaysLeft?: number | null;
  gracePeriodActive: boolean;
  gracePeriodHoursLeft?: number | null;
  gracePeriodEndsAt?: string | null;
  isLocked: boolean;
  canCreateMore: boolean;
  message?: string;
  contactFormUrl: string;
}

export class DeveloperBillingService {
  /**
   * Helper to resolve the 180workspace platform app ID for anchoring developer project subscriptions
   */
  private static async getPlatformAppId(): Promise<string> {
    const platformApp = await prisma.oAuthApp.findFirst({
      where: {
        OR: [
          { clientId: '180_client_70d751541f05347fe803ec8e128f5e83' },
          { name: '180workspace' },
          { name: { contains: 'Workspace', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (platformApp) return platformApp.id;

    const anyApp = await prisma.oAuthApp.findFirst({ select: { id: true } });
    if (!anyApp) throw new Error('No root platform OAuthApp found in database');
    return anyApp.id;
  }

  /**
   * Ensure the official DEV_STARTER_PLAN and DEV_PRO_PLAN exist in database
   */
  static async ensurePlans(): Promise<{ starter: any; pro: any }> {
    const appId = await this.getPlatformAppId();

    let starter = await (prisma as any).subscriptionPlan.findFirst({
      where: { planCode: DEV_PLAN_STARTER },
    });
    if (!starter) {
      starter = await (prisma as any).subscriptionPlan.create({
        data: {
          appId,
          planCode: DEV_PLAN_STARTER,
          name: 'Developer Starter Plan',
          description: 'Developer portal access with up to 5 projects ($2/mo)',
          amount: DEV_STARTER_PRICE,
          currency: 'USD',
          interval: 'MONTHLY',
          intervalCount: 1,
          trialDays: 30,
          isActive: true,
          metadata: { planTier: 'STARTER', maxProjects: DEV_STARTER_MAX_PROJECTS, rate: DEV_STARTER_PRICE },
        },
      });
    }

    let pro = await (prisma as any).subscriptionPlan.findFirst({
      where: { planCode: DEV_PLAN_PRO },
    });
    if (!pro) {
      pro = await (prisma as any).subscriptionPlan.create({
        data: {
          appId,
          planCode: DEV_PLAN_PRO,
          name: 'Developer Pro Plan',
          description: 'Developer portal access with up to 10 projects ($5/mo)',
          amount: DEV_PRO_PRICE,
          currency: 'USD',
          interval: 'MONTHLY',
          intervalCount: 1,
          trialDays: 30,
          isActive: true,
          metadata: { planTier: 'PRO', maxProjects: DEV_PRO_MAX_PROJECTS, rate: DEV_PRO_PRICE },
        },
      });
    }

    return { starter, pro };
  }

  /**
   * Ensure legacy plan for backwards compatibility
   */
  static async ensurePlan(): Promise<any> {
    const { starter } = await this.ensurePlans();
    return starter;
  }

  /**
   * Get the developer's live billing status, 30-day trial status, warning flags, and lock status
   */
  static async getBillingStatus(userIds: string[]): Promise<DeveloperBillingStatus> {
    const [user, apps] = await Promise.all([
      prisma.user.findFirst({
        where: { id: { in: userIds } },
        select: { id: true, createdAt: true, name: true, email: true },
      }),
      prisma.oAuthApp.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, isActive: true, enableAuth: true, enablePay: true, createdAt: true },
      }),
    ]);

    const totalProjects = apps.length;
    const { starter, pro } = await this.ensurePlans();

    // Check for an active paid subscription
    const sub = await (prisma as any).recurringSubscription.findFirst({
      where: {
        userId: { in: userIds },
        planId: { in: [starter.id, pro.id] },
        status: { in: ['ACTIVE', 'WARNING_7_DAYS', 'GRACE_PERIOD', 'LOCKED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    const now = new Date();
    const userCreatedAt = user?.createdAt ? new Date(user.createdAt) : now;
    const trialEndsAt = new Date(userCreatedAt.getTime() + DEV_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const msUntilTrialEnds = trialEndsAt.getTime() - now.getTime();
    const trialDaysLeft = Math.max(0, Math.ceil(msUntilTrialEnds / (1000 * 60 * 60 * 24)));
    const isTrial = msUntilTrialEnds > 0;

    // ─── CASE 1: ACTIVE PAID SUBSCRIPTION ─────────────────────────────────────
    if (sub && (sub.status === 'ACTIVE' || sub.status === 'WARNING_7_DAYS' || sub.status === 'GRACE_PERIOD' || sub.status === 'LOCKED')) {
      const isPro = sub.plan?.planCode === DEV_PLAN_PRO || (sub.metadata as any)?.planTier === 'PRO' || sub.amount >= 5.0;
      const maxProjectsAllowed = isPro ? DEV_PRO_MAX_PROJECTS : DEV_STARTER_MAX_PROJECTS;
      const planTier: 'STARTER' | 'PRO' = isPro ? 'PRO' : 'STARTER';
      const planName = isPro ? 'Pro Plan ($5/mo)' : 'Starter Plan ($2/mo)';
      const monthlyAmount = isPro ? DEV_PRO_PRICE : DEV_STARTER_PRICE;

      const nextBillingDate = new Date(sub.nextBillingDate);
      const msUntilRenewal = nextBillingDate.getTime() - now.getTime();
      const daysUntilRenewal = Math.ceil(msUntilRenewal / (1000 * 60 * 60 * 24));

      const gracePeriodEndsAt = new Date(nextBillingDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      const msUntilGraceEnds = gracePeriodEndsAt.getTime() - now.getTime();
      const graceHoursLeft = Math.max(0, Math.ceil(msUntilGraceEnds / (1000 * 60 * 60)));

      const isPastDue = now > nextBillingDate;
      const isPastGrace = now > gracePeriodEndsAt;

      let status: 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED' = 'ACTIVE';
      let isLocked = false;
      let warningActive = false;
      let gracePeriodActive = false;
      let message = `${planName} Active. Using ${totalProjects} of ${maxProjectsAllowed} available projects.`;

      if (isPastGrace || sub.status === 'LOCKED') {
        status = 'LOCKED';
        isLocked = true;
        message = `Services Locked: Payment could not be collected after grace period. Please settle the outstanding $${monthlyAmount.toFixed(2)} charge.`;
      } else if (isPastDue || sub.status === 'GRACE_PERIOD') {
        status = 'GRACE_PERIOD';
        gracePeriodActive = true;
        message = `Payment Past Due: ${graceHoursLeft} hour(s) left in grace period before services are locked.`;
      } else if (daysUntilRenewal <= WARNING_DAYS) {
        status = 'WARNING_7_DAYS';
        warningActive = true;
        message = `Upcoming Renewal: Your monthly subscription of $${monthlyAmount.toFixed(2)} will renew in ${daysUntilRenewal} day(s).`;
      }

      const canCreateMore = !isLocked && totalProjects < maxProjectsAllowed;

      return {
        totalProjects,
        maxProjectsAllowed,
        freeProjects: 0,
        billableProjects: totalProjects,
        ratePerProject: monthlyAmount / maxProjectsAllowed,
        currentMonthlyTotal: monthlyAmount,
        monthlyAmount,
        status,
        planTier,
        planName,
        isTrial: false,
        trialDaysLeft: 0,
        trialEndsAt: trialEndsAt.toISOString(),
        subscriptionId: sub.id,
        nextBillingDate: nextBillingDate.toISOString(),
        daysUntilRenewal,
        warningActive,
        warningDaysLeft: warningActive ? daysUntilRenewal : null,
        gracePeriodActive,
        gracePeriodHoursLeft: gracePeriodActive ? graceHoursLeft : null,
        gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
        isLocked,
        canCreateMore,
        message,
        contactFormUrl: ENTERPRISE_FORM_URL,
      };
    }

    // ─── CASE 2: 30-DAY FREE TRIAL ACTIVE ────────────────────────────────────
    if (isTrial) {
      const maxProjectsAllowed = DEV_STARTER_MAX_PROJECTS; // 5 projects allowed in trial
      const canCreateMore = totalProjects < maxProjectsAllowed;

      return {
        totalProjects,
        maxProjectsAllowed,
        freeProjects: totalProjects,
        billableProjects: 0,
        ratePerProject: 0,
        currentMonthlyTotal: 0.0,
        monthlyAmount: 0.0,
        status: 'TRIAL_ACTIVE',
        planTier: 'TRIAL',
        planName: '30-Day Free Trial',
        isTrial: true,
        trialDaysLeft,
        trialEndsAt: trialEndsAt.toISOString(),
        subscriptionId: null,
        nextBillingDate: trialEndsAt.toISOString(),
        daysUntilRenewal: trialDaysLeft,
        warningActive: trialDaysLeft <= 7,
        warningDaysLeft: trialDaysLeft <= 7 ? trialDaysLeft : null,
        gracePeriodActive: false,
        gracePeriodHoursLeft: null,
        gracePeriodEndsAt: null,
        isLocked: false,
        canCreateMore,
        message: `30-Day Free Trial Active (${trialDaysLeft} days remaining). You have used ${totalProjects} of ${maxProjectsAllowed} included projects.`,
        contactFormUrl: ENTERPRISE_FORM_URL,
      };
    }

    // ─── CASE 3: TRIAL EXPIRED (NO ACTIVE SUBSCRIPTION) ───────────────────────
    return {
      totalProjects,
      maxProjectsAllowed: totalProjects,
      freeProjects: 0,
      billableProjects: totalProjects,
      ratePerProject: 0,
      currentMonthlyTotal: 0.0,
      monthlyAmount: 0.0,
      status: 'TRIAL_EXPIRED',
      planTier: 'TRIAL',
      planName: 'Free Trial Expired',
      isTrial: false,
      trialDaysLeft: 0,
      trialEndsAt: trialEndsAt.toISOString(),
      subscriptionId: null,
      nextBillingDate: null,
      daysUntilRenewal: null,
      warningActive: false,
      warningDaysLeft: null,
      gracePeriodActive: false,
      gracePeriodHoursLeft: null,
      gracePeriodEndsAt: null,
      isLocked: false,
      canCreateMore: false,
      message: 'Your 30-day free trial has expired. Subscribe to Starter ($2/mo for 5 projects) or Pro ($5/mo for 10 projects) with 180 Pay to continue creating and managing projects.',
      contactFormUrl: ENTERPRISE_FORM_URL,
    };
  }

  /**
   * Server-Side Enforcement: Verify if developer is authorized to create a new project.
   */
  static async assertCanCreateApp(
    userIds: string[],
    options: { enableAutoPay?: boolean; paymentSource?: string } = {}
  ): Promise<{ allowed: boolean; billing: DeveloperBillingStatus }> {
    const billing = await this.getBillingStatus(userIds);

    if (billing.isLocked) {
      const err: any = new Error(
        `Services Locked: Payment could not be collected. Please settle outstanding charges in Billing & Plans to unlock project creation.`
      );
      err.statusCode = 402;
      err.code = 'PAYMENT_REQUIRED';
      err.data = { reason: 'SERVICES_LOCKED', billing };
      throw err;
    }

    if (billing.status === 'TRIAL_EXPIRED') {
      const err: any = new Error(
        `Your 30-day free trial has expired. Please subscribe to Starter ($2/mo for 5 projects) or Pro ($5/mo for 10 projects) with 180 Pay to create new projects.`
      );
      err.statusCode = 402;
      err.code = 'PAYMENT_REQUIRED';
      err.data = { reason: 'TRIAL_EXPIRED', billing, contactFormUrl: ENTERPRISE_FORM_URL };
      throw err;
    }

    if (billing.totalProjects >= billing.maxProjectsAllowed) {
      let limitMsg = '';
      if (billing.planTier === 'PRO') {
        limitMsg = `Pro plan project limit reached (${DEV_PRO_MAX_PROJECTS} projects). For custom scaling and unlimited capacity, please contact us: ${ENTERPRISE_FORM_URL}`;
      } else if (billing.planTier === 'STARTER') {
        limitMsg = `Starter plan project limit reached (${DEV_STARTER_MAX_PROJECTS} projects). Upgrade to Pro ($5/mo for 10 projects) with 180 Pay to create more projects.`;
      } else {
        limitMsg = `Trial project limit reached (${DEV_STARTER_MAX_PROJECTS} projects). Upgrade to Pro ($5/mo for 10 projects) with 180 Pay to create more projects.`;
      }

      const err: any = new Error(limitMsg);
      err.statusCode = 402;
      err.code = 'LIMIT_REACHED';
      err.data = { reason: 'LIMIT_REACHED', billing, contactFormUrl: ENTERPRISE_FORM_URL };
      throw err;
    }

    return {
      allowed: true,
      billing,
    };
  }

  /**
   * Creates a 180 Pay checkout session for Starter ($2/mo) or Pro ($5/mo) subscription
   */
  static async createBillingCheckout(
    userId: string,
    planTier: 'STARTER' | 'PRO'
  ): Promise<{ sessionId: string; amount: number; currency: string; title: string; description: string; planTier: string; maxProjects: number }> {
    const isPro = planTier === 'PRO';
    const amount = isPro ? DEV_PRO_PRICE : DEV_STARTER_PRICE;
    const maxProjects = isPro ? DEV_PRO_MAX_PROJECTS : DEV_STARTER_MAX_PROJECTS;
    const title = isPro ? '180 Developer Portal — Pro Plan' : '180 Developer Portal — Starter Plan';
    const description = isPro ? '10 Projects Access with 180 Identity & 180 Pay' : '5 Projects Access with 180 Identity & 180 Pay';
    const sessionId = `sess_dev_${planTier.toLowerCase()}_${userId.slice(0, 8)}_${Date.now()}`;

    try {
      const { starter, pro } = await this.ensurePlans();
      const targetPlan = isPro ? pro : starter;

      await (prisma as any).checkoutSession.create({
        data: {
          id: sessionId,
          appId: targetPlan.appId,
          userId,
          amount,
          currency: 'USD',
          status: 'PENDING',
          mode: 'subscription',
          planId: targetPlan.id,
          billingInterval: 'MONTHLY',
          title,
          description,
          metadata: {
            planTier,
            userId,
            maxProjects,
            source: 'DEVELOPER_PORTAL_BILLING',
          },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    } catch (sessionErr: any) {
      console.warn('[DeveloperBillingService] Warning: Could not pre-create checkoutSession in DB:', sessionErr);
    }

    return {
      sessionId,
      amount,
      currency: 'USD',
      title,
      description,
      planTier,
      maxProjects,
    };
  }

  /**
   * Confirms payment and activates/renews developer subscription tier
   */
  static async confirmSubscription(
    userId: string,
    options: {
      planTier: 'STARTER' | 'PRO';
      sessionId?: string;
      transactionId?: string;
      paymentSource?: string;
    }
  ): Promise<any> {
    const { starter, pro } = await this.ensurePlans();
    const isPro = options.planTier === 'PRO';
    const targetPlan = isPro ? pro : starter;
    const targetAmount = isPro ? DEV_PRO_PRICE : DEV_STARTER_PRICE;
    const maxProjects = isPro ? DEV_PRO_MAX_PROJECTS : DEV_STARTER_MAX_PROJECTS;

    const existingSub = await (prisma as any).recurringSubscription.findFirst({
      where: {
        userId,
        planId: { in: [starter.id, pro.id] },
      },
    });

    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + 30);

    let subscription: any;

    if (existingSub) {
      subscription = await (prisma as any).recurringSubscription.update({
        where: { id: existingSub.id },
        data: {
          planId: targetPlan.id,
          status: 'ACTIVE',
          amount: targetAmount,
          nextBillingDate: nextBilling,
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextBilling,
          failedAttempts: 0,
          paymentSource: options.paymentSource || '180_PAY',
          lastPaymentId: options.transactionId || existingSub.lastPaymentId,
          metadata: {
            ...((existingSub.metadata as any) || {}),
            planTier: options.planTier,
            maxProjects,
            rate: targetAmount,
            lastSessionId: options.sessionId,
            activatedAt: new Date().toISOString(),
          },
        },
      });
    } else {
      subscription = await (prisma as any).recurringSubscription.create({
        data: {
          appId: targetPlan.appId,
          planId: targetPlan.id,
          userId,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          amount: targetAmount,
          currency: 'USD',
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextBilling,
          nextBillingDate: nextBilling,
          paymentSource: options.paymentSource || '180_PAY',
          lastPaymentId: options.transactionId || null,
          metadata: {
            planTier: options.planTier,
            maxProjects,
            rate: targetAmount,
            lastSessionId: options.sessionId,
            activatedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Unlock all developer projects
    await prisma.oAuthApp.updateMany({
      where: { userId },
      data: { isActive: true, enableAuth: true, enablePay: true },
    });

    return subscription;
  }

  /**
   * Backwards-compatible auto-pay activation
   */
  static async activateAutoPay(
    userId: string,
    options: { paymentSource?: string } = {}
  ): Promise<any> {
    return this.confirmSubscription(userId, {
      planTier: 'STARTER',
      paymentSource: options.paymentSource || 'WALLET_AUTOPAY',
    });
  }

  /**
   * Backwards-compatible manual settlement
   */
  static async settleManualPayment(userId: string): Promise<any> {
    const sub = await this.confirmSubscription(userId, {
      planTier: 'STARTER',
      paymentSource: 'MANUAL_SETTLE',
    });

    return {
      success: true,
      amountSettled: sub.amount,
      nextBillingDate: sub.nextBillingDate,
      message: `Payment of $${sub.amount.toFixed(2)} settled. All projects unlocked.`,
    };
  }

  /**
   * Automated Dunning & Lockout Hardening Worker
   */
  static async executeDunningCycle(): Promise<{ processed: number; lockedCount: number }> {
    const { starter, pro } = await this.ensurePlans();
    const subs = await (prisma as any).recurringSubscription.findMany({
      where: {
        planId: { in: [starter.id, pro.id] },
        status: { in: ['ACTIVE', 'WARNING_7_DAYS', 'GRACE_PERIOD'] },
      },
    });

    const now = new Date();
    let lockedCount = 0;

    for (const sub of subs) {
      const nextBilling = new Date(sub.nextBillingDate);
      const gracePeriodEndsAt = new Date(nextBilling.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      if (now > gracePeriodEndsAt) {
        await (prisma as any).recurringSubscription.update({
          where: { id: sub.id },
          data: { status: 'LOCKED' },
        });

        await prisma.oAuthApp.updateMany({
          where: { userId: sub.userId },
          data: { isActive: false, enableAuth: false, enablePay: false },
        });

        lockedCount++;
      } else if (now > nextBilling) {
        await (prisma as any).recurringSubscription.update({
          where: { id: sub.id },
          data: { status: 'GRACE_PERIOD' },
        });
      }
    }

    return {
      processed: subs.length,
      lockedCount,
    };
  }

  /**
   * Recalculates and adjusts subscription after app deletion
   */
  static async syncSubscriptionAfterAppDeletion(userIds: string[]): Promise<void> {
    // Keep subscription active according to selected tier (Starter or Pro)
  }
}
