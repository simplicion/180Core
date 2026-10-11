'use client';

import React from 'react';
import {
  Settings,
  Key,
  Copy,
  Check,
  RotateCw,
  Save,
  Loader2,
  Lock,
  Globe,
  Trash2,
  ShieldAlert,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { PlatformDrawer } from '@workspace/ui';
import { DeveloperAppDetail } from './types';
import { AppLogoUploader } from './AppLogoUploader';

export interface ProjectSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  app: DeveloperAppDetail;
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  logoUrl: string;
  setLogoUrl: (val: string) => void;
  redirectUrisInput: string;
  setRedirectUrisInput: (val: string) => void;
  allowedOriginsInput: string;
  setAllowedOriginsInput: (val: string) => void;
  onSave: (e?: React.SyntheticEvent) => void;
  saving: boolean;
  onRevokeTokens: () => void;
  isRevoking: boolean;
  onDeleteAppClick: () => void;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  onRotateSecretClick?: () => void;
}

export function ProjectSettingsDrawer({
  isOpen,
  onClose,
  app,
  name,
  setName,
  description,
  setDescription,
  logoUrl,
  setLogoUrl,
  redirectUrisInput,
  setRedirectUrisInput,
  allowedOriginsInput,
  setAllowedOriginsInput,
  onSave,
  saving,
  onRevokeTokens,
  isRevoking,
  onDeleteAppClick,
  copiedKey,
  copyToClipboard,
  onRotateSecretClick,
}: ProjectSettingsDrawerProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(e);
  };

  return (
    <PlatformDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Project Settings"
      icon={Settings}
      iconColorClass="text-zinc-900 dark:text-white"
      iconBgClass="bg-zinc-100 dark:bg-zinc-800"
      maxWidthClass="max-w-xl"
      subHeader={
        <div className="px-6 py-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>Configure general project metadata, security credentials, and web origins.</span>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 flex items-center gap-2 cursor-pointer transition-colors min-h-[40px] disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Settings</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Permanent / Immutable Project Identifiers */}
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Project Identifiers</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
              Permanent
            </span>
          </div>

          <div className="space-y-3">
            {/* Project ID */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Project ID (System UUID)
              </label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white">
                <span className="flex-1 truncate">{app.id}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(app.id, 'projectId')}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                  title="Copy Project ID"
                >
                  {copiedKey === 'projectId' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Client ID */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                OAuth 2.0 Client ID
              </label>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white">
                <span className="flex-1 truncate">{app.clientId}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(app.clientId, 'clientId')}
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                  title="Copy Client ID"
                >
                  {copiedKey === 'clientId' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-start gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              The Project ID and Client ID are immutable cryptographically bound identifiers generated at creation time and cannot be modified.
            </span>
          </div>
        </div>

        {/* 2. Project Profile (Name, Description, Logo) */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Project Profile
          </h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Project Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My NextGen Portal"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of this project and what it powers..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          {/* Project Logo Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Project Brand Logo
            </label>
            <AppLogoUploader
              logoUrl={logoUrl}
              onChange={setLogoUrl}
              appId={app.id}
            />
          </div>
        </div>

        {/* 3. Project-Level Security & Web Configuration */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Project-Level Web & OAuth Security</span>
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono">Applies to all apps</span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-[11px] text-zinc-500 dark:text-zinc-400">
            Redirect URIs and CORS Allowed Origins are validated at the project level, securing logins and payment sessions across both 180 Identity and 180 Pay.
          </div>

          {/* Redirect URIs */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              OAuth 2.0 Redirect URIs (One per line)
            </label>
            <textarea
              rows={3}
              value={redirectUrisInput}
              onChange={(e) => setRedirectUrisInput(e.target.value)}
              placeholder="https://yourapp.com/api/auth/callback&#10;http://localhost:3000/callback"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          {/* CORS Allowed Origins */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Allowed Web Origins (CORS)
            </label>
            <textarea
              rows={2}
              value={allowedOriginsInput}
              onChange={(e) => setAllowedOriginsInput(e.target.value)}
              placeholder="https://yourapp.com&#10;http://localhost:3000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>
        </div>

        {/* 4. Danger Zone */}
        <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/30 dark:bg-red-950/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Danger Zone
            </h3>
          </div>

          <div className="divide-y divide-red-200/60 dark:divide-red-500/10 text-xs">
            {/* Revoke Tokens */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-zinc-900 dark:text-white">Revoke All Active Tokens</div>
                <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Instantly terminates all active user sessions and tokens for this project.
                </div>
              </div>
              <button
                type="button"
                onClick={onRevokeTokens}
                disabled={isRevoking}
                className="px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 font-semibold cursor-pointer transition-colors text-xs shrink-0"
              >
                {isRevoking ? 'Revoking...' : 'Revoke Tokens'}
              </button>
            </div>

            {/* Delete Project */}
            <div className="pt-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-zinc-900 dark:text-white">Delete Project</div>
                <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  Permanently deletes this project and unlinks all integrated apps.
                </div>
              </div>
              <button
                type="button"
                onClick={onDeleteAppClick}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer transition-colors shadow-xs text-xs shrink-0 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Project</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </PlatformDrawer>
  );
}

export default ProjectSettingsDrawer;
