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

export const APP_CHECKOUT_SELECT = {
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
  customUpiId: true,
  customUpiName: true,
  enableDirectUpi: true,
  enablePlatformGateway: true,
};

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

const UPI_VPA_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/;

export function isValidUpiVpa(vpa: string): boolean {
  if (!vpa || typeof vpa !== 'string') return false;
  return UPI_VPA_REGEX.test(vpa.trim());
}

function getGatewayEncryptionKey(): Buffer {
  const rawSecret =
    process.env.GATEWAY_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    '180core_dev_gateway_key_fallback';
  return crypto.createHash('sha256').update(rawSecret).digest();
}

export function encryptGatewaySecret(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.startsWith('enc:v1:')) return plaintext;
  const iv = crypto.randomBytes(12);
  const key = getGatewayEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptGatewaySecret(ciphertext?: string | null): string {
  if (!ciphertext) return '';
  if (!ciphertext.startsWith('enc:v1:')) return ciphertext;
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) return ciphertext;
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const key = getGatewayEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function computeBankListenerSecret(appId: string): string {
  return crypto
    .createHmac('sha256', getGatewayEncryptionKey())
    .update(`upi_bank_listener:${appId}`)
    .digest('hex')
    .slice(0, 48);
}

export function verifyBankListenerSecret(app: any, providedSecret: string): boolean {
  if (!app?.id || !providedSecret || typeof providedSecret !== 'string') return false;
  const cleanProvided = providedSecret.trim();
  const derivedSecret = computeBankListenerSecret(app.id);
  if (timingSafeCompare(derivedSecret, cleanProvided)) return true;
  const customWebhookSecret = decryptGatewaySecret(app.customGatewayWebhookSecret);
  if (customWebhookSecret && timingSafeCompare(customWebhookSecret, cleanProvided)) return true;
  return false;
}

export interface ParsedBankUpiAlert {
  isCredit: boolean;
  amount?: number;
  utr?: string;
  sessionRef?: string;
  payerVpa?: string;
  rejectionReason?: string;
}

/**
 * Parses Indian bank SMS, email, and UPI business app notifications (HDFC, ICICI, SBI, Axis, Kotak, PhonePe/GPay/Paytm Business).
 * Strictly rejects OTPs, debits, failed/declined alerts, and mandate notifications.
 */
export function parseIndianBankUpiAlert(rawText: string): ParsedBankUpiAlert {
  if (!rawText || typeof rawText !== 'string') {
    return { isCredit: false, rejectionReason: 'Empty bank alert payload' };
  }

  const text = rawText.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();

  // Reject OTPs and security codes immediately
  if (/\b(otp|one[\s-]*time[\s-]*password|verification\s*code|cvv|mpin|upi\s*pin)\b/i.test(lower)) {
    return { isCredit: false, rejectionReason: 'Rejected OTP or security notification' };
  }

  // Reject failed / declined / reversed / pending alerts
  if (/\b(failed|declined|unsuccessful|rejected|cancelled|canceled|expired|pending)\b/i.test(lower)) {
    return { isCredit: false, rejectionReason: 'Rejected non-success transaction alert' };
  }

  // Reject debit / outgoing payment messages (unless explicitly indicating a credit to merchant)
  const hasDebitKeyword = /\b(debited|withdrawn|spent|paid\s+(?:rs|inr|₹)|sent\s+(?:rs|inr|₹)|transferred\s+to|dr\.?\s+from|auto-?debit|will\s+be\s+debited)\b/i.test(lower);
  const hasCreditKeyword = /\b(credited|received|deposited|cr\.?\s+to|payment\s+of|received\s+from|paid\s+you|added\s+to\s+your)\b/i.test(lower);

  if (hasDebitKeyword && !hasCreditKeyword) {
    return { isCredit: false, rejectionReason: 'Rejected outgoing debit alert' };
  }
  if (!hasCreditKeyword) {
    return { isCredit: false, rejectionReason: 'Alert does not indicate an incoming UPI credit' };
  }

  // Extract INR amount: supports Rs.149.00, INR 1,299.50, ₹499, Rs 49
  let amount: number | undefined;
  const amountMatch =
    text.match(/(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i) ||
    text.match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr)/i);
  if (amountMatch && amountMatch[1]) {
    const parsed = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      amount = Math.round(parsed * 100) / 100;
    }
  }

  // Extract 12-digit NPCI UTR (prioritize explicit UTR/Ref/UPI labels first)
  let utr: string | undefined;
  const labeledUtrMatch =
    text.match(/(?:utr|upi\s*ref(?:\s*no\.?)?|upi\s*txn\s*id|transaction\s*id|ref(?:\s*no\.?|\s*id)?|rrn|imps\/upi)\s*[:#/\-\s]*(\d{12})\b/i) ||
    text.match(/\/upi\/(\d{12})(?:\/|\b)/i) ||
    text.match(/\bupi\/(\d{12})\b/i);

  if (labeledUtrMatch && labeledUtrMatch[1]) {
    utr = labeledUtrMatch[1];
  } else {
    const standaloneMatches = text.match(/\b(\d{12})\b/g);
    if (standaloneMatches && standaloneMatches.length > 0) {
      utr = standaloneMatches[0];
    }
  }

  // Extract 180P_<shortRef> transaction note
  let sessionRef: string | undefined;
  const refMatch = text.match(/180P_([a-zA-Z0-9]{6,20})/i);
  if (refMatch && refMatch[1]) {
    sessionRef = refMatch[1];
  }

  // Extract payer VPA if present (ignore common bank domains that aren't VPAs if needed)
  let payerVpa: string | undefined;
  const vpaMatches = text.match(/\b([a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,32})\b/g);
  if (vpaMatches) {
    const nonEmailVpa = vpaMatches.find((v) => !/\.(com|net|org|in|co\.in)$/i.test(v));
    if (nonEmailVpa) payerVpa = nonEmailVpa;
  }

  return {
    isCredit: true,
    amount,
    utr,
    sessionRef,
    payerVpa,
  };
}

/**
 * Validates whether a 12-digit string adheres to the official NPCI UPI UTR standard:
 * Digit 1: Year digit
 * Digits 2-4: Julian Day of the year (001-366) within an acceptable window (+/- 5 days)
 * Digits 5-12: Sequence digits (8 numeric characters)
 */
export function validateNpciUtr(utr: string): { isValid: boolean; reason?: string } {
  if (!utr || typeof utr !== 'string') {
    return { isValid: false, reason: 'UTR must be a non-empty string' };
  }

  const clean = utr.trim().replace(/\D/g, '');
  if (clean.length !== 12) {
    return { isValid: false, reason: 'UPI Reference Number (UTR) must be exactly 12 numeric digits' };
  }

  // Reject obvious dummy/repeating sequences
  if (/^(\d)\1{11}$/.test(clean) || clean === '123456789012' || clean === '012345678901') {
    return { isValid: false, reason: 'Invalid or repetitive UTR sequence detected' };
  }

  const now = new Date();
  const currentYearLastDigit = String(now.getUTCFullYear()).slice(-1);
  const utrYearDigit = clean.charAt(0);

  // Allow current year digit or adjacent year digit strictly during first 7 days of January
  const prevYearLastDigit = String(now.getUTCFullYear() - 1).slice(-1);
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const currentJulianDay = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (utrYearDigit !== currentYearLastDigit) {
    if (utrYearDigit === prevYearLastDigit) {
      if (currentJulianDay > 7) {
        return { isValid: false, reason: `UTR year identifier (${utrYearDigit}) is from a previous calendar cycle` };
      }
    } else {
      return { isValid: false, reason: `UTR year identifier (${utrYearDigit}) does not match active cycle` };
    }
  }

  const utrJulianDay = parseInt(clean.substring(1, 4), 10);

  if (isNaN(utrJulianDay) || utrJulianDay < 1 || utrJulianDay > 366) {
    return { isValid: false, reason: 'UTR Julian day is outside valid calendar range (001-366)' };
  }

  // Check tolerance window (within last 7 days or 1 day future for clock skew)
  const dayDifference = currentJulianDay - utrJulianDay;
  if (dayDifference < -1 || dayDifference > 7) {
    return { isValid: false, reason: 'UTR timestamp is outside acceptable validity window' };
  }

  return { isValid: true };
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
            select: APP_CHECKOUT_SELECT,
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
            select: APP_CHECKOUT_SELECT,
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
            select: APP_CHECKOUT_SELECT,
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
  static async getSession(
    sessionId: string,
    fallbackData?: any,
    options?: { skipReconcile?: boolean; clientSessionId?: string }
  ) {
    let session: any = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: {
        app: {
          select: APP_CHECKOUT_SELECT,
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
                select: APP_CHECKOUT_SELECT,
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
                select: APP_CHECKOUT_SELECT,
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
              select: APP_CHECKOUT_SELECT,
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

          // A payment link is a shareable URL that multiple customers can visit.
          // NEVER return a CAPTURED or COMPLETED session when looking up by payment link slug!
          const visitorClientId = options?.clientSessionId || (fallbackData as any)?.clientSessionId;
          let pendingSession = null;

          if (visitorClientId) {
            const candidateSessions = await prisma.checkoutSession.findMany({
              where: {
                appId: paymentLink.appId,
                status: 'PENDING',
                expiresAt: { gt: new Date() },
                createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
              },
              include: {
                app: {
                  select: APP_CHECKOUT_SELECT,
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 20,
            });

            pendingSession = candidateSessions.find((s) => {
              const meta = (s.metadata as any) || {};
              const isSameLink = meta.paymentLinkId === paymentLink.id || meta.paymentLinkSlug === paymentLink.slug;
              const isSameVisitor = meta.clientSessionId === visitorClientId;
              return isSameLink && isSameVisitor;
            }) || null;
          }

          if (pendingSession) {
            session = pendingSession;
          } else {
            const isCustomAmount = Number(paymentLink.amount) === 0 || Boolean((paymentLink as any).allowCustomAmount) || Boolean((paymentLink.metadata as any)?.allowCustomAmount);
            session = await prisma.checkoutSession.create({
              data: {
                appId: paymentLink.appId,
                amount: Number(paymentLink.amount),
                originalAmount: Number(paymentLink.amount),
                currency: (paymentLink.currency || 'INR').toUpperCase(),
                status: 'PENDING',
                title: paymentLink.title,
                description: paymentLink.description || '',
                returnUrl: paymentLink.redirectUrl || '',
                metadata: {
                  paymentLinkId: paymentLink.id,
                  paymentLinkSlug: paymentLink.slug,
                  clientSessionId: visitorClientId || undefined,
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
                  select: APP_CHECKOUT_SELECT,
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

    // Auto-heal Client SDK & Dynamic Checkout Sessions (sandbox/demo always allowed; cs_*/sess_* only in non-production)
    const isSandboxOrDemo =
      sessionId.startsWith('sess_sandbox_') ||
      sessionId.startsWith('sess_demo_');
    const allowDynamicAutoHeal = isSandboxOrDemo || process.env.NODE_ENV !== 'production';

    if (!session && allowDynamicAutoHeal && (
      sessionId.startsWith('cs_') ||
      sessionId.startsWith('sess_') ||
      fallbackData?.amount !== undefined ||
      fallbackData?.targetAmount !== undefined ||
      fallbackData?.title ||
      fallbackData?.productName
    )) {
      try {
        const rawAmount = fallbackData?.amount !== undefined
          ? Number(fallbackData.amount)
          : (fallbackData?.targetAmount !== undefined ? Number(fallbackData.targetAmount) : null);
        const amount = rawAmount && !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : 100;
        const currency = String(fallbackData?.currency || fallbackData?.targetCurrency || 'INR').toUpperCase();
        const title = fallbackData?.title || fallbackData?.productName || '180 Pay Checkout';
        const description = fallbackData?.description || '';
        const returnUrl = fallbackData?.returnUrl || fallbackData?.return_url || '';
        const cancelUrl = fallbackData?.cancelUrl || fallbackData?.cancel_url || '';
        const metadata = (fallbackData?.metadata && typeof fallbackData.metadata === 'object') ? fallbackData.metadata : {};

        // Resolve target app
        const candidateAppId = fallbackData?.appId || fallbackData?.clientId || (metadata as any)?.appId || (metadata as any)?.clientId;
        let app = null;

        if (candidateAppId) {
          app = await prisma.oAuthApp.findFirst({
            where: {
              OR: [
                { id: String(candidateAppId) },
                { clientId: String(candidateAppId) },
                { name: { equals: String(candidateAppId), mode: 'insensitive' } },
              ],
            },
            select: APP_CHECKOUT_SELECT,
          });
        }

        // Check if origin matches an existing registered app
        const rawOrigin = fallbackData?.origin || (metadata as any)?.origin;
        if (!app && rawOrigin) {
          try {
            const cleanOrigin = new URL(rawOrigin).origin.toLowerCase();
            const allApps = await prisma.oAuthApp.findMany({
              where: { isActive: true },
              select: APP_CHECKOUT_SELECT,
            });
            const matchingApp = allApps.find((a) => {
              if (a.allowedOrigins && a.allowedOrigins.some((ao) => ao.trim().toLowerCase().replace(/\/$/, '') === cleanOrigin)) return true;
              if (a.redirectUris && a.redirectUris.some((ru) => {
                try { return new URL(ru).origin.toLowerCase() === cleanOrigin; } catch (_) { return false; }
              })) return true;
              return false;
            });
            if (matchingApp) {
              app = matchingApp;
            }
          } catch (_) {}
        }

        if (!app) {
          const platformApp = await CheckoutService.resolvePlatformOAuthApp();
          if (platformApp) {
            app = {
              id: platformApp.id,
              name: platformApp.name,
              description: platformApp.description || '180 Merchant Verified Checkout',
              logoUrl: platformApp.logoUrl || '',
              isVerified: true,
              enablePay: true,
              enableAuth: true,
              clientSecretHash: platformApp.clientSecretHash,
              clientSecretHint: platformApp.clientSecretHint,
              redirectUris: platformApp.redirectUris || [],
              allowedOrigins: platformApp.allowedOrigins || [],
            } as any;
          }
        }

        if (app) {
          session = await prisma.checkoutSession.create({
            data: {
              id: sessionId,
              appId: app.id,
              amount,
              originalAmount: amount,
              currency,
              status: 'PENDING',
              mode: 'payment',
              title,
              description,
              returnUrl,
              cancelUrl,
              metadata: {
                ...metadata,
                source: metadata?.source || 'AUTO_RESOLVED_CLIENT_SDK',
                autoCreated: true,
              },
              expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour auto-refreshing expiry
            },
            include: {
              app: {
                select: APP_CHECKOUT_SELECT,
              },
            },
          });
        }
      } catch (autoHealErr) {
        console.warn('[CheckoutService:getSession] Could not auto-heal client-side session:', autoHealErr);
      }
    }

    if (!session) {
      throw new Error('Checkout session not found');
    }

    // 1. If session has an active gateway order and is not yet CAPTURED, ALWAYS attempt live reconciliation FIRST!
    // This guarantees that if a customer completed payment in UPI / bank app, the session is captured immediately,
    // even if client callbacks dropped or the nominal 30-minute window passed while user was completing 3DS/UPI.
    if (
      !options?.skipReconcile &&
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

    // 2. Keep EXPIRED terminal for production sessions; only auto-renew sandbox/demo or active PENDING grace
    const isSandboxSession = session.id.startsWith('sess_sandbox_') || session.id.startsWith('sess_demo_');
    if (session.status === 'PENDING' && session.expiresAt < new Date()) {
      if (isSandboxSession || process.env.NODE_ENV !== 'production') {
        const renewedExpiry = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { expiresAt: renewedExpiry },
        }).catch(() => {});
        session.expiresAt = renewedExpiry;
      } else {
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        }).catch(() => {});
        session.status = 'EXPIRED';
      }
    } else if (session.status === 'EXPIRED' && isSandboxSession) {
      const renewedExpiry = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'PENDING', expiresAt: renewedExpiry },
      }).catch(() => {});
      session.status = 'PENDING';
      session.expiresAt = renewedExpiry;
    }

    const platformSettings = await this.getPlatformGatewaySettings();
    const config = this.resolveGatewayConfig(session.app, platformSettings);

    return {
      ...session,
      isExpired: false,
      hasPlatformGateway: config.enablePlatformGateway,
      hasDirectUpi: config.enableDirectUpi,
      enablePlatformGateway: config.enablePlatformGateway,
      enableDirectUpi: config.enableDirectUpi,
      platformGatewayBrand: config.platformGatewayBrand,
      app: session.app ? {
        ...session.app,
        enablePlatformGateway: config.enablePlatformGateway,
        enableDirectUpi: config.enableDirectUpi,
        customUpiId: config.customUpiId || session.app.customUpiId,
        customUpiName: config.customUpiName || session.app.customUpiName,
      } : session.app,
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
      try {
        session = await this.getSession(sessionId, undefined, { skipReconcile: true });
      } catch (_) {}
    }

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
                  select: APP_CHECKOUT_SELECT,
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
                  select: APP_CHECKOUT_SELECT,
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

  private static platformSettingsCache: { settings: any; expiresAt: number } | null = null;

  /**
   * Fetches the global platform gateway and direct UPI settings from the database
   * with a 5-second resilient in-memory cache to guarantee real-time reactivity without DB pressure.
   */
  public static async getPlatformGatewaySettings(): Promise<any> {
    if (this.platformSettingsCache && this.platformSettingsCache.expiresAt > Date.now()) {
      return this.platformSettingsCache.settings;
    }
    try {
      let settings = await (prisma as any).platformGatewaySettings.findUnique({
        where: { id: 'global' },
      });
      if (!settings) {
        settings = await (prisma as any).platformGatewaySettings.create({
          data: {
            id: 'global',
            enableDirectUpi: true,
            enableRazorpay: true,
            enableStripe: true,
            enablePayU: true,
            defaultGateway: 'RAZORPAY',
            allowDeveloperByog: true,
            directUpiAutoCaptureLimit: 50000.0,
          },
        });
      }
      this.platformSettingsCache = { settings, expiresAt: Date.now() + 5000 };
      return settings;
    } catch (err: any) {
      console.warn('[CheckoutService:getPlatformGatewaySettings] Warning:', err?.message);
      return {
        enableDirectUpi: true,
        enableRazorpay: true,
        enableStripe: true,
        enablePayU: true,
        defaultGateway: 'RAZORPAY',
        allowDeveloperByog: true,
        directUpiAutoCaptureLimit: 50000.0,
      };
    }
  }

  public static invalidatePlatformGatewaySettingsCache(): void {
    this.platformSettingsCache = null;
    this.methodsCache.clear();
  }

  /**
   * Resolves the payment gateway credentials and active rails based on:
   * 1. Platform-wide Admin Feature Flags (from PlatformGatewaySettings DB table)
   * 2. Developer App Bring Your Own Gateway (BYOG) credentials
   * 3. Direct Native UPI configuration with fallback
   */
  public static resolveGatewayConfig(app?: any, platformSettings?: any): {
    gatewayType: 'RAZORPAY' | 'STRIPE' | 'DIRECT_UPI' | 'PAYU';
    keyId: string;
    keySecret: string;
    webhookSecret?: string;
    customUpiId?: string;
    customUpiName?: string;
    isCustomBYOG: boolean;
    enableDirectUpi: boolean;
    enablePlatformGateway: boolean;
    platformGatewayBrand: 'RAZORPAY' | 'STRIPE' | 'PAYU';
  } {
    const settings = platformSettings || this.platformSettingsCache?.settings;
    const globalDirectUpi = settings ? settings.enableDirectUpi !== false : true;
    const globalRazorpay = settings ? Boolean(settings.enableRazorpay) : true;
    const globalStripe = settings ? Boolean(settings.enableStripe) : true;
    const globalPayU = settings ? Boolean(settings.enablePayU) : true;
    const isAnyPlatformGatewayEnabled = globalRazorpay || globalStripe || globalPayU;
    const allowBYOG = settings ? settings.allowDeveloperByog !== false : true;

    const appAny = app || {};

    // Direct UPI resolution (strictly requires developer's configured VPA; never fall back to dummy 180core@okaxis)
    const rawAppUpi = String(
      appAny.customUpiId || (appAny.customGatewayType === 'DIRECT_UPI' ? appAny.customGatewayKeyId : '') || ''
    ).trim();
    const envPlatformUpi = String(process.env.PLATFORM_UPI_ID || '').trim();
    const upiId = rawAppUpi || envPlatformUpi;
    const upiName = appAny.customUpiName || appAny.name || 'Merchant';

    // Direct UPI is only active when platform allows it, app hasn't disabled it, AND a real VPA is configured
    const enableDirectUpi = globalDirectUpi && appAny.enableDirectUpi !== false && Boolean(rawAppUpi || (envPlatformUpi && !appAny.id));

    // Developer BYOG check
    const hasDeveloperByog = Boolean(
      allowBYOG &&
      appAny.customGatewayType &&
      appAny.customGatewayType !== 'NONE' &&
      appAny.customGatewayType !== 'DIRECT_UPI' &&
      appAny.customGatewayKeyId
    );

    // Platform gateway is enabled only if at least one platform gateway is globally active AND the app didn't disable it,
    // OR if the developer has their own BYOG keys configured and allowed
    const enablePlatformGateway = (isAnyPlatformGatewayEnabled && appAny.enablePlatformGateway !== false) || hasDeveloperByog;

    // Determine platform gateway brand
    let platformGatewayBrand: 'RAZORPAY' | 'STRIPE' | 'PAYU' = 'RAZORPAY';
    const defaultGateway = (settings?.defaultGateway || process.env.PAYMENT_GATEWAY || '').toUpperCase().trim();

    if (defaultGateway === 'STRIPE' && globalStripe) {
      platformGatewayBrand = 'STRIPE';
    } else if (defaultGateway === 'PAYU' && globalPayU) {
      platformGatewayBrand = 'PAYU';
    } else if (globalRazorpay) {
      platformGatewayBrand = 'RAZORPAY';
    } else if (globalStripe) {
      platformGatewayBrand = 'STRIPE';
    } else if (globalPayU) {
      platformGatewayBrand = 'PAYU';
    }

    // 0. Direct Native UPI Custom Gateway Choice (Developer selected Direct UPI in app settings)
    if (appAny.customGatewayType === 'DIRECT_UPI') {
      const isDual = Boolean(appAny.enablePlatformGateway && isAnyPlatformGatewayEnabled);
      return {
        gatewayType: 'DIRECT_UPI',
        keyId: upiId,
        keySecret: '',
        customUpiId: upiId,
        customUpiName: upiName,
        isCustomBYOG: true,
        enableDirectUpi: true,
        enablePlatformGateway: isDual,
        platformGatewayBrand,
      };
    }

    // 0b. Direct UPI Exclusive (Platform Gateway disabled globally or by app, and Direct UPI is available)
    if (!enablePlatformGateway && enableDirectUpi) {
      return {
        gatewayType: 'DIRECT_UPI',
        keyId: upiId,
        keySecret: '',
        customUpiId: upiId,
        customUpiName: upiName,
        isCustomBYOG: Boolean(rawAppUpi),
        enableDirectUpi: true,
        enablePlatformGateway: false,
        platformGatewayBrand,
      };
    }

    // 1. Custom BYOG Stripe
    if (enablePlatformGateway && hasDeveloperByog && appAny.customGatewayType === 'STRIPE') {
      return {
        gatewayType: 'STRIPE',
        keyId: appAny.customGatewayKeyId || process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_KEY_ID || '',
        keySecret: decryptGatewaySecret(appAny.customGatewaySecret) || process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: decryptGatewaySecret(appAny.customGatewayWebhookSecret) || process.env.STRIPE_WEBHOOK_SECRET,
        customUpiId: enableDirectUpi ? upiId : undefined,
        customUpiName: enableDirectUpi ? upiName : undefined,
        isCustomBYOG: true,
        enableDirectUpi,
        enablePlatformGateway: true,
        platformGatewayBrand: 'STRIPE',
      };
    }

    // 2. Custom BYOG Razorpay
    if (enablePlatformGateway && hasDeveloperByog && appAny.customGatewayType === 'RAZORPAY') {
      return {
        gatewayType: 'RAZORPAY',
        keyId: appAny.customGatewayKeyId,
        keySecret: decryptGatewaySecret(appAny.customGatewaySecret),
        webhookSecret: decryptGatewaySecret(appAny.customGatewayWebhookSecret) || process.env.RAZORPAY_WEBHOOK_SECRET,
        customUpiId: enableDirectUpi ? upiId : undefined,
        customUpiName: enableDirectUpi ? upiName : undefined,
        isCustomBYOG: true,
        enableDirectUpi,
        enablePlatformGateway: true,
        platformGatewayBrand: 'RAZORPAY',
      };
    }

    // 3. Platform-level default (Razorpay or Stripe)
    let keyId = '';
    let keySecret = '';
    let webhookSecret = '';

    if (platformGatewayBrand === 'STRIPE') {
      keyId = process.env.STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_KEY_ID || process.env.NEXT_PUBLIC_STRIPE_KEY || '';
      keySecret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY_SECRET || '';
      webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    } else {
      keyId = (process.env.RAZORPAY_KEY_ID || '').trim().replace(/^['"]|['"]$/g, '');
      keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/^['"]|['"]$/g, '');
      webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    }

    return {
      gatewayType: enablePlatformGateway ? platformGatewayBrand : (enableDirectUpi ? 'DIRECT_UPI' : platformGatewayBrand),
      keyId: enablePlatformGateway ? keyId : upiId,
      keySecret: enablePlatformGateway ? keySecret : '',
      webhookSecret,
      customUpiId: enableDirectUpi ? upiId : undefined,
      customUpiName: enableDirectUpi ? upiName : undefined,
      isCustomBYOG: false,
      enableDirectUpi,
      enablePlatformGateway,
      platformGatewayBrand,
    };
  }

  private static methodsCache: Map<string, { data: any; expiresAt: number }> = new Map();

  /**
   * Fetches supported payment methods dynamically from the gateway (Razorpay / Stripe).
   * Supports dynamic banks, card networks, and country-specific ordering without hardcoding.
   */
  static async getPaymentMethods(app?: any, currency: string = 'INR', countryCode?: string) {
    const platformSettings = await this.getPlatformGatewaySettings();
    const config = this.resolveGatewayConfig(app, platformSettings);
    const { gatewayType, keyId, enableDirectUpi, enablePlatformGateway, platformGatewayBrand } = config;
    const directUpiData = enableDirectUpi && config.customUpiId ? {
      upiId: config.customUpiId,
      payeeName: config.customUpiName || app?.name || 'Merchant',
    } : undefined;

    const cacheKey = `${gatewayType}_${keyId}_${currency}_${countryCode || ''}_${enableDirectUpi}_${enablePlatformGateway}`;
    const cached = this.methodsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const isIndia = (currency || '').toUpperCase() === 'INR' || (countryCode || '').toUpperCase() === 'IN';

    // 0. If Gateway is DIRECT_UPI Only
    if (gatewayType === 'DIRECT_UPI' || (!enablePlatformGateway && directUpiData)) {
      const upiId = config.customUpiId || keyId;
      const payeeName = config.customUpiName || app?.name || 'Merchant';
      const directUpiMethods = {
        gateway: 'DIRECT_UPI',
        gatewayBrand: 'DIRECT_UPI',
        isIndia: true,
        defaultMethod: 'UPI',
        priorityOrder: ['UPI'],
        supportsUpi: true,
        supportsCard: false,
        supportsNetbanking: false,
        hasDirectUpi: true,
        hasPlatformGateway: false,
        cardNetworks: [],
        banks: [],
        popularBanks: [],
        directUpi: {
          upiId,
          payeeName,
        },
      };
      this.methodsCache.set(cacheKey, { data: directUpiMethods, expiresAt: Date.now() + 3600 * 1000 });
      return directUpiMethods;
    }

    // 1. If Gateway is STRIPE
    if (gatewayType === 'STRIPE') {
      const stripeMethods = {
        gateway: 'STRIPE',
        gatewayBrand: 'STRIPE',
        isIndia,
        defaultMethod: 'CARD',
        priorityOrder: ['CARD', 'NETBANKING'],
        supportsUpi: Boolean(directUpiData),
        supportsCard: true,
        supportsNetbanking: false,
        hasDirectUpi: Boolean(directUpiData),
        hasPlatformGateway: true,
        directUpi: directUpiData,
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
      gatewayBrand: 'RAZORPAY',
      isIndia,
      defaultMethod: isIndia && (supportsUpi || Boolean(directUpiData)) ? 'UPI' : 'CARD',
      priorityOrder: isIndia && (supportsUpi || Boolean(directUpiData))
        ? ['UPI', 'CARD', 'NETBANKING']
        : supportsUpi
        ? ['CARD', 'NETBANKING', 'UPI']
        : ['CARD', 'NETBANKING'],
      supportsUpi: supportsUpi || Boolean(directUpiData),
      hasDirectUpi: Boolean(directUpiData),
      hasPlatformGateway: true,
      directUpi: directUpiData,
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
      origin?: string;
    }
  ) {
    const session = await this.getSession(sessionId, options);

    if (session.status === 'CAPTURED') {
      throw new Error('This checkout session has already been completed.');
    }

    if (session.status === 'EXPIRED' || session.expiresAt < new Date()) {
      const isSandboxOrder = session.id.startsWith('sess_sandbox_') || session.id.startsWith('sess_demo_');
      if (session.status === 'PENDING' && (isSandboxOrder || process.env.NODE_ENV !== 'production')) {
        const renewedExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { expiresAt: renewedExpiry, status: 'PENDING' },
        }).catch(() => {});
        session.expiresAt = renewedExpiry;
        session.status = 'PENDING';
      } else {
        throw new Error('This checkout session has expired.');
      }
    }

    const platformSettings = await this.getPlatformGatewaySettings();
    const config = this.resolveGatewayConfig(session.app, platformSettings);
    const { gatewayType, keyId, keySecret, enableDirectUpi, enablePlatformGateway, platformGatewayBrand } = config;
    const sessionMeta = (session.metadata as any) || {};

    // 1. Determine target currency and amount with multi-currency conversion
    const targetCurrency = String(
      options?.targetCurrency || sessionMeta.appliedCurrency || session.currency || 'INR'
    ).toUpperCase();

    // Only allow custom amount mutation if the session explicitly allows custom amounts (e.g. wallet top-ups)
    const isCustomAmountAllowed = Boolean(
      sessionMeta.allowCustomAmount ||
      (session.metadata as any)?.allowCustomAmount ||
      sessionId.startsWith('sess_topup_')
    );

    let targetAmount = session.amount;

    if (isCustomAmountAllowed && typeof options?.targetAmount === 'number' && options.targetAmount > 0) {
      targetAmount = options.targetAmount;
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
    } else {
      if (targetCurrency !== (session.currency || 'INR').toUpperCase()) {
        targetAmount = GeoPricingService.convertCurrency(
          session.amount,
          session.currency || 'USD',
          targetCurrency
        );
      }
    }

    let amountSmallestUnit =
      targetCurrency === 'JPY' ? Math.round(targetAmount) : Math.round(targetAmount * 100);

    if (targetCurrency === 'INR' && amountSmallestUnit < 100) {
      amountSmallestUnit = 100;
    } else if (targetCurrency === 'USD' && amountSmallestUnit < 50) {
      amountSmallestUnit = 50;
    }

    // 0. GENERATE DIRECT NATIVE UPI PAYLOAD IF ENABLED
    let directUpiPayload: any = null;
    if (enableDirectUpi && config.customUpiId) {
      const upiId = config.customUpiId;
      const payeeName = config.customUpiName || session.app?.name || '180 Merchant';
      const actualAmountInr = targetCurrency === 'INR' ? targetAmount : GeoPricingService.convertCurrency(targetAmount, targetCurrency, 'INR');
      const formattedAmount = (Math.round(actualAmountInr * 100) / 100).toFixed(2);
      const shortRef = session.id.replace(/-/g, '').slice(0, 16);

      const basePayload = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=180P_${shortRef}`;
      directUpiPayload = {
        upiId,
        payeeName,
        amount: parseFloat(formattedAmount),
        currency: 'INR',
        genericUri: `upi://pay?${basePayload}`,
        gpayUri: `tez://upi/pay?${basePayload}`,
        phonepeUri: `phonepe://pay?${basePayload}`,
        paytmUri: `paytmmp://pay?${basePayload}`,
        qrPayload: `upi://pay?${basePayload}`,
      };
    }

    // If Direct UPI Only (Platform Gateway is disabled or requested rail is direct UPI)
    if (gatewayType === 'DIRECT_UPI' || (!enablePlatformGateway && directUpiPayload)) {
      const orderId = `upi_${session.id.replace(/-/g, '').slice(0, 24)}`;
      const actualAmountInr = targetCurrency === 'INR' ? targetAmount : GeoPricingService.convertCurrency(targetAmount, targetCurrency, 'INR');
      return {
        orderId,
        amountPaise: Math.round(actualAmountInr * 100),
        currency: 'INR',
        keyId: config.customUpiId || keyId,
        gatewayType: 'DIRECT_UPI',
        gatewayBrand: 'DIRECT_UPI',
        hasDirectUpi: true,
        hasPlatformGateway: enablePlatformGateway,
        directUpi: directUpiPayload,
      };
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
          gatewayBrand: 'STRIPE',
          hasPlatformGateway: true,
          hasDirectUpi: Boolean(directUpiPayload),
          directUpi: directUpiPayload || undefined,
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
          gatewayBrand: 'STRIPE',
          hasPlatformGateway: true,
          hasDirectUpi: Boolean(directUpiPayload),
          directUpi: directUpiPayload || undefined,
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
        gatewayBrand: 'STRIPE',
        hasPlatformGateway: true,
        hasDirectUpi: Boolean(directUpiPayload),
        directUpi: directUpiPayload || undefined,
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
        gatewayBrand: 'RAZORPAY',
        hasPlatformGateway: true,
        hasDirectUpi: Boolean(directUpiPayload),
        directUpi: directUpiPayload || undefined,
      };
    }

    // Simulated order permitted in automated test or development environments without live credentials
    const isNonProd = process.env.NODE_ENV === 'test' || process.env.NODE_ENV !== 'production';
    const isSimulatedKey =
      !keySecret ||
      !keyId ||
      keyId.includes('simulated') ||
      keyId.includes('mock_') ||
      keySecret.includes('simulated') ||
      keySecret.includes('mock_') ||
      keySecret.includes('placeholder');

    if (isNonProd || isSimulatedKey) {
      if (isNonProd || !keySecret || isSimulatedKey) {
        return {
          orderId: `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          amountPaise: amountSmallestUnit,
          currency: targetCurrency,
          keyId: keyId || 'rzp_test_simulated',
          gatewayType: 'RAZORPAY',
          gatewayBrand: 'RAZORPAY',
          hasPlatformGateway: true,
          hasDirectUpi: Boolean(directUpiPayload),
          directUpi: directUpiPayload || undefined,
        };
      }
      throw new Error('Payment gateway credentials not configured on platform');
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
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[Razorpay Dev Fallback] Falling back to simulated order:', inrErrorDesc);
            return {
              orderId: `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              amountPaise: amountSmallestUnit,
              currency: targetCurrency,
              keyId: keyId || 'rzp_test_simulated',
              gatewayType: 'RAZORPAY',
              gatewayBrand: 'RAZORPAY',
              hasPlatformGateway: true,
              hasDirectUpi: Boolean(directUpiPayload),
              directUpi: directUpiPayload || undefined,
            };
          }
          const sanitizedErr = inrErrorDesc === 'Authentication failed'
            ? 'Payment gateway authorization failed. Please check merchant account credentials.'
            : inrErrorDesc || 'Failed to initialize payment with Razorpay';
          throw new Error(sanitizedErr);
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Razorpay Dev Fallback] Falling back to simulated order:', errorDesc);
          return {
            orderId: `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            amountPaise: amountSmallestUnit,
            currency: targetCurrency,
            keyId: keyId || 'rzp_test_simulated',
            gatewayType: 'RAZORPAY',
            gatewayBrand: 'RAZORPAY',
            hasPlatformGateway: true,
            hasDirectUpi: Boolean(directUpiPayload),
            directUpi: directUpiPayload || undefined,
          };
        }
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
      gatewayBrand: 'RAZORPAY',
      hasPlatformGateway: true,
      hasDirectUpi: Boolean(directUpiPayload),
      directUpi: directUpiPayload || undefined,
    };
  }

  /**
   * Automatically verifies and captures a Direct Native UPI payment
   * without requiring manual UTR input from the customer.
   */
  static async autoVerifyDirectUpiPayment(input: {
    sessionId: string;
    approvalRefNo?: string;
    responseCode?: string;
    status?: string;
    txnRef?: string;
    payerVpa?: string;  
    rawPayload?: any;
  }): Promise<any> {
    const { sessionId } = input;

    // In-flight deduplication to prevent concurrent transaction deadlocks (same as verifyDirectPayment)
    if (this.inFlightVerifications.has(sessionId)) {
      return await this.inFlightVerifications.get(sessionId)!;
    }

    const verificationPromise = this._doAutoVerifyDirectUpi(input).finally(() => {
      this.inFlightVerifications.delete(sessionId);
    });

    this.inFlightVerifications.set(sessionId, verificationPromise);
    return await verificationPromise;
  }

  private static async _doAutoVerifyDirectUpi(input: {
    sessionId: string;
    approvalRefNo?: string;
    responseCode?: string;
    status?: string;
    txnRef?: string;
    payerVpa?: string;
    rawPayload?: any;
  }): Promise<any> {
    const { sessionId, approvalRefNo, responseCode, status, payerVpa, rawPayload } = input;
    const session = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      include: { app: { select: APP_CHECKOUT_SELECT } },
    });

    if (!session) {
      throw new Error('Checkout session not found');
    }

    if (session.status === 'CANCELLED' || (session.metadata as any)?.disputed) {
      throw new Error('This checkout session has been disputed or cancelled and cannot be verified.');
    }

    if (session.status === 'EXPIRED' || (session.expiresAt && session.expiresAt < new Date())) {
      throw new Error('This checkout session has expired. Please create a new checkout session.');
    }

    if (session.status === 'CAPTURED') {
      return {
        success: true,
        session,
        alreadyCaptured: true,
        transactionId: (session.metadata as any)?.transactionId || session.id,
        returnUrl: session.returnUrl,
      };
    }

    // Clean & validate bank approval reference (UTR) if provided
    let cleanUtr = String(approvalRefNo || '').trim().replace(/\D/g, '');
    let isProvisional = false;

    if (cleanUtr) {
      const utrCheck = validateNpciUtr(cleanUtr);
      if (!utrCheck.isValid) {
        throw new Error(utrCheck.reason || 'Invalid UPI Reference Number format');
      }
    } else {
      isProvisional = true;
      cleanUtr = `PROV_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    }

    // Pre-check for duplicate UTR to avoid replay attacks and transaction aborts
    if (cleanUtr && !isProvisional) {
      const existingVerification = await prisma.upiPaymentVerification.findUnique({
        where: { utr: cleanUtr },
      });
      if (existingVerification) {
        if (existingVerification.sessionId === session.id) {
          return {
            success: true,
            session,
            alreadyCaptured: true,
            transactionId: (session.metadata as any)?.transactionId || session.id,
            returnUrl: session.returnUrl,
          };
        }
        throw new Error('This payment reference has already been processed on another transaction.');
      }
    }

    const payeeVpa = (session.app as any)?.customUpiId || 'merchant@directupi';
    const transactionId = `pay_upi_${cleanUtr}_${Date.now()}`;
    const verificationType = cleanUtr && !isProvisional ? 'NPCI_BANK_UTR' : 'PROVISIONAL_INTENT';
    const riskLevel = isProvisional ? 'MEDIUM' : 'LOW';

    // Security gate: Provisional verifications (no valid UTR) set PENDING_VERIFICATION
    // Only confirmed NPCI UTR submissions auto-capture and credit wallets
    const captureStatus = isProvisional ? 'PENDING_VERIFICATION' : 'CAPTURED';

    // Atomic database update & verification logging
    let result: any;
    try {
      result = await prisma.$transaction(async (tx: any) => {
        // Record or upgrade verification in UpiPaymentVerification table
        await tx.upiPaymentVerification.upsert({
          where: { sessionId: session.id },
          create: {
            sessionId: session.id,
            appId: session.appId,
            utr: cleanUtr,
            amount: session.amount,
            currency: session.currency || 'INR',
            payeeVpa,
            payerVpa: payerVpa || null,
            status: captureStatus,
            responseCode: responseCode || '00',
            rawPayload: rawPayload ? JSON.parse(JSON.stringify(rawPayload)) : undefined,
          },
          update: {
            utr: cleanUtr,
            payerVpa: payerVpa || null,
            status: captureStatus,
            responseCode: responseCode || '00',
            rawPayload: rawPayload ? JSON.parse(JSON.stringify(rawPayload)) : undefined,
            verifiedAt: new Date(),
          },
        });

        // Mark session status based on verification strength
        const updatedSession = await tx.checkoutSession.update({
          where: { id: session.id },
          data: {
            status: captureStatus,
            completedAt: isProvisional ? undefined : new Date(),
            metadata: {
              ...((session.metadata as any) || {}),
              gateway: 'DIRECT_UPI',
              transactionId,
              utr: cleanUtr,
              autoCaptured: !isProvisional,
              isProvisional,
              verificationType,
              riskLevel,
              payeeVpa,
              ...(isProvisional ? { pendingVerificationAt: new Date().toISOString() } : { completedAt: new Date().toISOString() }),
            },
          },
          include: {
            app: { select: APP_CHECKOUT_SELECT },
          },
        });

        // Direct Native UPI settles straight to the merchant's bank account (customUpiId), never 180 Core's pool.
        // Record a zero-balance-impact audit ledger entry so withdrawable appWallet.balance is not inflated.
        if (!isProvisional) {
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

          await tx.ledgerEntry.create({
            data: {
              walletId: appWallet.id,
              amount: 0,
              balanceAfter: appWallet.balance,
              type: 'DIRECT_UPI_SETTLED',
              referenceId: transactionId,
              description: `Direct UPI payment (${session.currency || 'INR'} ${session.amount}) settled directly to ${payeeVpa}`,
              metadata: {
                sessionId: session.id,
                gateway: 'DIRECT_UPI',
                directAmount: session.amount,
                currency: session.currency || 'INR',
                utr: cleanUtr,
                verificationType,
                payeeVpa,
              },
            },
          });
        }

        return { session: updatedSession, transactionId };
      });
    } catch (txErr: any) {
      if (txErr.code === 'P2002' || txErr.message?.includes('Unique constraint')) {
        throw new Error('This payment reference has already been processed on another transaction.');
      }
      throw txErr;
    }

    // Asynchronously dispatch webhook to developer app based on verification strength
    const webhookData = {
      sessionId: session.id,
      transactionId: result.transactionId,
      amount: session.amount,
      currency: session.currency,
      title: session.title,
      gateway: 'DIRECT_UPI',
      utr: cleanUtr,
      payeeVpa,
      verificationType,
      isProvisional,
      riskLevel,
      status: captureStatus,
      timestamp: new Date().toISOString(),
    };

    if (isProvisional) {
      this.dispatchPaymentWebhook(session.appId, {
        event: 'payment.pending_verification',
        data: webhookData,
      }).catch((err) => console.warn('[CheckoutService] Failed to dispatch webhook:', err?.message));
    } else {
      Promise.allSettled([
        this.dispatchPaymentWebhook(session.appId, {
          event: 'payment.captured',
          data: webhookData,
        }),
        this.dispatchPaymentWebhook(session.appId, {
          event: 'payment.succeeded',
          data: webhookData,
        }),
      ]).catch((err) => console.warn('[CheckoutService] Failed to dispatch webhook:', err?.message));
    }

    return {
      success: true,
      session: result.session,
      transactionId: result.transactionId,
      utr: cleanUtr,
      isProvisional,
      status: captureStatus,
      returnUrl: session.returnUrl,
    };
  }

  /**
   * Allows application developers to dispute or void a fraudulent Direct UPI submission
   */
  static async disputeDirectUpiPayment(input: {
    appId: string;
    sessionId: string;
    reason?: string;
  }) {
    const { appId, sessionId, reason } = input;
    const session = await prisma.checkoutSession.findFirst({
      where: { id: sessionId, appId },
      include: { upiVerification: true },
    });

    if (!session) {
      throw new Error('Checkout session not found or does not belong to this application');
    }

    const updatedSession = await prisma.$transaction(async (tx: any) => {
      if (session.upiVerification) {
        await tx.upiPaymentVerification.update({
          where: { id: session.upiVerification.id },
          data: { status: 'DISPUTED' },
        });
      }

      // Reverse any legacy CHECKOUT_RECEIVE credit if this session had previously incremented appWallet
      const txId = (session.metadata as any)?.transactionId;
      if (txId) {
        const legacyCredit = await tx.ledgerEntry.findFirst({
          where: { referenceId: txId, type: 'CHECKOUT_RECEIVE', amount: { gt: 0 } },
        });
        if (legacyCredit) {
          const appWallet = await tx.wallet.findUnique({ where: { id: legacyCredit.walletId } });
          if (appWallet) {
            const reversedBalance = Math.round((appWallet.balance - legacyCredit.amount) * 100) / 100;
            await tx.wallet.update({
              where: { id: appWallet.id },
              data: { balance: reversedBalance },
            });
            await tx.ledgerEntry.create({
              data: {
                walletId: appWallet.id,
                amount: -legacyCredit.amount,
                balanceAfter: reversedBalance,
                type: 'DIRECT_UPI_DISPUTED',
                referenceId: `rev_${txId}`,
                description: `Dispute reversal for Direct UPI session ${session.id}`,
                metadata: { sessionId: session.id, reason: reason || 'Merchant dispute' },
              },
            });
          }
        }
      }

      return await tx.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'CANCELLED',
          metadata: {
            ...((session.metadata as any) || {}),
            disputed: true,
            disputeReason: reason || 'Merchant indicated payment was not received in bank account',
            disputedAt: new Date().toISOString(),
          },
        },
      });
    });

    // Dispatch webhook to notify the merchant's application to revoke fulfillment
    await this.dispatchPaymentWebhook(appId, {
      event: 'payment.revoked',
      data: {
        sessionId: session.id,
        status: 'REVOKED',
        reason: reason || 'Merchant dispute',
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});

    return { success: true, session: updatedSession };
  }

  private static inFlightVerifications = new Map<string, Promise<any>>();

  /**
   * Internal-only capture path invoked exclusively after Razorpay/Stripe webhook HMAC verification.
   */
  static async captureFromVerifiedWebhook(input: {
    sessionId: string;
    orderId: string;
    paymentId: string;
  }): Promise<any> {
    const { sessionId } = input;
    if (this.inFlightVerifications.has(sessionId)) {
      return await this.inFlightVerifications.get(sessionId)!;
    }

    const verificationPromise = this._doVerifyDirectPayment({
      ...input,
      signature: 'verified_webhook',
      _internalTrustedWebhook: true,
    }).finally(() => {
      this.inFlightVerifications.delete(sessionId);
    });

    this.inFlightVerifications.set(sessionId, verificationPromise);
    return await verificationPromise;
  }

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

    const verificationPromise = this._doVerifyDirectPayment({
      sessionId: input.sessionId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
      _internalTrustedWebhook: false,
    }).finally(() => {
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
    _internalTrustedWebhook?: boolean;
  }) {
    const { sessionId, orderId, paymentId, signature, _internalTrustedWebhook } = input;

    let session = await this.getSession(sessionId, undefined, { skipReconcile: true });

    const { gatewayType, keyId, keySecret } = this.resolveGatewayConfig(session.app);

    // Direct UPI verification: delegate to the auto-verify engine instead of HMAC
    if (gatewayType === 'DIRECT_UPI' || orderId.startsWith('upi_')) {
      return this.autoVerifyDirectUpiPayment({
        sessionId,
        approvalRefNo: signature !== 'mock_sig_sandbox' && !signature.startsWith('sig_sim_') ? signature : undefined,
        responseCode: '00',
        status: 'SUCCESS',
        txnRef: orderId,
        rawPayload: { orderId, paymentId, delegatedFrom: 'verifyDirectPayment' },
      });
    }

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
      const hasLiveKey = Boolean(keySecret && !keySecret.includes('simulated') && !keySecret.includes('mock'));
      const isTestMock =
        (process.env.NODE_ENV === 'test' || process.env.NODE_ENV !== 'production' || !hasLiveKey) &&
        (orderId?.startsWith('order_sim_') || signature === 'mock_sig_sandbox' || signature?.startsWith('sig_sim_'));

      if (!isTestMock && !_internalTrustedWebhook) {
        if (!keySecret) {
          throw new Error('Payment gateway key secret not configured');
        }

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
            const activeKeyId = (keyId || (session.app as any)?.customGatewayKeyId || process.env.RAZORPAY_KEY_ID || '').trim();
            const activeKeySec = (keySecret || (session.app as any)?.customGatewaySecret || process.env.RAZORPAY_KEY_SECRET || '').trim();
            if (activeKeyId && activeKeySec) {
              const auth = Buffer.from(`${activeKeyId}:${activeKeySec}`).toString('base64');
              const rzpPayRes = await axios.get(`https://api.razorpay.com/v1/payments/${paymentId}`, {
                headers: { Authorization: `Basic ${auth}` },
                timeout: 5000,
              });
              const pData = rzpPayRes.data;
              if (pData && (pData.status === 'captured' || pData.status === 'authorized')) {
                // Security validation: verify order binding
                if (pData.order_id && pData.order_id !== orderId) {
                  throw new Error('Payment was not made for this order');
                }
                if (pData.status === 'authorized') {
                  try {
                    const capRes = await axios.post(
                      `https://api.razorpay.com/v1/payments/${paymentId}/capture`,
                      { amount: pData.amount, currency: pData.currency },
                      { headers: { Authorization: `Basic ${auth}` }, timeout: 5000 }
                    );
                    if (capRes.data?.status === 'captured') {
                      isValid = true;
                    }
                  } catch (capErr: any) {
                    console.warn('[CheckoutService:verifyDirectPayment] Auto-capture authorized payment warning:', capErr.message);
                  }
                }
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

      if (session.status === 'CANCELLED') {
        throw new Error('This checkout session was cancelled.');
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
        const topupUserId = (session.metadata as any)?.userId || (session as any).userId;
        if (!topupUserId) {
          throw new Error('Wallet top-up session is missing target userId');
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
            result.session.id,
            result.session.amount
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
      if (session.status === 'PENDING') {
        const renewedExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { expiresAt: renewedExpiry, status: 'PENDING' },
        }).catch(() => {});
        session.expiresAt = renewedExpiry;
        session.status = 'PENDING';
      } else {
        throw new Error('This checkout session has expired. Please create a new one.');
      }
    }

    const { gatewayType, keySecret } = this.resolveGatewayConfig(session.app);
    const isFreeCheckout = session.amount !== null && session.amount <= 0;
    if (!isFreeCheckout) {
      if (gatewayType === 'DIRECT_UPI' || process.env.NODE_ENV === 'production') {
        throw new Error(
          'Direct bypass payment is disabled. Please complete payment through the configured payment rail.'
        );
      }
      const hasLiveGateway = Boolean(keySecret && !keySecret.includes('simulated'));
      if (hasLiveGateway) {
        throw new Error(
          'Direct bypass payment is disabled in live environment. Please complete payment through Razorpay / Stripe gateway.'
        );
      }
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

  /**
   * Unified Bank Credit Verification Engine (Method A Email Alerts & Method B Android Notification Listener).
   * Parses incoming bank credit alerts, matches the active Direct UPI checkout session, validates NPCI UTR
   * and anti-replay uniqueness, and automatically captures the session.
   */
  static async ingestBankCreditWebhook(input: {
    appId: string;
    secret: string;
    amount?: number;
    utr?: string;
    note?: string;
    rawText?: string;
    payerVpa?: string;
  }) {
    const { appId, secret, rawText, note } = input;
    if (!appId || !secret) {
      throw new Error('Missing appId or bank listener secret');
    }

    const app = await prisma.oAuthApp.findFirst({
      where: {
        OR: [
          { id: String(appId).trim() },
          { clientId: String(appId).trim() },
        ],
      },
      select: APP_CHECKOUT_SELECT,
    });

    if (!app) {
      throw new Error('Application not found');
    }

    if (!verifyBankListenerSecret(app, secret)) {
      throw new Error('Unauthorized: Invalid bank listener secret');
    }

    let parsed: ParsedBankUpiAlert = { isCredit: true };
    const combinedText = [rawText, note].filter(Boolean).join(' ');
    if (combinedText.trim()) {
      parsed = parseIndianBankUpiAlert(combinedText);
      if (!parsed.isCredit && !input.amount && !input.utr) {
        throw new Error(parsed.rejectionReason || 'Rejected non-credit bank alert');
      }
      if (!parsed.isCredit && (parsed.rejectionReason?.includes('OTP') || parsed.rejectionReason?.includes('debit') || parsed.rejectionReason?.includes('non-success'))) {
        throw new Error(parsed.rejectionReason);
      }
    }

    const effectiveAmount = typeof input.amount === 'number' && input.amount > 0 ? Math.round(input.amount * 100) / 100 : parsed.amount;
    const effectiveUtr = String(input.utr || parsed.utr || '').trim().replace(/\D/g, '');
    const effectiveRef = parsed.sessionRef || (note?.match(/180P_([a-zA-Z0-9]{6,20})/i)?.[1]);
    const effectivePayerVpa = input.payerVpa || parsed.payerVpa;

    if (!effectiveAmount || effectiveAmount <= 0) {
      throw new Error('Could not determine positive INR credit amount from bank alert');
    }

    if (!effectiveUtr || effectiveUtr.length !== 12) {
      throw new Error('Could not extract valid 12-digit NPCI UTR from bank alert');
    }

    const utrValidation = validateNpciUtr(effectiveUtr);
    if (!utrValidation.isValid) {
      throw new Error(utrValidation.reason || 'Invalid NPCI UTR format in bank alert');
    }

    // Match active PENDING or PENDING_VERIFICATION session for this app
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    const candidates = await prisma.checkoutSession.findMany({
      where: {
        appId: app.id,
        status: { in: ['PENDING', 'PENDING_VERIFICATION'] },
        createdAt: { gte: twentyMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let matchedSession: any = null;

    // Priority 1: Exact 180P_<shortRef> match
    if (effectiveRef) {
      const normalizedRef = effectiveRef.toLowerCase();
      matchedSession = candidates.find((s) => s.id.replace(/-/g, '').toLowerCase().startsWith(normalizedRef)) || null;
      if (matchedSession) {
        const sessionInr = (matchedSession.currency || 'INR').toUpperCase() === 'INR'
          ? matchedSession.amount
          : GeoPricingService.convertCurrency(matchedSession.amount, matchedSession.currency || 'USD', 'INR');
        if (Math.abs(sessionInr - effectiveAmount) > 1.0) {
          throw new Error(`Amount mismatch for session ${matchedSession.id}: expected INR ${sessionInr}, received INR ${effectiveAmount}`);
        }
      }
    }

    // Priority 2: Unique active session matching exact INR amount within last 20 minutes
    if (!matchedSession) {
      const amountMatches = candidates.filter((s) => {
        const sessionInr = (s.currency || 'INR').toUpperCase() === 'INR'
          ? s.amount
          : GeoPricingService.convertCurrency(s.amount, s.currency || 'USD', 'INR');
        return Math.abs(sessionInr - effectiveAmount) < 0.05;
      });

      if (amountMatches.length === 0) {
        throw new Error(`No matching active Direct UPI checkout session found for INR ${effectiveAmount}`);
      }
      if (amountMatches.length > 1) {
        throw new Error(`Ambiguous match: ${amountMatches.length} active sessions for INR ${effectiveAmount} without 180P_ reference note`);
      }
      matchedSession = amountMatches[0];
    }

    const captureResult = await this.autoVerifyDirectUpiPayment({
      sessionId: matchedSession.id,
      approvalRefNo: effectiveUtr,
      responseCode: '00',
      status: 'SUCCESS',
      txnRef: matchedSession.id,
      payerVpa: effectivePayerVpa,
      rawPayload: {
        source: 'UPI_BANK_WEBHOOK',
        note,
        rawText,
        parsedAmount: effectiveAmount,
      },
    });

    return {
      success: true,
      matchedSessionId: matchedSession.id,
      utr: effectiveUtr,
      amount: effectiveAmount,
      transactionId: captureResult.transactionId,
      status: captureResult.session?.status || 'CAPTURED',
    };
  }
}


