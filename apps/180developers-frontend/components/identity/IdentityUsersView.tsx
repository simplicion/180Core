'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Users,
  Search,
  RotateCw,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  UserX,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export function IdentityUsersView() {
  const {
    project,
    authLogs,
    loadingAuthLogs,
    fetchAuthLogs,
    handleRevokeUserSession,
    revokingUserId,
    copiedKey,
    copyToClipboard,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ALL');

  // Lazy loading pagination state
  const [displayedCount, setDisplayedCount] = useState(15);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAuthLogs();
  }, [fetchAuthLogs]);

  const rawLogs = authLogs?.logs || [];

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log: any) => {
      const name = (log.user?.name || '').toLowerCase();
      const email = (log.user?.email || '').toLowerCase();
      const username = (log.user?.username || log.appSpecificUsernames?.[project?.id || ''] || '').toLowerCase();
      const userId = (log.userId || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || username.includes(q) || userId.includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE') return log.status === 'ACTIVE_SESSION';
      if (statusFilter === 'EXPIRED') return log.status !== 'ACTIVE_SESSION';

      return true;
    });
  }, [rawLogs, searchQuery, statusFilter, project?.id]);

  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, displayedCount);
  }, [filteredLogs, displayedCount]);

  // Infinite scroll trigger via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedCount < filteredLogs.length) {
          setDisplayedCount((prev) => Math.min(prev + 15, filteredLogs.length));
        }
      },
      { threshold: 0.2 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [displayedCount, filteredLogs.length]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Metric Summary */}
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span>Authenticated Users & Universal Identities</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Live directory of authenticated users who have logged into this application.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{authLogs?.activeSessionsCount ?? 0} Active Sessions</span>
            </span>
            <button
              type="button"
              onClick={fetchAuthLogs}
              disabled={loadingAuthLogs}
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh directory"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAuthLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 2. Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayedCount(15);
              }}
              placeholder="Search by name, email, @username, or user ID..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs self-start sm:self-auto">
            {(['ALL', 'ACTIVE', 'EXPIRED'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter);
                  setDisplayedCount(15);
                }}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {filter === 'ALL' ? 'All Users' : filter === 'ACTIVE' ? 'Active' : 'Expired'}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Directory Table with Infinite Lazy Loading */}
        <div className="space-y-3 pt-1">
          {loadingAuthLogs && rawLogs.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-900 dark:text-white" />
              <p className="text-xs text-zinc-400">Loading authorized users...</p>
            </div>
          ) : visibleLogs.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 font-semibold">
                  <tr>
                    <th className="px-4 py-3">User & Identity</th>
                    <th className="px-4 py-3">App Username</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Connected Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {visibleLogs.map((log: any) => {
                    const isRevokingThis = revokingUserId === log.userId;
                    const appUsername = log.appSpecificUsernames?.[project?.id || ''] || log.user?.username;

                    return (
                      <tr key={log.id || log.userId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-xs overflow-hidden shrink-0">
                              {log.user?.avatar ? (
                                <img src={log.user.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                log.user?.name?.charAt(0) || 'U'
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-950 dark:text-white flex items-center gap-1 truncate">
                                <span>{log.user?.name || '180 User'}</span>
                                {log.user?.isVerified && (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono truncate">
                                {log.authMethod || 'Universal OIDC'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {appUsername ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              @{appUsername}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px]">
                          {log.user?.email ? (
                            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                              <span>{log.user.email}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(log.user.email, `email_${log.id}`)}
                                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                              >
                                {copiedKey === `email_${log.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Not shared</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <span>{log.userId?.slice(0, 10)}...</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.userId, `uid_${log.id}`)}
                              className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                              title="Copy User ID"
                            >
                              {copiedKey === `uid_${log.id}` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'ACTIVE_SESSION'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {log.status === 'ACTIVE_SESSION' ? 'Active Token' : 'Expired'}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                          {new Date(log.connectedSince || log.grantedAt || Date.now()).toLocaleDateString()}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {log.status === 'ACTIVE_SESSION' ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeUserSession(log.userId, log.user?.name || 'User')}
                              disabled={isRevokingThis}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                              title="Revoke active user session"
                            >
                              {isRevokingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserX className="w-3 h-3" />
                              )}
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-400 italic">None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center space-y-2">
              <p className="text-xs text-zinc-500">No users match your criteria.</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}

          {/* Lazy loading infinite scroll anchor */}
          {displayedCount < filteredLogs.length && (
            <div ref={observerTarget} className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more users as you scroll ({displayedCount} of {filteredLogs.length})...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IdentityUsersView;
