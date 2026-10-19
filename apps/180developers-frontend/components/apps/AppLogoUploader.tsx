'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  ImageIcon,
  Link2,
  Check,
  X,
  Loader2,
  ExternalLink,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface AppLogoUploaderProps {
  logoUrl: string;
  onChange: (url: string) => void;
  appId?: string;
  className?: string;
  label?: string;
}

export function AppLogoUploader({
  logoUrl,
  onChange,
  appId,
  className = '',
  label = 'App Logo',
}: AppLogoUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getApiBase = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud');
  };

  const isR2Hosted = (url: string) => {
    if (!url) return false;
    return (
      url.includes('.r2.dev') ||
      url.includes('.r2.cloudflarestorage.com') ||
      url.includes('reels-cdn') ||
      url.includes('180core.cloud/brands') ||
      url.includes('180core.cloud/media')
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
      'image/gif',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file format. Please upload a PNG, JPEG, WebP, SVG, or GIF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit.');
      return;
    }

    const token =
      localStorage.getItem('platform_auth_token') ||
      document.cookie.match(/(?:^|;\s*)platform_auth_token=([^;]+)/)?.[1];

    if (!token) {
      toast.error('Authentication token required. Please sign in again.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading logo to 180 Media Pipeline (R2)...');

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const apiBase = getApiBase();
      const endpoint = appId
        ? `${apiBase}/api/v1/developer/apps/${appId}/upload-logo`
        : `${apiBase}/api/v1/developer/upload-logo`;

      let uploadedUrl = '';
      let remoteSuccess = false;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (response.ok && data.success && data.url) {
            uploadedUrl = data.url;
            remoteSuccess = true;
          } else {
            console.warn('[AppLogoUploader] Remote upload returned non-success:', data);
          }
        } else {
          console.warn('[AppLogoUploader] Remote endpoint returned non-JSON response:', response.status);
        }
      } catch (networkErr: any) {
        console.warn('[AppLogoUploader] Direct network upload attempt error:', networkErr.message);
      }

      if (remoteSuccess && uploadedUrl) {
        onChange(uploadedUrl);
        toast.success('App logo uploaded to 180 Media Pipeline!', { id: toastId });
      } else {
        // High-resolution client-side data URI fallback so developer is never blocked
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        onChange(base64DataUrl);
        toast.success('App logo applied! (Ready to save)', { id: toastId });
      }
    } catch (err: any) {
      console.error('[AppLogoUploader] Upload error:', err);
      toast.error(err.message || 'Failed to process logo file', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const hasLogo = Boolean(logoUrl && logoUrl.trim());

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Sleek, Compact Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
          <span>{label}</span>
          <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500">(OAuth Branding)</span>
        </label>

        {!hasLogo && (
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'upload' ? 'url' : 'upload')}
            className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 transition-colors"
          >
            {activeTab === 'upload' ? (
              <>
                <Link2 className="w-3 h-3" />
                <span>Custom URL</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3 h-3" />
                <span>Upload File</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,image/x-icon"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* State 1: Active Logo - Sleek horizontal bar (No redundant dropzone) */}
      {hasLogo ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Compact 40x40 Thumbnail Preview */}
            <div className="relative w-10 h-10 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 overflow-hidden flex items-center justify-center p-1 shrink-0 shadow-2xs">
              <img
                src={logoUrl.trim()}
                alt="App logo preview"
                className="w-full h-full object-contain rounded-md"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">Logo Active</span>
                {isR2Hosted(logoUrl) ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-2.5 h-2.5" />
                    180 CDN
                  </span>
                ) : logoUrl.startsWith('data:') ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    URL
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono truncate max-w-[220px] sm:max-w-xs mt-0.5">
                {logoUrl.startsWith('data:') ? 'Custom asset attached' : logoUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1"
            >
              <UploadCloud className="w-3 h-3 text-blue-500" />
              <span>Replace</span>
            </button>
            {logoUrl.startsWith('http') && (
              <a
                href={logoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                title="Open logo in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 transition-colors"
              title="Remove logo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : activeTab === 'upload' ? (
        /* State 2: Empty - Minimized Compact Dropzone */
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => {
            if (!isUploading) fileInputRef.current?.click();
          }}
          className={`group cursor-pointer border border-dashed rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 ring-2 ring-blue-500/20'
              : 'border-zinc-200 dark:border-white/15 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-blue-500/50 hover:bg-blue-50/10'
          }`}
        >
          {isUploading ? (
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 py-0.5">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Uploading logo to 180 Media Pipeline (R2)...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-2">
                      Click to upload
                    </span>{' '}
                    or drag logo
                  </p>
                  <p className="text-[10px] text-zinc-400">PNG, JPG, SVG, WebP up to 5MB (1:1 ratio)</p>
                </div>
              </div>
              <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 shrink-0 group-hover:border-blue-500/40 transition-colors">
                Browse
              </span>
            </>
          )}
        </div>
      ) : (
        /* State 3: Custom URL Input */
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => onChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className="px-2.5 py-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Helpful context footnote */}
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
        Displayed in 180 Identity OAuth prompts and 180 Pay Checkout headers.
      </p>
    </div>
  );
}

export default AppLogoUploader;
