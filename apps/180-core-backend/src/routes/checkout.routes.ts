'use strict';

import express from 'express';
import { CheckoutApiController } from '../controllers/checkout.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';
import { checkoutVerifyLimiter, checkoutOrderLimiter } from '../middleware/rate-limiter.middleware';

const router = express.Router();

router.get('/platform-domain', CheckoutApiController.getPlatformDomain);
router.post('/sessions', checkoutOrderLimiter, optionalAuth, CheckoutApiController.createCheckoutSession);
router.post('/checkout-session', checkoutOrderLimiter, optionalAuth, CheckoutApiController.createCheckoutSession);
router.post('/checkout-sessions', checkoutOrderLimiter, optionalAuth, CheckoutApiController.createCheckoutSession);
router.get('/sessions/:id', CheckoutApiController.getCheckoutSession);
router.get('/methods', CheckoutApiController.getPaymentMethods);
router.get('/sessions/:id/methods', CheckoutApiController.getPaymentMethods);
router.post('/sessions/:id/pay', checkoutVerifyLimiter, protect, CheckoutApiController.payCheckoutSession);
router.post('/sessions/:id/direct-order', checkoutOrderLimiter, CheckoutApiController.createDirectOrder);
router.get('/sessions/:id/status', CheckoutApiController.checkSessionStatus);
router.post('/sessions/:id/direct-verify', checkoutVerifyLimiter, CheckoutApiController.verifyDirectPayment);
router.post('/sessions/:id/auto-verify', checkoutVerifyLimiter, CheckoutApiController.autoVerifyDirectUpi);
router.post('/sessions/:id/verify-upi', checkoutVerifyLimiter, CheckoutApiController.autoVerifyDirectUpi);
router.post('/upi-bank-webhook', checkoutVerifyLimiter, CheckoutApiController.ingestUpiBankWebhook);
router.post('/sessions/:id/direct-pay', checkoutVerifyLimiter, optionalAuth, CheckoutApiController.executeDirectPayment);
router.post('/sessions/:id/direct-execute', checkoutVerifyLimiter, optionalAuth, CheckoutApiController.executeDirectPayment);
router.post('/webhook', CheckoutApiController.handleWebhook);
router.post('/webhook/razorpay', CheckoutApiController.handleWebhook);
router.post('/razorpay-webhook', CheckoutApiController.handleWebhook);
router.post('/razorpay', CheckoutApiController.handleWebhook);
router.post('/sessions/:id/apply-coupon', checkoutVerifyLimiter, CheckoutApiController.applyCoupon);
router.post('/sessions/:id/remove-coupon', CheckoutApiController.removeCoupon);
router.post('/sessions/:id/track-event', CheckoutApiController.trackEvent);

export default router;

