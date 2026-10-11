'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { SubscriptionService } from './subscription.service';

export interface BillingCycleResult {
  processed: number;
  succeeded: number;
  failed: number;
  skippedRazorpayManaged: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

export class RecurringBillingEngine {
  /**
   * Evaluates all active subscriptions due for billing
   */
  static async runRecurringBillingCycle(): Promise<BillingCycleResult> {
    const now = new Date();
    const result: BillingCycleResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skippedRazorpayManaged: 0,
      errors: [],
    };

    try {
      const dueSubscriptions = await (prisma as any).recurringSubscription.findMany({
        where: {
          status: 'ACTIVE',
          nextBillingDate: { lte: now },
        },
        include: {
          plan: true,
          app: true,
        },
        take: 100,
      });

      for (const sub of dueSubscriptions) {
        result.processed++;
        try {
          // If the subscription is managed by Razorpay e-mandate, Razorpay initiates the auto-debit
          if (sub.paymentSource === 'RAZORPAY_RECURRING' && sub.razorpaySubscriptionId) {
            result.skippedRazorpayManaged++;
            continue;
          }

          await this.billSubscriptionViaWallet(sub);
          result.succeeded++;
        } catch (err: any) {
          result.failed++;
          result.errors.push({ subscriptionId: sub.id, error: err.message });
          await this.handlePaymentFailure(sub, err.message);
        }
      }
    } catch (cycleErr: any) {
      console.error('[RecurringBillingEngine] Critical cycle failure:', cycleErr);
      result.errors.push({ subscriptionId: 'SYSTEM', error: cycleErr.message });
    }

    return result;
  }

  /**
   * Executes atomic wallet deduction for sovereign wallet subscriptions
   */
  private static async billSubscriptionViaWallet(sub: any) {
    const userWallet = await (prisma as any).wallet.findUnique({
      where: { userId: sub.userId },
    });

    if (!userWallet || userWallet.balance < sub.amount) {
      throw new Error(`Insufficient wallet balance (Available: ${userWallet?.balance || 0}, Required: ${sub.amount})`);
    }

    let devWallet = await (prisma as any).wallet.findUnique({
      where: { developerAppId: sub.appId },
    });

    if (!devWallet) {
      devWallet = await (prisma as any).wallet.create({
        data: {
          developerAppId: sub.appId,
          balance: 0,
          currency: sub.currency,
        },
      });
    }

    const nextBillingDate = new Date(sub.nextBillingDate);
    if (sub.billingCycle === 'YEARLY') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else if (sub.billingCycle === 'WEEKLY') {
      nextBillingDate.setDate(nextBillingDate.getDate() + 7);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    const currentPeriodStart = new Date(sub.nextBillingDate);
    const currentPeriodEnd = nextBillingDate;

    await (prisma as any).$transaction(async (tx: any) => {
      // 1. Debit payer wallet
      const updatedUserWallet = await tx.wallet.update({
        where: { id: userWallet.id },
        data: { balance: { decrement: sub.amount } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: userWallet.id,
          amount: -sub.amount,
          balanceAfter: updatedUserWallet.balance,
          type: 'CHECKOUT_PAY',
          referenceId: sub.id,
          description: `Auto-renewal: ${sub.plan.name} (${sub.billingCycle})`,
          metadata: {
            subscriptionId: sub.id,
            planId: sub.planId,
            appId: sub.appId,
          },
        },
      });

      // 2. Credit developer app revenue wallet
      const updatedDevWallet = await tx.wallet.update({
        where: { id: devWallet.id },
        data: { balance: { increment: sub.amount } },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: devWallet.id,
          amount: sub.amount,
          balanceAfter: updatedDevWallet.balance,
          type: 'CHECKOUT_RECEIVE',
          referenceId: sub.id,
          description: `Subscription revenue: ${sub.plan.name}`,
          metadata: {
            subscriptionId: sub.id,
            planId: sub.planId,
            payerUserId: sub.userId,
          },
        },
      });

      // 3. Advance billing period
      await tx.recurringSubscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate,
          failedAttempts: 0,
        },
      });
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    // 4. Dispatch subscription.renewed webhook event
    SubscriptionService.dispatchSubscriptionWebhook(sub.appId, {
      event: 'subscription.renewed',
      data: {
        subscriptionId: sub.id,
        planCode: sub.plan.planCode,
        amount: sub.amount,
        currency: sub.currency,
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        status: 'ACTIVE',
        paymentSource: sub.paymentSource,
        userId: sub.userId,
        metadata: sub.metadata,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});
  }

  /**
   * Handles payment failure and status updates
   */
  private static async handlePaymentFailure(sub: any, errorMessage: string) {
    const updatedAttempts = (sub.failedAttempts || 0) + 1;
    const isPastDue = updatedAttempts >= 3;

    await (prisma as any).recurringSubscription.update({
      where: { id: sub.id },
      data: {
        failedAttempts: updatedAttempts,
        status: isPastDue ? 'PAST_DUE' : 'ACTIVE',
      },
    });

    SubscriptionService.dispatchSubscriptionWebhook(sub.appId, {
      event: 'subscription.payment_failed',
      data: {
        subscriptionId: sub.id,
        planCode: sub.plan.planCode,
        failedAttempts: updatedAttempts,
        status: isPastDue ? 'PAST_DUE' : 'ACTIVE',
        error: errorMessage,
        metadata: sub.metadata,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});
  }
}
