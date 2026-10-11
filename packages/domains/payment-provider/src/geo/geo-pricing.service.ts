'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';

export interface CountryMeta {
  countryCode: string;
  name: string;
  currency: string;
  symbol: string;
  flag: string;
  pppTier: 1 | 2 | 3;
  baseFxToUsd: number; // units of local currency per 1 USD
}

export const COUNTRY_DIRECTORY: Record<string, CountryMeta> = {
  US: { countryCode: 'US', name: 'United States', currency: 'USD', symbol: '$', flag: '🇺🇸', pppTier: 1, baseFxToUsd: 1.0 },
  GB: { countryCode: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', flag: '🇬🇧', pppTier: 1, baseFxToUsd: 0.78 },
  DE: { countryCode: 'DE', name: 'Germany', currency: 'EUR', symbol: '€', flag: '🇩🇪', pppTier: 1, baseFxToUsd: 0.92 },
  FR: { countryCode: 'FR', name: 'France', currency: 'EUR', symbol: '€', flag: '🇫🇷', pppTier: 1, baseFxToUsd: 0.92 },
  CA: { countryCode: 'CA', name: 'Canada', currency: 'CAD', symbol: 'C$', flag: '🇨🇦', pppTier: 1, baseFxToUsd: 1.39 },
  AU: { countryCode: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$', flag: '🇦🇺', pppTier: 1, baseFxToUsd: 1.54 },
  JP: { countryCode: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥', flag: '🇯🇵', pppTier: 1, baseFxToUsd: 152.0 },
  SG: { countryCode: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$', flag: '🇸🇬', pppTier: 1, baseFxToUsd: 1.34 },
  AE: { countryCode: 'AE', name: 'United Arab Emirates', currency: 'AED', symbol: 'AED', flag: '🇦🇪', pppTier: 1, baseFxToUsd: 3.67 },
  NL: { countryCode: 'NL', name: 'Netherlands', currency: 'EUR', symbol: '€', flag: '🇳🇱', pppTier: 1, baseFxToUsd: 0.92 },
  CH: { countryCode: 'CH', name: 'Switzerland', currency: 'CHF', symbol: 'CHF', flag: '🇨🇭', pppTier: 1, baseFxToUsd: 0.89 },
  SE: { countryCode: 'SE', name: 'Sweden', currency: 'SEK', symbol: 'kr', flag: '🇸🇪', pppTier: 1, baseFxToUsd: 10.6 },
  NO: { countryCode: 'NO', name: 'Norway', currency: 'NOK', symbol: 'kr', flag: '🇳🇴', pppTier: 1, baseFxToUsd: 10.8 },

  // Tier 2: Upper Middle Income (40% regional discount standard)
  BR: { countryCode: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$', flag: '🇧🇷', pppTier: 2, baseFxToUsd: 5.8 },
  MX: { countryCode: 'MX', name: 'Mexico', currency: 'MXN', symbol: 'Mex$', flag: '🇲🇽', pppTier: 2, baseFxToUsd: 19.8 },
  TR: { countryCode: 'TR', name: 'Turkey', currency: 'TRY', symbol: '₺', flag: '🇹🇷', pppTier: 2, baseFxToUsd: 34.5 },
  ZA: { countryCode: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R', flag: '🇿🇦', pppTier: 2, baseFxToUsd: 18.2 },
  TH: { countryCode: 'TH', name: 'Thailand', currency: 'THB', symbol: '฿', flag: '🇹🇭', pppTier: 2, baseFxToUsd: 34.0 },
  MY: { countryCode: 'MY', name: 'Malaysia', currency: 'MYR', symbol: 'RM', flag: '🇲🇾', pppTier: 2, baseFxToUsd: 4.4 },
  PL: { countryCode: 'PL', name: 'Poland', currency: 'PLN', symbol: 'zł', flag: '🇵🇱', pppTier: 2, baseFxToUsd: 4.0 },
  CN: { countryCode: 'CN', name: 'China', currency: 'CNY', symbol: '¥', flag: '🇨🇳', pppTier: 2, baseFxToUsd: 7.24 },
  CL: { countryCode: 'CL', name: 'Chile', currency: 'CLP', symbol: 'CLP$', flag: '🇨🇱', pppTier: 2, baseFxToUsd: 940.0 },
  AR: { countryCode: 'AR', name: 'Argentina', currency: 'ARS', symbol: '$', flag: '🇦🇷', pppTier: 2, baseFxToUsd: 1020.0 },

  // Tier 3: Lower Middle / Emerging (65% regional discount standard)
  IN: { countryCode: 'IN', name: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳', pppTier: 3, baseFxToUsd: 86.5 },
  NP: { countryCode: 'NP', name: 'Nepal', currency: 'NPR', symbol: 'Rs', flag: '🇳🇵', pppTier: 3, baseFxToUsd: 133.6 },
  NG: { countryCode: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦', flag: '🇳🇬', pppTier: 3, baseFxToUsd: 1550.0 },
  ID: { countryCode: 'ID', name: 'Indonesia', currency: 'IDR', symbol: 'Rp', flag: '🇮🇩', pppTier: 3, baseFxToUsd: 15800.0 },
  PK: { countryCode: 'PK', name: 'Pakistan', currency: 'PKR', symbol: '₨', flag: '🇵🇰', pppTier: 3, baseFxToUsd: 278.0 },
  VN: { countryCode: 'VN', name: 'Vietnam', currency: 'VND', symbol: '₫', flag: '🇻🇳', pppTier: 3, baseFxToUsd: 25300.0 },
  EG: { countryCode: 'EG', name: 'Egypt', currency: 'EGP', symbol: 'E£', flag: '🇪🇬', pppTier: 3, baseFxToUsd: 49.0 },
  PH: { countryCode: 'PH', name: 'Philippines', currency: 'PHP', symbol: '₱', flag: '🇵🇭', pppTier: 3, baseFxToUsd: 58.5 },
  BD: { countryCode: 'BD', name: 'Bangladesh', currency: 'BDT', symbol: '৳', flag: '🇧🇩', pppTier: 3, baseFxToUsd: 120.0 },
  KE: { countryCode: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh', flag: '🇰🇪', pppTier: 3, baseFxToUsd: 129.0 },
};

export const PPP_MULTIPLIER_BANDS: Record<1 | 2 | 3, number> = {
  1: 1.0,  // Full price (0% discount)
  2: 0.60, // 40% discount
  3: 0.35, // 65% discount
};

export interface ResolvePricingInput {
  appId: string;
  baseAmount: number;
  baseCurrency?: string;
  visitorCountry?: string;
  planId?: string;
}

export interface LocalizedPricingResult {
  countryCode: string;
  countryName: string;
  flag: string;
  currency: string;
  symbol: string;
  originalAmount: number;
  originalCurrency: string;
  localizedAmount: number;
  formattedPrice: string;
  hasRegionalDiscount: boolean;
  discountPercentage: number;
  isCustomOverride: boolean;
  banner?: {
    flag: string;
    headline: string;
    message: string;
  };
}

export interface SetCountryRuleInput {
  countryCode: string;
  currency?: string;
  overrideType: 'FIXED_PRICE' | 'PERCENTAGE_DISCOUNT';
  discountPct?: number;
  planOverrides?: Record<string, number>;
  isActive?: boolean;
}

export class GeoPricingService {
  /**
   * 1. Resolves visitor country from HTTP request headers.
   * Priority: Cloudflare Edge (cf-ipcountry) > custom proxies > fallback.
   */
  static resolveVisitorCountry(
    headers: Record<string, string | string[] | undefined>,
    fallback: string = 'US'
  ): string {
    const rawCountry =
      headers['cf-ipcountry'] ||
      headers['CF-IPCountry'] ||
      headers['x-country-code'] ||
      headers['X-Country-Code'] ||
      headers['x-vercel-ip-country'] ||
      headers['cloudfront-viewer-country'];

    const val = Array.isArray(rawCountry) ? rawCountry[0] : rawCountry;
    if (val && typeof val === 'string' && val.trim().length === 2 && val !== 'XX' && val !== 'T1') {
      return val.trim().toUpperCase();
    }
    return fallback.toUpperCase();
  }

  /**
   * Helper alias for controller integration
   */
  static resolveCountryFromHeaders(
    headers: Record<string, string | string[] | undefined>,
    fallback: string = 'US'
  ): string {
    return this.resolveVisitorCountry(headers, fallback);
  }

  /**
   * 2. Resolves localized pricing with automatic Purchasing Power Parity or custom rules.
   */
  static async resolveLocalizedPricing(input: ResolvePricingInput): Promise<LocalizedPricingResult> {
    const { appId, baseAmount, baseCurrency = 'USD', planId } = input;
    const countryCode = (input.visitorCountry || 'US').trim().toUpperCase();
    const meta = COUNTRY_DIRECTORY[countryCode] || COUNTRY_DIRECTORY['US'];

    // 1. Check for custom developer override in database
    const rule = await (prisma as any).geoPricingRule.findUnique({
      where: {
        appId_countryCode: {
          appId,
          countryCode,
        },
      },
    });

    // ─── CASE A: Active Developer Custom Rule ───────────────────────────────
    if (rule && rule.isActive) {
      const targetCurrency = rule.currency || meta.currency;
      const targetSymbol = (COUNTRY_DIRECTORY[countryCode]?.symbol) || targetCurrency;

      // Plan-specific fixed price override
      if (planId && rule.planOverrides && typeof rule.planOverrides === 'object') {
        const planPrice = (rule.planOverrides as Record<string, number>)[planId];
        if (planPrice !== undefined && planPrice !== null) {
          const discountPct = baseAmount > 0 ? Math.max(0, Math.round(((baseAmount - planPrice) / baseAmount) * 100)) : 0;
          return {
            countryCode,
            countryName: meta.name,
            flag: meta.flag,
            currency: targetCurrency,
            symbol: targetSymbol,
            originalAmount: baseAmount,
            originalCurrency: baseCurrency,
            localizedAmount: planPrice,
            formattedPrice: `${targetSymbol}${planPrice}`,
            hasRegionalDiscount: discountPct > 0,
            discountPercentage: discountPct,
            isCustomOverride: true,
            banner: discountPct > 0 ? {
              flag: meta.flag,
              headline: `Special Regional Pricing (${meta.name})`,
              message: `A ${discountPct}% regional discount has been applied for visitors in ${meta.name}.`,
            } : undefined,
          };
        }
      }

      // Percentage discount rule
      if (rule.overrideType === 'PERCENTAGE_DISCOUNT' && rule.discountPct && rule.discountPct > 0) {
        const convertedBase = this.convertCurrency(baseAmount, baseCurrency, targetCurrency);
        const discountAmount = (convertedBase * rule.discountPct) / 100;
        const localizedAmount = this.roundToPrettyPrice(Math.max(0, convertedBase - discountAmount), targetCurrency);

        return {
          countryCode,
          countryName: meta.name,
          flag: meta.flag,
          currency: targetCurrency,
          symbol: targetSymbol,
          originalAmount: baseAmount,
          originalCurrency: baseCurrency,
          localizedAmount,
          formattedPrice: `${targetSymbol}${localizedAmount}`,
          hasRegionalDiscount: true,
          discountPercentage: rule.discountPct,
          isCustomOverride: true,
          banner: {
            flag: meta.flag,
            headline: `Regional Offer for ${meta.name}`,
            message: `A ${rule.discountPct}% custom discount is active for your location.`,
          },
        };
      }
    }

    // ─── CASE B: Automated World Bank PPP Tier Resolution ───────────────────
    const tierMultiplier = PPP_MULTIPLIER_BANDS[meta.pppTier] || 1.0;
    const discountPercentage = Math.round((1 - tierMultiplier) * 100);

    const convertedAmount = this.convertCurrency(baseAmount, baseCurrency, meta.currency);
    const rawDiscounted = convertedAmount * tierMultiplier;
    const localizedAmount = this.roundToPrettyPrice(rawDiscounted, meta.currency);

    return {
      countryCode,
      countryName: meta.name,
      flag: meta.flag,
      currency: meta.currency,
      symbol: meta.symbol,
      originalAmount: baseAmount,
      originalCurrency: baseCurrency,
      localizedAmount,
      formattedPrice: `${meta.symbol}${localizedAmount}`,
      hasRegionalDiscount: discountPercentage > 0,
      discountPercentage,
      isCustomOverride: false,
      banner: discountPercentage > 0 ? {
        flag: meta.flag,
        headline: `Purchasing Power Parity Applied (${meta.name})`,
        message: `We detected you are visiting from ${meta.name}. A ${discountPercentage}% regional discount has been automatically applied.`,
      } : undefined,
    };
  }

  /**
   * 3. Currency conversion helper based on USD pivot.
   */
  static convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return amount;

    // Convert from -> USD
    const fromRate = this.getFxToUsd(from);
    const amountInUsd = amount / fromRate;

    // Convert USD -> to
    const toRate = this.getFxToUsd(to);
    return Math.round(amountInUsd * toRate * 100) / 100;
  }

  private static getFxToUsd(currency: string): number {
    for (const key in COUNTRY_DIRECTORY) {
      if (COUNTRY_DIRECTORY[key].currency === currency) {
        return COUNTRY_DIRECTORY[key].baseFxToUsd;
      }
    }
    return 1.0; // Fallback
  }

  /**
   * 4. Rounds localized amounts to standard e-commerce attractive numbers (e.g. 499, 999, 29).
   */
  static roundToPrettyPrice(amount: number, currency: string): number {
    if (amount <= 0) return 0;

    // High nominal value currencies (INR, BRL, JPY, NGN, THB)
    if (currency === 'INR') {
      if (amount < 200) return Math.round(amount / 10) * 10 - 1; // e.g. 99, 149
      return Math.round(amount / 50) * 50 - 1; // e.g. 499, 799, 999
    }
    if (currency === 'BRL') {
      return Math.round(amount) - 1 > 0 ? Math.round(amount) - 1 : Math.round(amount); // e.g. 49, 79
    }
    if (currency === 'JPY' || currency === 'VND' || currency === 'IDR') {
      return Math.round(amount / 100) * 100; // Whole hundreds
    }

    // Standard currencies (USD, EUR, GBP, CAD, AUD)
    if (amount >= 10) {
      return Math.round(amount); // Clean integer e.g. $29, $49
    }
    return Math.round(amount * 100) / 100;
  }

  /**
   * 5. Developer Management: Set Country Rule
   */
  static async setCountryRule(appId: string, data: SetCountryRuleInput | any) {
    const countryCode = (data.countryCode || '').trim().toUpperCase();
    if (!countryCode) {
      throw new Error('countryCode is required');
    }
    const meta = COUNTRY_DIRECTORY[countryCode];
    const currency = data.currency || data.customCurrency || (meta ? meta.currency : 'USD');
    const overrideType =
      data.overrideType ||
      (data.discountPercent !== undefined || data.discountPct !== undefined || data.ruleType === 'PERCENT'
        ? 'PERCENTAGE_DISCOUNT'
        : 'FIXED_PRICE');
    const discountPct =
      data.discountPct !== undefined && data.discountPct !== null
        ? Number(data.discountPct)
        : data.discountPercent !== undefined && data.discountPercent !== null
        ? Math.round(Number(data.discountPercent))
        : null;
    const planOverrides =
      data.planOverrides !== undefined
        ? data.planOverrides
        : data.fixedAmount !== undefined && data.fixedAmount !== null
        ? { default: Number(data.fixedAmount) }
        : null;
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : data.isEnabled !== undefined ? Boolean(data.isEnabled) : true;

    return await (prisma as any).geoPricingRule.upsert({
      where: {
        appId_countryCode: {
          appId,
          countryCode,
        },
      },
      create: {
        appId,
        countryCode,
        currency,
        overrideType,
        discountPct,
        planOverrides,
        isActive,
      },
      update: {
        currency,
        overrideType,
        discountPct,
        planOverrides,
        isActive,
      },
    });
  }

  /**
   * 6. Developer Management: Delete Country Rule (by rule ID or country code)
   */
  static async deleteCountryRule(appId: string, ruleIdOrCode: string) {
    const input = (ruleIdOrCode || '').trim();
    if (input.length === 2) {
      return await (prisma as any).geoPricingRule.deleteMany({
        where: {
          appId,
          countryCode: input.toUpperCase(),
        },
      });
    }
    return await (prisma as any).geoPricingRule.deleteMany({
      where: {
        appId,
        id: input,
      },
    });
  }

  /**
   * 7. Developer Management: List Country Rules
   */
  static async listCountryRules(appId: string) {
    const rules = await (prisma as any).geoPricingRule.findMany({
      where: { appId },
      orderBy: { countryCode: 'asc' },
    });

    return rules.map((r: any) => ({
      ...r,
      customCurrency: r.currency,
      discountPercent: r.discountPct,
      isEnabled: r.isActive,
      fixedAmount:
        r.planOverrides && typeof r.planOverrides === 'object'
          ? (r.planOverrides as any).default ?? (typeof r.planOverrides === 'number' ? r.planOverrides : null)
          : null,
    }));
  }

  /**
   * Helper alias for controller integration
   */
  static async getAppGeoRules(appId: string) {
    return await this.listCountryRules(appId);
  }

  /**
   * 8. Developer Management: Toggle PPP auto-discounting on/off
   */
  static async toggleAppPPP(appId: string, enabled: boolean) {
    const app = await (prisma as any).oAuthApp.findUnique({
      where: { id: appId },
    });
    if (!app) {
      throw new Error('Application not found');
    }
    const currentMeta = (app.metadata as any) || {};
    return await (prisma as any).oAuthApp.update({
      where: { id: appId },
      data: {
        metadata: {
          ...currentMeta,
          enablePPP: enabled,
        },
      },
    });
  }

  /**
   * 8. Developer Preview: Visualizes pricing across key global regions
   */
  static async previewGlobalPricing(appId: string, baseAmount: number, baseCurrency: string = 'USD') {
    const keyCountries = ['US', 'GB', 'DE', 'IN', 'BR', 'JP', 'SG', 'NG', 'AU', 'AE'];
    const previews = await Promise.all(
      keyCountries.map((c) =>
        this.resolveLocalizedPricing({
          appId,
          baseAmount,
          baseCurrency,
          visitorCountry: c,
        })
      )
    );
    return previews;
  }
}
