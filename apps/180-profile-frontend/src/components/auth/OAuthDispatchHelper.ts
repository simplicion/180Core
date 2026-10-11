import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';

export interface OAuthParams {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce: string;
}

export function extractOAuthParams(searchParams: URLSearchParams): OAuthParams {
  return {
    clientId: searchParams.get('client_id') || '180-workspace-platform',
    redirectUri: searchParams.get('redirect_uri') || '',
    state: searchParams.get('state') || '',
    scope: searchParams.get('scope') || 'openid identity:read identity:email',
    codeChallenge: searchParams.get('code_challenge') || '',
    codeChallengeMethod: searchParams.get('code_challenge_method') || 'S256',
    nonce: searchParams.get('nonce') || '',
  };
}

export function buildOAuthQueryString(params: OAuthParams): string {
  const q = new URLSearchParams();
  if (params.clientId) q.set('client_id', params.clientId);
  if (params.redirectUri) q.set('redirect_uri', params.redirectUri);
  if (params.state) q.set('state', params.state);
  if (params.scope) q.set('scope', params.scope);
  if (params.codeChallenge) q.set('code_challenge', params.codeChallenge);
  if (params.codeChallengeMethod) q.set('code_challenge_method', params.codeChallengeMethod);
  if (params.nonce) q.set('nonce', params.nonce);
  const str = q.toString();
  return str ? `?${str}` : '';
}

export function resolveAppName(clientId: string): string {
  if (clientId === '180-workspace-platform') return '180 Workspace';
  if (clientId === '180-developer-portal') return '180 Developers';
  if (clientId === '180-traffic-director' || clientId === '180_client_b26aee801c22cb3295f041ff2a3597db') return '180 Traffic Director';
  if (clientId === '180-profile') return '180 Profile';
  return clientId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export async function dispatchOAuthSuccess(
  userData: any,
  tokenData: string | undefined,
  params: OAuthParams
) {
  const authToken = tokenData || localStorage.getItem('platform_auth_token') || '';

  try {
    if (authToken) {
      localStorage.setItem('platform_auth_token', authToken);
      document.cookie = `platform_auth_token=${authToken}; path=/; max-age=604800; SameSite=Lax`;
    }
    localStorage.setItem('user', JSON.stringify(userData));
  } catch (_) {}

  let authCode = '';
  let idToken = '';

  try {
    const consentRes = await fetch(getCoreApiUrl('/api/oauth/authorize/consent'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        scope: params.scope,
        state: params.state,
        action: 'allow',
        code_challenge: params.codeChallenge,
        code_challenge_method: params.codeChallengeMethod,
        nonce: params.nonce,
      }),
    });

    if (consentRes.ok) {
      const consentData = await consentRes.json();
      authCode = consentData.code || '';
      idToken = consentData.id_token || consentData.credential || '';
    } else {
      const errorData = await consentRes.json().catch(() => ({}));
      const errorDesc = errorData.error_description || errorData.message || errorData.error || 'Authorization failed';
      
      const errorPayload = {
        type: '180_IDENTITY_ERROR',
        error: errorData.error || 'invalid_request',
        error_description: errorDesc,
        details: errorData.details,
      };

      if (typeof window !== 'undefined') {
        const mobileChannel = (window as any).OneEightyMobileChannel;
        if (mobileChannel && typeof mobileChannel.postMessage === 'function') {
          try {
            mobileChannel.postMessage(JSON.stringify(errorPayload));
          } catch (_) {}
        }
        try {
          window.postMessage(errorPayload, '*');
          window.dispatchEvent(new CustomEvent('180_IDENTITY_ERROR', { detail: errorPayload }));
        } catch (_) {}
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(errorPayload, '*');
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(errorPayload, '*');
        }
      }

      const err: any = new Error(errorDesc);
      err.data = errorData;
      throw err;
    }
  } catch (err: any) {
    console.warn('[180 Identity] Consent dispatch error:', err);
    throw err;
  }

  // Cross-window popup, mobile webview bridge, and embedded iframe communication
  const fullUser = userData ? {
    id: userData.id || userData.sub || '',
    email: userData.email || null,
    name: userData.name || '',
    username: userData.username || '',
    phone: userData.phone || null,
    avatar: userData.avatarUrl || userData.avatar || '',
    avatarUrl: userData.avatarUrl || userData.avatar || '',
    headline: userData.headline || userData.tagline || '',
    tagline: userData.tagline || userData.headline || '',
    bio: userData.bio || '',
    languages: userData.languages || [],
    gender: userData.gender || '',
    dob: userData.dob || null,
    age: userData.age || null,
    address: userData.address || '',
    city: userData.city || '',
    country: userData.country || '',
    role: userData.role || 'USER',
    isVerified: Boolean(userData.isVerified),
    isOnboarded: Boolean(userData.isOnboarded),
    isEmailVerified: Boolean(userData.isEmailVerified),
    isPhoneVerified: Boolean(userData.isPhoneVerified),
    securityPreferences: userData.securityPreferences || {},
  } : userData;

  const effectiveToken = authToken || idToken;

  const payload = {
    type: '180_IDENTITY_SUCCESS',
    code: authCode,
    token: effectiveToken,
    accessToken: effectiveToken,
    authToken: authToken || '',
    id_token: idToken || null,
    state: params.state,
    user: fullUser,
  };

  if (typeof window !== 'undefined') {
    // 1. Direct Flutter Native In-App WebView JavaScript Channel Bridge
    const mobileChannel = (window as any).OneEightyMobileChannel;
    if (mobileChannel && typeof mobileChannel.postMessage === 'function') {
      try {
        mobileChannel.postMessage(JSON.stringify(payload));
        mobileChannel.postMessage(JSON.stringify({ ...payload, type: '180_AUTH_SUCCESS' }));
      } catch (e) {
        console.warn('[180 Identity] OneEightyMobileChannel postMessage note:', e);
      }
    }

    // 2. Local Window & Custom Event Listeners
    try {
      window.postMessage(payload, '*');
      window.postMessage({ ...payload, type: '180_AUTH_SUCCESS' }, '*');
      window.dispatchEvent(new CustomEvent('180_IDENTITY_SUCCESS', { detail: payload }));
      window.dispatchEvent(new CustomEvent('180_AUTH_SUCCESS', { detail: payload }));
    } catch (_) {}

    // 3. Desktop Browser Popup Window Bridge
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, '*');
      window.opener.postMessage({ ...payload, type: '180_AUTH_SUCCESS' }, '*');
    }

    // 4. Embedded Iframe Bottom Sheet Bridge
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
      window.parent.postMessage({ ...payload, type: '180_AUTH_SUCCESS' }, '*');
    }
  }

  toast.success(`Welcome, ${userData.name || userData.username || '180 User'}!`);

  setTimeout(() => {
    // If mobile channel was already notified, the native app pops the sheet directly
    if (typeof window !== 'undefined' && (window as any).OneEightyMobileChannel) {
      return;
    }

    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      window.close();
    } else if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: '180_IDENTITY_CLOSE' }, '*');
    } else if (params.redirectUri && authCode) {
      let redirectDestination = params.redirectUri;
      try {
        const url = new URL(params.redirectUri);
        url.searchParams.set('code', authCode);
        if (params.state) url.searchParams.set('state', params.state);
        redirectDestination = url.toString();
      } catch (_) {
        // Safe query string append for custom schemes starting with digits (e.g. 180social://)
        const sep = redirectDestination.includes('?') ? '&' : '?';
        redirectDestination = `${redirectDestination}${sep}code=${encodeURIComponent(authCode)}${params.state ? `&state=${encodeURIComponent(params.state)}` : ''}`;
      }
      window.location.href = redirectDestination;
    } else {
      window.location.href = '/';
    }
  }, 600);
}
