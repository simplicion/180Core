'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AppWindow,
  Trash2,
  Calendar,
} from 'lucide-react';
import { Button, AdaptiveSkeleton, OneEightyIdentityButton } from '@workspace/ui';
import { getCoreApiUrl } from '@/lib/api';
import { getStoredAuthToken } from '@/lib/auth';
import toast from 'react-hot-toast';
import { ConnectedApp } from '@/types';
import { RevokeAppModal } from '@/components/RevokeAppModal';
import { useAuth } from '@/context/AuthContext';

const SCOPE_LABELS: Record<string, string> = {
  openid: 'Single Sign-On',
  'identity:read': 'Profile Info',
  'identity:email': 'Verified Email',
  'identity:phone': 'Phone Number',
  'identity:profile': 'Profile Details',
  'social:publish': 'Social Publishing',
  'messages:send': 'Direct Messages',
  'developer:read': 'Developer APIs',
  'developer:write': 'API Management',
  'pay:checkout': '180 Pay Checkout',
  'pay:subscriptions': 'Subscriptions',
};

function getFormattedAppName(name: string): string {
  if (!name) return 'Connected Application';
  const lower = name.toLowerCase().trim();
  if (lower === '180 social studio') return '180 Social Studio';
  if (lower === '180 developers console' || lower === '180 developer portal') return '180 Developers Console';
  if (lower === '180 core' || lower === '180core' || lower === '180 workspace' || lower === '180workspace') return '180 Core';
  if (lower === '180 traffic director') return '180 Traffic Director';
  return name;
}

function getAppLogo(app: ConnectedApp): string {
  if (app.logo && app.logo.trim() !== '' && app.logo !== '/icon.svg') {
    return app.logo;
  }
  const lowerName = (app.name || '').toLowerCase();
  const lowerClient = (app.clientId || '').toLowerCase();

  if (
    lowerName.includes('social') ||
    lowerClient.includes('social') ||
    lowerClient.includes('266753c1171df1e2c4a391483fd2e02e')
  ) {
    return '/social-studio.png';
  }
  if (lowerName.includes('developer') || lowerClient.includes('developer')) {
    return '/black-icon.svg';
  }
  if (lowerName.includes('traffic') || lowerClient.includes('traffic')) {
    return '/icon.svg';
  }
  return app.logo || '/icon.svg';
}

function formatAuthorizedDate(isoString?: string): string {
  if (!isoString) return 'Active session';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Active session';
    return `Connected ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch (_) {
    return 'Active session';
  }
}

export default function ConnectedAppsPage() {
  const { user, loading: authLoading } = useAuth();
  const [appsLoading, setAppsLoading] = useState(true);
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [revokingApp, setRevokingApp] = useState<ConnectedApp | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchApps = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setApps([]);
      setAppsLoading(false);
      return;
    }

    setAppsLoading(true);
    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/authorized-apps'), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.apps)) {
          setApps(data.apps);
        } else {
          setApps([]);
        }
      } else {
        setApps([]);
      }
    } catch (_) {
      setApps([]);
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchApps();
    } else {
      setAppsLoading(false);
    }
  }, [user]);

  const confirmRevoke = async () => {
    if (!revokingApp) return;
    setRevoking(true);
    const targetAppName = getFormattedAppName(revokingApp.name);
    try {
      const token = getStoredAuthToken();

      const res = await fetch(getCoreApiUrl(`/api/oauth/authorized-apps/${revokingApp.clientId}`), {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to revoke access on server');
      }

      // 1. Cross-tab and multi-client real-time synchronization via BroadcastChannel
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const syncChannel = new BroadcastChannel('180_auth_sync');
          syncChannel.postMessage({
            type: 'APP_REVOKED',
            clientId: revokingApp.clientId,
            appName: targetAppName,
            timestamp: Date.now(),
          });
        } catch (_) {}
      }

      // 2. Storage event broadcast for browser windows/tabs on the same origin / localhost
      try {
        localStorage.setItem(
          '180_revoked_app_event',
          JSON.stringify({
            clientId: revokingApp.clientId,
            appName: targetAppName,
            timestamp: Date.now(),
          })
        );
      } catch (_) {}

      setApps((prev) => prev.filter((a) => a.id !== revokingApp.id && a.clientId !== revokingApp.clientId));
      toast.success(`Revoked access and logged out from ${targetAppName}`);
      setRevokingApp(null);
    } catch (err: any) {
      toast.error('Failed to revoke app access');
    } finally {
      setRevoking(false);
    }
  };

  if (authLoading) {
    return <AdaptiveSkeleton screen="connected-apps" />;
  }

  // 1. Unauthenticated state: Center Single Sign-In CTA with zero navigation
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-4">
        <OneEightyIdentityButton
          href="/auth/login"
          clientId="180-profile"
          text="Sign In with 180 Identity"
          subtitle="Universal Sovereign Identity & Prepaid Wallet"
          theme="light"
          className="shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-sm px-6 py-3 cursor-pointer"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="pb-4 sm:pb-6 border-b border-slate-200">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
          <Link href="/" className="text-[11px] sm:text-xs text-blue-600 hover:text-blue-700 font-medium">
            ← Overview
          </Link>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] sm:text-xs text-slate-500">Security &amp; Authorizations</span>
        </div>
        <h1 className="text-xl sm:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
          <span>Connected Applications</span>
          <span className="px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
            {apps.length} Active
          </span>
        </h1>
      </div>

      {/* Main Content List - Full-width clean and responsive */}
      {appsLoading ? (
        <AdaptiveSkeleton screen="connected-apps" />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {apps.length > 0 ? (
            apps.map((app) => {
              const displayName = getFormattedAppName(app.name);
              const appLogo = getAppLogo(app);

              return (
                <div
                  key={app.id}
                  className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-5"
                >
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    {/* App Logo */}
                    <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/80 p-1.5 sm:p-2.5 flex items-center justify-center shrink-0 shadow-2xs group">
                      <img
                        src={appLogo}
                        alt={displayName}
                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/icon.svg';
                        }}
                      />
                    </div>

                    <div className="space-y-1 sm:space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{displayName}</h2>
                        <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active Session</span>
                        </span>
                      </div>

                      <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xl">
                        {app.description || 'Authorized application with active identity session'}
                      </p>

                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatAuthorizedDate(app.authorizedAt)}</span>
                      </div>

                      {/* Scopes Badges */}
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-0.5 sm:pt-1">
                        {app.scopes?.map((scope) => (
                          <span
                            key={scope}
                            className="px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[9px] sm:text-[10px] text-slate-600 font-medium tracking-tight"
                          >
                            {SCOPE_LABELS[scope] || scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Revoke Action Button */}
                  <Button
                    variant="outline"
                    onClick={() => setRevokingApp(app)}
                    className="w-full sm:w-auto min-h-[34px] sm:min-h-[40px] px-3.5 sm:px-4 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="p-8 sm:p-14 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <AppWindow className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">No Connected Applications Yet</h3>
            </div>
          )}
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokingApp && (
        <RevokeAppModal
          app={revokingApp}
          onClose={() => setRevokingApp(null)}
          onConfirm={confirmRevoke}
          loading={revoking}
        />
      )}
    </div>
  );
}
