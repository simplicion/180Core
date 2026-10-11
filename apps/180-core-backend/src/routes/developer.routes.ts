'use strict';

import express from 'express';
import { DeveloperApiController } from '../controllers/developer.controller';
import { protect } from '../middleware/auth.middleware';
import { logoUploadMiddleware } from '../middleware/logo-upload.middleware';

const router = express.Router();

// ─── App Logo & Asset Direct Media Pipeline ─────────────────────────────────
router.post('/upload-logo', protect, logoUploadMiddleware, DeveloperApiController.uploadAppLogo);
router.post('/apps/:id/upload-logo', protect, logoUploadMiddleware, DeveloperApiController.uploadAppLogo);

// ─── OAuth Applications Management ───────────────────────────────────────────
router.get('/apps', protect, DeveloperApiController.listApps);
router.get('/apps/:id', protect, DeveloperApiController.getApp);
router.post('/apps', protect, DeveloperApiController.createApp);
router.put('/apps/:id', protect, DeveloperApiController.updateApp);
router.patch('/apps/:id', protect, DeveloperApiController.updateApp);
router.post('/apps/:id/rotate-secret', protect, DeveloperApiController.rotateSecret);
router.post('/apps/:id/rotate-webhook-secret', protect, DeveloperApiController.rotateWebhookSecret);
router.post('/apps/:id/test-webhook', protect, DeveloperApiController.testWebhook);
router.delete('/apps/:id', protect, DeveloperApiController.deleteApp);

// ─── Developer Project Billing & Recurring Auto-Pay ─────────────────────────
router.get('/billing/status', protect, DeveloperApiController.getBillingStatus);
router.post('/billing/autopay', protect, DeveloperApiController.setupAutoPay);
router.post('/billing/settle', protect, DeveloperApiController.settleManualPayment);
router.post('/billing/dunning-cycle', protect, DeveloperApiController.runDunningCycle);

// ─── App Real-Time Telemetry & Financial Analytics ───────────────────────────
router.get('/apps/:id/auth-logs', protect, DeveloperApiController.getAuthLogs);
router.post('/apps/:id/users/:targetUserId/revoke', protect, DeveloperApiController.revokeUserSession);
router.post('/apps/:id/revoke-user', protect, DeveloperApiController.revokeUserSession);
router.get('/apps/:id/payment-analytics', protect, DeveloperApiController.getPaymentAnalytics);
router.get('/apps/:id/analytics', protect, DeveloperApiController.getPaymentAnalytics);
router.get('/apps/:id/bank-details', protect, DeveloperApiController.getBankDetails);
router.put('/apps/:id/bank-details', protect, DeveloperApiController.saveBankDetails);
router.post('/apps/:id/bank-details', protect, DeveloperApiController.saveBankDetails);

// ─── Custom Gateway (BYOG) & Custom Domain ────────────────────────────────────
router.get('/apps/:id/gateway', protect, DeveloperApiController.getGatewaySettings);
router.put('/apps/:id/gateway', protect, DeveloperApiController.saveGatewaySettings);
router.post('/apps/:id/gateway/verify', protect, DeveloperApiController.verifyGatewayCredentials);
router.post('/apps/:id/custom-domain/verify', protect, DeveloperApiController.verifyCustomDomain);

// ─── Earnings & Manual Payouts ───────────────────────────────────────────────
router.post('/apps/:appId/payouts', protect, DeveloperApiController.requestPayout);
router.get('/apps/:appId/payouts', protect, DeveloperApiController.listPayouts);

// ─── Super Admin Vendor Payouts & Global Intelligence ────────────────────────
router.get('/admin/payouts', DeveloperApiController.listAdminPayouts);
router.post('/admin/payouts/:id/status', DeveloperApiController.updateAdminPayoutStatus);
router.get('/admin/analytics', DeveloperApiController.getAdminAnalytics);

export default router;
