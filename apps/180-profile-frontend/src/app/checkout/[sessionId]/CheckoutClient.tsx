'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Lock,
  Sparkles,
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
  X,
} from 'lucide-react';
import { Button, LogoLoader, AILogoIcon } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';
import { locationService, DetectedLocation } from '@/lib/location-service';
import { currencyService } from '@/lib/currency-service';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function CheckoutClient({ initialSessionId }: { initialSessionId?: string } = {}) {
  const params = useParams();
  
  // Resilient sessionId extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialSessionId = () => {
    if (initialSessionId && initialSessionId !== 'default') return initialSessionId;
    const pId = params?.sessionId as string;
    if (pId && pId !== 'default') return pId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/checkout\/([^\/\?#]+)/);
      if (match && match[1] && match[1] !== 'default') return match[1];
    }
    return pId || '';
  };

  const [sessionId, setSessionId] = useState<string>(getInitialSessionId);

  useEffect(() => {
    const currentId = getInitialSessionId();
    if (currentId && currentId !== sessionId) {
      setSessionId(currentId);
    }
  }, [params?.sessionId]);

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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [showDevInspector, setShowDevInspector] = useState(false);

  // ─── Coupons & Promo Code State ─────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);

  // ─── Live Location & Geolocation Currency State ─────────────────────────────
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

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

      if ((!window.parent || window.parent === window) && (!window.opener || window.opener.closed)) {
        window.history.back();
      }
    }
  };

  // ─── Currency & Monetary Amount Computations ───────────────────────────────
  const userLocalCurrency = useMemo(() => {
    if (detectedLocation?.countryCode) {
      return currencyService.getCurrencyForCountry(detectedLocation.countryCode);
    }
    return 'INR';
  }, [detectedLocation]);

  const developerOriginalCurrency = useMemo(() => {
    return String(session?.currency || 'USD').toUpperCase();
  }, [session?.currency]);

  // Defaults automatically to user's detected local currency unless manually chosen
  const activeCurrency = useMemo(() => {
    if (selectedCurrency) return selectedCurrency.toUpperCase();
    return userLocalCurrency.toUpperCase();
  }, [selectedCurrency, userLocalCurrency]);

  const isLocalCurrencyActive = activeCurrency === userLocalCurrency.toUpperCase();

  const handleToggleCurrency = (newCurrency: string) => {
    const clean = newCurrency.toUpperCase();
    if (clean === activeCurrency) return;
    setSelectedCurrency(clean);
    prewarmedOrderRef.current = null;
    prewarmingPromiseRef.current = null;
    const meta = currencyService.getCurrencyMeta(clean);
    toast.success(`Switched currency to ${clean} (${meta.symbol})`, { id: 'curr-switch' });
  };

  const rawDeveloperOriginal = session?.originalAmount && session.originalAmount > 0
    ? session.originalAmount
    : session?.amount || 0;

  const activeOriginalAmount = useMemo(() => {
    if (!rawDeveloperOriginal) return 0;
    if (activeCurrency === developerOriginalCurrency) return rawDeveloperOriginal;
    return currencyService.convert(rawDeveloperOriginal, developerOriginalCurrency, activeCurrency);
  }, [rawDeveloperOriginal, developerOriginalCurrency, activeCurrency]);

  const activeDiscountAmount = useMemo(() => {
    if (!session?.discountAmount) return 0;
    if (activeCurrency === developerOriginalCurrency) return session.discountAmount;
    return currencyService.convert(session.discountAmount, developerOriginalCurrency, activeCurrency);
  }, [session?.discountAmount, developerOriginalCurrency, activeCurrency]);

  const activeFinalAmount = useMemo(() => {
    return Math.max(0, Math.round((activeOriginalAmount - activeDiscountAmount) * 100) / 100);
  }, [activeOriginalAmount, activeDiscountAmount]);

  const isIndia = (detectedLocation?.countryCode || '').toUpperCase() === 'IN';

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
  const hasEnoughBalance = isAuthenticatedWithWallet && userBalance >= activeFinalAmount;

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
          originalAmount: data.session?.originalAmount || prev?.originalAmount || prev?.amount,
          amount: data.session?.amount ?? finalAmt,
          couponCode: codeUsed,
          discountAmount: data.session?.discountAmount ?? 0,
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
      try {
        const sessionData = await sessionRes.json();
        if (sessionData && sessionData.success) {
          sessionInfo = sessionData.data;
        }
      } catch (_) {}

      const isSandboxSession = Boolean(
        sessionId && (
          sessionId.startsWith('sess_sandbox_') ||
          sessionId.startsWith('sess_demo_') ||
          sessionId.startsWith('sess_180pay_') ||
          sessionId.startsWith('cs_') ||
          sessionId === 'default'
        )
      );

      // Robust fallback for Sandbox / Demo / Standalone sessions
      if (!sessionInfo && isSandboxSession) {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const queryAmount = urlParams?.get('amount') ? parseFloat(urlParams.get('amount')!) : 499.0;
        const queryTitle = urlParams?.get('title') || '180 Workspace Plan';
        const queryDesc = urlParams?.get('description') || 'Secure Online Checkout';
        const queryCurrency = urlParams?.get('currency') || 'INR';
        const queryApp = urlParams?.get('appName') || urlParams?.get('app') || '180 Workspace';

        sessionInfo = {
          id: sessionId,
          amount: queryAmount,
          currency: queryCurrency,
          title: queryTitle,
          description: queryDesc,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          app: {
            id: 'app_180workspace',
            name: queryApp,
            isVerified: true,
          },
        };
      }

      if (sessionInfo) {
        setSession(sessionInfo);
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

    const isSandboxSession = Boolean(
      sessionId && (
        sessionId.startsWith('sess_sandbox_') ||
        sessionId.startsWith('sess_demo_') ||
        sessionId.startsWith('sess_180pay_') ||
        sessionId.startsWith('cs_') ||
        sessionId === 'default'
      )
    );

    if (isSandboxSession && !isProduction) return;

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
      const isSandboxSession = Boolean(
        sessionId && (
          sessionId.startsWith('sess_sandbox_') ||
          sessionId.startsWith('sess_demo_') ||
          sessionId.startsWith('sess_180pay_') ||
          sessionId.startsWith('cs_') ||
          sessionId === 'default'
        )
      );

      const isDevOrSandbox = !isProduction || isSandboxSession;

      if (isDevOrSandbox) {
        await new Promise((r) => setTimeout(r, 600));
        const demoTxId = 'tx_180pay_' + Math.random().toString(36).substring(2, 10);
        toast.success('Payment completed successfully!', { id: toastId });
        setCompleted(true);
        setPaying(false);
        const successPayload = {
          type: '180_PAYMENT_SUCCESS',
          sessionId,
          transactionId: demoTxId,
          amount: session?.amount || 499.0,
          currency: session?.currency || 'INR',
        };
        if (typeof window !== 'undefined') {
          if (window.opener) {
            window.opener.postMessage(successPayload, '*');
          }
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(successPayload, '*');
          }
        }
        setTimeout(() => {
          if (session?.returnUrl) {
            window.location.href = session.returnUrl;
          } else if (typeof window !== 'undefined') {
            if (window.opener) {
              window.close();
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: '180_PAYMENT_CLOSE', sessionId }, '*');
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

      // Notify opener window if opened in a popup or parent window if in bottom sheet
      if (typeof window !== 'undefined') {
        if (window.opener) {
          window.opener.postMessage(liveSuccessPayload, '*');
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(liveSuccessPayload, '*');
        }
      }

      // Auto redirect or close after 2 seconds
      setTimeout(() => {
        if (data.data?.returnUrl || session?.returnUrl) {
          window.location.href = data.data?.returnUrl || session.returnUrl;
        } else if (typeof window !== 'undefined') {
          if (window.opener) {
            window.close();
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: '180_PAYMENT_CLOSE', sessionId }, '*');
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
    if (!session) return;

    const isSandboxSession = Boolean(
      sessionId && (
        sessionId.startsWith('sess_sandbox_') ||
        sessionId.startsWith('sess_demo_') ||
        sessionId === 'default'
      )
    );

    // In pure sandbox demo without backend, complete directly
    if (isSandboxSession && !isProduction) {
      setTopupLoading(true);
      const toastId = toast.loading('Initializing demo payment...');
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
    let toastId: string | null = null;

    // Zero-Latency Path: If order was pre-warmed during user dwell time, consume immediately!
    // Otherwise fallback smoothly to awaiting in-flight prewarm or requesting order
    if (
      !orderInfo ||
      orderInfo.amount !== chargeAmount ||
      orderInfo.currency !== chargeCurrency
    ) {
      setTopupLoading(true);
      toastId = toast.loading('Opening payment gateway...');
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
        if (toastId) toast.error(err.message || 'Failed to prepare payment', { id: toastId });
        setTopupLoading(false);
        return;
      }
    }

    // Ensure Razorpay SDK is available
    if (!window.Razorpay) {
      if (!toastId) {
        setTopupLoading(true);
        toastId = toast.loading('Opening payment gateway...');
      }
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
        if (toastId) toast.error(err.message, { id: toastId });
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

      // Exact parameter match: options.amount and options.currency match the server order 100%
      const options: any = {
        key: keyId,
        amount: amountPaise,
        currency: orderCurrency || chargeCurrency,
        name: session.app?.name || '180 Pay Secure Checkout',
        description: session.title || 'Direct Checkout',
        order_id: orderId,
        theme: { color: '#2563eb' },
        prefill: {
          name: storedUser?.name || undefined,
          email: storedUser?.email || undefined,
        },
        ...(!isIndia ? {
          config: {
            display: {
              blocks: {
                cards: {
                  name: 'Credit & Debit Cards',
                  instruments: [{ method: 'card' }],
                },
              },
              sequence: ['block.cards'],
              preferences: { show_default_blocks: false },
            },
          },
        } : {}),
        handler: async function (response: any) {
          const verifyToastId = toast.loading('Verifying payment signature...');
          try {
            const verifyRes = await fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/direct-verify`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
              throw new Error(verifyData.error || 'Payment signature verification failed');
            }

            toast.success('Payment authorized & completed!', { id: verifyToastId });
            setCompleted(true);

            const liveSuccessPayload = {
              type: '180_PAYMENT_SUCCESS',
              sessionId,
              transactionId: response.razorpay_payment_id,
              amount: session?.amount,
              currency: session?.currency,
            };

            if (typeof window !== 'undefined') {
              if (window.opener) {
                window.opener.postMessage(liveSuccessPayload, '*');
              }
              if (window.parent && window.parent !== window) {
                window.parent.postMessage(liveSuccessPayload, '*');
              }
            }

            setTimeout(() => {
              if (verifyData.returnUrl || session?.returnUrl) {
                window.location.href = verifyData.returnUrl || session.returnUrl;
              } else if (typeof window !== 'undefined') {
                if (window.opener) {
                  window.close();
                } else if (window.parent && window.parent !== window) {
                  window.parent.postMessage({ type: '180_PAYMENT_CLOSE', sessionId }, '*');
                }
              }
            }, 1500);
          } catch (e: any) {
            toast.error(e.message || 'Payment verification failed', { id: verifyToastId });
          } finally {
            setTopupLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (toastId) toast.dismiss(toastId);
            setTopupLoading(false);
            if (sessionId && sessionId !== 'default') {
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
      rzp.open();
      if (sessionId && sessionId !== 'default') {
        fetch(getCoreApiUrl(`/api/v1/checkout/sessions/${sessionId}/track-event`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'GATEWAY_OPENED', clientSessionId: clientSessionId || undefined }),
        }).catch(() => {});
      }
      if (toastId) toast.dismiss(toastId);
      setTopupLoading(false);
    } catch (err: any) {
      if (toastId) {
        toast.error(err.message || 'Payment gateway initialization failed', { id: toastId });
      } else {
        toast.error(err.message || 'Payment gateway initialization failed');
      }
      setTopupLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="w-full py-16 text-center space-y-4 flex flex-col items-center justify-center font-sans">
        <LogoLoader size={40} className="w-10 h-10 text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading 180 Pay checkout...</p>
      </div>
    );
  }

  if (completed) {
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
        <p className="text-[11px] text-slate-500">Redirecting back to application...</p>
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
                href="http://localhost:3008"
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
            href="http://localhost:3008"
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
      sessionId.startsWith('cs_') ||
      sessionId === 'default'
    )
  );

  return (
    <div className="w-full space-y-5 text-slate-900 dark:text-zinc-100 font-sans antialiased">
      {/* Vendor Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 min-w-[44px] min-h-[44px] max-w-[44px] max-h-[44px] rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-[1px] shadow-xs shrink-0 overflow-hidden">
            <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center font-bold text-blue-700 dark:text-blue-400 text-xs overflow-hidden">
              {session.app?.logoUrl ? (
                <img
                  src={session.app.logoUrl}
                  alt={session.app.name || 'Merchant'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{session.app?.name ? session.app.name.slice(0, 2).toUpperCase() : 'ME'}</span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 tracking-tight truncate">
              {session.app?.name || 'Merchant'}
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Verified Merchant</span>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1.5 shrink-0 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Verified
        </span>
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

      {/* Dynamic Geolocation Currency Switcher */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                {isLocalCurrencyActive
                  ? `Converted for ${detectedLocation?.countryName || 'India'}`
                  : `Original ${developerOriginalCurrency} Pricing`}
              </span>
              {isLocalCurrencyActive && (
                <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                  Auto-Detected ({detectedLocation?.countryCode || 'IN'})
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 leading-tight mt-0.5">
              {isLocalCurrencyActive
                ? `1 ${developerOriginalCurrency} ≈ ${currencyService.format(currencyService.convert(1, developerOriginalCurrency, activeCurrency), activeCurrency)}. Click ${developerOriginalCurrency} to pay in developer currency.`
                : `Showing developer base price. Click ${userLocalCurrency} to pay in your local currency.`}
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-zinc-800 p-0.5 shrink-0 self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => handleToggleCurrency(userLocalCurrency)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isLocalCurrencyActive
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>{currencyService.getCurrencyMeta(userLocalCurrency).flag}</span>
            <span>{userLocalCurrency} (Local)</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleCurrency(developerOriginalCurrency)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              !isLocalCurrencyActive
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <span>{currencyService.getCurrencyMeta(developerOriginalCurrency).flag}</span>
            <span>{developerOriginalCurrency} (Original)</span>
          </button>
        </div>
      </div>

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
      {isAuthenticatedWithWallet ? (
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
              <span>Pay remaining with UPI / Cards:</span>
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
      )}

      {/* Actions */}
      <div className="space-y-2.5 pt-1">
        {hasEnoughBalance ? (
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
                ? `Pay ${currencyService.format(activeFinalAmount, activeCurrency)} via UPI / Cards`
                : `Pay ${currencyService.format(chargeAmount, chargeCurrency)} via Card`}
            </span>
          </Button>
        )}

      </div>
    </div>
  );
}
export default CheckoutClient;

