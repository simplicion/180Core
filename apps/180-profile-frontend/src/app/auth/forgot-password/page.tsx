'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { LogoLoader, Button } from '@workspace/ui';
import {
  extractOAuthParams,
  buildOAuthQueryString,
} from '@/components/auth/OAuthDispatchHelper';
import { getCoreApiUrl } from '@/lib/api';
import { SmartAuthInput } from '@/components/auth/SmartAuthInput';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oauthParams = extractOAuthParams(searchParams);
  const oauthQuery = buildOAuthQueryString(oauthParams);

  const initialCredential = searchParams.get('credential') || '';
  const [emailOrPhone, setEmailOrPhone] = useState(initialCredential);
  const [loading, setLoading] = useState(false);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      let data: any = {};
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        data = { success: false, message: 'Server error' };
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch reset code');
      }

      toast.success(data.message || 'Verification code dispatched!', { id: toastId });

      // Navigate to dedicated OTP verification screen
      const resetParams = new URLSearchParams(searchParams.toString());
      resetParams.set('credential', cleanInput);
      resetParams.set('step', 'otp');
      if (data.devOtp) {
        resetParams.set('devOtp', data.devOtp);
      }
      router.push(`/auth/reset-password?${resetParams.toString()}`);
    } catch (err: any) {
      toast.error(err.message || 'Request failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-5 text-slate-900 relative">
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-xs">
            <KeyRound className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Forgot Password</h2>
          <p className="text-xs text-slate-500">
            Enter your registered email or phone to receive a 6-digit verification code
          </p>
        </div>

        <form onSubmit={handleForgotSubmit} className="space-y-3.5">
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
          <button
            type="button"
            onClick={() => router.push(`/auth/login${oauthQuery}`)}
            className="text-xs text-blue-600 font-bold hover:text-blue-800 hover:underline cursor-pointer"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StandaloneForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center space-y-4 max-w-sm mx-auto flex flex-col items-center justify-center">
          <LogoLoader size={36} className="w-9 h-9 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading...</p>
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
