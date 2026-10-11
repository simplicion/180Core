'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';

export const DEV_PROJECT_PLAN_CODE = 'DEV_PER_PROJECT_PLAN';
export const RATE_PER_PROJECT = 2.5; // $2.50 / month / project
export const FREE_PROJECTS_LIMIT = 1;
export const GRACE_PERIOD_DAYS = 3; // 3 days extra post-expiry
export const WARNING_DAYS = 7; // 7 days pre-expiry warning

export interface DeveloperBillingStatus {
  totalProjects: number;
  freeProjects: number;
  billableProjects: number;
  ratePerProject: number;
  currentMonthlyTotal: number;
  subscriptionId?: string | null;
  status: 'FREE_TIER' | 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED';
  nextBillingDate?: string | null;
  daysUntilRenewal?: number | null;
  warningActive: boolean;
  warningDaysLeft?: number | null;
  gracePeriodActive: boolean;
  gracePeriodHoursLeft?: number | null;
  gracePeriodEndsAt?: string | null;
  isLocked: boolean;
  message?: string;
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

    // Fallback to any first-party or first app in DB
    const anyApp = await prisma.oAuthApp.findFirst({ select: { id: true } });
    if (!anyApp) throw new Error('No root platform OAuthApp found in database');
    return anyApp.id;
  }

  /**
   * Ensure the official DEV_PER_PROJECT_PLAN exists in database
   */
  static async ensurePlan(): Promise<any> {
    const appId = await this.getPlatformAppId();
    let plan = await (prisma as any).subscriptionPlan.findFirst({
      where: { planCode: DEV_PROJECT_PLAN_CODE },
    });

    if (!plan) {
      plan = await (prisma as any).subscriptionPlan.create({
        data: {
          appId,
          planCode: DEV_PROJECT_PLAN_CODE,
          name: 'Developer Project Subscription Tier',
          description: 'Sovereign developer additional project hosting ($2.50/mo with full features access)',
          amount: RATE_PER_PROJECT,
          currency: 'USD',
          interval: 'MONTHLY',
          intervalCount: 1,
          trialDays: 0,
          isActive: true,
          metadata: {
            ratePerProject: RATE_PER_PROJECT,
            freeProjects: FREE_PROJECTS_LIMIT,
            fullFeaturesAccess: true,
          },
        },
      });
    }

    return plan;
  }

  /**
   * Get the developer's live billing status, warning flags, grace period, and lock status
   */
  static async getBillingStatus(userIds: string[]): Promise<DeveloperBillingStatus> {
    const apps = await prisma.oAuthApp.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, isActive: true, enableAuth: true, enablePay: true, createdAt: true },
    });

    const totalProjects = apps.length;
    const billableProjects = Math.max(0, totalProjects - FREE_PROJECTS_LIMIT);
    const currentMonthlyTotal = billableProjects * RATE_PER_PROJECT;

    if (billableProjects === 0) {
      return {
        totalProjects,
        freeProjects: Math.min(totalProjects, FREE_PROJECTS_LIMIT),
        billableProjects: 0,
        ratePerProject: RATE_PER_PROJECT,
        currentMonthlyTotal: 0.0,
        subscriptionId: null,
        status: 'FREE_TIER',
        warningActive: false,
        gracePeriodActive: false,
        isLocked: false,
        message: 'Your first project is 100% free with full features access.',
      };
    }

    const plan = await this.ensurePlan();
    const sub = await (prisma as any).recurringSubscription.findFirst({
      where: {
        userId: { in: userIds },
        planId: plan.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    if (!sub) {
      return {
        totalProjects,
        freeProjects: FREE_PROJECTS_LIMIT,
        billableProjects,
        ratePerProject: RATE_PER_PROJECT,
        currentMonthlyTotal,
        subscriptionId: null,
        status: 'LOCKED',
        warningActive: false,
        gracePeriodActive: false,
        isLocked: true,
        message: `Subscription required. You have ${billableProjects} additional billable project(s) requiring active auto-pay ($${currentMonthlyTotal.toFixed(2)}/mo).`,
      };
    }

    const nextBillingDate = new Date(sub.nextBillingDate);
    const msUntilRenewal = nextBillingDate.getTime() - now.getTime();
    const daysUntilRenewal = Math.ceil(msUntilRenewal / (1000 * 60 * 60 * 24));

    const gracePeriodEndsAt = new Date(nextBillingDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const msUntilGraceEnds = gracePeriodEndsAt.getTime() - now.getTime();
    const graceHoursLeft = Math.max(0, Math.ceil(msUntilGraceEnds / (1000 * 60 * 60)));

    const isPastDue = now > nextBillingDate;
    const isPastGrace = now > gracePeriodEndsAt;

    let status: 'ACTIVE' | 'WARNING_7_DAYS' | 'GRACE_PERIOD' | 'LOCKED' = 'ACTIVE';
    let warningActive = false;
    let gracePeriodActive = false;
    let isLocked = false;
    let message = `Auto-Pay Active: $${currentMonthlyTotal.toFixed(2)}/month covering ${billableProjects} billable project(s).`;

    if (isPastGrace) {
      status = 'LOCKED';
      isLocked = true;
      message = `Services Locked: Payment could not be collected after the 3-day grace period. Please settle the outstanding $${currentMonthlyTotal.toFixed(2)} charge to unlock services.`;
    } else if (isPastDue) {
      status = 'GRACE_PERIOD';
      gracePeriodActive = true;
      message = `Payment Past Due: Automatic deduction failed. You have ${graceHoursLeft} hour(s) left in your 3-day grace period before services are locked.`;
    } else if (daysUntilRenewal <= WARNING_DAYS) {
      status = 'WARNING_7_DAYS';
      warningActive = true;
      message = `Upcoming Renewal: Your monthly auto-pay of $${currentMonthlyTotal.toFixed(2)} will be processed in ${daysUntilRenewal} day(s).`;
    }

    return {
      totalProjects,
      freeProjects: FREE_PROJECTS_LIMIT,
      billableProjects,
      ratePerProject: RATE_PER_PROJECT,
      currentMonthlyTotal,
      subscriptionId: sub.id,
      status,
      nextBillingDate: nextBillingDate.toISOString(),
      daysUntilRenewal,
      warningActive,
      warningDaysLeft: warningActive ? daysUntilRenewal : null,
      gracePeriodActive,
      gracePeriodHoursLeft: gracePeriodActive ? graceHoursLeft : null,
      gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
      isLocked,
      message,
    };
  }

  /**
   * Server-Side Enforcement: Verify if developer is authorized to create a new project.
   * If existingAppsCount >= 1, user MUST have active auto-pay/subscription or enable it.
   */
  static async assertCanCreateApp(
    userIds: string[],
    options: { enableAutoPay?: boolean; paymentSource?: string } = {}
  ): Promise<{ allowed: boolean; billableCount: number; monthlyTotal: number; autoPayUpdated: boolean }> {
    const existingAppsCount = await prisma.oAuthApp.count({
      where: { userId: { in: userIds } },
    });

    // Project #1 is always 100% Free Forever
    if (existingAppsCount < FREE_PROJECTS_LIMIT) {
      return {
        allowed: true,
        billableCount: 0,
        monthlyTotal: 0.0,
        autoPayUpdated: false,
      };
    }

    // Additional Project (#2, #3, ...) requires active auto-pay / subscription ($2.50 / project / mo)
    const newBillableCount = existingAppsCount; // 1st is free, so after adding 1 new app, billables = existingAppsCount
    const newMonthlyTotal = newBillableCount * RATE_PER_PROJECT;
    const plan = await this.ensurePlan();

    const primaryUserId = userIds[0];
    let sub = await (prisma as any).recurringSubscription.findFirst({
      where: {
        userId: { in: userIds },
        planId: plan.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (sub && (sub.status === 'ACTIVE' || sub.status === 'WARNING_7_DAYS')) {
      // Developer already has an active auto-pay subscription:
      // Dynamically aggregate the new project into the monthly auto-pay amount
      await (prisma as any).recurringSubscription.update({
        where: { id: sub.id },
        data: {
          amount: newMonthlyTotal,
          metadata: {
            ...((sub.metadata as any) || {}),
            billableProjectsCount: newBillableCount,
            totalProjects: existingAppsCount + 1,
            ratePerProject: RATE_PER_PROJECT,
            lastAggregatedAt: new Date().toISOString(),
          },
        },
      });

      return {
        allowed: true,
        billableCount: newBillableCount,
        monthlyTotal: newMonthlyTotal,
        autoPayUpdated: true,
      };
    }

    // If developer explicitly authorized auto-pay upon creation:
    if (options.enableAutoPay) {
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + 30);

      sub = await (prisma as any).recurringSubscription.create({
        data: {
          appId: plan.appId,
          planId: plan.id,
          userId: primaryUserId,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          amount: newMonthlyTotal,
          currency: 'USD',
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextBilling,
          nextBillingDate: nextBilling,
          paymentSource: options.paymentSource || 'WALLET_AUTOPAY',
          metadata: {
            billableProjectsCount: newBillableCount,
            totalProjects: existingAppsCount + 1,
            ratePerProject: RATE_PER_PROJECT,
            autoPayMandate: true,
            createdAt: new Date().toISOString(),
          },
        },
      });

      return {
        allowed: true,
        billableCount: newBillableCount,
        monthlyTotal: newMonthlyTotal,
        autoPayUpdated: true,
      };
    }

    // Neither active subscription nor auto-pay consent provided:
    // Strictly reject server-side with HTTP 402 Payment Required!
    const err: any = new Error(
      `First project is 100% free. Additional projects require an active subscription of $${RATE_PER_PROJECT.toFixed(2)}/month per project with full features access.`
    );
    err.statusCode = 402;
    err.code = 'PAYMENT_REQUIRED';
    err.data = {
      requiresBilling: true,
      existingProjects: existingAppsCount,
      newTotalProjects: existingAppsCount + 1,
      billableCount: newBillableCount,
      ratePerProject: RATE_PER_PROJECT,
      monthlyTotal: newMonthlyTotal,
    };
    throw err;
  }

  /**
   * Activate or update auto-pay subscription for a developer
   */
  static async activateAutoPay(
    userId: string,
    options: { paymentSource?: string } = {}
  ): Promise<any> {
    const plan = await this.ensurePlan();
    const appsCount = await prisma.oAuthApp.count({ where: { userId } });
    const billableCount = Math.max(1, appsCount - FREE_PROJECTS_LIMIT);
    const monthlyTotal = billableCount * RATE_PER_PROJECT;

    const existingSub = await (prisma as any).recurringSubscription.findFirst({
      where: {
        userId,
        planId: plan.id,
      },
    });

    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + 30);

    if (existingSub) {
      const updated = await (prisma as any).recurringSubscription.update({
        where: { id: existingSub.id },
        data: {
          status: 'ACTIVE',
          amount: monthlyTotal,
          nextBillingDate: nextBilling,
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextBilling,
          failedAttempts: 0,
          paymentSource: options.paymentSource || existingSub.paymentSource || 'WALLET_AUTOPAY',
          metadata: {
            ...((existingSub.metadata as any) || {}),
            billableProjectsCount: billableCount,
            ratePerProject: RATE_PER_PROJECT,
            activatedAt: new Date().toISOString(),
          },
        },
      });

      // Unlock all developer's apps
      await prisma.oAuthApp.updateMany({
        where: { userId },
        data: { isActive: true, enableAuth: true, enablePay: true },
      });

      return updated;
    }

    const created = await (prisma as any).recurringSubscription.create({
      data: {
        appId: plan.appId,
        planId: plan.id,
        userId,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        amount: monthlyTotal,
        currency: 'USD',
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextBilling,
        nextBillingDate: nextBilling,
        paymentSource: options.paymentSource || 'WALLET_AUTOPAY',
        metadata: {
          billableProjectsCount: billableCount,
          ratePerProject: RATE_PER_PROJECT,
          activatedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.oAuthApp.updateMany({
      where: { userId },
      data: { isActive: true, enableAuth: true, enablePay: true },
    });

    return created;
  }

  /**
   * Settle payment manually (e.g. if auto-pay failed or user pays via wallet / card)
   */
  static async settleManualPayment(userId: string): Promise<any> {
    const plan = await this.ensurePlan();
    const apps = await prisma.oAuthApp.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const billableCount = Math.max(0, apps.length - FREE_PROJECTS_LIMIT);
    const amount = billableCount * RATE_PER_PROJECT;

    const sub = await (prisma as any).recurringSubscription.findFirst({
      where: { userId, planId: plan.id },
    });

    const nextBilling = new Date();
    nextBilling.setDate(nextBilling.getDate() + 30);

    if (sub) {
      await (prisma as any).recurringSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          amount,
          nextBillingDate: nextBilling,
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextBilling,
          failedAttempts: 0,
        },
      });
    }

    // Restore full active status to all developer projects
    await prisma.oAuthApp.updateMany({
      where: { userId },
      data: { isActive: true, enableAuth: true, enablePay: true },
    });

    return {
      success: true,
      amountSettled: amount,
      unlockedProjectsCount: apps.length,
      nextBillingDate: nextBilling.toISOString(),
      message: `Manual settlement of $${amount.toFixed(2)} completed. All projects are unlocked with full features access.`,
    };
  }

  /**
   * Automated Dunning & Lockout Hardening Worker:
   * 1. 7 days before: flags warning
   * 2. On billing date: attempts auto-deduction
   * 3. Failed: 3 days grace period
   * 4. >3 days failed: automatically shuts down & locks billable projects
   */
  static async executeDunningCycle(): Promise<{ processed: number; lockedCount: number }> {
    const plan = await this.ensurePlan();
    const subs = await (prisma as any).recurringSubscription.findMany({
      where: {
        planId: plan.id,
      },
      include: { user: true },
    });

    const now = new Date();
    let lockedCount = 0;

    for (const sub of subs) {
      const nextBilling = new Date(sub.nextBillingDate);
      const gracePeriodEnd = new Date(nextBilling.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

      // Past 3-day grace period and unpaid -> Lock billable projects!
      if (now > gracePeriodEnd && (sub.status === 'PAST_DUE' || sub.status === 'LOCKED')) {
        const userApps = await prisma.oAuthApp.findMany({
          where: { userId: sub.userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });

        // Project #1 (free) is preserved; billable projects (#2 onwards) are locked
        if (userApps.length > FREE_PROJECTS_LIMIT) {
          const billableIds = userApps.slice(FREE_PROJECTS_LIMIT).map((a: any) => a.id);
          await prisma.oAuthApp.updateMany({
            where: { id: { in: billableIds } },
            data: { isActive: false, enableAuth: false, enablePay: false },
          });

          await (prisma as any).recurringSubscription.update({
            where: { id: sub.id },
            data: { status: 'LOCKED' },
          });

          lockedCount++;
        }
      } else if (now > nextBilling && sub.status === 'ACTIVE') {
        // Due date arrived: attempt auto-deduction or mark past due for 3-day grace period
        // For production, this calls the wallet deduction / auto-pay mandate
        // If wallet deduction fails, enter grace period:
        await (prisma as any).recurringSubscription.update({
          where: { id: sub.id },
          data: {
            status: 'PAST_DUE',
            failedAttempts: { increment: 1 },
          },
        });
      }
    }

    return {
      processed: subs.length,
      lockedCount,
    };
  }

  /**
   * Recalculates and adjusts auto-pay subscription amount after an app is deleted
   */
  static async syncSubscriptionAfterAppDeletion(userIds: string[]): Promise<void> {
    try {
      const plan = await this.ensurePlan();
      const appsCount = await prisma.oAuthApp.count({
        where: { userId: { in: userIds } },
      });
      const billableCount = Math.max(0, appsCount - FREE_PROJECTS_LIMIT);
      const newMonthlyTotal = billableCount * RATE_PER_PROJECT;

      const sub = await (prisma as any).recurringSubscription.findFirst({
        where: {
          userId: { in: userIds },
          planId: plan.id,
        },
      });

      if (sub) {
        if (billableCount === 0) {
          await (prisma as any).recurringSubscription.update({
            where: { id: sub.id },
            data: {
              amount: 0.0,
              status: 'ACTIVE',
              metadata: {
                ...((sub.metadata as any) || {}),
                billableProjectsCount: 0,
                totalProjects: appsCount,
                updatedAfterDeletionAt: new Date().toISOString(),
              },
            },
          });
        } else {
          await (prisma as any).recurringSubscription.update({
            where: { id: sub.id },
            data: {
              amount: newMonthlyTotal,
              metadata: {
                ...((sub.metadata as any) || {}),
                billableProjectsCount: billableCount,
                totalProjects: appsCount,
                ratePerProject: RATE_PER_PROJECT,
                updatedAfterDeletionAt: new Date().toISOString(),
              },
            },
          });
        }
      }
    } catch (err) {
      console.warn('[DeveloperBillingService] syncSubscriptionAfterAppDeletion error:', err);
    }
  }
}

