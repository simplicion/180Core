'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { currencyService, CurrencyMeta } from '../lib/currency-service';
import { locationService } from '../lib/location-service';
import { CurrencySelectorModal } from '../components/CurrencySelectorModal';

interface PlatformCurrencyContextType {
  activeCurrency: string;
  activeCountryCode: string;
  activeMeta: CurrencyMeta;
  setPlatformCurrency: (currency: string, countryCode?: string) => void;
  formatAmount: (amount: number, fromCurrency?: string) => string;
  convertAmount: (amount: number, fromCurrency?: string) => number;
  openCurrencyModal: () => void;
  closeCurrencyModal: () => void;
  isCurrencyModalOpen: boolean;
  isLoadingRates: boolean;
}

const PlatformCurrencyContext = createContext<PlatformCurrencyContextType | null>(null);

const STORAGE_CURRENCY_KEY = '180_platform_currency';
const STORAGE_COUNTRY_KEY = '180_platform_country';

export function PlatformCurrencyProvider({ children }: { children: React.ReactNode }) {
  // Base default is USD ($) per platform requirement
  const [activeCurrency, setActiveCurrency] = useState<string>('USD');
  const [activeCountryCode, setActiveCountryCode] = useState<string>('US');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Initialize currency: 1. Stored user selection -> 2. Detected user location -> 3. USD ($) default
  useEffect(() => {
    let isMounted = true;

    async function initCurrency() {
      // 1. Check if user previously saved a currency preference
      if (typeof window !== 'undefined') {
        try {
          const storedCurr = localStorage.getItem(STORAGE_CURRENCY_KEY);
          const storedCountry = localStorage.getItem(STORAGE_COUNTRY_KEY);
          if (storedCurr) {
            setActiveCurrency(storedCurr.toUpperCase());
            if (storedCountry) setActiveCountryCode(storedCountry.toUpperCase());
            currencyService.fetchLiveExchangeRates().catch(() => {});
            return;
          }
        } catch (_) {}
      }

      // 2. Otherwise detect developer/user's live location automatically
      try {
        setIsLoadingRates(true);
        const loc = await locationService.detectLiveLocation();
        if (!isMounted) return;

        if (loc && loc.countryCode) {
          const localCurr = currencyService.getCurrencyForCountry(loc.countryCode);
          setActiveCountryCode(loc.countryCode);
          setActiveCurrency(localCurr || 'USD');
        }
      } catch (_) {
        // Fallback default is USD
        if (isMounted) {
          setActiveCurrency('USD');
          setActiveCountryCode('US');
        }
      } finally {
        if (isMounted) setIsLoadingRates(false);
        currencyService.fetchLiveExchangeRates().catch(() => {});
      }
    }

    initCurrency();

    // Listen to cross-tab or cross-component currency changes
    const handleCurrencyChange = (e: any) => {
      const detail = e.detail;
      if (detail && detail.currency) {
        setActiveCurrency(detail.currency.toUpperCase());
        if (detail.countryCode) setActiveCountryCode(detail.countryCode.toUpperCase());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('180_currency_changed', handleCurrencyChange);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('180_currency_changed', handleCurrencyChange);
      }
    };
  }, []);

  const setPlatformCurrency = useCallback((currency: string, countryCode?: string) => {
    const cleanCurr = currency.trim().toUpperCase();
    const cleanCountry = (countryCode || '').trim().toUpperCase();

    setActiveCurrency(cleanCurr);
    if (cleanCountry) {
      setActiveCountryCode(cleanCountry);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_CURRENCY_KEY, cleanCurr);
        if (cleanCountry) {
          localStorage.setItem(STORAGE_COUNTRY_KEY, cleanCountry);
        }
        document.cookie = `${STORAGE_CURRENCY_KEY}=${cleanCurr}; path=/; max-age=31536000; SameSite=Lax`;
        window.dispatchEvent(
          new CustomEvent('180_currency_changed', {
            detail: { currency: cleanCurr, countryCode: cleanCountry },
          })
        );
      } catch (_) {}
    }
  }, []);

  const activeMeta = useMemo(() => {
    return currencyService.getCurrencyMeta(activeCurrency);
  }, [activeCurrency]);

  const convertAmount = useCallback(
    (amount: number, fromCurrency: string = 'USD'): number => {
      return currencyService.convert(amount, fromCurrency, activeCurrency);
    },
    [activeCurrency]
  );

  const formatAmount = useCallback(
    (amount: number, fromCurrency: string = 'USD'): string => {
      const converted = currencyService.convert(amount, fromCurrency, activeCurrency);
      return currencyService.format(converted, activeCurrency);
    },
    [activeCurrency]
  );

  const openCurrencyModal = useCallback(() => setIsModalOpen(true), []);
  const closeCurrencyModal = useCallback(() => setIsModalOpen(false), []);

  const contextValue = useMemo(
    () => ({
      activeCurrency,
      activeCountryCode,
      activeMeta,
      setPlatformCurrency,
      formatAmount,
      convertAmount,
      openCurrencyModal,
      closeCurrencyModal,
      isCurrencyModalOpen: isModalOpen,
      isLoadingRates,
    }),
    [
      activeCurrency,
      activeCountryCode,
      activeMeta,
      setPlatformCurrency,
      formatAmount,
      convertAmount,
      openCurrencyModal,
      closeCurrencyModal,
      isModalOpen,
      isLoadingRates,
    ]
  );

  return (
    <PlatformCurrencyContext.Provider value={contextValue}>
      {children}
      <CurrencySelectorModal
        isOpen={isModalOpen}
        onClose={closeCurrencyModal}
        activeCurrency={activeCurrency}
        activeCountryCode={activeCountryCode}
        onSelect={setPlatformCurrency}
      />
    </PlatformCurrencyContext.Provider>
  );
}

export function usePlatformCurrency() {
  const ctx = useContext(PlatformCurrencyContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    const meta = currencyService.getCurrencyMeta('USD');
    return {
      activeCurrency: 'USD',
      activeCountryCode: 'US',
      activeMeta: meta,
      setPlatformCurrency: () => {},
      formatAmount: (amt: number, from = 'USD') => currencyService.format(amt, from),
      convertAmount: (amt: number) => amt,
      openCurrencyModal: () => {},
      closeCurrencyModal: () => {},
      isCurrencyModalOpen: false,
      isLoadingRates: false,
    };
  }
  return ctx;
}
