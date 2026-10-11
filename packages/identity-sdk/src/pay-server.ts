'use strict';

import crypto from 'crypto';

export interface VerifyWebhookInput {
  rawBody: string;
  signature: string;
  timestamp: string;
  secret: string;
  toleranceSeconds?: number;
}

export interface CouponValidateInput {
  appId: string;
  code: string;
  orderAmount: number;
  customerEmail?: string;
  origin?: string;
}

export interface CreatePaymentLinkSdkInput {
  title: string;
  amount: number;
  currency?: string;
  customSlug?: string;
  collectPhone?: boolean;
  collectAddress?: boolean;
  allowCoupons?: boolean;
  redirectUrl?: string;
  fulfillmentMessage?: string;
  fulfillmentFileUrl?: string;
  maxPurchases?: number;
  metadata?: Record<string, any>;
}

export interface CreatePortalSessionSdkInput {
  appId: string;
  customerEmail: string;
  returnUrl: string;
  externalCustomerId?: string;
}

export interface AgentPurchaseSdkInput {
  agentKey: string;
  appId: string;
  amount: number;
  currency?: string;
  title?: string;
  planId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Sovereign 180 Pay Server Utilities & Webhook Verification
 */
export class Sovereign180Pay {
  /**
   * Cryptographically verifies an incoming webhook from 180 Pay.
   * Defends against replay attacks, timing leaks, and payload tampering.
   */
  static verifyWebhookSignature(input: VerifyWebhookInput): boolean {
    const { rawBody, signature, timestamp, secret, toleranceSeconds = 300 } = input;

    if (!rawBody || !signature || !timestamp || !secret) {
      return false;
    }

    // Replay attack check
    const currentTime = Math.floor(Date.now() / 1000);
    const parsedTimestamp = parseInt(timestamp, 10);
    if (isNaN(parsedTimestamp) || Math.abs(currentTime - parsedTimestamp) > toleranceSeconds) {
      return false;
    }

    const signPayload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(signPayload).digest('hex');

    const bufA = Buffer.from(expected);
    const bufB = Buffer.from(signature);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}

/**
 * 180 Pay Server Client for 3rd-Party Backend Integrations
 */
export class Sovereign180PayClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor(config: { clientId: string; clientSecret: string; baseUrl?: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = (config.baseUrl || 'https://auth.180workspace.com').replace(/\/+$/, '');
  }

  get webhooks() {
    return {
      verifySignature: (input: Omit<VerifyWebhookInput, 'secret'> & { secret?: string }) => {
        return Sovereign180Pay.verifyWebhookSignature({
          ...input,
          secret: input.secret || this.clientSecret,
        });
      },
    };
  }

  get coupons() {
    return {
      validate: async (input: CouponValidateInput) => {
        const res = await fetch(`${this.baseUrl}/api/v1/coupons/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(input.origin ? { Origin: input.origin } : {}),
          },
          body: JSON.stringify(input),
        });
        return await res.json();
      },
    };
  }

  get paymentLinks() {
    return {
      create: async (appId: string, input: CreatePaymentLinkSdkInput, bearerToken?: string) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (bearerToken) {
          headers['Authorization'] = `Bearer ${bearerToken}`;
        }
        const res = await fetch(`${this.baseUrl}/api/v1/payment-links/apps/${appId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        });
        return await res.json();
      },
      getPublic: async (slug: string) => {
        const res = await fetch(`${this.baseUrl}/api/v1/payment-links/public/${slug}`);
        return await res.json();
      },
    };
  }

  get portal() {
    return {
      createSession: async (input: CreatePortalSessionSdkInput) => {
        const res = await fetch(`${this.baseUrl}/api/v1/portal/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        return await res.json();
      },
      getData: async (token: string) => {
        const res = await fetch(`${this.baseUrl}/api/v1/portal/data?token=${encodeURIComponent(token)}`);
        return await res.json();
      },
    };
  }

  get agents() {
    return {
      purchase: async (input: AgentPurchaseSdkInput) => {
        const res = await fetch(`${this.baseUrl}/api/v1/checkout/agent-purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-180-Agent-Key': input.agentKey,
            ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
          },
          body: JSON.stringify(input),
        });
        return await res.json();
      },
    };
  }
}
