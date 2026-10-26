'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LogoLoader } from '@workspace/ui';
import { getCoreApiUrl } from '@/lib/api';

function LinkedInCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<string>('Completing LinkedIn authorization...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const authError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (authError) {
      const msg = errorDescription || authError || 'LinkedIn authentication was cancelled';
      setError(msg);
      if (window.opener) {
        window.opener.postMessage(
          { type: 'LINKEDIN_AUTH_ERROR', error: msg },
          window.location.origin
        );
        setTimeout(() => window.close(), 1000);
      }
      return;
    }

    if (!code) {
      setError('No authorization code received from LinkedIn.');
      return;
    }

    // If opened in a popup by LinkedInSSOButton
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'LINKEDIN_AUTH_SUCCESS', code, state },
          window.location.origin
        );
        setStatus('Authorized! Returning to application...');
        setTimeout(() => {
          window.close();
        }, 300);
        return;
      } catch (err) {
        console.warn('[LinkedInCallback] postMessage error, falling back to direct exchange:', err);
      }
    }

    // Direct exchange fallback if not in a popup
    async function directExchange() {
      try {
        setStatus('Verifying LinkedIn credentials...');
        const redirectUri = window.location.origin + '/auth/linkedin/callback';
        const res = await fetch(getCoreApiUrl('/api/oauth/linkedin-continue'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, redirectUri }),
        });

        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('auth_token', data.token);
          setStatus('Authentication successful! Redirecting...');
          router.replace('/auth/login');
        } else {
          setError(data.message || 'LinkedIn authentication exchange failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to connect to authentication server');
      }
    }

    directExchange();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0A66C2]/15 border border-[#0A66C2]/30 flex items-center justify-center mb-6 shadow-xl">
        <svg className="w-8 h-8 text-[#0A66C2] fill-current" viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46v-8.37M7.85 6.27a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
        </svg>
      </div>

      {error ? (
        <div className="max-w-md bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          <p className="font-semibold mb-1">Authentication Error</p>
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <LogoLoader size={36} color="primary" />
          <p className="text-sm font-medium text-slate-300">{status}</p>
        </div>
      )}
    </div>
  );
}

export default function LinkedInOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
          <LogoLoader size={36} color="primary" />
        </div>
      }
    >
      <LinkedInCallbackContent />
    </Suspense>
  );
}

