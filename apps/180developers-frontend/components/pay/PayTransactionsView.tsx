'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Receipt,
  Search,
  RotateCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  Check,
  X,
  Globe,
  Clock,
  Smartphone,
  Laptop,
  MapPin,
  CreditCard,
  ArrowRight,
  AlertTriangle,
  Compass,
  Languages,
  ShieldCheck,
  FileText,
  User,
  ExternalLink,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

type FilterStatus = 'ALL' | 'CAPTURED' | 'GATEWAY_DROPPED' | 'INTENT_ONLY' | 'FAILED';

export function PayTransactionsView() {
  const { paymentAnalytics, loadingAnalytics, fetchPaymentAnalytics, copiedKey, copyToClipboard } = useProject();

  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedTx, setSelectedTx] = useState<any>(null);

  // Lazy loading pagination
  const [displayedCount, setDisplayedCount] = useState(15);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPaymentAnalytics();
  }, [fetchPaymentAnalytics]);

  const rawTxs = paymentAnalytics?.transactions || [];

  const filteredTxs = useMemo(() => {
    return rawTxs.filter((tx: any) => {
      if (txStatusFilter !== 'ALL') {
        if (txStatusFilter === 'CAPTURED' && !(tx.status === 'CAPTURED' || tx.status === 'SUCCESS')) {
          return false;
        }
        if (txStatusFilter === 'GATEWAY_DROPPED' && tx.status !== 'GATEWAY_DROPPED') {
          return false;
        }
        if (txStatusFilter === 'INTENT_ONLY' && tx.status !== 'INTENT_ONLY') {
          return false;
        }
        if (txStatusFilter === 'FAILED' && tx.status !== 'FAILED') {
          return false;
        }
      }
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase();
        const matchId = (tx.id || '').toLowerCase().includes(q);
        const matchPhone = (tx.customerPhone || '').toLowerCase().includes(q);
        const matchName = (tx.customerName || '').toLowerCase().includes(q);
        const matchAmount = String(tx.amount || '').includes(q);
        const matchStatus = (tx.statusLabel || tx.status || '').toLowerCase().includes(q);
        return matchId || matchPhone || matchName || matchAmount || matchStatus;
      }
      return true;
    });
  }, [rawTxs, txStatusFilter, txSearchQuery]);

  const visibleTxs = useMemo(() => {
    return filteredTxs.slice(0, displayedCount);
  }, [filteredTxs, displayedCount]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < filteredTxs.length) {
          setDisplayedCount((prev) => Math.min(prev + 15, filteredTxs.length));
        }
      },
      { threshold: 0.2 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [displayedCount, filteredTxs.length]);

  const renderStatusBadge = (status: string, statusLabel?: string) => {
    switch (status) {
      case 'CAPTURED':
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>CAPTURED</span>
          </span>
        );
      case 'GATEWAY_DROPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>GATEWAY DROPPED</span>
          </span>
        );
      case 'INTENT_ONLY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Compass className="w-3 h-3" />
            <span>INTENT TO PAY</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>DECLINED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
            <span>{statusLabel || status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Transaction Detail & Audit Receipt Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl max-w-2xl w-full p-5 sm:p-7 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                    <span>Digital Receipt & Customer Journey</span>
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                    <span className="truncate max-w-[200px] sm:max-w-[300px]">{selectedTx.id}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedTx.id, 'receipt_modal_id')}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      title="Copy Transaction ID"
                    >
                      {copiedKey === 'receipt_modal_id' ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Status Banner */}
            {(() => {
              const isCaptured = selectedTx.status === 'CAPTURED' || selectedTx.status === 'SUCCESS';
              const isGatewayDropped = selectedTx.status === 'GATEWAY_DROPPED';
              const isIntentOnly = selectedTx.status === 'INTENT_ONLY';
              const isFailed = selectedTx.status === 'FAILED';

              if (isCaptured) {
                return (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Payment Captured & Verified</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                        SETTLED TO CLEARING
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                      Payment was successfully authorized and captured across payment rails. Funds are logged in your 180 Pay clearing pool for standard T+1 bank withdrawal.
                    </p>
                  </div>
                );
              }

              if (isGatewayDropped) {
                return (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Payment Gateway Opened • Dropped Before Capture</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                        UNCAPTURED
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      Customer launched the 180 Pay checkout sheet and clicked <strong>&quot;Pay&quot;</strong>, which initialized the UPI/Card payment gateway. However, the customer dismissed or cancelled the gateway modal before completing payment.
                    </p>
                  </div>
                );
              }

              if (isIntentOnly) {
                return (
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                        <Compass className="w-4 h-4 shrink-0" />
                        <span>Intent to Pay • 180 Pay Drawer Launched</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-800 dark:text-blue-300">
                        ZERO LIABILITY
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                      Customer loaded the 180 Pay bottom sheet showing purchase intent, but closed the drawer before clicking Pay or opening the payment gateway.
                    </p>
                  </div>
                );
              }

              return (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Payment Authorization Declined</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-800 dark:text-rose-300">
                      FAILED
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                    Customer attempted to pay, but the issuing bank or payment gateway declined authorization. No funds were debited.
                  </p>
                </div>
              );
            })()}

            {/* Financial Ledger Section */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-white/5">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Session Item</span>
                  <div className="font-bold text-sm text-zinc-950 dark:text-white">
                    {selectedTx.title || '180 Pay 1-Click Checkout'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Total Amount</span>
                  <div className="text-lg font-black text-zinc-950 dark:text-white font-mono">
                    {selectedTx.currency || 'INR'} {(selectedTx.amount || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Original Price</span>
                  <span className="font-bold text-zinc-900 dark:text-white font-mono">
                    ₹{(selectedTx.originalAmount || selectedTx.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Discount Applied</span>
                  <span className="font-bold text-zinc-900 dark:text-white font-mono">
                    {selectedTx.discountAmount ? `-₹${selectedTx.discountAmount}` : '₹0.00'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Payment Method</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">
                    {selectedTx.method || '180 Wallet'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Settlement Cycle</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">
                    {selectedTx.status === 'CAPTURED' ? 'T+1 Clearing' : 'Zero Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Behavioral Checkout Journey Stepper */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-purple-500" />
                <span>Customer Checkout Journey &amp; Audit Trail</span>
              </h4>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {/* Step 1: 180 Pay Drawer Opened */}
                <div className="relative text-xs">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-white">180 Pay Drawer Launched</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(selectedTx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Encrypted checkout sheet initiated on client device. Session registered in developer ledger.
                    </p>
                  </div>
                </div>

                {/* Step 2: Gateway Invoked */}
                {(() => {
                  const hasGateway =
                    selectedTx.status === 'GATEWAY_DROPPED' ||
                    selectedTx.status === 'CAPTURED' ||
                    Boolean(selectedTx.gatewayOrderId);

                  return (
                    <div className="relative text-xs">
                      <div
                        className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          hasGateway
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {hasGateway ? '2' : '—'}
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${hasGateway ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                            {hasGateway ? 'Payment Gateway Launched' : 'Payment Gateway (Not Invoked)'}
                          </span>
                          {selectedTx.gatewayInvokedAt && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(selectedTx.gatewayInvokedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {hasGateway
                            ? `User tapped Pay by UPI / Card. Gateway window opened${
                                selectedTx.gatewayOrderId ? ` (Order: ${selectedTx.gatewayOrderId})` : ''
                              }.`
                            : 'Customer closed the 180 bottom sheet before tapping the Pay button.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Step 3: Final Resolution */}
                <div className="relative text-xs">
                  {(() => {
                    const isCaptured = selectedTx.status === 'CAPTURED' || selectedTx.status === 'SUCCESS';
                    const isGatewayDropped = selectedTx.status === 'GATEWAY_DROPPED';
                    const isIntentOnly = selectedTx.status === 'INTENT_ONLY';

                    return (
                      <>
                        <div
                          className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCaptured
                              ? 'bg-emerald-500 text-white'
                              : isGatewayDropped
                              ? 'bg-amber-500 text-white'
                              : isIntentOnly
                              ? 'bg-blue-500 text-white'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {isCaptured ? '✓' : '!'}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {isCaptured
                                ? 'Payment Captured & Verified'
                                : isGatewayDropped
                                ? 'Gateway Dismissed by Customer'
                                : isIntentOnly
                                ? 'Drawer Dismissed Prior to Gateway'
                                : 'Authorization Declined'}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(selectedTx.completedAt || selectedTx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {isCaptured
                              ? `Confirmed with Payment ID: ${selectedTx.gatewayPaymentId || 'Verified'}.`
                              : isGatewayDropped
                              ? 'Gateway modal closed without authorization. Logged as gateway drop-off.'
                              : isIntentOnly
                              ? 'Customer browsed checkout sheet and exited. Logged as initial intent.'
                              : 'Payment authorization rejected by card issuer or UPI bank network.'}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Client Context, Telemetry & User Details */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-500" />
                <span>Client Telemetry &amp; Device Context</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* Location */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <MapPin className="w-3 h-3 text-purple-500" />
                    <span>Customer Location</span>
                  </div>
                  <div className="font-bold text-zinc-900 dark:text-white">
                    {selectedTx.location || 'India (IN)'}
                  </div>
                </div>

                {/* IP Address */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                      <Globe className="w-3 h-3 text-purple-500" />
                      <span>Client IP Address</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedTx.ip || '127.0.0.1', 'receipt_ip')}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[10px] flex items-center gap-1"
                    >
                      {copiedKey === 'receipt_ip' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="font-mono text-zinc-900 dark:text-white font-semibold text-[11px]">
                    {selectedTx.ip || '2400:1a00:2b41:892'}
                  </div>
                </div>

                {/* Language / Dialog Locale */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <Languages className="w-3 h-3 text-purple-500" />
                    <span>Language &amp; Dialog Locale</span>
                  </div>
                  <div className="font-semibold text-zinc-900 dark:text-white">
                    {selectedTx.language || 'en-US (English - United States)'}
                  </div>
                </div>

                {/* Device & Browser */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <Laptop className="w-3 h-3 text-purple-500" />
                    <span>Platform &amp; Browser</span>
                  </div>
                  <div className="font-semibold text-zinc-900 dark:text-white truncate">
                    {selectedTx.userAgent || 'Chrome 128 • Windows 11'}
                  </div>
                </div>

                {/* Customer Contact */}
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <User className="w-3 h-3 text-purple-500" />
                    <span>Customer Profile &amp; Contact</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {selectedTx.customerName || '180 User'}
                    </span>
                    <span className="font-mono text-zinc-500 text-[11px]">
                      {selectedTx.customerEmail || selectedTx.customerPhone || 'Direct App Checkout'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(JSON.stringify(selectedTx, null, 2), 'receipt_json');
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedKey === 'receipt_json' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'receipt_json' ? 'Receipt Copied' : 'Copy JSON Audit'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="w-full sm:w-auto px-6 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs cursor-pointer hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Ledger Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Incoming Transaction Receipts</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live audit ledger of customer checkout intents, gateway attempts, and captured payments.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchPaymentAnalytics}
            disabled={loadingAnalytics}
            className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer self-start sm:self-auto"
            title="Refresh transactions"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 3. Search and Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Tx ID, customer phone, name, or amount..."
              value={txSearchQuery}
              onChange={(e) => {
                setTxSearchQuery(e.target.value);
                setDisplayedCount(15);
              }}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs self-start sm:self-auto">
            {(
              [
                { id: 'ALL', label: 'ALL' },
                { id: 'CAPTURED', label: 'CAPTURED' },
                { id: 'GATEWAY_DROPPED', label: 'GATEWAY DROPPED' },
                { id: 'INTENT_ONLY', label: 'INTENT TO PAY' },
                { id: 'FAILED', label: 'DECLINED' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setTxStatusFilter(st.id);
                  setDisplayedCount(15);
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  txStatusFilter === st.id
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Transactions Table */}
        <div className="space-y-3">
          {loadingAnalytics && rawTxs.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
              <p className="text-xs text-zinc-400">Loading payment ledger...</p>
            </div>
          ) : visibleTxs.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Receipt / Tx ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Customer / Location</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date &amp; Time</th>
                    <th className="px-4 py-3 text-right">Audit &amp; Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5 font-mono">
                  {visibleTxs.map((tx: any) => {
                    return (
                      <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-zinc-950 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{tx.id?.slice(0, 14)}...</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(tx.id, `tx_${tx.id}`)}
                              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                              title="Copy Transaction ID"
                            >
                              {copiedKey === `tx_${tx.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-950 dark:text-white">
                          {tx.currency || 'INR'} {(tx.amount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <div className="text-zinc-900 dark:text-white font-medium text-xs">
                            {tx.customerName || '180 User'}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5 text-zinc-400" />
                            <span>{tx.location || 'India (IN)'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-[11px]">
                          {tx.method || '180 Wallet'}
                        </td>
                        <td className="px-4 py-3">
                          {renderStatusBadge(tx.status, tx.statusLabel)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-zinc-900 dark:text-zinc-200 font-medium text-xs">
                            {new Date(tx.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                            {new Date(tx.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-sans font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="View complete customer journey & receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center text-xs text-zinc-500">
              No transactions match your search criteria.
            </div>
          )}

          {/* Lazy loading infinite scroll anchor */}
          {displayedCount < filteredTxs.length && (
            <div ref={observerTarget} className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400 font-mono">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Loading more transactions ({displayedCount} of {filteredTxs.length})...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PayTransactionsView;
