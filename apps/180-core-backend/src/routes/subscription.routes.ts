'use strict';

import express from 'express';
import { SubscriptionApiController } from '../controllers/subscription.controller';

const router = express.Router();

router.post('/plans', SubscriptionApiController.createPlan);
router.get('/plans', SubscriptionApiController.listPlans);
router.post('/sessions', SubscriptionApiController.createSubscriptionSession);
router.get('/entitlements', SubscriptionApiController.getUserEntitlements);
router.post('/verify-token', SubscriptionApiController.verifyEntitlementToken);
router.post('/razorpay-webhook', SubscriptionApiController.handleRazorpayWebhook);
router.post('/webhook', SubscriptionApiController.handleRazorpayWebhook);
router.get('/:id', SubscriptionApiController.getSubscription);
router.post('/:id/cancel', SubscriptionApiController.cancelSubscription);
router.post('/run-billing-cycle', SubscriptionApiController.runBillingCycle);

export default router;
