'use strict';

import { Request, Response } from 'express';
import { AgentPurchaseService } from '@workspace/payment-provider';

export class AgentCheckoutApiController {
  /**
   * Helper to extract agent key from headers or body
   */
  private static extractAgentKey(req: Request): string {
    const customHeader = req.headers['x-180-agent-key'] || req.headers['x-agent-key'];
    if (typeof customHeader === 'string' && customHeader.trim()) {
      return customHeader.trim();
    }
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer 180_agent_key_')) {
      return authHeader.substring(7).trim();
    }
    if (req.body.agentKey && typeof req.body.agentKey === 'string') {
      return req.body.agentKey.trim();
    }
    return '';
  }

  /**
   * POST /api/v1/checkout/agent-purchase
   * Machine-to-Machine Autonomous Checkout for AI Agents.
   * No 3DS, no human-in-the-loop, atomic spend cap check.
   */
  static async executeAgentPurchase(req: Request, res: Response) {
    try {
      const agentKey = AgentCheckoutApiController.extractAgentKey(req);
      const { appId, amount, currency, planId, title, idempotencyKey, metadata } = req.body;

      if (!agentKey) {
        return res.status(401).json({
          success: false,
          error: 'Agent authentication key required (X-180-Agent-Key header or agentKey body)',
        });
      }
      if (!appId) {
        return res.status(400).json({ success: false, error: 'Target appId is required' });
      }
      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
      }

      const safeIdempotencyKey = idempotencyKey || req.headers['idempotency-key'] || `idemp_${Date.now()}`;

      const result = await AgentPurchaseService.executeAgentPurchase({
        agentKey,
        appId: String(appId),
        amount: Number(amount),
        currency: currency ? String(currency) : 'USD',
        planId: planId ? String(planId) : undefined,
        title: title ? String(title) : undefined,
        idempotencyKey: String(safeIdempotencyKey),
        metadata,
      });

      return res.status(200).json({ success: true, data: result, ...result });
    } catch (err: any) {
      console.error('[AgentCheckoutApiController:executeAgentPurchase] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/developer/agent-envelopes/apps/:appId
   * Developer endpoint: Issue a pre-authorized budget envelope for an agent
   */
  static async createBudgetEnvelope(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const envelope = await AgentPurchaseService.createBudgetEnvelope(appId, req.body);
      return res.status(201).json({ success: true, data: envelope, ...envelope });
    } catch (err: any) {
      console.error('[AgentCheckoutApiController:createBudgetEnvelope] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/developer/agent-envelopes/apps/:appId
   * Developer endpoint: List active envelopes & spending metrics
   */
  static async listBudgetEnvelopes(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const envelopes = await AgentPurchaseService.listBudgetEnvelopes(appId);
      return res.status(200).json({ success: true, data: envelopes, envelopes });
    } catch (err: any) {
      console.error('[AgentCheckoutApiController:listBudgetEnvelopes] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/v1/developer/agent-envelopes/apps/:appId/:id
   * Developer endpoint: Revoke an agent spending envelope
   */
  static async revokeBudgetEnvelope(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const envelopeId = String(req.params.id);

      await AgentPurchaseService.revokeBudgetEnvelope(appId, envelopeId);
      return res.status(200).json({ success: true, message: 'Agent envelope revoked successfully' });
    } catch (err: any) {
      console.error('[AgentCheckoutApiController:revokeBudgetEnvelope] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
