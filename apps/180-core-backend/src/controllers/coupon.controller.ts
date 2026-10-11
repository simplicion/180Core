'use strict';

import { Request, Response } from 'express';
import { CouponService } from '@workspace/payment-provider';
import { developersPrisma as prisma } from '@workspace/db-180core';

export class CouponApiController {
  /**
   * Helper to extract calling origin from HTTP headers.
   */
  private static extractOrigin(req: Request): string {
    const rawOrigin = req.headers.origin || req.headers.referer;
    if (typeof rawOrigin === 'string') {
      return rawOrigin;
    }
    return '';
  }

  /**
   * POST /api/v1/coupons/validate
   * Public validation endpoint called by the 180 Pay checkout modal.
   * Performs 100% server-side checks and evaluates origin whitelists.
   */
  static async validateCoupon(req: Request, res: Response) {
    try {
      const { appId, customerEmail, planId } = req.body;
      const rawCode = req.body.code || req.body.couponCode;
      const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
      const rawAmount = req.body.orderAmount !== undefined ? req.body.orderAmount : req.body.amount;

      if (!appId) {
        return res.status(400).json({ success: false, error: 'Application ID (appId) is required' });
      }
      if (!code) {
        return res.status(400).json({ success: false, error: 'Coupon code is required' });
      }
      if (rawAmount === undefined || isNaN(Number(rawAmount))) {
        return res.status(400).json({ success: false, error: 'Valid order amount is required' });
      }

      const origin = CouponApiController.extractOrigin(req);

      const result = await CouponService.validateCoupon({
        appId: String(appId),
        code: String(code),
        orderAmount: Number(rawAmount),
        customerEmail: customerEmail ? String(customerEmail) : undefined,
        origin,
        planId: planId ? String(planId) : undefined,
      });

      if (!result.valid) {
        return res.status(200).json({
          success: false,
          error: result.error,
          reasonCode: result.reasonCode,
          data: result,
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
        ...result,
      });
    } catch (err: any) {
      console.error('[CouponApiController:validateCoupon] Error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/v1/coupons/apps/:appId
   * Developer endpoint: List all coupons for an app.
   */
  static async listCoupons(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

      const result = await CouponService.listCoupons(appId, { page, limit });
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      console.error('[CouponApiController:listCoupons] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/coupons/apps/:appId
   * Developer endpoint: Create a new promotional coupon.
   */
  static async createCoupon(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const coupon = await CouponService.createCoupon(appId, req.body);
      return res.status(201).json({ success: true, data: coupon, coupon });
    } catch (err: any) {
      console.error('[CouponApiController:createCoupon] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/v1/coupons/apps/:appId/:id
   * Developer endpoint: Update an existing coupon.
   */
  static async updateCoupon(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const couponId = String(req.params.id);
      const coupon = await CouponService.updateCoupon(appId, couponId, req.body);
      return res.status(200).json({ success: true, data: coupon, coupon });
    } catch (err: any) {
      console.error('[CouponApiController:updateCoupon] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/v1/coupons/apps/:appId/:id
   * Developer endpoint: Delete a coupon.
   */
  static async deleteCoupon(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const couponId = String(req.params.id);
      await CouponService.deleteCoupon(appId, couponId);
      return res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
    } catch (err: any) {
      console.error('[CouponApiController:deleteCoupon] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/coupons/apps/:appId/:id/redemptions
   * Developer endpoint: View redemption history audit log.
   */
  static async getCouponRedemptions(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const couponId = String(req.params.id);
      const redemptions = await CouponService.getCouponRedemptions(appId, couponId);
      return res.status(200).json({ success: true, data: redemptions, redemptions });
    } catch (err: any) {
      console.error('[CouponApiController:getCouponRedemptions] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
