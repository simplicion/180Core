'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  LogIn,
  KeyRound,
  User,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  RefreshCw,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LogoLoader, Button } from '@workspace/ui';
import {
  extractOAuthParams,
  buildOAuthQueryString,
  dispatchOAuthSuccess,
} from '@/components/auth/OAuthDispatchHelper';
import { OAuthAppHeader } from '@/components/auth/OAuthAppHeader';
import { GoogleSSOButton } from '@/components/auth/GoogleSSOButton';
import { OAuthErrorCard, OAuthErrorDetails } from '@/components/auth/OAuthErrorCard';
import { SmartAuthInput } from '@/components/auth/SmartAuthInput';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { getCoreApiUrl } from '@/lib/api';

type AuthScreenMode = 'login' | 'signup' | 'otp' | 'password' | 'onboarding';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const oauthParams = extractOAuthParams(searchParams);
  const oauthQuery = buildOAuthQueryString(oauthParams);

  // Screen State Machine
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<AuthScreenMode>(initialMode);

  // OAuth Pre-Validation & Diagnostics State
  const [oauthValidationError, setOauthValidationError] = useState<{
    error: string;
    errorDescription: string;
    details?: OAuthErrorDetails;
  } | null>(null);
  const [isValidatingOAuth, setIsValidatingOAuth] = useState(false);
  const [oauthApp, setOauthApp] = useState<{
    name: string;
    logoUrl: string;
    description?: string;
    isVerified?: boolean;
    clientId: string;
  } | null>(null);

  // Cached User Session (for 1-click return)
  const [cachedUser, setCachedUser] = useState<any>(null);
  const [showFullLogin, setShowFullLogin] = useState(false);

  // Forgot Password Modal State
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);

  const handleOpenForgotPassword = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsForgotPasswordModalOpen(true);
  };

  // Login Form State
  const [loginEmailOrPhone, setLoginEmailOrPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign-Up State
  const [signupName, setSignupName] = useState('');
  const [signupEmailOrPhone, setSignupEmailOrPhone] = useState('');
  const [isEmailSignup, setIsEmailSignup] = useState(true);
  const [signupTempToken, setSignupTempToken] = useState<string | null>(null);

  // OTP State
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Password Setup State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Onboarding Form State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentAuthToken, setCurrentAuthToken] = useState<string>('');
  const [onboardUsername, setOnboardUsername] = useState('');
  const [onboardAvatarUrl, setOnboardAvatarUrl] = useState('');
  const [onboardAge, setOnboardAge] = useState<string>('');
  const [onboardHeadline, setOnboardHeadline] = useState('');
  const [onboardLatitude, setOnboardLatitude] = useState<number | null>(null);
  const [onboardLongitude, setOnboardLongitude] = useState<number | null>(null);
  const [onboardCity, setOnboardCity] = useState('');
  const [onboardCountry, setOnboardCountry] = useState('');
  const [onboardSecondaryContact, setOnboardSecondaryContact] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);

  // General Loading State
  const [loading, setLoading] = useState(false);

  // Check for existing session - instant zero-latency sync load from localStorage first
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.id || parsed.email)) {
          setCachedUser(parsed);
        }
      }
    } catch (_) {}

    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');

    if (token) {
      fetch(getCoreApiUrl('/api/oauth/userinfo'), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.user || data.id || data.email)) {
            const validUser = data.user || data;
            setCachedUser(validUser);
            localStorage.setItem('user', JSON.stringify(validUser));
          } else {
            localStorage.removeItem('platform_auth_token');
            localStorage.removeItem('user');
            setCachedUser(null);
          }
        })
        .catch(() => {
          // If network slow or offline, keep cached user
        });
    }
  }, []);

  // Validate OAuth Parameters (client_id, redirect_uri, allowed origins) on load
  const validateOAuthParams = React.useCallback(async () => {
    if (!oauthParams.clientId) return;

    let callerOrigin = searchParams.get('origin') || '';
    if (!callerOrigin && typeof document !== 'undefined' && document.referrer) {
      try { callerOrigin = new URL(document.referrer).origin; } catch (_) {}
    }
    if (!callerOrigin && typeof window !== 'undefined' && window.opener) {
      if (oauthParams.redirectUri) {
        try { callerOrigin = new URL(oauthParams.redirectUri).origin; } catch (_) {}
      }
    }

    const query = new URLSearchParams();
    query.set('client_id', oauthParams.clientId);
    if (oauthParams.redirectUri) query.set('redirect_uri', oauthParams.redirectUri);
    if (oauthParams.scope) query.set('scope', oauthParams.scope);
    if (oauthParams.state) query.set('state', oauthParams.state);
    if (callerOrigin) query.set('origin', callerOrigin);

    try {
      setIsValidatingOAuth(true);
      const res = await fetch(getCoreApiUrl(`/api/oauth/authorize/validate?${query.toString()}`), {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setOauthValidationError({
          error: data.error || 'invalid_request',
          errorDescription: data.error_description || 'OAuth parameters validation failed.',
          details: data.details,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        const appData = data.app || data.client;
        if (appData) {
          setOauthApp({
            name: appData.name || oauthParams.clientId,
            logoUrl: appData.logoUrl || '',
            description: appData.description || '',
            isVerified: appData.isVerified || false,
            clientId: appData.clientId || oauthParams.clientId,
          });
        }
        setOauthValidationError(null);
      }
    } catch (e: any) {
      console.warn('[180 Identity] OAuth pre-validation note:', e.message);
    } finally {
      setIsValidatingOAuth(false);
    }
  }, [oauthParams.clientId, oauthParams.redirectUri, oauthParams.scope, oauthParams.state, searchParams]);

  useEffect(() => {
    validateOAuthParams();
  }, [validateOAuthParams]);

  // Handle redirected credentials and reset password notifications
  useEffect(() => {
    const cred = searchParams.get('credential');
    if (cred) {
      setLoginEmailOrPhone(cred);
      setShowFullLogin(true);
    }
    if (searchParams.get('reset_success') === 'true') {
      toast.success('Password updated! Please enter your new password to sign in.', { duration: 6000 });
      setShowFullLogin(true);
    }
    const modeParam = searchParams.get('mode');
    if (
      modeParam === 'forgot-password' ||
      modeParam === 'forgot_password' ||
      searchParams.get('action') === 'forgot-password' ||
      searchParams.get('action') === 'forgot_password'
    ) {
      setIsForgotPasswordModalOpen(true);
      setShowFullLogin(true);
    }
  }, [searchParams]);

  // 1-Click Quick Login
  const handleQuickLogin = async () => {
    if (!cachedUser) return;
    setLoading(true);
    const toastId = toast.loading(`Signing in as ${cachedUser.name || 'User'}...`);

    try {
      const token = localStorage.getItem('platform_auth_token') || '';
      toast.success('Session verified!', { id: toastId });
      await dispatchOAuthSuccess(cachedUser, token, oauthParams);
    } catch (err: any) {
      if (err.data && (err.data.error || err.data.error_description)) {
        setOauthValidationError({
          error: err.data.error || 'invalid_request',
          errorDescription: err.data.error_description || err.message,
          details: err.data.details,
        });
      }
      toast.error(err.message || 'Quick login failed', { id: toastId });
      setShowFullLogin(true);
    } finally {
      setLoading(false);
    }
  };

  // Safe response parser that gracefully handles non-JSON / error payloads
  const parseApiResponse = async (res: Response): Promise<{ ok: boolean; data: any }> => {
    try {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return { ok: res.ok, data };
      } catch {
        return {
          ok: false,
          data: {
            success: false,
            error: 'server_error',
            message: text?.slice(0, 150) || `Server returned status ${res.status}`,
          },
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        data: {
          success: false,
          error: 'network_error',
          message: err?.message || 'Network request failed',
        },
      };
    }
  };

  // ─── 1. SIGN IN SUBMIT ──────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmailOrPhone.trim() || !loginPassword) {
      toast.error('Please enter your email or phone and password');
      return;
    }

    setLoading(true);
    const toastId = toast.loading(oauthApp ? `Signing in to ${oauthApp.name}...` : 'Signing in...');

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emailOrPhone: loginEmailOrPhone.trim(),
          password: loginPassword,
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        if (data.error === 'user_not_found') {
          toast.error('No account found. Click "Create an account" below.', { id: toastId });
          return;
        }
        throw new Error(data.message || data.error || 'Invalid credentials');
      }

      toast.success('Signed in successfully!', { id: toastId });

      if (!data.isOnboarded) {
        // Prepare onboarding state
        setCurrentUser(data.user);
        setCurrentAuthToken(data.token);
        prepareOnboarding(data.user, data.token);
        setMode('onboarding');
      } else {
        await dispatchOAuthSuccess(data.user, data.token, oauthParams);
      }
    } catch (err: any) {
      if (err.data && (err.data.error || err.data.error_description)) {
        setOauthValidationError({
          error: err.data.error || 'invalid_request',
          errorDescription: err.data.error_description || err.message,
          details: err.data.details,
        });
      }
      toast.error(err.message || 'Login failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── 2. SIGN UP INITIATE (SEND OTP) ─────────────────────────────────────────
  const handleInitiateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = signupName.trim();
    const cleanInput = signupEmailOrPhone.trim();

    if (!cleanName || !cleanInput) {
      toast.error('Full name and email or phone number are required');
      return;
    }

    const isEmail = cleanInput.includes('@');
    setIsEmailSignup(isEmail);

    setLoading(true);
    const toastId = toast.loading(
      isEmail
        ? `Sending verification code to ${cleanInput}...`
        : `Sending WhatsApp verification code to ${cleanInput}...`
    );

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/register/initiate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: cleanName,
          emailOrPhone: cleanInput,
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        if (data.error === 'email_taken' || data.error === 'phone_taken') {
          toast.error(data.message || 'An account with this contact already exists. Switching to Sign In.', { id: toastId, duration: 6000 });
          setLoginEmailOrPhone(cleanInput);
          setMode('login');
          return;
        }
        throw new Error(data.message || data.error || 'Failed to dispatch verification code');
      }

      toast.success(data.message || 'Verification code dispatched!', { id: toastId });
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
        setOtp(data.devOtp);
        toast(`Dev Code: ${data.devOtp}`, { icon: '🔑', duration: 8000 });
      }

      setMode('otp');
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate registration', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── 3. VERIFY OTP ──────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Verifying code with 180 Identity...');

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/register/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emailOrPhone: signupEmailOrPhone.trim(),
          otp: otp.trim(),
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired verification code');
      }

      toast.success('Contact verified successfully!', { id: toastId });
      setSignupTempToken(data.tempToken || null);
      setMode('password');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── 4. SET PASSWORD ────────────────────────────────────────────────────────
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Setting your password...');

    try {
      // If user came from Google continuation, update their password directly
      if (currentUser?.id && !signupTempToken) {
        const res = await fetch(getCoreApiUrl('/api/oauth/google-continue'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: currentUser.email,
            password: newPassword,
          }),
        });
        const { ok, data } = await parseApiResponse(res);
        if (!ok || !data.success) {
          throw new Error(data.message || 'Failed to set password');
        }

        toast.success('Password set successfully!', { id: toastId });
        setCurrentUser(data.user);
        setCurrentAuthToken(data.token);
        prepareOnboarding(data.user, data.token);
        setMode('onboarding');
        return;
      }

      // Normal signup flow
      const res = await fetch(getCoreApiUrl('/api/oauth/register/set-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: signupName.trim(),
          emailOrPhone: signupEmailOrPhone.trim(),
          password: newPassword,
          tempToken: signupTempToken,
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to create account');
      }

      toast.success('Account created! Now complete your profile.', { id: toastId });
      setCurrentUser(data.user);
      setCurrentAuthToken(data.token);
      prepareOnboarding(data.user, data.token);
      setMode('onboarding');
    } catch (err: any) {
      toast.error(err.message || 'Failed to set password', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── GOOGLE SUCCESS CALLBACK ────────────────────────────────────────────────
  const handleGoogleSuccess = async (user: any, token: string, meta?: any) => {
    setCurrentUser(user);
    setCurrentAuthToken(token);

    // If new Google user requires password set (per user specification):
    if (meta?.requiresPassword) {
      setSignupName(user.name || '');
      setSignupEmailOrPhone(user.email || '');
      setIsEmailSignup(true);
      setMode('password');
      return;
    }

    // If not onboarded yet:
    if (!user.isOnboarded) {
      prepareOnboarding(user, token);
      setMode('onboarding');
      return;
    }

    // Fully ready -> dispatch
    try {
      await dispatchOAuthSuccess(user, token, oauthParams);
    } catch (err: any) {
      if (err.data && (err.data.error || err.data.error_description)) {
        setOauthValidationError({
          error: err.data.error || 'invalid_request',
          errorDescription: err.data.error_description || err.message,
          details: err.data.details,
        });
      }
      toast.error(err.message || 'Google authorization failed');
    }
  };

  // Helper to initialize onboarding fields
  // Helper to initialize onboarding fields
  const prepareOnboarding = (user: any, token: string) => {
    setCurrentAuthToken(token);
    setOnboardUsername(user.username || user.name?.toLowerCase().replace(/\s+/g, '_') || '');
    setOnboardAvatarUrl(
      user.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username || '180user'}`
    );
    setOnboardAge(user.age ? String(user.age) : '');
    setOnboardHeadline(user.headline || '');
    setOnboardLatitude(user.latitude ?? null);
    setOnboardLongitude(user.longitude ?? null);
    setOnboardCity(user.city || '');
    setOnboardCountry(user.country || '');

    // Silent background pre-fill if city or country is not yet set
    if (!user.city && !user.country) {
      fetch(getCoreApiUrl('/api/oauth/resolve-location'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ useIp: true }),
      })
        .then(parseApiResponse)
        .then(({ ok, data }) => {
          if (ok && data?.success && data?.location) {
            setOnboardCity((prev) => prev || data.location.city || '');
            setOnboardCountry((prev) => prev || data.location.country || '');
            if (data.location.latitude) setOnboardLatitude((prev) => prev ?? data.location.latitude);
            if (data.location.longitude) setOnboardLongitude((prev) => prev ?? data.location.longitude);
          }
        })
        .catch(() => {
          // Ignore background fetch failure
        });
    }
  };

  // Helper for network IP fallback when GPS/Permissions Policy blocks HTML5 geolocation
  const fallbackToNetworkLocation = async (toastId: string, customNotice?: string) => {
    try {
      toast.loading('Resolving location via network...', { id: toastId });
      const res = await fetch(getCoreApiUrl('/api/oauth/resolve-location'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ useIp: true }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (ok && data?.success && data?.location && (data.location.city || data.location.country)) {
        setOnboardCity(data.location.city || '');
        setOnboardCountry(data.location.country || '');
        if (data.location.latitude) setOnboardLatitude(data.location.latitude);
        if (data.location.longitude) setOnboardLongitude(data.location.longitude);
        toast.success(
          `Detected location: ${data.location.formatted || [data.location.city, data.location.country].filter(Boolean).join(', ')}`,
          { id: toastId }
        );
        return true;
      }
    } catch (_) {
      // Network lookup failed
    }

    // Friendly non-intrusive notification if auto-detect could not resolve
    toast(
      customNotice || 'Could not auto-detect location. You can enter your City and Country manually.',
      {
        id: toastId,
        icon: '📍',
        duration: 4000,
      }
    );
    return false;
  };

  // ─── 5. 1-CLICK LOCATION DETECTION ──────────────────────────────────────────
  const handleDetectLocation = async () => {
    if (detectingLocation) return;
    setDetectingLocation(true);

    const toastId = 'location-detect-toast';
    toast.loading('Detecting your location...', { id: toastId });

    if (!navigator.geolocation) {
      await fallbackToNetworkLocation(
        toastId,
        'GPS is not supported in this browser. Please type your city and country manually.'
      );
      setDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setOnboardLatitude(lat);
        setOnboardLongitude(lng);

        try {
          const res = await fetch(getCoreApiUrl('/api/oauth/resolve-location'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });

          const { ok, data } = await parseApiResponse(res);
          if (ok && data.success && data.location) {
            setOnboardCity(data.location.city || '');
            setOnboardCountry(data.location.country || '');
            toast.success(`Detected: ${data.location.formatted}`, { id: toastId });
          } else {
            toast.success(`Detected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, { id: toastId });
          }
        } catch (_) {
          toast.success(`Coordinates saved (${lat.toFixed(2)}, ${lng.toFixed(2)})`, {
            id: toastId,
          });
        } finally {
          setDetectingLocation(false);
        }
      },
      async (error) => {
        // When GPS fails or is disabled by permissions policy in embedded views (iframe/webview),
        // seamlessly fall back to network IP location lookup.
        const isPermissionIssue =
          error.code === error.PERMISSION_DENIED ||
          error.message?.toLowerCase().includes('permissions policy') ||
          error.message?.toLowerCase().includes('denied');

        await fallbackToNetworkLocation(
          toastId,
          isPermissionIssue
            ? 'GPS is restricted in this embedded view. Please enter your city and country manually.'
            : 'GPS detection timed out. Please enter your city and country manually.'
        );
        setDetectingLocation(false);
      },
      { timeout: 5000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  };

  // ─── 6. ONBOARDING SUBMIT ───────────────────────────────────────────────────
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardUsername.trim()) {
      toast.error('Please choose a username');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Finalizing your profile...');

    try {
      const isEmailPrimary = Boolean(currentUser?.email);

      const res = await fetch(getCoreApiUrl('/api/oauth/onboarding'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: currentUser?.id,
          username: onboardUsername.trim().replace(/^@/, ''),
          avatarUrl: onboardAvatarUrl,
          age: onboardAge ? parseInt(onboardAge, 10) : null,
          headline: onboardHeadline.trim(),
          tagline: onboardHeadline.trim(),
          latitude: onboardLatitude,
          longitude: onboardLongitude,
          city: onboardCity.trim(),
          country: onboardCountry.trim(),
          secondaryPhone: !isEmailPrimary ? undefined : onboardSecondaryContact.trim() || undefined,
          secondaryEmail: isEmailPrimary ? undefined : onboardSecondaryContact.trim() || undefined,
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to complete profile');
      }

      toast.success('Welcome to 180 Profile!', { id: toastId });
      const finalUser = data.user || currentUser;
      const finalToken = data.token || currentAuthToken;

      await dispatchOAuthSuccess(finalUser, finalToken, oauthParams);
    } catch (err: any) {
      toast.error(err.message || 'Onboarding failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickComplete = async () => {
    setLoading(true);
    try {
      const usernameCandidate = onboardUsername.trim().replace(/^@/, '') || currentUser?.username || currentUser?.name?.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Date.now().toString(36)}`;
      const res = await fetch(getCoreApiUrl('/api/oauth/onboarding'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuthToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: currentUser?.id,
          username: usernameCandidate,
          avatarUrl: onboardAvatarUrl,
          headline: onboardHeadline.trim(),
          tagline: onboardHeadline.trim(),
          city: onboardCity.trim(),
          country: onboardCountry.trim(),
        }),
      });
      const { ok, data } = await parseApiResponse(res);
      const finalUser = (ok && data?.user) ? data.user : currentUser;
      const finalToken = (ok && data?.token) ? data.token : currentAuthToken;
      try {
        await dispatchOAuthSuccess(finalUser, finalToken, oauthParams);
      } catch (err: any) {
        if (err.data && (err.data.error || err.data.error_description)) {
          setOauthValidationError({
            error: err.data.error || 'invalid_request',
            errorDescription: err.data.error_description || err.message,
            details: err.data.details,
          });
        }
      }
    } catch (_) {
      try {
        await dispatchOAuthSuccess(currentUser, currentAuthToken, oauthParams);
      } catch (err: any) {
        if (err.data && (err.data.error || err.data.error_description)) {
          setOauthValidationError({
            error: err.data.error || 'invalid_request',
            errorDescription: err.data.error_description || err.message,
            details: err.data.details,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900 relative">
      {/* ─────────────────────────────────────────────────────────────────────────────
          OAUTH CONFIGURATION / VALIDATION ERROR SCREEN
      ───────────────────────────────────────────────────────────────────────────── */}
      {oauthValidationError ? (
        <OAuthErrorCard
          error={oauthValidationError.error}
          errorDescription={oauthValidationError.errorDescription}
          details={oauthValidationError.details}
          onRetry={validateOAuthParams}
          onClose={() => setOauthValidationError(null)}
        />
      ) : (
        <>
      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN A: 1-CLICK QUICK SESSION RESUME
      ───────────────────────────────────────────────────────────────────────────── */}
      {mode === 'login' && cachedUser && !showFullLogin ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {oauthParams.clientId ? (
            <OAuthAppHeader
              clientId={oauthParams.clientId}
              app={oauthApp}
              subtitle={oauthApp ? `Continue to ${oauthApp.name}` : undefined}
            />
          ) : (
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Welcome Back</h2>
              <p className="text-xs text-slate-500">Authenticate instantly with your 180 account</p>
            </div>
          )}

          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xs shrink-0">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-bold text-sm text-blue-600 overflow-hidden">
                  {cachedUser.avatarUrl ? (
                    <img
                      src={cachedUser.avatarUrl}
                      alt={cachedUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    cachedUser.name?.[0]?.toUpperCase() || 'U'
                  )}
                </div>
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="truncate">{cachedUser.name || '180 User'}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </div>
                <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                  {cachedUser.email || (cachedUser.username ? `@${cachedUser.username}` : cachedUser.phone || '180 Account')}
                </div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>

          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={loading}
            className="identity-gradient-btn identity-btn-shimmer w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-sm text-gray-900 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <LogoLoader size={18} className="w-4 h-4 text-blue-600" />
            ) : (
              <>
                <img
                  src="/black icon.svg"
                  alt=""
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (!target.src.includes('black-icon')) target.src = '/black-icon.svg';
                  }}
                />
                <span>Continue as {cachedUser.name?.split(' ')[0] || 'User'}</span>
                <ArrowRight className="w-4 h-4 text-blue-600 ml-0.5" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowFullLogin(true)}
            className="w-full text-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors py-1 cursor-pointer"
          >
            Use another account or login method
          </button>
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 1: DEFAULT SIGN-IN VIEW (UNIFIED CREDENTIALS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {mode === 'login' && (!cachedUser || showFullLogin) && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {oauthParams.clientId ? (
            <OAuthAppHeader
              clientId={oauthParams.clientId}
              app={oauthApp}
              subtitle={oauthApp ? `Sign in to continue to ${oauthApp.name}` : undefined}
            />
          ) : (
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-500">Sign in with your email or phone number</p>
            </div>
          )}

          {/* Genuine Google OAuth Button (No sub-modal) */}
          <GoogleSSOButton
            oauthParams={oauthParams}
            label="Continue with Google"
            onSuccess={handleGoogleSuccess}
          />

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200/80 w-full" />
            <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider relative">
              or continue with
            </span>
          </div>

          {/* Single Unified Sign-in Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <SmartAuthInput
              label="Email or Phone Number"
              placeholder="Enter your email address or phone number"
              value={loginEmailOrPhone}
              onChange={setLoginEmailOrPhone}
              required
              autoFocus
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={handleOpenForgotPassword}
                  className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !loginEmailOrPhone || !loginPassword}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <LogoLoader size={16} className="w-4 h-4 text-white" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-white" />
              )}
              <span>{oauthApp ? `Sign In to ${oauthApp.name}` : 'Sign In'}</span>
            </button>
          </form>

          {/* Switch to Register */}
          <div className="pt-2 text-center space-y-1.5 border-t border-slate-100">
            <p className="text-xs text-slate-600 font-medium">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-blue-600 font-bold hover:text-blue-800 hover:underline cursor-pointer ml-0.5"
              >
                Create an account
              </button>
            </p>
          </div>

          {cachedUser && (
            <button
              type="button"
              onClick={() => setShowFullLogin(false)}
              className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline pt-1 cursor-pointer"
            >
              ← Back to One-Tap Login ({cachedUser.name})
            </button>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 2: SIGN UP INITIATE (NAME + UNIFIED EMAIL/PHONE + GOOGLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      {mode === 'signup' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {oauthParams.clientId ? (
            <OAuthAppHeader
              clientId={oauthParams.clientId}
              app={oauthApp}
              subtitle={oauthApp ? `Create an account to continue to ${oauthApp.name}` : undefined}
            />
          ) : (
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create an Account</h2>
              <p className="text-xs text-slate-500">Sign up to get started</p>
            </div>
          )}

          {/* Genuine Google OAuth Button */}
          <GoogleSSOButton
            oauthParams={oauthParams}
            label="Sign up with Google"
            onSuccess={handleGoogleSuccess}
          />

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200/80 w-full" />
            <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider relative">
              or register with credentials
            </span>
          </div>

          {/* Step 1 Sign Up Form */}
          <form onSubmit={handleInitiateSignup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Alex Smith"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
                autoFocus
              />
            </div>

            <div>
              <SmartAuthInput
                label="Email or Phone Number"
                placeholder="Enter your email address or phone number"
                value={signupEmailOrPhone}
                onChange={setSignupEmailOrPhone}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                We will dispatch a secure 6-digit verification code to this contact.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !signupName.trim() || !signupEmailOrPhone.trim()}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <LogoLoader size={16} className="w-4 h-4 text-white" />
              ) : (
                <>
                  <img
                    src="/black icon.svg"
                    alt=""
                    className="w-3.5 h-3.5 object-contain invert brightness-0"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (!target.src.includes('black-icon')) target.src = '/black-icon.svg';
                    }}
                  />
                  <span>Continue & Verify</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Switch back to Login */}
          <div className="pt-2 text-center space-y-1.5 border-t border-slate-100">
            <p className="text-xs text-slate-600 font-medium">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-blue-600 font-bold hover:text-blue-800 hover:underline cursor-pointer ml-0.5"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 3: OTP VERIFICATION
      ───────────────────────────────────────────────────────────────────────────── */}
      {mode === 'otp' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-600 mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Verify Your Contact</h2>
            <p className="text-xs text-slate-500">
              Enter the 6-digit code sent to <span className="font-semibold text-slate-700">{signupEmailOrPhone}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">6-Digit Verification Code</label>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-[11px] text-blue-600 font-semibold hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              <input
                type="text"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3 min-h-[48px] text-center tracking-[0.4em] text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                required
                autoFocus
              />

              {devOtpHint && (
                <p className="text-[11px] text-blue-600 font-medium mt-1.5 text-center">
                  Dev Code auto-detected: <span className="font-bold">{devOtpHint}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? <LogoLoader size={16} className="w-4 h-4 text-white" /> : <ShieldCheck className="w-4 h-4 text-white" />}
              <span>Verify Code & Continue</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleInitiateSignup}
                disabled={loading}
                className="text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors cursor-pointer"
              >
                Didn't receive code? Resend
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 4: SET PASSWORD
      ───────────────────────────────────────────────────────────────────────────── */}
      {mode === 'password' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto text-blue-600 mb-2">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create a Secure Password</h2>
            <p className="text-xs text-slate-500">
              Set a master password for your account
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
                minLength={6}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? <LogoLoader size={16} className="w-4 h-4 text-white" /> : <Lock className="w-3.5 h-3.5 text-white" />}
              <span>Save Password & Setup Profile</span>
            </button>
          </form>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 5: ONBOARDING PROFILE FORM
      ───────────────────────────────────────────────────────────────────────────── */}
      {mode === 'onboarding' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-[2px] mx-auto mb-2 shadow-sm">
              <div className="w-full h-full bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden relative">
                {onboardAvatarUrl ? (
                  <img
                    src={onboardAvatarUrl}
                    alt={onboardUsername || 'Avatar'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Complete Your Profile</h2>
            <p className="text-xs text-slate-500">
              Customize how you appear across apps
            </p>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
            {/* 1. Verified Contact (READ-ONLY / LOCKED) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>
                    {currentUser?.email ? 'Verified Email Address' : 'Verified Phone Number'}
                  </span>
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                </span>
              </div>
              <input
                type="text"
                disabled
                value={currentUser?.email || currentUser?.phone || signupEmailOrPhone}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-500 cursor-not-allowed select-none"
              />
            </div>

            {/* 2. Optional Alternate Contact */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {currentUser?.email ? 'Mobile Phone Number (Optional)' : 'Email Address (Optional)'}
              </label>
              <input
                type={currentUser?.email ? 'tel' : 'email'}
                placeholder={currentUser?.email ? '+91 9876543210' : 'name@company.com'}
                value={onboardSecondaryContact}
                onChange={(e) => setOnboardSecondaryContact(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* 3. Username */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Username</label>
                <button
                  type="button"
                  onClick={() =>
                    setOnboardUsername(
                      `${currentUser?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}_${Math.floor(
                        100 + Math.random() * 900
                      )}`
                    )
                  }
                  className="text-[11px] text-blue-600 font-semibold hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Randomize
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  @
                </span>
                <input
                  type="text"
                  value={onboardUsername}
                  onChange={(e) =>
                    setOnboardUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }
                  placeholder="username"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl pl-8 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                  required
                />
              </div>
            </div>

            {/* 4. Age & Headline */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                <input
                  type="number"
                  min={13}
                  max={120}
                  placeholder="24"
                  value={onboardAge}
                  onChange={(e) => setOnboardAge(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Headline / Tagline
                </label>
                <input
                  type="text"
                  placeholder="Software Engineer & Creator"
                  value={onboardHeadline}
                  onChange={(e) => setOnboardHeadline(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* 5. 1-Click Location Detector */}
            <div className="p-3 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" /> Location
                  <span className="text-[10px] font-normal text-slate-400">(Optional)</span>
                </span>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="py-1 px-2.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {detectingLocation ? (
                    <LogoLoader size={12} className="w-3 h-3 text-blue-600" />
                  ) : (
                    <Compass className="w-3 h-3 text-blue-600" />
                  )}
                  <span>Detect Location</span>
                </button>
              </div>

              {onboardLatitude && onboardLongitude && (
                <div className="text-[10px] text-blue-700 font-mono bg-white/70 px-2 py-1 rounded-md border border-blue-100">
                  📍 Coordinates: {onboardLatitude.toFixed(4)}, {onboardLongitude.toFixed(4)}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={onboardCity}
                  onChange={(e) => setOnboardCity(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={onboardCountry}
                  onChange={(e) => setOnboardCountry(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={loading || !onboardUsername.trim()}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <LogoLoader size={16} className="w-4 h-4 text-white" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                )}
                <span>Complete Profile & Enter Platform</span>
              </button>

              <button
                type="button"
                onClick={handleQuickComplete}
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl font-medium text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer text-center"
              >
                Skip optional fields & continue with defaults
              </button>
            </div>
          </form>
        </div>
      )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL: FORGOT & RESET PASSWORD
      ───────────────────────────────────────────────────────────────────────────── */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        initialCredential={loginEmailOrPhone}
        oauthParams={oauthParams}
        oauthAppName={oauthApp?.name}
        onSuccess={async (credential, newPw) => {
          setLoginEmailOrPhone(credential);
          setLoginPassword(newPw);
          // Auto-submit login with newly set credentials
          setLoading(true);
          const toastId = toast.loading(oauthApp ? `Signing in to ${oauthApp.name}...` : 'Signing in...');
          try {
            const res = await fetch(getCoreApiUrl('/api/oauth/login'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                emailOrPhone: credential.trim(),
                password: newPw,
              }),
            });
            const { ok, data } = await parseApiResponse(res);
            if (ok && data.success) {
              toast.success('Signed in successfully!', { id: toastId });
              if (!data.isOnboarded) {
                setCurrentUser(data.user);
                setCurrentAuthToken(data.token);
                prepareOnboarding(data.user, data.token);
                setMode('onboarding');
              } else {
                await dispatchOAuthSuccess(data.user, data.token, oauthParams);
              }
            } else {
              toast.success('Password updated! Please sign in with your new password.', { id: toastId });
            }
          } catch (err: any) {
            toast.success('Password updated! Please sign in with your new password.', { id: toastId });
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}

export default function StandaloneLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center space-y-4 max-w-sm mx-auto flex flex-col items-center justify-center">
          <LogoLoader size={36} className="w-9 h-9 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading 180 Identity portal...</p>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
