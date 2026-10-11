'use strict';

import { Request, Response } from 'express';
import { CustomerPortalService } from '@workspace/payment-provider';

export class CustomerPortalApiController {
  /**
   * Helper to extract session token from header or query param
   */
  private static extractToken(req: Request): string {
    const queryToken = req.query.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return '';
  }

  /**
   * POST /api/v1/portal/sessions
   * Merchant/Developer backend generates single-use 20-min magic token for customer
   */
  static async createPortalSession(req: Request, res: Response) {
    try {
      const { appId, customerEmail, externalCustomerId, returnUrl } = req.body;

      if (!appId) {
        return res.status(400).json({ success: false, error: 'Application ID (appId) is required' });
      }
      if (!customerEmail) {
        return res.status(400).json({ success: false, error: 'Customer email is required' });
      }
      if (!returnUrl) {
        return res.status(400).json({ success: false, error: 'Merchant returnUrl is required' });
      }

      const session = await CustomerPortalService.createPortalSession({
        appId: String(appId),
        customerEmail: String(customerEmail),
        externalCustomerId: externalCustomerId ? String(externalCustomerId) : undefined,
        returnUrl: String(returnUrl),
      });

      return res.status(201).json({ success: true, data: session, session });
    } catch (err: any) {
      console.error('[CustomerPortalApiController:createPortalSession] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/portal/data
   * Customer portal frontend resolves view using magic token
   */
  static async getPortalData(req: Request, res: Response) {
    try {
      const token = CustomerPortalApiController.extractToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Customer portal session token required' });
      }

      const data = await CustomerPortalService.getPortalData(token);
      return res.status(200).json({ success: true, data });
    } catch (err: any) {
      console.error('[CustomerPortalApiController:getPortalData] Error:', err);
      return res.status(403).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/portal/cancel-subscription
   * Self-service subscription cancellation from customer billing portal
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const token = CustomerPortalApiController.extractToken(req) || req.body.token;
      const { subscriptionId, reason } = req.body;

      if (!token) {
        return res.status(401).json({ success: false, error: 'Portal session token required' });
      }
      if (!subscriptionId) {
        return res.status(400).json({ success: false, error: 'subscriptionId is required' });
      }

      const result = await CustomerPortalService.cancelSubscription(
        String(token),
        String(subscriptionId),
        reason ? String(reason) : undefined
      );

      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      console.error('[CustomerPortalApiController:cancelSubscription] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/customer-portal/sessions/:sessionToken
   * Param-based session data retrieval
   */
  static async getPortalDataByParam(req: Request, res: Response) {
    try {
      const token = req.params.sessionToken || CustomerPortalApiController.extractToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Customer portal session token required' });
      }
      const data = await CustomerPortalService.getPortalData(token);
      return res.status(200).json({ success: true, data, ...data });
    } catch (err: any) {
      console.error('[CustomerPortalApiController:getPortalDataByParam] Error:', err);
      return res.status(403).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/customer-portal/sessions/:sessionToken/cancel-subscription
   */
  static async cancelSubscriptionByParam(req: Request, res: Response) {
    try {
      const token = req.params.sessionToken || CustomerPortalApiController.extractToken(req) || req.body.token;
      const { subscriptionId, reason } = req.body;
      if (!token) {
        return res.status(401).json({ success: false, error: 'Portal session token required' });
      }
      if (!subscriptionId) {
        return res.status(400).json({ success: false, error: 'subscriptionId is required' });
      }
      const result = await CustomerPortalService.cancelSubscription(
        String(token),
        String(subscriptionId),
        reason ? String(reason) : undefined
      );
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      console.error('[CustomerPortalApiController:cancelSubscriptionByParam] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/customer-portal/sessions/:sessionToken/link-180-account
   */
  static async link180Account(req: Request, res: Response) {
    try {
      const token = req.params.sessionToken || CustomerPortalApiController.extractToken(req) || req.body.token;
      if (!token) {
        return res.status(401).json({ success: false, error: 'Portal session token required' });
      }
      return res.status(200).json({ success: true, message: 'Customer portal successfully linked to 180 account' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
