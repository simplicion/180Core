'use strict';

import type { Request, Response } from 'express';
import { CheckoutService } from './checkout.service';
import { IdentityWalletService } from '../wallet/identity-wallet.service';
import { PayoutService } from '../payout/payout.service';

export class IdentityPaymentController {
  /**
   * POST /api/v1/identity/checkout/sessions
   * 3rd-Party Developer API to initiate checkout
   */
  static async createCheckoutSession(req: Request, res: Response) {
    try {
      const {
        clientId,
        clientSecret,
        amount,
        currency,
        title,
        description,
        returnUrl,
        cancelUrl,
        metadata,
      } = req.body;

      if (!clientId || !clientSecret) {
        return res.status(400).json({
          success: false,
          error: 'clientId and clientSecret are required in request body',
        });
      }

      const session = await CheckoutService.createSession({
        clientId,
        clientSecret,
        amount: Number(amount),
        currency,
        title,
        description,
        returnUrl,
        cancelUrl,
        metadata,
      });

      return res.status(201).json({ success: true, data: session });
    } catch (err: any) {
      console.error('[IdentityPaymentController:createCheckoutSession] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/identity/checkout/sessions/:id
   * Public endpoint for the popup checkout UI
   */
  static async getCheckoutSession(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const session = await CheckoutService.getSession(id);
      return res.json({ success: true, data: session });
    } catch (err: any) {
      console.error('[IdentityPaymentController:getCheckoutSession] Error:', err);
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/identity/checkout/sessions/:id/pay
   * Authenticated user authorizes and completes payment
   */
  static async payCheckoutSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = String(req.params.id);
      const result = await CheckoutService.processPayment(id, userId);

      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[IdentityPaymentController:payCheckoutSession] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // USER WALLET ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/identity/wallet
   */
  static async getUserWallet(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const wallet = await IdentityWalletService.getOrCreateUserWallet(userId);
      return res.json({
        success: true,
        data: {
          balance: wallet.balance,
          currency: wallet.currency,
          isLocked: wallet.isLocked,
          recentEntries: wallet.ledgerEntries,
        },
      });
    } catch (err: any) {
      console.error('[IdentityPaymentController:getUserWallet] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/identity/wallet/topup/order
   */
  static async createTopupOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { amount, currency } = req.body;
      const order = await IdentityWalletService.createTopupOrder(userId, Number(amount), currency);

      return res.json({ success: true, data: order });
    } catch (err: any) {
      console.error('[IdentityPaymentController:createTopupOrder] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/identity/wallet/topup/verify
   */
  static async verifyTopup(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { orderId, paymentId, signature, amount } = req.body;
      const result = await IdentityWalletService.verifyAndCreditTopup(
        userId,
        orderId,
        paymentId,
        signature,
        Number(amount)
      );

      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[IdentityPaymentController:verifyTopup] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/identity/wallet/ledger
   */
  static async getLedger(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { limit, page } = req.query;
      const data = await IdentityWalletService.getUserLedger(
        userId,
        limit ? Number(limit) : 50,
        page ? Number(page) : 1
      );

      return res.json({ success: true, data });
    } catch (err: any) {
      console.error('[IdentityPaymentController:getLedger] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DEVELOPER PAYOUT ENDPOINTS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/identity/developer/apps/:appId/payouts
   */
  static async requestPayout(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const appId = String(req.params.appId);
      const { amount, payoutMethod, accountDetails } = req.body;

      const result = await PayoutService.requestPayout({
        userId,
        appId,
        amount: Number(amount),
        payoutMethod,
        accountDetails,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[IdentityPaymentController:requestPayout] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/identity/developer/apps/:appId/payouts
   */
  static async listPayouts(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const appId = String(req.params.appId);
      const result = await PayoutService.listPayouts(appId, userId);

      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[IdentityPaymentController:listPayouts] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
