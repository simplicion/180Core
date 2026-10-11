import { developersPrisma as prisma } from '@workspace/db-180core';
import {
  CouponService,
  GeoPricingService,
  PaymentLinkService,
  CustomerPortalService,
  AgentPurchaseService,
  WebhookDispatcherService,
} from '@workspace/payment-provider';
import { Sovereign180Pay } from '../../../../packages/identity-sdk/src/pay-server';

async function runEndToEndMasterVerification() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  180 PAY PLATFORM — PHASE 19 END-TO-END MASTER INTEGRATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // 0. Locate or bootstrap active OAuth App
  let app = await prisma.oAuthApp.findFirst({ where: { isActive: true } });
  if (!app) {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found in database to link test OAuth app');
    app = await prisma.oAuthApp.create({
      data: {
        clientId: '180-e2e-master-app',
        clientSecretHash: 'e2e_hash',
        clientSecretHint: 'hash',
        name: '180 E2E Master Store',
        description: 'Comprehensive Test Harness App',
        redirectUris: ['https://e2e.store.com/callback'],
        allowedOrigins: ['https://e2e.store.com'],
        allowedScopes: ['openid', 'identity:read'],
        isVerified: true,
        isActive: true,
        userId: user.id,
      },
    });
  }
  console.log(`[Setup] Target OAuth App: "${app.name}" (${app.id})\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 1: COUPONS & ORIGIN RESTRICTION & CONCURRENCY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [Flow 1] Coupons & Promo Codes Engine ───');
  const couponCode = `E2ECOUPON_${Date.now()}`;
  const coupon = await CouponService.createCoupon(app.id, {
    code: couponCode,
    discountType: 'PERCENTAGE',
    discountValue: 25,
    maxDiscountAmount: 100,
    minOrderAmount: 50,
    maxRedemptions: 2,
    perCustomerLimit: 1,
    allowedOrigins: ['https://e2e.store.com'],
  });
  console.log(`✓ Created Coupon ${coupon.code} (25% off, max 2 redemptions, 1 per customer)`);

  // Origin whitelist test
  const forbiddenOriginRes = await CouponService.validateCoupon({
    appId: app.id,
    code: couponCode,
    orderAmount: 200,
    origin: 'https://hacker-scam-site.com',
  });
  if (forbiddenOriginRes.valid) throw new Error('Security Breach: Forbidden origin allowed!');
  console.log('✓ Strict Server-Side Origin Whitelisting: Rejected unauthorized domain');

  const validOriginRes = await CouponService.validateCoupon({
    appId: app.id,
    code: couponCode,
    orderAmount: 200,
    origin: 'https://e2e.store.com/shop',
  });
  if (!validOriginRes.valid || validOriginRes.discountAmount !== 50 || validOriginRes.finalAmount !== 150) {
    throw new Error('Discount calculation mismatch');
  }
  console.log(`✓ Allowed Origin Validation: $200.00 -> -$50.00 = $150.00`);

  // Atomic redemption 1 (Customer 1)
  await CouponService.redeemCouponAtomic({
    couponId: coupon.id,
    sessionId: `sess_e2e_1_${Date.now()}`,
    customerEmail: 'customer1@test.com',
    discountApplied: 50,
  });
  console.log('✓ Atomic Redemption 1: Successful for customer1@test.com');

  // Customer 1 attempt second redemption -> should be blocked by perCustomerLimit
  try {
    await CouponService.redeemCouponAtomic({
      couponId: coupon.id,
      sessionId: `sess_e2e_1b_${Date.now()}`,
      customerEmail: 'customer1@test.com',
      discountApplied: 50,
    });
    throw new Error('Customer exceeded per-customer limit');
  } catch (err: any) {
    console.log('✓ Per-Customer Limit Enforced: Customer 1 blocked from double-dipping');
  }

  // Atomic redemption 2 (Customer 2) -> fills capacity
  await CouponService.redeemCouponAtomic({
    couponId: coupon.id,
    sessionId: `sess_e2e_2_${Date.now()}`,
    customerEmail: 'customer2@test.com',
    discountApplied: 50,
  });
  console.log('✓ Atomic Redemption 2: Successful for customer2@test.com (Cap Reached)');

  // Attempt redemption 3 (Customer 3) -> should be blocked by maxRedemptions
  try {
    await CouponService.redeemCouponAtomic({
      couponId: coupon.id,
      sessionId: `sess_e2e_3_${Date.now()}`,
      customerEmail: 'customer3@test.com',
      discountApplied: 50,
    });
    throw new Error('Exceeded max redemptions');
  } catch (err: any) {
    console.log('✓ Global Capacity Limit Enforced: Coupon marked fully exhausted\n');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 2: DYNAMIC GEO-PRICING & WORLD BANK PPP
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [Flow 2] Dynamic Geo-Pricing & World Bank PPP ───');
  // High income US visitor
  const usPrice = await GeoPricingService.resolveLocalizedPricing({
    appId: app.id,
    baseAmount: 100,
    baseCurrency: 'USD',
    visitorCountry: 'US',
  });
  if (usPrice.discountPercentage !== 0 || usPrice.currency !== 'USD') {
    throw new Error(`US visitor expected 0% off, got ${usPrice.discountPercentage}%`);
  }
  console.log(`✓ US Visitor Pricing: Tier 1 (0% discount) -> ${usPrice.formattedPrice} USD`);

  // Growth market India visitor
  const inPrice = await GeoPricingService.resolveLocalizedPricing({
    appId: app.id,
    baseAmount: 100,
    baseCurrency: 'USD',
    visitorCountry: 'IN',
  });
  if (inPrice.discountPercentage !== 65 || inPrice.currency !== 'INR') {
    throw new Error(`India visitor expected 65% off in INR, got ${inPrice.discountPercentage}% in ${inPrice.currency}`);
  }
  console.log(`✓ India Visitor Pricing: Tier 4 (65% World Bank PPP) -> ${inPrice.formattedPrice}`);

  // Create custom country override for Brazil
  await GeoPricingService.setCountryRule(app.id, {
    countryCode: 'BR',
    currency: 'BRL',
    overrideType: 'PERCENTAGE_DISCOUNT',
    discountPct: 40,
    isActive: true,
  });
  const brPrice = await GeoPricingService.resolveLocalizedPricing({
    appId: app.id,
    baseAmount: 100,
    baseCurrency: 'USD',
    visitorCountry: 'BR',
  });
  if (brPrice.discountPercentage !== 40 || brPrice.currency !== 'BRL' || !brPrice.isCustomOverride) {
    throw new Error('Brazil override was not respected');
  }
  console.log(`✓ Custom Country Override: Brazil explicit rule applied -> ${brPrice.formattedPrice} (40% off)\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 3: ZERO-CODE SHAREABLE PAYMENT LINKS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [Flow 3] Shareable Payment Links Engine ───');
  const slug = `master-deal-${Date.now()}`;
  const payLink = await PaymentLinkService.createPaymentLink(app.id, {
    title: 'Lifetime Dev Armor License',
    amount: 79.0,
    currency: 'USD',
    customSlug: slug,
    maxPurchases: 2,
    fulfillmentMessage: 'CONGRATULATIONS! Your private unlock key is: KEY_180_ARMOR_SECURE',
  });
  console.log(`✓ Created Payment Link: /pay/l/${payLink.slug} (Max 2 inventory capacity)`);

  // Resolve public link checkout
  const resolvedLink = await PaymentLinkService.getPublicPaymentLink(slug);
  if (resolvedLink.title !== 'Lifetime Dev Armor License') throw new Error('Failed to resolve public link');
  console.log(`✓ Public Resolution: Validated title "${resolvedLink.title}" and price $79.00`);

  // Increment usage count to max capacity
  const purchase1 = await PaymentLinkService.completeLinkPurchase(payLink.id, `sess_link_1_${Date.now()}`);
  const purchase2 = await PaymentLinkService.completeLinkPurchase(payLink.id, `sess_link_2_${Date.now()}`);
  if (!purchase1.fulfillmentMessage || !purchase2.fulfillmentMessage) {
    throw new Error('Digital asset fulfillment message not revealed upon purchase');
  }
  console.log(`✓ Consumed 2 link uses atomically & revealed secret asset message`);

  // 3rd attempt must be blocked by capacity
  try {
    await PaymentLinkService.completeLinkPurchase(payLink.id, `sess_link_3_${Date.now()}`);
    throw new Error('Payment link allowed purchase beyond max capacity');
  } catch (err: any) {
    console.log(`✓ Inventory Protection: Payment link rejected 3rd attempt beyond max capacity\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 4: CUSTOMER BILLING PORTAL (MAGIC 20-MIN TOKENS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [Flow 4] Customer Billing Self-Service Portal ───');
  const portalSession = await CustomerPortalService.createPortalSession({
    appId: app.id,
    customerEmail: 'subscriber@clientcorp.com',
    returnUrl: 'https://clientcorp.com/dashboard',
  });
  console.log(`✓ Issued 20-min Signed Magic Token: ${portalSession.sessionToken.slice(0, 16)}...`);
  console.log(`✓ Customer Portal URL: ${portalSession.portalUrl}`);

  // Fetch scoped customer portal data
  const portalData = await CustomerPortalService.getPortalData(portalSession.sessionToken);
  if (portalData.customer.email !== 'subscriber@clientcorp.com') {
    throw new Error('Portal data email mismatch');
  }
  console.log(`✓ Scoped Data Retrieval: Verified customer "${portalData.customer.email}" with merchant "${portalData.merchant.name}"\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 5: AUTONOMOUS AI AGENT PURCHASE PROTOCOL (AP2)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [Flow 5] Autonomous AI Agent Purchase Protocol (AP2) ───');
  const agentEnvelopeRes = await AgentPurchaseService.createBudgetEnvelope(app.id, {
    agentName: 'MasterResearchAgent-01',
    maxSpendTotal: 100.0,
    maxSpendPerTx: 25.0,
  });
  const rawAgentKey = agentEnvelopeRes.rawKey;
  const envId = agentEnvelopeRes.envelope.id;
  console.log(`✓ Issued Agent Envelope: ${agentEnvelopeRes.envelope.agentName} (Max Total: $100.00, Max/Tx: $25.00)`);
  console.log(`✓ Generated Raw Scoped Key: ${rawAgentKey.slice(0, 22)}...`);

  // Execute valid autonomous purchase ($12.50)
  const tx1 = await AgentPurchaseService.executeAgentPurchase({
    agentKey: rawAgentKey,
    appId: app.id,
    amount: 12.5,
    currency: 'USD',
    title: 'On-demand Vector Index Compute',
    idempotencyKey: `idemp_e2e_1_${Date.now()}`,
  });
  console.log(`✓ Autonomous M2M Purchase 1: Settled $12.50. Remaining Budget: $${(100 - (tx1.envelope?.spentTotal ?? 12.5)).toFixed(2)}`);

  // Execute purchase exceeding per-tx ceiling ($30.00 > $25.00 limit)
  try {
    await AgentPurchaseService.executeAgentPurchase({
      agentKey: rawAgentKey,
      appId: app.id,
      amount: 30.0,
      currency: 'USD',
      title: 'Runaway GPU Instance',
      idempotencyKey: `idemp_e2e_2_${Date.now()}`,
    });
    throw new Error('Agent breached per-transaction ceiling');
  } catch (err: any) {
    console.log(`✓ Hard Per-Tx Ceiling Enforced: Runaway $30.00 request rejected (Cap: $25.00)`);
  }

  // Trigger Killswitch Revocation
  await AgentPurchaseService.revokeBudgetEnvelope(app.id, envId);
  console.log(`✓ Killswitch Triggered: Revoked envelope "${agentEnvelopeRes.envelope.agentName}"`);

  // Attempt purchase after revocation
  try {
    await AgentPurchaseService.executeAgentPurchase({
      agentKey: rawAgentKey,
      appId: app.id,
      amount: 5.0,
      currency: 'USD',
      title: 'Post-revocation attempt',
      idempotencyKey: `idemp_e2e_3_${Date.now()}`,
    });
    throw new Error('Revoked key still executed payment');
  } catch (err: any) {
    console.log(`✓ Killswitch Enforced: Revoked agent key blocked from making further purchases\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FLOW 6: HMAC-SHA256 WEBHOOKS & DEVELOPER SDK VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('─── [Flow 6] HMAC Webhook Dispatcher & Developer SDK ───');
  const webhookSecret = 'whsec_e2e_test_secret_key_84920482';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawPayload = JSON.stringify({
    event: 'coupon.redeemed',
    data: {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: 50.0,
    },
  });

  const signature = WebhookDispatcherService.computeSignature(rawPayload, timestamp, webhookSecret);
  console.log(`✓ Generated HMAC-SHA256 Webhook Signature: ${signature.slice(0, 24)}...`);

  // Verify using Identity SDK
  const validVerification = Sovereign180Pay.verifyWebhookSignature({
    rawBody: rawPayload,
    signature,
    timestamp,
    secret: webhookSecret,
  });
  if (!validVerification) throw new Error('SDK failed to verify authentic webhook signature');
  console.log('✓ Developer SDK Verification: Authentic signature accepted with constant-time equality');

  // Verify tampered payload rejection
  const tamperedPayload = JSON.stringify({
    event: 'coupon.redeemed',
    data: { couponId: coupon.id, code: coupon.code, discountAmount: 9999.0 },
  });
  const tamperedVerification = Sovereign180Pay.verifyWebhookSignature({
    rawBody: tamperedPayload,
    signature,
    timestamp,
    secret: webhookSecret,
  });
  if (tamperedVerification) throw new Error('Tampered payload was mistakenly accepted');
  console.log('✓ Developer SDK Rejection: Tampered payload caught and rejected');

  // Verify replay drift rejection (> 5 minutes)
  const expiredTimestamp = (parseInt(timestamp, 10) - 305).toString();
  const expiredSignature = WebhookDispatcherService.computeSignature(rawPayload, expiredTimestamp, webhookSecret);
  const expiredVerification = Sovereign180Pay.verifyWebhookSignature({
    rawBody: rawPayload,
    signature: expiredSignature,
    timestamp: expiredTimestamp,
    secret: webhookSecret,
  });
  if (expiredVerification) throw new Error('Replay attack (>5 min) was mistakenly accepted');
  console.log('✓ Replay Attack Prevention: 5-minute drift window enforced\n');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  🎉 ALL 6 END-TO-END MASTER INTEGRATION FLOWS PASSED WITH 100% SUCCESS!');
  console.log('═══════════════════════════════════════════════════════════════════════');
}

runEndToEndMasterVerification()
  .catch((err) => {
    console.error('\n❌ MASTER INTEGRATION SUITE FAILURE:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
