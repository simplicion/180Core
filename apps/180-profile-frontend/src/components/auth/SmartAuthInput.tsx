'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Phone,
  Mail,
  Search,
  ChevronDown,
  Check,
  Smartphone,
  MessageSquare,
  Globe,
} from 'lucide-react';
import { locationService, CountryItem, DetectedLocation } from '@/lib/location-service';

export type CountryInfo = CountryItem;

export interface SmartAuthInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  showBadge?: boolean;
}

export const SmartAuthInput: React.FC<SmartAuthInputProps> = ({
  value,
  onChange,
  placeholder,
  label,
  required = true,
  autoFocus = false,
  disabled = false,
  id = 'smart-auth-input',
  className = '',
  showBadge = true,
}) => {
  // Load full dynamic list of all world countries from country-state-city (Zero hardcoding)
  const allCountries = useMemo(() => locationService.getAllCountries(), []);

  // Selected Country for phone mode (initialized dynamically from live location)
  const [selectedCountry, setSelectedCountry] = useState<CountryItem>(() => {
    return (
      locationService.getCountryByCode('NP') ||
      locationService.getCountryByCode('IN') ||
      locationService.getCountryByCode('US') ||
      allCountries[0] || {
        code: 'NP',
        name: 'Nepal',
        dialCode: '+977',
        flag: '🇳🇵',
      }
    );
  });

  const [detectedInfo, setDetectedInfo] = useState<DetectedLocation | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Instantly detect user IP & location on mount from live location service
  useEffect(() => {
    let isMounted = true;
    locationService
      .detectLiveLocation()
      .then((detected) => {
        if (!isMounted) return;
        setDetectedInfo(detected);
        const matched = locationService.getCountryByCode(detected.countryCode);
        if (matched) {
          setSelectedCountry(matched);
        }
      })
      .catch((err) => {
        console.warn('[SmartAuthInput] Location detection fallback:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Determine if current text represents a phone number or email
  const isPhoneMode = useMemo(() => {
    const trimmed = (value || '').trim();
    if (!trimmed) return false;

    // Starts with + is explicitly phone
    if (trimmed.startsWith('+')) return true;

    // If it contains letters or @, it is strictly email/text mode
    if (/[a-zA-Z@]/.test(trimmed)) return false;

    // Only numbers, spaces, dashes, parentheses
    return /^[\d\s\-().]+$/.test(trimmed);
  }, [value]);

  // Extract display value for input box (clean national digits without duplicating dialCode)
  const displayValue = useMemo(() => {
    if (!isPhoneMode) return value || '';

    const dialDigits = selectedCountry.dialCode.replace(/[^\d]/g, '');
    const cleanDigits = value.replace(/[^\d]/g, '');

    if (value.startsWith(selectedCountry.dialCode)) {
      return value.slice(selectedCountry.dialCode.length).trim();
    }
    if (value.startsWith(`+${dialDigits}`)) {
      return value.slice(dialDigits.length + 1).trim();
    }
    if (cleanDigits.startsWith(dialDigits) && cleanDigits.length > dialDigits.length) {
      return cleanDigits.slice(dialDigits.length);
    }
    return value;
  }, [value, isPhoneMode, selectedCountry]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Filter countries dynamically with fuzzy search
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allCountries;

    // Handle common spelling variations (e.g. afganisthan -> afghanistan)
    let normalizedQ = q;
    if (q.includes('afgan')) normalizedQ = q.replace('afgan', 'afghan');

    const cleanDigits = q.replace(/[^\d]/g, '');

    return allCountries.filter((c) => {
      const nameLower = c.name.toLowerCase();
      if (nameLower.includes(q) || nameLower.includes(normalizedQ)) return true;
      if (c.code.toLowerCase().includes(q)) return true;
      if (cleanDigits && c.dialCode.replace(/[^\d]/g, '').includes(cleanDigits)) return true;
      return false;
    });
  }, [searchQuery, allCountries]);

  // Handle typing inside text input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const trimmed = rawVal.trim();

    if (!trimmed) {
      onChange('');
      return;
    }

    // If user typed/pasted an international number starting with '+'
    if (trimmed.startsWith('+')) {
      const matched = allCountries
        .filter((c) => trimmed.startsWith(c.dialCode))
        .sort((a, b) => b.dialCode.length - a.dialCode.length)[0];

      if (matched) {
        setSelectedCountry(matched);
      }
      onChange(rawVal);
      return;
    }

    const hasAlphaOrAt = /[a-zA-Z@]/.test(trimmed);

    // If user typed digits -> Phone Mode
    if (!hasAlphaOrAt && /^[\d\s\-().]+$/.test(trimmed)) {
      const cleanDigits = rawVal.replace(/[^\d]/g, '');
      const dialDigits = selectedCountry.dialCode.replace(/[^\d]/g, '');

      if (cleanDigits.startsWith(dialDigits) && cleanDigits.length > dialDigits.length) {
        onChange(`+${cleanDigits}`);
      } else {
        onChange(`${selectedCountry.dialCode}${cleanDigits}`);
      }
      return;
    }

    // Email or username mode
    onChange(rawVal);
  };

  // Switch country from dropdown
  const handleSelectCountry = (country: CountryItem) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');

    if (isPhoneMode) {
      const cleanDigits = value.replace(/[^\d]/g, '');
      const oldDialDigits = selectedCountry.dialCode.replace(/[^\d]/g, '');
      let national = cleanDigits;

      if (cleanDigits.startsWith(oldDialDigits) && cleanDigits.length > oldDialDigits.length) {
        national = cleanDigits.slice(oldDialDigits.length);
      }
      onChange(`${country.dialCode}${national}`);
    }

    setTimeout(() => inputRef.current?.focus(), 80);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-xs font-bold text-slate-700">
            {label}
          </label>
          {showBadge && (
            <div className="flex items-center gap-1.5">
              {isPhoneMode ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 animate-in fade-in duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                  <span>WhatsApp OTP</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                  <Mail className="w-3 h-3 text-blue-600" />
                  <span>Email / Phone</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input Box Container */}
      <div className="relative flex items-center">
        {/* Country Code Trigger: ONLY renders when phone numbers are typed! */}
        {isPhoneMode && (
          <div className="relative shrink-0 animate-in fade-in slide-in-from-left-2 duration-200" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={disabled}
              aria-label="Select Country Code"
              className="h-[42px] px-2.5 rounded-l-xl flex items-center gap-1.5 border border-r-0 bg-emerald-50/80 border-emerald-300 text-emerald-900 hover:bg-emerald-100/80 transition-colors cursor-pointer select-none"
            >
              <span className="text-base leading-none select-none">{selectedCountry.flag}</span>
              <span className="text-xs font-bold font-mono tracking-tight">{selectedCountry.dialCode}</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180 text-blue-600' : ''
                }`}
              />
            </button>

            {/* Searchable Country Dropdown Popover */}
            {isDropdownOpen && (
              <div className="absolute left-0 top-[46px] z-50 w-72 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search country or code (e.g. Afghanistan, +93)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Detected Location Quick Badge from Live IP */}
                {detectedInfo && (
                  <button
                    type="button"
                    onClick={() => {
                      const matched = locationService.getCountryByCode(detectedInfo.countryCode);
                      if (matched) handleSelectCountry(matched);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 flex items-center justify-between text-[11px] text-blue-700 font-medium transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">Detected: {detectedInfo.countryName}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-800 shrink-0 pl-1">{detectedInfo.dialCode}</span>
                  </button>
                )}

                {/* Full Country List (Dynamically from country-state-city) */}
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 divide-y divide-slate-100/50">
                  {filteredCountries.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No matching countries found
                    </div>
                  ) : (
                    filteredCountries.map((c) => {
                      const isSelected = c.code === selectedCountry.code;
                      return (
                        <button
                          key={`${c.code}-${c.dialCode}`}
                          type="button"
                          onClick={() => handleSelectCountry(c)}
                          className={`w-full px-2 py-1.5 rounded-xl flex items-center justify-between text-xs text-left cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 text-blue-900 font-bold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 pl-2">
                            <span className="font-mono text-slate-500 font-semibold">{c.dialCode}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            placeholder={
              isPhoneMode
                ? 'e.g. 98765 43210'
                : (placeholder || 'Enter email address or mobile number')
            }
            required={required}
            autoFocus={autoFocus}
            disabled={disabled}
            className={`w-full bg-slate-50/80 border border-slate-200 px-3.5 py-2.5 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
              isPhoneMode
                ? 'rounded-r-xl border-emerald-300 font-mono'
                : 'rounded-xl'
            }`}
          />

          {/* Icon hint inside right edge */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            {isPhoneMode ? (
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 animate-in fade-in" />
            ) : (
              <Mail className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Reassurance WhatsApp OTP line */}
      {isPhoneMode && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium px-1 pt-0.5 animate-in fade-in duration-150">
          <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>
            WhatsApp OTP will be delivered to <strong>{selectedCountry.dialCode} {displayValue || '...'}</strong>
          </span>
        </div>
      )}
    </div>
  );
};
