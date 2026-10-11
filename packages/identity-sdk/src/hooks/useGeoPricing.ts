'use strict';

import { useState, useEffect, useCallback } from 'react';

export interface GeoPricingData {
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

export interface UseGeoPricingOptions {
  baseCurrency?: string;
  countryOverride?: string;
  apiBaseUrl?: string;
  enabled?: boolean;
}

export function use180GeoPricing(
  appId: string,
  baseAmount: number,
  options: UseGeoPricingOptions = {}
) {
  const {
    baseCurrency = 'USD',
    countryOverride,
    apiBaseUrl = 'https://auth.180workspace.com',
    enabled = true,
  } = options;

  const [data, setData] = useState<GeoPricingData | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(enabled && appId && baseAmount > 0));
  const [error, setError] = useState<string | null>(null);

  const fetchPricing = useCallback(async () => {
    if (!enabled || !appId || !baseAmount || baseAmount <= 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = new URL(`${apiBaseUrl.replace(/\/+$/, '')}/api/v1/geo-pricing/resolve`);
      url.searchParams.set('appId', appId);
      url.searchParams.set('baseAmount', String(baseAmount));
      url.searchParams.set('baseCurrency', baseCurrency);
      if (countryOverride) {
        url.searchParams.set('country', countryOverride);
      }

      const res = await fetch(url.toString());
      const json = await res.json();

      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to resolve geo-pricing');
      }
    } catch (err: any) {
      setError(err.message || 'Network error resolving geo-pricing');
    } finally {
      setLoading(false);
    }
  }, [appId, baseAmount, baseCurrency, countryOverride, apiBaseUrl, enabled]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  return {
    data,
    loading,
    error,
    hasDiscount: Boolean(data?.hasRegionalDiscount),
    discountPercentage: data?.discountPercentage || 0,
    localizedAmount: data?.localizedAmount || baseAmount,
    formattedPrice: data?.formattedPrice || `${baseCurrency} ${baseAmount}`,
    banner: data?.banner,
    refresh: fetchPricing,
  };
}
