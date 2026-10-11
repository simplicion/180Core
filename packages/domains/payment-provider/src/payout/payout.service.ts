'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { IdentityWalletService } from '../wallet/identity-wallet.service';

export interface CreatePayoutInput {
  userId: string;
  appId: string;
  amount: number;
  payoutMethod: 'UPI' | 'BANK_TRANSFER';
  accountDetails: {
    upiId?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
}

export class PayoutService {
  /**
   * Request a manual withdrawal of collected revenue
   */
  static async requestPayout(input: CreatePayoutInput) {
    const { userId, appId, amount, payoutMethod, accountDetails } = input;

    if (!amount || amount < 100) {
      throw new Error('Minimum payout request amount is ₹100');
    }

    // 1. Verify app ownership
    const app = await prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });

    if (!app) {
      throw new Error('OAuth Application not found or access unauthorized');
    }

    // 2. Check App Wallet Balance
    const appWallet = await IdentityWalletService.getOrCreateAppWallet(appId);
    if (appWallet.balance < amount) {
      throw new Error(
        `Insufficient available balance. You have ₹${appWallet.balance.toFixed(2)} in your app earnings.`
      );
    }

    // 3. Atomically deduct and create Payout Request
    const result = await prisma.$transaction(async (tx: any) => {
      const newBalance = Math.round((appWallet.balance - amount) * 100) / 100;

      await tx.wallet.update({
        where: { id: appWallet.id },
        data: { balance: newBalance },
      });

      const payout = await tx.payoutRequest.create({
        data: {
          appId,
          userId,
          amount,
          currency: 'INR',
          status: 'PENDING_REVIEW',
          payoutMethod,
          accountDetails: accountDetails as any,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: appWallet.id,
          amount: -amount,
          balanceAfter: newBalance,
          type: 'PAYOUT',
          referenceId: payout.id,
          description: `Payout Request #${payout.id.slice(0, 8)} to ${payoutMethod}`,
          metadata: {
            payoutId: payout.id,
            payoutMethod,
          },
        },
      });

      return { payout, newBalance };
    });

    return {
      success: true,
      payoutId: result.payout.id,
      amount: result.payout.amount,
      status: result.payout.status,
      remainingBalance: result.newBalance,
      requestedAt: result.payout.requestedAt,
    };
  }

  /**
   * List payout requests for a developer application
   */
  static async listPayouts(appId: string, userId: string) {
    const app = await prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });

    if (!app) {
      throw new Error('OAuth Application not found or access unauthorized');
    }

    const payouts = await prisma.payoutRequest.findMany({
      where: { appId },
      orderBy: { requestedAt: 'desc' },
    });

    const appWallet = await IdentityWalletService.getOrCreateAppWallet(appId);

    return {
      success: true,
      availableBalance: appWallet.balance,
      currency: appWallet.currency,
      payouts,
    };
  }

  /**
   * Admin: Approve/Complete or Reject a payout
   */
  static async adminUpdatePayout(
    payoutId: string,
    status: 'PAID' | 'REJECTED' | 'APPROVED' | 'PROCESSING',
    adminNote?: string,
    transactionRef?: string
  ) {
    const payout = await prisma.payoutRequest.findUnique({
      where: { id: payoutId },
      include: { app: true },
    });

    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status === 'PAID') {
      throw new Error('Payout has already been paid');
    }

    // If rejected, refund the money back to the developer app wallet
    if (status === 'REJECTED' && payout.status !== 'REJECTED') {
      await prisma.$transaction(async (tx: any) => {
        const appWallet = await tx.wallet.findUnique({
          where: { developerAppId: payout.appId },
        });

        if (appWallet) {
          const newBalance = Math.round((appWallet.balance + payout.amount) * 100) / 100;
          await tx.wallet.update({
            where: { id: appWallet.id },
            data: { balance: newBalance },
          });

          await tx.ledgerEntry.create({
            data: {
              walletId: appWallet.id,
              amount: payout.amount,
              balanceAfter: newBalance,
              type: 'REFUND',
              referenceId: payout.id,
              description: `Refund for Rejected Payout #${payout.id.slice(0, 8)}: ${adminNote || 'No reason specified'}`,
            },
          });
        }

        await tx.payoutRequest.update({
          where: { id: payoutId },
          data: {
            status: 'REJECTED',
            adminNote: adminNote || '',
            processedAt: new Date(),
          },
        });
      });

      return { success: true, status: 'REJECTED', message: 'Payout rejected and funds refunded to app wallet' };
    }

    const updated = await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status,
        adminNote: adminNote || payout.adminNote,
        transactionRef: transactionRef || payout.transactionRef,
        processedAt: status === 'PAID' ? new Date() : payout.processedAt,
      },
    });

    return { success: true, payout: updated };
  }
}
