'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getCoreApiUrl } from '@/lib/api';

export interface AppBranding {
  name: string;
  logoUrl?: string;
  description?: string;
  isVerified?: boolean;
  clientId?: string;
}

interface OAuthAppHeaderProps {
  clientId?: string;
  redirectUri?: string;
  scope?: string;
  app?: AppBranding | null;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  fallbackTitle?: React.ReactNode;
  fallbackSubtitle?: React.ReactNode;
  className?: string;
}

export function OAuthAppHeader({
  clientId,
  redirectUri,
  scope,
  app: initialApp,
  title,
  subtitle,
  fallbackTitle,
  fallbackSubtitle,
  className = '',
}: OAuthAppHeaderProps) {
  const [app, setApp] = useState<AppBranding | null>(initialApp || null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync initialApp if provided or updated by parent
  useEffect(() => {
    if (initialApp) {
      setApp(initialApp);
      setLogoFailed(false);
    }
  }, [initialApp]);

  // First priority: Try to fetch the app name and app logo from the developers portal
  useEffect(() => {
    if (initialApp || !clientId) return;

    let cancelled = false;
    const fetchApp = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.set('client_id', clientId);
        if (redirectUri) query.set('redirect_uri', redirectUri);
        if (scope) query.set('scope', scope);

        const res = await fetch(getCoreApiUrl(`/api/oauth/authorize/validate?${query.toString()}`), {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const appData = data.app || data.client;
          if (appData && !cancelled) {
            setApp({
              name: appData.name || clientId,
              logoUrl: appData.logoUrl || '',
              description: appData.description || '',
              isVerified: appData.isVerified ?? true,
              clientId: appData.clientId || clientId,
            });
            setLogoFailed(false);
          }
        }
      } catch (_) {
        // Server or network error: app stays null, graceful fallback kicks in
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchApp();
    return () => {
      cancelled = true;
    };
  }, [clientId, redirectUri, scope, initialApp]);

  // Priority 1: Check if app name and logo exist from developers portal
  const hasApp = Boolean(app && app.name && app.name.trim());
  const appName = hasApp ? app!.name.trim() : null;
  const hasValidLogo = Boolean(app?.logoUrl && app.logoUrl.trim() && !logoFailed);

  return (
    <div className={`flex flex-col items-center gap-2.5 pb-2 animate-in fade-in duration-300 ${className}`}>
      {/* 
        Logo:
        - Priority 1: App logo from developers portal (if available and loaded)
        - Fallback: Official black favicon icon (/black-icon.svg) if no logo, image error, or no app
      */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl border border-slate-200/90 shadow-sm bg-white overflow-hidden flex items-center justify-center p-2.5">
          {hasValidLogo ? (
            <img
              src={app!.logoUrl}
              alt={appName || 'App Logo'}
              className="w-full h-full object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <img
              src="/black-icon.svg"
              alt="180 Profile"
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.src.includes('icon.svg')) {
                  target.src = '/icon.svg';
                }
              }}
            />
          )}
        </div>
        {(app?.isVerified ?? true) && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* 
        Name & Subtitle:
        - Priority 1: Developer portal App Name
        - Fallback: Official "180profile" name if nothing is found
      */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          {hasApp ? (
            title || appName
          ) : (
            fallbackTitle || (
              <span>
                <span className="text-blue-600">180</span>profile
              </span>
            )
          )}
        </h2>
        <p className="text-xs text-slate-500">
          {hasApp
            ? subtitle || `Sign in to continue to ${appName}`
            : fallbackSubtitle || subtitle || 'Sign in with your 180 Profile'}
        </p>
      </div>
    </div>
  );
}
