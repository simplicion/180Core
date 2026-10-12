'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Printer,
  Sparkles,
  Smartphone,
  ShieldCheck,
  X,
  CreditCard,
  Building,
  RefreshCw,
  Share2,
  Sliders,
  DollarSign,
  Info,
} from 'lucide-react';
import { Button } from '@workspace/ui';
import { toast } from 'react-hot-toast';
import { getPublicBase, getApiBase, getAuthToken } from '@/lib/api-config';

export interface PaymentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If link is provided, opens in Link mode. Otherwise opens in Direct Payment mode.
  link?: {
    id?: string;
    slug: string;
    title: string;
    amount: number;
    currency: string;
    description?: string;
  } | null;
  defaultAppId?: string;
  defaultAppName?: string;
  defaultVpa?: string;
}

export function PaymentQRModal({
  isOpen,
  onClose,
  link,
  defaultAppId,
  defaultAppName = '180 Pay Merchant',
  defaultVpa = '',
}: PaymentQRModalProps) {
  // Mode selection: 'GATEWAY_UPI' (Razorpay Dynamic Gateway) or 'LINK' (180 Sovereign Bottom Sheet) or 'CUSTOM'
  const [activeTab, setActiveTab] = useState<'GATEWAY_UPI' | 'LINK' | 'CUSTOM'>('GATEWAY_UPI');

  // Direct Payment Parameters
  const [payeeName, setPayeeName] = useState(defaultAppName);
  const [vpa, setVpa] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('180_merchant_vpa') || defaultVpa || '';
    }
    return defaultVpa || '';
  });
  const [amount, setAmount] = useState(link ? String(link.amount) : '500');
  const [currency, setCurrency] = useState(link ? link.currency : 'INR');
  const [note, setNote] = useState(link ? link.title : 'Direct Payment');
  const [customUrl, setCustomUrl] = useState('');

  // Live Gateway QR State (Razorpay / Connected Gateway)
  const [gatewayQrData, setGatewayQrData] = useState<{
    qrPayload: string;
    qrType: string;
    gateway: string;
    isDirectUpi: boolean;
    paymentUrl?: string;
    vpa?: string;
  } | null>(null);
  const [gatewaySyncing, setGatewaySyncing] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  // QR Customization
  const [qrTheme, setQrTheme] = useState<'clean' | 'dark' | 'brand'>('clean');
  const [includeLogo, setIncludeLogo] = useState(true);

  // Generated QR output state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Synchronize state when target link changes
  useEffect(() => {
    if (link) {
      setAmount(String(link.amount));
      setCurrency(link.currency);
      setNote(link.title);
    }
  }, [link]);

  // Live Gateway Sync Effect: Whenever amount, currency, note, or app changes
  useEffect(() => {
    if (!isOpen || !defaultAppId) return;
    if (activeTab !== 'GATEWAY_UPI') return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setGatewaySyncing(true);
        setGatewayError(null);
        const token = getAuthToken();
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/v1/payment-links/apps/${defaultAppId}/gateway-qr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            amount: parseFloat(amount) || 100,
            currency,
            title: note,
            payeeName,
            linkId: link?.id,
          }),
        });

        const data = await res.json();
        if (!isMounted) return;
        if (res.ok && data.success) {
          setGatewayQrData({
            qrPayload: data.qrPayload,
            qrType: data.qrType,
            gateway: data.gateway || 'RAZORPAY',
            isDirectUpi: Boolean(data.isDirectUpi),
          });
        } else {
          setGatewayError(data.error || 'Could not sync connected gateway QR');
        }
      } catch (err: any) {
        if (isMounted) setGatewayError(err.message || 'Gateway sync failed');
      } finally {
        if (isMounted) setGatewaySyncing(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, defaultAppId, amount, currency, note, payeeName, activeTab, link?.id]);

  // Persist merchant VPA preference (optional manual override)
  const handleVpaChange = (newVpa: string) => {
    setVpa(newVpa);
    if (typeof window !== 'undefined') {
      localStorage.setItem('180_merchant_vpa', newVpa);
    }
  };

  // Determine active payload string
  const getPayloadString = (): string => {
    if (activeTab === 'LINK' && link) {
      return `${getPublicBase()}/link/${link.slug}`;
    }

    if (activeTab === 'GATEWAY_UPI') {
      if (gatewayQrData?.qrPayload) {
        return gatewayQrData.qrPayload;
      }
      if (vpa.trim()) {
        const cleanVpa = vpa.trim();
        const cleanName = encodeURIComponent(payeeName.trim() || '180 Pay Merchant');
        const cleanNote = encodeURIComponent(note.trim() || 'Payment');
        const numAmount = parseFloat(amount);
        const amountParam = !isNaN(numAmount) && numAmount > 0 ? `&am=${numAmount.toFixed(2)}` : '';
        return `upi://pay?pa=${cleanVpa}&pn=${cleanName}${amountParam}&cu=${currency.toUpperCase()}&tn=${cleanNote}`;
      }
      return link ? `${getPublicBase()}/link/${link.slug}` : `${getPublicBase()}/pay/${defaultAppId || ''}`;
    }

    return customUrl.trim() || `${getPublicBase()}`;
  };

  const payloadString = getPayloadString();

  // Generate QR Code data URL & SVG whenever payload or theme changes
  useEffect(() => {
    if (!isOpen || !payloadString) return;

    let isMounted = true;
    setGenerating(true);

    const darkColor = qrTheme === 'dark' ? '#0f172a' : qrTheme === 'brand' ? '#312e81' : '#000000';
    const lightColor = '#ffffff';

    Promise.all([
      QRCode.toDataURL(payloadString, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: darkColor,
          light: lightColor,
        },
      }),
      QRCode.toString(payloadString, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: darkColor,
          light: lightColor,
        },
      }),
    ])
      .then(([dataUrl, svg]) => {
        if (!isMounted) return;
        setQrDataUrl(dataUrl);
        setQrSvg(svg);
      })
      .catch((err) => {
        console.error('[PaymentQRModal] QR Generation error:', err);
      })
      .finally(() => {
        if (isMounted) setGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, payloadString, qrTheme]);

  if (!isOpen) return null;

  // Copy raw payload / link URL to clipboard
  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payloadString);
    setCopiedPayload(true);
    toast.success(
      activeTab === 'LINK'
        ? 'Payment link copied to clipboard!'
        : 'Payment URI copied to clipboard!'
    );
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // High-Resolution Standee PNG Download
  const handleDownloadPNG = () => {
    if (!qrDataUrl) return;

    // Create a high-res canvas composite for a professional counter standee card
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Card background
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(0, 0, 1200, 1500, 48);
    ctx.fill();

    // Subtle header gradient
    const grad = ctx.createLinearGradient(0, 0, 1200, 320);
    grad.addColorStop(0, '#4338ca');
    grad.addColorStop(1, '#6366f1');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 1200, 320, [48, 48, 0, 0]);
    ctx.fill();

    // Top Brand Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN & PAY DIRECTLY', 600, 130);

    ctx.font = 'normal 32px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('Accepted via Google Pay, PhonePe, Paytm, UPI & Any Camera', 600, 200);

    // Merchant / Title Info
    const displayTitle = activeTab === 'LINK' && link ? link.title : payeeName || '180 Pay Merchant';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 50px system-ui, -apple-system, sans-serif';
    ctx.fillText(displayTitle, 600, 420);

    // Amount Badge (if applicable)
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      const sym = currency === 'INR' ? 'Rs. ' : `${currency} `;
      ctx.fillStyle = '#4f46e5';
      ctx.font = 'bold 44px monospace, system-ui';
      ctx.fillText(`${sym}${numAmount.toFixed(2)}`, 600, 490);
    }

    // Draw the QR Code image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = qrDataUrl;
    img.onload = () => {
      // Draw centered QR Code
      const qrSize = 700;
      const qrX = (1200 - qrSize) / 2;
      const qrY = 540;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 28px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        activeTab === 'GATEWAY_UPI'
          ? (gatewayQrData?.vpa ? `UPI VPA: ${gatewayQrData.vpa}` : 'Scan with Any UPI App • GPay, PhonePe, Paytm')
          : 'Powered by 180 Workspace Ledger Protocol',
        600,
        1340
      );

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'normal 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('Zero-Intermediary Sovereign Settlement • Instant Verification', 600, 1400);

      // Trigger download
      const filename = `${(link?.slug || '180-payment-qr').toLowerCase()}-standee.png`;
      const a = document.createElement('a');
      a.download = filename;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast.success('High-res payment standee downloaded!');
    };
  };

  // Vector SVG Download
  const handleDownloadSVG = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(link?.slug || 'payment-qr').toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Vector SVG downloaded!');
  };

  // Printable Standee
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      return;
    }

    const titleText = activeTab === 'LINK' && link ? link.title : payeeName;
    const amountText = parseFloat(amount) > 0 ? `${currency === 'INR' ? '₹' : currency} ${amount}` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print 180 Pay QR Standee</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; margin: 0; padding: 20px; color: #0f172a; }
            .card { max-width: 480px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 28px; padding: 36px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
            .header { background: #4f46e5; color: white; padding: 16px 20px; border-radius: 18px; margin-bottom: 24px; }
            .header h2 { margin: 0; font-size: 20px; letter-spacing: 1px; }
            .header p { margin: 4px 0 0; font-size: 12px; opacity: 0.9; }
            .title { font-size: 22px; font-weight: 800; margin: 12px 0 6px; }
            .amount { font-size: 26px; font-weight: 900; color: #4338ca; margin: 6px 0 18px; font-family: monospace; }
            .qr-box { padding: 16px; background: white; border: 1px solid #cbd5e1; border-radius: 20px; display: inline-block; margin-bottom: 18px; }
            .qr-box img { width: 280px; height: 280px; display: block; }
            .footer { font-size: 12px; color: #64748b; margin-top: 14px; border-top: 1px dashed #cbd5e1; padding-top: 16px; }
            .footer-sub { font-size: 10px; color: #94a3b8; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2>SCAN TO PAY</h2>
              <p>Accepted across all UPI Apps & Phone Cameras</p>
            </div>
            <div class="title">${titleText}</div>
            ${amountText ? `<div class="amount">${amountText}</div>` : ''}
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="Payment QR" />
            </div>
            <div class="footer">
              ${activeTab === 'GATEWAY_UPI' && gatewayQrData?.vpa ? `<strong>UPI VPA:</strong> ${gatewayQrData.vpa}<br/>` : activeTab === 'GATEWAY_UPI' ? `<strong>Dynamic Gateway:</strong> Scannable by any UPI App (GPay, PhonePe, Paytm)<br/>` : ''}
              <strong>180 Workspace Sovereign Payment Protocol</strong>
              <div class="footer-sub">Verified Instant Settlement • Secured by Universal Ledger</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <span>Instant Payment QR Code</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Live Scannable
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Generate high-resolution dynamic QR codes for physical counters, invoices, and instant mobile payment.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('GATEWAY_UPI')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'GATEWAY_UPI'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
            <span>Razorpay Dynamic UPI</span>
          </button>

          {link ? (
            <button
              type="button"
              onClick={() => setActiveTab('LINK')}
              className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'LINK'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>180 Pay Bottom Sheet</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setActiveTab('CUSTOM')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'CUSTOM'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Custom URL</span>
          </button>
        </div>

        {/* Body Layout: QR Preview on Left/Top, Controls on Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left Column: QR Code Display Card */}
          <div className="flex flex-col items-center justify-center p-6 rounded-3xl border border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-900/40 text-center space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-md border border-zinc-200 inline-block relative group">
              {qrDataUrl ? (
                <div className="relative">
                  <img
                    src={qrDataUrl}
                    alt="Payment QR Code"
                    className="w-56 h-56 sm:w-60 sm:h-60 rounded-lg object-contain mx-auto"
                  />
                  {includeLogo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-11 h-11 rounded-xl bg-white p-1.5 shadow-md border border-zinc-200 flex items-center justify-center">
                        <img
                          src="/180-core-infinity-icon.svg"
                          alt="180"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-zinc-400">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              )}
            </div>

            {/* Quick summary below QR */}
            <div className="space-y-1">
              <div className="text-sm font-bold text-zinc-950 dark:text-white truncate max-w-xs">
                {activeTab === 'LINK' && link ? link.title : payeeName || 'Direct Pay'}
              </div>
              <div className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                {currency === 'INR' ? '₹' : currency} {parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : 'Open Amount'}
              </div>

              {activeTab === 'GATEWAY_UPI' && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Razorpay Connected Gateway</span>
                </div>
              )}

              {activeTab === 'LINK' && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 pt-0.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                  <span>180 Pay Mobile Bottom Sheet</span>
                </div>
              )}
            </div>

            {/* Compatible Apps Pill Bar */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 pt-1">
              <span className="px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 font-semibold">GPay</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 font-semibold">PhonePe</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 font-semibold">Paytm</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 font-semibold">BHIM</span>
              <span className="px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 font-semibold">Camera</span>
            </div>
          </div>

          {/* Right Column: Customization Controls & Parameters */}
          <div className="space-y-4">
            {/* Gateway UPI Options */}
            {activeTab === 'GATEWAY_UPI' && (
              <div className="space-y-3.5 p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-white/10">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <span>Razorpay Connected Gateway</span>
                      {gatewaySyncing && <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />}
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      Dynamic UPI QR linked to your live gateway account. Scannable with Google Pay, PhonePe, Paytm, BHIM & CRED. Payments trigger real-time webhooks & instant receipts.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Amount ({currency === 'INR' ? '₹' : currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="500"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Merchant / Payee Name
                    </label>
                    <input
                      type="text"
                      value={payeeName}
                      onChange={(e) => setPayeeName(e.target.value)}
                      placeholder="Business Name"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Payment Note / Reference
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Invoice #1024 or Store Order"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Advanced optional fallback manual VPA override */}
                <details className="text-[11px] text-zinc-500 pt-1 cursor-pointer">
                  <summary className="font-semibold text-zinc-600 dark:text-zinc-400 hover:underline">
                    Advanced: Manual VPA Override (Optional)
                  </summary>
                  <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-white/10 space-y-1">
                    <input
                      type="text"
                      value={vpa}
                      onChange={(e) => handleVpaChange(e.target.value)}
                      placeholder="Optional fallback VPA (e.g. merchant@okhdfcbank)"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white font-mono"
                    />
                    <p className="text-[10px] text-zinc-400">
                      Leave blank to use live connected Razorpay gateway.
                    </p>
                  </div>
                </details>
              </div>
            )}

            {/* Link Mode Info */}
            {activeTab === 'LINK' && (
              <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-white/10 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5">
                  <CreditCard className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      180 Pay Mobile Bottom Sheet
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      When customers scan this QR with their phone camera, it strictly launches the 180 Pay Bottom Sheet on their device with UPI, Cards, Netbanking, and automated digital fulfillment.
                    </p>
                  </div>
                </div>

                {link && (
                  <div className="space-y-2 pt-1 border-t border-zinc-200/60 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Target Slug:</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 font-semibold">/link/{link.slug}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Hosted URL:</span>
                      <a
                        href={`${getPublicBase()}/link/${link.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                      >
                        <span>Preview Bottom Sheet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Mode Input */}
            {activeTab === 'CUSTOM' && (
              <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-white/5 space-y-2">
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Custom Payment URL or Payload
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://... or payment intent"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            )}

            {/* Visual Options */}
            <div className="space-y-2 pt-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block">
                QR Design Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQrTheme('clean')}
                  className={`p-2 rounded-xl border text-center text-xs font-medium cursor-pointer transition-colors ${
                    qrTheme === 'clean'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold'
                      : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  High Contrast
                </button>
                <button
                  type="button"
                  onClick={() => setQrTheme('brand')}
                  className={`p-2 rounded-xl border text-center text-xs font-medium cursor-pointer transition-colors ${
                    qrTheme === 'brand'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold'
                      : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  180 Indigo
                </button>
                <button
                  type="button"
                  onClick={() => setQrTheme('dark')}
                  className={`p-2 rounded-xl border text-center text-xs font-medium cursor-pointer transition-colors ${
                    qrTheme === 'dark'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold'
                      : 'border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  Dark Slate
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={handleDownloadPNG}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 py-2.5 shadow-md shadow-indigo-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Standee</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrint}
                  className="rounded-xl border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 py-2.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Standee</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyPayload}
                  className="rounded-xl border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 py-2"
                >
                  {copiedPayload ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>Copy URI</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadSVG}
                  className="rounded-xl border-zinc-200 dark:border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 py-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Vector SVG</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Protocol Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-white/5 text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Universal QR Protocol • Interoperable with all banking & UPI gateways</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
