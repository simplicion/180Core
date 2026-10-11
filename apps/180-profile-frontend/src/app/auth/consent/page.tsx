'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Shield,
  CheckCircle2,
  Lock,
  User,
  CreditCard,
  Mail,
  Smartphone,
  Sparkles,
  ArrowRight,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { OAuthErrorCard, OAuthErrorDetails } from '@/components/auth/OAuthErrorCard';
import { OAuthAppHeader } from '@/components/auth/OAuthAppHeader';
import { LogoLoader } from '@workspace/ui';
import { getCoreApiUrl } from '@/lib/api';

const SCOPE_DESCRIPTIONS: Record<string, { title: string; description: string; icon: any }> = {
  openid: {
    title: 'Verify Your Identity',
    description: 'Confirms your unique 180 Profile subject ID across platforms.',
    icon: Shield,
  },
  'identity:profile': {
    title: 'Access Basic Profile',
    description: 'Reads your display name, username, and profile avatar.',
    icon: User,
  },
  'identity:email': {
    title: 'Access Verified Email',
    description: 'Reads your primary verified email address for account sync.',
    icon: Mail,
  },
  'identity:phone': {
    title: 'Access Phone Number',
    description: 'Reads your WhatsApp number for verified transactional alerts.',
    icon: Smartphone,
  },
  'wallet:pay': {
    title: '1-Click 180 Pay',
    description: 'Allows authorization of payments from your 180 Wallet balance.',
    icon: CreditCard,
  },
};

function ConsentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const clientId = searchParams.get('client_id') || '180-developer-client';
  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';
  const rawScopes = searchParams.get('scope') || 'openid identity:profile identity:email';

  const scopes = rawScopes.split(' ').filter(Boolean);

  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [oauthError, setOauthError] = useState<{
    error: string;
    errorDescription: string;
    details?: OAuthErrorDetails;
  } | null>(null);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');

    fetch(getCoreApiUrl('/api/oauth/userinfo'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.user || data.id || data.email)) {
          setUser(data.user || data);
        } else {
          // If not authenticated, redirect to login with query params
          const currentQuery = window.location.search;
          router.replace(`/auth/login${currentQuery}`);
        }
      })
      .catch(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch (_) {}
        }
      })
      .finally(() => setLoading(false));

    // Priority 1: Fetch app name and logo from developers portal
    if (clientId) {
      const query = new URLSearchParams();
      query.set('client_id', clientId);
      if (redirectUri) query.set('redirect_uri', redirectUri);
      if (rawScopes) query.set('scope', rawScopes);

      fetch(getCoreApiUrl(`/api/oauth/authorize/validate?${query.toString()}`), {
        credentials: 'include',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const appData = data?.app || data?.client;
          if (appData) {
            setAppInfo({
              name: appData.name || clientId,
              logoUrl: appData.logoUrl || '',
              description: appData.description || '',
              isVerified: appData.isVerified ?? true,
              clientId: appData.clientId || clientId,
            });
          }
        })
        .catch(() => {});
    }
  }, [clientId, redirectUri, rawScopes, router]);

  const handleAuthorize = async () => {
    setAuthorizing(true);
    try {
      const token =
        localStorage.getItem('platform_auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        '';

      const res = await fetch(getCoreApiUrl('/api/oauth/authorize/consent'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: rawScopes,
          state,
          action: 'allow',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.code) {
        const errorDesc = data.error_description || data.message || data.error || 'Authorization failed';
        setOauthError({
          error: data.error || 'invalid_request',
          errorDescription: errorDesc,
          details: data.details,
        });
        throw new Error(errorDesc);
      }

      const authCode = data.code;
      const idToken = data.id_token || '';

      const effectiveToken = token || idToken;

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: '180_IDENTITY_SUCCESS',
            code: authCode,
            token: effectiveToken,
            accessToken: effectiveToken,
            authToken: token || '',
            id_token: idToken || null,
            state,
            user,
          },
          '*'
        );
        window.opener.postMessage(
          {
            type: '180_AUTH_SUCCESS',
            code: authCode,
            state,
          },
          '*'
        );
        setTimeout(() => window.close(), 300);
      } else if (redirectUri) {
        const targetUrl = new URL(redirectUri);
        targetUrl.searchParams.set('code', authCode);
        if (state) targetUrl.searchParams.set('state', state);
        window.location.href = targetUrl.toString();
      } else {
        router.push('/');
      }
    } catch (err: any) {
      console.error('Consent authorization failed:', err);
    } finally {
      setAuthorizing(false);
    }
  };

  const handleDeny = () => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: '180_AUTH_DENIED',
          error: 'access_denied',
          state,
        },
        '*'
      );
      window.close();
    } else if (redirectUri) {
      const targetUrl = new URL(redirectUri);
      targetUrl.searchParams.set('error', 'access_denied');
      if (state) targetUrl.searchParams.set('state', state);
      window.location.href = targetUrl.toString();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900 font-sans relative">
      {oauthError ? (
        <OAuthErrorCard
          error={oauthError.error}
          errorDescription={oauthError.errorDescription}
          details={oauthError.details}
          onRetry={() => {
            setOauthError(null);
            handleAuthorize();
          }}
          onClose={() => setOauthError(null)}
        />
      ) : (
        <>
      {/* Header / Brand Connection Visual */}
      <OAuthAppHeader
        clientId={clientId}
        redirectUri={redirectUri}
        scope={rawScopes}
        app={appInfo}
        title={
          <span>
            Authorize <span className="text-blue-600">{appInfo?.name || 'Application'}</span>
          </span>
        }
        subtitle={`${appInfo?.name || 'Application'} is requesting permission to access your identity details.`}
        fallbackTitle={
          <span>
            Authorize with <span className="text-blue-600">180</span>profile
          </span>
        }
        fallbackSubtitle="Permission is requested to access your 180 Profile details."
      />

      {/* Logged in User Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div className="font-bold text-slate-900">{user?.name || '180 User'}</div>
            <div className="text-[11px] text-slate-500 font-mono">@{user?.username || 'user_180'}</div>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Signed In
        </span>
      </div>

      {/* Requested Scopes */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Requested Permissions
        </h2>
        <div className="space-y-2">
          {scopes.map((scope) => {
            const info = SCOPE_DESCRIPTIONS[scope] || {
              title: scope,
              description: `Permission to access ${scope} resources.`,
              icon: Shield,
            };
            const Icon = info.icon;

            return (
              <div
                key={scope}
                className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/90 flex items-start gap-3 text-xs"
              >
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">{info.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {info.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions (Min 44x44px touch targets) */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleAuthorize}
          disabled={authorizing}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 shadow-md shadow-blue-600/20"
        >
          {authorizing ? (
            <LogoLoader size={16} className="w-4 h-4 text-white" />
          ) : (
            <>
              <img
                src="/black icon.svg"
                alt=""
                className="w-3.5 h-3.5 object-contain brightness-0 invert"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (!target.src.includes('black-icon')) target.src = '/black-icon.svg';
                }}
              />
              <span>Authorize & Continue</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDeny}
          disabled={authorizing}
          className="w-full py-2.5 min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>Cancel & Deny</span>
        </button>
      </div>

      {/* Security Footer */}
      <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3 text-emerald-600" />
        <span>End-to-End Cryptographic RS256 Verification</span>
      </div>
        </>
      )}
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3 text-slate-500 text-xs">
          <LogoLoader size={32} className="w-8 h-8 text-blue-600 animate-spin" />
          <p>Loading consent screen...</p>
        </div>
      }
    >
      <ConsentForm />
    </Suspense>
  );
}
