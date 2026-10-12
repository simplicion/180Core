'use strict';
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LifeBuoy,
  X,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Monitor,
  MapPin,
  Clock,
  Shield,
  Send,
  Eye,
  RefreshCw,
  Paperclip,
  Plus,
  AlertTriangle,
  FileText,
  Copy,
  Terminal,
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
  { id: 'PAYMENT_ISSUE', label: '180 Pay / Checkout Issue', priority: 'HIGH' },
  { id: 'SETTLEMENT_QUERY', label: 'Payout & Settlement Query', priority: 'MEDIUM' },
  { id: 'INTEGRATION_HELP', label: 'SDK / Webhook Help', priority: 'MEDIUM' },
  { id: 'FEATURE_REQUEST', label: 'Feature Request', priority: 'LOW' },
  { id: 'OTHER', label: 'General Feedback', priority: 'LOW' },
];

const MAX_IMAGES = 5;
const MAX_LINES = 1000;
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<FloatingSupportAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
    }
  }, [isOpen]);

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

    toast.success(`Attached ${validFiles.length} image${validFiles.length > 1 ? 's' : ''}`);
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

  // Line count calculator
  const lineCount = description.split('\n').length;

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a brief title for your query');
      return;
    }
    if (!description.trim()) {
      toast.error('Please enter a description of the issue');
      return;
    }
    if (lineCount > MAX_LINES) {
      toast.error(`Description cannot exceed ${MAX_LINES} lines.`);
      return;
    }

    setSubmitting(true);
    try {
      const baseUrl = apiBaseUrl || backendUrl || 'http://localhost:4003';
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        pageUrl: telemetry.pageUrl,
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
        userId: userContext?.id,
        userName: userContext?.name,
        userEmail: userContext?.email,
        appId: appContext?.id,
      };

      const res = await fetch(`${baseUrl}/api/v1/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit support ticket');
      }

      setSubmittedTicket(data.ticket);
      toast.success(`Support Ticket #${data.ticket.ticketNumber} submitted!`);
    } catch (err: any) {
      console.error('[FloatingSupportWidget] Error:', err);
      toast.error(err.message || 'Error sending support request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setAttachments([]);
    setSubmittedTicket(null);
    setCategory('BUG_REPORT');
    setPriority('HIGH');
    setIsOpen(false);
  };

  return (
    <>
      {/* 1. Floating Pill Button in Corner */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={clsx(
            'fixed z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold shadow-2xl border border-white/20 dark:border-black/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group',
            defaultPosition === 'bottom-right' ? 'bottom-5 right-5' : 'bottom-5 left-5'
          )}
          title="Need Help? Report an Issue (Ctrl+V Screenshots Supported)"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
          </span>
          <LifeBuoy className="w-4 h-4 text-purple-400 dark:text-purple-600 group-hover:rotate-45 transition-transform" />
          <span className="hidden sm:inline">Support &amp; Feedback</span>
        </button>
      )}

      {/* 2. Floating Bottom-Right Drawer / Modal */}
      {isOpen && (
        <div
          ref={modalRef}
          className={clsx(
            'fixed z-50 w-[95vw] sm:w-[480px] max-h-[88vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-[#101012]/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 select-none',
            defaultPosition === 'bottom-right' ? 'bottom-5 right-5' : 'bottom-5 left-5'
          )}
        >
          {/* Header Bar */}
          <div className="p-4 px-5 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <span>180 Core Support Desk</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                    Direct
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Auto-telemetry &amp; Ctrl+V screenshot recording enabled
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {submittedTicket ? (
              /* Success State */
              <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                    Ticket #{submittedTicket.ticketNumber} Submitted!
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                    Your issue and complete device diagnostics have been logged to the 180 Core Engineering Admin.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            ) : (
              /* Form State */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category & Priority Selectors */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Issue Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        const selected = CATEGORIES.find((c) => c.id === e.target.value);
                        setCategory(e.target.value);
                        if (selected) setPriority(selected.priority);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                      Severity Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="LOW">Low (Cosmetic / Question)</option>
                      <option value="MEDIUM">Medium (Normal)</option>
                      <option value="HIGH">High (Blocking Flow)</option>
                      <option value="URGENT">Urgent (Payment Critical)</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                    Subject / Short Summary *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Settlement button unresponsive or QR code scan error"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Description (Supports 1000 lines) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      Issue Description &amp; Reproduction Steps *
                    </label>
                    <span
                      className={clsx(
                        'text-[10px] font-mono',
                        lineCount > MAX_LINES ? 'text-rose-500 font-bold' : 'text-zinc-400'
                      )}
                    >
                      Lines: {lineCount} / {MAX_LINES}
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    required
                    rows={6}
                    placeholder="Describe what occurred, any error messages, and reproduction steps... Tip: You can paste (Ctrl+V) screenshots directly here!"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                  />
                </div>

                {/* Attachments Section (Ctrl+V Paste + Upload button, max 5) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                      <span>Screenshots ({attachments.length} / {MAX_IMAGES})</span>
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded-full">
                      Ctrl + V to paste image
                    </span>
                  </div>

                  {/* Thumbnail Previews */}
                  {attachments.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 pt-1">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="relative group rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden aspect-square bg-zinc-100 dark:bg-zinc-800"
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
                            className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Box if under max */}
                  {attachments.length < MAX_IMAGES && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={clsx(
                        'p-3 rounded-xl border-2 border-dashed text-center transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold',
                        isDragging
                          ? 'border-purple-500 bg-purple-500/10 text-purple-600'
                          : 'border-zinc-200 dark:border-white/10 hover:border-purple-500/40 text-zinc-500 dark:text-zinc-400'
                      )}
                    >
                      <Upload className="w-3.5 h-3.5 text-purple-500" />
                      <span>Click to upload or drag &amp; drop ({MAX_IMAGES - attachments.length} remaining)</span>
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
                    </div>
                  )}
                </div>

                {/* Auto-Captured Telemetry Summary Badge */}
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/5 space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 font-bold">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-500" />
                      Auto-Captured Context
                    </span>
                    <span className="text-[9px] text-emerald-500 font-bold uppercase">Ready</span>
                  </div>
                  <p className="truncate">
                    <span className="font-semibold">URL:</span> {telemetry.pageUrl}
                  </p>
                  <p>
                    <span className="font-semibold">Environment:</span> {telemetry.os} &bull; {telemetry.browser} &bull; {telemetry.screenResolution} &bull; {telemetry.timeZone}
                  </p>
                  {appContext && (
                    <p>
                      <span className="font-semibold">App:</span> {appContext.name} ({appContext.clientId?.slice(0, 16)}...)
                    </p>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {submitting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Submit Inquiry</span>
                  </button>
                </div>
              </form>
            )}
          </div>
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
