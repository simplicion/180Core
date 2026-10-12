'use strict';
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LifeBuoy,
  X,
  Send,
  Paperclip,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

export interface FloatingSupportAttachment {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
}

export interface FloatingSupportWidgetProps {
  userContext?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  appContext?: {
    id?: string;
    name?: string;
    clientId?: string;
  };
  apiBaseUrl?: string;
  backendUrl?: string;
  defaultPosition?: 'bottom-right' | 'bottom-left';
}

const CATEGORIES = [
  { id: 'BUG_REPORT', label: 'Bug / Broken UI', priority: 'HIGH' },
  { id: 'DATA_SYNC', label: 'Data & Sync', priority: 'HIGH' },
  { id: 'SLOW_PERFORMANCE', label: 'Slow Performance', priority: 'MEDIUM' },
  { id: 'ACCOUNT_BILLING', label: 'Account & Billing', priority: 'MEDIUM' },
  { id: 'OTHER', label: 'Other', priority: 'LOW' },
];

const MAX_IMAGES = 5;
const MAX_CHARS = 5000;
const MAX_TOTAL_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export function FloatingSupportWidget({
  userContext,
  appContext,
  apiBaseUrl,
  backendUrl,
  defaultPosition = 'bottom-right',
}: FloatingSupportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState('BUG_REPORT');
  const [priority, setPriority] = useState('HIGH');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<FloatingSupportAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{ id: string; ticketNumber: number } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Environmental Telemetry
  const [telemetry, setTelemetry] = useState({
    pageUrl: '',
    referrer: '',
    timeZone: '',
    localTime: '',
    userAgent: '',
    screenResolution: '',
    viewportSize: '',
    devicePixelRatio: 1,
    os: 'Unknown',
    browser: 'Unknown',
    online: true,
  });

  // Collect telemetry when opened
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const ua = navigator.userAgent;
      let detectedOs = 'Unknown OS';
      if (/Windows/i.test(ua)) detectedOs = 'Windows';
      else if (/Macintosh|Mac OS X/i.test(ua)) detectedOs = 'macOS';
      else if (/Linux/i.test(ua)) detectedOs = 'Linux';
      else if (/Android/i.test(ua)) detectedOs = 'Android';
      else if (/iPhone|iPad|iPod/i.test(ua)) detectedOs = 'iOS';

      let detectedBrowser = 'Unknown Browser';
      if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) detectedBrowser = 'Google Chrome';
      else if (/Edg/i.test(ua)) detectedBrowser = 'Microsoft Edge';
      else if (/Firefox/i.test(ua)) detectedBrowser = 'Mozilla Firefox';
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) detectedBrowser = 'Apple Safari';

      const now = new Date();
      setTelemetry({
        pageUrl: window.location.href,
        referrer: document.referrer || '',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        localTime: now.toLocaleString(),
        userAgent: ua,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio || 1,
        os: detectedOs,
        browser: detectedBrowser,
        online: navigator.onLine,
      });

      // Auto-focus textarea when opened
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Support programmatic event trigger
  useEffect(() => {
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('180_OPEN_SUPPORT', handleOpenEvent);
    return () => window.removeEventListener('180_OPEN_SUPPORT', handleOpenEvent);
  }, []);

  // Process files (paste or drag or file picker)
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (attachments.length + fileList.length > MAX_IMAGES) {
      toast.error(`Maximum limit is ${MAX_IMAGES} images. You can add ${Math.max(0, MAX_IMAGES - attachments.length)} more.`);
      return;
    }

    const currentTotalSize = attachments.reduce((acc, f) => acc + f.size, 0);
    const validFiles: File[] = [];
    let batchSize = 0;

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) {
        toast.error(`Skipped "${file.name}": Only image files (PNG, JPG, WEBP) are supported.`);
        continue;
      }
      if (currentTotalSize + batchSize + file.size > MAX_TOTAL_SIZE_BYTES) {
        toast.error(`Exceeded ${formatFileSize(MAX_TOTAL_SIZE_BYTES)} total size limit.`);
        break;
      }
      batchSize += file.size;
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            id: 'att_' + Math.random().toString(36).substring(2, 9),
            name: file.name || `screenshot-${Date.now()}.png`,
            size: file.size,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    toast.success(`Attached ${validFiles.length} screenshot${validFiles.length > 1 ? 's' : ''}`);
  }, [attachments]);

  // Global Ctrl+V clipboard paste handler when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        processFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, processFiles]);

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error('Please describe what happened in detail');
      return;
    }

    setSubmitting(true);
    try {
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const baseUrl =
        apiBaseUrl ||
        (isLocal
          ? backendUrl || 'http://localhost:4003'
          : process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud');

      const activeCategoryObj = CATEGORIES.find((c) => c.id === category);
      const firstLine = description.trim().split('\n')[0].slice(0, 80);
      const generatedTitle = `[${activeCategoryObj?.label || 'Support'}] ${firstLine}`;

      // Resolve user context if stored in localStorage
      let resolvedUserId = userContext?.id;
      let resolvedUserName = userContext?.name;
      let resolvedUserEmail = userContext?.email;

      if (!resolvedUserId && typeof window !== 'undefined') {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const u = JSON.parse(storedUser);
            resolvedUserId = u.id || u.sub;
            resolvedUserName = u.name || u.fullName || u.username;
            resolvedUserEmail = u.email;
          }
        } catch (_) {}
      }

      const payload = {
        title: generatedTitle,
        description: description.trim(),
        category,
        priority: activeCategoryObj?.priority || priority || 'HIGH',
        pageUrl: telemetry.pageUrl || (typeof window !== 'undefined' ? window.location.href : ''),
        referrer: telemetry.referrer,
        deviceInfo: {
          os: telemetry.os,
          browser: telemetry.browser,
          screenResolution: telemetry.screenResolution,
          viewportSize: telemetry.viewportSize,
          devicePixelRatio: telemetry.devicePixelRatio,
          timeZone: telemetry.timeZone,
          localTime: telemetry.localTime,
          userAgent: telemetry.userAgent,
          online: telemetry.online,
        },
        attachments: attachments.map((a) => a.dataUrl),
        userId: resolvedUserId,
        userName: resolvedUserName,
        userEmail: resolvedUserEmail,
        appId: appContext?.id,
      };

      const res = await fetch(`${baseUrl}/api/v1/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit support report');
      }

      setSubmittedTicket(data.ticket);
      toast.success(`Support Ticket #${data.ticket.ticketNumber} submitted!`);
    } catch (err: any) {
      console.error('[FloatingSupportWidget] Error:', err);
      toast.error(err.message || 'Error sending support report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setDescription('');
    setAttachments([]);
    setSubmittedTicket(null);
    setCategory('BUG_REPORT');
    setPriority('HIGH');
    setIsOpen(false);
  };

  return (
    <>
      {/* 1. Floating Quick Support Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={clsx(
            'group fixed z-40 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs font-semibold cursor-pointer select-none',
            defaultPosition === 'bottom-right' ? 'bottom-5 right-5' : 'bottom-5 left-5'
          )}
          title="Open Quick Support"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm">
            <LifeBuoy className="w-3 h-3 text-white" />
          </div>
          <span>Quick Support</span>
        </button>
      )}

      {/* 2. Quick Support Modal */}
      {isOpen && (
        <div
          ref={modalRef}
          className={clsx(
            'fixed z-50 w-[94vw] sm:w-[440px] max-h-[85vh] flex flex-col rounded-3xl border border-zinc-200/90 dark:border-white/10 bg-white dark:bg-[#121215] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 select-none p-5 sm:p-6 space-y-4',
            defaultPosition === 'bottom-right' ? 'bottom-5 right-5' : 'bottom-5 left-5'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/25 shrink-0">
                <LifeBuoy className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Quick Support
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {submittedTicket ? (
            /* Success State */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Report #{submittedTicket.ticketNumber} Dispatched
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  Thank you! Our engineering team has received your report with automated diagnostic telemetry.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Quick Support Form */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Category Pills Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((c) => {
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategory(c.id);
                        setPriority(c.priority);
                      }}
                      className={clsx(
                        'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                          : 'bg-transparent text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/15 hover:border-zinc-300 dark:hover:border-white/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {/* Textarea Container with Red Accent Outline */}
              <div>
                <div className="border border-red-500 dark:border-red-500/90 rounded-2xl p-3.5 relative bg-transparent transition-all">
                  <textarea
                    ref={textareaRef}
                    required
                    rows={6}
                    maxLength={MAX_CHARS}
                    placeholder="Describe what happened in detail... (Tip: paste screenshot directly anywhere with Ctrl+V or Cmd+V)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-transparent text-xs sm:text-[13px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Character Counter */}
                <div className="flex justify-end pt-1.5">
                  <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                    {description.length} / {MAX_CHARS.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Attached Screenshots Previews (Ctrl+V or Uploaded) */}
              {attachments.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold">
                    <span>Screenshots ({attachments.length} / {MAX_IMAGES})</span>
                    <span className="text-[10px] text-zinc-400">Ctrl+V to add more</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="relative group w-14 h-14 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setLightboxImage(att.dataUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                          title="Remove screenshot"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions: [Attach Image] and [Send Report] */}
              <div className="pt-1 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-sm"
                >
                  <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Attach Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) processFiles(e.target.files);
                  }}
                />

                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-zinc-600 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Report</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Attachment Preview"
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain shadow-2xl border border-white/20"
          />
        </div>
      )}
    </>
  );
}

export default FloatingSupportWidget;
