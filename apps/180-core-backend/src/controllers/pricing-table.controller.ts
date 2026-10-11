'use strict';

import { Request, Response } from 'express';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { COUNTRY_DIRECTORY } from '@workspace/payment-provider';

function applyMultiPricingToPlanCards(planCards: any[], visitorCountry?: string) {
  if (!visitorCountry || !Array.isArray(planCards)) return planCards;
  const country = visitorCountry.trim().toUpperCase();
  const meta = (COUNTRY_DIRECTORY as any)[country] || {
    name: country,
    currency: 'USD',
    symbol: '$',
    flag: '🌐',
  };

  return planCards.map((card) => {
    if (card.isFree || !card.amount) return card;
    const mp = card.multiPricing;
    if (!mp || !mp.enabled) return card;

    const rules = Array.isArray(mp.rules) ? mp.rules : [];
    const matchedRule = rules.find((r: any) => (r.countryCode || '').toUpperCase() === country);

    if (matchedRule && matchedRule.amount > 0) {
      const discountPct =
        matchedRule.discountPct !== undefined && matchedRule.discountPct !== null
          ? matchedRule.discountPct
          : card.amount > 0
          ? Math.max(0, Math.round(((card.amount - matchedRule.amount) / card.amount) * 100))
          : 0;

      return {
        ...card,
        originalAmount: card.amount,
        originalCurrency: card.currency,
        amount: Number(matchedRule.amount),
        currency: (matchedRule.currency || meta.currency || 'USD').toUpperCase(),
        regionalPricing: {
          isApplied: true,
          countryCode: country,
          countryName: meta.name || country,
          flag: meta.flag || '🌐',
          currency: (matchedRule.currency || meta.currency || 'USD').toUpperCase(),
          symbol: matchedRule.symbol || meta.symbol || '$',
          originalAmount: card.amount,
          originalCurrency: card.currency,
          discountPercentage: discountPct > 0 ? discountPct : undefined,
          banner: {
            flag: meta.flag || '🌐',
            headline: `Special Regional Pricing (${meta.name || country})`,
            message: `Localized price applied for members in ${meta.name || country}.`,
          },
        },
      };
    }

    // Hybrid or PPP Fallback
    if ((mp.mode === 'HYBRID' || mp.mode === 'PPP_FALLBACK') && meta.pppDiscountPct && meta.pppDiscountPct > 0) {
      const discount = meta.pppDiscountPct;
      const discountedAmount = Math.max(1, Math.round(card.amount * (1 - discount / 100)));
      return {
        ...card,
        originalAmount: card.amount,
        originalCurrency: card.currency,
        amount: discountedAmount,
        currency: card.currency,
        regionalPricing: {
          isApplied: true,
          countryCode: country,
          countryName: meta.name || country,
          flag: meta.flag || '🌐',
          currency: card.currency,
          symbol: meta.symbol || '$',
          originalAmount: card.amount,
          originalCurrency: card.currency,
          discountPercentage: discount,
          banner: {
            flag: meta.flag || '🌐',
            headline: `Purchasing Power Parity Discount (${discount}% Off)`,
            message: `We've automatically applied a regional discount for visitors from ${meta.name || country}.`,
          },
        },
      };
    }

    return card;
  });
}

export class PricingTableApiController {
  /**
   * GET /api/v1/pricing-tables/:appId
   * Public / SDK endpoint to retrieve the visual pricing table configuration.
   * Auto-generates fallback plan cards from SubscriptionPlan records if not customized.
   */
  static async getPricingTableConfig(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);

      // Verify app exists
      const app = await prisma.oAuthApp.findFirst({
        where: {
          OR: [{ id: appId }, { clientId: appId }],
        },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          clientId: true,
          description: true,
          allowedOrigins: true,
          redirectUris: true,
        },
      });

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      // Query active subscription plans registered for this app
      const dbPlans = await (prisma as any).subscriptionPlan.findMany({
        where: { appId: app.id, isActive: true },
        orderBy: { amount: 'asc' },
      });

      const availablePlans = dbPlans.map((p: any) => ({
        id: p.id,
        planCode: p.planCode,
        name: p.name,
        description: p.description || '',
        amount: p.amount,
        currency: p.currency || 'USD',
        interval: p.interval || 'MONTHLY',
        trialDays: p.trialDays || 0,
        metadata: p.metadata || {},
      }));

      // Check for custom config
      const existingConfig = await (prisma as any).pricingTableConfig.findUnique({
        where: { appId: app.id },
      });

      const visitorCountry = String(
        req.query.country || req.headers['cf-ipcountry'] || req.headers['x-country-code'] || ''
      ).trim().toUpperCase();

      if (existingConfig) {
        const localizedCards = applyMultiPricingToPlanCards(
          existingConfig.planCards || [],
          visitorCountry
        );
        return res.status(200).json({
          success: true,
          config: {
            ...existingConfig,
            planCards: localizedCards,
            appName: app.name,
            appLogo: app.logoUrl,
            clientId: app.clientId,
            appDescription: app.description || '',
            allowedOrigins: app.allowedOrigins || [],
            redirectUris: app.redirectUris || [],
          },
          availablePlans,
        });
      }

      // If no custom config exists yet, populate plan cards strictly from actual DB plans
      let planCards: any[] = [];
      if (dbPlans && dbPlans.length > 0) {
        planCards = dbPlans.map((p: any, idx: number) => {
          const meta = p.metadata || {};
          const rawFeatures = Array.isArray(meta.features)
            ? meta.features
            : typeof meta.features === 'string'
            ? [meta.features]
            : [];
          return {
            planCode: p.planCode,
            name: p.name,
            description: p.description || '',
            amount: p.amount,
            currency: p.currency || 'USD',
            interval: p.interval || 'MONTHLY',
            trialDays: p.trialDays || 0,
            isPopular: Boolean(meta.isPopular ?? (idx === 1 || dbPlans.length === 1)),
            badgeText: meta.badgeText || (meta.isPopular ? 'Popular' : ''),
            badgeColor: meta.badgeColor || 'indigo',
            features: rawFeatures,
            buttonText: meta.buttonText || 'Get Started',
            buttonUrl: meta.buttonUrl || '',
            multiPricing: meta.multiPricing,
          };
        });
        planCards = applyMultiPricingToPlanCards(planCards, visitorCountry);
      } else {
        // Completely clean slate: zero hardcoded fake plans!
        planCards = [];
      }

      const defaultConfig = {
        appId: app.id,
        appName: app.name,
        appLogo: app.logoUrl,
        clientId: app.clientId,
        appDescription: app.description || '',
        headline: app.name ? `${app.name} Plans & Pricing` : 'Plans & Pricing',
        subheadline: app.description || 'Choose the plan that fits your growth',
        theme: 'auto',
        accentColor: '#6366f1',
        billingIntervals: ['MONTHLY', 'YEARLY'],
        yearlyDiscountPct: 20,
        planCards,
        customCss: '',
      };

      return res.status(200).json({
        success: true,
        config: defaultConfig,
        availablePlans,
      });
    } catch (err: any) {
      console.error('[PricingTableApiController:getPricingTableConfig] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * PUT /api/v1/pricing-tables/:appId
   * Developer endpoint to save / customize the pricing table.
   */
  static async updatePricingTableConfig(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const {
        headline,
        subheadline,
        theme,
        accentColor,
        billingIntervals,
        yearlyDiscountPct,
        planCards,
        customCss,
        syncToSubscriptionPlans = true,
      } = req.body;

      const app = await prisma.oAuthApp.findFirst({
        where: {
          OR: [{ id: appId }, { clientId: appId }],
        },
      });

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      const updated = await (prisma as any).pricingTableConfig.upsert({
        where: { appId: app.id },
        create: {
          appId: app.id,
          headline: headline || `${app.name} Plans & Pricing`,
          subheadline: subheadline !== undefined ? subheadline : 'Choose the plan that fits your growth',
          theme: theme || 'auto',
          accentColor: accentColor || '#6366f1',
          billingIntervals: Array.isArray(billingIntervals) ? billingIntervals : ['MONTHLY', 'YEARLY'],
          yearlyDiscountPct: yearlyDiscountPct !== undefined ? Number(yearlyDiscountPct) : 20,
          planCards: Array.isArray(planCards) ? planCards : [],
          customCss: customCss || '',
        },
        update: {
          headline: headline !== undefined ? headline : undefined,
          subheadline: subheadline !== undefined ? subheadline : undefined,
          theme: theme !== undefined ? theme : undefined,
          accentColor: accentColor !== undefined ? accentColor : undefined,
          billingIntervals: Array.isArray(billingIntervals) ? billingIntervals : undefined,
          yearlyDiscountPct: yearlyDiscountPct !== undefined ? Number(yearlyDiscountPct) : undefined,
          planCards: Array.isArray(planCards) ? planCards : undefined,
          customCss: customCss !== undefined ? customCss : undefined,
        },
      });

      // Synchronize planCards to SubscriptionPlan database table
      if (syncToSubscriptionPlans && Array.isArray(planCards)) {
        for (const card of planCards) {
          if (!card.planCode || !card.name) continue;
          const cleanCode = String(card.planCode).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_');
          try {
            await (prisma as any).subscriptionPlan.upsert({
              where: {
                appId_planCode: {
                  appId: app.id,
                  planCode: cleanCode,
                },
              },
              update: {
                name: String(card.name).trim(),
                description: card.description?.trim() || '',
                amount: Math.round(Number(card.amount || 0) * 100) / 100,
                currency: String(card.currency || 'USD').toUpperCase(),
                interval: card.interval || 'MONTHLY',
                trialDays: Number(card.trialDays) || 0,
                isActive: true,
                metadata: {
                  features: Array.isArray(card.features) ? card.features : [],
                  featureKeys: Array.isArray(card.featureKeys) ? card.featureKeys : [],
                  isPopular: Boolean(card.isPopular),
                  badgeText: card.badgeText || '',
                  badgeColor: card.badgeColor || 'indigo',
                  buttonText: card.buttonText || 'Get Started',
                  buttonUrl: card.buttonUrl || '',
                  trialDays: Number(card.trialDays) || 0,
                  yearlyAmount: card.yearlyAmount ? Number(card.yearlyAmount) : undefined,
                },
              },
              create: {
                appId: app.id,
                planCode: cleanCode,
                name: String(card.name).trim(),
                description: card.description?.trim() || '',
                amount: Math.round(Number(card.amount || 0) * 100) / 100,
                currency: String(card.currency || 'USD').toUpperCase(),
                interval: card.interval || 'MONTHLY',
                trialDays: Number(card.trialDays) || 0,
                isActive: true,
                metadata: {
                  features: Array.isArray(card.features) ? card.features : [],
                  featureKeys: Array.isArray(card.featureKeys) ? card.featureKeys : [],
                  isPopular: Boolean(card.isPopular),
                  badgeText: card.badgeText || '',
                  badgeColor: card.badgeColor || 'indigo',
                  buttonText: card.buttonText || 'Get Started',
                  buttonUrl: card.buttonUrl || '',
                  trialDays: Number(card.trialDays) || 0,
                  yearlyAmount: card.yearlyAmount ? Number(card.yearlyAmount) : undefined,
                },
              },
            });
          } catch (syncErr: any) {
            console.warn('[PricingTableApiController] SubscriptionPlan sync notice:', syncErr.message);
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: updated,
        config: {
          ...updated,
          appName: app.name,
          appLogo: app.logoUrl,
          clientId: app.clientId,
          appDescription: app.description || '',
          allowedOrigins: app.allowedOrigins || [],
        },
      });
    } catch (err: any) {
      console.error('[PricingTableApiController:updatePricingTableConfig] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/pricing-tables/:appId/plans
   * List all registered active SubscriptionPlan records for this app.
   */
  static async listAppSubscriptionPlans(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const app = await prisma.oAuthApp.findFirst({
        where: {
          OR: [{ id: appId }, { clientId: appId }],
        },
      });

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      const plans = await (prisma as any).subscriptionPlan.findMany({
        where: { appId: app.id, isActive: true },
        orderBy: { amount: 'asc' },
      });

      return res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (err: any) {
      console.error('[PricingTableApiController:listAppSubscriptionPlans] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/pricing-tables/:appId/headless (or /public)
   * Headless JSON API for real-world developers to fetch pricing tiers directly
   * into their own frontend/backend with custom CSS and domain whitelisting.
   */
  static async getHeadlessPricing(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const origin = req.headers.origin || '';

      const app = await prisma.oAuthApp.findFirst({
        where: {
          OR: [{ id: appId }, { clientId: appId }],
        },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          clientId: true,
          description: true,
          allowedOrigins: true,
        },
      });

      if (!app) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      // Origin Whitelist Verification (CORS)
      const allowedOrigins = app.allowedOrigins || [];
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const isWhitelisted =
        !origin ||
        isLocalhost ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        origin.endsWith('180workspace.com');

      if (!isWhitelisted && allowedOrigins.length > 0) {
        return res.status(403).json({
          success: false,
          error: `Origin "${origin}" is not authorized. Please add it to "Allowed Origins" in your 180 Developer Console project settings.`,
          whitelistedOrigins: allowedOrigins,
        });
      }

      // Set CORS Headers
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-client-id, Authorization');

      const config = await (prisma as any).pricingTableConfig.findUnique({
        where: { appId: app.id },
      });

      const dbPlans = await (prisma as any).subscriptionPlan.findMany({
        where: { appId: app.id, isActive: true },
        orderBy: { amount: 'asc' },
      });

      const profileBase =
        process.env.PROFILE_FRONTEND_URL ||
        process.env.NEXT_PUBLIC_PROFILE_URL ||
        'https://profile.180workspace.com';

      // Assemble mapped tiers
      let rawCards: any[] = [];
      if (config && Array.isArray(config.planCards) && config.planCards.length > 0) {
        rawCards = config.planCards;
      } else if (dbPlans.length > 0) {
        rawCards = dbPlans.map((p: any) => ({
          planCode: p.planCode,
          name: p.name,
          description: p.description || '',
          amount: p.amount,
          currency: p.currency || 'USD',
          interval: p.interval || 'MONTHLY',
          trialDays: p.trialDays || 0,
          featureKeys: p.metadata?.featureKeys || [],
          features: p.metadata?.features || [],
          isPopular: p.metadata?.isPopular || false,
          multiPricing: p.metadata?.multiPricing,
        }));
      }

      const visitorCountry = String(
        req.query.country || req.headers['cf-ipcountry'] || req.headers['x-country-code'] || ''
      ).trim().toUpperCase();
      rawCards = applyMultiPricingToPlanCards(rawCards, visitorCountry);

      const yearlyDiscount = config?.yearlyDiscountPct ?? 20;

      const mappedPlans = rawCards.map((card: any) => {
        const rawAmount = Number(card.amount) || 0;
        const yearlyAmount = card.yearlyAmount
          ? Number(card.yearlyAmount)
          : Math.round(rawAmount * 12 * (1 - yearlyDiscount / 100));

        // Normalize features
        const features = (card.features || []).map((f: any) => {
          if (typeof f === 'object' && f !== null) {
            return {
              text: f.text,
              included: f.included !== false,
              note: f.note || null,
            };
          }
          return {
            text: String(f),
            included: true,
            note: null,
          };
        });

        const checkoutUrl = `${profileBase}/checkout?appId=${encodeURIComponent(
          app.clientId
        )}&planCode=${encodeURIComponent(card.planCode)}&interval=MONTHLY&amount=${rawAmount}&currency=${encodeURIComponent(
          card.currency || 'USD'
        )}&title=${encodeURIComponent(card.name)}`;

        return {
          id: card.id || card.planCode,
          planCode: card.planCode,
          name: card.name,
          description: card.description || '',
          amount: rawAmount,
          yearlyAmount,
          currency: card.currency || 'USD',
          interval: card.interval || 'MONTHLY',
          trialDays: Number(card.trialDays) || 0,
          isPopular: Boolean(card.isPopular),
          badgeText: card.badgeText || (card.isPopular ? 'Most Popular' : null),
          featureKeys: Array.isArray(card.featureKeys) ? card.featureKeys : [],
          features,
          buttonText: card.buttonText || (rawAmount === 0 ? 'Get Started Free' : 'Subscribe'),
          buttonUrl: card.buttonUrl || null,
          checkoutUrl,
        };
      });

      return res.status(200).json({
        success: true,
        app: {
          id: app.id,
          name: app.name,
          logoUrl: app.logoUrl,
          clientId: app.clientId,
          description: app.description || '',
        },
        settings: {
          headline: config?.headline || `${app.name} Plans & Pricing`,
          subheadline: config?.subheadline || 'Choose the plan tailored for your growth',
          theme: config?.theme || 'auto',
          accentColor: config?.accentColor || '#6366f1',
          billingIntervals: config?.billingIntervals || ['MONTHLY', 'YEARLY'],
          yearlyDiscountPct: yearlyDiscount,
          showTrustBadge: config?.showTrustBadge !== false,
        },
        plans: mappedPlans,
      });
    } catch (err: any) {
      console.error('[PricingTableApiController:getHeadlessPricing] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
