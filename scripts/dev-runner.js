#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const rootDir = path.resolve(__dirname, '..');

const APPS = {
  backend: {
    name: '180 Core Backend (Identity, Wallet, Pay & APIs)',
    filter: '180-core-backend',
    cmd: 'pnpm',
    args: ['--filter', '180-core-backend', 'dev'],
    port: 4003,
    color: '\x1b[38;5;141m', // Purple
  },
  profile: {
    name: '180 Profile Frontend (Universal Identity & Popups)',
    filter: '180-profile-frontend',
    cmd: 'pnpm',
    args: ['--filter', '180-profile-frontend', 'dev'],
    port: 3009,
    color: '\x1b[38;5;213m', // Pink
  },
  developers: {
    name: '180 Developer Portal (Apps, Keys, Webhooks & Docs)',
    filter: '180developers-frontend',
    cmd: 'pnpm',
    args: ['--filter', '180developers-frontend', 'dev'],
    port: 3008,
    color: '\x1b[38;5;208m', // Orange
  },
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';

const running = {};

function startProcess(key) {
  const app = APPS[key];
  if (!app) return;
  if (running[key]) {
    console.log(`${app.color}[${key}]${RESET} Already running (PID ${running[key].pid})`);
    return;
  }

  console.log(`${app.color}[${key}]${RESET} Starting ${app.name} on port ${app.port}...`);

  const proc = spawn(app.cmd, app.args, {
    cwd: rootDir,
    shell: true,
    env: { ...process.env, PORT: String(app.port) },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  running[key] = proc;

  proc.stdout.on('data', (d) => {
    const lines = d.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${app.color}[${key}]${RESET} ${line}`);
    }
  });

  proc.stderr.on('data', (d) => {
    const lines = d.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.error(`${app.color}[${key}:err]${RESET} ${line}`);
    }
  });

  proc.on('close', (code) => {
    console.log(`${app.color}[${key}]${RESET} Process exited with code ${code}`);
    delete running[key];
  });
}

function stopProcess(key) {
  if (running[key]) {
    console.log(`Stopping ${key} (PID ${running[key].pid})...`);
    try {
      running[key].kill('SIGTERM');
    } catch (_) {}
    delete running[key];
  }
}

function shutdown() {
  console.log('\nShutting down 180 Core processes...');
  for (const k of Object.keys(running)) {
    stopProcess(k);
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('\n' + BOLD + GREEN + '==================================================' + RESET);
console.log(BOLD + GREEN + ' 🚀 180 CORE PLATFORM DEV RUNNER' + RESET);
console.log(BOLD + GREEN + '==================================================' + RESET);
console.log('  [backend]    -> http://localhost:4003 (Sovereign API, OIDC, Pay)');
console.log('  [profile]    -> http://localhost:3009 (Universal Profile & SSO)');
console.log('  [developers] -> http://localhost:3008 (Developer Portal)');
console.log('--------------------------------------------------');
console.log('Controls: [b] Restart backend | [p] Restart profile | [d] Restart devs | [q] Quit\n');

// Start all three by default
startProcess('backend');
startProcess('profile');
startProcess('developers');

if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') shutdown();
    if (key.name === 'q') shutdown();
    if (key.name === 'b') { stopProcess('backend'); setTimeout(() => startProcess('backend'), 500); }
    if (key.name === 'p') { stopProcess('profile'); setTimeout(() => startProcess('profile'), 500); }
    if (key.name === 'd') { stopProcess('developers'); setTimeout(() => startProcess('developers'), 500); }
  });
}
