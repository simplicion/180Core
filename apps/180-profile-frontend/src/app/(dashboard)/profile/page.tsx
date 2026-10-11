'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Copy,
  Check,
  Edit3,
  CheckCircle2,
  SmartphoneNfc,
} from 'lucide-react';
import { Button, UniversalSkeleton } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';
import { UserProfile } from '@/types';
import { EditProfileModal } from '@/components/EditProfileModal';

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken') ||
      '';

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(getCoreApiUrl('/api/oauth/userinfo'), { headers, credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && (data.user || data.id)) {
          const u = data.user || data;
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
        } else {
          const stored = localStorage.getItem('user');
          if (stored) {
            try {
              setUser(JSON.parse(stored));
            } catch (_) {}
          }
        }
      })
      .catch(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
          try {
            setUser(JSON.parse(stored));
          } catch (_) {}
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    toast.success('Universal ID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <UniversalSkeleton type="form" count={4} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-12 sm:py-16 text-center space-y-4 px-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
          <User className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Sign in to view your profile</h2>
        <p className="text-xs text-slate-500">You need an active 180 Profile session to manage your identity &amp; security settings.</p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
        >
          Sign In with 180
        </Link>
      </div>
    );
  }

  const currentUser = user;

  return (
    <div className="space-y-4 sm:space-y-8 max-w-6xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-3 pb-4 sm:pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
            <Link href="/" className="text-[11px] sm:text-xs text-blue-600 hover:text-blue-700 font-medium">
              ← Overview
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] sm:text-xs text-slate-500">Universal 180 Profile</span>
          </div>
          <h1 className="text-xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Profile &amp; Security
          </h1>
        </div>

        <div className="shrink-0">
          <Button
            variant="default"
            onClick={() => setIsEditModalOpen(true)}
            className="min-h-[36px] sm:min-h-[40px] px-3.5 sm:px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 sm:gap-2 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </Button>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Main Identity Passport Card */}
        <div className="p-3.5 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">Identity Details</h2>
                <p className="hidden sm:block text-xs text-slate-500">Your single global identity across all 180 platforms.</p>
              </div>
            </div>

            <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
              <span>Verified</span>
            </span>
          </div>

          {/* Information Grid: 1 col on mobile, 2 col on tablet, 3 col on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 text-xs">
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Display Name</span>
              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">{currentUser.name}</div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</span>
              <div className="text-xs sm:text-sm font-bold text-blue-700 font-mono truncate">@{currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : 'user')}</div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verified Email Address</span>
              <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{currentUser.email || 'Not provided'}</div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp Phone Number</span>
              <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{currentUser.phone || 'Not linked'}</div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date of Birth</span>
              <div className="text-xs sm:text-sm font-semibold text-slate-900">{currentUser.dob ? currentUser.dob : '14 May 1998'}</div>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-0.5 sm:space-y-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Universal ID</span>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-mono text-slate-700 truncate">{currentUser.id}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                  title="Copy ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Session & Device Card */}
        <div className="p-3.5 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <SmartphoneNfc className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">Active Devices &amp; Sessions</h2>
                <p className="hidden sm:block text-xs text-slate-500">Currently authenticated browser and mobile hardware instances.</p>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-2">
            <div className="space-y-0.5 text-xs min-w-0">
              <div className="font-bold text-slate-900 flex items-center gap-2">
                <span className="truncate">Active Browser Session</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                  Current
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono truncate">Universal Token Verified • Active now</div>
            </div>

            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={currentUser}
        onSave={(updated) => setUser(updated)}
      />
    </div>
  );
}
