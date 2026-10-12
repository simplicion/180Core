'use strict';

import crypto from 'crypto';
import axios from 'axios';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { WebhookDispatcherService } from '../webhook/webhook-dispatcher.service';
import { GeoPricingService, COUNTRY_DIRECTORY } from '../geo/geo-pricing.service';
import { CheckoutService } from '../checkout/checkout.service';

export interface CreatePaymentLinkInput {
  title: string;
  description?: string;
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
  isActive?: boolean;
}

export interface UpdatePaymentLinkInput {
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  collectPhone?: boolean;
  collectAddress?: boolean;
  allowCoupons?: boolean;
  redirectUrl?: string;
  fulfillmentMessage?: string;
  fulfillmentFileUrl?: string;
  maxPurchases?: number | null;
  metadata?: Record<string, any>;
  isActive?: boolean;
}

export interface RegionalPricingInfo {
  isApplied: boolean;
  countryCode: string;
  countryName: string;
  flag: string;
  currency: string;
  symbol: string;
  originalAmount: number;
  originalCurrency: string;
  discountPercentage?: number;
  banner?: {
    flag: string;
    headline: string;
    message: string;
  };
}

export interface PublicPaymentLinkResult {
  id: string;
  slug: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  collectPhone: boolean;
  collectAddress: boolean;
  allowCoupons: boolean;
  allowCustomAmount?: boolean;
  metadata?: Record<string, any>;
  isAvailable: boolean;
  isSoldOut: boolean;
  regionalPricing?: RegionalPricingInfo;
  merchant: {
    name: string;
    logoUrl?: string;
    clientId: string;
  };
}

export interface FulfillmentResult {
  success: boolean;
  fulfillmentMessage?: string;
  fulfillmentFileUrl?: string;
  redirectUrl?: string;
}

export class PaymentLinkService {
  /**
   * Helper to generate clean, URL-safe random slugs.
   */
  static generateRandomSlug(title?: string): string {
    const randomHex = crypto.randomBytes(4).toString('hex');
    if (!title) {
      return `pl_${randomHex}`;
    }
    const cleanTitle = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    return cleanTitle ? `${cleanTitle}-${randomHex}` : `pl_${randomHex}`;
  }

  /**
   * 1. Creates a shareable Payment Link.
   */
  static async createPaymentLink(appId: string, data: CreatePaymentLinkInput) {
    if (!data.title || !data.title.trim()) {
      throw new Error('Payment link title is required');
    }
    const isCustomAmount = Boolean(data.metadata?.allowCustomAmount) || Number(data.amount) === 0;
    if (!isCustomAmount && (data.amount === undefined || Number(data.amount) < 0)) {
      throw new Error('Payment amount must be greater than or equal to zero');
    }

    let slug = data.customSlug
      ? data.customSlug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '')
      : this.generateRandomSlug(data.title);

    // Verify slug uniqueness, retry with random entropy if collision occurs
    let attempts = 0;
    while (attempts < 5) {
      const existing = await (prisma as any).paymentLink.findUnique({
        where: { slug },
      });
      if (!existing) break;
      slug = this.generateRandomSlug(data.title);
      attempts++;
    }

    return await (prisma as any).paymentLink.create({
      data: {
        appId,
        slug,
        title: data.title.trim(),
        description: data.description || '',
        amount: Number(data.amount),
        currency: (data.currency || 'INR').toUpperCase(),
        collectPhone: data.collectPhone !== undefined ? data.collectPhone : true,
        collectAddress: data.collectAddress !== undefined ? data.collectAddress : false,
        allowCoupons: data.allowCoupons !== undefined ? data.allowCoupons : true,
        redirectUrl: data.redirectUrl || '',
        fulfillmentMessage: data.fulfillmentMessage || '',
        fulfillmentFileUrl: data.fulfillmentFileUrl || '',
        maxPurchases: data.maxPurchases ? Number(data.maxPurchases) : null,
        metadata: data.metadata || {},
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  /**
   * 2. Resolves a Payment Link for public checkout page rendering.
   * Conceals private fulfillment secrets until payment is verified.
   * Dynamically applies regional multi-pricing rules & PPP discounts.
   */
  static async getPublicPaymentLink(slug: string, visitorCountry?: string): Promise<PublicPaymentLinkResult> {
    const cleanSlug = (slug || '').trim().toLowerCase();

    // Gracefully handle preview demonstration link
    if (cleanSlug === 'preview-link') {
      return {
        id: 'preview',
        slug: 'preview-link',
        title: 'Sample Product (Checkout Preview)',
        description: 'This is a live preview of how your payment link and checkout page look to your customers.',
        amount: 500,
        currency: 'INR',
        collectPhone: true,
        collectAddress: false,
        allowCoupons: true,
        allowCustomAmount: false,
        isAvailable: true,
        isSoldOut: false,
        merchant: {
          name: '180 Workspace Merchant',
          logoUrl: '',
          clientId: 'preview',
        },
      };
    }

    const link = await (prisma as any).paymentLink.findUnique({
      where: { slug: cleanSlug },
      include: {
        app: {
          select: {
            name: true,
            logoUrl: true,
            clientId: true,
            allowedOrigins: true,
          },
        },
      },
    });

    if (!link) {
      throw new Error('Payment link not found');
    }

    const isSoldOut = link.maxPurchases !== null && link.purchasesCount >= link.maxPurchases;
    const isAvailable = Boolean(link.isActive && !isSoldOut);

    let finalAmount = link.amount;
    let finalCurrency = link.currency;
    let regionalPricing: RegionalPricingInfo | undefined;

    const multiPricing = (link.metadata as any)?.multiPricing;
    const country = (visitorCountry || '').trim().toUpperCase();

    if (multiPricing && multiPricing.enabled && country) {
      const rules = Array.isArray(multiPricing.rules) ? multiPricing.rules : [];
      const matchedRule = rules.find((r: any) => (r.countryCode || '').toUpperCase() === country);
      const meta = COUNTRY_DIRECTORY[country] || {
        name: country,
        currency: matchedRule?.currency || 'USD',
        symbol: '$',
        flag: '🌐',
      };

      if (matchedRule && matchedRule.amount > 0) {
        finalAmount = Number(matchedRule.amount);
        finalCurrency = (matchedRule.currency || meta.currency || 'USD').toUpperCase();
        const discountPct =
          matchedRule.discountPct !== undefined && matchedRule.discountPct !== null
            ? matchedRule.discountPct
            : link.amount > 0
            ? Math.max(0, Math.round(((link.amount - finalAmount) / link.amount) * 100))
            : 0;

        regionalPricing = {
          isApplied: true,
          countryCode: country,
          countryName: meta.name || country,
          flag: meta.flag || '🌐',
          currency: finalCurrency,
          symbol: matchedRule.symbol || meta.symbol || finalCurrency,
          originalAmount: link.amount,
          originalCurrency: link.currency,
          discountPercentage: discountPct > 0 ? discountPct : undefined,
          banner: {
            flag: meta.flag || '🌐',
            headline: `Special Regional Pricing (${meta.name || country})`,
            message: `Localized price applied for visitors in ${meta.name || country}.`,
          },
        };
      } else if (multiPricing.mode === 'HYBRID' || multiPricing.mode === 'PPP_FALLBACK') {
        try {
          const ppp = await GeoPricingService.resolveLocalizedPricing({
            appId: link.appId,
            baseAmount: link.amount,
            baseCurrency: link.currency,
            visitorCountry: country,
          });
          if (ppp && ppp.hasRegionalDiscount) {
            finalAmount = ppp.localizedAmount;
            finalCurrency = ppp.currency;
            regionalPricing = {
              isApplied: true,
              countryCode: ppp.countryCode,
              countryName: ppp.countryName,
              flag: ppp.flag,
              currency: ppp.currency,
              symbol: ppp.symbol,
              originalAmount: ppp.originalAmount,
              originalCurrency: ppp.originalCurrency,
              discountPercentage: ppp.discountPercentage,
              banner: ppp.banner,
            };
          }
        } catch {
          // Non-blocking fallback to standard base price
        }
      }
    }

    return {
      id: link.id,
      slug: link.slug,
      title: link.title,
      description: link.description || '',
      amount: finalAmount,
      currency: finalCurrency,
      collectPhone: link.collectPhone,
      collectAddress: link.collectAddress,
      allowCoupons: link.allowCoupons,
      allowCustomAmount: Number(link.amount) === 0 || Boolean((link.metadata as any)?.allowCustomAmount),
      metadata: link.metadata,
      isAvailable,
      isSoldOut,
      regionalPricing,
      merchant: {
        name: link.app?.name || '180 Workspace Merchant',
        logoUrl: link.app?.logoUrl || '',
        clientId: link.app?.clientId || '',
      },
    };
  }

  /**
   * 3. Completes payment on a link, atomically increments counter, and reveals fulfillment assets.
   */
  static async completeLinkPurchase(linkId: string, sessionId: string): Promise<FulfillmentResult> {
    const result = await prisma.$transaction(async (tx: any) => {
      // Atomic increment with conditional capacity check
      const affectedRows = await tx.$executeRaw`
        UPDATE "PaymentLink"
        SET "purchasesCount" = "purchasesCount" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${linkId}
          AND "isActive" = true
          AND ("maxPurchases" IS NULL OR "purchasesCount" < "maxPurchases")
      `;

      if (affectedRows === 0) {
        throw new Error('Item reached purchase capacity concurrently or link is inactive');
      }

      const link = await tx.paymentLink.findUnique({
        where: { id: linkId },
        select: {
          appId: true,
          slug: true,
          title: true,
          amount: true,
          currency: true,
          fulfillmentMessage: true,
          fulfillmentFileUrl: true,
          redirectUrl: true,
        },
      });

      return {
        success: true,
        appId: link?.appId,
        slug: link?.slug,
        title: link?.title,
        amount: link?.amount,
        currency: link?.currency,
        fulfillmentMessage: link?.fulfillmentMessage || undefined,
        fulfillmentFileUrl: link?.fulfillmentFileUrl || undefined,
        redirectUrl: link?.redirectUrl || undefined,
      };
    });

    // Asynchronously dispatch webhook event
    if (result.appId) {
      WebhookDispatcherService.dispatchEvent(result.appId, {
        event: 'payment_link.completed',
        data: {
          linkId,
          slug: result.slug,
          title: result.title,
          amount: result.amount,
          currency: result.currency,
          sessionId,
        },
      }).catch((err) => console.warn('[PaymentLinkService] Webhook dispatch error:', err.message));
    }

    return {
      success: true,
      fulfillmentMessage: result.fulfillmentMessage,
      fulfillmentFileUrl: result.fulfillmentFileUrl,
      redirectUrl: result.redirectUrl,
    };
  }

  /**
   * 4. Developer Management: Update Payment Link
   */
  static async updatePaymentLink(appId: string, linkId: string, data: UpdatePaymentLinkInput) {
    const link = await (prisma as any).paymentLink.findFirst({
      where: { id: linkId, appId },
    });

    if (!link) {
      throw new Error('Payment link not found');
    }

    const isCustomAmount = Boolean(data.metadata?.allowCustomAmount) || (data.amount !== undefined && Number(data.amount) === 0);
    if (!isCustomAmount && data.amount !== undefined && Number(data.amount) < 0) {
      throw new Error('Payment amount must be greater than or equal to zero');
    }

    return await (prisma as any).paymentLink.update({
      where: { id: linkId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.currency !== undefined && { currency: data.currency.toUpperCase() }),
        ...(data.collectPhone !== undefined && { collectPhone: data.collectPhone }),
        ...(data.collectAddress !== undefined && { collectAddress: data.collectAddress }),
        ...(data.allowCoupons !== undefined && { allowCoupons: data.allowCoupons }),
        ...(data.redirectUrl !== undefined && { redirectUrl: data.redirectUrl }),
        ...(data.fulfillmentMessage !== undefined && { fulfillmentMessage: data.fulfillmentMessage }),
        ...(data.fulfillmentFileUrl !== undefined && { fulfillmentFileUrl: data.fulfillmentFileUrl }),
        ...(data.maxPurchases !== undefined && { maxPurchases: data.maxPurchases }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * 5. Developer Management: Delete Payment Link
   */
  static async deletePaymentLink(appId: string, linkId: string) {
    const link = await (prisma as any).paymentLink.findFirst({
      where: { id: linkId, appId },
    });

    if (!link) {
      throw new Error('Payment link not found');
    }

    return await (prisma as any).paymentLink.delete({
      where: { id: linkId },
    });
  }

  /**
   * 6. Developer Management: List Payment Links
   */
  static async listPaymentLinks(appId: string, options?: { page?: number; limit?: number }) {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const skip = (page - 1) * limit;

    const [links, total] = await Promise.all([
      (prisma as any).paymentLink.findMany({
        where: { appId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).paymentLink.count({
        where: { appId },
      }),
    ]);

    return {
      links,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 7. Developer Management: Fetch single link by ID
   */
  static async getPaymentLinkById(appId: string, linkId: string) {
    const link = await (prisma as any).paymentLink.findFirst({
      where: { id: linkId, appId },
    });

    if (!link) {
      throw new Error('Payment link not found');
    }

    return link;
  }

  /**
   * 8. Post-purchase delivery helper: Validates session status before revealing fulfillment assets
   */
  static async getFulfillmentData(linkId: string, sessionId: string): Promise<FulfillmentResult> {
    const session = await (prisma as any).checkoutSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== 'CAPTURED') {
      throw new Error('Valid completed purchase session required to access digital fulfillment');
    }

    return await this.completeLinkPurchase(linkId, sessionId);
  }

  /**
   * 9. Generates dynamic live Gateway QR code (Razorpay/Stripe) for counter standees & mobile payments.
   */
  static async generateGatewayQrCode(
    appId: string,
    options: {
      amount: number;
      currency?: string;
      title?: string;
      payeeName?: string;
      linkId?: string;
    }
  ) {
    let app = await (prisma as any).oAuthApp.findUnique({
      where: { id: appId },
    });

    if (!app) {
      // Check if appId was passed as a clientId
      app = await (prisma as any).oAuthApp.findFirst({
        where: { clientId: appId },
      });
    }

    if (!app) {
      // Graceful fallback to default platform merchant for live/simulated gateway credentials
      app = { id: appId, name: options.payeeName || '180 Pay Merchant' };
    }

    let link: any = null;
    if (options.linkId) {
      link = await (prisma as any).paymentLink.findFirst({
        where: { id: options.linkId, appId },
      });
    }

    const { gatewayType, keyId, keySecret } = CheckoutService.resolveGatewayConfig(app);
    const currency = (options.currency || link?.currency || 'INR').toUpperCase();
    const amount = Number(options.amount || link?.amount || 100);
    const payeeName = options.payeeName || link?.title || app.name || '180 Pay Merchant';
    const description = options.title || link?.description || `Payment to ${app.name}`;
    const amountPaise = Math.round(amount * 100);

    // 1. Live or Connected Razorpay Gateway
    if (gatewayType === 'RAZORPAY') {
      const isSimulated =
        !keyId ||
        !keySecret ||
        keyId.includes('simulated') ||
        keyId.includes('mock_') ||
        keySecret.includes('simulated');

      if (!isSimulated) {
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        // Tier 1: Try Razorpay native UPI QR code API (POST /v1/payments/qr_codes)
        try {
          const qrRes = await axios.post(
            'https://api.razorpay.com/v1/payments/qr_codes',
            {
              type: 'upi_qr',
              name: payeeName.slice(0, 40),
              usage: 'single_payment',
              fixed_amount: true,
              payment_amount: amountPaise,
              description: description.slice(0, 30),
              notes: {
                appId,
                linkId: options.linkId || '',
                source: '180_GATEWAY_DYNAMIC_QR',
              },
            },
            {
              headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
              timeout: 6000,
            }
          );

          if (qrRes.data && (qrRes.data.payload || qrRes.data.image_url)) {
            return {
              qrType: 'RAZORPAY_DYNAMIC_UPI',
              qrPayload: qrRes.data.payload || qrRes.data.image_url,
              qrImageUrl: qrRes.data.image_url,
              qrId: qrRes.data.id,
              gateway: 'RAZORPAY',
              amount,
              currency,
              payeeName,
              linkSlug: link?.slug || null,
              isDirectUpi: true,
              mode: 'DYNAMIC_UPI',
            };
          }
        } catch (qrErr: any) {
          // If native QR codes not enabled on this merchant account, fallback gracefully to Tier 2
        }

        // Tier 2: Razorpay Payment Link with dynamic UPI enabled (POST /v1/payment_links)
        try {
          const plinkRes = await axios.post(
            'https://api.razorpay.com/v1/payment_links',
            {
              amount: amountPaise,
              currency,
              description: description.slice(0, 255),
              upi_link: true,
              notify: { sms: false, email: false, whatsapp: false },
              reminder_enable: false,
              notes: {
                appId,
                linkId: options.linkId || '',
                source: '180_GATEWAY_DYNAMIC_QR',
              },
            },
            {
              headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
              timeout: 6000,
            }
          );

          if (plinkRes.data && plinkRes.data.short_url) {
            return {
              qrType: 'RAZORPAY_PAYMENT_LINK',
              qrPayload: plinkRes.data.short_url,
              qrId: plinkRes.data.id,
              gateway: 'RAZORPAY',
              amount,
              currency,
              payeeName,
              linkSlug: link?.slug || null,
              isDirectUpi: false,
              mode: 'GATEWAY_LINK',
            };
          }
        } catch (plinkErr: any) {
          console.warn('[PaymentLinkService] Razorpay payment link error:', plinkErr?.message);
        }
      }

      // Tier 3: Simulated Razorpay UPI Payload for local / mock mode
      const simVpa = 'rzp.simulated@hdfcbank';
      const cleanName = encodeURIComponent(payeeName);
      const cleanNote = encodeURIComponent(description);
      const simUpi = `upi://pay?pa=${simVpa}&pn=${cleanName}&am=${amount.toFixed(2)}&cu=${currency}&tn=${cleanNote}`;

      return {
        qrType: 'RAZORPAY_SIMULATED',
        qrPayload: simUpi,
        gateway: 'RAZORPAY',
        amount,
        currency,
        payeeName,
        linkSlug: link?.slug || null,
        isDirectUpi: true,
        simulated: true,
        mode: 'SIMULATED',
      };
    }

    // Default / Stripe: Universal Web Checkout URL
    const publicBase = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_PUBLIC_BASE || 'https://profile.180workspace.com';
    const webUrl = link ? `${publicBase}/link/${link.slug}` : `${publicBase}/pay/${appId}`;
    return {
      qrType: 'UNIVERSAL_WEB_LINK',
      qrPayload: webUrl,
      gateway: gatewayType,
      amount,
      currency,
      payeeName,
      linkSlug: link?.slug || null,
      isDirectUpi: false,
      mode: 'WEB_LINK',
    };
  }
}

