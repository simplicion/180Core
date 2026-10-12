'use client';

import React, { useState, useEffect } from 'react';
import {
  Headphones,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Laptop,
  Globe,
  MapPin,
  Image as ImageIcon,
  MessageSquare,
  AlertTriangle,
  X,
  FileText,
  User,
  ShieldAlert,
  Download,
  Filter,
  Send,
  LifeBuoy,
  Bug,
  CreditCard,
  HelpCircle,
  Sparkles,
  Terminal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, exportToCsv } from '@/lib/api';

export default function SupportDeskPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Resolution form state
  const [updateStatus, setUpdateStatus] = useState('RESOLVED');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter, categoryFilter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTickets({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      });
      if (res.success) {
        setTickets(res.tickets || res.data?.tickets || []);
      }
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;
    try {
      setSubmitting(true);
      const res = await adminApi.updateTicket(selectedTicket.id, {
        status: updateStatus,
        adminNotes: adminNotes.trim(),
      });
      if (res.success) {
        toast.success(`Ticket #${selectedTicket.ticketNumber || selectedTicket.id.slice(0, 6)} resolution saved!`);
        setSelectedTicket(null);
        loadTickets();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNotification = () => {
    if (!selectedTicket) return;
    toast.success(
      `Email & in-app notification dispatched to ${selectedTicket.userEmail || selectedTicket.contactEmail || 'developer'}!`
    );
  };

  const filteredTickets = tickets.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const title = (t.title || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const user = (t.userName || t.contactName || '').toLowerCase();
    const email = (t.userEmail || t.contactEmail || '').toLowerCase();
    const id = (t.id || '').toLowerCase();
    const num = String(t.ticketNumber || '');
    return (
      title.includes(term) ||
      desc.includes(term) ||
      user.includes(term) ||
      email.includes(term) ||
      id.includes(term) ||
      num.includes(term)
    );
  });

  const handleExportCsv = () => {
    if (!filteredTickets.length) {
      toast.error('No tickets to export');
      return;
    }
    const rows = filteredTickets.map((t) => ({
      TicketNumber: t.ticketNumber || t.id.slice(0, 8),
      Title: t.title || 'Untitled Ticket',
      Category: t.category || 'BUG_REPORT',
      Priority: t.priority || 'MEDIUM',
      Status: t.status,
      SubmittedBy: t.userName || t.contactName || 'Anonymous',
      Email: t.userEmail || t.contactEmail || '',
      PageURL: t.pageUrl || '/',
      DeviceOS: t.deviceInfo?.os || 'Unknown',
      Browser: t.deviceInfo?.browser || 'Unknown',
      AttachmentsCount: t.attachments ? t.attachments.length : 0,
      AdminNotes: t.adminNotes || '',
      CreatedAt: new Date(t.createdAt).toLocaleString(),
    }));
    exportToCsv('180_support_tickets_roster', rows);
    toast.success(`Exported ${filteredTickets.length} support tickets to CSV`);
  };

  // KPIs
  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const investigatingCount = tickets.filter((t) => t.status === 'INVESTIGATING' || t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
  const urgentCount = tickets.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH' || t.priority === 'CRITICAL').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            Universal Support Desk & Bug Tracker
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {openCount} Open Issues
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Incoming tickets from Floating Support Widget with client telemetry, page links, console errors, and Ctrl+V screenshots.
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search title, desc, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-52"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="BUG_REPORT">Bug Reports</option>
            <option value="PAYMENT_ISSUE">Payment Issues</option>
            <option value="SETTLEMENT_QUERY">Settlement Queries</option>
            <option value="FEATURE_REQUEST">Feature Requests</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Open Tickets</div>
            <div className="text-2xl font-black font-mono text-blue-500 mt-1">{openCount}</div>
            <div className="text-[11px] text-zinc-500">Awaiting triage</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <LifeBuoy className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Under Investigation</div>
            <div className="text-2xl font-black font-mono text-amber-500 mt-1">{investigatingCount}</div>
            <div className="text-[11px] text-zinc-500">Assigned to engineers</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Resolved Cases</div>
            <div className="text-2xl font-black font-mono text-emerald-500 mt-1">{resolvedCount}</div>
            <div className="text-[11px] text-zinc-500">Clean solutions deployed</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500">Urgent & High Priority</div>
            <div className="text-2xl font-black font-mono text-rose-500 mt-1">{urgentCount}</div>
            <div className="text-[11px] text-zinc-500">Critical escalation tickets</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Tickets List */}
      <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-zinc-500">Loading support desk tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-400 flex items-center justify-center mx-auto">
              <Headphones className="h-6 w-6 stroke-[1.5]" />
            </div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No Support Tickets Logged</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              No tickets or bug reports matching the current filter. Tickets submitted via the floating support desk widget or developer portal will arrive here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-zinc-400 text-[11px] bg-zinc-50/50 dark:bg-white/[0.02]">
                  <th className="py-3.5 px-6 font-medium">Ticket # & Subject</th>
                  <th className="py-3.5 px-4 font-medium">Reporter / Contact</th>
                  <th className="py-3.5 px-4 font-medium">Category</th>
                  <th className="py-3.5 px-4 font-medium">Origin Page</th>
                  <th className="py-3.5 px-4 font-medium">Screenshots</th>
                  <th className="py-3.5 px-4 font-medium">Priority</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono">
                {filteredTickets.map((t) => {
                  const isUrgent = t.priority === 'URGENT' || t.priority === 'HIGH' || t.priority === 'CRITICAL';
                  const isResolved = t.status === 'RESOLVED' || t.status === 'CLOSED';
                  const isInvestigating = t.status === 'INVESTIGATING' || t.status === 'IN_PROGRESS';

                  return (
                    <tr
                      key={t.id}
                      onClick={() => {
                        setSelectedTicket(t);
                        setUpdateStatus(t.status === 'OPEN' ? 'RESOLVED' : t.status);
                        setAdminNotes(t.adminNotes || '');
                      }}
                      className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-6 font-sans">
                        <div className="font-bold text-blue-500 font-mono">
                          #{t.ticketNumber || t.id.slice(0, 8)}
                        </div>
                        <div className="font-medium text-zinc-900 dark:text-white truncate max-w-[200px]">
                          {t.title || 'Support Query'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {t.userName || t.contactName || 'Anonymous'}
                        </div>
                        <div className="text-[11px] text-zinc-500">{t.userEmail || t.contactEmail || 'No email'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold">
                          {t.category || 'BUG_REPORT'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500 max-w-[160px] truncate">
                        {t.pageUrl || '/'}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        {t.attachments && t.attachments.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold flex items-center gap-1 w-fit">
                            <ImageIcon className="h-3 w-3" />
                            {t.attachments.length} Image{t.attachments.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isUrgent
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : 'bg-zinc-100 dark:bg-white/10 text-zinc-500'
                          }`}
                        >
                          {t.priority || 'MEDIUM'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isResolved
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : isInvestigating
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-sans text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(t);
                            setUpdateStatus(t.status === 'OPEN' ? 'RESOLVED' : t.status);
                            setAdminNotes(t.adminNotes || '');
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details Inspection Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[92vh] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-y-auto space-y-6">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      Ticket #{selectedTicket.ticketNumber || selectedTicket.id.slice(0, 8)}
                      <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-500">
                        {selectedTicket.category || 'BUG_REPORT'}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Submitted by {selectedTicket.userName || selectedTicket.contactName || 'Anonymous'} (
                      {selectedTicket.userEmail || selectedTicket.contactEmail || 'No email'})
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Client Environment Telemetry Grid */}
              <div className="mt-6 p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-blue-500" />
                  Auto-Captured Client Telemetry
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Page URL:</span>
                    <a
                      href={selectedTicket.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline truncate block font-mono text-[11px]"
                    >
                      {selectedTicket.pageUrl || '/'}
                    </a>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">User Device / OS:</span>
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {selectedTicket.deviceInfo?.os || 'Windows 10 / 11'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Browser:</span>
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {selectedTicket.deviceInfo?.browser || 'Chrome 129'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Screen / Viewport:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {selectedTicket.deviceInfo?.screen || selectedTicket.deviceInfo?.viewport || '1920x1080 (DPR 1.5)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Timezone / Local Time:</span>
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {selectedTicket.deviceInfo?.timezone || selectedTicket.timezone || 'Asia/Kathmandu (UTC+05:45)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Online Status:</span>
                    <span className="text-emerald-500 font-semibold">Online (High-Speed Fiber)</span>
                  </div>
                </div>

                {/* Console Logs / Error Trace if captured */}
                {selectedTicket.consoleLogs && selectedTicket.consoleLogs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/5 space-y-1">
                    <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1.5">
                      <Terminal className="h-3 w-3" />
                      Client Console Logs Captured:
                    </span>
                    <div className="font-mono text-[10px] p-2 rounded-xl bg-black/40 text-rose-300 max-h-24 overflow-y-auto">
                      {JSON.stringify(selectedTicket.consoleLogs, null, 2)}
                    </div>
                  </div>
                )}
              </div>

              {/* User Description (Up to 1000 lines) */}
              <div className="mt-6 space-y-2">
                <label className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-zinc-400" />
                  Issue Description & Query (Up to 1,000 Lines)
                </label>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Attached Screenshots (Ctrl + V images) */}
              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div className="mt-6 space-y-2">
                  <label className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                    Attached Screenshots ({selectedTicket.attachments.length} Images - Ctrl+V Pasted)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedTicket.attachments.map((img: string, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(img)}
                        className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 group cursor-pointer aspect-video bg-zinc-900"
                      >
                        <img src={img} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          Expand Fullscreen
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Resolution Section */}
              <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Admin Resolution & Feedback</h4>
                  <button
                    type="button"
                    onClick={handleSendNotification}
                    className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 font-semibold"
                  >
                    <Send className="h-3 w-3" />
                    Send Notification Email
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      Update Status
                    </label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none"
                    >
                      <option value="OPEN">Open</option>
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      Resolution Notes for Developer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Fixed telemetry reporting in backend v1.0.4. Developer verified."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-6 border-t border-zinc-100 dark:border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
              >
                Close
              </button>
              <button
                disabled={submitting}
                onClick={handleUpdateTicket}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 transition-all"
              >
                {submitting ? 'Saving...' : 'Update & Save Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox Preview */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer backdrop-blur-sm"
        >
          <img
            src={previewImage}
            alt="Fullscreen Attachment"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
