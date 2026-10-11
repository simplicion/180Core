'use strict';

import crypto from 'crypto';
import axios from 'axios';
import { developersPrisma as prisma } from '@workspace/db-180core';

export type WebhookEventType =
  | 'payment.captured'
  | 'payment.succeeded'
  | 'coupon.redeemed'
  | 'payment_link.completed'
  | 'subscription.cancelled_by_customer'
  | 'agent.purchase_settled';

export interface WebhookDispatchPayload<T = any> {
  event: WebhookEventType;
  data: T;
  timestamp?: string;
}

export class WebhookDispatcherService {
  /**
   * Constant-time comparison to prevent timing attacks.
   */
  private static timingSafeCompare(a: string, b: string): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Computes an HMAC-SHA256 signature for a payload.
   */
  static computeSignature(rawPayload: string, timestamp: string, secret: string): string {
    const signPayload = `${timestamp}.${rawPayload}`;
    return crypto.createHmac('sha256', secret).update(signPayload).digest('hex');
  }

  /**
   * Cryptographically verifies an incoming webhook signature with replay protection.
   */
  static verifySignature(input: {
    rawBody: string;
    signature: string;
    timestamp: string;
    secret: string;
    toleranceSeconds?: number;
  }): boolean {
    const { rawBody, signature, timestamp, secret, toleranceSeconds = 300 } = input;

    if (!rawBody || !signature || !timestamp || !secret) {
      return false;
    }

    // Replay attack protection (default 5-minute drift window)
    const currentTime = Math.floor(Date.now() / 1000);
    const parsedTimestamp = parseInt(timestamp, 10);
    if (isNaN(parsedTimestamp) || Math.abs(currentTime - parsedTimestamp) > toleranceSeconds) {
      return false;
    }

    const expectedSignature = this.computeSignature(rawBody, timestamp, secret);
    return this.timingSafeCompare(expectedSignature, signature);
  }

  /**
   * Dispatches signed webhook events with timestamped HMAC-SHA256 signatures,
   * delivery tracking, and automatic retry backoff.
   */
  static async dispatchEvent(appId: string, payload: WebhookDispatchPayload) {
    try {
      const app = await (prisma as any).oAuthApp.findUnique({
        where: { id: appId },
      });

      if (!app) {
        console.warn(`[WebhookDispatcher] Cannot dispatch event: App ${appId} not found`);
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const enrichedPayload = {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      const payloadString = JSON.stringify(enrichedPayload);

      const deliverWithRetry = async (url: string, secret: string, endpointId?: string) => {
        const signature = this.computeSignature(payloadString, timestamp, secret);

        const headers = {
          'Content-Type': 'application/json',
          'X-180-Signature': signature,
          'X-180-Timestamp': timestamp,
          'X-180-Event': payload.event,
          'User-Agent': '180-Pay-Webhook-Dispatcher/2.0',
        };

        let response: any = null;
        let lastError: any = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            response = await axios.post(url, enrichedPayload, { headers, timeout: 8000 });
            break;
          } catch (err: any) {
            lastError = err;
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 1000)); // 1s backoff before retry
            }
          }
        }

        if (endpointId) {
          try {
            if (response) {
              await (prisma as any).webhookDelivery.create({
                data: {
                  endpointId,
                  event: payload.event,
                  payload: payloadString,
                  statusCode: response.status,
                  response:
                    typeof response.data === 'string'
                      ? response.data.slice(0, 1000)
                      : JSON.stringify(response.data).slice(0, 1000),
                  deliveredAt: new Date(),
                },
              });
            } else {
              await (prisma as any).webhookDelivery.create({
                data: {
                  endpointId,
                  event: payload.event,
                  payload: payloadString,
                  statusCode: lastError?.response?.status || null,
                  error: lastError?.message?.slice(0, 1000) || 'Webhook delivery failed after retry',
                },
              });
            }
          } catch (dbErr: any) {
            console.warn('[WebhookDispatcher] Delivery record logging error:', dbErr.message);
          }
        }
      };

      // 1. Direct App Webhook URL
      if (app.webhookUrl && typeof app.webhookUrl === 'string' && app.webhookUrl.startsWith('http')) {
        const signingSecret = app.webhookSecret || app.clientSecretHash;
        deliverWithRetry(app.webhookUrl, signingSecret).catch((err) => {
          console.warn(`[WebhookDispatcher] Direct webhook failed for app ${appId}:`, err.message);
        });
      }

      // 2. Multi-Endpoint Webhook registrations
      const endpoints = await (prisma as any).webhookEndpoint.findMany({
        where: { appId, isActive: true },
      });

      for (const endpoint of endpoints) {
        if (!endpoint.events || endpoint.events.length === 0 || endpoint.events.includes(payload.event) || endpoint.events.includes('*')) {
          deliverWithRetry(endpoint.url, endpoint.secret, endpoint.id).catch((err) => {
            console.warn(`[WebhookDispatcher] Endpoint ${endpoint.id} failed:`, err.message);
          });
        }
      }
    } catch (err: any) {
      console.error('[WebhookDispatcher:dispatchEvent] Error:', err);
    }
  }
}
