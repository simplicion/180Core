'use strict';

import { Request, Response, NextFunction } from 'express';
import { developersPrisma as prisma } from '@workspace/db-180core';

export const DAY_IN_MS = 24 * 60 * 60 * 1000; // Exactly 86,400,000 ms

/**
 * Calculates stacked expiration date for a Daily Pass or Monthly Subscription.
 * Stacking Logic: If user has remaining active time, new expiry is:
 *   ExpiresAt = Current Expiry + (Days * 86,400,000 ms)
 * Creators never lose already purchased hours.
 */
export function calculateStackedExpiry(currentExpiry: Date | string | null | undefined, days: number): Date {
  const now = Date.now();
  const currentExpiryTime = currentExpiry ? new Date(currentExpiry).getTime() : 0;
  const baseTime = currentExpiryTime > now ? currentExpiryTime : now;
  return new Date(baseTime + days * DAY_IN_MS);
}

/**
 * Stacks creator daily pass or monthly subscription hours onto a user's record.
 * Stacking Logic:
 *   - Daily Pass (e.g. 1-7 days): adds Days * 86,400,000 ms
 *   - Monthly: adds 30 days (720 hours = 30 * 86,400,000 ms)
 */
export async function stackCreatorPass(
  userId: string,
  days: number,
  planType: 'DAILY_PASS' | 'MONTHLY' = 'DAILY_PASS',
  appId?: string
): Promise<{ expiresAt: Date; previousExpiry: Date | null; daysAdded: number }> {
  const effectiveDays = planType === 'MONTHLY' ? 30 : days;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, securityPreferences: true },
  });

  if (!user) {
    throw new Error(`User #${userId} not found`);
  }

  // 1. Check existing pass in user preferences or active subscription
  const secPrefs = (user.securityPreferences as any) || {};
  const currentPass = secPrefs.creatorPass || {};
  let previousExpiry = currentPass.expiresAt ? new Date(currentPass.expiresAt) : null;

  // Also check if there's an active RecurringSubscription with currentPeriodEnd
  if (!previousExpiry || previousExpiry.getTime() <= Date.now()) {
    try {
      const activeSub = await prisma.recurringSubscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          currentPeriodEnd: { gt: new Date() },
          ...(appId ? { appId } : {}),
        },
        orderBy: { currentPeriodEnd: 'desc' },
      });
      if (activeSub) {
        previousExpiry = new Date(activeSub.currentPeriodEnd);
      }
    } catch (_) {}
  }

  const newExpiresAt = calculateStackedExpiry(previousExpiry, effectiveDays);

  const updatedCreatorPass = {
    planType,
    daysAdded: effectiveDays,
    expiresAt: newExpiresAt.toISOString(),
    lastRechargedAt: new Date().toISOString(),
    totalDaysPurchased: (Number(currentPass.totalDaysPurchased) || 0) + effectiveDays,
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      securityPreferences: {
        ...secPrefs,
        creatorPass: updatedCreatorPass,
      },
    },
  });

  // If appId is provided or an active pass subscription exists, keep RecurringSubscription synchronized
  try {
    const existingSub = await prisma.recurringSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        ...(appId ? { appId } : {}),
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    if (existingSub) {
      await prisma.recurringSubscription.update({
        where: { id: existingSub.id },
        data: {
          currentPeriodEnd: newExpiresAt,
          billingCycle: planType === 'MONTHLY' ? 'MONTHLY' : 'DAILY_PASS',
        },
      });
    }
  } catch (_) {}

  return {
    expiresAt: newExpiresAt,
    previousExpiry,
    daysAdded: effectiveDays,
  };
}

/**
 * Checks whether a user currently has an active pass or active recurring subscription.
 */
export async function getActiveCreatorAccessStatus(
  userId: string,
  appId?: string
): Promise<{
  hasActiveAccess: boolean;
  expiresAt: Date | null;
  remainingHours: number;
  source: 'DAILY_PASS' | 'RECURRING_SUBSCRIPTION' | 'NONE';
}> {
  if (!userId) {
    return { hasActiveAccess: false, expiresAt: null, remainingHours: 0, source: 'NONE' };
  }

  const now = Date.now();

  // 1. Check User securityPreferences for stacked Daily Pass or Pass record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, securityPreferences: true },
  });

  const secPrefs = (user?.securityPreferences as any) || {};
  const creatorPass = secPrefs.creatorPass;

  if (creatorPass && creatorPass.expiresAt) {
    const passExpiresAt = new Date(creatorPass.expiresAt);
    if (passExpiresAt.getTime() > now) {
      const remainingMs = passExpiresAt.getTime() - now;
      return {
        hasActiveAccess: true,
        expiresAt: passExpiresAt,
        remainingHours: Math.max(0, Math.round((remainingMs / (3600 * 1000)) * 10) / 10),
        source: 'DAILY_PASS',
      };
    }
  }

  // 2. Check RecurringSubscription table
  try {
    const activeSubscription = await prisma.recurringSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() },
        ...(appId ? { appId } : {}),
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    if (activeSubscription) {
      const subExpiresAt = new Date(activeSubscription.currentPeriodEnd);
      const remainingMs = subExpiresAt.getTime() - now;
      return {
        hasActiveAccess: true,
        expiresAt: subExpiresAt,
        remainingHours: Math.max(0, Math.round((remainingMs / (3600 * 1000)) * 10) / 10),
        source: 'RECURRING_SUBSCRIPTION',
      };
    }
  } catch (_) {}

  const lastExpiredDate = creatorPass?.expiresAt ? new Date(creatorPass.expiresAt) : null;
  return {
    hasActiveAccess: false,
    expiresAt: lastExpiredDate,
    remainingHours: 0,
    source: 'NONE',
  };
}

/**
 * Strict 24-Hour Daily Pass & Monthly Access Control Guard
 * Enforces creator access rules:
 *   - If ExpiresAt <= Date.now() (or no pass exists), blocks creation routes with HTTP 403 SUBSCRIPTION_EXPIRED.
 *   - Whitelists billing endpoints (/billing/status, /billing/plans, /billing/checkout, /billing/activate, /billing/pay-modal).
 */
export async function requireActiveSubscriptionOrPass(req: Request, res: Response, next: NextFunction) {
  try {
    const path = req.path.toLowerCase();

    // Billing endpoints remain unrestricted so creators can view plans and recharge without error
    const isWhitelistedBillingRoute =
      path.includes('/billing') ||
      path.includes('/checkout') ||
      path.includes('/plans') ||
      path.includes('/pay-modal') ||
      path.includes('/activate') ||
      path.includes('/status') ||
      path.includes('/webhooks');

    if (isWhitelistedBillingRoute) {
      return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication token required before verifying creator access.',
      });
    }

    const appId = req.params?.appId || (req.body?.appId as string) || undefined;
    const accessStatus = await getActiveCreatorAccessStatus(userId, appId);

    if (!accessStatus.hasActiveAccess) {
      return res.status(403).json({
        success: false,
        error: 'SUBSCRIPTION_EXPIRED',
        message:
          'Your active creator access pass or subscription has expired. Please recharge your daily pass or monthly subscription to continue using creator features.',
        expiresAt: accessStatus.expiresAt ? accessStatus.expiresAt.toISOString() : null,
        isExpired: true,
        action: 'UPGRADE_REQUIRED',
        billingUrl: '/billing/plans',
      });
    }

    // Attach verified access status to request object for downstream controllers
    (req as any).creatorAccess = accessStatus;
    return next();
  } catch (err: any) {
    console.error('[requireActiveSubscriptionOrPass] Guard error:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'Error verifying creator pass status.',
    });
  }
}
