'use strict';

import express from 'express';
import { GeoPricingApiController } from '../controllers/geo-pricing.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Public resolution endpoints
router.get('/resolve', GeoPricingApiController.resolveLocalizedPrice);
router.get('/directory', GeoPricingApiController.getCountryDirectory);

// Developer management endpoints
router.get('/apps/:appId', protect, GeoPricingApiController.getAppRules);
router.post('/apps/:appId', protect, GeoPricingApiController.setCountryRule);
router.delete('/apps/:appId/:id', protect, GeoPricingApiController.deleteCountryRule);
router.patch('/apps/:appId/toggle', protect, GeoPricingApiController.togglePPP);

export default router;
