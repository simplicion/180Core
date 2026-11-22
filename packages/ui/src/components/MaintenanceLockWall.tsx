'use client';

import * as React from 'react';
import {
  Lock,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from './Button';
import { OneEightyCoreLogo } from './OneEightyCoreLogo';

export interface MaintenanceLockWallProps {
  /**
   * Mode: 'platform' for developer portal / console, or 'payment' for payment bottom sheet
   */
  mode?: 'platform' | 'payment';
  /**
   * Custom headline title
   */
  title?: string;
  /**
   * Subtitle eyebrow or category
   */
  subtitle?: string;
  /**
   * Explanatory message
   */
  description?: string;
  /**
   * Estimated completion time
   */
  estimatedTime?: string;
  /**
   * Render as full-screen viewport overlay or inline container
   */
  fullScreen?: boolean;
  /**
   * Whether to render in a compact card format (e.g. for bottom sheets)
   */
  compact?: boolean;
  /**
   * Callback when retry/refresh is clicked
   */
  onRetry?: () => void;
  /**
   * Callback when dismiss/close is clicked (for bottom sheets)
   */
  onDismiss?: () => void;
  /**
   * Whether to allow an emergency bypass for engineers via query param or passkey
   */
  allowBypass?: boolean;
  /**
   * Optional custom children to render behind a blurred overlay
   */
  children?: React.ReactNode;
  /**
   * Additional custom CSS classes
   */
  className?: string;
}

export function MaintenanceLockWall({
  mode = 'platform',
  title,
  subtitle,
  description,
  estimatedTime = 'Under 2 hours',
  fullScreen = true,
  compact = false,
  onRetry,
  onDismiss,
  allowBypass = true,
  children,
  className = '',
}: MaintenanceLockWallProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isBypassed, setIsBypassed] = React.useState(false);

  // Check if bypass exists in URL or sessionStorage
  React.useEffect(() => {
    if (!allowBypass) return;
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('bypass') === '1' || params.get('bypass') === 'true' || params.get('admin') === '1') {
          sessionStorage.setItem('__180_maintenance_bypass__', 'true');
          setIsBypassed(true);
        } else if (sessionStorage.getItem('__180_maintenance_bypass__') === 'true') {
          setIsBypassed(true);
        }
      }
    } catch (_) {}
  }, [allowBypass]);

  const handleRetry = () => {
    setIsRetrying(true);
    if (onRetry) {
      onRetry();
    }
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      setIsRetrying(false);
    }, 800);
  };

  const handleClose = () => {
    if (onDismiss) {
      onDismiss();
    }
    // Dispatch standard 180 close events across windows and parent frames
    if (typeof window !== 'undefined') {
      try {
        window.parent.postMessage({ type: '180_PAYMENT_CLOSE' }, '*');
        window.parent.postMessage({ type: '180_PAY_CLOSE' }, '*');
        window.parent.postMessage({ type: '180_MODAL_CLOSE' }, '*');
      } catch (_) {}
    }
  };

  if (isBypassed) {
    return <>{children}</>;
  }

  const isPaymentMode = mode === 'payment' || compact;

  const defaultTitle = isPaymentMode
    ? '180 Pay Under Scheduled Maintenance'
    : '180 Core Platform Under Scheduled Maintenance';

  const defaultSubtitle = isPaymentMode
    ? 'Payment Gateway & Settlements Paused'
    : 'Essential Infrastructure & Security Upgrade';

  const defaultDescription = isPaymentMode
    ? 'Our payment clearing engine is currently undergoing routine sovereign maintenance. Payment checkouts, UPI captures, and automated settlements are temporarily locked to protect your transactions.'
    : 'We are actively performing critical infrastructure upgrades and database optimizations. Console controls, project management, and developer services are temporarily locked to ensure total data integrity.';

  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;
  const displayDescription = description || defaultDescription;

  // Compact layout (Bottom Sheet / Popup format)
  if (isPaymentMode) {
    return (
      <div
        className={`relative w-full rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#101012] border border-zinc-200/80 dark:border-white/10 shadow-2xl flex flex-col items-center text-center space-y-5 animate-in fade-in duration-200 ${className}`}
      >
        {/* Close Button if onDismiss or popup mode */}
        {onDismiss && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Brand Icon & Glowing Maintenance Lock */}
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8 text-amber-500 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-[#101012]" />
          </span>
        </div>

        {/* Status Pill Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-wider uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Maintenance Lock Active</span>
        </div>

        {/* Text Details */}
        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {displayTitle}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {displayDescription}
          </p>
        </div>

        {/* Security Assurance Pill */}
        <div className="w-full max-w-sm rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/5 p-3 flex items-center gap-2.5 text-left text-xs text-zinc-600 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Your cart and balance are fully protected. Zero funds will be deducted.</span>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-sm flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <Button
            type="button"
            variant="default"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full rounded-2xl py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[42px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Checking System...' : 'Check Status'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full rounded-2xl py-2.5 border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition-all cursor-pointer min-h-[42px]"
          >
            <span>Close Sheet</span>
          </Button>
        </div>
      </div>
    );
  }

  // Full-Screen Platform Maintenance Wall (for Developer Portal / Dashboard)
  return (
    <div
      className={`${
        fullScreen
          ? 'fixed inset-0 z-50 overflow-y-auto min-h-screen'
          : 'relative w-full min-h-[500px] rounded-3xl'
      } bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 transition-colors duration-200`}
    >
      {/* Background Decorative Mesh & Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl opacity-70" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-t from-blue-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative z-10 max-w-xl w-full p-6 sm:p-10 rounded-3xl sm:rounded-[32px] border border-zinc-200/80 dark:border-white/10 bg-white/90 dark:bg-[#101012]/90 backdrop-blur-xl shadow-2xl text-center space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 pb-1">
          <OneEightyCoreLogo variant="compact" height={28} />
        </div>

        {/* Lock Graphic */}
        <div className="relative inline-flex mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/10">
            <Lock className="w-10 h-10 text-amber-500 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500 border-2 border-white dark:border-[#101012]" />
          </span>
        </div>

        {/* Eyebrow & Status Pill */}
        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold font-mono tracking-wider uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Platform Maintenance Lock Active</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
            {displaySubtitle}
          </span>
        </div>

        {/* Main Title & Description */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white leading-tight">
            {displayTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-lg mx-auto">
            {displayDescription}
          </p>
        </div>

        {/* Info Grid: Security Guarantee & Window */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Zero Data Loss</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              All client keys, user sessions, and balance ledgers remain safely preserved.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Maintenance Window</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              {estimatedTime}. Live updates stream automatically upon reconnect.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Checking System...' : 'Check System Status'}</span>
          </Button>

          {allowBypass && (
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('__180_maintenance_bypass__', 'true');
                setIsBypassed(true);
              }}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white px-3 py-2 transition-colors cursor-pointer"
            >
              Developer Bypass
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MaintenanceLockWall;
