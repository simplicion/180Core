'use strict';

import express from 'express';
import { PaymentLinkApiController } from '../controllers/payment-link.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';

const router = express.Router();

// Public checkout resolution & fulfillment
router.get('/public/:slug', PaymentLinkApiController.getPublicPaymentLink);
router.get('/slug/:slug', PaymentLinkApiController.getPublicPaymentLink);
router.get('/:id/fulfillment', PaymentLinkApiController.getFulfillment);
router.post('/:id/complete', PaymentLinkApiController.completePaymentLink);

// Developer management endpoints
router.get('/apps/:appId', protect, PaymentLinkApiController.listPaymentLinks);
router.post('/apps/:appId', protect, PaymentLinkApiController.createPaymentLink);
router.get('/apps/:appId/:id', protect, PaymentLinkApiController.getPaymentLinkById);
router.put('/apps/:appId/:id', protect, PaymentLinkApiController.updatePaymentLink);
router.delete('/apps/:appId/:id', protect, PaymentLinkApiController.deletePaymentLink);

export default router;
