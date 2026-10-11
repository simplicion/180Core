import { Country } from 'country-state-city';

export interface CountryItem {
  code: string; // ISO 3166-1 alpha-2 (e.g., "NP", "US", "IN")
  name: string; // Full English name (e.g., "Nepal", "United States")
  dialCode: string; // E.164 dial prefix (e.g., "+977", "+1", "+91")
  flag: string; // Emoji flag (e.g., "🇳🇵", "🇺🇸")
}

export interface DetectedLocation {
  countryCode: string;
  countryName: string;
  dialCode: string;
  flag: string;
  city?: string;
  source: 'ip' | 'timezone' | 'locale' | 'fallback';
}

function getFlagEmoji(countryCode: string): string {
  try {
    const clean = countryCode.trim().toUpperCase();
    if (clean.length !== 2) return '🌐';
    const codePoints = clean
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch (_) {
    return '🌐';
  }
}

class LocationService {
  private allCountries: CountryItem[] = [];
  private cachedLocation: DetectedLocation | null = null;
  private pendingDetection: Promise<DetectedLocation> | null = null;

  constructor() {
    this.initCatalog();
  }

  private initCatalog() {
    try {
      const raw = Country.getAllCountries();
      this.allCountries = raw
        .filter((c) => c.phonecode && c.phonecode.replace(/[^\d]/g, '').length > 0)
        .map((c) => {
          const cleanPhone = c.phonecode.replace(/[^\d]/g, '');
          return {
            code: c.isoCode.toUpperCase(),
            name: c.name,
            dialCode: `+${cleanPhone}`,
            flag: c.flag || getFlagEmoji(c.isoCode),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error('[LocationService] Failed to load countries from country-state-city:', e);
      this.allCountries = [];
    }
  }

  /**
   * Complete live global catalog of all 240+ countries and territories (Zero hardcoding)
   */
  getAllCountries(): CountryItem[] {
    if (this.allCountries.length === 0) {
      this.initCatalog();
    }
    return this.allCountries;
  }

  /**
   * Search countries dynamically by name, ISO code, or dial code
   */
  searchCountries(query: string): CountryItem[] {
    const q = (query || '').toLowerCase().trim();
    if (!q) return this.getAllCountries();

    const cleanDigits = q.replace(/[^\d]/g, '');

    return this.getAllCountries().filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.code.toLowerCase().includes(q)) return true;
      if (cleanDigits && c.dialCode.replace(/[^\d]/g, '').includes(cleanDigits)) return true;
      return false;
    });
  }

  /**
   * Look up country by ISO code
   */
  getCountryByCode(code?: string): CountryItem | undefined {
    if (!code) return undefined;
    const clean = code.trim().toUpperCase();
    return this.getAllCountries().find((c) => c.code === clean);
  }

  /**
   * Look up country by dial code prefix
   */
  getCountryByDialCode(dialCode?: string): CountryItem | undefined {
    if (!dialCode) return undefined;
    const digits = dialCode.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    return this.getAllCountries().find((c) => c.dialCode === `+${digits}`);
  }

  /**
   * Detect user's live country and dialing code instantly via:
   * 1. Live IP Geolocation (ipwho.is)
   * 2. Secondary IP Geolocation (api.country.is)
   * 3. Browser Timezone matching against dynamic country-state-city database
   * 4. Browser navigator language / locale
   */
  async detectLiveLocation(): Promise<DetectedLocation> {
    if (this.cachedLocation) {
      return this.cachedLocation;
    }

    if (this.pendingDetection) {
      return this.pendingDetection;
    }

    this.pendingDetection = this.runDetection();
    const result = await this.pendingDetection;
    this.cachedLocation = result;
    this.pendingDetection = null;
    return result;
  }

  private async runDetection(): Promise<DetectedLocation> {
    // Check sessionStorage cache first for instant hydration
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('180_live_detected_country');
        if (stored) {
          const parsed = JSON.parse(stored);
          const currentOffset = new Date().getTimezoneOffset();
          // Invalidate stale fallback cache, or cache mismatch (e.g. cached IN when client is in Nepal with offset -345)
          const isStaleConflict = (currentOffset === -345 && parsed.countryCode !== 'NP') || parsed.source === 'fallback';
          if (parsed?.countryCode && parsed?.dialCode && !isStaleConflict) {
            return parsed;
          }
        }
      } catch (_) {}
    }

    // 1. Live IP Geolocation via ipwho.is (fastest, free, no auth required)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://ipwho.is/', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && data.country_code) {
          const matched = this.getCountryByCode(data.country_code);
          const detected: DetectedLocation = {
            countryCode: data.country_code,
            countryName: data.country || matched?.name || data.country_code,
            dialCode: data.calling_code ? `+${data.calling_code.replace(/[^\d]/g, '')}` : (matched?.dialCode || '+1'),
            flag: matched?.flag || getFlagEmoji(data.country_code),
            city: data.city || undefined,
            source: 'ip',
          };
          this.persist(detected);
          return detected;
        }
      }
    } catch (_) {}

    // 2. Secondary IP Geolocation via api.country.is (fallback)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://api.country.is', {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data?.country) {
          const matched = this.getCountryByCode(data.country);
          if (matched) {
            const detected: DetectedLocation = {
              countryCode: matched.code,
              countryName: matched.name,
              dialCode: matched.dialCode,
              flag: matched.flag,
              source: 'ip',
            };
            this.persist(detected);
            return detected;
          }
        }
      }
    } catch (_) {}

    // 3. Timezone heuristic & unique UTC offset matching dynamically
    try {
      const offsetMinutes = new Date().getTimezoneOffset();
      // Nepal is UTC+05:45 (offset -345 minutes) - uniquely singular in the world!
      if (offsetMinutes === -345) {
        const np = this.getCountryByCode('NP') || {
          code: 'NP',
          name: 'Nepal',
          dialCode: '+977',
          flag: '🇳🇵',
        };
        const detected: DetectedLocation = {
          countryCode: 'NP',
          countryName: 'Nepal',
          dialCode: '+977',
          flag: np.flag || '🇳🇵',
          source: 'timezone',
        };
        this.persist(detected);
        return detected;
      }

      const rawTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      // Canonicalize common timezone naming differences across browser/OS implementations
      const tz = rawTz
        .replace(/Katmandu/i, 'Kathmandu')
        .replace(/Calcutta/i, 'Kolkata')
        .replace(/Rangoon/i, 'Yangon')
        .replace(/Saigon/i, 'Ho_Chi_Minh');

      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (rawTz || tz) {
        const raw = Country.getAllCountries();
        for (const country of raw) {
          const timezones = (country as any).timezones as Array<{ zoneName: string }> | undefined;
          if (
            timezones &&
            timezones.some((t) => {
              const nt = norm(t.zoneName);
              return nt === norm(tz) || nt === norm(rawTz);
            })
          ) {
            const matched = this.getCountryByCode(country.isoCode);
            if (matched) {
              const detected: DetectedLocation = {
                countryCode: matched.code,
                countryName: matched.name,
                dialCode: matched.dialCode,
                flag: matched.flag,
                source: 'timezone',
              };
              this.persist(detected);
              return detected;
            }
          }
        }
      }
    } catch (_) {}

    // 4. Browser locale fallback (e.g. "en-NP" -> "NP")
    try {
      const lang = typeof navigator !== 'undefined' ? navigator.language : '';
      const parts = lang.split('-');
      if (parts.length > 1) {
        const region = parts[1].toUpperCase();
        const matched = this.getCountryByCode(region);
        if (matched) {
          const detected: DetectedLocation = {
            countryCode: matched.code,
            countryName: matched.name,
            dialCode: matched.dialCode,
            flag: matched.flag,
            source: 'locale',
          };
          this.persist(detected);
          return detected;
        }
      }
    } catch (_) {}

    // 5. Default fallback to India (+91)
    const defaultCountry = this.getCountryByCode('IN') || this.getAllCountries()[0] || {
      code: 'IN',
      name: 'India',
      dialCode: '+91',
      flag: '🇮🇳',
    };

    const fallback: DetectedLocation = {
      countryCode: defaultCountry.code,
      countryName: defaultCountry.name,
      dialCode: defaultCountry.dialCode,
      flag: defaultCountry.flag,
      source: 'fallback',
    };
    return fallback;
  }

  /**
   * Reverse geocode coordinates using OpenStreetMap Nominatim API
   */
  async reverseGeocodeWithOpenStreetMap(latitude: number, longitude: number): Promise<DetectedLocation | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': '180WorkspacePay/1.0',
          },
        }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const code = (data?.address?.country_code || '').toUpperCase();
        if (code) {
          const matched = this.getCountryByCode(code);
          const detected: DetectedLocation = {
            countryCode: code,
            countryName: data?.address?.country || matched?.name || code,
            dialCode: matched?.dialCode || '+1',
            flag: matched?.flag || getFlagEmoji(code),
            city: data?.address?.city || data?.address?.town || data?.address?.village || undefined,
            source: 'ip',
          };
          this.persist(detected);
          return detected;
        }
      }
    } catch (_) {}
    return null;
  }

  private persist(loc: DetectedLocation) {
    this.cachedLocation = loc;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('180_live_detected_country', JSON.stringify(loc));
      } catch (_) {}
    }
  }
}

export const locationService = new LocationService();
