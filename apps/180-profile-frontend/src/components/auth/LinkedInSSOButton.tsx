'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { LogoLoader } from '@workspace/ui';
import { OAuthParams, dispatchOAuthSuccess } from './OAuthDispatchHelper';
import { getCoreApiUrl } from '@/lib/api';

interface LinkedInSSOButtonProps {
  oauthParams: OAuthParams;
  label?: string;
  onSuccess?: (user: any, token: string, meta?: any) => void;
}

export function LinkedInSSOButton({
  oauthParams,
  label = 'Continue with LinkedIn',
  onSuccess,
}: LinkedInSSOButtonProps) {
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinClientId, setLinkedinClientId] = useState<string>(
    process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || ''
  );

  // Dynamic LinkedIn OAuth config resolution from core backend
  useEffect(() => {
    let isMounted = true;
    fetch(getCoreApiUrl('/api/oauth/linkedin-config'))
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.clientId) {
          setLinkedinClientId(data.clientId);
        }
      })
      .catch((err) => {
        console.warn('[LinkedInSSO] Dynamic config fetch skipped:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeClientId = linkedinClientId || process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || '';

  // Listen for popup callback message
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.origin.startsWith(window.location.origin)) return;

      if (event.data?.type === 'LINKEDIN_AUTH_SUCCESS' && event.data?.code) {
        await handleCodeExchange(event.data.code);
      } else if (event.data?.type === 'LINKEDIN_AUTH_ERROR') {
        setLinkedinLoading(false);
        if (!event.data.error?.includes('cancelled')) {
          toast.error(event.data.error || 'LinkedIn authentication cancelled');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [oauthParams, onSuccess]);

  const handleCodeExchange = async (code: string) => {
    setLinkedinLoading(true);
    const toastId = toast.loading('Authenticating with LinkedIn Identity...');

    try {
      const redirectUri = window.location.origin + '/auth/linkedin/callback';
      const res = await fetch(getCoreApiUrl('/api/oauth/linkedin-continue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, redirectUri }),
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

      toast.success('Signed in with LinkedIn!', { id: toastId });

      if (onSuccess) {
        onSuccess(data.user, data.token, data);
      } else {
        await dispatchOAuthSuccess(data.user, data.token, oauthParams);
      }
    } catch (err: any) {
      toast.error(err.message || 'LinkedIn authentication failed', { id: toastId });
    } finally {
      setLinkedinLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (!activeClientId) {
      toast.error('LinkedIn Client ID is not configured');
      return;
    }

    setLinkedinLoading(true);
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/linkedin/callback');
    const state = Math.random().toString(36).substring(2, 15);
    const scope = encodeURIComponent('openid profile email');
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${encodeURIComponent(
      activeClientId
    )}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'linkedin_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=0,toolbar=0,menubar=0`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Fallback to full page redirect if popup blocked
      window.location.href = authUrl;
      return;
    }

    // Safety poll to check if popup closed without completing
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setTimeout(() => {
          setLinkedinLoading(false);
        }, 1000);
      }
    }, 500);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={linkedinLoading}
        onClick={handleButtonClick}
        className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 font-semibold text-xs transition-all shadow-xs hover:shadow-sm active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
      >
        {linkedinLoading ? (
          <div className="flex items-center gap-2">
            <LogoLoader size={16} color="primary" />
            <span>Connecting to LinkedIn...</span>
          </div>
        ) : (
          <>
            <svg className="w-4 h-4 text-[#0A66C2] fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46v-8.37M7.85 6.27a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
            </svg>
            <span>{label}</span>
          </>
        )}
      </button>
    </div>
  );
}
