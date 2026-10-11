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

      const clientId = req.body.clientId;
      const clientSecret = req.body.clientSecret;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Payment amount must be greater than zero',
        });
      }

      // If client credentials provided, use standard 3rd-party developer flow
      if (clientId && clientSecret) {
        const session = await CheckoutService.createSession({
          clientId,
          clientSecret,
          amount: Number(amount),
          currency,
          title: title || '180 Pay Sovereign Checkout',
          description,
          returnUrl,
          cancelUrl,
          metadata,
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

      // Otherwise, create session under first-party / authenticated app context or custom domain host
      const userId = (req as any).user?.id || null;
      const reqHost = (req.headers.host || '').toLowerCase().split(':')[0];
      
      let app = null;
      if (reqHost && !reqHost.includes('180workspace.com') && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1')) {
        app = await prisma.oAuthApp.findFirst({
          where: { customPayDomain: reqHost, isActive: true },
        });
      }

      const requestedAppId = req.body.appId || req.body.clientId;
      if (!app && requestedAppId) {
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

      if (!app) {
        app = await prisma.oAuthApp.findFirst({
          where: { clientId: clientId || '180-workspace-platform' },
        }) || await prisma.oAuthApp.findFirst({
          where: { isActive: true },
        });
      }

      if (!app) {
        const sysUser = await prisma.user.findFirst();
        if (sysUser) {
          app = await prisma.oAuthApp.create({
            data: {
              clientId: '180-workspace-platform',
              clientSecretHash: 'first_party_app_hash',
              clientSecretHint: 'hash',
              name: '180 Workspace',
              description: '180 Workspace Platform App',
              redirectUris: ['http://localhost:3008/oauth/callback', 'http://localhost:3009/oauth/callback'],
              allowedOrigins: ['http://localhost:3008', 'http://localhost:3009'],
              allowedScopes: ['openid', 'identity:read'],
              isVerified: true,
              isActive: true,
              userId: sysUser.id,
            },
          });
        }
      }

      if (!app) {
        throw new Error('No active OAuth application found to associate with checkout session');
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
        const isInternalDomain = cleanOrigin.endsWith('180workspace.com') ||
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

      // Security Validation: Check returnUrl against OAuth 2.0 Redirect URIs
      if (returnUrl && app.redirectUris && app.redirectUris.length > 0) {
        const targetUrl = String(returnUrl).trim();
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
            // Support custom app URI schemes like socialstudio://oauth-callback
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
            message: `The returnUrl '${returnUrl}' is not in the allowed redirect URIs for application '${app.name}'.`,
            details: {
              type: 'REDIRECT_URI_MISMATCH',
              returnUrl,
              registeredUris: app.redirectUris,
              hint: `Add '${returnUrl}' to OAuth 2.0 Redirect URIs in Project Settings.`,
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
            returnUrl: returnUrl || '',
            cancelUrl: cancelUrl || '',
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
        checkoutUrl: `${process.env.PROFILE_FRONTEND_URL || 'http://localhost:3009'}/checkout/${checkoutSession.id}`,
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
      return res.status(400).json({ success: false, error: err.message });
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
      const baseAmount = session.originalAmount && session.originalAmount > 0 ? session.originalAmount : session.amount;
      const orderCurrency = String(req.body.currency || session.currency || 'USD').toUpperCase();

      const validation = await CouponService.validateCoupon({
        appId: session.appId,
        code: String(code),
        orderAmount: typeof req.body.orderAmount === 'number' && req.body.orderAmount > 0 ? req.body.orderAmount : baseAmount,
        orderCurrency,
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

      const sessionCurrency = String(session.currency || 'USD').toUpperCase();
      const discountInSessionCurrency = orderCurrency === sessionCurrency
        ? validation.discountAmount
        : GeoPricingService.convertCurrency(validation.discountAmount, orderCurrency, sessionCurrency);

      const finalInSessionCurrency = Math.max(
        0,
        Math.round((baseAmount - discountInSessionCurrency) * 100) / 100
      );

      const updated = await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          originalAmount: baseAmount,
          amount: finalInSessionCurrency,
          couponId: validation.couponId || null,
          couponCode: validation.code,
          discountAmount: discountInSessionCurrency,
          metadata: {
            ...((session.metadata as any) || {}),
            appliedCurrency: orderCurrency,
            couponOrderCurrency: orderCurrency,
            couponDiscountInOrderCurrency: validation.discountAmount,
            couponFinalInOrderCurrency: validation.finalAmount,
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
        discountAmount: validation.discountAmount,
        finalAmount: validation.finalAmount,
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

      const revertedAmount = session.originalAmount && session.originalAmount > 0 ? session.originalAmount : session.amount;

      const updated = await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          amount: revertedAmount,
          couponId: null,
          couponCode: null,
          discountAmount: 0,
          metadata: {
            ...((session.metadata as any) || {}),
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
      const { orderId, paymentId, signature } = req.body;
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

