'use strict';

import crypto from 'crypto';
import axios from 'axios';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { IdentityWalletService } from '../wallet/identity-wallet.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { GeoPricingService } from '../geo/geo-pricing.service';

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getPlatformCredentials() {
  const clientId =
    process.env.CORE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_180_CLIENT_ID ||
    '';
  const rawSecret = process.env.CORE_CLIENT_SECRET || '';
  return {
    clientId,
    clientSecretHash: rawSecret ? hashSecret(rawSecret) : '',
    clientSecretHint: rawSecret ? rawSecret.slice(-4) : '',
  };
}

export interface CreateCheckoutSessionInput {
  clientId: string;
  clientSecret: string;
  amount: number;
  currency?: string;
  title: string;
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
  expiresInMinutes?: number;
  mode?: 'payment' | 'subscription';
  planCode?: string;
  billingInterval?: string;
  paymentSource?: 'WALLET' | 'RAZORPAY_RECURRING' | 'HYBRID';
}

export class CheckoutService {
  /**
   * Resolves the official 180 Core platform OAuth application from environment variables.
   * Completely env-driven with zero hardcoded credentials or mock URIs.
   */
  private static async resolvePlatformOAuthApp() {
    const coreClientId = process.env.CORE_CLIENT_ID || process.env.NEXT_PUBLIC_180_CLIENT_ID || '';
    let platformApp = await prisma.oAuthApp.findFirst({
      where: {
        OR: [
          ...(coreClientId ? [{ clientId: coreClientId }] : []),
          { name: '180 Core' },
        ],
      },
    });

    if (!platformApp) {
      const anyUser = await prisma.user.findFirst();
      if (anyUser) {
        const creds = getPlatformCredentials();
        const redirectUris = (process.env.CORE_REDIRECT_URIS || '').split(',').map((u: string) => u.trim()).filter(Boolean);
        const allowedOrigins = (process.env.CORE_ALLOWED_ORIGINS || '').split(',').map((o: string) => o.trim()).filter(Boolean);
        platformApp = await prisma.oAuthApp.create({
          data: {
            clientId: creds.clientId || `180_core_${crypto.randomBytes(8).toString('hex')}`,
            name: '180 Core',
            description: 'Sovereign Core Identity, Auth & 180 Pay Infrastructure',
            logoUrl: process.env.CORE_APP_LOGO_URL || '',
            clientSecretHash: creds.clientSecretHash,
            clientSecretHint: creds.clientSecretHint,
            redirectUris,
            allowedOrigins,
            allowedScopes: ['openid', 'identity:read', 'pay:checkout', 'pay:subscriptions'],
            isVerified: true,
            isActive: true,
            userId: anyUser.id,
          },
        });
      }
    }
    return platformApp;
  }

  /**
   * Creates a new Checkout Session (Initiated by 3rd-party developer server)
   */
  static async createSession(input: CreateCheckoutSessionInput) {
    const {
      clientId,
      clientSecret,
      amount,
      currency = 'INR',
      title,
      description,
      returnUrl,
      cancelUrl,
      metadata,
      expiresInMinutes = 30,
      mode = 'payment',
      planCode,
      billingInterval,
      paymentSource = 'WALLET',
    } = input;

    if (!amount || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (!title) {
      throw new Error('Payment title is required');
    }

    // 1. Authenticate developer application with constant-time comparison
    const app = await prisma.oAuthApp.findUnique({
      where: { clientId },
    });

    if (!app || !app.isActive) {
      throw new Error('Invalid or inactive OAuth client credentials');
    }

    const isValidSecret = timingSafeCompare(hashSecret(clientSecret), app.clientSecretHash);
    if (!isValidSecret) {
      throw new Error('Invalid client secret');
    }

    if (app.enablePay === false) {
      throw new Error('180 Pay is currently disabled for this application.');
    }

    // 2. Set expiry
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 3. Resolve plan if in subscription mode
    let planId: string | null = null;
    let resolvedInterval = billingInterval || 'MONTHLY';
    if (mode === 'subscription' && planCode) {
      const plan = await (prisma as any).subscriptionPlan.findUnique({
        where: {
          appId_planCode: {
            appId: app.id,
            planCode: planCode.toLowerCase().trim(),
          },
        },
      });
      if (plan) {
        planId = plan.id;
        resolvedInterval = plan.interval;
      }
    }

    // 4. Session reuse check: look up recent active PENDING session for this clientSessionId or idempotencyKey
    const clientSessionId = (metadata as any)?.clientSessionId || (metadata as any)?.idempotencyKey || null;
    let existingSession = null;

    if (clientSessionId) {
      const recentPending = await prisma.checkoutSession.findMany({
        where: {
          appId: app.id,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
          createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        include: {
          app: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              isVerified: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      existingSession = recentPending.find((s) => {
        const m = (s.metadata as any) || {};
        return m.clientSessionId === clientSessionId || m.idempotencyKey === clientSessionId;
      }) || null;
    }

    let session;
    if (existingSession) {
      const existingMeta = (existingSession.metadata as any) || {};
      session = await prisma.checkoutSession.update({
        where: { id: existingSession.id },
        data: {
          amount: Math.round(amount * 100) / 100,
          title,
          description: description || '',
          metadata: {
            ...existingMeta,
            ...(metadata || {}),
            paymentSource,
            lastReopenedAt: new Date().toISOString(),
          },
        },
        include: {
          app: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              isVerified: true,
            },
          },
        },
      });
    } else {
      session = await prisma.checkoutSession.create({
        data: {
          appId: app.id,
          amount: Math.round(amount * 100) / 100,
          currency: currency.toUpperCase(),
          status: 'PENDING',
          mode,
          planId,
          billingInterval: mode === 'subscription' ? resolvedInterval : null,
          title,
          description: description || '',
          returnUrl: returnUrl || '',
          cancelUrl: cancelUrl || '',
          metadata: {
            ...(metadata || {}),
            paymentSource,
          },
          expiresAt,
        },
        include: {
          app: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              isVerified: true,
            },
          },
        },
      });
    }

    const checkoutBase = (process.env.PROFILE_FRONTEND_URL || process.env.NEXT_PUBLIC_PROFILE_URL || 'https://profile.180core.cloud').replace(/\/+$/, '');

    return {
      success: true,
      sessionId: session.id,
      amount: session.amount,
      currency: session.currency,
      mode: session.mode,
      planId: session.planId,
      expiresAt: session.expiresAt,
      checkoutUrl: `${checkoutBase}/checkout/${session.id}`,
    };
  }

  /**
   * Retrieves or auto-resolves a Checkout Session for rendering the 180 Pay Drawer.
   * Features zero-drop resiliency: auto-heals payment links, top-ups, dev sessions,
   * client-side sandbox sessions, and auto-renews active checkouts.
   */
  static async getSession(sessionId: string, fallbackData?: any) {
    let session: any = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: {
        app: {
          select: {
            id: true,
            clientId: true,
            name: true,
            description: true,
            logoUrl: true,
            isVerified: true,
            allowedOrigins: true,
            redirectUris: true,
            customGatewayType: true,
            customGatewayKeyId: true,
            customGatewaySecret: true,
            customGatewayWebhookSecret: true,
          },
        },
      },
    });

    // Self-heal and safeguard Developer Portal billing sessions to strictly bind to official 180 Core platform identity
    if (session && sessionId.startsWith('sess_dev_')) {
      if (session.app) {
        session.app.name = '180 Core';
        session.app.isVerified = true;
      }

      const isPro = sessionId.includes('_pro_');
      const canonicalBaseUSD = isPro ? 5.0 : 2.0;

      // Auto-heal sessions if amount or originalAmount was corrupted by foreign currency compounding
      const isCorrupted =
        !session.originalAmount ||
        session.originalAmount > 10.0 ||
        Math.abs(session.originalAmount - canonicalBaseUSD) > 0.01;

      if (isCorrupted) {
        const isFreeCoupon =
          session.couponCode === 'FREEO' ||
          (session.discountAmount && session.discountAmount >= canonicalBaseUSD) ||
          session.amount === 0;

        const healedAmount = isFreeCoupon ? 0 : canonicalBaseUSD;
        const healedDiscount = isFreeCoupon ? canonicalBaseUSD : (session.discountAmount && session.discountAmount <= canonicalBaseUSD ? session.discountAmount : 0);

        await prisma.checkoutSession.update({
          where: { id: sessionId },
          data: {
            originalAmount: canonicalBaseUSD,
            amount: healedAmount,
            discountAmount: healedDiscount,
            currency: 'USD',
          },
        }).catch(() => {});

        session.originalAmount = canonicalBaseUSD;
        session.amount = healedAmount;
        session.discountAmount = healedDiscount;
        session.currency = 'USD';
      }

      const coreClientId = process.env.CORE_CLIENT_ID || process.env.NEXT_PUBLIC_180_CLIENT_ID || '';
      const isPlatformApp =
        (coreClientId && session.app?.clientId === coreClientId) ||
        session.app?.name?.toLowerCase() === '180 core';

      if (!isPlatformApp) {
        const platformApp = await CheckoutService.resolvePlatformOAuthApp();

        if (platformApp) {
          await prisma.checkoutSession.update({
            where: { id: sessionId },
            data: { appId: platformApp.id },
          }).catch(() => {});

          session.appId = platformApp.id;
          session.app = {
            id: platformApp.id,
            name: platformApp.name,
            description: platformApp.description || 'Sovereign Core Identity, Auth & 180 Pay Infrastructure',
            logoUrl: platformApp.logoUrl || '',
            isVerified: true,
          } as any;
        }
      }
    }

    // Auto-heal Developer Portal billing checkout sessions if not already in DB
    if (!session && sessionId.startsWith('sess_dev_')) {
      try {
        const isPro = sessionId.includes('_pro_');
        const planTier = isPro ? 'PRO' : 'STARTER';
        const amount = isPro ? 5.0 : 2.0;
        const title = isPro ? '180 Core — Pro Plan' : '180 Core — Starter Plan';
        const description = isPro ? '10 Projects Access with 180 Identity & 180 Pay' : '5 Projects Access with 180 Identity & 180 Pay';

        const platformApp = await CheckoutService.resolvePlatformOAuthApp();

        if (platformApp) {
          session = await prisma.checkoutSession.create({
            data: {
              id: sessionId,
              appId: platformApp.id,
              amount,
              originalAmount: amount,
              currency: 'USD',
              status: 'PENDING',
              mode: 'subscription',
              title,
              description,
              metadata: {
                planTier,
                source: 'DEVELOPER_PORTAL_BILLING',
              },
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
            include: {
              app: {
                select: {
                  id: true,
                  clientId: true,
                  name: true,
                  description: true,
                  logoUrl: true,
                  isVerified: true,
                },
              },
            },
          });

          if (session && (session as any).app) {
            (session as any).app.name = platformApp.name;
            (session as any).app.isVerified = true;
          }
        }
      } catch (autoHealErr) {
        console.warn('[CheckoutService:getSession] Could not auto-heal sess_dev_ session:', autoHealErr);
      }
    }

    // Auto-heal Wallet Top-up checkout sessions if not already in DB
    if (!session && sessionId.startsWith('sess_topup_')) {
      try {
        const platformApp = await CheckoutService.resolvePlatformOAuthApp();

        if (platformApp) {
          session = await prisma.checkoutSession.create({
            data: {
              id: sessionId,
              appId: platformApp.id,
              amount: 1000,
              originalAmount: 1000,
              currency: 'INR',
              status: 'PENDING',
              mode: 'payment',
              title: 'Top-Up Prepaid Wallet',
              description: 'Universal 180 Pay Ledger Top-up',
              metadata: {
                isTopUp: true,
                allowCustomAmount: true,
                purpose: 'wallet_topup',
              },
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
            include: {
              app: {
                select: {
                  id: true,
                  clientId: true,
                  name: true,
                  description: true,
                  logoUrl: true,
                  isVerified: true,
                },
              },
            },
          });

          if (session && (session as any).app) {
            (session as any).app.name = platformApp.name;
            (session as any).app.isVerified = true;
          }
        }
      } catch (autoHealErr) {
        console.warn('[CheckoutService:getSession] Could not auto-heal sess_topup_ session:', autoHealErr);
      }
    }

    // Auto-resolve or auto-create checkout session for Payment Links by slug or ID
    if (!session) {
      try {
        const paymentLink = await prisma.paymentLink.findFirst({
          where: {
            OR: [
              { slug: sessionId },
              { id: sessionId },
            ],
            isActive: true,
          },
          include: {
            app: {
              select: {
                id: true,
                name: true,
                description: true,
                logoUrl: true,
                isVerified: true,
              },
            },
          },
        });

        if (paymentLink) {
          if (paymentLink.maxPurchases && paymentLink.purchasesCount >= paymentLink.maxPurchases) {
            throw new Error('This payment link has reached its maximum purchase capacity and is sold out.');
          }

          const linkExpiry = (paymentLink as any).expiresAt;
          if (linkExpiry && new Date(linkExpiry) < new Date()) {
            throw new Error('This payment link has expired.');
          }

          const activeSessions = await prisma.checkoutSession.findMany({
            where: {
              appId: paymentLink.appId,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            include: {
              app: {
                select: {
                  id: true,
                  clientId: true,
                  name: true,
                  description: true,
                  logoUrl: true,
                  isVerified: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });

          const matchingSession = activeSessions.find(
            (s) => (s.metadata as any)?.paymentLinkId === paymentLink.id || (s.metadata as any)?.paymentLinkSlug === paymentLink.slug
          );

          if (matchingSession) {
            session = matchingSession;
          } else {
            const isCustomAmount = Number(paymentLink.amount) === 0 || Boolean((paymentLink as any).allowCustomAmount) || Boolean((paymentLink.metadata as any)?.allowCustomAmount);
            session = await prisma.checkoutSession.create({
              data: {
                appId: paymentLink.appId,
                amount: paymentLink.amount,
                originalAmount: paymentLink.amount,
                currency: (paymentLink.currency || 'INR').toUpperCase(),
                status: 'PENDING',
                title: paymentLink.title,
                description: paymentLink.description || '',
                metadata: {
                  paymentLinkId: paymentLink.id,
                  paymentLinkSlug: paymentLink.slug,
                  source: 'PAYMENT_LINK',
                  allowCoupons: paymentLink.allowCoupons,
                  allowCustomAmount: isCustomAmount,
                  collectPhone: paymentLink.collectPhone,
                  collectAddress: paymentLink.collectAddress,
                },
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
              },
              include: {
                app: {
                  select: {
                    id: true,
                    clientId: true,
                    name: true,
                    description: true,
                    logoUrl: true,
                    isVerified: true,
                  },
                },
              },
            });
          }
        }
      } catch (linkHealErr: any) {
        if (linkHealErr.message && (linkHealErr.message.includes('capacity') || linkHealErr.message.includes('expired'))) {
          throw linkHealErr;
        }
        console.warn('[CheckoutService:getSession] Could not auto-resolve payment link session:', linkHealErr);
      }
    }

    // Auto-heal or JIT-persist client-side / sandbox / demo / SDK sessions if not yet in DB
    if (!session && (sessionId.startsWith('sess_') || sessionId.startsWith('cs_') || sessionId === 'default' || fallbackData)) {
      try {
        const platformApp = await CheckoutService.resolvePlatformOAuthApp();
        const targetAppId = fallbackData?.appId || (platformApp ? platformApp.id : null);
        const targetAmount = typeof fallbackData?.targetAmount === 'number' && fallbackData.targetAmount > 0
          ? fallbackData.targetAmount
          : (typeof fallbackData?.amount === 'number' && fallbackData.amount > 0 ? fallbackData.amount : 49.0);
        const targetCurrency = String(fallbackData?.targetCurrency || fallbackData?.currency || 'USD').toUpperCase();
        const targetTitle = fallbackData?.title || '180 Pay Checkout';
        const targetDesc = fallbackData?.description || 'Sandbox verification session';

        if (targetAppId) {
          session = await prisma.checkoutSession.create({
            data: {
              id: sessionId === 'default' ? `sess_${crypto.randomBytes(8).toString('hex')}` : sessionId,
              appId: targetAppId,
              amount: targetAmount,
              originalAmount: targetAmount,
              currency: targetCurrency,
              status: 'PENDING',
              mode: 'payment',
              title: targetTitle,
              description: targetDesc,
              returnUrl: fallbackData?.returnUrl || '',
              cancelUrl: fallbackData?.cancelUrl || '',
              metadata: {
                isSandbox: true,
                autoCreated: true,
                ...(fallbackData?.metadata || {}),
              },
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
            include: {
              app: {
                select: {
                  id: true,
                  clientId: true,
                  name: true,
                  description: true,
                  logoUrl: true,
                  isVerified: true,
                },
              },
            },
          });
        }
      } catch (autoCreateErr) {
        console.warn('[CheckoutService:getSession] Could not auto-create JIT session:', autoCreateErr);
      }
    }

    if (!session) {
      throw new Error('Checkout session not found');
    }

    // 1. If session has an active gateway order and is not yet CAPTURED, ALWAYS attempt live reconciliation FIRST!
    // This guarantees that if a customer completed payment in UPI / bank app, the session is captured immediately,
    // even if client callbacks dropped or the nominal 30-minute window passed while user was completing 3DS/UPI.
    if (
      session.status !== 'CAPTURED' &&
      ((session.metadata as any)?.razorpayOrderId || (session.metadata as any)?.stripePaymentIntentId)
    ) {
      try {
        const reconcileRes = await this.reconcileSession(session.id);
        if (reconcileRes.reconciled && reconcileRes.session) {
          return {
            ...reconcileRes.session,
            isExpired: false,
          };
        }
      } catch (recErr: any) {
        console.warn('[CheckoutService:getSession] Reconciliation check warning:', recErr.message);
      }
    }

    // 2. Active checkout interaction resiliency: if session is PENDING or was EXPIRED without charge,
    // auto-renew it by 30 minutes to guarantee ZERO payment drops while customer is actively on checkout!
    if (session.status === 'PENDING' && session.expiresAt < new Date()) {
      const renewedExpiry = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { expiresAt: renewedExpiry },
      }).catch(() => {});
      session.expiresAt = renewedExpiry;
    } else if (session.status === 'EXPIRED') {
      const renewedExpiry = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'PENDING', expiresAt: renewedExpiry },
      }).catch(() => {});
      session.status = 'PENDING';
      session.expiresAt = renewedExpiry;
    }

    return {
      ...session,
      isExpired: false,
    };
  }

  /**
   * Actively reconciles a checkout session against Razorpay / Stripe.
   * If a payment was authorized or captured at the gateway, captures the session,
   * credits the developer app wallet, writes ledger records, fulfills any payment link,
   * and dispatches webhooks.
   */
  static async reconcileSession(sessionId: string): Promise<{
    reconciled: boolean;
    alreadyCaptured?: boolean;
    session: any;
    transactionId?: string;
  }> {
    let session = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: {
        app: true,
      },
    });

    if (!session) {
      throw new Error(`Checkout session ${sessionId} not found`);
    }

    if (session.status === 'CAPTURED') {
      return { reconciled: false, alreadyCaptured: true, session };
    }

    const sessionMeta = (session.metadata as any) || {};

    // 1. Reconcile Razorpay Order if present
    const razorpayOrderId = sessionMeta.razorpayOrderId;
    if (razorpayOrderId && razorpayOrderId.startsWith('order_')) {
      const { keyId, keySecret } = this.resolveGatewayConfig(session.app);
      if (keyId && keySecret && !keySecret.includes('simulated')) {
        try {
          const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const rzpRes = await axios.get(`https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`, {
            headers: { Authorization: `Basic ${auth}` },
            timeout: 5000,
          });
          const items = rzpRes.data?.items || [];
          let targetPayment = items.find((p: any) => p.status === 'captured');

          // If authorized but not captured, auto-capture it directly via Razorpay API
          if (!targetPayment) {
            const authorizedPayment = items.find((p: any) => p.status === 'authorized');
            if (authorizedPayment) {
              try {
                const capRes = await axios.post(
                  `https://api.razorpay.com/v1/payments/${authorizedPayment.id}/capture`,
                  {
                    amount: authorizedPayment.amount,
                    currency: authorizedPayment.currency,
                  },
                  {
                    headers: { Authorization: `Basic ${auth}` },
                    timeout: 5000,
                  }
                );
                if (capRes.data?.status === 'captured') {
                  targetPayment = capRes.data;
                }
              } catch (capErr: any) {
                console.warn('[CheckoutService:reconcileSession] Failed to auto-capture authorized payment:', capErr.message);
              }
            }
          }

          if (targetPayment) {
            await this.verifyDirectPayment({
              sessionId: session.id,
              orderId: razorpayOrderId,
              paymentId: targetPayment.id,
              signature: 'auto_polled_capture',
            });

            const refreshed = await prisma.checkoutSession.findUnique({
              where: { id: session.id },
              include: {
                app: {
                  select: {
                    id: true,
                    clientId: true,
                    name: true,
                    description: true,
                    logoUrl: true,
                    isVerified: true,
                  },
                },
              },
            });

            return {
              reconciled: true,
              alreadyCaptured: false,
              session: refreshed,
              transactionId: targetPayment.id,
            };
          }
        } catch (rzpErr: any) {
          console.warn('[CheckoutService:reconcileSession] Razorpay query error:', rzpErr.message);
        }
      }
    }

    // 2. Reconcile Stripe PaymentIntent if present
    const stripePiId = sessionMeta.stripePaymentIntentId;
    if (stripePiId && stripePiId.startsWith('pi_')) {
      const { keySecret } = this.resolveGatewayConfig(session.app);
      if (keySecret && !keySecret.includes('simulated') && keySecret.startsWith('sk_')) {
        try {
          const stripeRes = await axios.get(`https://api.stripe.com/v1/payment_intents/${stripePiId}`, {
            headers: { Authorization: `Bearer ${keySecret}` },
            timeout: 5000,
          });
          const pi = stripeRes.data;
          if (pi.status === 'succeeded' || pi.status === 'requires_capture') {
            await this.verifyDirectPayment({
              sessionId: session.id,
              orderId: stripePiId,
              paymentId: pi.latest_charge || stripePiId,
              signature: 'auto_polled_capture',
            });

            const refreshed = await prisma.checkoutSession.findUnique({
              where: { id: session.id },
              include: {
                app: {
                  select: {
                    id: true,
                    clientId: true,
                    name: true,
                    description: true,
                    logoUrl: true,
                    isVerified: true,
                  },
                },
              },
            });

            return {
              reconciled: true,
              alreadyCaptured: false,
              session: refreshed,
              transactionId: pi.latest_charge || stripePiId,
            };
          }
        } catch (stripeErr: any) {
          console.warn('[CheckoutService:reconcileSession] Stripe query error:', stripeErr.message);
        }
      }
    }

    return { reconciled: false, session };
  }

  /**
   * Scans and auto-reconciles all recent PENDING or EXPIRED sessions that have gateway orders.
   * Invoked periodically by the background reconciler worker or administrative repair scripts.
   */
  static async reconcilePendingSessions(limit: number = 50): Promise<{
    scanned: number;
    reconciledCount: number;
    reconciledIds: string[];
  }> {
    const candidateSessions = await prisma.checkoutSession.findMany({
      where: {
        status: { in: ['PENDING', 'EXPIRED'] },
        createdAt: { gt: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // last 48 hours
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, metadata: true },
    });

    const sessionsWithOrders = candidateSessions.filter((s) => {
      const meta = (s.metadata as any) || {};
      return Boolean(meta.razorpayOrderId || meta.stripePaymentIntentId);
    });

    let reconciledCount = 0;
    const reconciledIds: string[] = [];

    for (const item of sessionsWithOrders) {
      try {
        const res = await this.reconcileSession(item.id);
        if (res.reconciled) {
          reconciledCount++;
          reconciledIds.push(item.id);
          console.log(`[Reconciler] Auto-reconciled stranded payment for session: ${item.id}`);
        }
      } catch (err: any) {
        // continue scanning
      }
    }

    return {
      scanned: sessionsWithOrders.length,
      reconciledCount,
      reconciledIds,
    };
  }

  /**
   * Alias for captureSession - authenticates and executes payment from user's sovereign wallet
   */
  static async processPayment(sessionId: string, userId: string) {
    return this.captureSession(sessionId, userId);
  }

  /**
   * Captures payment from the user's sovereign wallet and completes the session
   */
  static async captureSession(sessionId: string, userId: string) {
    const targetSession = await this.getSession(sessionId);

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Lock and verify session
      const session = await tx.checkoutSession.findUnique({
        where: { id: targetSession.id },
        include: { app: true },
      });

      if (!session) {
        throw new Error('Checkout session not found');
      }

      if (session.status === 'CAPTURED') {
        throw new Error('This checkout session has already been completed.');
      }

      if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
        throw new Error('This checkout session has expired. Please create a new one.');
      }

      if (session.status !== 'PENDING') {
        throw new Error(`Cannot capture session with status: ${session.status}`);
      }

      // 2. Fetch User Wallet inside transaction
      let userWallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!userWallet) {
        userWallet = await tx.wallet.create({
          data: {
            userId,
            balance: 0,
            currency: 'INR',
          },
        });
      }

      if (userWallet.isLocked) {
        throw new Error('User wallet is locked. Please contact support.');
      }

      if (userWallet.balance < session.amount) {
        throw new Error(
          `Insufficient wallet balance. You have ₹${userWallet.balance.toFixed(2)} but this purchase requires ₹${session.amount.toFixed(2)}.`
        );
      }

      // 3. Fetch Developer App Wallet inside transaction
      let appWallet = await tx.wallet.findUnique({
        where: { developerAppId: session.appId },
      });

      if (!appWallet) {
        appWallet = await tx.wallet.create({
          data: {
            developerAppId: session.appId,
            balance: 0,
            currency: 'INR',
          },
        });
      }

      // 4. Double-Entry Atomic Balance Updates
      const newUserBalance = Math.round((userWallet.balance - session.amount) * 100) / 100;
      await tx.wallet.update({
        where: { id: userWallet.id },
        data: { balance: newUserBalance },
      });

      const userLedger = await tx.ledgerEntry.create({
        data: {
          walletId: userWallet.id,
          amount: -session.amount,
          balanceAfter: newUserBalance,
          type: 'CHECKOUT_PAY',
          referenceId: session.id,
          description: `Payment to ${session.app.name} (${session.title})`,
          metadata: {
            sessionId: session.id,
            appId: session.appId,
            appName: session.app.name,
          },
        },
      });

      const newAppBalance = Math.round((appWallet.balance + session.amount) * 100) / 100;
      await tx.wallet.update({
        where: { id: appWallet.id },
        data: { balance: newAppBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: appWallet.id,
          amount: session.amount,
          balanceAfter: newAppBalance,
          type: 'CHECKOUT_RECEIVE',
          referenceId: session.id,
          description: `Customer payment received for ${session.title}`,
          metadata: {
            sessionId: session.id,
            userId,
          },
        },
      });

      // 5. Mark Checkout Session as CAPTURED
      const updatedSession = await tx.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'CAPTURED',
          userId,
          completedAt: new Date(),
        },
      });

      // 5.1 Activate recurring subscription if session was created in subscription mode
      if (session.mode === 'subscription') {
        try {
          await SubscriptionService.activateSubscriptionFromSession(session.id, userId, tx);
        } catch (subErr: any) {
          console.warn('[CheckoutService] Failed to activate subscription from session:', subErr.message);
        }
      }

      return {
        session: updatedSession,
        userLedgerId: userLedger.id,
        newUserBalance,
      };
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    // 6. Asynchronous Webhook Dispatch with Backoff & Timestamp Signatures
    // Dispatches both 'payment.captured' (standard) and 'payment.succeeded' (compatibility alias)
    const session = result.session;
    const webhookData = {
      sessionId: session.id,
      transactionId: result.userLedgerId,
      amount: session.amount,
      currency: session.currency,
      title: session.title,
      metadata: session.metadata,
      userId,
      timestamp: new Date().toISOString(),
    };

    Promise.allSettled([
      this.dispatchPaymentWebhook(session.appId, {
        event: 'payment.captured',
        data: webhookData,
      }),
      this.dispatchPaymentWebhook(session.appId, {
        event: 'payment.succeeded',
        data: webhookData,
      }),
    ]).catch((err) => {
      console.warn('[CheckoutService] Failed to dispatch webhook:', err.message);
    });

    return {
      success: true,
      session: result.session,
      transactionId: result.userLedgerId,
      remainingBalance: result.newUserBalance,
      returnUrl: session.returnUrl,
    };
  }

  /**
   * Helper to dispatch signed webhooks with timestamped HMAC-SHA256 signatures & retries
   */
  private static async dispatchPaymentWebhook(appId: string, payload: any) {
    const app = await prisma.oAuthApp.findUnique({
      where: { id: appId },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadString = JSON.stringify(payload);
    const signPayload = `${timestamp}.${payloadString}`;

    // Helper for safe single delivery attempt with 1 retry
    const deliverWithRetry = async (url: string, secret: string, endpointId?: string) => {
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signPayload)
        .digest('hex');

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
          response = await axios.post(url, payload, { headers, timeout: 8000 });
          break; // Success
        } catch (err: any) {
          lastError = err;
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1000)); // 1s backoff before retry
          }
        }
      }

      if (endpointId) {
        if (response) {
          await prisma.webhookDelivery.create({
            data: {
              endpointId,
              event: payload.event,
              payload: payloadString,
              statusCode: response.status,
              response: typeof response.data === 'string' ? response.data.slice(0, 1000) : JSON.stringify(response.data).slice(0, 1000),
              deliveredAt: new Date(),
            },
          }).catch(() => {});
        } else {
          await prisma.webhookDelivery.create({
            data: {
              endpointId,
              event: payload.event,
              payload: payloadString,
              statusCode: lastError?.response?.status || null,
              error: lastError?.message?.slice(0, 1000) || 'Webhook delivery failed after retry',
            },
          }).catch(() => {});
        }
      }
    };

    // 1. Direct App Webhook URL
    if (app && (app as any).webhookUrl && (app as any).webhookUrl.startsWith('http')) {
      const signingSecret = (app as any).webhookSecret || app.clientSecretHash;
      deliverWithRetry((app as any).webhookUrl, signingSecret).catch((err) => {
        console.warn(`[CheckoutService] Direct webhook failed:`, err.message);
      });
    }

    // 2. Multi-Endpoint Webhook records
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { appId, isActive: true },
    });

    for (const endpoint of endpoints) {
      deliverWithRetry(endpoint.url, endpoint.secret, endpoint.id).catch((err) => {
        console.warn(`[CheckoutService] Endpoint webhook failed:`, err.message);
      });
    }
  }

  /**
   * Resolves the payment gateway credentials and type based on:
   * 1. Developer App Bring Your Own Gateway (BYOG) settings (Highest priority)
   * 2. Platform-wide environment variables (PAYMENT_GATEWAY="STRIPE" or "RAZORPAY")
   */
  public static resolveGatewayConfig(app?: any): {
    gatewayType: 'RAZORPAY' | 'STRIPE';
    keyId: string;
    keySecret: string;
    webhookSecret?: string;
    isCustomBYOG: boolean;
  } {
    const appAny = app || {};

    // 1. Priority 1: Developer App Custom Gateway (BYOG)
    if (appAny.customGatewayType === 'STRIPE' && (appAny.customGatewayKeyId || appAny.customGatewaySecret)) {
      return {
        gatewayType: 'STRIPE',
        keyId: appAny.customGatewayKeyId || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_KEY_ID || '',
        keySecret: appAny.customGatewaySecret || process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: appAny.customGatewayWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET,
        isCustomBYOG: true,
      };
    }

    if (appAny.customGatewayType === 'RAZORPAY' && appAny.customGatewayKeyId && appAny.customGatewaySecret) {
      return {
        gatewayType: 'RAZORPAY',
        keyId: appAny.customGatewayKeyId,
        keySecret: appAny.customGatewaySecret,
        webhookSecret: appAny.customGatewayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET,
        isCustomBYOG: true,
      };
    }

    // 2. Priority 2: Platform-level Gateway from Environment Variables
    const envGateway = (process.env.PAYMENT_GATEWAY || '').toUpperCase().trim();
    const hasStripeSecret = Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY_SECRET);
    const hasRazorpaySecret = Boolean(process.env.RAZORPAY_KEY_SECRET);

    if (envGateway === 'STRIPE' || (hasStripeSecret && !hasRazorpaySecret)) {
      const keyId =
        process.env.STRIPE_PUBLISHABLE_KEY ||
        process.env.STRIPE_KEY_ID ||
        process.env.NEXT_PUBLIC_STRIPE_KEY ||
        '';
      const keySecret =
        process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_KEY_SECRET ||
        '';
      return {
        gatewayType: 'STRIPE',
        keyId,
        keySecret,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        isCustomBYOG: false,
      };
    }

    // Default Platform: Razorpay
    let keyId = (process.env.RAZORPAY_KEY_ID || '').trim().replace(/^['"]|['"]$/g, '');
    let keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/^['"]|['"]$/g, '');

    if (!keyId || !keySecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Razorpay platform credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing from environment variables.');
      }
    }

    return {
      gatewayType: 'RAZORPAY',
      keyId,
      keySecret,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
      isCustomBYOG: false,
    };
  }

  private static methodsCache: Map<string, { data: any; expiresAt: number }> = new Map();

  /**
   * Fetches supported payment methods dynamically from the gateway (Razorpay / Stripe).
   * Supports dynamic banks, card networks, and country-specific ordering without hardcoding.
   */
  static async getPaymentMethods(app?: any, currency: string = 'INR', countryCode?: string) {
    const { gatewayType, keyId } = this.resolveGatewayConfig(app);

    const cacheKey = `${gatewayType}_${keyId}_${currency}_${countryCode || ''}`;
    const cached = this.methodsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const isIndia = (currency || '').toUpperCase() === 'INR' || (countryCode || '').toUpperCase() === 'IN';

    // 1. If Gateway is STRIPE
    if (gatewayType === 'STRIPE') {
      const stripeMethods = {
        gateway: 'STRIPE',
        isIndia,
        defaultMethod: 'CARD',
        priorityOrder: ['CARD', 'NETBANKING'],
        supportsUpi: false, // Stripe does not support Indian UPI by default
        supportsCard: true,
        supportsNetbanking: false,
        cardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'DINERS', 'JCB'],
        banks: [],
        popularBanks: [],
      };
      this.methodsCache.set(cacheKey, { data: stripeMethods, expiresAt: Date.now() + 3600 * 1000 });
      return stripeMethods;
    }

    // 2. Gateway is RAZORPAY
    let rzpMethodsData: any = null;
    if (keyId && !keyId.includes('simulated')) {
      try {
        const auth = Buffer.from(`${keyId}:`).toString('base64');
        const rzpRes = await axios.get('https://api.razorpay.com/v1/methods', {
          headers: { Authorization: `Basic ${auth}` },
          timeout: 4000,
        });
        rzpMethodsData = rzpRes.data;
      } catch (err: any) {
        console.warn('[CheckoutService:getPaymentMethods] Razorpay live fetch error:', err?.message);
      }
    }

    const netbankingObj = rzpMethodsData?.netbanking || {};
    const popularCodes = ['HDFC', 'SBIN', 'ICIC', 'UTIB', 'KKBK', 'PUNB_R', 'BARB_R', 'YESB', 'IDFB', 'AIRP'];

    // Map all Razorpay netbanking banks
    const banks = Object.entries(netbankingObj).map(([code, name]: [string, any]) => ({
      code,
      name: String(name),
      short: code.replace(/_R|_C/g, ''),
      popular: popularCodes.includes(code),
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Popular banks list
    const popularBanks = banks.filter(b => b.popular);

    // Active Card networks
    const cardNetworksMap = rzpMethodsData?.card_networks || {};
    const supportedCardNetworks = Object.keys(cardNetworksMap).filter(k => cardNetworksMap[k] > 0);

    const supportsUpi = isIndia && Boolean(rzpMethodsData?.upi !== false);

    const methodsResult = {
      gateway: 'RAZORPAY',
      isIndia,
      defaultMethod: isIndia && supportsUpi ? 'UPI' : 'CARD',
      priorityOrder: isIndia && supportsUpi
        ? ['UPI', 'CARD', 'NETBANKING']
        : supportsUpi
        ? ['CARD', 'NETBANKING', 'UPI']
        : ['CARD', 'NETBANKING'],
      supportsUpi,
      supportsCard: Boolean(rzpMethodsData?.card !== false),
      supportsNetbanking: banks.length > 0 || Boolean(rzpMethodsData?.netbanking),
      cardNetworks: supportedCardNetworks.length > 0 ? supportedCardNetworks : ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX'],
      banks,
      popularBanks,
    };

    this.methodsCache.set(cacheKey, { data: methodsResult, expiresAt: Date.now() + 3600 * 1000 });
    return methodsResult;
  }

  /**
   * Creates a direct gateway order (Razorpay Order or Stripe PaymentIntent)
   * for guest or direct in-sheet checkout.
   */
  static async createDirectOrder(
    sessionId: string,
    options?: {
      targetCurrency?: string;
      targetAmount?: number;
      title?: string;
      description?: string;
      appId?: string;
      returnUrl?: string;
      cancelUrl?: string;
      metadata?: any;
    }
  ) {
    const session = await this.getSession(sessionId, options);

    if (session.status === 'CAPTURED') {
      throw new Error('This checkout session has already been completed.');
    }

    if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
      throw new Error('This checkout session has expired.');
    }

    const { gatewayType, keyId, keySecret } = this.resolveGatewayConfig(session.app);
    const sessionMeta = (session.metadata as any) || {};

    // 1. Determine target currency and amount with multi-currency conversion
    const targetCurrency = String(
      options?.targetCurrency || sessionMeta.appliedCurrency || session.currency || 'INR'
    ).toUpperCase();

    let targetAmount =
      typeof options?.targetAmount === 'number' && options.targetAmount > 0
        ? options.targetAmount
        : session.amount;

    // Convert targetAmount if targetCurrency differs from session.currency and explicit targetAmount wasn't provided
    if (
      options?.targetCurrency &&
      options.targetCurrency.toUpperCase() !== (session.currency || '').toUpperCase() &&
      (!options.targetAmount || options.targetAmount === session.amount)
    ) {
      targetAmount = GeoPricingService.convertCurrency(
        session.amount,
        session.currency || 'USD',
        targetCurrency
      );
    }

    // Only allow custom amount mutation if the session explicitly allows custom amounts (e.g. wallet top-ups)
    const isCustomAmountAllowed = Boolean(
      sessionMeta.allowCustomAmount ||
      (session.metadata as any)?.allowCustomAmount ||
      sessionId.startsWith('sess_topup_')
    );

    if (
      isCustomAmountAllowed &&
      options?.targetAmount &&
      options.targetAmount > 0
    ) {
      const baseSessionAmount =
        targetCurrency !== (session.currency || 'USD').toUpperCase()
          ? GeoPricingService.convertCurrency(options.targetAmount, targetCurrency, session.currency || 'USD')
          : options.targetAmount;

      if (Math.abs(session.amount - baseSessionAmount) > 0.001) {
        await prisma.checkoutSession.update({
          where: { id: sessionId },
          data: {
            amount: baseSessionAmount,
            originalAmount: session.originalAmount || baseSessionAmount,
          },
        }).catch(() => {});
        session.amount = baseSessionAmount;
      }
    }

    let amountSmallestUnit =
      targetCurrency === 'JPY' ? Math.round(targetAmount) : Math.round(targetAmount * 100);

    // Gateway constraints: Razorpay requires min ₹1.00 (100 paise), Stripe min $0.50 (50 cents)
    if (targetCurrency === 'INR' && amountSmallestUnit < 100) {
      amountSmallestUnit = 100;
    } else if (targetCurrency === 'USD' && amountSmallestUnit < 50) {
      amountSmallestUnit = 50;
    }

    // 1. STRIPE GATEWAY ROUTE
    if (gatewayType === 'STRIPE') {
      // Fast-path idempotency cache: If Stripe PaymentIntent was already created for this amount & key, reuse it!
      if (
        sessionMeta.stripePaymentIntentId &&
        sessionMeta.stripeAmountSmallestUnit === amountSmallestUnit &&
        sessionMeta.stripeCurrency === targetCurrency &&
        sessionMeta.stripeKeyId === keyId
      ) {
        return {
          orderId: sessionMeta.stripePaymentIntentId,
          clientSecret: sessionMeta.stripeClientSecret,
          amountPaise: amountSmallestUnit,
          currency: targetCurrency,
          keyId,
          gatewayType: 'STRIPE',
        };
      }

      // If simulated or test key in dev mode without live Stripe connection
      if (
        keySecret.includes('simulated') ||
        keySecret.includes('test_simulated') ||
        keyId.includes('simulated')
      ) {
        const simPiId = `pi_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const simClientSecret = `${simPiId}_secret_${Math.random().toString(36).slice(2, 10)}`;
        return {
          orderId: simPiId,
          clientSecret: simClientSecret,
          amountPaise: amountSmallestUnit,
          currency: targetCurrency,
          keyId,
          gatewayType: 'STRIPE',
        };
      }

      // Real Stripe PaymentIntent via Stripe REST API
      const params = new URLSearchParams();
      params.append('amount', String(amountSmallestUnit));
      params.append('currency', targetCurrency.toLowerCase());
      params.append('description', `Order for ${session.title} (${session.id})`);
      params.append('metadata[sessionId]', session.id);
      params.append('metadata[appId]', session.appId);
      params.append('metadata[appName]', session.app?.name || '180 App');
      params.append('metadata[title]', session.title);
      params.append('automatic_payment_methods[enabled]', 'true');

      const stripeResponse = await axios.post(
        'https://api.stripe.com/v1/payment_intents',
        params.toString(),
        {
          headers: {
            Authorization: `Bearer ${keySecret}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      const pi = stripeResponse.data;

      try {
        await prisma.checkoutSession.update({
          where: { id: sessionId },
          data: {
            metadata: {
              ...sessionMeta,
              stripePaymentIntentId: pi.id,
              stripeClientSecret: pi.client_secret,
              stripeAmountSmallestUnit: amountSmallestUnit,
              stripeCurrency: targetCurrency,
              stripeKeyId: keyId,
              gateway: 'STRIPE',
            },
          },
        });
      } catch (metaErr: any) {
        console.warn('[CheckoutService:createDirectOrder] Could not cache Stripe metadata:', metaErr?.message);
      }

      return {
        orderId: pi.id,
        clientSecret: pi.client_secret,
        amountPaise: amountSmallestUnit,
        currency: targetCurrency,
        keyId,
        gatewayType: 'STRIPE',
      };
    }

    // 2. RAZORPAY GATEWAY ROUTE
    // Fast-path idempotency cache: Check orderId, amountPaise, TARGET CURRENCY, and keyId!
    if (
      sessionMeta.razorpayOrderId &&
      sessionMeta.razorpayAmountPaise === amountSmallestUnit &&
      sessionMeta.razorpayCurrency === targetCurrency &&
      sessionMeta.razorpayKeyId === keyId
    ) {
      return {
        orderId: sessionMeta.razorpayOrderId,
        amountPaise: amountSmallestUnit,
        currency: targetCurrency,
        keyId,
        gatewayType: 'RAZORPAY',
      };
    }

    // If simulated / dummy platform key, generate simulated order without remote network call
    if (keyId.includes('simulated') || keyId.includes('mock_') || !keySecret || keySecret.includes('simulated')) {
      return {
        orderId: `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        amountPaise: amountSmallestUnit,
        currency: targetCurrency,
        keyId,
        gatewayType: 'RAZORPAY',
      };
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    let rzpResponse;
    try {
      rzpResponse = await axios.post(
        'https://api.razorpay.com/v1/orders',
        {
          amount: amountSmallestUnit,
          currency: targetCurrency,
          receipt: `cs_${session.id.replace(/-/g, '').slice(0, 36)}`,
          payment_capture: 1,
          notes: {
            sessionId: session.id,
            appId: session.appId,
            appName: session.app?.name || '180 App',
            title: session.title,
            currency: targetCurrency,
          },
        },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
    } catch (rzpErr: any) {
      const errorData = rzpErr.response?.data?.error;
      const errorDesc = errorData?.description || rzpErr.message;
      console.warn(`[Razorpay Order Error for ${targetCurrency}]:`, errorDesc);

      // If non-INR currency fails on merchant account, seamlessly fallback to INR
      if (targetCurrency !== 'INR') {
        const inrAmount = GeoPricingService.convertCurrency(targetAmount, targetCurrency, 'INR');
        const inrPaise = Math.max(100, Math.round(inrAmount * 100));
        console.log(`[Razorpay Fallback] Retrying order creation in INR (${inrPaise} paise)...`);
        try {
          rzpResponse = await axios.post(
            'https://api.razorpay.com/v1/orders',
            {
              amount: inrPaise,
              currency: 'INR',
              receipt: `cs_${session.id.replace(/-/g, '').slice(0, 36)}`,
              payment_capture: 1,
              notes: {
                sessionId: session.id,
                appId: session.appId,
                appName: session.app?.name || '180 App',
                title: session.title,
                currency: 'INR',
                originalCurrency: targetCurrency,
                originalAmount: String(targetAmount),
              },
            },
            {
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            }
          );
        } catch (inrErr: any) {
          const inrErrorDesc = inrErr.response?.data?.error?.description || inrErr.message;
          const sanitizedErr = inrErrorDesc === 'Authentication failed'
            ? 'Payment gateway authorization failed. Please check merchant account credentials.'
            : inrErrorDesc || 'Failed to initialize payment with Razorpay';
          throw new Error(sanitizedErr);
        }
      } else {
        const sanitizedErr = errorDesc === 'Authentication failed'
          ? 'Payment gateway authorization failed. Please check merchant account credentials.'
          : errorDesc || 'Failed to initialize payment with Razorpay';
        throw new Error(sanitizedErr);
      }
    }

    const actualOrderId = rzpResponse.data.id;
    const actualAmountPaise = rzpResponse.data.amount;
    const actualCurrency = rzpResponse.data.currency;

    // Persist prewarmed/created order with EXACT currency & amountPaise to avoid mismatches
    try {
      await prisma.checkoutSession.update({
        where: { id: sessionId },
        data: {
          metadata: {
            ...sessionMeta,
            razorpayOrderId: actualOrderId,
            razorpayAmountPaise: actualAmountPaise,
            razorpayCurrency: actualCurrency,
            razorpayKeyId: keyId,
            gateway: 'RAZORPAY',
          },
        },
      });
    } catch (metaErr: any) {
      console.warn('[CheckoutService:createDirectOrder] Could not cache order metadata:', metaErr?.message);
    }

    return {
      orderId: actualOrderId,
      amountPaise: actualAmountPaise,
      currency: actualCurrency,
      keyId,
      gatewayType: 'RAZORPAY',
    };
  }

  private static inFlightVerifications = new Map<string, Promise<any>>();

  /**
   * Cryptographically verifies payment (Razorpay HMAC or Stripe PaymentIntent) and captures session.
   * Employs atomic in-flight promise deduplication to prevent concurrent transaction deadlocks.
   */
  static async verifyDirectPayment(input: {
    sessionId: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }): Promise<any> {
    const { sessionId } = input;
    if (this.inFlightVerifications.has(sessionId)) {
      return await this.inFlightVerifications.get(sessionId)!;
    }

    const verificationPromise = this._doVerifyDirectPayment(input).finally(() => {
      this.inFlightVerifications.delete(sessionId);
    });

    this.inFlightVerifications.set(sessionId, verificationPromise);
    return await verificationPromise;
  }

  private static async _doVerifyDirectPayment(input: {
    sessionId: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    const { sessionId, orderId, paymentId, signature } = input;

    let session = await this.getSession(sessionId);

    const { gatewayType, keySecret } = this.resolveGatewayConfig(session.app);
    const isStripe = gatewayType === 'STRIPE' || orderId.startsWith('pi_') || paymentId.startsWith('pi_');

    if (isStripe) {
      // Stripe verification: verify payment intent status
      if (
        !keySecret.includes('simulated') &&
        !keySecret.includes('test_simulated') &&
        keySecret.startsWith('sk_')
      ) {
        try {
          const piId = orderId.startsWith('pi_') ? orderId : paymentId;
          const stripeCheck = await axios.get(`https://api.stripe.com/v1/payment_intents/${piId}`, {
            headers: { Authorization: `Bearer ${keySecret}` },
            timeout: 8000,
          });
          const piStatus = stripeCheck.data?.status;
          if (piStatus !== 'succeeded' && piStatus !== 'requires_capture' && piStatus !== 'processing') {
            throw new Error(`Stripe PaymentIntent is in uncaptured status: ${piStatus}`);
          }
        } catch (sErr: any) {
          if (sErr.response?.data?.error?.message) {
            throw new Error(`Stripe verification failed: ${sErr.response.data.error.message}`);
          }
          throw sErr;
        }
      }
    } else {
      // Razorpay HMAC-SHA256 signature verification
      if (!keySecret) {
        throw new Error('Payment gateway key secret not configured');
      }

      const hasLiveKey = Boolean(keySecret && !keySecret.includes('simulated'));
      const isTestMock = !hasLiveKey && (orderId?.startsWith('order_sim_') || signature === 'mock_sig_sandbox');

      if (!isTestMock && signature !== 'auto_polled_capture') {
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        let isValid = timingSafeCompare(expectedSignature, signature);

        // Fallback 1: check with platform environment key secret if different
        if (!isValid && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET !== keySecret) {
          const envExpected = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
          if (timingSafeCompare(envExpected, signature)) {
            isValid = true;
          }
        }

        // Fallback 2: Authoritative Live Razorpay API Verification
        // If HMAC verification has any mismatch due to merchant BYOG keys vs platform key,
        // query Razorpay directly via REST API with orderId & paymentId
        if (!isValid && paymentId && paymentId.startsWith('pay_')) {
          try {
            const activeKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
            const activeKeySec = (process.env.RAZORPAY_KEY_SECRET || keySecret || '').trim();
            if (activeKeyId && activeKeySec) {
              const auth = Buffer.from(`${activeKeyId}:${activeKeySec}`).toString('base64');
              const rzpPayRes = await axios.get(`https://api.razorpay.com/v1/payments/${paymentId}`, {
                headers: { Authorization: `Basic ${auth}` },
                timeout: 5000,
              });
              const pData = rzpPayRes.data;
              if (pData && (pData.status === 'captured' || pData.status === 'authorized')) {
                // Verified directly against bank / gateway ledger
                isValid = true;
              }
            }
          } catch (apiErr: any) {
            console.warn('[CheckoutService:verifyDirectPayment] Direct Razorpay API check:', apiErr?.message);
          }
        }

        if (!isValid) {
          throw new Error('Cryptographic signature verification failed');
        }
      }
    }

    const activeGatewayName = isStripe ? 'STRIPE' : 'RAZORPAY';

    const result = await prisma.$transaction(async (tx: any) => {
      const liveSession = await tx.checkoutSession.findUnique({
        where: { id: session.id },
        include: { app: true },
      });

      if (!liveSession) {
        throw new Error('Checkout session not found');
      }

      session = liveSession;

      if (session.status === 'CAPTURED') {
        return { session, transactionId: paymentId, alreadyCaptured: true };
      }

      // Fetch or create Developer App Wallet
      let appWallet = await tx.wallet.findUnique({
        where: { developerAppId: session.appId },
      });

      if (!appWallet) {
        appWallet = await tx.wallet.create({
          data: {
            developerAppId: session.appId,
            balance: 0,
            currency: session.currency || 'INR',
          },
        });
      }

      const newAppBalance = Math.round((appWallet.balance + session.amount) * 100) / 100;
      await tx.wallet.update({
        where: { id: appWallet.id },
        data: { balance: newAppBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: appWallet.id,
          amount: session.amount,
          balanceAfter: newAppBalance,
          type: 'CHECKOUT_RECEIVE',
          referenceId: paymentId,
          description: `Direct payment (${activeGatewayName}) received for ${session.title}`,
          metadata: {
            sessionId: session.id,
            gateway: activeGatewayName,
            orderId,
            paymentId,
          },
        },
      });

      // If this session is a user wallet top-up, credit the user's personal wallet!
      const isTopUp = Boolean(
        (session.metadata as any)?.isTopUp ||
        (session.metadata as any)?.purpose === 'wallet_topup' ||
        session.title?.toLowerCase().includes('top-up') ||
        session.title?.toLowerCase().includes('wallet recharge') ||
        session.id.startsWith('sess_topup_')
      );

      let creditedUserBalance: number | null = null;
      if (isTopUp) {
        let topupUserId = (session.metadata as any)?.userId || (session as any).userId;
        if (!topupUserId) {
          const fallbackUser = await tx.user.findFirst();
          if (fallbackUser) topupUserId = fallbackUser.id;
        }

        if (topupUserId) {
          let userWallet = await tx.wallet.findUnique({
            where: { userId: topupUserId },
          });
          if (!userWallet) {
            userWallet = await tx.wallet.create({
              data: {
                userId: topupUserId,
                balance: 0,
                currency: session.currency || 'INR',
              },
            });
          }
          const newUserBalance = Math.round((userWallet.balance + session.amount) * 100) / 100;
          await tx.wallet.update({
            where: { id: userWallet.id },
            data: { balance: newUserBalance },
          });

          await tx.ledgerEntry.create({
            data: {
              walletId: userWallet.id,
              amount: session.amount,
              balanceAfter: newUserBalance,
              type: 'TOPUP',
              referenceId: paymentId,
              description: `Prepaid Wallet Top-up (${activeGatewayName})`,
              metadata: {
                sessionId: session.id,
                gateway: activeGatewayName,
                orderId,
                paymentId,
              },
            },
          });
          creditedUserBalance = newUserBalance;
        }
      }

      const updatedSession = await tx.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'CAPTURED',
          completedAt: new Date(),
          metadata: {
            ...(session.metadata as any || {}),
            gateway: activeGatewayName,
            paymentId,
            orderId,
            creditedUserBalance,
          },
        },
      });

      return { session: updatedSession, transactionId: paymentId, alreadyCaptured: false, creditedUserBalance };
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    // Dispatch webhook to merchant
    if (!result.alreadyCaptured) {
      if ((result.session.metadata as any)?.paymentLinkId) {
        try {
          const PaymentLinkService = require('../payment-link/payment-link.service').PaymentLinkService;
          const fulfillment = await PaymentLinkService.completeLinkPurchase(
            (result.session.metadata as any).paymentLinkId,
            result.session.id
          );
          if (fulfillment) {
            await prisma.checkoutSession.update({
              where: { id: result.session.id },
              data: {
                metadata: {
                  ...((result.session.metadata as any) || {}),
                  fulfillment,
                },
              },
            });
            (result as any).fulfillment = fulfillment;
            (result.session as any).fulfillment = fulfillment;
          }
        } catch (linkErr: any) {
          console.warn('[CheckoutService:verifyDirectPayment] PaymentLink fulfillment error:', linkErr.message);
        }
      }

      const webhookData = {
        sessionId: result.session.id,
        transactionId: paymentId,
        amount: result.session.amount,
        currency: result.session.currency,
        title: result.session.title,
        metadata: result.session.metadata,
        gateway: activeGatewayName,
        timestamp: new Date().toISOString(),
      };

      Promise.allSettled([
        this.dispatchPaymentWebhook(result.session.appId, {
          event: 'payment.captured',
          data: webhookData,
        }),
        this.dispatchPaymentWebhook(result.session.appId, {
          event: 'payment.succeeded',
          data: webhookData,
        }),
      ]).catch((err) => {
        console.warn('[CheckoutService] Direct pay webhook failed:', err.message);
      });
    }

    return {
      success: true,
      sessionId,
      transactionId: paymentId,
      status: 'CAPTURED',
      session: result.session,
      gateway: activeGatewayName,
      returnUrl: result.session.returnUrl,
      fulfillment: (result as any).fulfillment,
    };
  }

  /**
   * Executes payment directly within 180 Pay without opening third-party gateway modal popups.
   * Atomically settles the transaction, credits the developer app wallet, records double-entry ledgers,
   * activates subscriptions if applicable, and dispatches webhooks to the calling merchant.
   */
  static async executeDirectPayment(input: {
    sessionId: string;
    paymentMethod?: string;
    customerEmail?: string;
    customerPhone?: string;
    upiId?: string;
    userId?: string;
  }) {
    const { sessionId, paymentMethod = '180_PAY', customerEmail, customerPhone, upiId, userId } = input;

    const session = await this.getSession(sessionId);

    if (session.status === 'CAPTURED') {
      return {
        success: true,
        session,
        transactionId: (session.metadata as any)?.transactionId || session.id,
        alreadyCaptured: true,
        returnUrl: session.returnUrl,
      };
    }

    if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
      throw new Error('This checkout session has expired. Please create a new one.');
    }

    const { gatewayType, keySecret } = this.resolveGatewayConfig(session.app);
    const hasLiveGateway = Boolean(keySecret && !keySecret.includes('simulated'));
    const isFreeCheckout = session.amount !== null && session.amount <= 0;
    if (hasLiveGateway && !isFreeCheckout) {
      throw new Error(
        'Direct bypass payment is disabled in live environment. Please complete payment through Razorpay / Stripe gateway.'
      );
    }
    const resolvedGateway = gatewayType === 'STRIPE' ? 'STRIPE' : '180_SOVEREIGN_PAY';
    const transactionId = `pay_180_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const result = await prisma.$transaction(async (tx: any) => {
      const liveSession = await tx.checkoutSession.findUnique({
        where: { id: session.id },
        include: { app: true },
      });

      if (!liveSession) {
        throw new Error('Checkout session not found');
      }

      if (liveSession.status === 'CAPTURED') {
        return { session: liveSession, transactionId, alreadyCaptured: true };
      }

      // Fetch or create Developer App Wallet
      let appWallet = await tx.wallet.findUnique({
        where: { developerAppId: liveSession.appId },
      });

      if (!appWallet) {
        appWallet = await tx.wallet.create({
          data: {
            developerAppId: liveSession.appId,
            balance: 0,
            currency: liveSession.currency || 'INR',
          },
        });
      }

      const newAppBalance = Math.round((appWallet.balance + liveSession.amount) * 100) / 100;
      await tx.wallet.update({
        where: { id: appWallet.id },
        data: { balance: newAppBalance },
      });

      await tx.ledgerEntry.create({
        data: {
          walletId: appWallet.id,
          amount: liveSession.amount,
          balanceAfter: newAppBalance,
          type: 'CHECKOUT_RECEIVE',
          referenceId: transactionId,
          description: `Direct in-sheet payment (${paymentMethod}) [${resolvedGateway}] for ${liveSession.title}`,
          metadata: {
            sessionId: liveSession.id,
            gateway: resolvedGateway,
            paymentMethod,
            customerEmail: customerEmail || (liveSession.metadata as any)?.customerEmail,
            customerPhone: customerPhone || (liveSession.metadata as any)?.customerPhone,
            upiId,
            directInPopUp: true,
          },
        },
      });

      const updatedSession = await tx.checkoutSession.update({
        where: { id: liveSession.id },
        data: {
          status: 'CAPTURED',
          userId: userId || liveSession.userId || undefined,
          completedAt: new Date(),
          metadata: {
            ...(liveSession.metadata as any || {}),
            gateway: resolvedGateway,
            paymentMethod,
            transactionId,
            directInPopUp: true,
          },
        },
      });

      // Activate recurring subscription if session was in subscription mode
      if (liveSession.mode === 'subscription') {
        try {
          await SubscriptionService.activateSubscriptionFromSession(
            liveSession.id,
            userId || liveSession.userId || 'guest_direct',
            tx
          );
        } catch (subErr: any) {
          console.warn('[CheckoutService:executeDirectPayment] Failed to activate subscription:', subErr.message);
        }
      }

      return { session: updatedSession, transactionId, alreadyCaptured: false };
    });

    // Dispatch webhook to merchant (Social Studio / Traffic Director / 3rd party apps)
    if (!result.alreadyCaptured) {
      if ((result.session.metadata as any)?.paymentLinkId) {
        try {
          const PaymentLinkService = require('../payment-link/payment-link.service').PaymentLinkService;
          const fulfillment = await PaymentLinkService.completeLinkPurchase(
            (result.session.metadata as any).paymentLinkId,
            result.session.id
          );
          if (fulfillment) {
            await prisma.checkoutSession.update({
              where: { id: result.session.id },
              data: {
                metadata: {
                  ...((result.session.metadata as any) || {}),
                  fulfillment,
                },
              },
            });
            (result as any).fulfillment = fulfillment;
            (result.session as any).fulfillment = fulfillment;
          }
        } catch (linkErr: any) {
          console.warn('[CheckoutService:executeDirectPayment] PaymentLink fulfillment error:', linkErr.message);
        }
      }

      const webhookData = {
        sessionId: result.session.id,
        transactionId,
        amount: result.session.amount,
        currency: result.session.currency,
        title: result.session.title,
        metadata: result.session.metadata,
        paymentMethod,
        gateway: resolvedGateway,
        timestamp: new Date().toISOString(),
      };

      Promise.allSettled([
        this.dispatchPaymentWebhook(result.session.appId, {
          event: 'payment.captured',
          data: webhookData,
        }),
        this.dispatchPaymentWebhook(result.session.appId, {
          event: 'payment.succeeded',
          data: webhookData,
        }),
      ]).catch((err) => {
        console.warn('[CheckoutService] Direct pay webhook failed:', err.message);
      });
    }

    return {
      success: true,
      sessionId,
      transactionId,
      status: 'CAPTURED',
      session: result.session,
      gateway: resolvedGateway,
      returnUrl: result.session.returnUrl,
      fulfillment: (result as any).fulfillment,
    };
  }
}


