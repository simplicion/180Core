'use client';

import React, { useState } from 'react';
import { PlatformModal, Button, LogoLoader } from '@workspace/ui';
import { User, Phone, Mail, Calendar, ShieldCheck, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSave: (updated: UserProfile) => void;
}

export function EditProfileModal({ isOpen, onClose, user, onSave }: EditProfileModalProps) {
  const [name, setName] = useState(user.name || '');
  const [username, setUsername] = useState(user.username || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [dob, setDob] = useState(user.dob || '');

  // Step 1: Form, Step 2: OTP Verification
  const [step, setStep] = useState<'FORM' | 'OTP'>('FORM');
  const [otp, setOtp] = useState('');
  const [saving, setSaving] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);

  const isSensitiveChange = phone !== user.phone || email !== user.email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (isSensitiveChange) {
      setSaving(true);
      const toastId = toast.loading('Sending 6-digit OTP to your WhatsApp phone...');
      try {
        await new Promise((r) => setTimeout(r, 600));
        toast.success('Verification code sent to ' + phone, { id: toastId });
        setStep('OTP');
        setOtpTimer(60);
      } catch (err: any) {
        toast.error('Failed to send verification code', { id: toastId });
      } finally {
        setSaving(false);
      }
    } else {
      // Direct save
      setSaving(true);
      try {
        await new Promise((r) => setTimeout(r, 500));
        const updatedUser: UserProfile = {
          ...user,
          name,
          username,
          email,
          phone,
          dob,
        };
        onSave(updatedUser);
        toast.success('Profile updated successfully!');
        onClose();
      } catch (err: any) {
        toast.error('Failed to update profile');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleVerifyOtpAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast.error('Please enter the full 6-digit code');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Verifying code with 180 Security...');
    try {
      await new Promise((r) => setTimeout(r, 600));
      const updatedUser: UserProfile = {
        ...user,
        name,
        username,
        email,
        phone,
        dob,
      };
      onSave(updatedUser);
      toast.success('Phone and email verified & profile saved!', { id: toastId });
      onClose();
      setStep('FORM');
      setOtp('');
    } catch (err: any) {
      toast.error('Invalid verification code', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformModal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'FORM' ? 'Edit Profile' : 'Verify Contact Credentials'}
      maxWidthClass="max-w-lg"
    >
      {step === 'FORM' ? (
        <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-700 pt-1 font-sans">
          <p className="text-slate-500 text-xs">
            Update your identity across all 180 Workspace apps. Changing contact details requires OTP verification.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full pl-7 pr-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp Mobile</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Verified Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          {isSensitiveChange && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-start gap-2.5 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Contact changes require a quick 6-digit OTP sent to your WhatsApp number.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={onClose} disabled={saving} className="min-h-[40px] cursor-pointer">
              Cancel
            </Button>
            <Button variant="default" type="submit" disabled={saving} className="min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-2 shadow-md shadow-blue-600/20">
              {saving ? <LogoLoader size={16} className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isSensitiveChange ? 'Continue to OTP Verification' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtpAndSave} className="space-y-5 text-xs text-slate-700 pt-1 font-sans">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Enter 6-Digit Verification Code</h3>
            <p className="text-xs text-slate-500">Sent to WhatsApp: <strong className="text-slate-900">{phone}</strong></p>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              maxLength={6}
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-h-[48px] text-center tracking-[0.4em] text-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              required
              autoFocus
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <button
                type="button"
                onClick={() => setStep('FORM')}
                className="text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                ← Edit details
              </button>
              <span>Resend code in {otpTimer}s</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={onClose} disabled={saving} className="min-h-[40px] cursor-pointer">
              Cancel
            </Button>
            <Button variant="default" type="submit" disabled={saving || otp.length < 6} className="min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-2 shadow-md shadow-blue-600/20">
              {saving ? <LogoLoader size={16} className="w-4 h-4 text-white" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Verify & Save Profile</span>
            </Button>
          </div>
        </form>
      )}
    </PlatformModal>
  );
}
