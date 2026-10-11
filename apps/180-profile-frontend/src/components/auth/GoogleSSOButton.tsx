'use client';

import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { LogoLoader } from '@workspace/ui';
import { OAuthParams, dispatchOAuthSuccess } from './OAuthDispatchHelper';
import { getCoreApiUrl } from '@/lib/api';

interface GoogleSSOButtonProps {
  oauthParams: OAuthParams;
  label?: string;
  onSuccess?: (user: any, token: string, meta?: any) => void;
}

export function GoogleSSOButton({
  oauthParams,
  label = 'Continue with Google',
  onSuccess,
}: GoogleSSOButtonProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const tokenClientRef = useRef<any>(null);

  const GOOGLE_CLIENT_ID =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '188560578303-2bih1dg5qhbq5uao9q451r6db3986e6f.apps.googleusercontent.com';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!GOOGLE_CLIENT_ID) return;

    const setupGoogle = () => {
      try {
        if ((window as any).google?.accounts?.oauth2) {
          tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile openid',
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                setGoogleLoading(false);
                if (tokenResponse.error !== 'access_denied') {
                  toast.error(`Google Sign-In: ${tokenResponse.error}`);
                }
                return;
              }

              if (tokenResponse.access_token) {
                await handleGoogleAccessToken(tokenResponse.access_token);
              }
            },
          });
        }
      } catch (err) {
        console.warn('[180 Identity] Google OAuth initialization:', err);
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      setupGoogle();
    } else {
      const existing = document.getElementById('google-gsi-client');
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = setupGoogle;
        document.head.appendChild(script);
      } else {
        existing.addEventListener('load', setupGoogle);
      }
    }
  }, [GOOGLE_CLIENT_ID]);

  const handleGoogleAccessToken = async (accessToken: string) => {
    setGoogleLoading(true);
    const toastId = toast.loading('Authenticating with Google Identity...');

    try {
      // Proactively fetch Google userinfo to guarantee profile resolution
      let profileData: any = {};
      try {
        const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (uRes.ok) {
          profileData = await uRes.json();
        }
      } catch (e) {
        console.warn('[GoogleSSO] Client userinfo fetch notice:', e);
      }

      // Send access token and profile info to backend for server-side verification and user sync
      const res = await fetch(getCoreApiUrl('/api/oauth/google-continue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accessToken,
          email: profileData?.email,
          name: profileData?.name,
          avatar: profileData?.picture,
          googleId: profileData?.sub,
        }),
      });

      let data: any = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { success: false, message: `Server returned HTTP ${res.status}` };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || `Server returned HTTP ${res.status}`);
      }

      toast.success('Signed in with Google!', { id: toastId });

      if (onSuccess) {
        onSuccess(data.user, data.token, data);
      } else {
        await dispatchOAuthSuccess(data.user, data.token, oauthParams);
      }
    } catch (err: any) {
      toast.error(err.message || 'Google authentication failed', { id: toastId });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google Sign-In is being initialized. Please use Email or WhatsApp OTP.');
      return;
    }

    if (tokenClientRef.current) {
      setGoogleLoading(true);
      tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
    } else if ((window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              await handleGoogleAccessToken(tokenResponse.access_token);
            } else {
              setGoogleLoading(false);
            }
          },
        });
        tokenClientRef.current = client;
        setGoogleLoading(true);
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (e: any) {
        setGoogleLoading(false);
        console.warn('[GoogleSSO] Token client init error:', e);
        if (e?.message?.includes('client_id')) {
          toast.error('Google Sign-In configuration error. Please use Email or WhatsApp OTP.');
        } else {
          toast.error('Google Sign-In is initializing. Please try again in a moment.');
        }
      }
    } else {
      toast.error('Google Sign-In script is loading. Please try again in a second.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleButtonClick}
      disabled={googleLoading}
      className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-xs flex items-center justify-center gap-3 transition-all hover:border-slate-300 cursor-pointer disabled:opacity-50"
    >
      {googleLoading ? (
        <LogoLoader size={16} className="w-4 h-4 text-blue-600" />
      ) : (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      )}
      <span>{googleLoading ? 'Connecting to Google...' : label}</span>
    </button>
  );
}
