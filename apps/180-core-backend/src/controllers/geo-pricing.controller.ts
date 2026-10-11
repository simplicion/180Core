'use strict';

import { Request, Response } from 'express';
import { GeoPricingService, COUNTRY_DIRECTORY } from '@workspace/payment-provider';

export class GeoPricingApiController {
  /**
   * GET /api/v1/geo-pricing/resolve
   * Public endpoint: Resolves visitor country and calculates PPP localized price.
   */
  static async resolveLocalizedPrice(req: Request, res: Response) {
    try {
      const appId = String(req.query.appId || '');
      const baseAmount = parseFloat(String(req.query.baseAmount || '0'));
      const baseCurrency = String(req.query.baseCurrency || 'USD');
      const planId = req.query.planId ? String(req.query.planId) : undefined;

      if (!appId) {
        return res.status(400).json({ success: false, error: 'Application ID (appId) is required' });
      }
      if (isNaN(baseAmount) || baseAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Valid baseAmount must be greater than zero' });
      }

      // Detect country from edge headers or allow client query override (e.g. for preview selector)
      const visitorCountry = req.query.country
        ? String(req.query.country).toUpperCase().trim()
        : GeoPricingService.resolveCountryFromHeaders(req.headers as any);

      const pricing = await GeoPricingService.resolveLocalizedPricing({
        appId,
        baseAmount,
        baseCurrency,
        visitorCountry,
        planId,
      });

      return res.status(200).json({ success: true, data: pricing, pricing });
    } catch (err: any) {
      console.error('[GeoPricingApiController:resolveLocalizedPrice] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/v1/geo-pricing/directory
   * Returns list of supported countries, PPP tiers, and currencies
   */
  static async getCountryDirectory(_req: Request, res: Response) {
    return res.status(200).json({
      success: true,
      directory: Object.values(COUNTRY_DIRECTORY),
    });
  }

  /**
   * GET /api/v1/geo-pricing/apps/:appId
   * Developer endpoint: List all custom geo-pricing rules for an application.
   */
  static async getAppRules(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const rules = await GeoPricingService.getAppGeoRules(appId);
      return res.status(200).json({ success: true, data: rules, rules });
    } catch (err: any) {
      console.error('[GeoPricingApiController:getAppRules] Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/v1/geo-pricing/apps/:appId
   * Developer endpoint: Create or update a country override rule.
   */
  static async setCountryRule(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const rule = await GeoPricingService.setCountryRule(appId, req.body);
      return res.status(200).json({ success: true, data: rule, rule });
    } catch (err: any) {
      console.error('[GeoPricingApiController:setCountryRule] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * DELETE /api/v1/geo-pricing/apps/:appId/:id
   * Developer endpoint: Delete a custom country override rule.
   */
  static async deleteCountryRule(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const ruleId = String(req.params.id);

      await GeoPricingService.deleteCountryRule(appId, ruleId);
      return res.status(200).json({ success: true, message: 'Country rule deleted successfully' });
    } catch (err: any) {
      console.error('[GeoPricingApiController:deleteCountryRule] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  /**
   * PATCH /api/v1/geo-pricing/apps/:appId/toggle
   * Developer endpoint: Toggle automated PPP pricing on or off.
   */
  static async togglePPP(req: Request, res: Response) {
    try {
      const appId = String(req.params.appId);
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, error: '"enabled" boolean field is required' });
      }

      await GeoPricingService.toggleAppPPP(appId, enabled);
      return res.status(200).json({ success: true, enabled, message: `PPP pricing ${enabled ? 'enabled' : 'disabled'}` });
    } catch (err: any) {
      console.error('[GeoPricingApiController:togglePPP] Error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
