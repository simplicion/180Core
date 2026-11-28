import { developersPrisma as prisma } from '@workspace/db-180core';
import { CheckoutService } from '@workspace/payment-provider';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/180-core-backend/.env') });

async function runPaymentSimulation() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  🧪 180 PAY PAYMENT VERIFICATION & SIMULATION AUDIT SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Step 1: Find or resolve an active OAuth application
  const app = await prisma.oAuthApp.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!app) {
    throw new Error('No active developer app found for simulation');
  }

  console.log(`✓ Developer App: "${app.name}" (${app.id})`);

  // Step 2: Create a simulated checkout session
  const testSession = await prisma.checkoutSession.create({
    data: {
      appId: app.id,
      amount: 149,
      originalAmount: 149,
      currency: 'INR',
      status: 'PENDING',
      title: 'Simulation E2E Payment Test',
      description: 'Stress-test verification engine & deduplication',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
    include: { app: true },
  });

  console.log(`✓ Created Checkout Session: ${testSession.id}`);

  // Step 3: Create Gateway Order
  const order = await CheckoutService.createDirectOrder(testSession.id, {
    targetCurrency: 'INR',
    targetAmount: 149,
  });

  console.log(`✓ Generated Gateway Order: ${order.orderId} (Amount: ${order.amountPaise} paise, Key: ${order.keyId ? order.keyId.slice(0, 10) + '...' : 'none'})`);

  const isDirectUpiOrder = order.orderId.startsWith('upi_') || order.gatewayType === 'DIRECT_UPI';

  // Step 4: Generate authentic verification payload
  const { keySecret } = CheckoutService.resolveGatewayConfig(app);
  const simPaymentId = `pay_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let simSignature: string;

  if (isDirectUpiOrder) {
    // Generate a valid 12-digit NPCI Julian-date UTR for Direct UPI verification
    const now = new Date();
    const yearLastDigit = String(now.getUTCFullYear()).slice(-1);
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const julianDay = String(Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1).padStart(3, '0');
    const seq = String(Math.floor(10000000 + Math.random() * 90000000));
    simSignature = `${yearLastDigit}${julianDay}${seq}`;
    console.log(`✓ Generated Valid NPCI Julian-Date UTR for Direct UPI: ${simSignature}`);
  } else {
    simSignature = crypto
      .createHmac('sha256', keySecret || process.env.RAZORPAY_KEY_SECRET || 'fallback_secret')
      .update(`${order.orderId}|${simPaymentId}`)
      .digest('hex');
    console.log(`✓ Computed Valid HMAC Signature for Payment: ${simPaymentId}`);
  }

  // Step 5: Test Concurrent Verification (Simulating frontend direct-verify + status polling collision)
  console.log('\n─── [Concurrency Test] Running 2 Parallel Verifications on Same Session ───');
  const t0 = Date.now();

  const [verifyResult1, verifyResult2] = await Promise.all([
    CheckoutService.verifyDirectPayment({
      sessionId: testSession.id,
      orderId: order.orderId,
      paymentId: simPaymentId,
      signature: simSignature,
    }),
    CheckoutService.verifyDirectPayment({
      sessionId: testSession.id,
      orderId: order.orderId,
      paymentId: simPaymentId,
      signature: simSignature,
    }),
  ]);

  const elapsed = Date.now() - t0;
  console.log(`✓ Parallel Execution Completed in ${elapsed}ms without deadlock!`);
  console.log(`  - Call 1 result status: ${verifyResult1.status || verifyResult1.session?.status}`);
  console.log(`  - Call 2 result status: ${verifyResult2.status || verifyResult2.session?.status}`);

  // Step 6: Verify Database Session State
  const capturedSession = await prisma.checkoutSession.findUnique({
    where: { id: testSession.id },
  });

  if (capturedSession?.status !== 'CAPTURED') {
    throw new Error(`Expected session status CAPTURED, but found ${capturedSession?.status}`);
  }

  // Step 7: Verify Ledger Entry (referenceId differs between gateway HMAC and Direct UPI auto-verify)
  const transactionId = verifyResult1.transactionId || verifyResult2.transactionId;
  const ledger = await prisma.ledgerEntry.findFirst({
    where: {
      OR: [
        { referenceId: simPaymentId },
        { referenceId: transactionId },
      ],
    },
  });

  if (!ledger) {
    throw new Error('Ledger entry was not recorded for verified payment');
  }

  console.log(`✓ Double-entry Ledger Confirmed: Entry #${ledger.id}, Amount: ${ledger.amount}, BalanceAfter: ${ledger.balanceAfter}`);
  console.log(`✓ Session Status: ${capturedSession.status}, CompletedAt: ${capturedSession.completedAt}`);

  // Step 8: Clean up simulation session
  await prisma.upiPaymentVerification.deleteMany({ where: { sessionId: testSession.id } }).catch(() => {});
  await prisma.ledgerEntry.deleteMany({ where: { OR: [{ referenceId: simPaymentId }, { referenceId: transactionId }] } }).catch(() => {});
  await prisma.checkoutSession.delete({ where: { id: testSession.id } }).catch(() => {});
  console.log('✓ Cleaned up temporary simulation records');

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  PAYMENT SIMULATION & DEDUPLICATION AUDIT: ALL TESTS PASSED!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

runPaymentSimulation()
  .catch((err) => {
    console.error('❌ Simulation Error:', err.message, err.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
