'use client';

import React, { useState, useEffect } from 'react';

export interface OneEightyIdentityButtonProps {
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  /** Visual theme for the button.
   *  - `'auto'` — Automatically detects light / dark mode from system/document
   *  - `'light'` — Crisp white background with rainbow flowing border
   *  - `'dark'` / `'obsidian'` — Deep obsidian background with rainbow flowing border
   *  - `'gradient'` — Full gradient vibrant CTA
   */
  theme?: 'auto' | 'light' | 'dark' | 'obsidian' | 'gradient';
  /** Primary CTA label */
  text?: string;
  /** Secondary description line beneath the CTA */
  subtitle?: string;
  /** Label while popup is active */
  loadingText?: string;
  /** Label after popup closes while parent authenticates/redirects */
  processingText?: string;
  /** Direct link URL (optional, navigates if provided without JS SDK) */
  href?: string;
  /** Additional Tailwind classes on the outer wrapper */
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  onSuccess?: (res: any) => void | Promise<void>;
  onError?: (err: any) => void;
  onCancel?: () => void;
  disabled?: boolean;
  /** UX mode: 'popup' | 'bottom_sheet' | 'fullscreen' | 'redirect' | 'auto' */
  uxMode?: 'popup' | 'bottom_sheet' | 'fullscreen' | 'redirect' | 'auto';
  /** Manually control the processing / logging-in state */
  isProcessing?: boolean;
}

/* ── Inline SVG Icons ──────────────────────────────────────────────────────── */

const ChevronRightIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const LoadingSpinner = ({ className = '' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const CapricornGlyph = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5a5 5 0 0 1 5 5v2a3 3 0 0 1-6 0v-5a2 2 0 1 0-4 0v3" />
  </svg>
);

/* ── Shimmer & Border Flow CSS ─────────────────────────────────────────────── */

const SHIMMER_STYLE_ID = '__180_identity_btn_styles__';

const injectIdentityButtonStyles = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes identity-border-flow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes identity-shimmer {
      0% { transform: translateX(-150%) skewX(-15deg); }
      100% { transform: translateX(250%) skewX(-15deg); }
    }
    @keyframes identity-pulse-glow {
      0%, 100% { box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25), 0 4px 14px -1px rgba(37, 99, 235, 0.25); }
      50% { box-shadow: 0 0 0 4.5px rgba(37, 99, 235, 0.45), 0 6px 22px 0px rgba(37, 99, 235, 0.35); }
    }
    .identity-btn-shimmer::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(37,99,235,0.04) 25%,
        rgba(59,130,246,0.14) 50%,
        rgba(37,99,235,0.04) 75%,
        transparent 100%
      );
      animation: identity-shimmer 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      pointer-events: none;
      border-radius: inherit;
    }
    .identity-processing-active {
      animation: identity-border-flow 2s ease infinite, identity-pulse-glow 2s ease-in-out infinite !important;
    }
  `;
  document.head.appendChild(style);
};

export const OneEightyIdentityButton: React.FC<OneEightyIdentityButtonProps> = ({
  clientId = (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_CORE_CLIENT_ID || process.env?.NEXT_PUBLIC_180_CLIENT_ID || process.env?.NEXT_PUBLIC_IDENTITY_CLIENT_ID)) || '180_client_2d51a605038c38ffb6fa037688988a83',
  redirectUri,
  scope = 'openid identity:read identity:email',
  state,
  theme = 'auto',
  text = 'Continue with 180 Profile',
  subtitle,
  loadingText = 'Opening 180 Profile…',
  processingText = 'Signing in…',
  href,
  className = '',
  onClick,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  uxMode = 'auto',
  isProcessing: controlledProcessing,
}) => {
  const [internalOpening, setInternalOpening] = useState(false);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isSystemDark, setIsSystemDark] = useState(false);

  const isProcessing = controlledProcessing !== undefined ? controlledProcessing : internalProcessing;
  const isBusy = internalOpening || isProcessing;

  useEffect(() => {
    injectIdentityButtonStyles();
    if (typeof document !== 'undefined') {
      const checkDark = () => document.documentElement.classList.contains('dark');
      setIsSystemDark(checkDark());
      const observer = new MutationObserver(() => setIsSystemDark(checkDark()));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
      return;
    }

    if (isBusy || disabled) return;

    // If href is set and not invoking SDK modal, let default link navigation occur
    if (href && !window.OneEighty?.auth && !(window as any).OneEightyIdentity?.openAuth) {
      return;
    }

    e.preventDefault();
    setInternalOpening(true);

    try {
      // 1. Check window.OneEighty.auth (Universal 180 Core SDK)
      if (typeof window !== 'undefined' && (window as any).OneEighty?.auth?.signIn) {
        const res = await (window as any).OneEighty.auth.signIn({
          clientId,
          redirectUri,
          scope,
          state,
          uxMode,
          onSuccess: async (data: any) => {
            setInternalOpening(false);
            setInternalProcessing(true);
            try {
              if (onSuccess) await onSuccess(data);
            } finally {
              setInternalProcessing(false);
            }
          },
          onError: (err: any) => {
            setInternalOpening(false);
            setInternalProcessing(false);
            if (onError) onError(err);
          },
          onCancel: () => {
            setInternalOpening(false);
            setInternalProcessing(false);
            if (onCancel) onCancel();
          },
        });
        if (res && onSuccess) {
          await onSuccess(res);
        }
        return;
      }

      // 2. Check window.OneEightyIdentity (Direct 180 Identity SDK)
      if (typeof window !== 'undefined' && (window as any).OneEightyIdentity?.openAuth) {
        const res = await (window as any).OneEightyIdentity.openAuth({
          clientId,
          redirectUri,
          scope,
          state,
          uxMode,
        });
        setInternalOpening(false);
        setInternalProcessing(true);
        if (res && onSuccess) {
          await onSuccess(res);
        }
        setInternalProcessing(false);
        return;
      }

      // 3. Fallback: Direct Navigation / Popup
      const authUrl = href || `/auth/login?client_id=${encodeURIComponent(clientId)}`;
      if (uxMode === 'redirect') {
        window.location.href = authUrl;
      } else {
        const width = 480;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(
          authUrl,
          '180_Identity_Auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
        );
        if (popup) {
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              setInternalOpening(false);
              onCancel?.();
            }
          }, 800);
        } else {
          window.location.href = authUrl;
        }
      }
    } catch (err: any) {
      setInternalOpening(false);
      setInternalProcessing(false);
      if (onError) onError(err);
    }
  };

  const isDark = theme === 'dark' || theme === 'obsidian' || (theme === 'auto' && isSystemDark);
  const isGradient = theme === 'gradient';

  const containerStyle: React.CSSProperties = isGradient
    ? {
        background: 'linear-gradient(135deg, #2563eb, #4f46e5, #3b82f6, #1d4ed8)',
        boxShadow: isBusy
          ? '0 0 0 2px rgba(37, 99, 235, 0.35), 0 6px 20px rgba(37, 99, 235, 0.4)'
          : '0 4px 14px -1px rgba(37, 99, 235, 0.3), 0 2px 4px rgba(0, 0, 0, 0.05)',
      }
    : {
        border: '1.5px solid transparent',
        background: isDark
          ? 'linear-gradient(#09090b, #09090b) padding-box, linear-gradient(135deg, #2563eb, #4f46e5, #3b82f6, #1d4ed8) border-box'
          : 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, #2563eb, #4f46e5, #3b82f6, #1d4ed8) border-box',
        backgroundSize: '100% 100%, 250% 250%',
        animation: isBusy ? undefined : 'identity-border-flow 4s ease infinite',
        boxShadow: isBusy
          ? '0 0 0 2px rgba(37, 99, 235, 0.25), 0 4px 14px -1px rgba(37, 99, 235, 0.25)'
          : isDark
            ? '0 4px 16px -1px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px -1px rgba(37, 99, 235, 0.15), 0 1px 3px rgba(0, 0, 0, 0.04)',
      };

  const renderInnerContent = () => (
    <>
      {/* ── 1. Black Capricorn Brand Mark Badge ────────────────── */}
      <div
        className={`relative shrink-0 w-8 h-8 rounded-xl border transition-all duration-200 flex items-center justify-center ${
          isBusy
            ? 'bg-blue-50/80 border-blue-200 shadow-sm shadow-blue-500/10'
            : isDark
              ? 'bg-zinc-900 border-white/10 group-hover:scale-105'
              : 'bg-slate-50 border-slate-200/80 group-hover:scale-105 shadow-xs'
        }`}
      >
        {!imgError ? (
          <img
            src="/black icon.svg"
            alt="180 Profile"
            className={`w-4.5 h-4.5 object-contain ${isDark ? 'invert brightness-0' : ''}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <CapricornGlyph className={`w-4.5 h-4.5 ${isDark ? 'text-white' : 'text-zinc-900'}`} />
        )}

        {/* Live Status Pulse Dot */}
        {!isBusy && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-900" />
          </span>
        )}
      </div>

      {/* ── 2. Primary Label & Subtitle ──────────────────────── */}
      <div className="flex-1 text-left min-w-0 pr-1">
        <div
          className={`text-[13px] sm:text-[13.5px] font-bold leading-tight tracking-[-0.01em] flex items-center gap-1.5 ${
            isGradient
              ? 'text-white'
              : isDark
                ? 'text-zinc-100'
                : 'text-zinc-900'
          }`}
        >
          {isProcessing ? (
            <span className={isGradient ? 'text-white font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'}>
              {processingText}
            </span>
          ) : internalOpening ? (
            <span className={isGradient ? 'text-white font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'}>
              {loadingText}
            </span>
          ) : (
            text
          )}
        </div>

        {(isProcessing || internalOpening || subtitle) && (
          <div
            className={`text-[10px] font-medium mt-0.5 leading-tight truncate ${
              isGradient
                ? 'text-blue-100'
                : isDark
                  ? 'text-zinc-400'
                  : 'text-zinc-500'
            }`}
          >
            {isProcessing
              ? 'Verifying sovereign session…'
              : internalOpening
                ? 'Authenticate in the popup window'
                : subtitle}
          </div>
        )}
      </div>

      {/* ── 3. Interactive Chevron Arrow / Spinner ────────────── */}
      <div
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 ${
          isBusy
            ? isGradient
              ? 'text-white'
              : 'text-blue-600 dark:text-blue-400'
            : isGradient
              ? 'text-blue-100 group-hover:text-white'
              : 'text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
        }`}
      >
        {isBusy ? (
          <LoadingSpinner className="w-3.5 h-3.5" />
        ) : (
          <ChevronRightIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
        )}
      </div>
    </>
  );

  const sharedClasses = `
    identity-btn-shimmer
    group relative
    inline-flex items-center gap-3
    min-h-[46px]
    px-4 py-2
    rounded-2xl
    transition-all duration-200 ease-out
    hover:scale-[1.01] active:scale-[0.99]
    cursor-pointer select-none overflow-hidden
    outline-none
    ${isBusy ? 'identity-processing-active opacity-90' : ''}
    ${disabled ? 'opacity-60 pointer-events-none' : ''}
    ${className}
  `;

  if (href && !onClick) {
    return (
      <a
        href={href}
        onClick={handleClick}
        style={containerStyle}
        className={sharedClasses}
        aria-label={`${text} ${subtitle || ''}`}
      >
        {renderInnerContent()}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || isBusy}
      onClick={handleClick}
      style={containerStyle}
      className={sharedClasses}
      aria-label={`${text} ${subtitle || ''}`}
    >
      {renderInnerContent()}
    </button>
  );
};

export default OneEightyIdentityButton;
