'use strict';

import express from 'express';
import { PricingTableApiController } from '../controllers/pricing-table.controller';
import { protect, optionalAuth } from '../middleware/auth.middleware';

const router = express.Router();

// Public / SDK retrieval
router.get('/:appId/headless', PricingTableApiController.getHeadlessPricing);
router.get('/:appId/public', PricingTableApiController.getHeadlessPricing);
router.get('/:appId', optionalAuth, PricingTableApiController.getPricingTableConfig);
router.get('/:appId/plans', optionalAuth, PricingTableApiController.listAppSubscriptionPlans);

// Developer management
router.put('/:appId', protect, PricingTableApiController.updatePricingTableConfig);
router.post('/:appId', protect, PricingTableApiController.updatePricingTableConfig);

export default router;
