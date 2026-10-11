'use strict';

import assert from 'assert';
import { developersPrisma } from '@workspace/db-180core';
import {
  generateRandomToken,
  hashSecret,
  DeveloperController,
  UsernameService,
  FIRST_PARTY_APPS
} from '@workspace/identity-provider';

async function runDedicatedIdentityDbSuite() {
  console.log('\n================================================================');
  console.log('  PHASE 2: DEDICATED IDENTITY DB (@workspace/db-180core)');
  console.log('           & DOMAIN PROVIDER WIRING VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Test 1: Prisma Client Export Verification
  await test('developersPrisma is properly instantiated and exposes identity models', () => {
    assert(developersPrisma, 'developersPrisma instance must exist');
    assert(typeof developersPrisma.user?.findMany === 'function', 'developersPrisma.user.findMany must exist');
    assert(typeof developersPrisma.oAuthApp?.findMany === 'function', 'developersPrisma.oAuthApp.findMany must exist');
    assert(typeof developersPrisma.oAuthAuthorizationCode?.findMany === 'function', 'developersPrisma.oAuthAuthorizationCode.findMany must exist');
    assert(typeof developersPrisma.oAuthToken?.findMany === 'function', 'developersPrisma.oAuthToken.findMany must exist');
    assert(typeof developersPrisma.oAuthConsent?.findMany === 'function', 'developersPrisma.oAuthConsent.findMany must exist');
    assert(typeof developersPrisma.otpVerification?.findMany === 'function', 'developersPrisma.otpVerification.findMany must exist');
    assert(typeof developersPrisma.webhookEndpoint?.findMany === 'function', 'developersPrisma.webhookEndpoint.findMany must exist');
    assert(typeof developersPrisma.webhookDelivery?.findMany === 'function', 'developersPrisma.webhookDelivery.findMany must exist');
  });

  // Test 2: Username Normalization & Availability Check
  await test('UsernameService normalizes usernames and prevents reserved name registration', async () => {
    const raw = 'John Doe @ 180! #Dev';
    const normalized = UsernameService.normalizeUsername(raw);
    assert.strictEqual(normalized, 'johndoe180dev');

    const reservedCheck = await UsernameService.checkAvailability('admin');
    assert.strictEqual(reservedCheck.available, false);
    assert(reservedCheck.message?.includes('reserved'));

    const shortCheck = await UsernameService.checkAvailability('ab');
    assert.strictEqual(shortCheck.available, false);
    assert(shortCheck.message?.includes('at least 3 characters'));
  });

  // Test 3: First Party OAuth Apps Catalog
  await test('FIRST_PARTY_APPS catalog correctly registers Workspace and Social Studio', () => {
    assert(Array.isArray(FIRST_PARTY_APPS), 'FIRST_PARTY_APPS must be an array');
    const workspaceApp = FIRST_PARTY_APPS.find((a: any) => a.clientId === '180-workspace-platform');
    const socialApp = FIRST_PARTY_APPS.find((a: any) => a.clientId === '180-social-studio-mobile');

    assert(workspaceApp, '180-workspace-platform must be registered');
    assert(socialApp, '180-social-studio-mobile must be registered');

    assert(socialApp?.redirectUris.includes('180social://oauth-callback'), 'Social app must support custom scheme');
  });

  // Test 4: Cryptographic Key & Secret Verification
  await test('High-entropy client ID, secret generation, and SHA-256 hash validation', () => {
    const clientId = generateRandomToken('180_client', 16);
    const secret = generateRandomToken('180_secret', 32);
    const secretHash = hashSecret(secret);

    assert(clientId.startsWith('180_client_'));
    assert(secret.startsWith('180_secret_'));
    assert.strictEqual(secretHash.length, 64); // SHA-256 hex output is 64 characters
  });

  // Test 5: Complete Decoupling Check
  await test('packages/domains/identity-provider package.json has NO dependency on @workspace/db', () => {
    const fs = require('fs');
    const path = require('path');
    const pkgPath = path.resolve(__dirname, '../../../../packages/domains/identity-provider/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert(!pkg.dependencies['@workspace/db'], 'Must NOT have @workspace/db in dependencies');
    assert(pkg.dependencies['@workspace/db-180core'], 'Must have @workspace/db-180core in dependencies');
  });

  console.log('\n----------------------------------------------------------------');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDedicatedIdentityDbSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
