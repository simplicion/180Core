'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  RotateCcw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PlatformModal, LogoLoader } from '@workspace/ui';
import { SmartAuthInput } from './SmartAuthInput';
import { getCoreApiUrl } from '@/lib/api';
import { OAuthParams } from './OAuthDispatchHelper';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCredential?: string;
  oauthParams?: OAuthParams;
  oauthAppName?: string;
  onSuccess?: (credential: string, newPassword: string) => void;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  initialCredential = '',
  oauthParams,
  oauthAppName,
  onSuccess,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<'request' | 'otp' | 'password' | 'success'>('request');
  const [emailOrPhone, setEmailOrPhone] = useState(initialCredential);
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync initial credential when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCredential && !emailOrPhone) {
        setEmailOrPhone(initialCredential);
      }
      setStep('request');
      setOtp('');
      setDevOtpHint(null);
      setNewPassword('');
      setConfirmPassword('');
      setResetToken(null);
    }
  }, [isOpen, initialCredential]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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

  // ─── STEP 1: SEND RESET OTP ───────────────────────────────────────────────
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
        throw new Error(data.message || data.error || 'Failed to dispatch verification code');
      }

      toast.success(data.message || 'Verification code sent!', { id: toastId });
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
        setOtp(data.devOtp);
      }

      setResendCooldown(30);
      setStep('otp');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send code', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 2: VERIFY OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        throw new Error(data.message || data.error || 'Invalid or expired verification code');
      }

      toast.success('Code confirmed! Set your new password.', { id: toastId });
      setResetToken(data.resetToken || null);
      setStep('password');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // ─── STEP 3: RESET PASSWORD ───────────────────────────────────────────────
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

      toast.success('Password updated successfully!', { id: toastId });
      setStep('success');

      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess(emailOrPhone.trim(), newPassword);
        }
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || 'Password update failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlatformModal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password"
      icon={KeyRound}
      iconColorClass="text-blue-600 dark:text-blue-400"
      iconBgClass="bg-blue-50 dark:bg-blue-950/40"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2.5">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 'request'
                  ? 'bg-blue-600 text-white'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {step === 'request' ? '1' : '✓'}
            </span>
            <span>Contact</span>
          </span>
          <span className="text-slate-300 dark:text-zinc-700">→</span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 'otp'
                  ? 'bg-blue-600 text-white'
                  : step === 'password' || step === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step === 'password' || step === 'success' ? '✓' : '2'}
            </span>
            <span>Verify Code</span>
          </span>
          <span className="text-slate-300 dark:text-zinc-700">→</span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 'password'
                  ? 'bg-blue-600 text-white'
                  : step === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {step === 'success' ? '✓' : '3'}
            </span>
            <span>New Password</span>
          </span>
        </div>

        {/* STEP 1: REQUEST VERIFICATION CODE */}
        {step === 'request' && (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-1">
            <div className="space-y-1">
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                Enter your registered email address or mobile number. We will send you a 6-digit verification code to reset your password.
              </p>
            </div>

            <SmartAuthInput
              label="Email or Mobile Number"
              placeholder="Enter your email address or phone number"
              value={emailOrPhone}
              onChange={setEmailOrPhone}
              required
              autoFocus
            />

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !emailOrPhone.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <LogoLoader size={16} className="w-4 h-4 text-white" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFY 6-DIGIT CODE */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                Code sent to <span className="font-bold text-slate-900 dark:text-white">{emailOrPhone}</span>
              </p>
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50/80 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 min-h-[48px] text-center tracking-[0.4em] text-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                required
                autoFocus
              />

              {devOtpHint && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1.5 text-center">
                  Dev Code auto-detected: <span className="font-bold">{devOtpHint}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || resendCooldown > 0}
                className="text-slate-500 hover:text-blue-600 font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                </span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otp.trim().length < 4}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <LogoLoader size={16} className="w-4 h-4 text-white" />
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>Verify Code & Continue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SET NEW PASSWORD */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-3.5 pt-1">
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              Create a new secure password for <span className="font-bold text-slate-900 dark:text-white">{emailOrPhone}</span>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50/80 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 pr-10 min-h-[42px] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                  minLength={6}
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
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50/80 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 pr-10 min-h-[42px] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  required
                  minLength={6}
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
              <div className="text-[11px] font-semibold flex items-center gap-1.5 pt-0.5">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-rose-500">Passwords do not match</span>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStep('otp')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <LogoLoader size={16} className="w-4 h-4 text-white" />
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-white" />
                    <span>Update Password & Continue</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Password Reset Complete!
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Your password has been securely updated. Signing you in to {oauthAppName || '180 Identity'}...
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <LogoLoader size={24} className="text-blue-600 animate-spin" />
            </div>
          </div>
        )}
      </div>
    </PlatformModal>
  );
}

export default ForgotPasswordModal;
