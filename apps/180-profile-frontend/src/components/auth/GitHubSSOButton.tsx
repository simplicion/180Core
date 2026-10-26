'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { LogoLoader } from '@workspace/ui';
import { OAuthParams, dispatchOAuthSuccess } from './OAuthDispatchHelper';
import { getCoreApiUrl } from '@/lib/api';

interface GitHubSSOButtonProps {
  oauthParams: OAuthParams;
  label?: string;
  onSuccess?: (user: any, token: string, meta?: any) => void;
}

export function GitHubSSOButton({
  oauthParams,
  label = 'Continue with GitHub',
  onSuccess,
}: GitHubSSOButtonProps) {
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubClientId, setGithubClientId] = useState<string>(
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || ''
  );

  // Dynamic GitHub OAuth config resolution from core backend
  useEffect(() => {
    let isMounted = true;
    fetch(getCoreApiUrl('/api/oauth/github-config'))
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.clientId) {
          setGithubClientId(data.clientId);
        }
      })
      .catch((err) => {
        console.warn('[GitHubSSO] Dynamic config fetch skipped:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeClientId = githubClientId || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';

  // Listen for popup callback message
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.origin.startsWith(window.location.origin)) return;

      if (event.data?.type === 'GITHUB_AUTH_SUCCESS' && event.data?.code) {
        await handleCodeExchange(event.data.code);
      } else if (event.data?.type === 'GITHUB_AUTH_ERROR') {
        setGithubLoading(false);
        if (!event.data.error?.includes('cancelled')) {
          toast.error(event.data.error || 'GitHub authorization cancelled');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [oauthParams, onSuccess]);

  const handleCodeExchange = async (code: string) => {
    setGithubLoading(true);
    const toastId = toast.loading('Authenticating with GitHub...');

    try {
      const redirectUri = window.location.origin + '/auth/github/callback';
      const res = await fetch(getCoreApiUrl('/api/oauth/github-continue'), {
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

      toast.success('Signed in with GitHub!', { id: toastId });

      if (onSuccess) {
        onSuccess(data.user, data.token, data);
      } else {
        await dispatchOAuthSuccess(data.user, data.token, oauthParams);
      }
    } catch (err: any) {
      toast.error(err.message || 'GitHub authentication failed', { id: toastId });
    } finally {
      setGithubLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (!activeClientId) {
      toast.error('GitHub Client ID is not configured');
      return;
    }

    setGithubLoading(true);
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/github/callback');
    const state = Math.random().toString(36).substring(2, 15);
    const scope = encodeURIComponent('read:user user:email');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
      activeClientId
    )}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'github_oauth_popup',
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
          setGithubLoading(false);
        }, 1000);
      }
    }, 500);
  };

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={githubLoading}
        onClick={handleButtonClick}
        className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 font-semibold text-xs transition-all shadow-xs hover:shadow-sm active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
      >
        {githubLoading ? (
          <div className="flex items-center gap-2">
            <LogoLoader size={16} color="primary" />
            <span>Connecting to GitHub...</span>
          </div>
        ) : (
          <>
            <svg className="w-4 h-4 text-slate-900 dark:text-white fill-current shrink-0" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>{label}</span>
          </>
        )}
      </button>
    </div>
  );
}
