'use strict';

import express from 'express';
import { CustomerPortalApiController } from '../controllers/customer-portal.controller';

const router = express.Router();

router.post('/sessions', CustomerPortalApiController.createPortalSession);
router.get('/data', CustomerPortalApiController.getPortalData);
router.post('/cancel-subscription', CustomerPortalApiController.cancelSubscription);
router.get('/sessions/:sessionToken', CustomerPortalApiController.getPortalDataByParam);
router.post('/sessions/:sessionToken/cancel-subscription', CustomerPortalApiController.cancelSubscriptionByParam);
router.post('/sessions/:sessionToken/link-180-account', CustomerPortalApiController.link180Account);

export default router;
