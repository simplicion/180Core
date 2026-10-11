'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { GeoPricingService } from '../geo/geo-pricing.service';

export interface CouponValidationInput {
  appId: string;
  code: string;
  orderAmount: number;
  orderCurrency?: string;
  customerEmail?: string;
  origin?: string;
  planId?: string;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  discountAmount: number;
  finalAmount: number;
  maxDiscountAmount?: number | null;
  couponId?: string;
  error?: string;
  reasonCode?: string;
}

export interface CreateCouponInput {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  maxRedemptions?: number;
  perCustomerLimit?: number;
  allowedOrigins?: string[];
  validPlans?: string[];
  validFrom?: Date;
  validUntil?: Date;
  isActive?: boolean;
}

export interface UpdateCouponInput {
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number;
  maxRedemptions?: number | null;
  perCustomerLimit?: number;
  allowedOrigins?: string[];
  validPlans?: string[];
  validFrom?: Date;
  validUntil?: Date | null;
  isActive?: boolean;
}

/**
 * Normalizes HTTP origin or hostname (strips protocols, paths, trailing slashes, and ports).
 */
export function normalizeOrigin(origin?: string): string {
  if (!origin) return '';
  const trimmed = origin.trim().toLowerCase();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      return parsed.hostname.toLowerCase();
    }
  } catch {
    // Fallback if URL parsing fails
  }
  return trimmed.split('/')[0].split(':')[0];
}

/**
 * Checks if a request origin matches an allowed origins whitelist.
 * Supports exact matches and wildcard subdomains (e.g. *.ontheirx.com).
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true; // No restrictions specified on coupon
  }
  if (!origin) {
    return false; // Origin header missing when restrictions exist
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  for (const allowed of allowedOrigins) {
    const normAllowed = normalizeOrigin(allowed);
    if (!normAllowed) continue;

    if (normAllowed === '*' || normAllowed === normalized) {
      return true;
    }
    // Wildcard subdomain matching
    if (normAllowed.startsWith('*.')) {
      const baseDomain = normAllowed.slice(2);
      if (normalized === baseDomain || normalized.endsWith('.' + baseDomain)) {
        return true;
      }
    }
  }

  return false;
}

export class CouponService {
  /**
   * 1. 100% Server-Side Coupon Validation
   * Evaluates origin whitelists, limits, expiry dates, and calculates final discounted totals.
   */
  static async validateCoupon(input: CouponValidationInput): Promise<CouponValidationResult> {
    const { appId, orderAmount, customerEmail, origin, planId } = input;
    const rawCode = (input.code || '').trim().toUpperCase();

    if (!rawCode) {
      return {
        valid: false,
        code: '',
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'Coupon code cannot be empty',
        reasonCode: 'COUPON_EMPTY',
      };
    }

    if (orderAmount < 0) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'Invalid order amount',
        reasonCode: 'INVALID_ORDER_AMOUNT',
      };
    }

    // 1. Fetch Coupon record scoped to appId (supporting candidate sibling app IDs)
    const candidateAppIds = await this.getCandidateAppIds(appId);

    let coupon = await (prisma as any).coupon.findFirst({
      where: {
        appId: { in: candidateAppIds },
        code: { equals: rawCode, mode: 'insensitive' },
      },
    });

    if (!coupon) {
      // Fallback: look for active coupon by code matching the app name or global
      coupon = await (prisma as any).coupon.findFirst({
        where: {
          code: { equals: rawCode, mode: 'insensitive' },
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!coupon) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'Invalid coupon code',
        reasonCode: 'COUPON_NOT_FOUND',
      };
    }

    // 2. Active status check
    if (!coupon.isActive) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'This coupon code is no longer active',
        reasonCode: 'COUPON_INACTIVE',
      };
    }

    // 3. Date validity check
    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'This coupon is not active yet',
        reasonCode: 'COUPON_NOT_YET_ACTIVE',
      };
    }

    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'This coupon has expired',
        reasonCode: 'COUPON_EXPIRED',
      };
    }

    // 4. Origin Whitelisting verification (Server-to-Server security)
    if (coupon.allowedOrigins && coupon.allowedOrigins.length > 0) {
      const normOrigin = normalizeOrigin(origin);
      const isGatewayOrigin =
        normOrigin.includes('180workspace.com') ||
        normOrigin.includes('localhost') ||
        normOrigin === '127.0.0.1';
      const originValid = isOriginAllowed(origin, coupon.allowedOrigins) || isGatewayOrigin;
      if (!originValid) {
        return {
          valid: false,
          code: rawCode,
          discountAmount: 0,
          finalAmount: orderAmount,
          error: 'This coupon is not valid on this website domain',
          reasonCode: 'ORIGIN_FORBIDDEN',
        };
      }
    }

    // 5. Plan applicability check (supports direct plan ID, planCode, and sibling plan IDs)
    if (coupon.validPlans && coupon.validPlans.length > 0) {
      let planEligible = Boolean(planId && coupon.validPlans.includes(planId));

      if (!planEligible && planId) {
        const currentPlan = await (prisma as any).subscriptionPlan.findUnique({
          where: { id: planId },
        });

        if (currentPlan) {
          if (coupon.validPlans.includes(currentPlan.planCode)) {
            planEligible = true;
          } else {
            const matchingSiblingPlan = await (prisma as any).subscriptionPlan.findFirst({
              where: {
                id: { in: coupon.validPlans },
                planCode: currentPlan.planCode,
              },
            });
            if (matchingSiblingPlan) {
              planEligible = true;
            }
          }
        }
      }

      if (!planEligible) {
        return {
          valid: false,
          code: rawCode,
          discountAmount: 0,
          finalAmount: orderAmount,
          error: 'This coupon is not applicable to the selected plan',
          reasonCode: 'PLAN_NOT_ELIGIBLE',
        };
      }
    }

    // 6. Minimum order threshold (Evaluated against the REAL monetary amount across currencies)
    const couponBaseCurrency = 'INR';
    const targetOrderCurrency = (input.orderCurrency || 'INR').toUpperCase();
    const minOrderThreshold = coupon.minOrderAmount && coupon.minOrderAmount > 0
      ? GeoPricingService.convertCurrency(coupon.minOrderAmount, couponBaseCurrency, targetOrderCurrency)
      : 0;

    if (minOrderThreshold > 0 && orderAmount < minOrderThreshold) {
      const sym = targetOrderCurrency === 'USD' ? '$' : targetOrderCurrency === 'INR' ? '₹' : `${targetOrderCurrency} `;
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: `Minimum purchase of ${sym}${minOrderThreshold} required for this coupon`,
        reasonCode: 'MIN_ORDER_NOT_MET',
      };
    }

    // 7. Global Redemption Limit check
    if (coupon.maxRedemptions !== null && coupon.redemptionsCount >= coupon.maxRedemptions) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        finalAmount: orderAmount,
        error: 'This coupon has reached its maximum redemption limit',
        reasonCode: 'REDEMPTION_LIMIT_REACHED',
      };
    }

    // 8. Per-Customer Usage Limit check
    const normalizedEmail = (customerEmail || '').trim().toLowerCase();
    if (normalizedEmail) {
      const userRedemptions = await (prisma as any).couponRedemption.count({
        where: {
          couponId: coupon.id,
          customerEmail: normalizedEmail,
        },
      });

      if (userRedemptions >= coupon.perCustomerLimit) {
        return {
          valid: false,
          code: rawCode,
          discountAmount: 0,
          finalAmount: orderAmount,
          error: 'You have already redeemed this coupon the maximum allowed number of times',
          reasonCode: 'CUSTOMER_LIMIT_EXCEEDED',
        };
      }
    }

    // 9. Calculate Discount against real monetary currency
    let calculatedDiscount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      const percentageOff = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
        const maxDiscountInOrderCurrency = GeoPricingService.convertCurrency(
          coupon.maxDiscountAmount,
          couponBaseCurrency,
          targetOrderCurrency
        );
        calculatedDiscount = Math.min(percentageOff, maxDiscountInOrderCurrency);
      } else {
        calculatedDiscount = percentageOff;
      }
    } else {
      // FIXED_AMOUNT (Denominated in coupon base currency, converted to order currency)
      const fixedDiscountInOrderCurrency = GeoPricingService.convertCurrency(
        coupon.discountValue,
        couponBaseCurrency,
        targetOrderCurrency
      );
      calculatedDiscount = Math.min(orderAmount, fixedDiscountInOrderCurrency);
    }

    // Prevent negative final amounts and round to 2 decimal places
    const discountAmount = Math.round(Math.min(calculatedDiscount, orderAmount) * 100) / 100;
    const finalAmount = Math.max(0, Math.round((orderAmount - discountAmount) * 100) / 100);

    return {
      valid: true,
      code: rawCode,
      couponId: coupon.id,
      discountType: coupon.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT',
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount,
      maxDiscountAmount: coupon.maxDiscountAmount
        ? GeoPricingService.convertCurrency(coupon.maxDiscountAmount, couponBaseCurrency, targetOrderCurrency)
        : null,
    };
  }

  /**
   * 2. Atomic Concurrency Redemption Engine
   * Guarantees race-condition safety by atomically checking and incrementing redemptionsCount.
   */
  static async redeemCouponAtomic(input: {
    couponId: string;
    sessionId: string;
    customerEmail: string;
    discountApplied: number;
  }) {
    const { couponId, sessionId, customerEmail, discountApplied } = input;
    const normalizedEmail = customerEmail.trim().toLowerCase();

    return await prisma.$transaction(async (tx: any) => {
      // Atomic conditional update in PostgreSQL:
      // Increments redemptionsCount ONLY IF (maxRedemptions IS NULL OR redemptionsCount < maxRedemptions)
      const affectedRows = await tx.$executeRaw`
        UPDATE "Coupon"
        SET "redemptionsCount" = "redemptionsCount" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${couponId}
          AND "isActive" = true
          AND ("maxRedemptions" IS NULL OR "redemptionsCount" < "maxRedemptions")
      `;

      if (affectedRows === 0) {
        throw new Error('Coupon usage limit was reached concurrently. Discount cannot be applied.');
      }

      // Check per-customer limit within the transaction to prevent multi-tab bypass
      const customerUses = await tx.couponRedemption.count({
        where: {
          couponId,
          customerEmail: normalizedEmail,
        },
      });

      const currentCoupon = await tx.coupon.findUnique({
        where: { id: couponId },
        select: { perCustomerLimit: true },
      });

      if (currentCoupon && customerUses >= currentCoupon.perCustomerLimit) {
        throw new Error('Customer limit exceeded for this coupon.');
      }

      // Record immutable redemption audit record
      const redemption = await tx.couponRedemption.create({
        data: {
          couponId,
          sessionId,
          customerEmail: normalizedEmail,
          discountApplied,
        },
      });

      return redemption;
    });
  }

  /**
   * Resolves all candidate App IDs (primary UUID, client ID, and sibling apps)
   * that belong to the same application / product ecosystem.
   */
  public static async getCandidateAppIds(appId: string): Promise<string[]> {
    const candidateSet = new Set<string>();
    if (appId) {
      candidateSet.add(appId);
    }

    try {
      const app = await (prisma as any).oAuthApp.findFirst({
        where: {
          OR: [
            { id: appId },
            { clientId: appId },
          ],
        },
      });

      if (app) {
        candidateSet.add(app.id);
        candidateSet.add(app.clientId);

        const siblingApps = await (prisma as any).oAuthApp.findMany({
          where: {
            OR: [
              { name: { equals: app.name, mode: 'insensitive' } },
              ...(app.clientId === '180-traffic-director' || app.clientId.includes('180_client_b26aee')
                ? [
                    { clientId: '180-traffic-director' },
                    { clientId: { contains: '180_client_b26aee' } },
                    { id: '7697a348-7550-4229-9595-08ba67aa9755' },
                    { id: 'f037c87a-a294-443f-b15e-6e40c0df6391' },
                  ]
                : []),
              ...(app.clientId === '180-social-studio' || app.clientId.includes('180_client_social')
                ? [
                    { clientId: '180-social-studio' },
                    { clientId: { contains: '180_client_social' } },
                  ]
                : []),
              ...(app.clientId === '180-workspace' || app.clientId.includes('180_client_workspace')
                ? [
                    { clientId: '180-workspace' },
                    { clientId: { contains: '180_client_workspace' } },
                  ]
                : []),
            ],
          },
        });

        for (const sibling of siblingApps) {
          candidateSet.add(sibling.id);
          candidateSet.add(sibling.clientId);
        }
      }
    } catch (_) {}

    return Array.from(candidateSet);
  }

  public static async resolveAppId(appId: string): Promise<string> {
    const oauthApp = await (prisma as any).oAuthApp.findFirst({
      where: {
        OR: [
          { id: appId },
          { clientId: appId },
        ],
      },
      select: { id: true },
    });
    return oauthApp ? oauthApp.id : appId;
  }

  /**
   * 3. Developer Management: Create Coupon
   */
  static async createCoupon(appId: string, data: CreateCouponInput) {
    const targetAppId = await this.resolveAppId(appId);
    const normalizedCode = data.code.trim().toUpperCase();

    if (!normalizedCode) {
      throw new Error('Coupon code is required');
    }

    if (data.discountValue <= 0) {
      throw new Error('Discount value must be greater than zero');
    }

    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }

    const existing = await (prisma as any).coupon.findUnique({
      where: {
        appId_code: {
          appId: targetAppId,
          code: normalizedCode,
        },
      },
    });

    if (existing) {
      throw new Error(`Coupon code "${normalizedCode}" already exists for this application`);
    }

    const createdCoupon = await (prisma as any).coupon.create({
      data: {
        appId: targetAppId,
        code: normalizedCode,
        discountType: data.discountType,
        discountValue: Number(data.discountValue),
        maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
        minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : 0,
        maxRedemptions: data.maxRedemptions ? Number(data.maxRedemptions) : null,
        perCustomerLimit: data.perCustomerLimit ? Number(data.perCustomerLimit) : 1,
        allowedOrigins: (data.allowedOrigins || []).map(normalizeOrigin).filter(Boolean),
        validPlans: data.validPlans || [],
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    // Also synchronize to any sibling OAuth apps with matching name / linked clientIds
    try {
      const currentApp = await (prisma as any).oAuthApp.findUnique({ where: { id: targetAppId } });
      if (currentApp) {
        const siblingApps = await (prisma as any).oAuthApp.findMany({
          where: {
            id: { not: targetAppId },
            OR: [
              { name: { equals: currentApp.name, mode: 'insensitive' } },
              ...(currentApp.clientId === '180-traffic-director' || currentApp.clientId.includes('180_client_b26aee')
                ? [{ clientId: '180-traffic-director' }, { clientId: { contains: '180_client_b26aee' } }]
                : []),
              ...(currentApp.clientId === '180-social-studio' || currentApp.clientId.includes('180_client_social')
                ? [{ clientId: '180-social-studio' }, { clientId: { contains: '180_client_social' } }]
                : []),
            ],
          },
        });

        for (const sibling of siblingApps) {
          await (prisma as any).coupon.upsert({
            where: {
              appId_code: {
                appId: sibling.id,
                code: normalizedCode,
              },
            },
            create: {
              appId: sibling.id,
              code: normalizedCode,
              discountType: data.discountType,
              discountValue: Number(data.discountValue),
              maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
              minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : 0,
              maxRedemptions: data.maxRedemptions ? Number(data.maxRedemptions) : null,
              perCustomerLimit: data.perCustomerLimit ? Number(data.perCustomerLimit) : 1,
              allowedOrigins: (data.allowedOrigins || []).map(normalizeOrigin).filter(Boolean),
              validPlans: data.validPlans || [],
              validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
              validUntil: data.validUntil ? new Date(data.validUntil) : null,
              isActive: data.isActive !== undefined ? data.isActive : true,
            },
            update: {
              discountType: data.discountType,
              discountValue: Number(data.discountValue),
              maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : null,
              minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : 0,
              maxRedemptions: data.maxRedemptions ? Number(data.maxRedemptions) : null,
              perCustomerLimit: data.perCustomerLimit ? Number(data.perCustomerLimit) : 1,
              allowedOrigins: (data.allowedOrigins || []).map(normalizeOrigin).filter(Boolean),
              validPlans: data.validPlans || [],
              validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
              validUntil: data.validUntil ? new Date(data.validUntil) : null,
              isActive: data.isActive !== undefined ? data.isActive : true,
            },
          }).catch(() => {});
        }
      }
    } catch (_) {}

    return createdCoupon;
  }

  /**
   * 4. Developer Management: Update Coupon
   */
  static async updateCoupon(appId: string, couponId: string, data: UpdateCouponInput) {
    const targetAppId = await this.resolveAppId(appId);
    const coupon = await (prisma as any).coupon.findFirst({
      where: { id: couponId, appId: targetAppId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    if (data.discountValue !== undefined && data.discountValue <= 0) {
      throw new Error('Discount value must be greater than zero');
    }

    return await (prisma as any).coupon.update({
      where: { id: couponId },
      data: {
        ...(data.discountType && { discountType: data.discountType }),
        ...(data.discountValue !== undefined && { discountValue: Number(data.discountValue) }),
        ...(data.maxDiscountAmount !== undefined && { maxDiscountAmount: data.maxDiscountAmount }),
        ...(data.minOrderAmount !== undefined && { minOrderAmount: Number(data.minOrderAmount) }),
        ...(data.maxRedemptions !== undefined && { maxRedemptions: data.maxRedemptions }),
        ...(data.perCustomerLimit !== undefined && { perCustomerLimit: Number(data.perCustomerLimit) }),
        ...(data.allowedOrigins && { allowedOrigins: data.allowedOrigins.map(normalizeOrigin).filter(Boolean) }),
        ...(data.validPlans && { validPlans: data.validPlans }),
        ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
        ...(data.validUntil !== undefined && { validUntil: data.validUntil ? new Date(data.validUntil) : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * 5. Developer Management: Delete Coupon
   */
  static async deleteCoupon(appId: string, couponId: string) {
    const targetAppId = await this.resolveAppId(appId);
    const coupon = await (prisma as any).coupon.findFirst({
      where: { id: couponId, appId: targetAppId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    return await (prisma as any).coupon.delete({
      where: { id: couponId },
    });
  }

  /**
   * 6. Developer Management: List Coupons
   */
  static async listCoupons(appId: string, options?: { page?: number; limit?: number }) {
    const targetAppId = await this.resolveAppId(appId);
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      (prisma as any).coupon.findMany({
        where: { appId: targetAppId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).coupon.count({
        where: { appId: targetAppId },
      }),
    ]);

    return {
      coupons,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 7. Developer Management: Get Coupon Redemptions
   */
  static async getCouponRedemptions(appId: string, couponId: string) {
    const targetAppId = await this.resolveAppId(appId);
    const coupon = await (prisma as any).coupon.findFirst({
      where: { id: couponId, appId: targetAppId },
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    return await (prisma as any).couponRedemption.findMany({
      where: { couponId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
