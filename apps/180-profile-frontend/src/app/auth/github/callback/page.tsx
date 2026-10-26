'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LogoLoader } from '@workspace/ui';
import { getCoreApiUrl } from '@/lib/api';

export default function GitHubOAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<string>('Completing GitHub authorization...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const authError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (authError) {
      const msg = errorDescription || authError || 'GitHub authorization was cancelled';
      setError(msg);
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GITHUB_AUTH_ERROR', error: msg },
          window.location.origin
        );
        setTimeout(() => window.close(), 1000);
      }
      return;
    }

    if (!code) {
      setError('No authorization code received from GitHub.');
      return;
    }

    // If opened in a popup by GitHubSSOButton
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'GITHUB_AUTH_SUCCESS', code, state },
          window.location.origin
        );
        setStatus('Authorized! Returning to application...');
        setTimeout(() => {
          window.close();
        }, 300);
        return;
      } catch (err) {
        console.warn('[GitHubCallback] postMessage error, falling back to direct exchange:', err);
      }
    }

    // Direct exchange fallback if not in a popup
    async function directExchange() {
      try {
        setStatus('Verifying GitHub credentials...');
        const redirectUri = window.location.origin + '/auth/github/callback';
        const res = await fetch(getCoreApiUrl('/api/oauth/github-continue'), {
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
          setError(data.message || 'GitHub authentication exchange failed');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to connect to authentication server');
      }
    }

    directExchange();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6 shadow-xl">
        <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          />
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
