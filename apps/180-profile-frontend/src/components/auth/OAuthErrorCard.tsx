'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Terminal,
  HelpCircle,
  Lock,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface OAuthErrorDetails {
  type?: 'REDIRECT_URI_MISMATCH' | 'ORIGIN_MISMATCH' | 'CLIENT_NOT_FOUND' | 'AUTH_DISABLED' | string;
  requestedUri?: string;
  requestedOrigin?: string;
  appName?: string;
  clientId?: string;
  registeredUris?: string[];
  allowedOrigins?: string[];
  hint?: string;
}

export interface OAuthErrorCardProps {
  error: string;
  errorDescription: string;
  details?: OAuthErrorDetails;
  onRetry?: () => void;
  onClose?: () => void;
}

export function OAuthErrorCard({
  error,
  errorDescription,
  details,
  onRetry,
  onClose,
}: OAuthErrorCardProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [showDevInspector, setShowDevInspector] = useState(false);

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

  // ─── Deterministic Reference Code for Incident Telemetry ─────────────────
  const [referenceCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `180-AUTH-${rand}`;
  });

  const isUriError = details?.type === 'REDIRECT_URI_MISMATCH' || errorDescription.toLowerCase().includes('redirect uri');
  const isOriginError = details?.type === 'ORIGIN_MISMATCH' || errorDescription.toLowerCase().includes('origin');

  const title = isUriError
    ? 'Redirect URI Not Whitelisted'
    : isOriginError
    ? 'Origin Not Authorized'
    : details?.type === 'CLIENT_NOT_FOUND'
    ? 'OAuth Client Not Found'
    : details?.type === 'AUTH_DISABLED'
    ? 'Authentication Disabled'
    : 'Configuration Error';

  const offendingValue = details?.requestedUri || details?.requestedOrigin || '';

  const handleCopyReferenceCode = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(referenceCode);
      setCopiedCode(true);
      toast.success(`Reference code copied: ${referenceCode}`);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyDetails = () => {
    const payload = JSON.stringify(
      {
        referenceCode,
        error,
        errorDescription,
        clientId: details?.clientId,
        requestedUri: details?.requestedUri,
        requestedOrigin: details?.requestedOrigin,
        registeredUris: details?.registeredUris,
        allowedOrigins: details?.allowedOrigins,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(payload);
      setCopiedDetails(true);
      toast.success('Full error diagnostic copied');
      setTimeout(() => setCopiedDetails(false), 2000);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (typeof window !== 'undefined') {
      const errorPayload = {
        type: '180_IDENTITY_ERROR',
        error,
        error_description: errorDescription,
        referenceCode,
        details,
      };
      const mobileChannel = (window as any).OneEightyMobileChannel;
      if (mobileChannel && typeof mobileChannel.postMessage === 'function') {
        try {
          mobileChannel.postMessage(JSON.stringify(errorPayload));
          mobileChannel.postMessage(JSON.stringify({ type: '180_IDENTITY_CLOSE' }));
        } catch (_) {}
      }
      try {
        window.postMessage(errorPayload, '*');
        window.postMessage({ type: '180_IDENTITY_CLOSE' }, '*');
      } catch (_) {}
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(errorPayload, '*');
        window.close();
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(errorPayload, '*');
        window.parent.postMessage({ type: '180_IDENTITY_CLOSE' }, '*');
      } else if (!mobileChannel) {
        window.history.back();
      }
    }
  };

  // ─── 1. PRODUCTION MODE: Clean Enterprise Fallback UI ──────────────────────
  if (isProduction && !showDevInspector) {
    return (
      <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-200 text-center font-sans">
        {/* Safe Brand Icon & Header */}
        <div className="flex flex-col items-center justify-center space-y-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 shadow-sm">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Unable to complete sign-in
            </h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              We encountered an issue while connecting your account. Please try again or return to the application.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-700 active:scale-[0.99] transition-all cursor-pointer shadow-sm min-h-[42px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleClose}
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
                {referenceCode}
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

  // ─── 2. DEVELOPMENT / INSPECTION MODE: Full Technical Diagnostic ──────────
  return (
    <div className="w-full space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left font-sans">
      {/* ─── Header Alert Badge ─── */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-900 shadow-sm relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700">
                180 Identity Dev Diagnostic
              </span>
              <span className="text-[10px] font-mono text-slate-600">
                {error || 'invalid_request'}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {title}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {errorDescription}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Detailed Technical Diagnostics ─── */}
      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2.5 text-xs">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            Diagnostics Summary
          </span>
          <button
            type="button"
            onClick={handleCopyDetails}
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
            {referenceCode}
          </code>
        </div>

        {details?.clientId ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Client ID</span>
            <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] text-slate-800 break-all select-all">
              {details.clientId}
            </code>
          </div>
        ) : null}

        {offendingValue ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-rose-500 font-semibold">
              {isUriError ? 'Unregistered Redirect URI' : 'Unwhitelisted Origin'}
            </span>
            <code className="bg-rose-50/80 border border-rose-200 px-2 py-1 rounded font-mono text-[11px] text-rose-700 break-all select-all font-semibold">
              {offendingValue}
            </code>
          </div>
        ) : null}

        {details?.registeredUris && details.registeredUris.length > 0 ? (
          <div className="flex flex-col gap-0.5 pt-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
              Currently Allowed URIs ({details.registeredUris.length})
            </span>
            <div className="max-h-24 overflow-y-auto space-y-1 bg-white p-1.5 rounded border border-slate-200">
              {details.registeredUris.map((u, i) => (
                <div key={i} className="font-mono text-[10px] text-slate-600 truncate">
                  • {u}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ─── Resolution Guide Callout ─── */}
      <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-blue-950">How to Fix This</p>
          <p className="text-blue-800/90 leading-relaxed text-[11px]">
            {details?.hint || (
              <>
                Add <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-blue-900">{offendingValue || 'your URI'}</code> to your application&apos;s allowed redirect URIs or origins in the{' '}
                <a
                  href="http://localhost:3008"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline hover:text-blue-950 inline-flex items-center gap-0.5"
                >
                  180 Developer Portal <ExternalLink className="w-2.5 h-2.5 inline" />
                </a>.
              </>
            )}
          </p>
        </div>
      </div>

      {/* ─── Action Controls ─── */}
      <div className="flex items-center gap-2 pt-1">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-800 active:scale-[0.99] transition-all cursor-pointer shadow-xs min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-verify</span>
          </button>
        ) : null}

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
          onClick={handleClose}
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
