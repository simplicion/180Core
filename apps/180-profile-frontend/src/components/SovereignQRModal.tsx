'use client';

import React from 'react';
import { PlatformModal, Button } from '@workspace/ui';
import { QrCode, ShieldCheck, Smartphone, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface UniversalQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export function UniversalQRModal({ isOpen, onClose, userId, userName }: UniversalQRModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    toast.success('Universal ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PlatformModal
      isOpen={isOpen}
      onClose={onClose}
      title="Companion QR Pairing"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-6 text-slate-800 text-xs text-center pt-2">
        <p className="text-slate-500 text-xs max-w-sm mx-auto">
          Scan this QR code with any 180 Workspace companion mobile app or hardware key to authenticate instantly.
        </p>

        {/* QR Code Container */}
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-xs">
          <div className="w-48 h-48 bg-white p-3 rounded-xl border border-slate-200 mx-auto flex items-center justify-center relative shadow-xs">
            {/* SVG Stylized QR Representation */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
              <rect x="0" y="0" width="30" height="30" rx="4" />
              <rect x="5" y="5" width="20" height="20" fill="white" rx="2" />
              <rect x="9" y="9" width="12" height="12" rx="2" />

              <rect x="70" y="0" width="30" height="30" rx="4" />
              <rect x="75" y="5" width="20" height="20" fill="white" rx="2" />
              <rect x="79" y="9" width="12" height="12" rx="2" />

              <rect x="0" y="70" width="30" height="30" rx="4" />
              <rect x="5" y="75" width="20" height="20" fill="white" rx="2" />
              <rect x="9" y="79" width="12" height="12" rx="2" />

              <rect x="38" y="10" width="8" height="8" rx="1" />
              <rect x="52" y="10" width="8" height="8" rx="1" />
              <rect x="38" y="24" width="8" height="8" rx="1" />
              <rect x="52" y="24" width="8" height="8" rx="1" />
              <rect x="38" y="38" width="24" height="24" rx="2" fill="#2563eb" />
              <rect x="10" y="44" width="18" height="8" rx="1" />
              <rect x="72" y="44" width="18" height="8" rx="1" />
              <rect x="38" y="72" width="14" height="14" rx="1" />
              <rect x="62" y="72" width="28" height="14" rx="1" />
            </svg>
          </div>
        </div>

        {/* User identifier box */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs max-w-sm mx-auto">
          <div className="text-left font-mono truncate text-[11px] text-slate-700">
            {userId}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0 ml-2"
            title="Copy ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Valid for 15 minutes • End-to-end encrypted</span>
        </div>
      </div>
    </PlatformModal>
  );
}
