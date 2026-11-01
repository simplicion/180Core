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

    if (!amount || amount < 1) {
      throw new Error('Minimum payout request amount is ₹1.00');
    }

    if (payoutMethod === 'UPI' && (!accountDetails?.upiId || accountDetails.upiId.trim().length < 3)) {
      throw new Error('A valid UPI ID / VPA is required for instant UPI withdrawal');
    }

    if (
      payoutMethod === 'BANK_TRANSFER' &&
      (!accountDetails?.accountNumber || !accountDetails?.ifscCode || !accountDetails?.accountHolderName)
    ) {
      throw new Error('Account number, IFSC code, and account holder name are required for bank transfer');
    }

    // 1. Verify app ownership
    const app = await prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });

    if (!app) {
      throw new Error('OAuth Application not found or access unauthorized');
    }

    // 2. Calculate true available withdrawable balance
    // Net volume (Gross - 1.5% Fee) MINUS any existing non-rejected payouts
    const checkouts = await prisma.checkoutSession.findMany({
      where: { appId, status: { in: ['CAPTURED', 'SUCCESS'] } },
      select: { amount: true },
    });
    const grossVolume = checkouts.reduce((sum, c) => sum + c.amount, 0);
    const platformFee = Math.round(grossVolume * 0.015 * 100) / 100;
    const netMerchantVolume = Math.round((grossVolume - platformFee) * 100) / 100;

    const existingPayouts = await prisma.payoutRequest.findMany({
      where: { appId, status: { not: 'REJECTED' } },
      select: { amount: true },
    });
    const currentTotalWithdrawn = existingPayouts.reduce((sum, p) => sum + p.amount, 0);
    const availableWithdrawable = Math.max(0, Math.round((netMerchantVolume - currentTotalWithdrawn) * 100) / 100);

    if (amount > availableWithdrawable) {
      throw new Error(
        `Insufficient available withdrawable balance. You have ₹${availableWithdrawable.toFixed(2)} available for withdrawal.`
      );
    }

    // 3. App Wallet
    const appWallet = await IdentityWalletService.getOrCreateAppWallet(appId);

    // 4. Atomically deduct balance, create Payout Request, and record Ledger entry
    const result = await prisma.$transaction(async (tx: any) => {
      const newRemainingBalance = Math.max(
        0,
        Math.round((availableWithdrawable - amount) * 100) / 100
      );

      await tx.wallet.update({
        where: { id: appWallet.id },
        data: { balance: newRemainingBalance },
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

      const destLabel =
        payoutMethod === 'UPI'
          ? `UPI (${accountDetails?.upiId?.trim() || 'VPA'})`
          : `Bank A/C ending ${accountDetails?.accountNumber?.slice(-4) || '****'}`;

      await tx.ledgerEntry.create({
        data: {
          walletId: appWallet.id,
          amount: -amount,
          balanceAfter: newRemainingBalance,
          type: 'PAYOUT',
          referenceId: payout.id,
          description: `Payout Withdrawal Request #${payout.id.slice(0, 8)} to ${destLabel}`,
          metadata: {
            payoutId: payout.id,
            payoutMethod,
            accountDetails,
          },
        },
      });

      return { payout, newRemainingBalance };
    });

    return {
      success: true,
      payoutId: result.payout.id,
      amount: result.payout.amount,
      status: result.payout.status,
      remainingBalance: result.newRemainingBalance,
      requestedAt: result.payout.requestedAt,
    };
  }

  /**
   * List payout requests and transaction ledger for a developer application
   */
  static async listPayouts(appId: string, userId: string) {
    const app = await prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });

    if (!app) {
      throw new Error('OAuth Application not found or access unauthorized');
    }

    const appWallet = await IdentityWalletService.getOrCreateAppWallet(appId);

    // 1. Calculate Gross Volume and 180 Pay Split
    const checkouts = await prisma.checkoutSession.findMany({
      where: { appId, status: { in: ['CAPTURED', 'SUCCESS'] } },
      select: { amount: true },
    });

    const grossVolume = Math.round(checkouts.reduce((sum, c) => sum + c.amount, 0) * 100) / 100;
    const platformFee = Math.round(grossVolume * 0.015 * 100) / 100;
    const netMerchantVolume = Math.round((grossVolume - platformFee) * 100) / 100;

    // 2. Fetch all Payout Requests
    const payouts = await prisma.payoutRequest.findMany({
      where: { appId },
      orderBy: { requestedAt: 'desc' },
    });

    const totalWithdrawn = payouts
      .filter((p) => p.status !== 'REJECTED')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPaidOut = payouts
      .filter((p) => p.status === 'PAID' || p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalPendingPayouts = payouts
      .filter((p) => ['PENDING_REVIEW', 'PROCESSING', 'APPROVED'].includes(p.status))
      .reduce((sum, p) => sum + p.amount, 0);

    const roundedTotalWithdrawn = Math.round(totalWithdrawn * 100) / 100;
    const withdrawableBalance = Math.max(0, Math.round((netMerchantVolume - roundedTotalWithdrawn) * 100) / 100);

    // Keep app wallet balance in sync with true available withdrawable balance
    if (Math.abs(appWallet.balance - withdrawableBalance) > 0.01) {
      await prisma.wallet.update({
        where: { id: appWallet.id },
        data: { balance: withdrawableBalance },
      });
      appWallet.balance = withdrawableBalance;
    }

    // 3. Fetch Double-Entry Ledger Entries
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { walletId: appWallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      success: true,
      grossVolume,
      platformFee,
      netMerchantVolume,
      totalWithdrawn: roundedTotalWithdrawn,
      totalPaidOut: Math.round(totalPaidOut * 100) / 100,
      totalPendingPayouts: Math.round(totalPendingPayouts * 100) / 100,
      availableBalance: withdrawableBalance,
      withdrawableBalance,
      currency: appWallet.currency,
      payouts,
      ledgerEntries,
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

  /**
   * Developer confirms they received the settled payout funds
   */
  static async confirmPayoutReceipt(appId: string, userId: string, payoutId: string) {
    const app = await prisma.oAuthApp.findFirst({
      where: { id: appId, userId },
    });
    if (!app) {
      throw new Error('OAuth Application not found or access unauthorized');
    }

    const payout = await prisma.payoutRequest.findFirst({
      where: { id: payoutId, appId },
    });
    if (!payout) {
      throw new Error('Payout request not found');
    }

    const currentDetails = (payout.accountDetails as any) || {};
    const updatedDetails = {
      ...currentDetails,
      receivedConfirmed: true,
      receivedConfirmedAt: new Date().toISOString(),
    };

    const updated = await prisma.payoutRequest.update({
      where: { id: payout.id },
      data: {
        accountDetails: updatedDetails,
      },
    });

    return { success: true, payout: updated };
  }
}
