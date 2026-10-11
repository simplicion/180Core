'use strict';

import express from 'express';
import { AgentCheckoutApiController } from '../controllers/agent-checkout.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

// Public / Machine Agent checkout endpoint (authenticated via X-180-Agent-Key)
router.post('/agent-purchase', AgentCheckoutApiController.executeAgentPurchase);

// Developer management endpoints
router.post('/developer/agent-envelopes/apps/:appId', protect, AgentCheckoutApiController.createBudgetEnvelope);
router.get('/developer/agent-envelopes/apps/:appId', protect, AgentCheckoutApiController.listBudgetEnvelopes);
router.delete('/developer/agent-envelopes/apps/:appId/:id', protect, AgentCheckoutApiController.revokeBudgetEnvelope);

router.post('/agent-envelopes/apps/:appId', protect, AgentCheckoutApiController.createBudgetEnvelope);
router.get('/agent-envelopes/apps/:appId', protect, AgentCheckoutApiController.listBudgetEnvelopes);
router.delete('/agent-envelopes/apps/:appId/:id', protect, AgentCheckoutApiController.revokeBudgetEnvelope);

export default router;
