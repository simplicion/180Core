import { getCurrencyByIso, getCountryByIso, ALL_COUNTRIES } from './countries-data';

export interface CurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  fxRateToUsd: number; // units of local currency per 1 USD
  decimals: number;
}

function getFlagCode(countryCode: string): string {
  try {
    const clean = countryCode.trim().toUpperCase();
    if (clean.length !== 2) return 'INTL';
    return clean;
  } catch (_) {
    return 'INTL';
  }
}

export const CURRENCY_CATALOG: Record<string, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: 'IN', fxRateToUsd: 83.50, decimals: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: 'US', fxRateToUsd: 1.0, decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: 'EU', fxRateToUsd: 0.92, decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: 'GB', fxRateToUsd: 0.79, decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: 'CN', fxRateToUsd: 7.24, decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: 'JP', fxRateToUsd: 155.0, decimals: 0 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: 'CA', fxRateToUsd: 1.36, decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: 'AU', fxRateToUsd: 1.52, decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: 'SG', fxRateToUsd: 1.34, decimals: 2 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: 'AE', fxRateToUsd: 3.67, decimals: 2 },
  NPR: { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', flag: 'NP', fxRateToUsd: 133.6, decimals: 2 },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: 'BR', fxRateToUsd: 5.80, decimals: 2 },
  MXN: { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', flag: 'MX', fxRateToUsd: 19.80, decimals: 2 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: 'TH', fxRateToUsd: 34.0, decimals: 2 },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: 'MY', fxRateToUsd: 4.40, decimals: 2 },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: 'ID', fxRateToUsd: 15800.0, decimals: 0 },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: 'PH', fxRateToUsd: 58.5, decimals: 2 },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', flag: 'VN', fxRateToUsd: 25300.0, decimals: 0 },
  PKR: { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', flag: 'PK', fxRateToUsd: 278.0, decimals: 2 },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: 'BD', fxRateToUsd: 120.0, decimals: 2 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: 'ZA', fxRateToUsd: 18.2, decimals: 2 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: 'NG', fxRateToUsd: 1550.0, decimals: 2 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: 'KE', fxRateToUsd: 129.0, decimals: 2 },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', flag: 'EG', fxRateToUsd: 49.0, decimals: 2 },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: 'TR', fxRateToUsd: 34.5, decimals: 2 },
  PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', flag: 'PL', fxRateToUsd: 4.0, decimals: 2 },
};

export const GATEWAY_SUPPORTED_CURRENCIES = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'AUD', 'CAD', 'CNY', 'JPY',
  'HKD', 'NZD', 'CHF', 'SEK', 'DKK', 'MYR', 'THB', 'ZAR', 'BRL', 'MXN', 'PLN', 'PHP'
]);

export class CurrencyService {
  private liveFxRates: Record<string, number> = {};
  private ratesFetched = false;

  constructor() {
    // Populate base rates
    for (const code in CURRENCY_CATALOG) {
      this.liveFxRates[code] = CURRENCY_CATALOG[code].fxRateToUsd;
    }
  }

  /**
   * Identifies whether this currency is supported for direct processing by payment gateways (Razorpay / Stripe)
   */
  isGatewaySupported(currencyCode?: string): boolean {
    if (!currencyCode) return false;
    return GATEWAY_SUPPORTED_CURRENCIES.has(currencyCode.trim().toUpperCase());
  }

  /**
   * Returns the appropriate gateway settlement currency for a user in a given country.
   * If the local currency cannot be processed directly by payment gateways (e.g. NPR for Nepal),
   * transactions settle in USD (the global standard for international card checkout).
   */
  getSettlementCurrency(countryCode?: string, defaultCurrency: string = 'USD'): string {
    const local = this.getCurrencyForCountry(countryCode);
    if (this.isGatewaySupported(local)) {
      return local;
    }
    return defaultCurrency.toUpperCase();
  }

  /**
   * Dynamically resolves official ISO currency for ANY country code in the world
   * Uses high-performance in-memory ISO country catalog — Zero hardcoding!
   */
  getCurrencyForCountry(countryCode?: string): string {
    if (!countryCode) return 'USD';
    return getCurrencyByIso(countryCode);
  }

  /**
   * Resolves currency symbol, name, flag, and decimals dynamically via Intl API
   */
  getCurrencyMeta(currencyCode?: string): CurrencyMeta {
    if (!currencyCode) return CURRENCY_CATALOG['USD'];
    const clean = currencyCode.trim().toUpperCase();

    if (CURRENCY_CATALOG[clean]) {
      return CURRENCY_CATALOG[clean];
    }

    // Dynamic fallback for any world currency using standard Intl and Country library
    let symbol = clean;
    try {
      symbol = (0).toLocaleString('en-US', {
        style: 'currency',
        currency: clean,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).replace(/\d/g, '').trim();
    } catch (_) {
      symbol = clean;
    }

    let flag = 'INTL';
    try {
      const matched = ALL_COUNTRIES.find((c) => c.currency === clean);
      if (matched) {
        flag = getFlagCode(matched.code);
      }
    } catch (_) {}

    return {
      code: clean,
      symbol: symbol || clean,
      name: clean,
      flag,
      fxRateToUsd: this.getRateToUsd(clean),
      decimals: clean === 'JPY' || clean === 'KRW' || clean === 'VND' || clean === 'IDR' ? 0 : 2,
    };
  }

  getRateToUsd(currencyCode: string): number {
    const clean = currencyCode.trim().toUpperCase();
    if (clean === 'USD') return 1.0;
    if (this.liveFxRates[clean]) return this.liveFxRates[clean];
    if (CURRENCY_CATALOG[clean]) return CURRENCY_CATALOG[clean].fxRateToUsd;
    return 1.0;
  }

  convert(amount: number, fromCurrency: string, toCurrency: string): number {
    const from = fromCurrency.trim().toUpperCase();
    const to = toCurrency.trim().toUpperCase();
    if (from === to || amount <= 0) return amount;

    const fromRate = this.getRateToUsd(from);
    const toRate = this.getRateToUsd(to);

    // Convert from -> USD pivot -> to
    const amountInUsd = amount / fromRate;
    const converted = amountInUsd * toRate;

    const meta = this.getCurrencyMeta(to);
    if (meta.decimals === 0) {
      return Math.round(converted);
    }
    return Math.round(converted * 100) / 100;
  }

  format(amount: number, currencyCode: string): string {
    const meta = this.getCurrencyMeta(currencyCode);
    const decimals = meta.decimals !== undefined ? meta.decimals : 2;
    return `${meta.symbol}${amount.toFixed(decimals)}`;
  }

  async fetchLiveExchangeRates(): Promise<Record<string, number>> {
    if (this.ratesFetched) return this.liveFxRates;

    // Check sessionStorage cache first
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('180_live_fx_rates');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            this.liveFxRates = { ...this.liveFxRates, ...parsed };
            this.ratesFetched = true;
            return this.liveFxRates;
          }
        }
      } catch (_) {}
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && typeof data.rates === 'object') {
          for (const c in data.rates) {
            this.liveFxRates[c] = Number(data.rates[c]);
          }
          this.ratesFetched = true;
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('180_live_fx_rates', JSON.stringify(data.rates));
            } catch (_) {}
          }
        }
      }
    } catch (_) {
      // Fallback cleanly to pre-baked real-world rates
    }

    return this.liveFxRates;
  }
}

export const currencyService = new CurrencyService();
