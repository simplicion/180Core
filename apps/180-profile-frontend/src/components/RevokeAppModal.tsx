'use client';

import React from 'react';
import { PlatformModal, Button } from '@workspace/ui';
import { AlertTriangle, LogOut } from 'lucide-react';
import { ConnectedApp } from '../types';

interface RevokeAppModalProps {
  app: ConnectedApp | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function RevokeAppModal({ app, onClose, onConfirm, loading = false }: RevokeAppModalProps) {
  if (!app) return null;

  const getAppLogo = (a: ConnectedApp): string => {
    if (a.logo && a.logo.trim() !== '' && a.logo !== '/icon.svg') {
      return a.logo;
    }
    const lowerName = (a.name || '').toLowerCase();
    const lowerClient = (a.clientId || '').toLowerCase();
    if (lowerName.includes('social') || lowerClient.includes('social') || lowerClient.includes('266753c1171df1e2c4a391483fd2e02e')) {
      return '/social-studio.png';
    }
    if (lowerName.includes('developer') || lowerClient.includes('developer')) {
      return '/black-icon.svg';
    }
    return a.logo || '/icon.svg';
  };

  const displayName = app.name.toLowerCase() === '180 social studio' ? '180 Social Studio' : app.name;

  return (
    <PlatformModal
      isOpen={Boolean(app)}
      onClose={onClose}
      title={`Revoke Access for ${displayName}`}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4 text-xs text-slate-600 pt-1">
        {/* App Info Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/80 p-2 flex items-center justify-center shrink-0 shadow-xs">
            <img
              src={getAppLogo(app)}
              alt={displayName}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/icon.svg';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-900 tracking-tight truncate">{displayName}</div>
            <div className="text-[11px] text-slate-500 truncate">
              {app.description || 'Authorized Application Session'}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <p className="leading-relaxed">
            Revoking access will immediately <strong className="text-rose-950 font-semibold">log you out of {displayName}</strong> across all active devices and terminate all current tokens.
          </p>
        </div>

        {app.scopes && app.scopes.length > 0 && (
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revoking Permissions:</div>
            <div className="flex flex-wrap gap-1.5">
              {app.scopes.map((scope) => (
                <span key={scope} className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-mono rounded text-slate-700">
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="min-h-[40px] cursor-pointer">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="min-h-[40px] cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{loading ? 'Revoking & Logging Out...' : 'Revoke Access & Log Out'}</span>
          </Button>
        </div>
      </div>
    </PlatformModal>
  );
}
