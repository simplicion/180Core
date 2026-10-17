'use strict';

import crypto from 'crypto';

export interface VerifyWebhookInput {
  rawBody: string | Buffer | any;
  signature?: string;
  timestamp?: string | number;
  headers?: Record<string, any>;
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

export interface WebhookVerificationResult {
  valid: boolean;
  reason:
    | 'VALID'
    | 'MISSING_SECRET'
    | 'MISSING_PAYLOAD'
    | 'MISSING_SIGNATURE'
    | 'TIMESTAMP_EXPIRED'
    | 'SIGNATURE_MISMATCH';
  message: string;
  clockDriftSeconds?: number;
}

/**
 * Sovereign 180 Pay Server Utilities & Webhook Verification
 */
export class Sovereign180Pay {
  /**
   * Length-safe constant-time comparison that NEVER crashes on length differences.
   */
  private static timingSafeCompare(a: string, b: string): boolean {
    if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a.trim());
    const bufB = Buffer.from(b.trim());
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Performs deep cryptographic inspection of incoming 180 Pay webhooks,
   * returning precise diagnostics for clock drift vs payload tampering vs raw-body distortion.
   */
  static verifyWebhookDetailed(input: VerifyWebhookInput): WebhookVerificationResult {
    const { rawBody, secret, toleranceSeconds = 300 } = input;
    if (!secret) {
      return {
        valid: false,
        reason: 'MISSING_SECRET',
        message: 'Missing webhook signing secret. Ensure ONE_EIGHTY_WEBHOOK_SECRET is configured.',
      };
    }
    if (!rawBody && rawBody !== '') {
      return {
        valid: false,
        reason: 'MISSING_PAYLOAD',
        message: 'Missing rawBody payload. Ensure raw incoming byte buffer or text stream is supplied.',
      };
    }

    // Extract raw payload string cleanly without JSON serialization artifacts
    let bodyString = '';
    if (Buffer.isBuffer(rawBody)) {
      bodyString = rawBody.toString('utf8');
    } else if (typeof rawBody === 'string') {
      bodyString = rawBody;
    } else {
      try {
        bodyString = JSON.stringify(rawBody);
      } catch (_) {
        return {
          valid: false,
          reason: 'MISSING_PAYLOAD',
          message: 'Unable to read raw body buffer. Pass unparsed raw string or Buffer.',
        };
      }
    }

    // Extract signature and timestamp from headers if not explicitly passed
    let signature = input.signature;
    let timestamp = input.timestamp;

    if (input.headers) {
      if (!signature) {
        signature =
          input.headers['x-180-signature'] ||
          input.headers['X-180-Signature'] ||
          input.headers['x_180_signature'];
      }
      if (!timestamp) {
        timestamp =
          input.headers['x-180-timestamp'] ||
          input.headers['X-180-Timestamp'] ||
          input.headers['x_180_timestamp'];
      }
    }

    if (!signature) {
      return {
        valid: false,
        reason: 'MISSING_SIGNATURE',
        message: 'Missing x-180-signature header in webhook request.',
      };
    }

    // Handle stripe-style t=timestamp,v1=signature compound header
    if (typeof signature === 'string' && signature.includes('t=') && signature.includes('v1=')) {
      const parts = signature.split(',');
      const tPart = parts.find((p) => p.trim().startsWith('t='));
      const v1Part = parts.find((p) => p.trim().startsWith('v1='));
      if (tPart && !timestamp) {
        timestamp = tPart.replace('t=', '').trim();
      }
      if (v1Part) {
        signature = v1Part.replace('v1=', '').trim();
      }
    }

    // 5-minute replay attack defense window
    if (timestamp !== undefined && timestamp !== null && timestamp !== '') {
      const currentTime = Math.floor(Date.now() / 1000);
      const parsedTimestamp = typeof timestamp === 'number' ? timestamp : parseInt(String(timestamp), 10);
      const clockDrift = Math.abs(currentTime - parsedTimestamp);

      if (isNaN(parsedTimestamp) || clockDrift > toleranceSeconds) {
        return {
          valid: false,
          reason: 'TIMESTAMP_EXPIRED',
          clockDriftSeconds: clockDrift,
          message: `Webhook timestamp expired or local clock is out of sync by ${clockDrift}s (tolerance: ${toleranceSeconds}s). Please sync local server time with NTP.`,
        };
      }

      // Check canonical timestamped pre-image: `${timestamp}.${rawBody}`
      const signPayload = `${parsedTimestamp}.${bodyString}`;
      const expected = crypto.createHmac('sha256', secret).update(signPayload).digest('hex');
      if (this.timingSafeCompare(expected, signature)) {
        return {
          valid: true,
          reason: 'VALID',
          message: 'Webhook signature successfully verified via HMAC-SHA256 timestamped pre-image.',
        };
      }
    }

    // Fallback: Check raw body pre-image (for systems or test suites not sending timestamp)
    const expectedDirect = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    if (this.timingSafeCompare(expectedDirect, signature)) {
      return {
        valid: true,
        reason: 'VALID',
        message: 'Webhook signature successfully verified via direct rawBody pre-image.',
      };
    }

    return {
      valid: false,
      reason: 'SIGNATURE_MISMATCH',
      message:
        'Cryptographic HMAC signature mismatch. Verify you are passing unaltered raw byte stream (Buffer or unparsed string) rather than JSON.stringify(req.body). In Fastify use @fastify/raw-body, in Express use express.raw({ type: "application/json" }).',
    };
  }

  /**
   * Cryptographically verifies an incoming webhook from 180 Pay.
   * Defends against replay attacks, timing leaks, Buffer vs string distortion, and payload tampering.
   */
  static verifyWebhookSignature(input: VerifyWebhookInput): boolean {
    return this.verifyWebhookDetailed(input).valid;
  }

  /**
   * Constructs and verifies a webhook event. Throws descriptive error if verification fails.
   */
  static constructEvent<T = any>(
    rawBody: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string | number,
    toleranceSeconds: number = 300
  ): T {
    const check = this.verifyWebhookDetailed({
      rawBody,
      signature,
      timestamp,
      secret,
      toleranceSeconds,
    });
    if (!check.valid) {
      throw new Error(`[180 Pay Webhook Error] ${check.message} (Code: ${check.reason})`);
    }
    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    return JSON.parse(bodyString);
  }

  /**
   * Express middleware factory for turnkey 180 Pay webhook ingestion
   */
  static createWebhookMiddleware(options: {
    secret: string;
    toleranceSeconds?: number;
    onEvent: (event: any, req: any, res: any) => Promise<void> | void;
    onError?: (err: Error, req: any, res: any) => void;
  }) {
    return async (req: any, res: any) => {
      try {
        const rawBody = req.body;
        const signature = req.headers['x-180-signature'] as string;
        const timestamp = req.headers['x-180-timestamp'] as string;

        const event = Sovereign180Pay.constructEvent(
          rawBody,
          signature,
          options.secret,
          timestamp
        );

        await options.onEvent(event, req, res);
        if (!res.headersSent) {
          res.status(200).json({ received: true });
        }
      } catch (err: any) {
        if (options.onError) {
          options.onError(err, req, res);
        } else {
          res.status(401).json({ error: err.message });
        }
      }
    };
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
    this.baseUrl = (config.baseUrl || 'https://api.180core.cloud').replace(/\/+$/, '');
  }

  get webhooks() {
    return {
      verifySignature: (input: Omit<VerifyWebhookInput, 'secret'> & { secret?: string }) => {
        return Sovereign180Pay.verifyWebhookSignature({
          ...input,
          secret: input.secret || this.clientSecret,
        });
      },
      verifyDetailed: (input: Omit<VerifyWebhookInput, 'secret'> & { secret?: string }) => {
        return Sovereign180Pay.verifyWebhookDetailed({
          ...input,
          secret: input.secret || this.clientSecret,
        });
      },
      constructEvent: <T = any>(
        rawBody: string | Buffer,
        signature: string,
        timestamp?: string | number,
        secret?: string,
        toleranceSeconds?: number
      ): T => {
        return Sovereign180Pay.constructEvent<T>(
          rawBody,
          signature,
          secret || this.clientSecret,
          timestamp,
          toleranceSeconds
        );
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
