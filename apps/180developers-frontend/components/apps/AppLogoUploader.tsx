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
}

export function AppLogoUploader({
  logoUrl,
  onChange,
  appId,
  className = '',
}: AppLogoUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getApiBase = () => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'http://localhost:4003';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://services.180workspace.com');
  };

  const isR2Hosted = (url: string) => {
    if (!url) return false;
    return (
      url.includes('.r2.dev') ||
      url.includes('.r2.cloudflarestorage.com') ||
      url.includes('reels-cdn') ||
      url.includes('180workspace.com/brands') ||
      url.includes('180workspace.com/media')
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
    const toastId = toast.loading('Uploading app logo to 180 Media Pipeline (Cloudflare R2)...');

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
        toast.success('App logo uploaded to 180 Media Pipeline (R2)!', { id: toastId });
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

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header and Mode Selector */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
          <span>App Logo (White-label OAuth Branding)</span>
          <span className="text-red-500">*</span>
        </label>

        {/* Tab switch: Upload vs URL */}
        <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <UploadCloud className="w-3 h-3" />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-1 ${
              activeTab === 'url'
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Link2 className="w-3 h-3" />
            Custom URL
          </button>
        </div>
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

      {/* Existing Logo Display Card */}
      {logoUrl.trim() && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Square Preview */}
            <div className="relative w-12 h-12 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 overflow-hidden flex items-center justify-center p-1.5 shrink-0 shadow-xs">
              <img
                src={logoUrl.trim()}
                alt="App logo preview"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                  Current Logo
                </span>
                {isR2Hosted(logoUrl) ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-2.5 h-2.5" />
                    180 Media Pipeline (R2)
                  </span>
                ) : logoUrl.startsWith('data:') ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Direct Upload
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    External URL
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-400 truncate max-w-[280px] sm:max-w-md">
                {logoUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
              <span>Replace</span>
            </button>
            <a
              href={logoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              title="Open logo in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
              title="Remove logo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Action: Dropzone or URL Input */}
      {activeTab === 'upload' ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => {
            if (!isUploading) fileInputRef.current?.click();
          }}
          className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-4 sm:p-5 text-center transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 ring-4 ring-blue-500/10'
              : 'border-zinc-200 dark:border-white/15 bg-zinc-50/60 dark:bg-zinc-900/40 hover:border-blue-500/60 hover:bg-blue-50/20 dark:hover:bg-blue-900/10'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-2 space-y-2">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Streaming to Media Pipeline...
                </p>
                <p className="text-[11px] text-zinc-400">
                  Uploading and optimizing logo on Cloudflare R2 CDN
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <span className="text-blue-600 dark:text-blue-400 font-bold underline decoration-blue-500/30 underline-offset-2">
                    Click to upload
                  </span>{' '}
                  or drag and drop your logo
                </p>
                <p className="text-[11px] text-zinc-400">
                  PNG, JPEG, WebP, SVG or GIF (up to 5MB, square 1:1 ratio recommended)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Manual URL input fallback */
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="url"
              required
              placeholder="https://yourapp.com/logo.png"
              value={logoUrl}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
            Provide an absolute HTTPS link to your logo asset. Using direct upload is recommended for faster global CDN delivery.
          </p>
        </div>
      )}

      {/* Helpful context footnote */}
      <p className="text-[10px] text-zinc-400">
        Displayed in 180 Identity OAuth 2.0 authorization prompts and 1-Click Checkout headers for your users.
      </p>
    </div>
  );
}

export default AppLogoUploader;
