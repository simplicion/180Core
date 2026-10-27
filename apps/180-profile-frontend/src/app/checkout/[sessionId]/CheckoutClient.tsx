'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Lock,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Percent,
  Globe,
  Search,
  X,
  Download,
} from 'lucide-react';
import { Button, LogoLoader, AILogoIcon, AdaptiveSkeleton } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';
import { locationService, DetectedLocation, CountryItem } from '@/lib/location-service';
import { currencyService } from '@/lib/currency-service';
import { OneEightyCoreLogo, OneEightyCoreIcon } from '@/components/OneEightyCoreLogo';

declare global {
  interface Window {
    Razorpay: any;
    OneEightyMobileChannel?: any;
    OneEightyPaymentChannel?: any;
    flutter_inappwebview?: any;
  }
}

function formatReturnUrl(baseUrl: string, details: {
  sessionId?: string;
  status?: string;
  transactionId?: string;
  orderId?: string;
  amount?: number | string;
  currency?: string;
}): string {
  if (!baseUrl) return '';
  try {
    const isCustomScheme = baseUrl.includes('://') && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://');
    if (isCustomScheme) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      if (details.sessionId) {
        params.set('session_id', details.sessionId);
        params.set('sessionId', details.sessionId);
      }
      if (details.status) params.set('status', details.status);
      if (details.transactionId) {
        params.set('transaction_id', details.transactionId);
        params.set('transactionId', details.transactionId);
      }
      if (details.orderId) {
        params.set('order_id', details.orderId);
        params.set('orderId', details.orderId);
      }
      if (details.amount !== undefined) params.set('amount', String(details.amount));
      if (details.currency) params.set('currency', String(details.currency));
      return `${baseUrl}${separator}${params.toString()}`;
    }
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'https://profile.180core.cloud');
    if (details.sessionId) {
      url.searchParams.set('session_id', details.sessionId);
      url.searchParams.set('sessionId', details.sessionId);
    }
    if (details.status) url.searchParams.set('status', details.status);
    if (details.transactionId) {
      url.searchParams.set('transaction_id', details.transactionId);
      url.searchParams.set('transactionId', details.transactionId);
    }
    if (details.orderId) {
      url.searchParams.set('order_id', details.orderId);
      url.searchParams.set('orderId', details.orderId);
    }
    if (details.amount !== undefined) url.searchParams.set('amount', String(details.amount));
    if (details.currency) url.searchParams.set('currency', String(details.currency));
    return url.toString();
  } catch (_) {
    return baseUrl;
  }
}

function formatCancelUrl(baseUrl: string, details: {
  sessionId?: string;
  status?: string;
  reason?: string;
}): string {
  if (!baseUrl) return '';
  try {
    const isCustomScheme = baseUrl.includes('://') && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://');
    if (isCustomScheme) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      if (details.sessionId) params.set('session_id', details.sessionId);
      params.set('status', details.status || 'cancelled');
      if (details.reason) params.set('reason', details.reason);
      return `${baseUrl}${separator}${params.toString()}`;
    }
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'https://profile.180core.cloud');
    if (details.sessionId) url.searchParams.set('session_id', details.sessionId);
    url.searchParams.set('status', details.status || 'cancelled');
    if (details.reason) url.searchParams.set('reason', details.reason);
    return url.toString();
  } catch (_) {
    return baseUrl;
  }
}

function dispatchMobilePaymentEvent(payload: any) {
  if (typeof window === 'undefined') return;
  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // 1. Flutter InAppWebView JavaScript Handler
  try {
    if ((window as any).flutter_inappwebview?.callHandler) {
      (window as any).flutter_inappwebview.callHandler('OneEightyPaymentChannel', jsonString);
      (window as any).flutter_inappwebview.callHandler('OneEightyMobileChannel', jsonString);
    }
  } catch (_) {}

  // 2. Android JavascriptInterface / Flutter JavascriptChannel
  try {
    if ((window as any).OneEightyMobileChannel?.postMessage) {
      (window as any).OneEightyMobileChannel.postMessage(jsonString);
    }
    if ((window as any).OneEightyPaymentChannel?.postMessage) {
      (window as any).OneEightyPaymentChannel.postMessage(jsonString);
    }
  } catch (_) {}

  // 3. iOS WebKit message handlers
  try {
    if ((window as any).webkit?.messageHandlers?.OneEightyMobileChannel?.postMessage) {
      (window as any).webkit.messageHandlers.OneEightyMobileChannel.postMessage(jsonString);
    }
    if ((window as any).webkit?.messageHandlers?.OneEightyPaymentChannel?.postMessage) {
      (window as any).webkit.messageHandlers.OneEightyPaymentChannel.postMessage(jsonString);
    }
  } catch (_) {}
}

export interface CheckoutClientProps {
  initialSessionId?: string;
  initialAmount?: number;
  onSuccess?: (newBalance?: number) => void;
  onClose?: () => void;
}

export function CheckoutClient({
  initialSessionId,
  initialAmount,
  onSuccess,
  onClose,
}: CheckoutClientProps = {}) {
  const params = useParams();
  
  // Resilient sessionId extraction for static SSG exports (Cloudflare Pages rewrites & Payment Link resolution)
  const getInitialSessionId = useCallback(() => {
    if (initialSessionId && initialSessionId !== 'default') return initialSessionId;
    const pId = (params?.sessionId || params?.slug) as string;
    if (pId && pId !== 'default') return pId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/checkout\/([^\/\?#]+)/);
      if (match && match[1] && match[1] !== 'default') return match[1];
      const matchLink = window.location.pathname.match(/\/(?:link|pay\/l)\/([^/?#]+)/i);
      if (matchLink && matchLink[1] && matchLink[1] !== 'default') return decodeURIComponent(matchLink[1]);
    }
    return pId || '';
  }, [initialSessionId, params?.sessionId, params?.slug]);

  const [sessionId, setSessionId] = useState<string>(getInitialSessionId);

  useEffect(() => {
    const currentId = getInitialSessionId();
    if (currentId && currentId !== sessionId) {
      setSessionId(currentId);
    }
  }, [getInitialSessionId]);

  const clientSessionId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSid = urlParams.get('clientSessionId');
      if (urlSid) {
        sessionStorage.setItem('180_client_session_id', urlSid);
        return urlSid;
      }
      let storedSid = sessionStorage.getItem('180_client_session_id');
      if (!storedSid) {
        storedSid = 'sess_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
        sessionStorage.setItem('180_client_session_id', storedSid);
      }
      return storedSid;
    } catch (_) {
      return '';
    }
  }, []);

  useEffect(() => {
    if (!sessionId || sessionId === 'default') return;
    try {
      fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/track-event`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'DRAWER_OPENED',
          clientSessionId: clientSessionId || undefined,
          language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
        }),
      }).catch(() => {});
    } catch (_) {}
  }, [sessionId, clientSessionId]);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState<boolean>(false);
  const [verificationStatusText, setVerificationStatusText] = useState<string>('Verifying payment...');
  const [verificationSubtext, setVerificationSubtext] = useState<string>('Confirming secure transaction with your bank & 180 Core...');
  const [verificationAttempt, setVerificationAttempt] = useState<number>(1);
  const [verificationFailedState, setVerificationFailedState] = useState<boolean>(false);
  const [verificationProgress, setVerificationProgress] = useState<number>(30);
  const savedVerifyPayloadRef = React.useRef<{
    orderId: string;
    paymentId: string;
    signature: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [showDevInspector, setShowDevInspector] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [domainError, setDomainError] = useState<{
    type?: string;
    origin?: string;
    appName?: string;
    clientId?: string;
    allowedOrigins?: string[];
    registeredUris?: string[];
    message?: string;
  } | null>(null);

  useEffect(() => {
    setLogoFailed(false);
  }, [session?.app?.logoUrl]);

  // ─── Custom Amount & Wallet Top-Up State ────────────────────────────────────
  const [customAmountInput, setCustomAmountInput] = useState<string>('');
  const [selectedPresetAmount, setSelectedPresetAmount] = useState<number | null>(() => {
    if (initialAmount && initialAmount > 0) return initialAmount;
    return null;
  });

  useEffect(() => {
    if (initialAmount && initialAmount > 0) {
      setSelectedPresetAmount(initialAmount);
      setCustomAmountInput('');
      prewarmedOrderRef.current = null;
      prewarmingPromiseRef.current = null;
    }
  }, [initialAmount]);

  // ─── Coupons & Promo Code State ─────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);

  // ─── Live Location & Geolocation Currency State ─────────────────────────────
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [showCountryModal, setShowCountryModal] = useState<boolean>(false);
  const [isCountrySheetVisible, setIsCountrySheetVisible] = useState<boolean>(false);
  const [countrySearch, setCountrySearch] = useState<string>('');

  // ─── Country Selection Bottom Sheet Smooth Open / Close & Drag State ────────
  const [countryDragY, setCountryDragY] = useState(0);
  const [isDraggingCountry, setIsDraggingCountry] = useState(false);
  const countryDragStartY = React.useRef(0);
  const closeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const openCountrySheet = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowCountryModal(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsCountrySheetVisible(true);
      });
    });
  }, []);

  const closeCountrySheet = useCallback(() => {
    setIsCountrySheetVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setShowCountryModal(false);
      setCountrySearch('');
      setCountryDragY(0);
      closeTimerRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    if (!isDraggingCountry) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - countryDragStartY.current;
      setCountryDragY(delta < 0 ? delta * 0.2 : delta);
    };

    const handleMouseUp = () => {
      setIsDraggingCountry(false);
      setCountryDragY((prev) => {
        if (prev > 75) {
          closeCountrySheet();
          return prev;
        }
        return 0;
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const delta = e.touches[0].clientY - countryDragStartY.current;
        setCountryDragY(delta < 0 ? delta * 0.2 : delta);
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingCountry(false);
      setCountryDragY((prev) => {
        if (prev > 75) {
          closeCountrySheet();
          return prev;
        }
        return 0;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingCountry, closeCountrySheet]);

  // Lock background scroll & handle ESC key for Country Bottom Sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCountryModal) {
        closeCountrySheet();
      }
    };
    if (showCountryModal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCountryModal, closeCountrySheet]);

  const allCountries = useMemo(() => {
    return locationService.getAllCountries();
  }, []);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return allCountries;
    const q = countrySearch.trim().toLowerCase();
    return allCountries.filter((c) => {
      const curr = currencyService.getCurrencyForCountry(c.code).toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        curr.includes(q)
      );
    });
  }, [allCountries, countrySearch]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await currencyService.fetchLiveExchangeRates();
        const loc = await locationService.detectLiveLocation();
        if (isMounted && loc) {
          setDetectedLocation(loc);
        }
      } catch (_) {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // ─── Speculative Zero-Latency Order Pre-Warming Cache ────────────────────────
  const prewarmedOrderRef = React.useRef<{
    orderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
    amount: number;
  } | null>(null);
  const prewarmingPromiseRef = React.useRef<Promise<any> | null>(null);

  // ─── Autonomous Environment Detection ──────────────────────────────────────
  const isProduction = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const explicitEnv = urlParams.get('env');
    if (explicitEnv === 'production') return true;
    if (explicitEnv === 'development') return false;

    const protocol = window.location.protocol;
    const host = (window.location.hostname || '').toLowerCase();
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.test') ||
      host.endsWith('.internal');

    return protocol === 'https:' && !isLocal;
  }, []);

  // ─── Deterministic 180 Pay Reference Code ───────────────────────────────────
  const [payReferenceCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `180-PAY-${rand}`;
  });

  const handleCopyReferenceCode = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(payReferenceCode);
      setCopiedCode(true);
      toast.success(`Reference code copied: ${payReferenceCode}`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyErrorDetails = () => {
    const payload = JSON.stringify(
      {
        referenceCode: payReferenceCode,
        sessionId,
        isProduction,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(payload);
      setCopiedDetails(true);
      toast.success('Payment error diagnostic copied');
      setTimeout(() => setCopiedDetails(false), 2000);
    }
  };

  const handleReturnToApp = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (typeof window !== 'undefined') {
      const closePayload = {
        type: '180_PAYMENT_CLOSE',
        sessionId,
        referenceCode: payReferenceCode,
        error: 'SESSION_EXPIRED',
      };
      const closePayloadPay = {
        type: '180_PAY_CLOSE',
        sessionId,
      };

      dispatchMobilePaymentEvent(closePayload);
      dispatchMobilePaymentEvent(closePayloadPay);

      if (window.parent && window.parent !== window) {
        try { window.parent.postMessage(closePayload, '*'); } catch (_) {}
        try { window.parent.postMessage(JSON.stringify(closePayload), '*'); } catch (_) {}
        try { window.parent.postMessage(closePayloadPay, '*'); } catch (_) {}
        try { window.parent.postMessage(JSON.stringify(closePayloadPay), '*'); } catch (_) {}
      }

      if (window.opener && !window.opener.closed) {
        try { window.opener.postMessage(closePayload, '*'); } catch (_) {}
        try { window.opener.postMessage(JSON.stringify(closePayload), '*'); } catch (_) {}
        try { window.opener.postMessage(closePayloadPay, '*'); } catch (_) {}
        try { window.close(); } catch (_) {}
      }

      if (session?.cancelUrl) {
        const targetCancel = formatCancelUrl(session.cancelUrl, { sessionId, status: 'cancelled' });
        window.location.href = targetCancel;
        return;
      }

      if ((!window.parent || window.parent === window) && (!window.opener || window.opener.closed)) {
        window.history.back();
      }
    }
  };

  // ─── Currency & Monetary Amount Computations ───────────────────────────────
  // Active Country Code (user chosen country overrides detected country, fallback to IN)
  const activeCountryCode = useMemo(() => {
    if (selectedCountryCode) return selectedCountryCode.toUpperCase();
    if (detectedLocation?.countryCode) return detectedLocation.countryCode.toUpperCase();
    return 'IN';
  }, [selectedCountryCode, detectedLocation]);

  const activeCountry = useMemo(() => {
    const found = locationService.getCountryByCode(activeCountryCode);
    if (found) return found;
    return {
      code: activeCountryCode,
      name: detectedLocation?.countryName || (activeCountryCode === 'IN' ? 'India' : activeCountryCode),
      dialCode: detectedLocation?.dialCode || '+91',
      flag: detectedLocation?.flag || '🌐',
    };
  }, [activeCountryCode, detectedLocation]);

  const userLocalCurrency = useMemo(() => {
    return currencyService.getCurrencyForCountry(activeCountryCode);
  }, [activeCountryCode]);

  const developerOriginalCurrency = useMemo(() => {
    return String(session?.currency || 'USD').toUpperCase();
  }, [session?.currency]);

  // Defaults automatically to user's selected country currency unless manually overridden
  const activeCurrency = useMemo(() => {
    if (selectedCurrency) return selectedCurrency.toUpperCase();
    return userLocalCurrency.toUpperCase();
  }, [selectedCurrency, userLocalCurrency]);

  const isLocalCurrencyActive = activeCurrency === userLocalCurrency.toUpperCase();

  const handleSelectCountry = (country: CountryItem) => {
    setSelectedCountryCode(country.code);
    const newCurr = currencyService.getCurrencyForCountry(country.code);
    setSelectedCurrency(newCurr);
    closeCountrySheet();
    prewarmedOrderRef.current = null;
    prewarmingPromiseRef.current = null;
    const meta = currencyService.getCurrencyMeta(newCurr);
    toast.success(`Country set to ${country.name} • ${newCurr} (${meta.symbol})`, { id: 'country-switch' });
  };

  const handleToggleCurrency = (newCurrency: string) => {
    const clean = newCurrency.toUpperCase();
    if (clean === activeCurrency) return;
    setSelectedCurrency(clean);
    prewarmedOrderRef.current = null;
    prewarmingPromiseRef.current = null;
    const meta = currencyService.getCurrencyMeta(clean);
    toast.success(`Switched currency to ${clean} (${meta.symbol})`, { id: 'curr-switch' });
  };

  const isTopUpSession = Boolean(
    sessionId?.startsWith('sess_topup_') ||
    session?.metadata?.isTopUp ||
    session?.metadata?.purpose === 'wallet_topup' ||
    session?.metadata?.type === 'topup'
  );

  const isCustomAmountAllowed = Boolean(
    isTopUpSession ||
    session?.metadata?.allowCustomAmount ||
    session?.allowCustomAmount
  );

  const quickPresets = useMemo(() => {
    if (activeCurrency === 'INR') {
      return [500, 1000, 2500, 5000];
    }
    if (['USD', 'EUR', 'GBP'].includes(activeCurrency)) {
      return [10, 25, 50, 100];
    }
    return [500, 1000, 2500, 5000].map((inr) => {
      const converted = currencyService.convert(inr, 'INR', activeCurrency);
      if (converted > 100) return Math.round(converted / 50) * 50;
      if (converted > 20) return Math.round(converted / 5) * 5;
      return Math.max(1, Math.round(converted));
    });
  }, [activeCurrency]);

  const canonicalBaseAmount = useMemo(() => {
    if (sessionId?.startsWith('sess_dev_')) {
      return sessionId.includes('_pro_') ? 5.0 : 2.0;
    }
    return null;
  }, [sessionId]);

  const rawDeveloperOriginal = useMemo(() => {
    if (canonicalBaseAmount !== null) {
      if (!session?.originalAmount || session.originalAmount > 10.0) {
        return canonicalBaseAmount;
      }
      return session.originalAmount;
    }
    return session?.originalAmount && session.originalAmount > 0
      ? session.originalAmount
      : session?.amount || (isTopUpSession ? 1000 : 0);
  }, [canonicalBaseAmount, session?.originalAmount, session?.amount, isTopUpSession]);

  const activeOriginalAmount = useMemo(() => {
    if (isCustomAmountAllowed) {
      if (customAmountInput && !isNaN(parseFloat(customAmountInput)) && parseFloat(customAmountInput) > 0) {
        return parseFloat(customAmountInput);
      }
      if (selectedPresetAmount !== null && selectedPresetAmount > 0) {
        return selectedPresetAmount;
      }
    }
    if (!rawDeveloperOriginal) return 0;
    if (activeCurrency === developerOriginalCurrency) return rawDeveloperOriginal;
    return currencyService.convert(rawDeveloperOriginal, developerOriginalCurrency, activeCurrency);
  }, [isCustomAmountAllowed, customAmountInput, selectedPresetAmount, rawDeveloperOriginal, developerOriginalCurrency, activeCurrency]);

  const activeDiscountAmount = useMemo(() => {
    if (!session?.discountAmount || session.discountAmount <= 0) {
      if (session?.couponCode === 'FREEO' || session?.amount === 0) {
        return activeOriginalAmount;
      }
      return 0;
    }

    // If 100% discount or base amount fully discounted
    if (session.amount === 0 || session.couponCode === 'FREEO' || (rawDeveloperOriginal > 0 && Math.abs(session.discountAmount - rawDeveloperOriginal) < 0.01)) {
      return activeOriginalAmount;
    }

    let converted = session.discountAmount;
    if (activeCurrency === developerOriginalCurrency) {
      converted = session.discountAmount;
    } else {
      const meta = session.metadata as any;
      if (meta?.couponOrderCurrency === activeCurrency && typeof meta?.couponDiscountInOrderCurrency === 'number') {
        converted = meta.couponDiscountInOrderCurrency;
      } else if (rawDeveloperOriginal > 0) {
        const ratio = Math.min(1, session.discountAmount / rawDeveloperOriginal);
        converted = activeOriginalAmount * ratio;
      } else {
        converted = currencyService.convert(session.discountAmount, developerOriginalCurrency, activeCurrency);
      }
    }
    // Strict safety constraint: Discount can NEVER exceed active original amount
    return Math.min(activeOriginalAmount, Math.round(converted * 100) / 100);
  }, [session?.discountAmount, session?.amount, session?.couponCode, session?.metadata, developerOriginalCurrency, activeCurrency, activeOriginalAmount, rawDeveloperOriginal]);

  const activeFinalAmount = useMemo(() => {
    return Math.max(0, Math.round((activeOriginalAmount - activeDiscountAmount) * 100) / 100);
  }, [activeOriginalAmount, activeDiscountAmount]);

  // isIndia is dynamically evaluated against the active country selection!
  const isIndia = activeCountryCode === 'IN';

  const isSupportedByGateway = useMemo(() => {
    return currencyService.isGatewaySupported(activeCurrency);
  }, [activeCurrency]);

  const chargeCurrency = useMemo(() => {
    if (isSupportedByGateway) return activeCurrency;
    return developerOriginalCurrency;
  }, [isSupportedByGateway, activeCurrency, developerOriginalCurrency]);

  const chargeAmount = useMemo(() => {
    if (chargeCurrency === activeCurrency) return activeFinalAmount;
    return Math.max(0, Math.round(currencyService.convert(activeFinalAmount, activeCurrency, chargeCurrency) * 100) / 100);
  }, [chargeCurrency, activeCurrency, activeFinalAmount]);

  // Check if current user is actively logged into a 180 Profile wallet session
  const isAuthenticatedWithWallet = Boolean(
    wallet &&
    (wallet.userId || wallet.id) &&
    typeof wallet.balance === 'number' &&
    (typeof window !== 'undefined' && Boolean(
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken')
    ))
  );

  const rawUserBalance = isAuthenticatedWithWallet ? (wallet?.balance ?? 0) : 0;
  const walletCurrency = String(wallet?.currency || 'INR').toUpperCase();
  const userBalance = useMemo(() => {
    return currencyService.convert(rawUserBalance, walletCurrency, activeCurrency);
  }, [rawUserBalance, walletCurrency, activeCurrency]);
  const hasEnoughBalance = !isTopUpSession && isAuthenticatedWithWallet && userBalance >= activeFinalAmount;

  const handleApplyCoupon = async () => {
    const trimmedCode = couponInput.trim().toUpperCase();
    if (!trimmedCode) {
      toast.error('Please enter a coupon or promo code', { id: 'coupon-toast' });
      return;
    }
    setApplyingCoupon(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('platform_auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('accessToken')
          : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/apply-coupon`), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: trimmedCode,
          couponCode: trimmedCode,
          currency: activeCurrency,
          orderAmount: activeOriginalAmount,
          customerEmail: session?.customerEmail || (wallet?.user as any)?.email || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const finalAmt = data.finalAmount !== undefined ? data.finalAmount : (data.session?.amount ?? session?.amount);
        const discountAmt = data.discountAmount !== undefined ? data.discountAmount : (data.session?.discountAmount ?? 0);
        const codeUsed = data.code || trimmedCode;

        // Reset pre-warming order cache immediately so order creates for new discounted amount
        prewarmedOrderRef.current = null;
        prewarmingPromiseRef.current = null;

        setSession((prev: any) => ({
          ...prev,
          ...(data.session || {}),
          currency: data.session?.currency || prev?.currency || 'USD',
          originalAmount: data.session?.originalAmount ?? prev?.originalAmount ?? (canonicalBaseAmount || 5.0),
          amount: data.session?.amount !== undefined ? data.session.amount : finalAmt,
          couponCode: codeUsed,
          discountAmount: data.session?.discountAmount !== undefined ? data.session.discountAmount : (data.discountAmountUSD ?? (canonicalBaseAmount || 5.0)),
          metadata: {
            ...((prev?.metadata as any) || {}),
            ...((data.session?.metadata as any) || {}),
            couponOrderCurrency: activeCurrency,
            couponDiscountInOrderCurrency: discountAmt,
            couponFinalInOrderCurrency: finalAmt,
          },
          app: prev?.app || data.session?.app,
        }));
        toast.success(
          `Coupon applied: ${codeUsed} (-${currencyService.format(discountAmt, activeCurrency)})`,
          { id: 'coupon-toast' }
        );
        setCouponInput('');
        setShowCouponInput(false);

        if (typeof window !== 'undefined') {
          const couponPayload = {
            type: '180_COUPON_APPLIED',
            sessionId,
            couponCode: codeUsed,
            discountAmount: discountAmt,
            finalAmount: finalAmt,
            currency: activeCurrency,
          };
          if (window.opener && !window.opener.closed) window.opener.postMessage(couponPayload, '*');
          if (window.parent && window.parent !== window) window.parent.postMessage(couponPayload, '*');
        }
      } else {
        toast.error(data.error || 'Invalid or expired coupon code', { id: 'coupon-toast' });
      }
    } catch {
      toast.error('Network error applying coupon', { id: 'coupon-toast' });
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      prewarmedOrderRef.current = null;
      prewarmingPromiseRef.current = null;

      const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/remove-coupon`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success && data.session) {
        setSession((prev: any) => ({
          ...prev,
          ...data.session,
          couponCode: null,
          couponId: null,
          discountAmount: 0,
          metadata: {
            ...((prev?.metadata as any) || {}),
            ...((data.session?.metadata as any) || {}),
            couponOrderCurrency: null,
            couponDiscountInOrderCurrency: 0,
            couponFinalInOrderCurrency: data.session?.amount,
          },
          app: prev?.app || data.session.app,
        }));
        toast.success('Coupon removed', { id: 'coupon-toast' });
        if (typeof window !== 'undefined') {
          const revertPayload = {
            type: '180_COUPON_REMOVED',
            sessionId,
            finalAmount: data.session.amount,
            currency: activeCurrency,
          };
          if (window.opener && !window.opener.closed) window.opener.postMessage(revertPayload, '*');
          if (window.parent && window.parent !== window) window.parent.postMessage(revertPayload, '*');
        }
      } else {
        toast.error(data.error || 'Failed to remove coupon', { id: 'coupon-toast' });
      }
    } catch {
      toast.error('Network error removing coupon', { id: 'coupon-toast' });
    }
  };

  const handlePaymentCompletion = useCallback((details: {
    transactionId?: string;
    creditedUserBalance?: number;
    fulfillment?: any;
    customReturnUrl?: string;
  } = {}) => {
    if (completed) return;
    setCompleted(true);
    setPaying(false);
    setTopupLoading(false);

    if (details.fulfillment || session?.metadata?.fulfillment) {
      setSession((prev: any) => ({
        ...prev,
        metadata: {
          ...(prev?.metadata || {}),
          fulfillment: details.fulfillment || prev?.metadata?.fulfillment,
        },
      }));
    }

    if (typeof details.creditedUserBalance === 'number') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('180_wallet_updated', { detail: { balance: details.creditedUserBalance } })
        );
      }
      if (onSuccess) {
        onSuccess(details.creditedUserBalance);
      }
    }

    const txId = details.transactionId || session?.metadata?.transactionId || 'tx_' + Math.random().toString(36).substring(2, 10);
    const liveSuccessPayload = {
      type: '180_PAYMENT_SUCCESS',
      sessionId,
      transactionId: txId,
      amount: activeFinalAmount,
      currency: activeCurrency,
      creditedUserBalance: details.creditedUserBalance,
      newBalance: details.creditedUserBalance,
    };
    const liveSuccessPayloadPay = {
      type: '180_PAY_SUCCESS',
      ...liveSuccessPayload,
    };

    if (typeof window !== 'undefined') {
      dispatchMobilePaymentEvent(liveSuccessPayload);
      dispatchMobilePaymentEvent(liveSuccessPayloadPay);
      if (window.opener) {
        window.opener.postMessage(liveSuccessPayload, '*');
        window.opener.postMessage(liveSuccessPayloadPay, '*');
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(liveSuccessPayload, '*');
        window.parent.postMessage(liveSuccessPayloadPay, '*');
      }
    }

    setTimeout(() => {
      const destUrl = details.customReturnUrl || session?.returnUrl;
      if (destUrl) {
        window.location.href = formatReturnUrl(destUrl, {
          sessionId,
          status: 'success',
          transactionId: txId,
          orderId: (session?.metadata as any)?.orderId,
          amount: activeFinalAmount,
          currency: activeCurrency,
        });
      } else if (onClose) {
        onClose();
      } else if (typeof window !== 'undefined') {
        if (window.opener) {
          window.close();
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: '180_PAYMENT_CLOSE', sessionId }, '*');
          window.parent.postMessage({ type: '180_PAY_CLOSE', sessionId }, '*');
        }
      }
    }, 1500);
  }, [completed, session, sessionId, activeFinalAmount, activeCurrency, onSuccess, onClose]);

  const checkStatusRef = React.useRef(false);
  const checkSessionStatus = useCallback(async (isSilent = true) => {
    if (!sessionId || sessionId === 'default' || completed || checkStatusRef.current) return false;
    checkStatusRef.current = true;
    try {
      const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/status`));
      if (!res.ok) return false;
      const data = await res.json();
      if (data && (data.status === 'CAPTURED' || data.status === 'COMPLETED')) {
        if (!isSilent) toast.success('Payment verified & captured!');
        handlePaymentCompletion({
          transactionId: data.transactionId,
          fulfillment: data.fulfillment,
        });
        return true;
      }
    } catch (_) {
      // Ignore background network errors during polling
    } finally {
      checkStatusRef.current = false;
    }
    return false;
  }, [sessionId, completed, handlePaymentCompletion]);

  // ─── Resilient Multi-Attempt Payment Verification Engine ─────────────────────
  const verifyPaymentWithResilience = useCallback(async (credentials: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) => {
    savedVerifyPayloadRef.current = credentials;
    setVerifyingPayment(true);
    setVerificationFailedState(false);
    setVerificationProgress(30);
    setVerificationStatusText('Verifying payment...');
    setVerificationSubtext('Securely confirming transaction with your bank & 180 Core...');

    const maxAttempts = 6;
    let attempt = 0;
    let completedSuccessfully = false;

    // Advance visual progress smoothly
    const progressTimer = setInterval(() => {
      setVerificationProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 12;
      });
    }, 600);

    try {
      while (attempt < maxAttempts && !completedSuccessfully) {
        attempt++;
        setVerificationAttempt(attempt);

        if (attempt === 2) {
          setVerificationStatusText('Verifying payment...');
          setVerificationSubtext('Connecting to 180 Sovereign Authorization Network...');
        } else if (attempt >= 3) {
          setVerificationStatusText('Verifying payment...');
          setVerificationSubtext(`Network is slower than usual — confirming with banking network (Attempt ${attempt}/${maxAttempts})...`);
        }

        // Try direct backend endpoint first, with fallback to local same-origin proxy
        const targetUrls = [
          getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/direct-verify`),
          `/api/v1/checkout/sessions/${sessionId}/direct-verify`,
        ];

        for (const targetUrl of targetUrls) {
          if (completedSuccessfully) break;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9000);

            const verifyRes = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(credentials),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              if (verifyData && verifyData.success) {
                clearInterval(progressTimer);
                setVerificationProgress(100);
                setVerificationStatusText('Payment Authorized!');
                setVerificationSubtext('Your transaction has been securely captured.');
                completedSuccessfully = true;

                setTimeout(() => {
                  setVerifyingPayment(false);
                  setTopupLoading(false);
                  handlePaymentCompletion({
                    transactionId: credentials.paymentId,
                    creditedUserBalance: verifyData.creditedUserBalance,
                    fulfillment: verifyData.fulfillment || verifyData.session?.metadata?.fulfillment,
                    customReturnUrl: verifyData.returnUrl,
                  });
                }, 750);
                return;
              }
            }
          } catch (fetchErr: any) {
            console.warn(`[180 Pay] Verify attempt ${attempt} on ${targetUrl} transient error:`, fetchErr?.message || fetchErr);
          }
        }

        // Cross-check session status in case webhook already confirmed capture
        try {
          const statusRes = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/status`));
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData && (statusData.status === 'CAPTURED' || statusData.status === 'COMPLETED')) {
              clearInterval(progressTimer);
              setVerificationProgress(100);
              setVerificationStatusText('Payment Authorized!');
              setVerificationSubtext('Transaction verified and confirmed.');
              completedSuccessfully = true;

              setTimeout(() => {
                setVerifyingPayment(false);
                setTopupLoading(false);
                handlePaymentCompletion({
                  transactionId: statusData.transactionId || credentials.paymentId,
                  fulfillment: statusData.fulfillment,
                });
              }, 750);
              return;
            }
          }
        } catch (_) {}

        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, Math.min(3000, 1000 + attempt * 500)));
        }
      }
    } finally {
      clearInterval(progressTimer);
    }

    if (!completedSuccessfully) {
      setVerificationProgress(95);
      setVerificationFailedState(true);
      setVerificationStatusText('Confirming Payment Status');
      setVerificationSubtext('Your bank has processed your payment. Reconnecting to 180 Core network to finalize your receipt.');
    }
  }, [sessionId, handlePaymentCompletion]);

  const fetchSessionAndWallet = async () => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('platform_auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('accessToken')
          : null;
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const [sessionRes, walletRes] = await Promise.all([
        fetch(getCoreApiUrl(`/api/oauth/checkout/sessions/${sessionId}`), { headers: authHeaders, credentials: 'include' }),
        fetch(getCoreApiUrl('/api/oauth/wallet'), { headers: authHeaders, credentials: 'include' }),
      ]);

      let sessionInfo: any = null;
      let caughtDomainError: any = null;
      try {
        const sessionData = await sessionRes.json();
        if (sessionData && sessionData.success) {
          sessionInfo = sessionData.data || sessionData.session;
          setDomainError(null);
        } else if (sessionData && (sessionData.error === 'forbidden_origin' || sessionData.details?.type === 'ORIGIN_NOT_ALLOWED' || sessionData.details?.type === 'REDIRECT_URI_MISMATCH')) {
          const currentOrigin = typeof window !== 'undefined' ? window.location.origin.toLowerCase() : '';
          const isPlatformHost = currentOrigin.includes('localhost:') || currentOrigin.includes('127.0.0.1:') || currentOrigin.includes('180.app') || currentOrigin.includes('180profile.com') || currentOrigin.includes('180core.cloud');
          if (!isPlatformHost) {
            caughtDomainError = {
              type: sessionData.details?.type || 'ORIGIN_NOT_ALLOWED',
              origin: sessionData.details?.origin || currentOrigin,
              appName: sessionData.details?.appName || 'Merchant Application',
              clientId: sessionData.details?.clientId,
              allowedOrigins: sessionData.details?.allowedOrigins || [],
              registeredUris: sessionData.details?.registeredUris || [],
              message: sessionData.message || sessionData.error,
            };
            setDomainError(caughtDomainError);
          }
        }
      } catch (_) {}

      // If domain whitelist error occurred, DO NOT fallback to mock sandbox parameters
      if (caughtDomainError) {
        if (typeof window !== 'undefined') {
          const lockPayload = {
            type: '180_MODAL_LOCK_CLOSE',
            reason: 'DOMAIN_NOT_WHITELISTED',
            details: caughtDomainError,
          };
          try { window.postMessage(lockPayload, '*'); } catch (_) {}
          if (window.parent && window.parent !== window) {
            try { window.parent.postMessage(lockPayload, '*'); } catch (_) {}
          }
        }
        setLoading(false);
        return;
      }

      const isSandboxSession = Boolean(
        sessionId && (
          sessionId.startsWith('sess_') ||
          sessionId.startsWith('cs_') ||
          sessionId === 'default'
        )
      );

      // Robust fallback for Sandbox / Demo / Standalone sessions
      if (!sessionInfo && isSandboxSession) {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const rawQueryAmount = urlParams?.get('amount');
        const parsedQueryAmount = rawQueryAmount !== null && rawQueryAmount !== undefined && !isNaN(parseFloat(rawQueryAmount))
          ? parseFloat(rawQueryAmount)
          : null;
        const queryAmount = parsedQueryAmount !== null
          ? parsedQueryAmount
          : (initialAmount !== undefined ? initialAmount : 0);
        const queryTitle =
          urlParams?.get('title') ||
          (sessionId.startsWith('sess_topup_')
            ? 'Top-Up Prepaid Wallet'
            : 'Order Checkout');
        const queryDesc =
          urlParams?.get('description') ||
          (sessionId.startsWith('sess_topup_')
            ? 'Universal 180 Pay Ledger Top-up'
            : 'Secure Online Checkout');
        const queryCurrency = (urlParams?.get('currency') || (sessionId.startsWith('sess_topup_') ? 'INR' : 'USD')).toUpperCase();
        const queryApp =
          urlParams?.get('appName') ||
          urlParams?.get('app') ||
          'Merchant Checkout';
        const queryReturnUrl =
          urlParams?.get('returnUrl') ||
          urlParams?.get('return_url') ||
          urlParams?.get('redirect_uri') ||
          '';
        const queryCancelUrl =
          urlParams?.get('cancelUrl') ||
          urlParams?.get('cancel_url') ||
          '';

        sessionInfo = {
          id: sessionId,
          amount: queryAmount,
          currency: queryCurrency,
          title: queryTitle,
          description: queryDesc,
          status: 'PENDING',
          returnUrl: queryReturnUrl,
          cancelUrl: queryCancelUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          metadata: {
            isTopUp: sessionId.startsWith('sess_topup_'),
            allowCustomAmount: sessionId.startsWith('sess_topup_'),
            purpose: sessionId.startsWith('sess_topup_') ? 'wallet_topup' : undefined,
          },
          app: {
            id: 'app_180core',
            name: queryApp,
            isVerified: true,
            logoUrl:
              urlParams?.get('logoUrl') ||
              'https://pub-73622b8ffeaa436d83a676e27d5739a6.r2.dev/brands/avatars/792597b3-23d2-43cb-ab5b-e375cb3ed73c/1792050853514-404966-ZeeResizer.png',
          },
        };
      }

      if (sessionInfo) {
        setSession(sessionInfo);
        if (sessionInfo.id && sessionInfo.id !== sessionId) {
          setSessionId(sessionInfo.id);
        }
        if (sessionInfo.status === 'COMPLETED' || sessionInfo.status === 'CAPTURED') {
          handlePaymentCompletion({
            transactionId: sessionInfo.metadata?.transactionId,
            fulfillment: sessionInfo.metadata?.fulfillment,
          });
        }
      } else {
        throw new Error('Failed to load checkout details');
      }

      try {
        const walletData = await walletRes.json();
        if (walletData && walletData.success) {
          setWallet(walletData.data);
        }
      } catch (_) {}
    } catch (err: any) {
      toast.error(err.message || 'Error loading payment session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSessionAndWallet();
    }
  }, [sessionId]);

  // ─── Pre-load Razorpay SDK & Preconnect to Gateways ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Preconnect DNS & SSL to Razorpay endpoints
    const addPreconnect = (href: string) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = href;
        document.head.appendChild(link);
      }
    };
    addPreconnect('https://checkout.razorpay.com');
    addPreconnect('https://api.razorpay.com');

    // 2. Pre-fetch and compile Razorpay Checkout SDK immediately into DOM
    if (!window.Razorpay && !document.querySelector('script[src*="checkout.razorpay.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // ─── Speculative Order Pre-Warming on Dwell Time (Zero Perceived Latency) ────
  useEffect(() => {
    if (!session || !sessionId || session.status === 'COMPLETED' || !activeFinalAmount) return;

    // Do not pre-warm if session is a pure mock/default or if amount is free/0
    if (!sessionId || sessionId === 'default' || sessionId.startsWith('sess_demo_') || sessionId.startsWith('sess_sandbox_')) return;
    if (activeFinalAmount <= 0 || chargeAmount <= 0) return;

    // If order already pre-warmed for current charge amount and gateway currency, reuse it
    if (
      prewarmedOrderRef.current &&
      prewarmedOrderRef.current.amount === chargeAmount &&
      prewarmedOrderRef.current.currency === chargeCurrency
    ) {
      return;
    }

    const prewarm = async () => {
      try {
        const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/direct-order`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currency: chargeCurrency,
            amount: chargeAmount,
          }),
        });
        const data = await res.json();
        if (data.success && (data.data || data.orderId)) {
          const orderInfo = data.data || data;
          const orderObj = {
            orderId: orderInfo.orderId,
            amountPaise: orderInfo.amountPaise,
            currency: orderInfo.currency || chargeCurrency,
            keyId: orderInfo.keyId,
            amount: chargeAmount,
          };
          prewarmedOrderRef.current = orderObj;
          return orderObj;
        }
      } catch (err) {
        console.warn('[180 Pay] Silent background pre-warm:', err);
      }
      return null;
    };

    prewarmingPromiseRef.current = prewarm();
  }, [chargeAmount, chargeCurrency, sessionId, isProduction]);

  const handlePay = async () => {
    setPaying(true);
    const toastId = toast.loading('Authorizing payment with 180 Profile...');

    try {
      // Only pure mock/offline demos without a backend complete directly
      const isPureDemoSession = Boolean(
        sessionId && (sessionId === 'default' || sessionId.startsWith('sess_demo_') || sessionId.startsWith('sess_sandbox_'))
      );

      if (isPureDemoSession && !isProduction) {
        await new Promise((r) => setTimeout(r, 600));
        const demoTxId = 'tx_180pay_' + Math.random().toString(36).substring(2, 10);
        toast.success('Payment completed successfully!', { id: toastId });
        setCompleted(true);
        setPaying(false);
        const successPayload = {
          type: '180_PAYMENT_SUCCESS',
          sessionId,
          transactionId: demoTxId,
          amount: session?.amount !== undefined ? session.amount : (initialAmount !== undefined ? initialAmount : 0),
          currency: (session?.currency || 'USD').toUpperCase(),
        };
        const successPayloadPay = {
          type: '180_PAY_SUCCESS',
          ...successPayload,
        };
        if (typeof window !== 'undefined') {
          dispatchMobilePaymentEvent(successPayload);
          dispatchMobilePaymentEvent(successPayloadPay);
          if (window.opener) {
            window.opener.postMessage(successPayload, '*');
            window.opener.postMessage(successPayloadPay, '*');
          }
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(successPayload, '*');
            window.parent.postMessage(successPayloadPay, '*');
          }
        }
        setTimeout(() => {
          if (session?.returnUrl) {
            window.location.href = formatReturnUrl(session.returnUrl, {
              sessionId,
              status: 'success',
              transactionId: demoTxId,
              orderId: (session.metadata as any)?.orderId,
              amount: successPayload.amount,
              currency: successPayload.currency,
            });
          } else if (typeof window !== 'undefined') {
            if (window.opener) {
              window.close();
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: '180_PAYMENT_CLOSE', sessionId }, '*');
              window.parent.postMessage({ type: '180_PAY_CLOSE', sessionId }, '*');
            }
          }
        }, 1200);
        return;
      }

      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('platform_auth_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('accessToken')
          : null;
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(getCoreApiUrl(`/api/oauth/checkout/sessions/${sessionId}/pay`), {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Payment failed');
      }

      toast.success('Payment completed successfully!', { id: toastId });
      setCompleted(true);

      const liveSuccessPayload = {
        type: '180_PAYMENT_SUCCESS',
        sessionId,
        transactionId: data.data?.transactionId,
        amount: session?.amount,
        currency: session?.currency,
      };
      const liveSuccessPayloadPay = {
        type: '180_PAY_SUCCESS',
        ...liveSuccessPayload,
      };

      // Notify mobile bridge, opener window if in popup, and parent if in bottom sheet
      if (typeof window !== 'undefined') {
        dispatchMobilePaymentEvent(liveSuccessPayload);
        dispatchMobilePaymentEvent(liveSuccessPayloadPay);
        if (window.opener) {
          window.opener.postMessage(liveSuccessPayload, '*');
          window.opener.postMessage(liveSuccessPayloadPay, '*');
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(liveSuccessPayload, '*');
          window.parent.postMessage(liveSuccessPayloadPay, '*');
        }
      }

      // Auto redirect or close after 2 seconds
      setTimeout(() => {
        const destUrl = data.data?.returnUrl || session?.returnUrl;
        if (destUrl) {
          window.location.href = formatReturnUrl(destUrl, {
            sessionId,
            status: 'success',
            transactionId: data.data?.transactionId,
            orderId: (session?.metadata as any)?.orderId,
            amount: session?.amount,
            currency: session?.currency,
          });
        } else if (typeof window !== 'undefined') {
          if (window.opener) {
            window.close();
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: '180_PAYMENT_CLOSE', sessionId }, '*');
            window.parent.postMessage({ type: '180_PAY_CLOSE', sessionId }, '*');
          }
        }
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Payment authorization failed', { id: toastId });
    } finally {
      setPaying(false);
    }
  };

  const handleDirectPayment = async () => {
    if (!session || topupLoading) return;

    // Free promotional checkout (100% off coupon / 0 charge)
    if (activeFinalAmount <= 0) {
      setTopupLoading(true);
      const toastId = 'direct-pay-action';
      toast.loading('Completing promotional free checkout...', { id: toastId });
      try {
        const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/direct-execute`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: 'PROMO_FREE',
            customerEmail: session?.customerEmail || (wallet?.user as any)?.email,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Promotional checkout completed successfully!', { id: toastId });
          if (data.fulfillment || data.session?.metadata?.fulfillment) {
            setSession((prev: any) => ({
              ...prev,
              metadata: {
                ...(prev?.metadata || {}),
                fulfillment: data.fulfillment || data.session?.metadata?.fulfillment,
              },
            }));
          }
          setCompleted(true);
          setTopupLoading(false);
          const txId = data.transactionId || 'tx_free_' + Math.random().toString(36).substring(2, 10);
          const payload = {
            type: '180_PAYMENT_SUCCESS',
            sessionId,
            transactionId: txId,
            amount: 0,
            currency: activeCurrency,
          };
          if (typeof window !== 'undefined') {
            if (window.opener) window.opener.postMessage(payload, '*');
            if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
            setTimeout(() => {
              if (session?.returnUrl) {
                window.location.href = session.returnUrl;
              } else if (window.opener) {
                window.close();
              }
            }, 1500);
          }
          return;
        } else {
          throw new Error(data.error || 'Failed to complete free promotional checkout');
        }
      } catch (err: any) {
        toast.error(err.message || 'Free checkout error', { id: toastId });
        setTopupLoading(false);
        return;
      }
    }

    const isSandboxEnv = !isProduction || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('env') === 'sandbox');
    const isSandboxSession = Boolean(
      sessionId && (
        sessionId.startsWith('sess_') ||
        sessionId.startsWith('cs_') ||
        sessionId === 'default'
      )
    );
    const isPureDemoSession = Boolean(
      sessionId && (
        sessionId === 'default' ||
        sessionId.startsWith('sess_demo_') ||
        sessionId.startsWith('sess_sandbox_') ||
        (isSandboxSession && (
          session?.description?.toLowerCase().includes('sandbox') ||
          session?.description?.toLowerCase().includes('demo') ||
          session?.title?.toLowerCase().includes('sandbox') ||
          session?.title?.toLowerCase().includes('demo')
        ))
      )
    );

    // In pure sandbox demo without backend, complete directly
    if (isPureDemoSession && isSandboxEnv) {
      setTopupLoading(true);
      const toastId = 'direct-pay-action';
      toast.loading('Initializing demo payment...', { id: toastId });
      await new Promise((r) => setTimeout(r, 400));
      toast.success('Payment completed successfully!', { id: toastId });
      setCompleted(true);
      setTopupLoading(false);
      const demoTxId = 'tx_direct_' + Math.random().toString(36).substring(2, 10);
      const payload = {
        type: '180_PAYMENT_SUCCESS',
        sessionId,
        transactionId: demoTxId,
        amount: session?.amount,
        currency: session?.currency || 'INR',
      };
      if (typeof window !== 'undefined') {
        if (window.opener) window.opener.postMessage(payload, '*');
        if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
        setTimeout(() => {
          if (session?.returnUrl) {
            window.location.href = session.returnUrl;
          } else if (window.opener) {
            window.close();
          }
        }, 1500);
      }
      return;
    }

    let orderInfo = prewarmedOrderRef.current;
    const directToastId = 'direct-pay-action';

    // Zero-Latency Path: If order was pre-warmed during user dwell time, consume immediately!
    // Otherwise fallback smoothly to awaiting in-flight prewarm or requesting order
    if (
      !orderInfo ||
      orderInfo.amount !== chargeAmount ||
      orderInfo.currency !== chargeCurrency
    ) {
      setTopupLoading(true);
      toast.loading('Opening payment gateway...', { id: directToastId });
      try {
        if (prewarmingPromiseRef.current) {
          orderInfo = await prewarmingPromiseRef.current;
        }
        if (
          !orderInfo ||
          orderInfo.amount !== chargeAmount ||
          orderInfo.currency !== chargeCurrency
        ) {
          const res = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/direct-order`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currency: chargeCurrency,
              amount: chargeAmount,
              title: session?.title,
              description: session?.description,
              appId: session?.app?.id || session?.appId,
              returnUrl: session?.returnUrl,
              cancelUrl: session?.cancelUrl,
              metadata: session?.metadata,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to initialize payment gateway');
          }
          orderInfo = data.data || data;
          prewarmedOrderRef.current = {
            orderId: orderInfo.orderId,
            amountPaise: orderInfo.amountPaise,
            currency: orderInfo.currency || chargeCurrency,
            keyId: orderInfo.keyId,
            amount: chargeAmount,
          };
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to prepare payment', { id: directToastId });
        setTopupLoading(false);
        return;
      }
    }

    // Ensure Razorpay SDK is available
    if (!window.Razorpay) {
      setTopupLoading(true);
      toast.loading('Opening payment gateway...', { id: directToastId });
      try {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[src*="checkout.razorpay.com"]') as HTMLScriptElement;
          if (existing) {
            if ((window as any).Razorpay) return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
            setTimeout(resolve, 1000);
          } else {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Razorpay payment engine'));
            document.head.appendChild(script);
          }
        });
      } catch (err: any) {
        toast.error(err.message, { id: directToastId });
        setTopupLoading(false);
        return;
      }
    }

    try {
      const { orderId, amountPaise, keyId, currency: orderCurrency } = orderInfo!;

      let storedUser: any = null;
      try {
        storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      } catch (_) {}

      let rzpInstance: any = null;
      let pollInterval: any = null;
      let cleanupListeners: (() => void) | null = null;

      const stopPolling = () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (cleanupListeners) {
          cleanupListeners();
          cleanupListeners = null;
        }
      };

      const startPolling = () => {
        stopPolling();
        pollInterval = setInterval(async () => {
          const isDone = await checkSessionStatus(true);
          if (isDone) {
            stopPolling();
            try { rzpInstance?.close?.(); } catch (_) {}
          }
        }, 2500);

        const onVisibilityChange = async () => {
          if (document.visibilityState === 'visible') {
            const isDone = await checkSessionStatus(true);
            if (isDone) {
              stopPolling();
              try { rzpInstance?.close?.(); } catch (_) {}
            }
          }
        };

        const onWindowFocus = async () => {
          const isDone = await checkSessionStatus(true);
          if (isDone) {
            stopPolling();
            try { rzpInstance?.close?.(); } catch (_) {}
          }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onWindowFocus);

        cleanupListeners = () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
          window.removeEventListener('focus', onWindowFocus);
        };
      };

      // Exact parameter match: options.amount and options.currency match the server order 100%
      const options: any = {
        key: keyId,
        amount: amountPaise,
        currency: orderCurrency || chargeCurrency,
        name: session.app?.name || '180 Pay Secure Checkout',
        description: session.title || 'Direct Checkout',
        image: session.app?.logoUrl || undefined,
        order_id: orderId,
        theme: { color: '#2563eb' },
        prefill: {
          name: storedUser?.name || undefined,
          email: storedUser?.email || undefined,
        },
        ...(!isIndia ? {
          method: {
            card: true,
            upi: false,
            netbanking: false,
            wallet: false,
            emi: false,
            paylater: false,
          },
        } : {}),
        handler: async function (response: any) {
          stopPolling();
          toast.dismiss(directToastId);
          verifyPaymentWithResilience({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: async () => {
            toast.dismiss(directToastId);
            if (verifyingPayment || savedVerifyPayloadRef.current) {
              // Payment was captured at gateway and verification is active; do not cancel or show dismissed!
              return;
            }
            setTopupLoading(false);
            // Polling check: did the user complete payment in UPI app before returning and dismissing?
            const isDone = await checkSessionStatus(false);
            stopPolling();
            if (!isDone && sessionId && sessionId !== 'default') {
              fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/track-event`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'GATEWAY_DISMISSED', clientSessionId: clientSessionId || undefined }),
              }).catch(() => {});
            }
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzpInstance = rzp;
      rzp.on('payment.failed', function (resp: any) {
        stopPolling();
        const desc = resp.error?.description || resp.error?.reason || 'Payment failed or declined.';
        toast.error(desc);
        setTopupLoading(false);
      });
      rzp.open();
      startPolling();

      if (sessionId && sessionId !== 'default') {
        fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/track-event`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'GATEWAY_OPENED', clientSessionId: clientSessionId || undefined }),
        }).catch(() => {});
      }
      toast.dismiss(directToastId);
      setTopupLoading(false);
    } catch (err: any) {
      toast.error(err.message || 'Payment gateway initialization failed', { id: directToastId });
      setTopupLoading(false);
    }
  };


  if (loading) {
    return <AdaptiveSkeleton screen="checkout" />;
  }

  if (completed) {
    const fulfillment = session?.metadata?.fulfillment;
    return (
      <div 
        role="alert" 
        aria-live="assertive"
        className="w-full py-12 text-center space-y-5 animate-in zoom-in-95 font-sans"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto animate-bounce shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Payment Authorized!</h2>
          <p className="text-xs text-slate-600">
            {currencyService.format(activeFinalAmount, activeCurrency)} paid to <strong className="text-slate-900">{session?.app?.name}</strong>.
          </p>
        </div>

        {/* Fulfillment Secret Message / License Key */}
        {fulfillment?.fulfillmentMessage && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 text-left space-y-2 max-w-sm mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Digital Access / License Key
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fulfillment.fulfillmentMessage);
                  toast.success('Copied to clipboard');
                }}
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-white font-mono text-xs text-slate-800 select-all break-all border border-slate-200">
              {fulfillment.fulfillmentMessage}
            </div>
          </div>
        )}

        {/* Fulfillment Download File */}
        {fulfillment?.fulfillmentFileUrl && (
          <div className="pt-2 max-w-sm mx-auto">
            <a
              href={fulfillment.fulfillmentFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20"
            >
              <Download className="w-4 h-4" />
              Download Digital Asset
            </a>
          </div>
        )}

        {/* Redirect to store / merchant */}
        {fulfillment?.redirectUrl ? (
          <div className="pt-1">
            <a
              href={fulfillment.redirectUrl}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-semibold"
            >
              <span>Continue to {session?.app?.name || 'Merchant'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Redirecting back to application...</p>
        )}
      </div>
    );
  }

  // ─── STRICT UNWHITELISTED DOMAIN ERROR SCREEN (NO CLOSE OPTION) ─────────
  if (domainError) {
    return (
      <div 
        role="alert" 
        aria-live="assertive"
        className="w-full py-4 space-y-5 font-sans text-left animate-in zoom-in-95"
      >
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-900 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
                  180 PAY DEV DIAGNOSTIC
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  {domainError.type || 'ORIGIN_NOT_ALLOWED'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                Domain / Origin Not Whitelisted
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                The domain &apos;{domainError.origin}&apos; is not registered for application &apos;{domainError.appName || 'Merchant'}&apos;{domainError.clientId ? ` (${domainError.clientId})` : ''}.
              </p>
            </div>
          </div>
        </div>

        {/* Diagnostics Summary */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              Diagnostics Summary
            </span>
            <button
              type="button"
              onClick={handleCopyErrorDetails}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              {copiedDetails ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Details</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">REFERENCE CODE</span>
            <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-blue-700 font-bold break-all select-all">
              {payReferenceCode}
            </code>
          </div>

          {domainError.clientId && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">CLIENT ID</span>
              <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-slate-700 break-all select-all">
                {domainError.clientId}
              </code>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold">UNREGISTERED DOMAIN / ORIGIN</span>
            <code className="bg-rose-50/80 border border-rose-200 px-2 py-1 rounded font-mono text-[11px] text-rose-700 break-all select-all font-semibold">
              {domainError.origin || 'N/A'}
            </code>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
              CURRENTLY ALLOWED DOMAINS ({domainError.allowedOrigins?.length || 0})
            </span>
            {domainError.allowedOrigins && domainError.allowedOrigins.length > 0 ? (
              <div className="bg-white rounded border border-slate-200 p-2 space-y-1">
                {domainError.allowedOrigins.map((ao: string, idx: number) => (
                  <div key={idx} className="font-mono text-[11px] text-slate-700 flex items-center gap-1.5">
                    <span className="text-slate-400">•</span> {ao}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded border border-slate-200 p-2 font-mono text-[11px] text-slate-400 italic">
                None registered yet
              </div>
            )}
          </div>
        </div>

        {/* How to Fix This */}
        <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-blue-950">How to Fix This</p>
            <p className="text-blue-800/90 leading-relaxed text-[11px]">
              Add &apos;{domainError.origin}&apos; to the Allowed Web Origins list of &apos;{domainError.appName || 'Application'}&apos; in your 180 Developer Portal.
            </p>
          </div>
        </div>

        {/* Action Controls - STRICTLY NO CLOSE OPTION */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={fetchSessionAndWallet}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer shadow-xs min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-verify</span>
          </button>

          <a
            href={isProduction ? 'https://developer.180core.cloud' : 'http://localhost:3008'}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs min-h-[38px]"
          >
            <span>Developer Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (!session) {
    // ─── 1. PRODUCTION MODE: Enterprise Clean Fallback Screen ───────────────
    if (isProduction && !showDevInspector) {
      return (
        <div 
          role="alert" 
          aria-live="assertive"
          className="w-full py-10 text-center space-y-6 font-sans animate-in zoom-in-95"
        >
          {/* Brand & Security Status */}
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Unable to process payment
            </h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              Your card, wallet, or bank account has <strong className="text-slate-900 font-bold">NOT</strong> been charged. Please try again or return to the application.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={fetchSessionAndWallet}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer shadow-sm min-h-[42px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>

            <button
              type="button"
              onClick={handleReturnToApp}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.99] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[42px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Application</span>
            </button>
          </div>

          {/* Reference Code Telemetry Box */}
          <div className="pt-2 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block">
                  Reference Code
                </span>
                <span className="text-xs font-mono font-bold text-slate-900 select-all">
                  {payReferenceCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReferenceCode}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Subtle Dev Expander */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowDevInspector(true)}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-700 flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              <span>Developer Diagnostics</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }

    // ─── 2. DEVELOPMENT MODE: Full Payment Diagnostic Inspector ────────────
    return (
      <div 
        role="alert" 
        aria-live="assertive"
        className="w-full py-4 space-y-5 font-sans text-left animate-in zoom-in-95"
      >
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-900 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
                  180 Pay Dev Diagnostic
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  INVALID_SESSION
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                Checkout Session Not Found or Expired
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                The session identifier was not recognized or has exceeded its validity window.
              </p>
            </div>
          </div>
        </div>

        {/* Diagnostics Box */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              Session Diagnostics
            </span>
            <button
              type="button"
              onClick={handleCopyErrorDetails}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              {copiedDetails ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Details</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Reference Code</span>
            <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-blue-700 font-bold break-all select-all">
              {payReferenceCode}
            </code>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold">Session ID</span>
            <code className="bg-rose-50/80 border border-rose-200 px-2 py-1 rounded font-mono text-[11px] text-rose-700 break-all select-all font-semibold">
              {sessionId || 'N/A'}
            </code>
          </div>
        </div>

        {/* Resolution Guide Callout */}
        <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-blue-950">Local Testing Recommendation</p>
            <p className="text-blue-800/90 leading-relaxed text-[11px]">
              For local sandbox testing, ensure your session prefix starts with <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-blue-900">sess_sandbox_</code> or verify your checkout server endpoint in the{' '}
              <a
                href={isProduction ? 'https://developer.180core.cloud' : 'http://localhost:3008'}
                target="_blank"
                rel="noreferrer"
                className="font-bold underline hover:text-blue-950 inline-flex items-center gap-0.5"
              >
                180 Developer Portal <ExternalLink className="w-2.5 h-2.5 inline" />
              </a>.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={fetchSessionAndWallet}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer shadow-xs min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Fetch</span>
          </button>

          <a
            href={isProduction ? 'https://developer.180core.cloud' : 'http://localhost:3008'}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer shadow-xs min-h-[38px]"
          >
            <span>Developer Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={handleReturnToApp}
            className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.99] font-bold text-xs transition-all cursor-pointer min-h-[38px]"
          >
            Close
          </button>
        </div>

        {isProduction && showDevInspector ? (
          <button
            type="button"
            onClick={() => setShowDevInspector(false)}
            className="text-[11px] font-medium text-slate-600 hover:text-slate-700 flex items-center justify-center gap-1 mx-auto transition-colors pt-1"
          >
            <ChevronUp className="w-3 h-3" />
            <span>Switch to Standard View</span>
          </button>
        ) : null}
      </div>
    );
  }

  const isSandbox = Boolean(
    sessionId && (
      sessionId.startsWith('sess_sandbox_') ||
      sessionId.startsWith('sess_demo_') ||
      sessionId.startsWith('sess_180pay_') ||
      sessionId.startsWith('sess_dev_') ||
      sessionId.startsWith('cs_') ||
      sessionId === 'default'
    )
  );

  const isDeveloperBilling = Boolean(
    sessionId?.startsWith('sess_dev_') ||
    session?.metadata?.source === 'DEVELOPER_PORTAL_BILLING' ||
    session?.title?.toLowerCase().includes('180 core') ||
    session?.title?.toLowerCase().includes('developer portal')
  );

  const vendorDisplayName = isTopUpSession
    ? '180 Pay'
    : isDeveloperBilling
    ? '180 Core'
    : (session.app?.name || 'Merchant');

  const vendorSubtitle = isTopUpSession
    ? 'Universal Prepaid Wallet'
    : isDeveloperBilling
    ? 'Official Platform Subscription'
    : 'Verified Merchant';

  return (
    <div className="w-full space-y-5 text-slate-900 dark:text-zinc-100 font-sans antialiased">
      {/* Vendor Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 min-w-[44px] min-h-[44px] max-w-[44px] max-h-[44px] rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1px] shadow-xs shrink-0 overflow-hidden">
            <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center font-bold text-blue-700 dark:text-blue-400 text-xs overflow-hidden">
              {session.app?.logoUrl && !logoFailed ? (
                <img
                  src={session.app.logoUrl}
                  alt={vendorDisplayName}
                  className="w-full h-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : isTopUpSession ? (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 rounded-2xl flex items-center justify-center text-white">
                  <Wallet className="w-5 h-5" />
                </div>
              ) : isDeveloperBilling ? (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center font-black text-white text-xs tracking-tighter">
                  180
                </div>
              ) : (
                <span>{session.app?.name ? session.app.name.slice(0, 2).toUpperCase() : 'ME'}</span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 tracking-tight truncate">
              {vendorDisplayName}
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">{vendorSubtitle}</span>
          </div>
        </div>

        {/* Country & Currency Selector Trigger (In place of Verified badge) */}
        <button
          type="button"
          onClick={openCountrySheet}
          className="group px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shadow-2xs shrink-0"
          title="Click to select billing country and currency"
        >
          <span className="text-base leading-none">{activeCountry.flag}</span>
          <span className="max-w-[100px] sm:max-w-[140px] truncate">{activeCountry.name}</span>
          <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400">
            {activeCurrency}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
        </button>
      </div>

      {/* Item Summary */}
      <div className="bg-white dark:bg-zinc-900/70 rounded-2xl p-4 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">{session.title}</h2>
              {(session.mode === 'subscription' || session.metadata?.isSubscription) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
                  Recurring {session.billingInterval || 'Monthly'}
                </span>
              )}
            </div>
            {session.description && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{session.description}</p>
            )}
            {(session.mode === 'subscription' || session.metadata?.isSubscription) && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                Auto-renews every {session.billingInterval === 'YEARLY' ? 'year' : 'month'}. Cancel anytime.
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                {currencyService.format(activeFinalAmount, activeCurrency)}
              </span>
              {activeDiscountAmount > 0 && (
                <span className="text-xs text-slate-400 dark:text-zinc-500 line-through font-mono">
                  {currencyService.format(activeOriginalAmount, activeCurrency)}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-mono mt-0.5">
              {activeCurrency} {(session.mode === 'subscription' || session.metadata?.isSubscription) ? '/ mo' : ''}
            </div>
            {!isSupportedByGateway && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                Billed as {currencyService.format(chargeAmount, chargeCurrency)} via Card
              </div>
            )}
            {isSupportedByGateway && activeCurrency !== developerOriginalCurrency && (
              <div className="text-[10.5px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                ≈ {currencyService.format(rawDeveloperOriginal, developerOriginalCurrency)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Country Selection Bottom Sheet */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
          {/* Backdrop with Fade In / Fade Out */}
          <div
            onClick={closeCountrySheet}
            className={`fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs transition-opacity duration-300 ease-out ${
              isCountrySheetVisible ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Bottom Sheet Drawer with Smooth Slide Up / Slide Down Animation */}
          <div
            style={{
              transform: !isCountrySheetVisible
                ? 'translateY(100%)'
                : isDraggingCountry
                ? `translateY(${Math.max(0, countryDragY)}px)`
                : 'translateY(0)',
              transition: isDraggingCountry
                ? 'none'
                : isCountrySheetVisible
                ? 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
                : 'transform 0.28s cubic-bezier(0.32, 0, 0.67, 0)',
              willChange: 'transform',
            }}
            className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[32px] border-t border-slate-200/90 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden p-5 sm:p-6 pb-7 sm:pb-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-country-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tactile Drag Handle Bar */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                countryDragStartY.current = e.clientY;
                setIsDraggingCountry(true);
              }}
              onTouchStart={(e) => {
                if (e.touches && e.touches[0]) {
                  countryDragStartY.current = e.touches[0].clientY;
                  setIsDraggingCountry(true);
                }
              }}
              className="flex justify-center -mt-2 pt-1 pb-3 cursor-grab active:cursor-grabbing touch-none select-none"
              title="Drag down to close"
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700 transition-all hover:bg-slate-400 dark:hover:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Globe className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 id="billing-country-sheet-title" className="text-sm font-bold text-slate-900 dark:text-white">
                    Select Billing Country
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Choose any country to convert prices and load regional payment methods.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCountrySheet}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative pt-3 pb-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country name, ISO code, or currency..."
                className="w-full pl-9 pr-12 py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
                autoFocus
              />
              {countrySearch && (
                <button
                  type="button"
                  onClick={() => setCountrySearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Pick Popular Regions */}
            {!countrySearch && (
              <div className="space-y-1.5 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    Popular Regions
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Quick selection</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: 'IN', label: 'India' },
                    { code: 'NP', label: 'Nepal' },
                    { code: 'US', label: 'United States' },
                    { code: 'GB', label: 'United Kingdom' },
                    { code: 'AE', label: 'UAE' },
                    { code: 'CA', label: 'Canada' },
                    { code: 'AU', label: 'Australia' },
                    { code: 'DE', label: 'Germany' },
                    { code: 'SG', label: 'Singapore' },
                  ].map((pop) => {
                    const c = locationService.getCountryByCode(pop.code);
                    if (!c) return null;
                    const curr = currencyService.getCurrencyForCountry(c.code);
                    const isSelected = activeCountryCode === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleSelectCountry(c)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-700/60'
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-blue-100 font-bold' : 'text-slate-400 dark:text-zinc-500'}`}>
                          ({curr})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scrollable List of All Countries */}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1 divide-y divide-slate-100 dark:divide-zinc-800/60 min-h-[160px] max-h-[300px] sm:max-h-[340px] mt-1 overscroll-contain">
              {filteredCountries.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                  No countries found matching "{countrySearch}"
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const curr = currencyService.getCurrencyForCountry(c.code);
                  const isSelected = activeCountryCode === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountry(c)}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-bold border border-blue-200/60 dark:border-blue-900/40'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{c.flag}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate text-slate-900 dark:text-zinc-100">{c.name}</div>
                          <div className="text-[10.5px] text-slate-400 dark:text-zinc-500">
                            {c.code} • Dial {c.dialCode}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                        }`}>
                          {curr}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchasing Power Parity (PPP) Banner */}
      {(session.metadata?.pppApplied || session.geoPricing || session.metadata?.isPpp) && (
        <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 bg-gradient-to-r from-indigo-50/90 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/30 p-3.5 flex items-center justify-between text-xs text-indigo-950 dark:text-indigo-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-400/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold block">Purchasing Power Parity</span>
              <span className="text-indigo-800/90 dark:text-indigo-300/80 text-[11px]">
                Regional fair price applied for your country
              </span>
            </div>
          </div>
          <span className="bg-indigo-600 dark:bg-indigo-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px] tracking-wide">
            PPP ACTIVE
          </span>
        </div>
      )}

      {/* Wallet Balance Status for Top-Up */}
      {isTopUpSession && (
        <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-zinc-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
                Current Available Balance:
              </span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 font-mono">
                {currencyService.format(userBalance, activeCurrency)} {activeCurrency}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
              Universal 180 Pay Ledger
            </span>
          </div>
        </div>
      )}

      {/* Select Amount & Custom Amount Selector */}
      {isCustomAmountAllowed && (
        <div className="bg-white dark:bg-zinc-900/70 rounded-2xl p-4 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3.5">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-2">
              Select Amount ({activeCurrency})
            </label>
            <div className="grid grid-cols-4 gap-2">
              {quickPresets.map((amt) => {
                const isSelected =
                  (!customAmountInput && selectedPresetAmount === amt) ||
                  (!customAmountInput && selectedPresetAmount === null && activeOriginalAmount === amt);
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedPresetAmount(amt);
                      setCustomAmountInput('');
                      prewarmedOrderRef.current = null;
                      prewarmingPromiseRef.current = null;
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 hover:border-blue-400'
                    }`}
                  >
                    +{currencyService.format(amt, activeCurrency)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1.5">
              Or Enter Custom Amount
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-zinc-500 text-xs font-mono">
                {currencyService.getCurrencyMeta(activeCurrency).symbol || '₹'}
              </span>
              <input
                type="number"
                min="10"
                step="any"
                value={customAmountInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomAmountInput(val);
                  setSelectedPresetAmount(null);
                  prewarmedOrderRef.current = null;
                  prewarmingPromiseRef.current = null;
                }}
                placeholder="e.g. 1500"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                {isTopUpSession ? 'Total to Recharge' : 'Total to Pay'}
              </span>
              <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                Zero platform processing fees
              </span>
            </div>
            <div className="text-right">
              <span className="text-base sm:text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {currencyService.format(activeFinalAmount, activeCurrency)} {activeCurrency}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Coupon / Promo Code Box */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 p-3.5 space-y-2 shadow-2xs">
        {session.couponCode ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
              <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Promo code: <strong className="font-mono text-emerald-950 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">{session.couponCode}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                -{currencyService.format(activeDiscountAmount, activeCurrency)}
              </span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Remove coupon"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            {!showCouponInput ? (
              <button
                type="button"
                onClick={() => setShowCouponInput(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Have a coupon or promo code?</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-in fade-in duration-150">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="ENTER PROMO CODE"
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-slate-900 dark:text-zinc-100 uppercase placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={applyingCoupon || !couponInput.trim()}
                  onClick={handleApplyCoupon}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 shrink-0 cursor-pointer"
                >
                  {applyingCoupon ? 'Applying...' : 'Apply'}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCouponInput(false);
                    setCouponInput('');
                  }}
                  className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xs px-1 cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Options: Wallet (Only if Authenticated) OR Direct Checkout Badges */}
      {!isTopUpSession && (
        isAuthenticatedWithWallet ? (
          <div className="rounded-2xl p-4 border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 font-medium">
                <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                180 Wallet Balance:
              </span>
              <span className="font-bold text-slate-900 dark:text-zinc-100">
                {currencyService.format(userBalance, activeCurrency)}
              </span>
            </div>

            {hasEnoughBalance ? (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                <span>Balance after payment:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {currencyService.format(userBalance - activeFinalAmount, activeCurrency)}
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-slate-200/70 dark:border-zinc-700/60 flex items-center justify-between">
                <span>{isIndia ? 'Pay remaining with UPI / Cards:' : 'Pay remaining with Card:'}</span>
                <span className="font-bold text-slate-900 dark:text-zinc-200">
                  {currencyService.format(Math.max(0, activeFinalAmount - userBalance), activeCurrency)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-3.5 border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-zinc-300 font-semibold flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Accepted Payment Methods
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Instant Checkout
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {isIndia ? (
                <>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10.5px] font-medium border border-slate-200/50 dark:border-zinc-700/50">
                    UPI (GPay / PhonePe / Paytm / QR)
                  </span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10.5px] font-medium border border-slate-200/50 dark:border-zinc-700/50">
                    Credit & Debit Cards (RuPay / Visa / Mastercard)
                  </span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10.5px] font-medium border border-slate-200/50 dark:border-zinc-700/50">
                    Netbanking (All Indian Banks)
                  </span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10.5px] font-medium border border-slate-200/50 dark:border-zinc-700/50">
                    Wallets & EMI
                  </span>
                </>
              ) : (
                <>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10.5px] font-medium border border-slate-200/50 dark:border-zinc-700/50">
                    Credit & Debit Cards (Visa / Mastercard / 3D Secure)
                  </span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md text-[10.5px] font-medium border border-slate-200/50 dark:border-zinc-700/50">
                    International Online Cards
                  </span>
                </>
              )}
            </div>
          </div>
        )
      )}

      {/* Actions */}
      <div className="space-y-2.5 pt-1">
        {activeFinalAmount <= 0 ? (
          <Button
            onClick={handleDirectPayment}
            disabled={topupLoading || paying}
            className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {topupLoading
                ? 'Activating Free Subscription...'
                : session.mode === 'subscription' || session.metadata?.isSubscription || sessionId?.startsWith('sess_dev_')
                ? 'Claim Free Subscription (100% Off)'
                : 'Complete Free Order'}
            </span>
          </Button>
        ) : isTopUpSession ? (
          <>
            <Button
              onClick={handleDirectPayment}
              disabled={topupLoading || paying || activeFinalAmount <= 0}
              className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {topupLoading
                  ? 'Opening Payment Gateway...'
                  : `Pay ${currencyService.format(activeFinalAmount, activeCurrency)}`}
              </span>
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                End-to-End Encrypted
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Razorpay Verified (UPI / Cards / Netbanking)
              </span>
            </div>
          </>
        ) : hasEnoughBalance ? (
          <>
            <Button
              onClick={handlePay}
              disabled={paying || topupLoading}
              className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Lock className="w-4 h-4" />
              <span>
                {paying
                  ? 'Processing Payment...'
                  : session.mode === 'subscription' || session.metadata?.isSubscription
                  ? `Authorize Subscription (${currencyService.format(activeFinalAmount, activeCurrency)})`
                  : `Pay ${currencyService.format(activeFinalAmount, activeCurrency)} with 180 Wallet`}
              </span>
            </Button>

            <button
              type="button"
              onClick={handleDirectPayment}
              disabled={paying || topupLoading}
              className="w-full py-2.5 min-h-[42px] rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span>
                {topupLoading
                  ? 'Opening Gateway...'
                  : isIndia
                  ? `Or Pay ${currencyService.format(activeFinalAmount, activeCurrency)} via UPI / Cards / Netbanking`
                  : `Or Pay ${currencyService.format(chargeAmount, chargeCurrency)} via International Card`}
              </span>
            </button>
          </>
        ) : (
          <Button
            onClick={handleDirectPayment}
            disabled={topupLoading || paying}
            className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <CreditCard className="w-4 h-4" />
            <span>
              {topupLoading
                ? 'Opening Payment Gateway...'
                : isIndia
                ? `Pay ${currencyService.format(activeFinalAmount, activeCurrency)} via UPI / Cards / Netbanking`
                : `Pay ${currencyService.format(chargeAmount, chargeCurrency)} via Card`}
            </span>
          </Button>
        )}

      </div>

      {/* ─── FULL-SCREEN MIRROR / GLASS BLUR PAYMENT VERIFICATION OVERLAY ─── */}
      {verifyingPayment && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 select-none overflow-hidden"
        >
          {/* Ethereal Glow Mirror Backdrop */}
          <div className="absolute w-80 h-80 rounded-full bg-blue-500/15 blur-3xl -z-10 animate-pulse pointer-events-none" />

          {/* Glowing 180 Core Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 shadow-2xl flex items-center justify-center p-3.5 backdrop-blur-md relative z-10">
              <OneEightyCoreLogo
                variant="icon"
                theme="dark"
                height={48}
                width={48}
                className="animate-pulse"
              />
            </div>
            <div className="absolute inset-0 rounded-3xl bg-blue-500/25 blur-xl animate-ping opacity-30" />
          </div>

          {/* Heading */}
          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
            {verificationStatusText}
          </h3>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-zinc-300 max-w-sm mx-auto leading-relaxed mb-6">
            {verificationSubtext}
          </p>

          {/* Animated Progress Bar */}
          <div className="w-64 max-w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative shadow-inner mb-4">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500 ease-out shadow-[0_0_14px_rgba(59,130,246,0.7)]"
              style={{ width: `${verificationProgress}%` }}
            />
          </div>

          {/* Live Action Badges or Reassurance Retry */}
          {verificationFailedState ? (
            <div className="space-y-3 mt-2 animate-in zoom-in-95">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Slow connection • Your money is safe</span>
              </div>
              <div>
                <Button
                  onClick={() => {
                    if (savedVerifyPayloadRef.current) {
                      verifyPaymentWithResilience(savedVerifyPayloadRef.current);
                    } else {
                      checkSessionStatus(false);
                    }
                  }}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Check Payment Status
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-2 font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Bank Authorization in Progress • Do Not Close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default CheckoutClient;

