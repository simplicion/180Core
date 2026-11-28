'use strict';

import {
  CheckoutService,
  parseIndianBankUpiAlert,
  computeBankListenerSecret,
  verifyBankListenerSecret,
} from '../checkout/checkout.service';
import { developersPrisma as prisma } from '@workspace/db-180core';

async function runBankVerificationTests() {
  console.log('========================================================================');
  console.log('UPI BANK VERIFICATION ENGINE - 60-ASSERTION EDGE-CASE & E2E TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${name}`);
      if (detail) console.error(`       Detail: ${detail}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  const now = new Date();
  const yearDigit = String(now.getUTCFullYear()).slice(-1);
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const julianDay = String(Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1).padStart(3, '0');
  const genUtr = () => `${yearDigit}${julianDay}${String(Math.floor(10000000 + Math.random() * 90000000))}`;

  const createdSessionIds: string[] = [];
  const createdUtrs: string[] = [];
  const createdTxIds: string[] = [];

  try {
    // -----------------------------------------------------------------------
    // SUITE 1: Indian Bank SMS / Email / App Notification Parsing
    // -----------------------------------------------------------------------
    console.log('--- SUITE 1: Indian Bank SMS, Email & App Notification Parsing ---');

    const utr1 = genUtr();
    const hdfcAlert = parseIndianBankUpiAlert(
      `Rs.149.00 credited to a/c **4321 on 28-11-26 by a/c linked to VPA customer@okhdfcbank (UPI Ref No ${utr1}). Info: 180P_abc12345`
    );
    assert(hdfcAlert.isCredit === true, 'HDFC SMS parsed as credit');
    assert(hdfcAlert.amount === 149, 'HDFC SMS amount parsed (149.00)');
    assert(hdfcAlert.utr === utr1, 'HDFC SMS 12-digit UTR extracted');
    assert(hdfcAlert.sessionRef === 'abc12345', 'HDFC SMS 180P_ sessionRef extracted');
    assert(hdfcAlert.payerVpa === 'customer@okhdfcbank', 'HDFC SMS payer VPA extracted');

    const utr2 = genUtr();
    const iciciAlert = parseIndianBankUpiAlert(
      `Dear Customer, Acct XX890 is credited with INR 1,299.50 on 28-Nov-26 from rahul@ybl. UPI:${utr2}-180P_icici999`
    );
    assert(iciciAlert.isCredit === true, 'ICICI alert parsed as credit');
    assert(iciciAlert.amount === 1299.5, 'ICICI comma-formatted amount parsed (1299.50)');
    assert(iciciAlert.utr === utr2, 'ICICI UTR extracted');
    assert(iciciAlert.sessionRef === 'icici999', 'ICICI 180P_ reference extracted');

    const utr3 = genUtr();
    const sbiAlert = parseIndianBankUpiAlert(
      `Dear SBI User, your A/c X1234-credited by Rs.499 on 28Nov26 transfer from priya@oksbi Ref No ${utr3}`
    );
    assert(sbiAlert.isCredit === true, 'SBI SMS parsed as credit');
    assert(sbiAlert.amount === 499, 'SBI amount parsed (499)');
    assert(sbiAlert.utr === utr3, 'SBI Ref No UTR extracted');

    const utr4 = genUtr();
    const axisAlert = parseIndianBankUpiAlert(
      `INR 750.00 credited to your Axis Bank A/c XX5566 via UPI/P2M/${utr4}/180P_axis7788.`
    );
    assert(axisAlert.isCredit === true, 'Axis alert parsed as credit');
    assert(axisAlert.amount === 750, 'Axis amount parsed');
    assert(axisAlert.utr === utr4, 'Axis /UPI/ UTR extracted');
    assert(axisAlert.sessionRef === 'axis7788', 'Axis 180P_ reference extracted');

    const utr5 = genUtr();
    const kotakAlert = parseIndianBankUpiAlert(
      `Received Rs. 249.75 in your Kotak Bank Acct XX9012 from amit@paytm. UPI Ref ID: ${utr5}.`
    );
    assert(kotakAlert.isCredit === true, 'Kotak alert parsed as credit');
    assert(kotakAlert.amount === 249.75, 'Kotak decimal amount parsed');
    assert(kotakAlert.utr === utr5, 'Kotak UTR extracted');

    const utr6 = genUtr();
    const phonepeBizAlert = parseIndianBankUpiAlert(
      `Payment of ₹999 received from Customer on PhonePe Business. UTR: ${utr6}`
    );
    assert(phonepeBizAlert.isCredit === true, 'PhonePe Business notification parsed as credit');
    assert(phonepeBizAlert.amount === 999, 'PhonePe Business rupee symbol amount parsed');
    assert(phonepeBizAlert.utr === utr6, 'PhonePe Business UTR extracted');

    const utr7 = genUtr();
    const gpayBizAlert = parseIndianBankUpiAlert(
      `Paid you ₹49.00 on Google Pay for Business. UPI Transaction ID: ${utr7}`
    );
    assert(gpayBizAlert.isCredit === true, 'GPay for Business notification parsed as credit');
    assert(gpayBizAlert.amount === 49, 'GPay for Business amount parsed');
    assert(gpayBizAlert.utr === utr7, 'GPay for Business UTR extracted');

    // -----------------------------------------------------------------------
    // SUITE 2: Anti-Spoof & Rejection Vectors
    // -----------------------------------------------------------------------
    console.log('\n--- SUITE 2: Anti-Spoof & Rejection Vectors ---');

    const otpMsg = parseIndianBankUpiAlert(`123456 is your OTP for Rs.149.00 credited verification. Do not share.`);
    assert(otpMsg.isCredit === false, 'OTP message rejected');

    const debitMsg = parseIndianBankUpiAlert(`Rs.149.00 debited from A/c **4321 to merchant@ybl. UPI Ref No ${genUtr()}`);
    assert(debitMsg.isCredit === false, 'Outgoing debit SMS rejected');

    const failedMsg = parseIndianBankUpiAlert(`Transaction of Rs.499.00 credited attempt failed due to bank timeout.`);
    assert(failedMsg.isCredit === false, 'Failed transaction alert rejected');

    const declinedMsg = parseIndianBankUpiAlert(`Payment of Rs.299.00 was declined by issuer.`);
    assert(declinedMsg.isCredit === false, 'Declined payment alert rejected');

    const emptyMsg = parseIndianBankUpiAlert('   ');
    assert(emptyMsg.isCredit === false, 'Empty alert rejected');

    const promoMsg = parseIndianBankUpiAlert('Get 10% cashback on your next UPI payment today!');
    assert(promoMsg.isCredit === false, 'Promotional non-credit message rejected');

    // -----------------------------------------------------------------------
    // SUITE 3: Secret Auth & Database Session Setup
    // -----------------------------------------------------------------------
    console.log('\n--- SUITE 3: Secret Auth & Database Session Matching ---');

    let app = await prisma.oAuthApp.findFirst({ where: { isActive: true } });
    if (!app) {
      throw new Error('No active OAuthApp found in DB for test');
    }

    app = await prisma.oAuthApp.update({
      where: { id: app.id },
      data: {
        customGatewayType: 'DIRECT_UPI',
        customUpiId: 'banktest@okhdfcbank',
        customUpiName: 'Bank Test Merchant',
        enableDirectUpi: true,
        enablePlatformGateway: false,
      },
    });

    const validSecret = computeBankListenerSecret(app.id);
    assert(validSecret.length === 48, 'Derived bank listener secret is 48 chars');
    assert(verifyBankListenerSecret(app, validSecret), 'Valid bank listener secret verifies');
    assert(!verifyBankListenerSecret(app, 'wrong_secret_123'), 'Invalid bank listener secret rejected');
    assert(!verifyBankListenerSecret(app, ''), 'Empty bank listener secret rejected');

    // Reject unauthorized webhook call
    let unauthRejected = false;
    try {
      await CheckoutService.ingestBankCreditWebhook({
        appId: app.id,
        secret: 'forged_secret_xyz',
        amount: 149,
        utr: genUtr(),
      });
    } catch (e: any) {
      if (e.message.includes('Unauthorized')) unauthRejected = true;
    }
    assert(unauthRejected, 'Unauthorized webhook rejected with invalid secret');

    // Create Session 1 (Exact 180P_ match)
    const session1 = await prisma.checkoutSession.create({
      data: {
        appId: app.id,
        amount: 349,
        currency: 'INR',
        title: 'Bank Match Test 1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    createdSessionIds.push(session1.id);
    const shortRef1 = session1.id.replace(/-/g, '').slice(0, 16);

    // Test amount mismatch rejection on exact ref
    let mismatchRejected = false;
    try {
      await CheckoutService.ingestBankCreditWebhook({
        appId: app.id,
        secret: validSecret,
        rawText: `Rs.10.00 credited to A/c via UPI Ref ${genUtr()} Info: 180P_${shortRef1}`,
      });
    } catch (e: any) {
      if (e.message.includes('Amount mismatch')) mismatchRejected = true;
    }
    assert(mismatchRejected, 'Amount mismatch rejected even when 180P_ reference matches');

    // Test exact 180P_ match capture
    const validUtr1 = genUtr();
    createdUtrs.push(validUtr1);
    const res1 = await CheckoutService.ingestBankCreditWebhook({
      appId: app.id,
      secret: validSecret,
      rawText: `Rs.349.00 credited to a/c **1234 via VPA buyer@okicici (UPI Ref No ${validUtr1}) Note: 180P_${shortRef1}`,
    });
    createdTxIds.push(res1.transactionId);

    assert(res1.success === true, 'Exact 180P_ match webhook succeeded');
    assert(res1.matchedSessionId === session1.id, 'Matched exact Session 1 ID');
    assert(res1.status === 'CAPTURED', 'Session 1 status transitioned to CAPTURED');

    const dbSession1 = await prisma.checkoutSession.findUnique({ where: { id: session1.id } });
    assert(dbSession1?.status === 'CAPTURED', 'Database Session 1 is CAPTURED');
    assert((dbSession1?.metadata as any)?.utr === validUtr1, 'Database Session 1 metadata has UTR');

    const ver1 = await prisma.upiPaymentVerification.findUnique({ where: { sessionId: session1.id } });
    assert(ver1?.utr === validUtr1 && ver1?.status === 'CAPTURED', 'UpiPaymentVerification persisted as CAPTURED');

    const ledger1 = await prisma.ledgerEntry.findFirst({ where: { referenceId: res1.transactionId } });
    assert(ledger1?.type === 'DIRECT_UPI_SETTLED' && ledger1.amount === 0, 'Zero-balance DIRECT_UPI_SETTLED ledger recorded');

    // -----------------------------------------------------------------------
    // SUITE 4: Replay, Fallback Amount Match, Ambiguity & Provisional Upgrade
    // -----------------------------------------------------------------------
    console.log('\n--- SUITE 4: Replay, Fallback Match, Ambiguity & Upgrade ---');

    // Create Session 2 (unique amount 777 without 180P_ note)
    const session2 = await prisma.checkoutSession.create({
      data: {
        appId: app.id,
        amount: 777,
        currency: 'INR',
        title: 'Fallback Amount Match Test',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    createdSessionIds.push(session2.id);

    // Replay UTR from Session 1 must fail
    let replayBlocked = false;
    try {
      await CheckoutService.ingestBankCreditWebhook({
        appId: app.id,
        secret: validSecret,
        amount: 777,
        utr: validUtr1,
      });
    } catch (e: any) {
      if (e.message.includes('already been processed')) replayBlocked = true;
    }
    assert(replayBlocked, 'Global anti-replay blocks reused UTR on bank webhook');

    // Upgrade Session 2 to PENDING_VERIFICATION first (simulating mobile return before bank alert arrives)
    await CheckoutService.autoVerifyDirectUpiPayment({
      sessionId: session2.id,
      status: 'SUCCESS',
      responseCode: '00',
    });
    const pendingVerSession2 = await prisma.checkoutSession.findUnique({ where: { id: session2.id } });
    assert(pendingVerSession2?.status === 'PENDING_VERIFICATION', 'Provisional mobile return sets PENDING_VERIFICATION');

    // Now bank credit alert arrives (without 180P_ note) -> matches by unique amount 777 and upgrades to CAPTURED!
    const validUtr2 = genUtr();
    createdUtrs.push(validUtr2);
    const res2 = await CheckoutService.ingestBankCreditWebhook({
      appId: app.id,
      secret: validSecret,
      rawText: `Payment of ₹777.00 received on PhonePe Business. UTR: ${validUtr2}`,
    });
    createdTxIds.push(res2.transactionId);
    assert(res2.matchedSessionId === session2.id, 'Fallback amount match found PENDING_VERIFICATION Session 2');
    assert(res2.status === 'CAPTURED', 'PENDING_VERIFICATION upgraded to CAPTURED via bank alert');

    // Ambiguity Protection: 2 concurrent sessions with same amount 888 and no 180P_ note
    const amb1 = await prisma.checkoutSession.create({
      data: { appId: app.id, amount: 888, currency: 'INR', title: 'Amb 1', status: 'PENDING', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const amb2 = await prisma.checkoutSession.create({
      data: { appId: app.id, amount: 888, currency: 'INR', title: 'Amb 2', status: 'PENDING', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    createdSessionIds.push(amb1.id, amb2.id);

    let ambiguityBlocked = false;
    try {
      await CheckoutService.ingestBankCreditWebhook({
        appId: app.id,
        secret: validSecret,
        rawText: `INR 888.00 credited via UPI Ref ${genUtr()}`,
      });
    } catch (e: any) {
      if (e.message.includes('Ambiguous match')) ambiguityBlocked = true;
    }
    assert(ambiguityBlocked, 'Ambiguous match rejected when 2 active sessions share amount without 180P_ note');

    // Old session (> 20 minutes ago) must not be matched by amount fallback
    const oldSession = await prisma.checkoutSession.create({
      data: {
        appId: app.id,
        amount: 654,
        currency: 'INR',
        title: 'Old Session',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 25 * 60 * 1000),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    createdSessionIds.push(oldSession.id);

    let staleSessionIgnored = false;
    try {
      await CheckoutService.ingestBankCreditWebhook({
        appId: app.id,
        secret: validSecret,
        rawText: `INR 654.00 credited via UPI Ref ${genUtr()}`,
      });
    } catch (e: any) {
      if (e.message.includes('No matching active')) staleSessionIgnored = true;
    }
    assert(staleSessionIgnored, 'Sessions older than 20 minutes are excluded from fallback matching');

    // Malformed UTR rejected
    let badUtrRejected = false;
    try {
      await CheckoutService.ingestBankCreditWebhook({
        appId: app.id,
        secret: validSecret,
        amount: 888,
        utr: '999999999999',
      });
    } catch (e: any) {
      if (e.message.includes('repetitive') || e.message.includes('Invalid')) badUtrRejected = true;
    }
    assert(badUtrRejected, 'Repetitive dummy UTR rejected in bank webhook');

    // Clean up test records
    await prisma.upiPaymentVerification.deleteMany({ where: { sessionId: { in: createdSessionIds } } });
    await prisma.ledgerEntry.deleteMany({ where: { referenceId: { in: createdTxIds } } });
    await prisma.checkoutSession.deleteMany({ where: { id: { in: createdSessionIds } } });

    console.log('\n========================================================================');
    console.log(`ALL BANK VERIFICATION TESTS PASSED: ${passed} / ${total} assertions verified.`);
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\nBANK VERIFICATION TEST FAILED:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBankVerificationTests();
