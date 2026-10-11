'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  RotateCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Search,
  Filter,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';

export function IdentityLogsView() {
  const { authLogs, loadingAuthLogs, fetchAuthLogs } = useProject();
  const [logFilter, setLogFilter] = useState<'ALL' | 'SUCCESS' | 'REVOKED'>('ALL');
  const [displayedLogsCount, setDisplayedLogsCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAuthLogs();
    // Auto-refresh logs every 15 seconds for live telemetry
    const interval = setInterval(() => {
      fetchAuthLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAuthLogs]);

  const rawLogs = authLogs?.logs || [];

  const filteredLogs = rawLogs.filter((log: any) => {
    if (logFilter === 'SUCCESS') return log.status === 'ACTIVE_SESSION';
    if (logFilter === 'REVOKED') return log.status !== 'ACTIVE_SESSION';
    return true;
  });

  const visibleLogs = filteredLogs.slice(0, displayedLogsCount);

  // Lazy loading scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayedLogsCount < filteredLogs.length) {
          setDisplayedLogsCount((prev) => Math.min(prev + 15, filteredLogs.length));
        }
      },
      { threshold: 0.2 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [displayedLogsCount, filteredLogs.length]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Real-Time Authentication Telemetry</span>
              </h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE STREAM</span>
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Chronological security logs of all authorizations, logins, and token exchanges.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAuthLogs}
              disabled={loadingAuthLogs}
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh logs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingAuthLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2">
          {(['ALL', 'SUCCESS', 'REVOKED'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => {
                setLogFilter(filter);
                setDisplayedLogsCount(20);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                logFilter === filter
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {filter === 'ALL' ? 'All Events' : filter === 'SUCCESS' ? 'Active Sessions' : 'Revoked / Expired'}
            </button>
          ))}
        </div>

        {/* Real-Time Log Entries */}
        <div className="space-y-2">
          {loadingAuthLogs && rawLogs.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-900 dark:text-white" />
              <p className="text-xs text-zinc-400">Streaming authentication events...</p>
            </div>
          ) : visibleLogs.length > 0 ? (
            <div className="divide-y divide-zinc-200 dark:divide-white/5 rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/30 overflow-hidden font-mono text-xs">
              {visibleLogs.map((log: any) => {
                const isSuccess = log.status === 'ACTIVE_SESSION';
                const dateStr = new Date(log.grantedAt || log.connectedSince || Date.now()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {isSuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-zinc-950 dark:text-white font-sans text-xs">
                            {log.user?.name || '180 User'}
                          </span>
                          <span className="text-zinc-400 text-[11px]">
                            {log.user?.email || log.userId}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 pt-0.5">
                          <span>Method: {log.authMethod || 'OAuth 2.0 PKCE'}</span>
                          <span>•</span>
                          <span>IP: {log.ipAddress || '127.0.0.1'}</span>
                          <span>•</span>
                          <span>Device: {log.userAgent?.slice(0, 24) || 'Web Browser'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                          isSuccess
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {isSuccess ? 'Authorized' : 'Expired'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 text-center text-xs text-zinc-500">
              No authentication events logged yet.
            </div>
          )}

          {/* Lazy loading infinite scroll anchor */}
          {displayedLogsCount < filteredLogs.length && (
            <div ref={observerTarget} className="py-4 flex items-center justify-center gap-2 text-xs text-zinc-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading more telemetry events ({displayedLogsCount} of {filteredLogs.length})...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default IdentityLogsView;
