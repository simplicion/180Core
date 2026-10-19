'use strict';

import { Request, Response } from 'express';
import { CheckoutService, CouponService, GeoPricingService, WebhookDispatcherService, IdentityWalletService } from '@workspace/payment-provider';
import { developersPrisma as prisma } from '@workspace/db-180core';

export class CheckoutApiController {
  /**
   * POST /api/v1/checkout/sessions
   * 3rd-Party Developer API or Authenticated User checkout initiation
   */
  static async createCheckoutSession(req: Request, res: Response) {
    try {
      const {
        amount,
        currency = 'INR',
        title,
        description,
        returnUrl,
        cancelUrl,
        metadata,
        couponCode,
        displayMode,
      } = req.body;

      const headerAuth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const clientId =
        req.body.clientId ||
        req.body.client_id ||
        (req.headers['x-client-id'] as string) ||
        (req.headers['x-180-client-id'] as string);
      let clientSecret =
        req.body.clientSecret ||
        req.body.client_secret ||
        (req.headers['x-client-secret'] as string) ||
        (req.headers['x-180-client-secret'] as string);

      if (!clientSecret && headerAuth && headerAuth.startsWith('180_sec_')) {
        clientSecret = headerAuth;
      }

      // Handle currency units: 180 Pay expects whole currency units (e.g. 499 for $499 or ₹499)
      let parsedAmount = Number(amount);
      const smallestUnit =
        req.body.amountInCents ||
        req.body.amount_in_cents ||
        req.body.amountInPaise ||
        req.body.amount_in_paise;

      if ((!amount || Number(amount) <= 0) && smallestUnit) {
        parsedAmount = Number(smallestUnit) / 100;
      }

      if (!parsedAmount || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          error:
            'Payment amount must be greater than zero. Note: 180 Pay accepts whole currency units (e.g. amount: 499 for ₹499 or $499).',
        });
      }

      const effectiveReturnUrl = returnUrl || req.body.return_url || req.body.redirectUrl || req.body.redirect_uri;
      const effectiveCancelUrl = cancelUrl || req.body.cancel_url;
      const effectiveTitle = title || req.body.productName || req.body.name || '180 Pay Sovereign Checkout';
      const effectiveMetadata = {
        ...(metadata || {}),
        orderId: req.body.orderId || req.body.order_id || metadata?.orderId || metadata?.order_id,
      };

      // If client credentials provided, use standard 3rd-party developer flow
      if (clientId && clientSecret) {
        const session = await CheckoutService.createSession({
          clientId,
          clientSecret,
          amount: parsedAmount,
          currency,
          title: effectiveTitle,
          description,
          returnUrl: effectiveReturnUrl,
          cancelUrl: effectiveCancelUrl,
          metadata: effectiveMetadata,
        });

        // If couponCode was passed, attempt application
        if (couponCode) {
          try {
            const rawOrigin = req.headers.origin || req.headers.referer || '';
            const app = await prisma.oAuthApp.findUnique({ where: { clientId } });
            if (app) {
              const validation = await CouponService.validateCoupon({
                appId: app.id,
                code: String(couponCode),
                orderAmount: Number(amount),
                orderCurrency: String(currency || 'USD').toUpperCase(),
                origin: typeof rawOrigin === 'string' ? rawOrigin : '',
              });
              if (validation.valid) {
                await prisma.checkoutSession.update({
                  where: { id: session.sessionId },
                  data: {
                    originalAmount: Number(amount),
                    amount: validation.finalAmount,
                    couponId: validation.couponId || null,
                    couponCode: validation.code,
                    discountAmount: validation.discountAmount,
                    displayMode: displayMode || 'bottom_sheet',
                  },
                });
                session.amount = validation.finalAmount;
              }
            }
          } catch (couponErr: any) {
            console.warn('[createCheckoutSession] Coupon validation warning:', couponErr.message);
          }
        }

        return res.status(200).json({
          success: true,
          sessionId: session.sessionId,
          session: {
            id: session.sessionId,
            amount: session.amount,
            currency: session.currency,
            expiresAt: session.expiresAt,
          },
          data: session,
          checkoutUrl: session.checkoutUrl,
        });
      }

      // If clientId was provided but clientSecret is missing, reject immediately
      if (clientId && !clientSecret) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: client_secret (or Authorization: Bearer <secret>) is required to create a checkout session.',
        });
      }

      // Otherwise, create session under first-party / authenticated app context or custom domain host
      const userId = (req as any).user?.id || null;
      const reqHost = (req.headers.host || '').toLowerCase().split(':')[0];
      
      let app = null;
      if (reqHost && !reqHost.includes('180core.cloud') && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1')) {
        app = await prisma.oAuthApp.findFirst({
          where: { customPayDomain: reqHost, isActive: true },
        });
      }

      const requestedAppId = req.body.appId || req.body.clientId;
      const isInternalOrigin = req.headers.origin && (
        String(req.headers.origin).includes('180core.cloud')
      );
      if (!app && requestedAppId && (userId || isInternalOrigin)) {
        app = await prisma.oAuthApp.findFirst({
          where: {
            OR: [
              { id: String(requestedAppId) },
              { clientId: String(requestedAppId) },
            ],
            isActive: true,
          },
        });
      }

      if (!app && (userId || isInternalOrigin)) {
        const targetClientId = process.env.CORE_CLIENT_ID || process.env.NEXT_PUBLIC_180_CLIENT_ID || '';
        if (targetClientId) {
          app = await prisma.oAuthApp.findFirst({
            where: {
              OR: [
                { clientId: targetClientId },
                { id: targetClientId },
              ],
              isActive: true,
            },
          });
        }
      }

      if (!app) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Valid API credentials (client_id and client_secret) are required to create a checkout session.',
        });
      }

      // Security Validation: Check Allowed Web Origins (CORS)
      const rawOrigin = (req.headers.origin as string) || (req.headers.referer ? (() => {
        try { return new URL(req.headers.referer as string).origin; } catch (_) { return ''; }
      })() : '');
      const cleanOrigin = rawOrigin ? rawOrigin.toLowerCase().replace(/\/$/, '') : '';

      if (cleanOrigin && app.allowedOrigins && app.allowedOrigins.length > 0) {
        const isOriginAllowed = app.allowedOrigins.some((ao: string) => {
          const cleanAo = ao.trim().toLowerCase().replace(/\/$/, '');
          return cleanAo === '*' || cleanAo === cleanOrigin;
        });
        const isInternalDomain = cleanOrigin.endsWith('180core.cloud') ||
                                 cleanOrigin.includes('localhost') ||
                                 cleanOrigin.includes('127.0.0.1');

        if (!isOriginAllowed && !isInternalDomain) {
          return res.status(403).json({
            success: false,
            error: 'forbidden_origin',
            message: `Origin '${rawOrigin}' is not authorized to create checkout sessions for application '${app.name}'.`,
            details: {
              type: 'ORIGIN_NOT_ALLOWED',
              origin: rawOrigin,
              allowedOrigins: app.allowedOrigins,
              hint: `Add '${rawOrigin}' to Allowed Web Origins (CORS) in Project Settings.`,
            },
          });
        }
      }

      // Security Validation: Check effectiveReturnUrl against OAuth 2.0 Redirect URIs
      if (effectiveReturnUrl && app.redirectUris && app.redirectUris.length > 0) {
        const targetUrl = String(effectiveReturnUrl).trim();
        const isReturnUrlAllowed = app.redirectUris.some((ru: string) => {
          const registered = ru.trim();
          if (registered === '*') return true;
          if (registered.toLowerCase() === targetUrl.toLowerCase()) return true;
          try {
            const regParsed = new URL(registered);
            const targetParsed = new URL(targetUrl);
            return regParsed.origin.toLowerCase() === targetParsed.origin.toLowerCase() &&
                   regParsed.pathname === targetParsed.pathname;
          } catch (_) {
            // Support custom app URI schemes like socialstudio://oauth-callback or ayuhand://payment/callback
            if (registered.includes('://') && targetUrl.includes('://')) {
              const regScheme = registered.split('://')[0].toLowerCase();
              const targetScheme = targetUrl.split('://')[0].toLowerCase();
              return regScheme === targetScheme;
            }
            return false;
          }
        });

        if (!isReturnUrlAllowed) {
          return res.status(400).json({
            success: false,
            error: 'invalid_redirect_uri',
            message: `The returnUrl '${effectiveReturnUrl}' is not in the allowed redirect URIs for application '${app.name}'.`,
            details: {
              type: 'REDIRECT_URI_MISMATCH',
              returnUrl: effectiveReturnUrl,
              registeredUris: app.redirectUris,
              hint: `Add '${effectiveReturnUrl}' to OAuth 2.0 Redirect URIs in Project Settings.`,
            },
          });
        }
      }

      let finalAmount = Math.round(Number(amount) * 100) / 100;
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let discountAmount = 0;

      if (couponCode) {
        const rawOrigin = req.headers.origin || req.headers.referer || '';
        const validation = await CouponService.validateCoupon({
          appId: app.id,
          code: String(couponCode),
          orderAmount: Number(amount),
          orderCurrency: String(currency || 'USD').toUpperCase(),
          origin: typeof rawOrigin === 'string' ? rawOrigin : '',
        });
        if (validation.valid) {
          finalAmount = validation.finalAmount;
          appliedCouponId = validation.couponId || null;
          appliedCouponCode = validation.code;
          discountAmount = validation.discountAmount;
        }
      }

      // Extract client network and device fingerprint for session deduplication
      const rawIp =
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';
      const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
      const userAgent = (req.headers['user-agent'] as string) || '';
      const clientSessionId = metadata?.clientSessionId || (req.headers['x-client-session-id'] as string) || null;

      // Look up recent active PENDING sessions for this app (last 30 minutes)
      const recentPendingSessions = await prisma.checkoutSession.findMany({
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
        take: 25,
      });

      let existingCheckoutSession = null;
      if (clientSessionId) {
        existingCheckoutSession = recentPendingSessions.find((s) => {
          const m = (s.metadata as any) || {};
          return m.clientSessionId === clientSessionId;
        });
      }

      // If no explicit clientSessionId match, check rapid duplicate (< 60s) for same amount and IP
      if (!existingCheckoutSession) {
        existingCheckoutSession = recentPendingSessions.find((s) => {
          const m = (s.metadata as any) || {};
          const isRecent = Date.now() - new Date(s.createdAt).getTime() < 60 * 1000;
          const sameAmount = Math.abs(s.amount - finalAmount) < 0.01;
          const sameIp = !ip || !m.ip || m.ip === ip;
          return isRecent && sameAmount && sameIp;
        });
      }

      let checkoutSession;
      if (existingCheckoutSession) {
        const existingMeta = (existingCheckoutSession.metadata as any) || {};
        const mergedMeta = {
          ...existingMeta,
          ...(metadata || {}),
          ip: ip || existingMeta.ip,
          userAgent: userAgent || existingMeta.userAgent,
          clientSessionId: clientSessionId || existingMeta.clientSessionId,
          lastReopenedAt: new Date().toISOString(),
        };

        checkoutSession = await prisma.checkoutSession.update({
          where: { id: existingCheckoutSession.id },
          data: {
            amount: finalAmount,
            originalAmount: Math.round(Number(amount) * 100) / 100,
            discountAmount,
            couponId: appliedCouponId,
            couponCode: appliedCouponCode,
            title: title || existingCheckoutSession.title,
            description: description !== undefined ? description : existingCheckoutSession.description,
            metadata: mergedMeta,
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
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        const mergedMeta = {
          ...(metadata || {}),
          ip,
          userAgent,
          clientSessionId: clientSessionId || undefined,
        };

        checkoutSession = await prisma.checkoutSession.create({
          data: {
            appId: app.id,
            amount: finalAmount,
            originalAmount: Math.round(Number(amount) * 100) / 100,
            discountAmount,
            couponId: appliedCouponId,
            couponCode: appliedCouponCode,
            displayMode: displayMode || (app as any).payDesktopDefault || 'bottom_sheet',
            currency: (currency || 'INR').toUpperCase(),
            status: 'PENDING',
            title: title || '180 Pay Sovereign Checkout',
            description: description || '',
            returnUrl: effectiveReturnUrl || '',
            cancelUrl: effectiveCancelUrl || '',
            metadata: mergedMeta,
            expiresAt,
            userId,
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

      const sessionData = {
        success: true,
        sessionId: checkoutSession.id,
        amount: checkoutSession.amount,
        originalAmount: checkoutSession.originalAmount,
        discountAmount: checkoutSession.discountAmount,
        couponCode: checkoutSession.couponCode,
        currency: checkoutSession.currency,
        expiresAt: checkoutSession.expiresAt,
        checkoutUrl: `${process.env.PROFILE_FRONTEND_URL || 'https://profile.180core.cloud'}/checkout/${checkoutSession.id}`,
      };

      return res.status(200).json({
        success: true,
        sessionId: checkoutSession.id,
        session: checkoutSession,
        data: sessionData,
        checkoutUrl: sessionData.checkoutUrl,
      });
    } catch (err: any) {
      console.error('[CheckoutApiController:createCheckoutSession] Error:', err);
      const isAuthError =
        err.message?.toLowerCase().includes('secret') ||
        err.message?.toLowerCase().includes('credentials') ||
        err.message?.toLowerCase().includes('unauthorized');
      const statusCode = isAuthError ? 401 : 400;
      return res.status(statusCode).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/checkout/sessions/:id
   * Public endpoint for the popup checkout UI
   */
  static async getCheckoutSession(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const session = await CheckoutService.getSession(id);
      return res.json({ success: true, session, data: session });
    } catch (err: any) {
      console.error('[CheckoutApiController:getCheckoutSession] Error:', err);
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/apply-coupon
   * Public endpoint called by 180 Pay modal to apply a coupon code
   */
  static async applyCoupon(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const rawCode = req.body.code || req.body.couponCode;
      const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
      const customerEmail = req.body.customerEmail || req.body.email;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Coupon code is required' });
      }

      const session = await prisma.checkoutSession.findUnique({
        where: { id },
        include: { app: true },
      });

      if (!session) {
        return res.status(404).json({ success: false, error: 'Checkout session not found' });
      }

      if (session.status !== 'PENDING') {
        return res.status(400).json({ success: false, error: 'Checkout session is not active' });
      }

      if (session.expiresAt < new Date()) {
        return res.status(400).json({ success: false, error: 'Checkout session has expired' });
      }

      const rawOrigin = req.headers.origin || req.headers.referer || '';
      const origin = typeof rawOrigin === 'string' ? rawOrigin : '';

      // Platform canonical base currency is ALWAYS strictly USD
      const sessionCurrency = String(session.currency || 'USD').toUpperCase();
      let sessionBaseAmount = session.originalAmount && session.originalAmount > 0 ? session.originalAmount : session.amount;

      // Auto-heal Developer sessions if corrupted or compounded
      if (session.id.startsWith('sess_dev_')) {
        const isPro = session.id.includes('_pro_');
        sessionBaseAmount = isPro ? 5.0 : 2.0;
      }

      const clientRequestedCurrency = req.body.currency ? String(req.body.currency).toUpperCase() : sessionCurrency;
      const clientOrderAmount = typeof req.body.orderAmount === 'number' && req.body.orderAmount > 0 ? req.body.orderAmount : null;

      // 1. ALWAYS validate the coupon against the REAL platform base currency (USD) and REAL base amount server-side!
      const sessionMeta = (session.metadata as any) || {};
      const validation = await CouponService.validateCoupon({
        appId: session.appId,
        linkId: sessionMeta.paymentLinkId || (req.body as any).linkId || undefined,
        linkSlug: sessionMeta.paymentLinkSlug || (req.body as any).linkSlug || undefined,
        code: String(code),
        orderAmount: sessionBaseAmount,
        orderCurrency: sessionCurrency,
        customerEmail: customerEmail ? String(customerEmail) : undefined,
        origin,
        planId: session.planId || undefined,
      });

      if (!validation.valid) {
        return res.status(200).json({
          success: false,
          error: validation.error,
          reasonCode: validation.reasonCode,
        });
      }

      // 2. Canonical base discount and final amounts strictly in session currency (USD)
      const is100PercentOff = validation.discountType === 'PERCENTAGE' && validation.discountValue >= 100;
      const baseDiscountAmount = is100PercentOff ? sessionBaseAmount : validation.discountAmount;
      const baseFinalAmount = is100PercentOff ? 0 : Math.max(0, Math.round((sessionBaseAmount - baseDiscountAmount) * 100) / 100);

      // 3. Display amounts converted for client active view
      let displayDiscountAmount = baseDiscountAmount;
      let displayFinalAmount = baseFinalAmount;

      if (is100PercentOff) {
        const clientBaseTotal = clientOrderAmount && clientOrderAmount > 0
          ? clientOrderAmount
          : GeoPricingService.convertCurrency(sessionBaseAmount, sessionCurrency, clientRequestedCurrency);
        displayDiscountAmount = clientBaseTotal;
        displayFinalAmount = 0;
      } else if (clientRequestedCurrency !== sessionCurrency) {
        if (clientOrderAmount && clientOrderAmount > 0 && sessionBaseAmount > 0) {
          const discountRatio = Math.min(1, baseDiscountAmount / sessionBaseAmount);
          displayDiscountAmount = Math.round(clientOrderAmount * discountRatio * 100) / 100;
          displayFinalAmount = Math.max(0, Math.round((clientOrderAmount - displayDiscountAmount) * 100) / 100);
        } else {
          displayDiscountAmount = GeoPricingService.convertCurrency(baseDiscountAmount, sessionCurrency, clientRequestedCurrency);
          displayFinalAmount = GeoPricingService.convertCurrency(baseFinalAmount, sessionCurrency, clientRequestedCurrency);
        }
      }

      const updated = await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          originalAmount: sessionBaseAmount,
          amount: baseFinalAmount,
          currency: sessionCurrency,
          couponId: validation.couponId || null,
          couponCode: validation.code,
          discountAmount: baseDiscountAmount,
          metadata: {
            ...((session.metadata as any) || {}),
            appliedCurrency: clientRequestedCurrency,
            couponOrderCurrency: clientRequestedCurrency,
            couponDiscountInOrderCurrency: displayDiscountAmount,
            couponFinalInOrderCurrency: displayFinalAmount,
            couponDiscountBaseUSD: baseDiscountAmount,
            couponFinalBaseUSD: baseFinalAmount,
            razorpayOrderId: null,
            razorpayAmountPaise: null,
            razorpayCurrency: null,
          },
        },
        include: { app: true },
      });

      return res.status(200).json({
        success: true,
        session: updated,
        discountAmount: displayDiscountAmount,
        finalAmount: displayFinalAmount,
        discountAmountUSD: baseDiscountAmount,
        finalAmountUSD: baseFinalAmount,
        currency: clientRequestedCurrency,
        code: validation.code,
      });
    } catch (err: any) {
      console.error('[CheckoutApiController:applyCoupon] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/remove-coupon
   * Remove any applied coupon from session
   */
  static async removeCoupon(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const session = await prisma.checkoutSession.findUnique({
        where: { id },
        include: { app: true },
      });

      if (!session) {
        return res.status(404).json({ success: false, error: 'Checkout session not found' });
      }

      if (session.status !== 'PENDING') {
        return res.status(400).json({ success: false, error: 'Checkout session is not active' });
      }

      let revertedAmount = session.originalAmount && session.originalAmount > 0 ? session.originalAmount : session.amount;
      const sessionCurrency = String(session.currency || 'USD').toUpperCase();

      if (session.id.startsWith('sess_dev_')) {
        const isPro = session.id.includes('_pro_');
        revertedAmount = isPro ? 5.0 : 2.0;
      }

      const updated = await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          originalAmount: revertedAmount,
          amount: revertedAmount,
          currency: sessionCurrency,
          couponId: null,
          couponCode: null,
          discountAmount: 0,
          metadata: {
            ...((session.metadata as any) || {}),
            appliedCurrency: null,
            couponOrderCurrency: null,
            couponDiscountInOrderCurrency: 0,
            couponFinalInOrderCurrency: revertedAmount,
            couponDiscountBaseUSD: 0,
            couponFinalBaseUSD: revertedAmount,
            razorpayOrderId: null,
            razorpayAmountPaise: null,
            razorpayCurrency: null,
          },
        },
        include: { app: true },
      });

      return res.status(200).json({
        success: true,
        session: updated,
      });
    } catch (err: any) {
      console.error('[CheckoutApiController:removeCoupon] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/pay
   * Authenticated user authorizes and completes 1-click payment
   */
  static async payCheckoutSession(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const id = String(req.params.id);
      const result = await CheckoutService.processPayment(id, userId);

      // Redeem coupon if attached
      const session = await prisma.checkoutSession.findUnique({ where: { id } });
      if (session && session.couponId) {
        try {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
          await CouponService.redeemCouponAtomic({
            couponId: session.couponId,
            sessionId: session.id,
            customerEmail: user?.email || userId,
            discountApplied: session.discountAmount || 0,
          });

          WebhookDispatcherService.dispatchEvent(session.appId, {
            event: 'coupon.redeemed',
            data: {
              couponId: session.couponId,
              code: session.couponCode,
              discountAmount: session.discountAmount,
              sessionId: session.id,
              customerEmail: user?.email || userId,
            },
          }).catch((err) => console.warn('[CheckoutApiController] Webhook dispatch error:', err.message));
        } catch (couponErr: any) {
          console.warn('[CheckoutApiController:payCheckoutSession] Coupon redemption warning:', couponErr.message);
        }
      }

      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error('[CheckoutApiController:payCheckoutSession] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/direct-order
   * Generate gateway order for direct guest/card/UPI checkout without requiring wallet login
   */
  static async createDirectOrder(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { currency, amount } = req.body || {};
      const order = await CheckoutService.createDirectOrder(id, {
        targetCurrency: currency,
        targetAmount: typeof amount === 'number' ? amount : undefined,
      });
      return res.json({ success: true, ...order, data: order });
    } catch (err: any) {
      console.error('[CheckoutApiController:createDirectOrder] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/direct-verify
   * Cryptographically verify gateway signature and capture payment
   */
  static async verifyDirectPayment(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const orderId = req.body.orderId || req.body.order_id || req.body.razorpay_order_id;
      const paymentId = req.body.paymentId || req.body.payment_id || req.body.razorpay_payment_id;
      const signature = req.body.signature || req.body.razorpay_signature;

      if (!orderId || !paymentId || !signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing payment verification credentials (orderId, paymentId, signature)',
        });
      }

      const result = await CheckoutService.verifyDirectPayment({
        sessionId: id,
        orderId,
        paymentId,
        signature,
      });

      // Redeem coupon if attached
      const session = await prisma.checkoutSession.findUnique({ where: { id } });
      if (session && session.couponId) {
        try {
          const customerEmail = (session.metadata as any)?.customerEmail || (session.metadata as any)?.email || session.id;
          await CouponService.redeemCouponAtomic({
            couponId: session.couponId,
            sessionId: session.id,
            customerEmail: String(customerEmail),
            discountApplied: session.discountAmount || 0,
          });

          WebhookDispatcherService.dispatchEvent(session.appId, {
            event: 'coupon.redeemed',
            data: {
              couponId: session.couponId,
              code: session.couponCode,
              discountAmount: session.discountAmount,
              sessionId: session.id,
              customerEmail: String(customerEmail),
            },
          }).catch((err) => console.warn('[CheckoutApiController] Webhook dispatch error:', err.message));
        } catch (couponErr: any) {
          console.warn('[CheckoutApiController:verifyDirectPayment] Coupon redemption warning:', couponErr.message);
        }
      }

      return res.json({ success: true, ...result, data: result });
    } catch (err: any) {
      console.error('[CheckoutApiController:verifyDirectPayment] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/direct-pay
   * POST /api/oauth/checkout/sessions/:id/direct-pay
   * Directly executes and captures payment inside the 180 Pay pop-up/bottom sheet
   * without launching secondary Razorpay popup dialogs.
   */
  static async executeDirectPayment(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { paymentMethod, customerEmail, customerPhone, upiId } = req.body || {};
      const userId = (req as any).user?.id || undefined;

      const result = await CheckoutService.executeDirectPayment({
        sessionId: id,
        paymentMethod: paymentMethod || '180_PAY',
        customerEmail,
        customerPhone,
        upiId,
        userId,
      });

      // Redeem coupon if attached
      const session = await prisma.checkoutSession.findUnique({ where: { id } });
      if (session && session.couponId) {
        try {
          const email = customerEmail || (session.metadata as any)?.customerEmail || (session.metadata as any)?.email || session.id;
          await CouponService.redeemCouponAtomic({
            couponId: session.couponId,
            sessionId: session.id,
            customerEmail: String(email),
            discountApplied: session.discountAmount || 0,
          });

          WebhookDispatcherService.dispatchEvent(session.appId, {
            event: 'coupon.redeemed',
            data: {
              couponId: session.couponId,
              code: session.couponCode,
              discountAmount: session.discountAmount,
              sessionId: session.id,
              customerEmail: String(email),
            },
          }).catch((err) => console.warn('[CheckoutApiController] Webhook dispatch error:', err.message));
        } catch (couponErr: any) {
          console.warn('[CheckoutApiController:executeDirectPayment] Coupon redemption warning:', couponErr.message);
        }
      }

      return res.json({ success: true, ...result, data: result });
    } catch (err: any) {
      console.error('[CheckoutApiController:executeDirectPayment] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/sessions/:id/track-event
   * Track checkout behavioral events (e.g. DRAWER_OPENED, GATEWAY_OPENED, GATEWAY_DISMISSED)
   */
  static async trackEvent(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const { event, language, userAgent, screen, clientSessionId } = req.body || {};

      const rawIp =
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        req.ip ||
        '127.0.0.1';
      const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();

      const session = await prisma.checkoutSession.findUnique({ where: { id } });
      if (!session) {
        return res.status(404).json({ success: false, error: 'Checkout session not found' });
      }

      const existingMeta = (session.metadata as any) || {};
      const updatedMeta = {
        ...existingMeta,
        ip: existingMeta.ip || ip,
        userAgent: userAgent || req.headers['user-agent'] || existingMeta.userAgent,
        language: language || (typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'].split(',')[0] : 'en-US') || existingMeta.language,
        screen: screen || existingMeta.screen,
      };

      if (clientSessionId) {
        updatedMeta.clientSessionId = clientSessionId;
      }

      if (event === 'GATEWAY_DISMISSED') {
        updatedMeta.gatewayDismissed = true;
        updatedMeta.gatewayDismissedAt = new Date().toISOString();
        updatedMeta.lifecycleStage = 'GATEWAY_ABANDONED';
      } else if (event === 'GATEWAY_OPENED') {
        updatedMeta.gatewayInvoked = true;
        updatedMeta.gatewayInvokedAt = new Date().toISOString();
        updatedMeta.lifecycleStage = 'GATEWAY_ATTEMPTED';
      } else if (event === 'DRAWER_OPENED') {
        updatedMeta.drawerOpenedAt = updatedMeta.drawerOpenedAt || new Date().toISOString();
      }

      await prisma.checkoutSession.update({
        where: { id },
        data: {
          metadata: updatedMeta,
          updatedAt: new Date(),
        },
      });

      return res.json({ success: true, metadata: updatedMeta });
    } catch (err: any) {
      console.warn('[CheckoutApiController:trackEvent] Error:', err.message);
      return res.status(200).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/checkout/methods
   * GET /api/v1/checkout/sessions/:id/methods
   * Fetches supported gateway payment methods and live banks dynamically from Razorpay/Stripe
   */
  static async getPaymentMethods(req: Request, res: Response) {
    try {
      const sessionId = req.params.id ? String(req.params.id) : undefined;
      let app: any = null;
      let currency = (req.query.currency as string) || 'INR';

      if (sessionId && sessionId !== 'default') {
        const session = await prisma.checkoutSession.findUnique({
          where: { id: sessionId },
          include: { app: true },
        });
        if (session) {
          app = session.app;
          currency = session.currency || currency;
        }
      }

      const country = (req.query.country as string) || (req.headers['cf-ipcountry'] as string) || undefined;
      const methods = await CheckoutService.getPaymentMethods(app, currency, country);

      return res.json({ success: true, data: methods });
    } catch (err: any) {
      console.error('[CheckoutApiController:getPaymentMethods] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/checkout/webhook
   * Server-to-server Razorpay asynchronous webhook for checkout sessions
   */
  static async handleWebhook(req: Request, res: Response) {
    try {
      const crypto = require('crypto');
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
      const signature = req.headers['x-razorpay-signature'] as string;

      if (webhookSecret && signature) {
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
        const expectedBuf = Buffer.from(expected, 'utf-8');
        const signatureBuf = Buffer.from(signature, 'utf-8');
        if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
          return res.status(400).json({ error: 'Invalid webhook signature' });
        }
      }

      const event = req.body.event;
      if (event === 'payment.captured' || event === 'order.paid') {
        const payment = req.body.payload?.payment?.entity;
        const notes = payment?.notes || {};
        const sessionId = notes.sessionId;
        const orderId = payment?.order_id;
        const paymentId = payment?.id;

        if (sessionId && paymentId) {
          await CheckoutService.verifyDirectPayment({
            sessionId,
            orderId: orderId || `ord_${Date.now()}`,
            paymentId,
            signature: 'auto_polled_capture',
          }).catch((e: any) => console.log('[CheckoutWebhook] Processed session:', e.message));
        }

        // Also handle wallet topups if routed to this webhook
        const userId = notes.userId;
        const amountInr = (payment?.amount || 0) / 100;
        if (userId && paymentId && amountInr > 0 && !sessionId) {
          await IdentityWalletService.verifyAndCreditTopup(
            userId,
            orderId || `ord_${Date.now()}`,
            paymentId,
            signature || '',
            amountInr,
            true
          ).catch((e: any) => console.log('[CheckoutWebhook] Processed wallet topup:', e.message));
        }
      }

      return res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('[CheckoutApiController:handleWebhook] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/v1/checkout/sessions/:id/status
   * Live status check of payment capture (polls Razorpay API directly)
   */
  static async checkSessionStatus(req: Request, res: Response) {
    try {
      const id = String(req.params.id);
      const session = await CheckoutService.getSession(id);
      const isPaid = session.status === 'CAPTURED';
      return res.json({
        success: true,
        status: session.status,
        isPaid,
        returnUrl: session.returnUrl,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}

