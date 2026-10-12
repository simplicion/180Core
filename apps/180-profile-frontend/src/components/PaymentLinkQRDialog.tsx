'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Copy, Check, Smartphone, ShieldCheck, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentLinkQRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  currency: string;
  url: string;
}

export function PaymentLinkQRDialog({
  isOpen,
  onClose,
  title,
  amount,
  currency,
  url,
}: PaymentLinkQRDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !url) return;

    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Error generating link QR:', err));
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'payment-qr.png';
    a.click();
    toast.success('QR Code downloaded!');
  };

  const symbol = currency === 'INR' ? '₹' : '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 space-y-5 shadow-2xl text-center">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>Scan & Pay on Mobile</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-zinc-200 inline-block shadow-sm">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Scan to pay" className="w-52 h-52 rounded-lg object-contain mx-auto" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-zinc-400 text-xs">
              Generating QR...
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-bold text-zinc-900 truncate max-w-xs mx-auto">{title}</h3>
          <div className="text-lg font-mono font-black text-emerald-600">
            {symbol}{amount.toFixed(2)} {currency}
          </div>
          <p className="text-[11px] text-zinc-500">
            Scan with your mobile camera, GPay, PhonePe, Paytm, or browser to complete checkout.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="py-2 px-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Link</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save QR</span>
          </button>
        </div>
      </div>
    </div>
  );
}
