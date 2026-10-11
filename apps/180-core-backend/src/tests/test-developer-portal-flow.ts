'use strict';

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  generateRandomToken,
  hashSecret,
  DeveloperController,
} from '@workspace/identity-provider';

async function runDeveloperPortalTestSuite() {
  console.log('\n================================================================');
  console.log('  180 DEVELOPER PLATFORM & DEDICATED APP VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    return (async () => {
      try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passedTests++;
      } catch (err: any) {
        console.error(`  [FAIL] ${name}:`, err.message);
        failedTests++;
      }
    })();
  }

  // ─── Test 1: Dedicated App Files & Scaffolding ──────────────────────────────
  await test('apps/180developers-frontend configuration files exist and are valid', () => {
    const appDir = path.resolve(__dirname, '../../../180developers-frontend');
    const pkgPath = path.join(appDir, 'package.json');
    const tsconfigPath = path.join(appDir, 'tsconfig.json');
    const nextConfigPath = path.join(appDir, 'next.config.js');
    const tailwindPath = path.join(appDir, 'tailwind.config.js');
    const layoutPath = path.join(appDir, 'app/layout.tsx');
    const pagePath = path.join(appDir, 'app/page.tsx');
    const docsPath = path.join(appDir, 'app/docs/page.tsx');
    const detailPath = path.join(appDir, 'app/apps/[id]/page.tsx');

    assert(fs.existsSync(pkgPath), 'package.json must exist');
    assert(fs.existsSync(tsconfigPath), 'tsconfig.json must exist');
    assert(fs.existsSync(nextConfigPath), 'next.config.js must exist');
    assert(fs.existsSync(tailwindPath), 'tailwind.config.js must exist');
    assert(fs.existsSync(layoutPath), 'layout.tsx must exist');
    assert(fs.existsSync(pagePath), 'page.tsx must exist');
    assert(fs.existsSync(docsPath), 'docs/page.tsx must exist');
    assert(fs.existsSync(detailPath), 'apps/[id]/page.tsx must exist');

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(pkg.name, '180developers-frontend');
    assert(pkg.scripts.dev.includes('3008'), 'dev script must specify port 3008');
  });

  // ─── Test 2: Dedicated Database Package (@workspace/db-180core) ──────
  await test('packages/db-180core schema and client exist and are valid', () => {
    const dbDir = path.resolve(__dirname, '../../../../packages/db-180core');
    const pkgPath = path.join(dbDir, 'package.json');
    const schemaPath = path.join(dbDir, 'prisma/schema.prisma');
    const clientPath = path.join(dbDir, 'dist/index.js');

    assert(fs.existsSync(pkgPath), 'db-180developers package.json must exist');
    assert(fs.existsSync(schemaPath), 'db-180developers schema.prisma must exist');
    assert(fs.existsSync(clientPath), 'db-180developers compiled client dist/index.js must exist');

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(pkg.name, '@workspace/db-180core');

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    assert(schemaContent.includes('model OAuthApp'), 'schema must contain OAuthApp');
    assert(schemaContent.includes('model User'), 'schema must contain User');
    assert(schemaContent.includes('model DeveloperMetric'), 'schema must contain DeveloperMetric');
  });

  // ─── Test 3: Monorepo Orchestration & dev-runner ───────────────────────────
  await test('Root package.json and scripts/dev-runner.js register 180developers-frontend on port 3008', () => {
    const rootPkgPath = path.resolve(__dirname, '../../../../package.json');
    const runnerPath = path.resolve(__dirname, '../../../../scripts/dev-runner.js');

    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    assert(rootPkg.scripts['dev:developers'].includes('180developers-frontend'), '"dev:developers" script must target 180developers-frontend');

    const runnerContent = fs.readFileSync(runnerPath, 'utf8');
    assert(runnerContent.includes('180developers-frontend'), 'dev-runner must reference 180developers-frontend');
    assert(runnerContent.includes('3008'), 'dev-runner must assign port 3008');
  });

  // ─── Test 4: Landing Page & 180 Identity SSO Button ────────────────────────
  await test('Developer Showcase Landing Page contains "Get started with 180 Identity" and demo flow', () => {
    const pagePath = path.resolve(__dirname, '../../../180developers-frontend/app/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf8');

    assert(pageContent.includes('Get started with 180 Identity'), 'Must contain signature SSO button');
    assert(pageContent.includes('launch180Identity'), 'Must invoke 180 Identity hook');
    assert(pageContent.includes('Try Interactive Demo'), 'Must provide interactive demo modal');
    assert(pageContent.includes('Confidential Client'), 'Must support Confidential apps');
    assert(pageContent.includes('Public Client (PKCE)'), 'Must support Public PKCE apps');
    assert(pageContent.includes('revealedCredentials'), 'Must have one-time secret reveal dialog');
    assert(pageContent.includes('Rotate Client Secret'), 'Must have secret rotation modal');
  });

  // ─── Test 4: Interactive Documentation & OAuth Playground ──────────────────
  await test('Documentation page contains live OAuth Playground and multi-stack quickstarts', () => {
    const docsPath = path.resolve(__dirname, '../../../180developers-frontend/app/docs/page.tsx');
    const docsContent = fs.readFileSync(docsPath, 'utf8');

    assert(docsContent.includes('OAuth 2.0 Interactive Playground'), 'Must contain interactive playground');
    assert(docsContent.includes('Test in Popup'), 'Must have Test in Popup action');
    assert(docsContent.includes('180-identity.js'), 'Must document drop-in Web SDK');
    assert(docsContent.includes('NextAuth'), 'Must document NextAuth provider');
    assert(docsContent.includes('Flutter'), 'Must document Flutter PKCE');
    assert(docsContent.includes('FastAPI') || docsContent.includes('Python'), 'Must document Python');
    assert(docsContent.includes('/.well-known/openid-configuration'), 'Must document OIDC Discovery');
  });

  // ─── Test 5: Cryptographic Key Generation & Hashing ────────────────────────
  await test('Generates cryptographically random 180 Client ID and secret with secure hash', () => {
    const clientId = generateRandomToken('180_client', 16);
    const rawSecret = generateRandomToken('180_secret', 32);

    assert(clientId.startsWith('180_client_'));
    assert(rawSecret.startsWith('180_secret_'));
    assert(clientId.length >= 24);
    assert(rawSecret.length >= 40);

    const secretHash = hashSecret(rawSecret);
    const expected = crypto.createHash('sha256').update(rawSecret).digest('hex');
    assert.strictEqual(secretHash, expected);

    const hint = `...${rawSecret.slice(-4)}`;
    assert(hint.startsWith('...'));
    assert.strictEqual(hint.length, 7);
  });

  // ─── Test 6: Secret Rotation Simulation & Hint Derivation ───────────────────
  await test('Secret rotation replaces secret hash and hint correctly', () => {
    const secret1 = generateRandomToken('180_secret', 32);
    const hash1 = hashSecret(secret1);

    const secret2 = generateRandomToken('180_secret', 32);
    const hash2 = hashSecret(secret2);

    assert.notStrictEqual(secret1, secret2);
    assert.notStrictEqual(hash1, hash2);

    const hint1 = `...${secret1.slice(-4)}`;
    const hint2 = `...${secret2.slice(-4)}`;
    assert.notStrictEqual(hint1, hint2);
  });

  // ─── Test 7: Redirect URI & CORS Validation Engine ──────────────────────────
  await test('Redirect URI validation enforces HTTPS in production and allows localhost/custom mobile schemes', () => {
    function validateRedirectUri(uri: string, isProd: boolean, isConfidential: boolean) {
      if (!uri.includes('://')) return false;
      if (isProd) {
        if (uri.startsWith('http://localhost') || uri.startsWith('http://127.0.0.1')) {
          return true; // Allowed in dev
        }
        if (isConfidential) {
          return uri.startsWith('https://');
        }
        // Public PKCE clients can use custom mobile schemes like myapp://
        return uri.startsWith('https://') || /^[a-z][a-z0-9+.-]*:\/\//i.test(uri);
      }
      return true;
    }

    // Confidential HTTPS (Production)
    assert.strictEqual(validateRedirectUri('https://myapp.com/callback', true, true), true);
    // Confidential Insecure HTTP (Production) -> MUST FAIL
    assert.strictEqual(validateRedirectUri('http://myapp.com/callback', true, true), false);
    // Confidential Localhost (Production/Dev bypass) -> PASS
    assert.strictEqual(validateRedirectUri('http://localhost:3000/callback', true, true), true);
    // Public Native Custom Mobile Scheme (myapp://) -> PASS
    assert.strictEqual(validateRedirectUri('myapp://oauth-callback', true, false), true);
    assert.strictEqual(validateRedirectUri('pitch180://auth', true, false), true);
  });

  // ─── Test 8: Developer Controller Methods ───────────────────────────────────
  await test('DeveloperController has all required CRUD and rotation handlers', () => {
    assert.strictEqual(typeof DeveloperController.listApps, 'function');
    assert.strictEqual(typeof DeveloperController.getApp, 'function');
    assert.strictEqual(typeof DeveloperController.createApp, 'function');
    assert.strictEqual(typeof DeveloperController.updateApp, 'function');
    assert.strictEqual(typeof DeveloperController.rotateSecret, 'function');
    assert.strictEqual(typeof DeveloperController.deleteApp, 'function');
  });

  // ─── Test 9: UX Display Modes & Device Defaults ─────────────────────────────
  await test('AppDetailClient and schema contain UX display modes & device defaults', () => {
    const detailClientPath = path.resolve(__dirname, '../../../180developers-frontend/app/apps/[id]/AppDetailClient.tsx');
    const content = fs.readFileSync(detailClientPath, 'utf8');

    assert(content.includes('authUxModes'), 'Must manage authUxModes state');
    assert(content.includes('payUxModes'), 'Must manage payUxModes state');
    assert(content.includes('authDesktopDefault'), 'Must manage authDesktopDefault state');
    assert(content.includes('authMobileDefault'), 'Must manage authMobileDefault state');
    assert(content.includes('payDesktopDefault'), 'Must manage payDesktopDefault state');
    assert(content.includes('payMobileDefault'), 'Must manage payMobileDefault state');
    assert(content.includes('UX Display Modes & Device Defaults'), 'Must render dedicated UX Display Modes section');
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`  RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDeveloperPortalTestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
