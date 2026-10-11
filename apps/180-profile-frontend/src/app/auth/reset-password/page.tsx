'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Lock,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LogoLoader, Button } from '@workspace/ui';
import {
  extractOAuthParams,
  buildOAuthQueryString,
} from '@/components/auth/OAuthDispatchHelper';
import { getCoreApiUrl } from '@/lib/api';
import { SmartAuthInput } from '@/components/auth/SmartAuthInput';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oauthParams = extractOAuthParams(searchParams);
  const oauthQuery = buildOAuthQueryString(oauthParams);

  const initialCredential = searchParams.get('credential') || '';
  const initialDevOtp = searchParams.get('devOtp') || '';
  const initialStepParam = searchParams.get('step');

  const [emailOrPhone, setEmailOrPhone] = useState(initialCredential);
  const [step, setStep] = useState<'request' | 'otp' | 'password' | 'success'>(
    initialStepParam === 'otp' || initialCredential ? 'otp' : 'request'
  );
  const [otp, setOtp] = useState(initialDevOtp);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(initialDevOtp || null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Safe API Parser Helper
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
            message: text?.slice(0, 150) || `Server returned ${res.status}`,
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

  // ─── ACTION 1: DISPATCH RESET CODE ──────────────────────────────────────────
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = emailOrPhone.trim();
    if (!cleanInput) {
      toast.error('Please enter your email or phone number');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Sending verification code...');

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emailOrPhone: cleanInput }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch verification code');
      }

      toast.success(data.message || 'Verification code sent!', { id: toastId });
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
        setOtp(data.devOtp);
        toast(`Dev Code: ${data.devOtp}`, { icon: '🔑', duration: 8000 });
      }

      setResendCooldown(30);
      setStep('otp');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send code', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── ACTION 2: VERIFY OTP CODE ──────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      toast.error('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Verifying code with 180 Identity...');

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/reset-password/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emailOrPhone: emailOrPhone.trim(),
          otp: cleanOtp,
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired verification code');
      }

      toast.success('Code confirmed! You can now reset your password.', { id: toastId });
      setResetToken(data.resetToken || null);
      setStep('password');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── ACTION 3: SET NEW PASSWORD & REDIRECT TO LOGIN ────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
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
    const toastId = toast.loading('Updating your password...');

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emailOrPhone: emailOrPhone.trim(),
          otp: otp.trim(),
          resetToken,
          newPassword,
        }),
      });

      const { ok, data } = await parseApiResponse(res);
      if (!ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update password');
      }

      toast.success('Password updated successfully! Redirecting to Sign In...', { id: toastId });
      setStep('success');

      // Seamless auto-redirect to login with credentials pre-filled
      setTimeout(() => {
        const nextUrl = new URL('/auth/login', window.location.origin);
        nextUrl.searchParams.set('credential', emailOrPhone.trim());
        nextUrl.searchParams.set('reset_success', 'true');
        if (oauthParams.clientId) nextUrl.searchParams.set('client_id', oauthParams.clientId);
        if (oauthParams.redirectUri) nextUrl.searchParams.set('redirect_uri', oauthParams.redirectUri);
        if (oauthParams.scope) nextUrl.searchParams.set('scope', oauthParams.scope);
        if (oauthParams.state) nextUrl.searchParams.set('state', oauthParams.state);

        router.push(nextUrl.pathname + nextUrl.search);
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || 'Password update failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900 relative">
      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 1: REQUEST OTP (if accessed without credential)
      ───────────────────────────────────────────────────────────────────────────── */}
      {step === 'request' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Reset Password</h2>
            <p className="text-xs text-slate-500">
              Enter your registered contact to receive a verification code
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-3.5">
            <SmartAuthInput
              label="Email or Mobile Number"
              placeholder="Enter your email address or phone number"
              value={emailOrPhone}
              onChange={setEmailOrPhone}
              required
              autoFocus
            />

            <button
              type="submit"
              disabled={loading || !emailOrPhone.trim()}
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
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-100">
            <a
              href={`/auth/login${oauthQuery}`}
              className="text-xs text-blue-600 font-bold hover:text-blue-800 hover:underline"
            >
              ← Back to Sign In
            </a>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 2: DEDICATED OTP VERIFICATION SCREEN
      ───────────────────────────────────────────────────────────────────────────── */}
      {step === 'otp' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Enter Verification Code
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              We dispatched a 6-digit verification code to
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
              <span>{emailOrPhone || 'your contact'}</span>
            </div>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">6-Digit Code</label>
                {devOtpHint && (
                  <button
                    type="button"
                    onClick={() => setOtp(devOtpHint)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Quick-Fill: {devOtpHint}
                  </button>
                )}
              </div>
              <input
                type="text"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3 min-h-[48px] text-center tracking-[0.4em] font-mono text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.trim().length < 4}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <LogoLoader size={16} className="w-4 h-4 text-white" />
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  <span>Verify Code</span>
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => handleSendOtp()}
              disabled={loading || resendCooldown > 0}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
            </button>

            <button
              type="button"
              onClick={() => setStep('request')}
              className="font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Change Contact
            </button>
          </div>

          <div className="text-center pt-1">
            <a
              href={`/auth/login${oauthQuery}`}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ← Back to Sign In
            </a>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 3: DEDICATED SET PASSWORD SCREEN
      ───────────────────────────────────────────────────────────────────────────── */}
      {step === 'password' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="text-center space-y-1">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-xs">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Set New Password</h2>
            <p className="text-xs text-slate-500">
              Create a new secure password for your account
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 min-h-[42px] text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {newPassword && confirmPassword && (
              <div className="text-[11px] font-semibold flex items-center gap-1.5">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-500">Passwords do not match</span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50 mt-1"
            >
              {loading ? (
                <LogoLoader size={16} className="w-4 h-4 text-white" />
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  <span>Update Password & Continue</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep('otp')}
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
            >
              ← Back to Code Verification
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          SCREEN 4: SUCCESS & REDIRECT STATE
      ───────────────────────────────────────────────────────────────────────────── */}
      {step === 'success' && (
        <div className="text-center py-6 space-y-4 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Password Reset Complete!</h2>
            <p className="text-xs text-slate-500">
              Your password has been successfully updated. Redirecting you to Sign In...
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <LogoLoader size={24} className="text-blue-600 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function StandaloneResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center space-y-4 max-w-sm mx-auto flex flex-col items-center justify-center">
          <LogoLoader size={36} className="w-9 h-9 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
