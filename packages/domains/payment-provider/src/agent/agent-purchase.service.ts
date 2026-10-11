'use strict';

import crypto from 'crypto';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { WebhookDispatcherService } from '../webhook/webhook-dispatcher.service';

export interface CreateEnvelopeInput {
  agentName: string;
  maxSpendTotal: number;
  maxSpendPerTx: number;
  durationDays?: number;
  metadata?: Record<string, any>;
}

export interface AgentPurchaseInput {
  agentKey: string;
  appId: string;
  amount: number;
  currency?: string;
  planId?: string;
  title?: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface AgentPurchaseResult {
  success: boolean;
  transactionId: string;
  sessionId: string;
  amount: number;
  currency: string;
  settledAt: Date;
  deliverable: {
    token: string;
    type: string;
    accessGranted: boolean;
  };
  budget: {
    totalCeiling: number;
    spentAfterTx: number;
    remaining: number;
  };
}

export class AgentPurchaseService {
  /**
   * Hashes raw agent key using SHA-256 for secure database storage.
   */
  static hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
  }

  /**
   * 1. Creates a delegated spending envelope for an autonomous AI agent.
   * Returns the raw unhashed key once to the developer/operator.
   */
  static async createBudgetEnvelope(appId: string, data: CreateEnvelopeInput) {
    if (!data.agentName || !data.agentName.trim()) {
      throw new Error('Agent name is required');
    }
    if (data.maxSpendTotal <= 0) {
      throw new Error('Total spending ceiling must be greater than zero');
    }
    if (data.maxSpendPerTx <= 0 || data.maxSpendPerTx > data.maxSpendTotal) {
      throw new Error('Per-transaction limit must be greater than zero and <= total ceiling');
    }

    const app = await (prisma as any).oAuthApp.findUnique({
      where: { id: appId },
    });
    if (!app || !app.isActive) {
      throw new Error('Developer application not found or inactive');
    }

    const rawKey = `180_agent_key_${crypto.randomBytes(24).toString('hex')}`;
    const agentKeyHash = this.hashKey(rawKey);

    const durationDays = data.durationDays || 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const envelope = await (prisma as any).agenticBudgetEnvelope.create({
      data: {
        appId,
        agentKeyHash,
        agentName: data.agentName.trim(),
        maxSpendTotal: Number(data.maxSpendTotal),
        maxSpendPerTx: Number(data.maxSpendPerTx),
        currentSpent: 0,
        expiresAt,
        metadata: data.metadata || {},
        isActive: true,
      },
    });

    return {
      rawKey,
      envelope: {
        id: envelope.id,
        agentName: envelope.agentName,
        maxSpendTotal: envelope.maxSpendTotal,
        maxSpendPerTx: envelope.maxSpendPerTx,
        expiresAt: envelope.expiresAt,
        isActive: envelope.isActive,
      },
    };
  }

  /**
   * 2. Machine-to-Machine Micro-Checkout execution for autonomous AI agents.
   * Atomic, zero-human-in-the-loop payment rail with pre-authorized spending caps.
   */
  static async executeAgentPurchase(input: AgentPurchaseInput): Promise<AgentPurchaseResult> {
    const { appId, amount, idempotencyKey } = input;
    const currency = (input.currency || 'USD').toUpperCase();
    const rawKey = (input.agentKey || '').trim();

    if (!rawKey) {
      throw new Error('Agent key is required for M2M authentication');
    }
    if (amount <= 0) {
      throw new Error('Purchase amount must be greater than zero');
    }

    const keyHash = this.hashKey(rawKey);

    // Fetch spending envelope
    const envelope = await (prisma as any).agenticBudgetEnvelope.findUnique({
      where: { agentKeyHash: keyHash },
    });

    if (!envelope) {
      throw new Error('Invalid or unrecognized agent key');
    }
    if (!envelope.isActive) {
      throw new Error('Agent spending envelope has been revoked or deactivated');
    }
    if (new Date() > new Date(envelope.expiresAt)) {
      throw new Error('Agent spending envelope has expired');
    }
    if (amount > envelope.maxSpendPerTx) {
      throw new Error(`Transaction amount ${amount} exceeds agent per-transaction limit of ${envelope.maxSpendPerTx}`);
    }
    if (envelope.currentSpent + amount > envelope.maxSpendTotal) {
      throw new Error(
        `Transaction exceeds cumulative budget ceiling. Remaining: ${envelope.maxSpendTotal - envelope.currentSpent}`
      );
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Atomic conditional deduction of agent budget
      const affected = await tx.$executeRaw`
        UPDATE "AgenticBudgetEnvelope"
        SET "currentSpent" = "currentSpent" + ${amount},
            "updatedAt" = NOW()
        WHERE "id" = ${envelope.id}
          AND "isActive" = true
          AND "currentSpent" + ${amount} <= "maxSpendTotal"
      `;

      if (affected === 0) {
        throw new Error('Agent budget exceeded concurrently during execution');
      }

      // 2. Create captured checkout session for developer ledger & records
      const session = await tx.checkoutSession.create({
        data: {
          appId,
          amount,
          currency,
          status: 'CAPTURED',
          mode: 'agent_m2m',
          title: input.title || `AI Agent M2M: ${envelope.agentName}`,
          planId: input.planId || null,
          metadata: {
            agentId: envelope.id,
            agentName: envelope.agentName,
            idempotencyKey,
            ...(input.metadata || {}),
          },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          completedAt: new Date(),
        },
      });

      // 3. Generate instant digital deliverable package for calling agent
      const deliverableToken = `dlv_${crypto.randomBytes(16).toString('hex')}`;
      const spentAfterTx = envelope.currentSpent + amount;

      return {
        success: true,
        transactionId: `tx_agent_${session.id.slice(-8)}`,
        sessionId: session.id,
        amount,
        currency,
        settledAt: session.completedAt,
        deliverable: {
          token: deliverableToken,
          type: 'MACHINE_DELIVERABLE_TOKEN',
          accessGranted: true,
        },
        budget: {
          totalCeiling: envelope.maxSpendTotal,
          spentAfterTx,
          remaining: Math.max(0, Math.round((envelope.maxSpendTotal - spentAfterTx) * 100) / 100),
        },
      };
    });

    WebhookDispatcherService.dispatchEvent(appId, {
      event: 'agent.purchase_settled',
      data: {
        transactionId: result.transactionId,
        sessionId: result.sessionId,
        amount: result.amount,
        currency: result.currency,
        agentId: input.agentKey.slice(0, 15) + '...',
        settledAt: result.settledAt,
      },
    }).catch((err) => console.warn('[AgentPurchaseService] Webhook dispatch error:', err.message));

    return result;
  }

  /**
   * 3. Developer Management: Revoke Agent Envelope
   */
  static async revokeBudgetEnvelope(appId: string, envelopeId: string) {
    const envelope = await (prisma as any).agenticBudgetEnvelope.findFirst({
      where: { id: envelopeId, appId },
    });
    if (!envelope) {
      throw new Error('Envelope not found');
    }

    return await (prisma as any).agenticBudgetEnvelope.update({
      where: { id: envelopeId },
      data: { isActive: false },
    });
  }

  /**
   * 4. Developer Management: List Agent Envelopes
   */
  static async listBudgetEnvelopes(appId: string) {
    return await (prisma as any).agenticBudgetEnvelope.findMany({
      where: { appId },
      select: {
        id: true,
        agentName: true,
        maxSpendTotal: true,
        maxSpendPerTx: true,
        currentSpent: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
