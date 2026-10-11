'use client';

import React, { useState } from 'react';
import {
  Shield,
  Sliders,
  Play,
  Monitor,
  Smartphone,
  Save,
  Loader2,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { OneEightyIdentity } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';

export function IdentityOverviewView() {
  const { project, projectId, enableAuth, setEnableAuth, saveSettings, saving } = useProject();

  const [authUxModes, setAuthUxModes] = useState<string[]>(
    project?.authUxModes || ['popup', 'bottom_sheet']
  );
  const [authDesktopDefault, setAuthDesktopDefault] = useState<string>(
    project?.authDesktopDefault || 'popup'
  );
  const [authMobileDefault, setAuthMobileDefault] = useState<string>(
    project?.authMobileDefault || 'bottom_sheet'
  );
  const [accessTokenTtl, setAccessTokenTtl] = useState<number>(
    project?.accessTokenTtl || 900
  );
  const [refreshTokenDays, setRefreshTokenDays] = useState<number>(
    project?.refreshTokenDays || 7
  );

  const handleSave = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    await saveSettings({
      enableAuth,
      authUxModes,
      authDesktopDefault,
      authMobileDefault,
      accessTokenTtl,
      refreshTokenDays,
    });
  };

  const onTestPopup = () => {
    if (!project) return;
    try {
      OneEightyIdentity.openPopup({
        clientId: project.clientId,
        uxMode: 'popup',
        onSuccess: (res: any) => toast.success(`Auth modal test passed! Code: ${res?.code ? res.code.slice(0, 10) : 'OK'}`),
        onCancel: () => toast('Auth modal closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Popup test failed');
    }
  };

  const onTestBottomSheet = () => {
    if (!project) return;
    try {
      OneEightyIdentity.openBottomSheet({
        clientId: project.clientId,
        uxMode: 'bottom_sheet',
        onSuccess: (res: any) => toast.success(`Auth bottom sheet test passed! User: ${res?.user?.name || res?.code?.slice(0, 8) || 'OK'}`),
        onCancel: () => toast('Auth bottom sheet closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Bottom sheet test failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Service Status Toggle Card */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-4 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                enableAuth ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">180 Identity Engine</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    enableAuth
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {enableAuth ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Universal login with WhatsApp OTP, Google SSO, and unified @usernames. Issues RS256 asymmetric JWKS access tokens.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {enableAuth ? 'Service Enabled' : 'Service Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enableAuth}
              onClick={() => setEnableAuth(!enableAuth)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enableAuth ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enableAuth ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Presentation & UX Modes */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-500" />
              <span>Authentication Presentation & UX Modes</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Customize auth display behaviors for desktop vs mobile devices.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
            OAuth 2.0 UX
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-white/5">
            <Shield className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Supported Display Modes</span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'popup', label: 'Popup Window' },
                { id: 'bottom_sheet', label: 'Bottom Sheet (Drawer)' },
                { id: 'full_page', label: 'Full Page Redirect' },
              ].map((mode) => {
                const isSelected = authUxModes.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (authUxModes.length > 1) {
                          setAuthUxModes(authUxModes.filter((m) => m !== mode.id));
                        }
                      } else {
                        setAuthUxModes([...authUxModes, mode.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Monitor className="w-3 h-3 text-zinc-400" />
                <span>Desktop Default</span>
              </label>
              <select
                value={authDesktopDefault}
                onChange={(e) => setAuthDesktopDefault(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="popup">Popup Window (Recommended)</option>
                <option value="bottom_sheet">Bottom Sheet</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-zinc-400" />
                <span>Mobile Default</span>
              </label>
              <select
                value={authMobileDefault}
                onChange={(e) => setAuthMobileDefault(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                <option value="bottom_sheet">Bottom Sheet (Recommended)</option>
                <option value="popup">Popup Window</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Simulator Test Triggers */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-emerald-500" />
              <span>Interactive SDK Experience Tester</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">Simulate User Flow</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onTestPopup}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-blue-500/50 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all hover:scale-102"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-500" />
              <span>Launch Popup Flow</span>
            </button>

            <button
              type="button"
              onClick={onTestBottomSheet}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-blue-500/50 text-xs font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all hover:scale-102"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-500" />
              <span>Launch Bottom Sheet Flow</span>
            </button>
          </div>
        </div>

        {/* Save button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default IdentityOverviewView;
