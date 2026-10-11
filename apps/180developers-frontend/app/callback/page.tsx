'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const err = urlParams.get('error') || urlParams.get('error_description');

      if (err) {
        setError(err);
        toast.error(`Authentication error: ${err}`);
        return;
      }

      if (!code) {
        setError('No authorization code provided in the callback URL.');
        return;
      }

      // If opened in popup mode, communicate back to opener
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: '180_IDENTITY_SUCCESS', code },
          window.location.origin
        );
        window.close();
        return;
      }

      // Otherwise handle full-page redirect grant
      try {
        const isLocal =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        const apiBase = isLocal ? (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003') : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com');
        const redirectUri = window.location.origin + '/callback';

        const tokenPayload = {
          grant_type: 'authorization_code',
          client_id: '180-developer-portal',
          code,
          redirect_uri: redirectUri,
        };

        let tokenRes = await fetch(`${apiBase}/api/v1/identity/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenPayload),
        });

        if (!tokenRes.ok && tokenRes.status === 404) {
          tokenRes = await fetch(`${apiBase}/api/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenPayload),
          });
        }

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(
            tokenData.error_description || tokenData.error || 'Token exchange failed'
          );
        }

        const token = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;

        localStorage.setItem('platform_auth_token', token);
        if (refreshToken) localStorage.setItem('platform_refresh_token', refreshToken);

        // Fetch user profile to store locally as well
        try {
          const userRes = await fetch(`${apiBase}/api/oauth/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (_) {}

        const isProd = window.location.protocol === 'https:';
        const is180 = window.location.hostname.endsWith('180workspace.com');
        const domainAttr = is180 ? '; domain=.180workspace.com' : '';
        const cookieFlags = `; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${
          isProd ? '; Secure' : ''
        }${domainAttr}`;
        document.cookie = `platform_auth_token=${token}${cookieFlags}`;

        toast.success('Successfully authenticated as 180 Developer!');
        router.replace('/dashboard');
      } catch (e: any) {
        console.error('Callback error:', e);
        setError(e.message || 'Failed to complete authentication.');
        toast.error(e.message || 'Failed to complete authentication.');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)] text-[var(--foreground)]">
      <div className="w-full max-w-md p-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
          <ShieldCheck className="w-8 h-8" />
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
              <AlertCircle className="w-4 h-4" />
              <span>Authentication Error</span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
            <button
              onClick={() => router.replace('/')}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Return to Developer Portal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Authenticating Developer Account...</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Exchanging your authorization credentials with 180 Identity.
            </p>
            <div className="flex justify-center pt-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
