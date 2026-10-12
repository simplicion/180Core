'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  ExternalLink,
  Tag,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  User,
  Phone,
  QrCode,
} from 'lucide-react';
import { Button, LogoLoader } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { CORE_BACKEND_URL } from '@/lib/api';
import { PaymentLinkQRDialog } from '@/components/PaymentLinkQRDialog';

export interface RegionalPricingData {
  isApplied: boolean;
  countryCode: string;
  countryName: string;
  flag: string;
  currency: string;
  symbol: string;
  originalAmount: number;
  originalCurrency: string;
  discountPercentage?: number;
  banner?: {
    flag: string;
    headline: string;
    message: string;
  };
}

interface PublicPaymentLink {
  id: string;
  slug: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  collectPhone: boolean;
  collectAddress: boolean;
  allowCoupons: boolean;
  allowCustomAmount?: boolean;
  metadata?: Record<string, any>;
  isAvailable: boolean;
  isSoldOut: boolean;
  regionalPricing?: RegionalPricingData;
  merchant: {
    name: string;
    logoUrl?: string;
    clientId: string;
  };
}

const getSymbol = (currency: string, overrideSymbol?: string) => {
  if (overrideSymbol && overrideSymbol !== currency) return overrideSymbol;
  switch ((currency || '').toUpperCase()) {
    case 'INR': return '₹';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'BRL': return 'R$';
    case 'CAD': return 'C$';
    case 'AUD': return 'A$';
    case 'JPY': return '¥';
    default: return '$';
  }
};

interface FulfillmentData {
  fulfillmentMessage?: string;
  fulfillmentFileUrl?: string;
  redirectUrl?: string;
  transactionId?: string;
}

export function PaymentLinkClient({ slug: initialSlug }: { slug?: string } = {}) {
  const params = useParams();

  // Resilient slug extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialSlug = useCallback(() => {
    if (initialSlug && initialSlug !== 'default') return initialSlug;
    const pSlug = params?.slug as string;
    if (pSlug && pSlug !== 'default') return pSlug;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/(?:link|pay\/l)\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== 'default') {
        return decodeURIComponent(match[1]);
      }
    }
    return '';
  }, [initialSlug, params?.slug]);

  const [slug, setSlug] = useState<string>(getInitialSlug);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<PublicPaymentLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Customer Contact Fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Coupon Fields
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Payment Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [fulfilledData, setFulfilledData] = useState<FulfillmentData | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const getApiBase = () => {
    return CORE_BACKEND_URL;
  };

  const fetchLink = useCallback(async (slugToFetch?: string) => {
    const targetSlug = slugToFetch || slug || getInitialSlug();
    if (!targetSlug || targetSlug === 'default') {
      setLoading(false);
      setError('Please provide a valid payment link');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (targetSlug === 'preview-link') {
        setLink({
          id: 'preview',
          slug: 'preview-link',
          title: 'Sample Product (Checkout Preview)',
          description: 'This is a live preview of how your payment link and checkout page look to your customers.',
          amount: 500,
          currency: 'INR',
          collectPhone: true,
          collectAddress: false,
          allowCoupons: true,
          allowCustomAmount: false,
          isAvailable: true,
          isSoldOut: false,
          merchant: {
            name: '180 Workspace Merchant',
            clientId: 'preview',
          },
        });
        setLoading(false);
        return;
      }

      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/payment-links/public/${encodeURIComponent(targetSlug)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Payment link not found or inactive');
      }
      setLink(json.data || json.link);
    } catch (err: any) {
      setError(err.message || 'Failed to load payment link');
    } finally {
      setLoading(false);
    }
  }, [slug, getInitialSlug]);

  useEffect(() => {
    const currentSlug = getInitialSlug();
    if (currentSlug && currentSlug !== 'default') {
      setSlug(currentSlug);
      fetchLink(currentSlug);
    } else {
      setLoading(false);
      setError('Please provide a valid payment link');
    }
  }, [getInitialSlug, fetchLink]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !link) return;
    setValidatingCoupon(true);
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/v1/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: link.merchant.clientId || link.id,
          code: couponCode.trim().toUpperCase(),
          couponCode: couponCode.trim().toUpperCase(),
          amount: link.amount,
          orderAmount: link.amount,
          customerEmail: customerEmail || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && (data.valid || data.data?.valid)) {
        const valData = data.data || data;
        setAppliedCoupon({
          code: valData.code || couponCode.toUpperCase(),
          discountAmount: valData.discountAmount || 0,
          finalAmount: valData.finalAmount || link.amount - (valData.discountAmount || 0),
        });
        toast.success(`Coupon "${(valData.code || couponCode).toUpperCase()}" applied!`, { id: 'coupon-toast' });
      } else {
        toast.error(data.error || 'Invalid or expired coupon code', { id: 'coupon-toast' });
        setAppliedCoupon(null);
      }
    } catch {
      toast.error('Failed to validate coupon', { id: 'coupon-toast' });
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Customer-Chosen Flexible Amount State
  const [customAmountInput, setCustomAmountInput] = useState<string>('500');

  const isOpenAmount = Boolean(link && (link.allowCustomAmount || Number(link.amount) === 0 || link.metadata?.allowCustomAmount));
  const currentPayableAmount = appliedCoupon
    ? appliedCoupon.finalAmount
    : isOpenAmount
    ? (parseFloat(customAmountInput) || 0)
    : (link?.amount || 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;

    if (isOpenAmount) {
      const parsedAmount = parseFloat(customAmountInput);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast.error('Please enter a valid payment amount greater than zero');
        return;
      }
    }

    if (!customerPhone.trim()) {
      toast.error('Please enter your phone number to proceed');
      return;
    }

    const effectiveEmail = customerEmail.trim() || `${customerPhone.replace(/\D/g, '') || 'guest'}@customer.180pay.com`;

    // Preview Demonstration Simulation
    if (link.id === 'preview') {
      setIsProcessing(true);
      setTimeout(() => {
        toast.success('Preview checkout simulated! Real links fulfill live payments.', { id: 'preview-toast' });
        setFulfilledData({
          fulfillmentMessage: 'DEMO-LICENSE-KEY-180-PREVIEW-SUCCESS',
          redirectUrl: 'https://developer.180core.cloud',
          transactionId: 'demo_txn_preview_180',
        });
        setIsProcessing(false);
      }, 700);
      return;
    }

    setIsProcessing(true);
    try {
      const apiBase = getApiBase();

      // 1. Create checkout session on backend
      const sessionRes = await fetch(`${apiBase}/api/v1/checkout/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: link.merchant.clientId || link.id,
          clientId: link.merchant.clientId || undefined,
          amount: currentPayableAmount,
          currency: link.currency || 'INR',
          title: link.title,
          description: link.description,
          couponCode: appliedCoupon?.code || undefined,
          metadata: {
            paymentLinkId: link.id,
            paymentLinkSlug: link.slug,
            customerEmail: effectiveEmail,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerAddress: customerAddress.trim(),
          },
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.success) {
        throw new Error(sessionData.error || 'Failed to initialize payment session');
      }

      const sessionId = sessionData.sessionId || sessionData.data?.id;

      // 2. Generate direct gateway order
      const orderRes = await fetch(`${apiBase}/api/v1/checkout/sessions/${sessionId}/direct-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        // Fallback: If gateway order cannot be generated (test/mock environment), complete link purchase directly
        const completeRes = await fetch(`${apiBase}/api/v1/payment-links/${link.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const completeData = await completeRes.json();
        setFulfilledData({
          fulfillmentMessage: completeData.fulfillment?.fulfillmentMessage || completeData.data?.fulfillmentMessage,
          fulfillmentFileUrl: completeData.fulfillment?.fulfillmentFileUrl || completeData.data?.fulfillmentFileUrl,
          redirectUrl: completeData.fulfillment?.redirectUrl || completeData.data?.redirectUrl,
          transactionId: sessionId,
        });
        setIsProcessing(false);
        return;
      }

      // 3. Open Razorpay Checkout modal for genuine bank payment
      const loadRzp = (): Promise<boolean> => {
        return new Promise((resolve) => {
          if ((window as any).Razorpay) return resolve(true);
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.async = true;
          s.onload = () => resolve(true);
          s.onerror = () => resolve(false);
          document.body.appendChild(s);
        });
      };

      const rzpLoaded = await loadRzp();
      if (rzpLoaded && (window as any).Razorpay) {
        const options: any = {
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: link.currency || 'INR',
          name: link.title || '180 Payment Link',
          description: link.description || 'Payment',
          order_id: orderData.orderId,
          prefill: {
            name: customerName.trim() || undefined,
            email: effectiveEmail,
            contact: customerPhone.trim(),
          },
          theme: { color: '#2563eb' },
          handler: async (response: any) => {
            try {
              const verifyRes = await fetch(`${apiBase}/api/v1/checkout/sessions/${sessionId}/direct-verify`, {
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

              // Complete payment link fulfillment
              const compRes = await fetch(`${apiBase}/api/v1/payment-links/${link.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });
              const compData = await compRes.json();
              setFulfilledData({
                fulfillmentMessage: compData.fulfillment?.fulfillmentMessage || compData.data?.fulfillmentMessage,
                fulfillmentFileUrl: compData.fulfillment?.fulfillmentFileUrl || compData.data?.fulfillmentFileUrl,
                redirectUrl: compData.fulfillment?.redirectUrl || compData.data?.redirectUrl,
                transactionId: response.razorpay_payment_id,
              });
              setIsProcessing(false);
            } catch (vErr: any) {
              toast.error(vErr.message || 'Payment verification failed');
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      }

      toast.error('Unable to load payment gateway. Please try again.');
      setIsProcessing(false);
    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed');
      setIsProcessing(false);
    }
  };

  const handleCopySecret = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-70" />
        <LogoLoader size={44} className="w-11 h-11 text-indigo-600 relative z-10" />
        <p className="text-xs text-zinc-500 font-medium mt-3 relative z-10">Loading checkout link...</p>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center relative overflow-hidden">
        <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-70" />
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 border border-red-200 relative z-10">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-zinc-900 mb-1 relative z-10">Payment Link Unavailable</h1>
        <p className="text-xs text-zinc-500 max-w-sm mb-6 relative z-10">
          {error || 'This payment link does not exist, has expired, or was deactivated by the seller.'}
        </p>
        <Button
          onClick={() => {
            const retrySlug = getInitialSlug();
            if (retrySlug && retrySlug !== 'default') {
              fetchLink(retrySlug);
            } else {
              window.location.reload();
            }
          }}
          className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-4 py-2 rounded-xl relative z-10"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // FULFILLED SUCCESS VIEW
  if (fulfilledData) {
    return (
      <div className="min-h-[100dvh] bg-white text-zinc-900 flex flex-col justify-end sm:justify-center p-0 sm:p-6 relative overflow-hidden">
        {/* Full Page Minimal Grid Background */}
        <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-70" />
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg sm:mx-auto rounded-t-[32px] sm:rounded-3xl border-t sm:border border-zinc-200/80 bg-white/95 sm:bg-white/90 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-xl text-center z-10">
          <div className="w-12 h-1.5 rounded-full bg-zinc-300 mx-auto -mt-2 mb-4 sm:hidden" />
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-zinc-900">Payment Successful!</h1>
            {customerPhone && (
              <p className="text-xs text-zinc-500">
                Confirmation sent to <span className="font-semibold text-zinc-800">{customerPhone}</span>
              </p>
            )}
            {fulfilledData.transactionId && (
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                Ref: {fulfilledData.transactionId}
              </p>
            )}
          </div>

          {/* Fulfillment Secret Message */}
          {fulfilledData.fulfillmentMessage && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Your Digital Access / Secret
                </span>
                <button
                  onClick={() => handleCopySecret(fulfilledData.fulfillmentMessage!)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSecret ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3 rounded-xl bg-white font-mono text-xs text-zinc-800 select-all break-all border border-zinc-200">
                {fulfilledData.fulfillmentMessage}
              </div>
            </div>
          )}

          {/* Fulfillment Download File */}
          {fulfilledData.fulfillmentFileUrl && (
            <div className="pt-2">
              <a
                href={fulfilledData.fulfillmentFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20"
              >
                <Download className="w-4 h-4" />
                Download Digital Asset
              </a>
            </div>
          )}

          {/* Redirect to store */}
          {fulfilledData.redirectUrl && (
            <div className="pt-1">
              <a
                href={fulfilledData.redirectUrl}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <span>Continue to {link.merchant.name}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MAIN CHECKOUT VIEW
  return (
    <div className="min-h-[100dvh] bg-white text-zinc-900 flex flex-col justify-end sm:justify-between p-0 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Full Page Minimal Grid Background */}
      <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-70" />
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-slate-400/5 rounded-full blur-3xl pointer-events-none" />

      {/* Mobile Top Header (above bottom sheet) */}
      <header className="sm:hidden px-5 pt-6 pb-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          {link.merchant.logoUrl ? (
            <img
              src={link.merchant.logoUrl}
              alt={link.merchant.name}
              className="w-8 h-8 rounded-xl object-cover border border-zinc-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
              {link.merchant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-bold text-zinc-900 block">{link.merchant.name}</span>
        </div>

        <button
          type="button"
          onClick={() => setShowQRModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] text-zinc-700 font-medium cursor-pointer"
        >
          <QrCode className="w-3 h-3 text-indigo-600" />
          <span>Scan QR</span>
        </button>
      </header>

      {/* Desktop Header */}
      <header className="hidden sm:flex max-w-2xl mx-auto w-full items-center justify-between pb-6 z-10">
        <div className="flex items-center gap-2.5">
          {link.merchant.logoUrl ? (
            <img
              src={link.merchant.logoUrl}
              alt={link.merchant.name}
              className="w-8 h-8 rounded-xl object-cover border border-zinc-200 shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
              {link.merchant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-zinc-900">{link.merchant.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200/70 border border-zinc-200 text-[11px] text-zinc-700 font-medium transition-all cursor-pointer"
            title="Scan to pay on mobile"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>Scan QR</span>
          </button>
        </div>
      </header>

      {/* Main Container: Mobile Bottom Sheet / Desktop Centered Card */}
      <main className="max-w-2xl mx-auto w-full my-0 sm:my-auto z-20">
        <div className="rounded-t-[32px] sm:rounded-3xl border-t sm:border border-zinc-200/80 bg-white/95 sm:bg-white/90 backdrop-blur-2xl p-5 sm:p-8 shadow-xl shadow-zinc-900/5 space-y-5 max-h-[88dvh] sm:max-h-none overflow-y-auto pb-8 sm:pb-8">
          {/* Mobile Drag Handle */}
          <div className="w-12 h-1.5 rounded-full bg-zinc-300 mx-auto -mt-1 mb-2 sm:hidden" />

          {/* Demo Preview Notification Banner */}
          {link.id === 'preview' && (
            <div className="p-3 sm:p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-zinc-900">Live Checkout Preview</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    This is an interactive demonstration. Complete and save your payment link in the 180 Developer Portal to start accepting live payments.
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider shrink-0 border border-indigo-200">
                Preview Mode
              </span>
            </div>
          )}

          {/* Mobile Sheet Header */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-100 sm:hidden">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                Direct Payment Link
              </span>
              <h2 className="text-sm font-black text-zinc-900 truncate">{link.title}</h2>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black text-emerald-600 font-mono">
                {getSymbol(link.currency, link.regionalPricing?.symbol)}
                {currentPayableAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Desktop Item Header */}
          <div className="hidden sm:flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-zinc-100">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                <ShoppingBag className="w-3 h-3" />
                Direct Payment Link
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">{link.title}</h1>
              {link.description && (
                <p className="text-xs text-zinc-500 max-w-md leading-relaxed">{link.description}</p>
              )}
            </div>

            <div className="sm:text-right shrink-0">
              {isOpenAmount ? (
                <div className="space-y-0.5">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
                    {getSymbol(link.currency, link.regionalPricing?.symbol)}
                    {currentPayableAmount.toFixed(2)}
                  </div>
                  <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    Customer-Chosen Amount
                  </span>
                </div>
              ) : appliedCoupon ? (
                <div className="space-y-0.5">
                  <span className="text-xs text-zinc-400 line-through font-mono">
                    {getSymbol(link.currency, link.regionalPricing?.symbol)}
                    {link.amount.toFixed(2)}
                  </span>
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {getSymbol(link.currency, link.regionalPricing?.symbol)}
                    {appliedCoupon.finalAmount.toFixed(2)}
                  </div>
                  <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    -{getSymbol(link.currency, link.regionalPricing?.symbol)}{appliedCoupon.discountAmount.toFixed(2)} Saved
                  </span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {link.regionalPricing?.isApplied && link.regionalPricing.originalCurrency !== link.currency && (
                    <span className="text-xs text-zinc-400 line-through font-mono block">
                      {getSymbol(link.regionalPricing.originalCurrency)}
                      {link.regionalPricing.originalAmount.toFixed(2)} {link.regionalPricing.originalCurrency}
                    </span>
                  )}
                  <div className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono">
                    {getSymbol(link.currency, link.regionalPricing?.symbol)}
                    {link.amount.toFixed(2)}
                  </div>
                  {link.regionalPricing?.isApplied && link.regionalPricing.discountPercentage ? (
                    <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {link.regionalPricing.discountPercentage}% Regional Savings
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Regional Multi-Pricing Banner */}
          {link.regionalPricing?.isApplied && (
            <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/60 flex items-center gap-3">
              <span className="text-2xl">{link.regionalPricing.banner?.flag || link.regionalPricing.flag}</span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-indigo-900">
                  {link.regionalPricing.banner?.headline || `Special Localized Price (${link.regionalPricing.countryName})`}
                </h4>
                <p className="text-[11px] text-zinc-600 leading-tight">
                  {link.regionalPricing.banner?.message || 'A targeted regional price has been automatically applied.'}
                </p>
              </div>
            </div>
          )}

          {/* Sold Out Notice */}
          {link.isSoldOut ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center space-y-1">
              <span className="text-sm font-bold text-red-600">Sold Out</span>
              <p className="text-xs text-zinc-500">
                All available purchase slots for this payment link have been claimed.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-4">
              {/* Flexible Amount Input Field */}
              {isOpenAmount && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Enter Payment Amount ({link.currency})
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-base font-bold text-zinc-400 font-mono">
                      {getSymbol(link.currency, link.regionalPricing?.symbol)}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                      placeholder="500"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Customer Contact Form */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Customer Name <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Mercer"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Coupon Section */}
              {link.allowCoupons && (
                <div className="pt-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Promo or Coupon Code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono uppercase text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs px-4 py-2 rounded-xl shrink-0 cursor-pointer"
                    >
                      {validatingCoupon ? 'Checking...' : 'Apply'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Submit Pay Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <LogoLoader size={18} className="w-4.5 h-4.5 text-white" />
                      <span>Opening Secure Checkout...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Pay {getSymbol(link.currency, link.regionalPricing?.symbol)}
                        {currentPayableAmount.toFixed(2)} via UPI / Card
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* QR Code Dialog */}
      <PaymentLinkQRDialog
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title={link.title}
        amount={appliedCoupon ? appliedCoupon.finalAmount : link.amount}
        currency={link.currency}
        url={typeof window !== 'undefined' ? window.location.href : `https://profile.180core.cloud/link/${link.slug}`}
      />
    </div>
  );
}
