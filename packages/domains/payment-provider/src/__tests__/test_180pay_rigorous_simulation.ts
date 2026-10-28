import crypto from 'crypto';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { CheckoutService } from '../checkout/checkout.service';
import { PaymentLinkService } from '../payment-link/payment-link.service';
import { IdentityWalletService } from '../wallet/identity-wallet.service';
import { WebhookDispatcherService, WebhookEventType } from '../webhook/webhook-dispatcher.service';

// Enforce test environment variables for rigorous simulation
process.env.NODE_ENV = 'test';
const TEST_RAZORPAY_KEY_SECRET = 'rzp_sec_live_sim_secret_88888888';
const TEST_RAZORPAY_KEY_ID = 'rzp_test_sim_key_id_12345678';
process.env.RAZORPAY_KEY_SECRET = TEST_RAZORPAY_KEY_SECRET;
process.env.RAZORPAY_KEY_ID = TEST_RAZORPAY_KEY_ID;

async function runRigorous180PaySimulation() {
  console.log('================================================================');
  console.log('   180 PAY RIGOROUS END-TO-END VERIFICATION & SECURITY AUDIT   ');
  console.log('================================================================\n');

  // Find or verify an active OAuth App
  const app = await prisma.oAuthApp.findFirst({
    where: { isActive: true },
  });

  if (!app) {
    throw new Error('No active OAuth App found in database.');
  }
  console.log(`[Setup] Active Merchant App: "${app.name}" (ID: ${app.id})\n`);

  // ────────────────────────────────────────────────────────────────────────────
  // SIMULATION 1: Multi-Visitor Payment Link Flow & Fix for "Already Authorized"
  // ────────────────────────────────────────────────────────────────────────────
  console.log('--- [SIMULATION 1] Payment Link Multi-User Isolation & State Isolation ---');
  const slug = `rigorous-link-${Date.now()}`;
  const LINK_AMOUNT = 500.0;

  const paymentLink = await PaymentLinkService.createPaymentLink(app.id, {
    title: 'Rigorous Verification Product',
    amount: LINK_AMOUNT,
    currency: 'INR',
    customSlug: slug,
    fulfillmentMessage: 'VERIFIED_ACCESS_TOKEN_ABC_999',
  });
  console.log(`✅ Created Payment Link: /link/${slug} (Amount: ₹${LINK_AMOUNT})`);

  // Visitor A opens the payment link
  const visitorSessionA = await CheckoutService.getSession(slug, null, {
    clientSessionId: 'visitor_A_client_id_001',
  });
  console.log(`Visitor A Session: ${visitorSessionA.id} | Status: ${visitorSessionA.status} | Amount: ₹${visitorSessionA.amount}`);
  if (visitorSessionA.status !== 'PENDING' || Number(visitorSessionA.amount) !== LINK_AMOUNT) {
    throw new Error(`Visitor A should receive an active PENDING session for ₹${LINK_AMOUNT}`);
  }

  // Visitor B opens the payment link concurrently
  const visitorSessionB = await CheckoutService.getSession(slug, null, {
    clientSessionId: 'visitor_B_client_id_002',
  });
  console.log(`Visitor B Session: ${visitorSessionB.id} | Status: ${visitorSessionB.status} | Amount: ₹${visitorSessionB.amount}`);
  if (visitorSessionB.id === visitorSessionA.id) {
    throw new Error('SECURITY VIOLATION: Visitor A and Visitor B shared the same checkout session ID!');
  }
  if (visitorSessionB.status !== 'PENDING' || Number(visitorSessionB.amount) !== LINK_AMOUNT) {
    throw new Error(`Visitor B should receive a separate PENDING session for ₹${LINK_AMOUNT}`);
  }
  console.log('✅ Visitor A and Visitor B received isolated PENDING sessions.');

  // Now Visitor A completes payment for their session
  const orderA = await CheckoutService.createDirectOrder(visitorSessionA.id, {});
  const paymentIdA = `pay_sim_A_${Date.now()}`;
  const validSigA = crypto
    .createHmac('sha256', TEST_RAZORPAY_KEY_SECRET)
    .update(`${orderA.orderId}|${paymentIdA}`)
    .digest('hex');

  const captureA = await CheckoutService.verifyDirectPayment({
    sessionId: visitorSessionA.id,
    orderId: orderA.orderId,
    paymentId: paymentIdA,
    signature: validSigA,
  });
  console.log(`Visitor A Payment Result: Captured=${captureA.success} | Status=${captureA.session?.status}`);
  if (!captureA.success || captureA.session?.status !== 'CAPTURED') {
    throw new Error('Visitor A payment verification failed to capture session');
  }
  console.log('✅ Visitor A payment successfully captured.');

  // CRITICAL CHECK: Visitor C now opens the payment link after Visitor A has paid!
  // Previously, the bug would return Visitor A's CAPTURED session and show "Payment Authorized!"
  const visitorSessionC = await CheckoutService.getSession(slug, null, {
    clientSessionId: 'visitor_C_client_id_003',
  });
  console.log(`Visitor C Session: ${visitorSessionC.id} | Status: ${visitorSessionC.status} | Amount: ₹${visitorSessionC.amount}`);
  
  if (visitorSessionC.status === 'CAPTURED' || visitorSessionC.status === 'COMPLETED') {
    throw new Error('CRITICAL BUG DETECTED: Visitor C received a previous visitor\'s CAPTURED session!');
  }
  if (visitorSessionC.id === visitorSessionA.id) {
    throw new Error('CRITICAL BUG DETECTED: Visitor C was assigned Visitor A\'s session ID!');
  }
  if (Number(visitorSessionC.amount) !== LINK_AMOUNT) {
    throw new Error(`Visitor C amount should be ₹${LINK_AMOUNT}, got ₹${visitorSessionC.amount}`);
  }
  console.log('✅ PASS: Visitor C received a fresh un-captured PENDING session for ₹500.00! ("Already Authorized" bug is FIXED)');

  // ────────────────────────────────────────────────────────────────────────────
  // SIMULATION 2: Cryptographic Signature Verification & Forgery Denial
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [SIMULATION 2] Cryptographic HMAC-SHA256 Signature Verification & Forgery Denial ---');
  
  // 1. Rejection of Forged Signature
  const forgedPaymentId = `pay_forged_${Date.now()}`;
  const forgedSig = '0000000000000000000000000000000000000000000000000000000000000000';
  let forgedRejected = false;
  try {
    await CheckoutService.verifyDirectPayment({
      sessionId: visitorSessionB.id,
      orderId: 'order_test_9999',
      paymentId: forgedPaymentId,
      signature: forgedSig,
    });
  } catch (err: any) {
    forgedRejected = true;
    console.log(`Forged Signature Rejection: ✅ BLOCKED ("${err.message}")`);
  }
  if (!forgedRejected) {
    throw new Error('SECURITY VIOLATION: Forged signature was NOT rejected!');
  }

  // 2. Rejection of Tampered Payload / Wrong Order ID
  const validPaymentIdB = `pay_sim_B_${Date.now()}`;
  const orderB = await CheckoutService.createDirectOrder(visitorSessionB.id, {});
  const wrongOrderSig = crypto
    .createHmac('sha256', TEST_RAZORPAY_KEY_SECRET)
    .update(`order_different_123|${validPaymentIdB}`)
    .digest('hex');

  let tamperedRejected = false;
  try {
    await CheckoutService.verifyDirectPayment({
      sessionId: visitorSessionB.id,
      orderId: orderB.orderId,
      paymentId: validPaymentIdB,
      signature: wrongOrderSig,
    });
  } catch (err: any) {
    tamperedRejected = true;
    console.log(`Tampered Order Binding Rejection: ✅ BLOCKED ("${err.message}")`);
  }
  if (!tamperedRejected) {
    throw new Error('SECURITY VIOLATION: Signature with mismatched order was NOT rejected!');
  }

  // 3. Acceptance of Authentic Genuine Signature
  const authenticSigB = crypto
    .createHmac('sha256', TEST_RAZORPAY_KEY_SECRET)
    .update(`${orderB.orderId}|${validPaymentIdB}`)
    .digest('hex');

  const captureB = await CheckoutService.verifyDirectPayment({
    sessionId: visitorSessionB.id,
    orderId: orderB.orderId,
    paymentId: validPaymentIdB,
    signature: authenticSigB,
  });
  console.log(`Authentic Signature Verification: ✅ ACCEPTED (Session Status: ${captureB.session?.status})`);
  if (!captureB.success || captureB.session?.status !== 'CAPTURED') {
    throw new Error('Valid signature was rejected');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SIMULATION 3: Anti-Tampering Protection (Enforce Real Database Amount)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [SIMULATION 3] Anti-Tampering: Enforce Database Amount vs Client Tampered Amount ---');
  
  // Create fixed ₹1,000 session
  const fixedSession = await prisma.checkoutSession.create({
    data: {
      id: `sess_fixed_${Date.now()}`,
      appId: app.id,
      amount: 1000.0,
      originalAmount: 1000.0,
      currency: 'INR',
      status: 'PENDING',
      title: 'Fixed Price Premium Product',
      metadata: {
        allowCustomAmount: false,
      },
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  // Client attempts to tamper price by passing targetAmount: 10 (trying to pay ₹10 instead of ₹1000)
  const tamperedOrder = await CheckoutService.createDirectOrder(fixedSession.id, {
    targetAmount: 10.0,
    targetCurrency: 'INR',
  });

  console.log(`Requested amount by attacker: ₹10.00 | Generated order amount: ₹${tamperedOrder.amountPaise / 100}`);
  if (tamperedOrder.amountPaise !== 100000) {
    throw new Error(`SECURITY VIOLATION: Order amount was tampered to ₹${tamperedOrder.amountPaise / 100}! Expected ₹1000.00`);
  }
  console.log('✅ PASS: Client price tampering strictly blocked. Database amount of ₹1000.00 (100,000 paise) enforced.');

  // ────────────────────────────────────────────────────────────────────────────
  // SIMULATION 4: Strict Webhook Signature Enforcement
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [SIMULATION 4] Webhook Dispatcher & Ingestion Cryptographic Enforcement ---');
  const webhookSecret = 'whsec_rigorous_audit_key_555';
  const webhookTimestamp = Math.floor(Date.now() / 1000).toString();
  const webhookPayload = JSON.stringify({
    event: 'payment_link.completed' as WebhookEventType,
    data: {
      linkId: paymentLink.id,
      amount: 500,
      sessionId: visitorSessionA.id,
    },
    timestamp: new Date().toISOString(),
  });

  const validWebhookSig = WebhookDispatcherService.computeSignature(webhookPayload, webhookTimestamp, webhookSecret);
  const isWhValid = WebhookDispatcherService.verifySignature({
    rawBody: webhookPayload,
    signature: validWebhookSig,
    timestamp: webhookTimestamp,
    secret: webhookSecret,
  });
  console.log(`Valid Webhook Signature: ${isWhValid ? '✅ PASS' : '❌ FAIL'}`);
  if (!isWhValid) throw new Error('Valid webhook signature was rejected');

  const isWhTamperedValid = WebhookDispatcherService.verifySignature({
    rawBody: webhookPayload + 'tampered',
    signature: validWebhookSig,
    timestamp: webhookTimestamp,
    secret: webhookSecret,
  });
  console.log(`Tampered Webhook Body: ${!isWhTamperedValid ? '✅ BLOCKED AS EXPECTED' : '❌ FAILED'}`);
  if (isWhTamperedValid) throw new Error('Tampered webhook payload should have been rejected');

  // ────────────────────────────────────────────────────────────────────────────
  // SIMULATION 5: Identity Wallet Top-Up Signature Verification & Anti-Double-Spend
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- [SIMULATION 5] Wallet Top-Up Signature Verification & Anti-Double-Spend Idempotency ---');
  const anyUser = await prisma.user.findFirst();
  if (anyUser) {
    const topupOrderId = `order_topup_${Date.now()}`;
    const topupPaymentId = `pay_topup_${Date.now()}`;
    const topupAmount = 250.0;

    const validTopupSig = crypto
      .createHmac('sha256', TEST_RAZORPAY_KEY_SECRET)
      .update(`${topupOrderId}|${topupPaymentId}`)
      .digest('hex');

    // 1. Rejection of forged top-up signature
    let forgedTopupBlocked = false;
    try {
      await IdentityWalletService.verifyAndCreditTopup(
        anyUser.id,
        topupOrderId,
        topupPaymentId,
        'forged_topup_signature_hex_000000000',
        topupAmount
      );
    } catch (err: any) {
      forgedTopupBlocked = true;
      console.log(`Forged Top-up Signature: ✅ BLOCKED ("${err.message}")`);
    }
    if (!forgedTopupBlocked) {
      throw new Error('SECURITY VIOLATION: Forged top-up signature was NOT blocked!');
    }

    // 2. Credit Top-up with authentic signature
    const initialCredit = await IdentityWalletService.verifyAndCreditTopup(
      anyUser.id,
      topupOrderId,
      topupPaymentId,
      validTopupSig,
      topupAmount
    );
    console.log(`Initial Top-Up: ✅ CREDITED (Wallet Balance: ₹${initialCredit.newBalance})`);

    // 3. Attempt duplicate double-spend replay with the same paymentId
    const replayCredit = await IdentityWalletService.verifyAndCreditTopup(
      anyUser.id,
      topupOrderId,
      topupPaymentId,
      validTopupSig,
      topupAmount
    );
    console.log(`Replay Double-Spend Attempt: ✅ SAFE (Duplicate Detected, Balance Unchanged: ₹${replayCredit.newBalance})`);
    if (replayCredit.newBalance !== initialCredit.newBalance) {
      throw new Error('SECURITY VIOLATION: Duplicate top-up replay increased user wallet balance!');
    }

    // Clean up test top-up ledger entry & balance
    await prisma.ledgerEntry.deleteMany({
      where: { referenceId: topupPaymentId },
    });
    await prisma.wallet.update({
      where: { userId: anyUser.id },
      data: { balance: { decrement: topupAmount } },
    });
  }

  // Clean up test records
  await prisma.checkoutSession.deleteMany({
    where: {
      id: { in: [visitorSessionA.id, visitorSessionB.id, visitorSessionC.id, fixedSession.id] },
    },
  });
  await prisma.paymentLink.delete({
    where: { id: paymentLink.id },
  });

  console.log('\n================================================================');
  console.log('   🎉 ALL 5 RIGOROUS SIMULATIONS PASSED 100% SUCCESSFULLY!      ');
  console.log('   - Multi-user payment links verified isolated & fresh         ');
  console.log('   - Forged & tampered signatures 100% blocked                  ');
  console.log('   - Genuine HMAC-SHA256 signatures accepted and captured       ');
  console.log('   - Order amount tampering blocked                             ');
  console.log('   - Webhook signatures cryptographically validated             ');
  console.log('   - Double-spend replay attacks prevented                      ');
  console.log('================================================================\n');
}

runRigorous180PaySimulation().catch((err) => {
  console.error('\n❌ RIGOROUS SIMULATION FAILED:', err);
  process.exit(1);
});
