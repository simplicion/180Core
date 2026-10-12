'use client';

import React, { useState } from 'react';
import {
  Headphones,
  X,
  Send,
  AlertTriangle,
  Bug,
  CreditCard,
  HelpCircle,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import Link from 'next/link';

export function FloatingSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('BUG_REPORT');
  const [priority, setPriority] = useState('MEDIUM');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Please enter a ticket title and description');
      return;
    }

    try {
      setSubmitting(true);
      const telemetry = {
        os: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
        browser: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ')[0] : 'Browser',
        resolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
      };

      const res = await adminApi.createTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        contactEmail: email.trim() || 'operator@180core.cloud',
        contactName: 'Platform Super Admin',
        pageUrl: typeof window !== 'undefined' ? window.location.pathname : '/',
        deviceInfo: telemetry,
      });

      if (res.success || res.ticket) {
        toast.success('Incident / support ticket dispatched to 180 telemetry desk!');
        setSubmittedTicket(res.ticket || { ticketNumber: 'SUBMITTED' });
        setTitle('');
        setDescription('');
      } else {
        toast.error(res.error || 'Failed to dispatch ticket');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error submitting ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setTitle('');
    setDescription('');
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open Sovereign Telemetry Support Desk"
          title="Open Sovereign Telemetry Support Desk"
          className="group relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-xl shadow-blue-500/25 border border-white/20 transition-all duration-300 hover:scale-105 active:scale-95 min-h-[44px] min-w-[44px]"
        >
          {isOpen ? (
            <X className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <>
              <Headphones className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-black" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Floating Bottom-Right Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <Headphones className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  Telemetry Support Desk
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                    Live
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-500">Fast incident logging & dispatch</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-4 text-xs">
            {submittedTicket ? (
              <div className="py-6 text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-sm">Ticket Dispatched!</h4>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                    Your issue was logged to the sovereign telemetry desk under Ticket #
                    {submittedTicket.ticketNumber || submittedTicket.id?.slice(0, 8)}.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/10"
                  >
                    Submit Another
                  </button>
                  <Link
                    href="/support"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                  >
                    <span>View Support Desk</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Incident Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Settlement latency or Checkout API 500"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
                    >
                      <option value="BUG_REPORT">Bug Report</option>
                      <option value="PAYMENT_ISSUE">Payment Issue</option>
                      <option value="SETTLEMENT_QUERY">Settlement Claim</option>
                      <option value="FEATURE_REQUEST">Feature Request</option>
                      <option value="OTHER">Other Query</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent (P0)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="operator@180core.cloud"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Description & Telemetry Context *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the anomaly, error code, or telemetry logs..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[10px] text-zinc-500 flex items-center justify-between">
                  <span>Captures active route & client headers</span>
                  <span className="font-mono text-blue-500 font-bold">Auto-Attached</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Dispatching Telemetry...' : 'Submit Support Ticket'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Footer Link to Full Desk */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Need the full triage ledger?</span>
            <Link
              href="/support"
              onClick={() => setIsOpen(false)}
              className="text-blue-500 hover:text-blue-400 font-bold flex items-center gap-1"
            >
              <span>Support Desk</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
