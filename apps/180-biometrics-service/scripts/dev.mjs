#!/usr/bin/env node
// Cross-platform launcher for the Python service so `pnpm --filter 180-biometrics-service dev`
// (or `turbo run dev`) works on Windows and POSIX.
//   node scripts/dev.mjs           -> run with BIOMETRICS_ENV=development on 127.0.0.1:8090
//   node scripts/dev.mjs --prod    -> run without forcing development mode
//   node scripts/dev.mjs --setup   -> create .venv, install requirements, download models
//   node scripts/dev.mjs --test    -> run pytest
import { spawnSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const venvPy = path.join(root, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python');
const args = process.argv.slice(2);

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (args.includes('--setup')) {
  if (!existsSync(venvPy)) run(isWin ? 'py' : 'python3', isWin ? ['-3', '-m', 'venv', '.venv'] : ['-m', 'venv', '.venv']);
  run(venvPy, ['-m', 'pip', 'install', '-r', 'requirements-dev.txt']);
  run(venvPy, ['scripts/download_models.py']);
  process.exit(0);
}

if (!existsSync(venvPy) || !existsSync(path.join(root, 'models', 'w600k_r50.onnx'))) {
  console.warn(
    '[biometrics] Python venv or models missing - service NOT started.\n' +
      '[biometrics] Run once:  pnpm --filter 180-biometrics-service setup'
  );
  process.exit(0); // don't take down the rest of `turbo run dev`
}

if (args.includes('--test')) {
  run(venvPy, ['-m', 'pytest', '-q', 'tests']);
  process.exit(0);
}

const env = { ...process.env };
// Don't inherit a generic PORT meant for another app (e.g. 4003 from the backend).
env.PORT = process.env.BIOMETRICS_PORT || '8090';
if (!args.includes('--prod')) env.BIOMETRICS_ENV = env.BIOMETRICS_ENV || 'development';

const child = spawn(venvPy, ['-m', 'app'], { cwd: root, stdio: 'inherit', env });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
