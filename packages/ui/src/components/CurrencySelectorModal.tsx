'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Globe, Check } from 'lucide-react';
import { locationService, CountryItem } from '../lib/location-service';
import { currencyService } from '../lib/currency-service';

export interface CurrencySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCurrency: string;
  activeCountryCode?: string;
  onSelect: (currencyCode: string, countryCode: string) => void;
  title?: string;
  subtitle?: string;
  zIndex?: string;
}

const POPULAR_REGIONS = [
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'IN', label: 'India', currency: 'INR' },
  { code: 'NP', label: 'Nepal', currency: 'NPR' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'AE', label: 'UAE', currency: 'AED' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'DE', label: 'Germany', currency: 'EUR' },
  { code: 'SG', label: 'Singapore', currency: 'SGD' },
];

export function CurrencySelectorModal({
  isOpen,
  onClose,
  activeCurrency,
  activeCountryCode,
  onSelect,
  title = 'Select Display Currency & Country',
  subtitle = 'Choose any regional currency. All metrics and figures will convert automatically.',
  zIndex = 'z-[100002]',
}: CurrencySelectorModalProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const allCountries = useMemo(() => locationService.getAllCountries(), []);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return allCountries;
    const q = search.toLowerCase().trim();
    return allCountries.filter((c) => {
      const curr = currencyService.getCurrencyForCountry(c.code).toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        curr.includes(q)
      );
    });
  }, [allCountries, search]);

  if (!isOpen) return null;

  const modalNode = (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200`}>
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                {title}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-zinc-100 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country, currency (USD, INR, EUR), or ISO code..."
              className="w-full pl-10 pr-12 py-2.5 bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-white/10 rounded-2xl text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Popular Regions */}
          {!search && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Popular Regions
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Quick selection</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_REGIONS.map((pop) => {
                  const c = locationService.getCountryByCode(pop.code);
                  if (!c) return null;
                  const isSelected = activeCurrency.toUpperCase() === pop.currency;
                  return (
                    <button
                      key={pop.code}
                      type="button"
                      onClick={() => {
                        onSelect(pop.currency, pop.code);
                        onClose();
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20'
                          : 'bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-zinc-50 dark:hover:bg-zinc-700/60'
                      }`}
                    >
                      <span>{c.flag}</span>
                      <span>{pop.label}</span>
                      <span className={`text-[10px] font-mono ${isSelected ? 'text-purple-100 font-bold' : 'text-zinc-400 dark:text-zinc-500'}`}>
                        ({pop.currency})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Countries List */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-zinc-100 dark:divide-white/5 overscroll-contain">
          {filteredCountries.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No countries found matching "{search}"
            </div>
          ) : (
            filteredCountries.map((c) => {
              const curr = currencyService.getCurrencyForCountry(c.code);
              const meta = currencyService.getCurrencyMeta(curr);
              const isSelected = activeCurrency.toUpperCase() === curr;

              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onSelect(curr, c.code);
                    onClose();
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100 font-bold border border-purple-200/80 dark:border-purple-800/50 shadow-2xs'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{c.flag}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-zinc-900 dark:text-white">
                        {c.name}
                      </div>
                      <div className="text-[10.5px] text-zinc-400 dark:text-zinc-500">
                        {c.code} • {meta.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                    }`}>
                      {meta.symbol} {curr}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
}
