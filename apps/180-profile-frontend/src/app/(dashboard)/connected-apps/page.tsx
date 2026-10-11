'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AppWindow,
  ShieldCheck,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Shield,
  LogOut,
  Calendar,
} from 'lucide-react';
import { Button, UniversalSkeleton } from '@workspace/ui';
import { getCoreApiUrl } from '@/lib/api';
import toast from 'react-hot-toast';
import { ConnectedApp } from '@/types';
import { RevokeAppModal } from '@/components/RevokeAppModal';

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
  if (lower === '180 workspace' || lower === '180workspace') return '180 Workspace';
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
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [revokingApp, setRevokingApp] = useState<ConnectedApp | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const token =
        localStorage.getItem('platform_auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');
      if (!token) {
        setApps([]);
        return;
      }
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const confirmRevoke = async () => {
    if (!revokingApp) return;
    setRevoking(true);
    const targetAppName = getFormattedAppName(revokingApp.name);
    try {
      const token =
        localStorage.getItem('platform_auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');

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

  return (
    <div className="space-y-4 sm:space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-200">
        <div>
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
          <p className="text-[11px] sm:text-sm text-slate-500 mt-0.5 sm:mt-1 max-w-2xl">
            Applications authorized to authenticate your 180 Profile and interact with 180 Pay under your consent. Revoking access logs you out instantly across all devices.
          </p>
        </div>

        <a
          href="https://developers.180workspace.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 min-h-[36px] sm:min-h-[40px] rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-200 hover:bg-blue-50 text-[11px] sm:text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
        >
          <span>Developer Portal</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </a>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Apps List (2 Column Span) */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {loading ? (
            <div className="space-y-3 sm:space-y-4">
              <UniversalSkeleton type="form" count={2} />
            </div>
          ) : apps.length > 0 ? (
            apps.map((app) => {
              const displayName = getFormattedAppName(app.name);
              const appLogo = getAppLogo(app);

              return (
                <div
                  key={app.id}
                  className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-5"
                >
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    {/* Actual App Logo */}
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

                      <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-lg">
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

                  {/* Revoke & Log Out Action Button */}
                  <Button
                    variant="outline"
                    onClick={() => setRevokingApp(app)}
                    className="w-full sm:w-auto min-h-[34px] sm:min-h-[40px] px-3 sm:px-3.5 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Access</span>
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="p-8 sm:p-12 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <AppWindow className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">No Connected Applications Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You have not authorized any external applications yet. When you sign in to 180 Workspace, 180 Social Studio, or third-party client apps using your 180 Profile, they will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Security & Access Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">Unified Privacy Model</h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
              Every token issued to third-party applications is cryptographically signed using RS256 JWKS. Applications can only read the specific attributes you grant consent to.
            </p>
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-[10px] sm:text-[11px] text-slate-600 space-y-1 sm:space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Instant Revocation &amp; Logout</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500">
                Revoking an application immediately invalidates all active access tokens and automatically logs you out of that specific app across all devices.
              </p>
            </div>
          </div>
        </div>
      </div>

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
