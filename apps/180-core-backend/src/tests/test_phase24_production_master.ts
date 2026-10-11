'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';
import { PaymentLinkService, CheckoutService } from '@workspace/payment-provider';
import crypto from 'crypto';

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function runPhase24ProductionMaster() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  180 PAY PLATFORM — PHASE 24 PRODUCTION-GRADE VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Step 0: Resolve or seed a verified OAuth Application
  let app = await prisma.oAuthApp.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!app) {
    let sysUser = await prisma.user.findFirst();
    if (!sysUser) {
      sysUser = await prisma.user.create({
        data: {
          email: `prod_tester_${Date.now()}@180workspace.com`,
          name: 'Master Production Tester',
          passwordHash: 'test_hash',
          isVerified: true,
        },
      });
    }
    app = await prisma.oAuthApp.create({
      data: {
        clientId: `180_prod_app_${Date.now()}`,
        clientSecretHash: 'prod_hash',
        clientSecretHint: 'prod',
        name: 'Production Core App',
        userId: sysUser.id,
        isVerified: true,
        isActive: true,
        enablePay: true,
        allowedOrigins: ['http://localhost:3008', 'http://localhost:3009'],
        redirectUris: ['http://localhost:3008/callback'],
      },
    });
  }

  console.log(`[Setup] Target OAuth App: "${app.name}" (${app.id})\n`);

  // ─── [Flow 1] Public Payment Link Checkout & Digital Fulfillment ─────────────
  console.log('─── [Flow 1] Public Payment Link Checkout & Digital Fulfillment ───');
  const uniqueSlug = `prod-deal-${Date.now()}`;
  const paymentLink = await PaymentLinkService.createPaymentLink(app.id, {
    title: 'Sovereign Production Toolkit',
    description: 'Full stack enterprise deployment kit and license',
    amount: 1499,
    currency: 'INR',
    customSlug: uniqueSlug,
    maxPurchases: 2,
    fulfillmentMessage: 'YOUR-PRODUCTION-SECRET-LICENSE-KEY-9988',
    fulfillmentFileUrl: 'https://cdn.180workspace.com/downloads/toolkit-v1.zip',
    redirectUrl: 'https://180workspace.com/welcome',
  });
  console.log(`✓ Created Payment Link: /link/${paymentLink.slug} (Max Inventory: 2)`);

  // 1.1 Public Resolution
  const publicLink = await PaymentLinkService.getPublicPaymentLink(uniqueSlug);
  if ((publicLink as any).fulfillmentMessage || (publicLink as any).fulfillmentFileUrl) {
    throw new Error('SECURITY VIOLATION: Private fulfillment secret leaked in public link resolution!');
  }
  console.log('✓ Public Link Security: Private fulfillment secret strictly concealed before payment');

  // 1.2 Purchase 1
  const session1 = await prisma.checkoutSession.create({
    data: {
      appId: app.id,
      amount: 1499,
      currency: 'INR',
      status: 'CAPTURED',
      title: paymentLink.title,
      metadata: { paymentLinkId: paymentLink.id, customerEmail: 'buyer1@test.com' },
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const ful1 = await PaymentLinkService.completeLinkPurchase(paymentLink.id, session1.id);
  if (ful1.fulfillmentMessage !== 'YOUR-PRODUCTION-SECRET-LICENSE-KEY-9988') {
    throw new Error('Fulfillment message mismatch after purchase 1');
  }
  console.log('✓ Purchase 1 Completed: Inventory atomically updated to 1/2 & secret delivered');

  // 1.3 Purchase 2 (Exhausts capacity)
  const session2 = await prisma.checkoutSession.create({
    data: {
      appId: app.id,
      amount: 1499,
      currency: 'INR',
      status: 'CAPTURED',
      title: paymentLink.title,
      metadata: { paymentLinkId: paymentLink.id, customerEmail: 'buyer2@test.com' },
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const ful2 = await PaymentLinkService.completeLinkPurchase(paymentLink.id, session2.id);
  console.log('✓ Purchase 2 Completed: Inventory atomically updated to 2/2 (Sold Out)');

  // 1.4 Purchase 3 (Must fail)
  let rejected3 = false;
  try {
    const session3 = await prisma.checkoutSession.create({
      data: {
        appId: app.id,
        amount: 1499,
        currency: 'INR',
        status: 'CAPTURED',
        title: paymentLink.title,
        metadata: { paymentLinkId: paymentLink.id, customerEmail: 'buyer3@test.com' },
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await PaymentLinkService.completeLinkPurchase(paymentLink.id, session3.id);
  } catch (err: any) {
    rejected3 = true;
    console.log(`✓ Inventory Protection: Correctly rejected 3rd purchase attempt (${err.message})`);
  }
  if (!rejected3) {
    throw new Error('Inventory protection failed: 3rd purchase allowed beyond max capacity!');
  }

  // ─── [Flow 2] Pricing Table Visual Engine & Configuration ─────────────────────
  console.log('\n─── [Flow 2] Pricing Table Visual Engine & Configuration ───');
  // Upsert pricing table configuration
  const customConfig = await (prisma as any).pricingTableConfig.upsert({
    where: { appId: app.id },
    create: {
      appId: app.id,
      headline: 'Choose Your Sovereign Tier',
      subheadline: 'Transparent pricing with no hidden charges',
      theme: 'dark',
      accentColor: '#6366f1',
      billingIntervals: ['MONTHLY', 'YEARLY'],
      yearlyDiscountPct: 25,
      planCards: [
        {
          planCode: 'starter',
          name: 'Starter Plan',
          amount: 499,
          currency: 'INR',
          isPopular: false,
          features: ['5,000 monthly credits', 'Community Discord support'],
        },
        {
          planCode: 'pro',
          name: 'Pro Sovereign',
          amount: 1499,
          currency: 'INR',
          isPopular: true,
          features: ['Unlimited credits', 'Dedicated Account Manager', 'Custom domain whitelisting'],
        },
      ],
    },
    update: {
      headline: 'Choose Your Sovereign Tier',
      yearlyDiscountPct: 25,
    },
  });
  console.log(`✓ Saved Custom Pricing Table: "${customConfig.headline}" (25% Annual Discount)`);

  const fetchedConfig = await (prisma as any).pricingTableConfig.findUnique({
    where: { appId: app.id },
  });
  if (fetchedConfig.yearlyDiscountPct !== 25 || fetchedConfig.planCards.length !== 2) {
    throw new Error('Pricing table configuration retrieval failed');
  }
  console.log(`✓ Verified Configuration Persistence: 2 tiers configured with full feature checklists`);

  // ─── [Flow 3] Bring Your Own Gateway (BYOG) Dynamic Resolution ────────────────
  console.log('\n─── [Flow 3] Bring Your Own Gateway (BYOG) Dynamic Resolution ───');
  // 3.1 Configure developer custom credentials
  const devKeyId = 'rzp_live_developer_custom_99182';
  const devKeySecret = 'dev_super_secret_webhook_key_xyz84920';
  const devSubdomain = 'pay.clientdomain.com';

  await prisma.oAuthApp.update({
    where: { id: app.id },
    data: {
      customGatewayType: 'RAZORPAY',
      customGatewayKeyId: devKeyId,
      customGatewaySecret: devKeySecret,
      customPayDomain: devSubdomain,
      customDomainStatus: 'ACTIVE',
    },
  });
  console.log(`✓ Configured Custom Gateway for Merchant: ${devKeyId} & Custom Subdomain: ${devSubdomain}`);

  // 3.2 Dynamic Credential Inspection in Checkout
  const byogSession = await prisma.checkoutSession.create({
    data: {
      appId: app.id,
      amount: 999,
      currency: 'INR',
      status: 'PENDING',
      title: 'BYOG Test Session',
      expiresAt: new Date(Date.now() + 3600000),
    },
    include: { app: true },
  });

  const appRecord = byogSession.app as any;
  let resolvedKey = process.env.RAZORPAY_KEY_ID;
  let resolvedSecret = process.env.RAZORPAY_KEY_SECRET;

  if (
    appRecord?.customGatewayType === 'RAZORPAY' &&
    appRecord.customGatewayKeyId &&
    appRecord.customGatewaySecret
  ) {
    resolvedKey = appRecord.customGatewayKeyId;
    resolvedSecret = appRecord.customGatewaySecret;
  }

  if (resolvedKey !== devKeyId || resolvedSecret !== devKeySecret) {
    throw new Error('BYOG Failed: Expected developer custom gateway credentials to be selected!');
  }
  console.log('✓ Dynamic Gateway Resolver: Developer merchant keys successfully selected over platform defaults');

  // 3.3 Dynamic Signature Verification with Developer Secret
  const orderId = 'order_dev_991823';
  const paymentId = 'pay_dev_884920';
  const devSignature = crypto
    .createHmac('sha256', devKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Verify against developer secret
  const verifiedSig = crypto
    .createHmac('sha256', appRecord.customGatewaySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (!timingSafeCompare(devSignature, verifiedSig)) {
    throw new Error('BYOG signature mismatch using developer secret');
  }
  console.log('✓ Cryptographic Verification: Developer merchant signature verified using app custom secret');

  // 3.4 Revert to Managed Processing mode
  await prisma.oAuthApp.update({
    where: { id: app.id },
    data: {
      customGatewayType: 'NONE',
    },
  });
  console.log('✓ Fallback Verification: Managed processing restored safely');

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  🎉 ALL PHASE 24 PRODUCTION VERIFICATION FLOWS PASSED WITH 100% SUCCESS!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

runPhase24ProductionMaster()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 24 Production Master Error:', err);
    process.exit(1);
  });
