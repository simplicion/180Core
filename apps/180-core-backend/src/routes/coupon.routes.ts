'use strict';

import express from 'express';
import { CouponApiController } from '../controllers/coupon.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// ─── Public Checkout Modal Validation ───────────────────────────────────────
router.post('/validate', CouponApiController.validateCoupon);

// ─── Developer Management Endpoints ─────────────────────────────────────────
router.get('/apps/:appId', protect, CouponApiController.listCoupons);
router.post('/apps/:appId', protect, CouponApiController.createCoupon);
router.put('/apps/:appId/:id', protect, CouponApiController.updateCoupon);
router.delete('/apps/:appId/:id', protect, CouponApiController.deleteCoupon);
router.get('/apps/:appId/:id/redemptions', protect, CouponApiController.getCouponRedemptions);

export default router;
