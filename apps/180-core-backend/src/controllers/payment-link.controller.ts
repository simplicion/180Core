'use strict';

import { Request, Response } from 'express';
import { PaymentLinkService } from '@workspace/payment-provider';

export class PaymentLinkApiController {
  /**
   * GET /api/v1/payment-links/public/:slug
   * Public checkout resolution for a payment link slug.
   * Conceals fulfillment secret and checks availability.
   */
  static async getPublicPaymentLink(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug);
      const visitorCountry =
        (req.query.country as string) ||
        (req.headers['cf-ipcountry'] as string) ||
        (req.headers['x-country-code'] as string) ||
        (req.headers['x-vercel-ip-country'] as string);

      const link = await PaymentLinkService.getPublicPaymentLink(slug, visitorCountry);
      return res.status(200).json({ success: true, data: link, link });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:getPublicPaymentLink] Error:', err);
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/payment-links/public/:slug/view
   * Public telemetry endpoint: Records total views and 3-second qualified engagements.
   */
  static async recordLinkView(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug);
      const isQualified = Boolean(req.body.qualified || req.body.isQualified);
      const data = await PaymentLinkService.recordLinkView(slug, isQualified);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.warn('[PaymentLinkApiController:recordLinkView] Error:', err);
      return res.status(200).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/payment-links/apps/:appId
   * Developer endpoint: List all payment links for an app.
   */
  static async listPaymentLinks(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

      const result = await PaymentLinkService.listPaymentLinks(appId, { page, limit });
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:listPaymentLinks] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/payment-links/apps/:appId/:id
   * Developer endpoint: Fetch a single payment link with metrics.
   */
  static async getPaymentLinkById(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const linkId = String(req.params.id);

      const link = await PaymentLinkService.getPaymentLinkById(appId, linkId);
      return res.status(200).json({ success: true, data: link, link });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:getPaymentLinkById] Error:', err);
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/payment-links/apps/:appId
   * Developer endpoint: Create a new shareable payment link.
   */
  static async createPaymentLink(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const link = await PaymentLinkService.createPaymentLink(appId, req.body);
      return res.status(201).json({ success: true, data: link, link });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:createPaymentLink] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/v1/payment-links/apps/:appId/:id
   * Developer endpoint: Update an existing payment link.
   */
  static async updatePaymentLink(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const linkId = String(req.params.id);

      const link = await PaymentLinkService.updatePaymentLink(appId, linkId, req.body);
      return res.status(200).json({ success: true, data: link, link });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:updatePaymentLink] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/v1/payment-links/apps/:appId/:id
   * Developer endpoint: Archive or delete payment link.
   */
  static async deletePaymentLink(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const linkId = String(req.params.id);

      await PaymentLinkService.deletePaymentLink(appId, linkId);
      return res.status(200).json({ success: true, message: 'Payment link deleted successfully' });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:deletePaymentLink] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/payment-links/:id/fulfillment
   * Post-purchase delivery endpoint: Reveals secret/files only after verified payment.
   */
  static async getFulfillment(req: Request, res: Response) {
    try {
      const linkId = String(req.params.id);
      const sessionId = String(req.query.sessionId);

      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Checkout sessionId is required' });
      }

      const fulfillment = await PaymentLinkService.getFulfillmentData(linkId, sessionId);
      return res.status(200).json({ success: true, data: fulfillment, fulfillment });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:getFulfillment] Error:', err);
      return res.status(403).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/payment-links/:id/complete
   * Atomically marks payment completed, increments inventory, dispatches webhook, and returns fulfillment.
   */
  static async completePaymentLink(req: Request, res: Response) {
    try {
      const linkId = String(req.params.id);
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Checkout sessionId is required' });
      }

      const fulfillment = await PaymentLinkService.completeLinkPurchase(linkId, sessionId);
      return res.status(200).json({ success: true, data: fulfillment, fulfillment });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:completePaymentLink] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/payment-links/apps/:appId/gateway-qr
   * Generates dynamic live Gateway QR code (Razorpay/Stripe) for counter standees & mobile payments.
   */
  static async generateGatewayQr(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const { amount, currency, title, payeeName, linkId } = req.body || {};
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
      }

      const qrResult = await PaymentLinkService.generateGatewayQrCode(appId, {
        amount: numAmount,
        currency: currency || 'INR',
        title: title || 'Payment via 180 Pay QR',
        payeeName: payeeName || undefined,
        linkId: linkId || undefined,
      });

      return res.status(200).json({ success: true, ...qrResult, data: qrResult });
    } catch (err: any) {
      console.error('[PaymentLinkApiController:generateGatewayQr] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}

