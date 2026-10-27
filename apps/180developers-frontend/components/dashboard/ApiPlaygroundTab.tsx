'use client';

import React from 'react';
import { Code2, Send, RefreshCw } from 'lucide-react';
import { Button, LogoLoader } from '@workspace/ui';

interface DeveloperApp {
  id: string;
  name: string;
  clientId: string;
}

interface ApiPlaygroundTabProps {
  apps: DeveloperApp[];
  playgroundSelectedAppId: string;
  setPlaygroundSelectedAppId: (id: string) => void;
  playgroundSubTab: 'userinfo' | 'pkce' | 'token';
  setPlaygroundSubTab: (tab: 'userinfo' | 'pkce' | 'token') => void;
  playgroundLoading: boolean;
  playgroundOutput: any;
  handleRunPlaygroundTest: () => void;
  handleGeneratePkce: () => void;
  pkceVerifier: string;
  pkceChallenge: string;
}

export default function ApiPlaygroundTab({
  apps,
  playgroundSelectedAppId,
  setPlaygroundSelectedAppId,
  playgroundSubTab,
  setPlaygroundSubTab,
  playgroundLoading,
  playgroundOutput,
  handleRunPlaygroundTest,
  handleGeneratePkce,
  pkceVerifier,
  pkceChallenge,
}: ApiPlaygroundTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
          <Code2 className="w-6 h-6 text-amber-500" />
          <span>Interactive API Playground</span>
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Live in-browser sandbox to test token validation, userinfo introspection, and RFC 7636 PKCE challenges.
        </p>
      </div>

      {/* Playground Controls */}
      <div className="rounded-3xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#101012] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200/60 dark:border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaygroundSubTab('userinfo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                playgroundSubTab === 'userinfo'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              /api/oauth/userinfo
            </button>
            <button
              type="button"
              onClick={() => setPlaygroundSubTab('pkce')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                playgroundSubTab === 'pkce'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              PKCE Generator
            </button>
            <button
              type="button"
              onClick={() => setPlaygroundSubTab('token')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                playgroundSubTab === 'token'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              JWT Inspector
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Target App:</span>
            <select
              value={playgroundSelectedAppId}
              onChange={(e) => setPlaygroundSelectedAppId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium"
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name} ({app.clientId.slice(0, 16)}...)
                </option>
              ))}
            </select>
          </div>
        </div>

        {playgroundSubTab === 'userinfo' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                Sends a Bearer token authorization request to retrieve authentic RS256 verified user claims.
              </p>
              <Button
                onClick={handleRunPlaygroundTest}
                disabled={playgroundLoading}
                size="sm"
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
              >
                {playgroundLoading ? (
                  <LogoLoader className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                )}
                <span>Execute Request</span>
              </Button>
            </div>

            {playgroundOutput && (
              <pre className="p-4 rounded-2xl bg-zinc-950 text-emerald-400 font-mono text-xs border border-white/5 overflow-x-auto select-all">
                {JSON.stringify(playgroundOutput, null, 2)}
              </pre>
            )}
          </div>
        )}

        {playgroundSubTab === 'pkce' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                Generate cryptographic <code className="font-mono text-blue-500">code_verifier</code> and{' '}
                <code className="font-mono text-blue-500">code_challenge</code> for public clients (Flutter, React Native, SPAs).
              </p>
              <Button
                onClick={handleGeneratePkce}
                size="sm"
                className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                <span>Generate Keypair</span>
              </Button>
            </div>

            {pkceVerifier && (
              <div className="space-y-2 font-mono text-xs">
                <div className="p-3 rounded-xl bg-zinc-950 text-zinc-200 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block font-sans">code_verifier (Private)</span>
                  <span className="text-emerald-400 select-all">{pkceVerifier}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 text-zinc-200 border border-white/5">
                  <span className="text-[10px] text-zinc-500 block font-sans">code_challenge (SHA256 URL-Safe)</span>
                  <span className="text-blue-400 select-all">{pkceChallenge}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {playgroundSubTab === 'token' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                Inspect active token bundle structure and expiration lifecycle.
              </p>
              <Button
                onClick={handleRunPlaygroundTest}
                size="sm"
                className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
              >
                <span>Decode Active Token</span>
              </Button>
            </div>

            {playgroundOutput && (
              <pre className="p-4 rounded-2xl bg-zinc-950 text-purple-400 font-mono text-xs border border-white/5 overflow-x-auto select-all">
                {JSON.stringify(playgroundOutput, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
