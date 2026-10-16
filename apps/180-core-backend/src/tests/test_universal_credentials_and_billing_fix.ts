'use strict';

import assert from 'assert';
import { developersPrisma as prisma, resolveOAuthApp, resolveAppId } from '@workspace/db-180core';
import { DeveloperBillingService } from '@workspace/identity-provider';
import { CheckoutService, PaymentLinkService, CouponService } from '@workspace/payment-provider';

async function runTwoCredentialAndPlatformBillingSuite() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('  180 CORE: UNIVERSAL TWO-CREDENTIAL MODEL & PLATFORM BILLING VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ↳ Error: ${err.message}\n`);
      failed++;
    }
  }

  // ─── Test 1: Platform App Seeding & Isolation (No "Test1" Hijacking) ────────
  await test('DeveloperBillingService.getPlatformAppId deterministically seeds 180 Developer Portal', async () => {
    const platformAppId = await DeveloperBillingService.getPlatformAppId();
    assert(platformAppId, 'Platform App ID must be resolved');

    const app = await prisma.oAuthApp.findUnique({
      where: { id: platformAppId },
    });

    assert(app, 'Platform OAuthApp record must exist in database');
    assert(
      app.clientId === DeveloperBillingService.PLATFORM_CLIENT_ID ||
      app.name.toLowerCase().includes('developer portal') ||
      app.name.toLowerCase() === '180workspace',
      `Expected platform app identity, got clientId: ${app.clientId}, name: ${app.name}`
    );
    assert.notStrictEqual(app.name, 'Test1', 'Platform app must NEVER be hijacked by tenant app "Test1"');
  });

  // ─── Test 2: Self-Healing Developer Subscription Plans ───────────────────────
  await test('DeveloperBillingService.ensurePlans binds and self-heals plans to official platform appId', async () => {
    const platformAppId = await DeveloperBillingService.getPlatformAppId();
    const { starter, pro } = await DeveloperBillingService.ensurePlans();

    assert(starter, 'Starter plan must exist');
    assert(pro, 'Pro plan must exist');
    assert.strictEqual(starter.appId, platformAppId, 'Starter plan appId must match official platform appId');
    assert.strictEqual(pro.appId, platformAppId, 'Pro plan appId must match official platform appId');

    // Test Self-Healing: simulate a corrupt/legacy plan pointing to a tenant app
    const dummyApp = await prisma.oAuthApp.findFirst({
      where: { id: { not: platformAppId }, isActive: true },
    });

    if (dummyApp) {
      await (prisma as any).subscriptionPlan.update({
        where: { id: starter.id },
        data: { appId: dummyApp.id },
      });

      // Re-running ensurePlans must detect and repair the linkage
      const healed = await DeveloperBillingService.ensurePlans();
      assert.strictEqual(
        healed.starter.appId,
        platformAppId,
        'ensurePlans must self-heal corrupted plan and re-bind to platform appId'
      );
    }
  });

  // ─── Test 3: Checkout Service Vendor Safeguard for Developer Billing ─────────
  await test('CheckoutService.getSession strictly returns "180 Developer Portal" for sess_dev_ sessions', async () => {
    const testSessionId = `sess_dev_starter_e2e_${Date.now()}`;

    // getSession will auto-heal and create the session using official platform branding
    const session = await CheckoutService.getSession(testSessionId);

    assert(session, 'Checkout session must be resolved');
    assert(session.app, 'session.app must be populated');
    assert.strictEqual(
      session.app.name,
      '180 Developer Portal',
      `Expected merchant name "180 Developer Portal", got "${session.app.name}"`
    );
    assert.notStrictEqual(session.app.name, 'Test1', 'Merchant must NEVER be "Test1"');
    assert.strictEqual(session.app.isVerified, true, 'Platform app must be marked verified');

    // Cleanup test session
    await prisma.checkoutSession.delete({ where: { id: testSessionId } }).catch(() => {});
  });

  // ─── Test 4: Universal Two-Credential Model Resolver (resolveOAuthApp & resolveAppId)
  await test('resolveOAuthApp and resolveAppId resolve polymorphically via clientId or internal UUID', async () => {
    const sysUser = await prisma.user.findFirst();
    assert(sysUser, 'System user required for test');

    const testClientId = `180_client_e2e_${Date.now()}`;
    const testApp = await prisma.oAuthApp.create({
      data: {
        clientId: testClientId,
        clientSecretHash: 'test_hash',
        clientSecretHint: 'test',
        name: 'Two-Credential Verification App',
        userId: sysUser.id,
      },
    });

    try {
      // 1. Resolve by public clientId
      const resolvedByClientId = await resolveOAuthApp(testClientId);
      assert(resolvedByClientId, 'Must resolve app via public clientId');
      assert.strictEqual(resolvedByClientId.id, testApp.id);
      assert.strictEqual(resolvedByClientId.clientId, testClientId);

      // 2. Resolve by internal UUID
      const resolvedById = await resolveOAuthApp(testApp.id);
      assert(resolvedById, 'Must resolve app via internal UUID');
      assert.strictEqual(resolvedById.id, testApp.id);

      // 3. resolveAppId helper
      const resolvedAppIdFromClient = await resolveAppId(testClientId);
      assert.strictEqual(resolvedAppIdFromClient, testApp.id, 'resolveAppId must return UUID when given clientId');

      const resolvedAppIdFromId = await resolveAppId(testApp.id);
      assert.strictEqual(resolvedAppIdFromId, testApp.id, 'resolveAppId must return UUID when given UUID');
    } finally {
      await prisma.oAuthApp.delete({ where: { id: testApp.id } }).catch(() => {});
    }
  });

  // ─── Test 5: Polymorphic PaymentLinkService Creation with clientId ───────────
  await test('PaymentLinkService.createPaymentLink accepts public clientId and maps to database foreign key', async () => {
    const sysUser = await prisma.user.findFirst();
    assert(sysUser, 'System user required');

    const testClientId = `180_client_pl_test_${Date.now()}`;
    const testApp = await prisma.oAuthApp.create({
      data: {
        clientId: testClientId,
        clientSecretHash: 'test_hash',
        clientSecretHint: 'test',
        name: 'Payment Link E2E App',
        userId: sysUser.id,
      },
    });

    try {
      // Create link passing public clientId as the identifier
      const link = await PaymentLinkService.createPaymentLink(testClientId, {
        title: 'Universal Client ID Payment Test',
        amount: 25.0,
        currency: 'USD',
      });

      assert(link, 'Payment link must be created');
      assert.strictEqual(link.appId, testApp.id, 'Link appId in DB must be mapped to internal OAuthApp.id');

      // Verify public resolution returns client credentials
      const resolvedLink = await PaymentLinkService.getPublicPaymentLink(link.slug);
      assert(resolvedLink, 'Public payment link must be resolvable');
      assert.strictEqual(resolvedLink.merchant.clientId, testApp.clientId, 'Public link must expose merchant.clientId, not database UUID');

      await (prisma as any).paymentLink.delete({ where: { id: link.id } }).catch(() => {});
    } finally {
      await prisma.oAuthApp.delete({ where: { id: testApp.id } }).catch(() => {});
    }
  });

  // ─── Test 6: Polymorphic CouponService Resolution with clientId ─────────────
  await test('CouponService.resolveAppId seamlessly maps clientId to relational appId', async () => {
    const sysUser = await prisma.user.findFirst();
    assert(sysUser, 'System user required');

    const testClientId = `180_client_coupon_test_${Date.now()}`;
    const testApp = await prisma.oAuthApp.create({
      data: {
        clientId: testClientId,
        clientSecretHash: 'test_hash',
        clientSecretHint: 'test',
        name: 'Coupon E2E App',
        userId: sysUser.id,
      },
    });

    try {
      const targetAppId = await CouponService.resolveAppId(testClientId);
      assert.strictEqual(targetAppId, testApp.id, 'CouponService must resolve clientId to internal UUID');
    } finally {
      await prisma.oAuthApp.delete({ where: { id: testApp.id } }).catch(() => {});
    }
  });

  console.log('\n───────────────────────────────────────────────────────────────────────────');
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('───────────────────────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTwoCredentialAndPlatformBillingSuite()
  .catch((err) => {
    console.error('Fatal Test Suite Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
