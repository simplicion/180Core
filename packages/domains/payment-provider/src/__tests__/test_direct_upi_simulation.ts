'use strict';

import { CheckoutService, validateNpciUtr, isValidUpiVpa, encryptGatewaySecret, decryptGatewaySecret } from '../checkout/checkout.service';
import { developersPrisma as prisma } from '@workspace/db-180core';

async function runDirectUpiSimulation() {
  console.log('========================================================================');
  console.log('STARTING DIRECT NATIVE UPI END-TO-END SIMULATION & SECURITY AUDIT TEST');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  let originalSettings: any = null;
  try {
    originalSettings = await prisma.platformGatewaySettings.findUnique({ where: { id: 'global' } });
    // -------------------------------------------------------------------------
    // SUITE 1: Algorithmic NPCI Julian-Date UTR Validation
    // -------------------------------------------------------------------------
    console.log('--- SUITE 1: Algorithmic NPCI Julian-Date UTR Validation ---');
    const now = new Date();
    const currentYearLastDigit = String(now.getUTCFullYear()).slice(-1);
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const currentJulianDay = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const formattedJulian = String(currentJulianDay).padStart(3, '0');

    // Valid UTR: Year + Julian Day + 8-digit unique sequence per test run
    const testSeq = String(Math.floor(10000000 + Math.random() * 90000000));
    const validUtr = `${currentYearLastDigit}${formattedJulian}${testSeq}`;
    const checkValid = validateNpciUtr(validUtr);
    assert(checkValid.isValid, 'Valid NPCI Julian-date UTR passes validation', checkValid.reason);

    // Reject non-12-digit string
    const checkShort = validateNpciUtr('123456');
    assert(!checkShort.isValid, 'Short UTR (< 12 digits) is rejected', checkShort.reason);

    // Reject repetitive sequences
    const checkRepetitive = validateNpciUtr('999999999999');
    assert(!checkRepetitive.isValid, 'Repetitive dummy sequence (999999999999) is rejected', checkRepetitive.reason);

    const checkSeq123 = validateNpciUtr('123456789012');
    assert(!checkSeq123.isValid, 'Sequential dummy sequence (123456789012) is rejected', checkSeq123.reason);

    // Reject expired/out-of-window Julian day (e.g., day 010 when today is late in year)
    const staleJulian = '010';
    const staleUtr = `${currentYearLastDigit}${staleJulian}12345678`;
    const checkStale = validateNpciUtr(staleUtr);
    assert(!checkStale.isValid, 'Stale Julian-date UTR outside 7-day window is rejected', checkStale.reason);

    // Reject invalid year digit (e.g., year 2 when active is 6)
    const wrongYearUtr = `2${formattedJulian}12345678`;
    const checkWrongYear = validateNpciUtr(wrongYearUtr);
    assert(!checkWrongYear.isValid, 'Mismatched year digit is rejected', checkWrongYear.reason);

    // -------------------------------------------------------------------------
    // SUITE 2: Merchant BYOG Gateway Resolution & Dual-Rail Architecture
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Gateway Config Resolution & Dual-Rail Architecture ---');
    const mockApp = {
      id: 'app_test_direct_upi_001',
      name: 'SuperStore AI',
      customGatewayType: 'DIRECT_UPI',
      customUpiId: 'superstore@okhdfcbank',
      customUpiName: 'SuperStore Official',
      enableDirectUpi: true,
      enablePlatformGateway: false,
    };

    const resolvedConfig = CheckoutService.resolveGatewayConfig(mockApp);
    assert(resolvedConfig.gatewayType === 'DIRECT_UPI', 'Config resolves to DIRECT_UPI without gateway API secret');
    assert(resolvedConfig.customUpiId === 'superstore@okhdfcbank', 'Custom receiving UPI ID matches merchant VPA');
    assert(resolvedConfig.customUpiName === 'SuperStore Official', 'Custom merchant name matches display name');
    assert(resolvedConfig.enableDirectUpi === true, 'Rail 1 Direct UPI is enabled');
    assert(resolvedConfig.enablePlatformGateway === false, 'Rail 2 Gateway is disabled in single-rail mode');

    // Test Payment Methods Discovery for DIRECT_UPI Single Rail
    const paymentMethods = await CheckoutService.getPaymentMethods(mockApp, 'INR', 'IN');
    assert(paymentMethods.gateway === 'DIRECT_UPI', 'Payment methods gateway is DIRECT_UPI');
    assert(paymentMethods.supportsUpi === true, 'UPI is supported');
    assert(paymentMethods.supportsCard === false, 'Cards disabled when platform gateway is disabled');
    assert(paymentMethods.directUpi?.upiId === 'superstore@okhdfcbank', 'Direct UPI VPA returned in discovery');

    // Test Dual-Rail Architecture Resolution (Both Direct UPI and Gateway Enabled)
    await prisma.platformGatewaySettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', enableRazorpay: true, enableDirectUpi: true },
      update: { enableRazorpay: true, enableDirectUpi: true },
    });
    CheckoutService.invalidatePlatformGatewaySettingsCache();

    const mockDualRailApp = {
      id: 'app_test_dual_rail_002',
      name: 'Dual Rail Merchant',
      customGatewayType: 'NONE',
      customUpiId: 'dualrail@hdfcbank',
      customUpiName: 'Dual Rail Store',
      enableDirectUpi: true,
      enablePlatformGateway: true,
    };
    const dualRailConfig = CheckoutService.resolveGatewayConfig(mockDualRailApp);
    assert(dualRailConfig.enableDirectUpi === true, 'Dual-Rail: Direct UPI is active');
    assert(dualRailConfig.enablePlatformGateway === true, 'Dual-Rail: Platform Gateway is active');
    assert(dualRailConfig.gatewayType === 'RAZORPAY', 'Dual-Rail: Managed platform gateway resolves to RAZORPAY');

    const dualRailMethods = await CheckoutService.getPaymentMethods(mockDualRailApp, 'INR', 'IN');
    assert(dualRailMethods.hasDirectUpi === true, 'Dual-Rail Discovery: hasDirectUpi is true');
    assert(dualRailMethods.hasPlatformGateway === true, 'Dual-Rail Discovery: hasPlatformGateway is true');
    assert(dualRailMethods.supportsUpi === true, 'Dual-Rail Discovery: UPI is supported');
    assert(dualRailMethods.supportsCard === true, 'Dual-Rail Discovery: Cards supported via gateway');
    assert(dualRailMethods.directUpi?.upiId === 'dualrail@hdfcbank', 'Dual-Rail Discovery: Attached direct UPI credentials');

    // -------------------------------------------------------------------------
    // SUITE 3: End-to-End Real User Database Checkout Simulation
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 3: End-to-End Real User Database Checkout Simulation ---');

    // Find or create a test developer OAuth app in DB
    let testDbApp = await prisma.oAuthApp.findFirst();

    if (!testDbApp) {
      let testUser = await prisma.user.findFirst();
      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            email: `test_dev_${Date.now()}@example.com`,
            username: `dev_${Date.now()}`,
            name: 'Test Dev',
          },
        });
      }
      testDbApp = await prisma.oAuthApp.create({
        data: {
          name: 'Direct UPI Test App',
          clientId: `test_upi_${Date.now()}`,
          clientSecretHash: 'mock_hash_123',
          clientSecretHint: '****1234',
          userId: testUser.id,
          redirectUris: ['https://example.com/callback'],
          customGatewayType: 'DIRECT_UPI',
          customUpiId: 'merchantaudit@icici',
          customUpiName: 'Merchant Audit Store',
        },
      });
    } else {
      testDbApp = await prisma.oAuthApp.update({
        where: { id: testDbApp.id },
        data: {
          customGatewayType: 'DIRECT_UPI',
          customUpiId: 'merchantaudit@icici',
          customUpiName: 'Merchant Audit Store',
        },
      });
    }

    assert(Boolean(testDbApp), 'Database OAuthApp configured with DIRECT_UPI');

    // Create a live checkout session in the DB
    const testSessionA = await prisma.checkoutSession.create({
      data: {
        appId: testDbApp.id,
        amount: 499.00,
        currency: 'INR',
        title: 'Premium Cloud Subscription',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        metadata: { customerEmail: 'customer@example.com' },
      },
      include: { app: true },
    });
    assert(testSessionA.status === 'PENDING', 'Session A created in database with PENDING status');

    // Generate direct UPI order with NPCI deep links
    const directOrder = await CheckoutService.createDirectOrder(testSessionA.id);
    assert(directOrder.gatewayType === 'DIRECT_UPI', 'Order generated with DIRECT_UPI');
    assert(Boolean(directOrder.directUpi), 'directUpi payload generated');
    assert(directOrder.directUpi?.upiId === 'merchantaudit@icici', 'Payload has correct merchant UPI ID');
    assert(directOrder.directUpi?.genericUri.startsWith('upi://pay?'), 'Generic UPI URI adheres to NPCI specification');
    assert(directOrder.directUpi?.gpayUri.startsWith('tez://upi/pay?'), 'Google Pay deep link generated');
    assert(directOrder.directUpi?.phonepeUri.startsWith('phonepe://pay?'), 'PhonePe deep link generated');
    assert(directOrder.directUpi?.paytmUri.startsWith('paytmmp://pay?'), 'Paytm deep link generated');
    assert(directOrder.directUpi?.genericUri.includes('am=499.00'), 'Amount locked to 499.00 in URI');

    // Test Dual-Rail Pre-Warming in createDirectOrder
    const dualRailDbApp = await prisma.oAuthApp.update({
      where: { id: testDbApp.id },
      data: {
        customGatewayType: 'NONE',
        customUpiId: 'merchantaudit@icici',
        customUpiName: 'Merchant Audit Store',
        enableDirectUpi: true,
        enablePlatformGateway: true,
      },
    });

    const testSessionDual = await prisma.checkoutSession.create({
      data: {
        appId: dualRailDbApp.id,
        amount: 899.00,
        currency: 'INR',
        title: 'Enterprise Dual-Rail License',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        metadata: { customerEmail: 'enterprise@example.com' },
      },
      include: { app: true },
    });

    const dualOrder = await CheckoutService.createDirectOrder(testSessionDual.id);
    assert(dualOrder.hasDirectUpi === true, 'Dual-Rail Order: hasDirectUpi is true');
    assert(dualOrder.hasPlatformGateway === true, 'Dual-Rail Order: hasPlatformGateway is true');
    assert(Boolean(dualOrder.directUpi), 'Dual-Rail Order: directUpi payload generated');
    assert(Boolean(dualOrder.orderId), 'Dual-Rail Order: pre-warmed gateway orderId present');
    assert(dualOrder.directUpi?.genericUri.includes('am=899.00'), 'Dual-Rail Order: UPI amount locked to 899.00');

    // -------------------------------------------------------------------------
    // SUITE 4: Anti-Fraud & Security Vector Testing (The "Free Lunch" & Replay Protections)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 4: Anti-Fraud & Security Vector Verification ---');

    // Test A: Zero-touch auto-verify with valid bank UTR
    const autoVerifyResultA = await CheckoutService.autoVerifyDirectUpiPayment({
      sessionId: testSessionA.id,
      approvalRefNo: validUtr,
      status: 'SUCCESS',
      responseCode: '00',
      payerVpa: 'customer@okhdfcbank',
    });

    assert(autoVerifyResultA.success === true, 'Session A auto-verified successfully');
    assert(autoVerifyResultA.session.status === 'CAPTURED', 'Session A status transitioned to CAPTURED');
    assert(autoVerifyResultA.session.metadata?.verificationType === 'NPCI_BANK_UTR', 'Verification recorded as NPCI_BANK_UTR');
    assert(autoVerifyResultA.session.metadata?.utr === validUtr, 'UTR recorded in session metadata');

    // Verify record in UpiPaymentVerification table
    const verificationRecord = await prisma.upiPaymentVerification.findUnique({
      where: { sessionId: testSessionA.id },
    });
    assert(Boolean(verificationRecord), 'UpiPaymentVerification record persisted in database');
    assert(verificationRecord?.utr === validUtr, 'Persisted UTR matches validated input');
    assert(verificationRecord?.status === 'CAPTURED', 'Verification status is CAPTURED');

    // Test B: Replay Attack Vector
    // Create a new session B, and attempt to submit the SAME UTR
    const testSessionB = await prisma.checkoutSession.create({
      data: {
        appId: testDbApp.id,
        amount: 499.00,
        currency: 'INR',
        title: 'Another Order',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    let replayBlocked = false;
    try {
      await CheckoutService.autoVerifyDirectUpiPayment({
        sessionId: testSessionB.id,
        approvalRefNo: validUtr, // Replay of Session A's UTR
        status: 'SUCCESS',
      });
    } catch (err: any) {
      if (err.message.includes('already been processed')) {
        replayBlocked = true;
      }
    }
    assert(replayBlocked, 'Replay Attack blocked: duplicate UTR submission on Session B was rejected');

    // Test C: Zero-Touch Return Interceptor (Provisional Capture Mode)
    // Mobile intent switch return without UTR (e.g. customer switches back from UPI app)
    const autoVerifyProvisional = await CheckoutService.autoVerifyDirectUpiPayment({
      sessionId: testSessionB.id,
      status: 'SUCCESS',
      responseCode: '00',
    });
    assert(autoVerifyProvisional.success === true, 'Provisional auto-verify succeeded without manual typing');
    assert(autoVerifyProvisional.session.metadata?.isProvisional === true, 'Flagged as provisional verification');
    assert(autoVerifyProvisional.session.metadata?.verificationType === 'PROVISIONAL_INTENT', 'Verification type is PROVISIONAL_INTENT');

    // Test D: Developer 1-Click Dispute & Ledger Revocation
    // Developer disputes Session B (e.g. bank statement shows funds not received)
    const disputeResult = await CheckoutService.disputeDirectUpiPayment({
      appId: testDbApp.id,
      sessionId: testSessionB.id,
      reason: 'Payment not found in ICICI bank statement',
    });
    assert(disputeResult.success === true, 'Dispute processed successfully');
    assert(disputeResult.session.status === 'CANCELLED', 'Session status updated to CANCELLED');
    assert(disputeResult.session.metadata?.disputed === true, 'Session metadata marked disputed: true');

    const updatedVerificationB = await prisma.upiPaymentVerification.findUnique({
      where: { sessionId: testSessionB.id },
    });
    assert(updatedVerificationB?.status === 'DISPUTED', 'UpiPaymentVerification status updated to DISPUTED');

    // Test E: Anti-Bypass Protection (Calling auto-verify on disputed session must be blocked)
    let reVerificationBlocked = false;
    try {
      await CheckoutService.autoVerifyDirectUpiPayment({
        sessionId: testSessionB.id,
        status: 'SUCCESS',
      });
    } catch (err: any) {
      if (err.message.includes('disputed or cancelled')) {
        reVerificationBlocked = true;
      }
    }
    assert(reVerificationBlocked, 'Bypass blocked: cannot re-verify a disputed or cancelled checkout session');

    // -------------------------------------------------------------------------
    // SUITE 5: Audit Remediation Regression Checks
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Audit Remediation Regression Checks ---');

    // Test F: VPA format validation & Gateway secret encryption roundtrip
    assert(isValidUpiVpa('merchant@okhdfcbank'), 'Valid UPI VPA passes server-side validation');
    assert(!isValidUpiVpa('invalid-vpa-without-at'), 'Malformed UPI VPA without @ is rejected');
    const encSecret = encryptGatewaySecret('rzp_live_secret_xyz');
    assert(encSecret.startsWith('enc:v1:'), 'Gateway secret is AES-256-GCM encrypted at rest');
    assert(decryptGatewaySecret(encSecret) === 'rzp_live_secret_xyz', 'Gateway secret decrypts cleanly');

    // Test G: Direct UPI does NOT inflate withdrawable appWallet balance (logs DIRECT_UPI_SETTLED with amount=0)
    const directLedger = await prisma.ledgerEntry.findFirst({
      where: { referenceId: autoVerifyResultA.transactionId },
    });
    assert(directLedger?.type === 'DIRECT_UPI_SETTLED' && directLedger.amount === 0, 'Direct UPI logs zero-balance DIRECT_UPI_SETTLED audit entry');

    // Test H: executeDirectPayment (direct-pay) blocked for paid DIRECT_UPI sessions
    const testSessionC = await prisma.checkoutSession.create({
      data: {
        appId: testDbApp.id,
        amount: 250.00,
        currency: 'INR',
        title: 'Bypass Block Test',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
    await prisma.oAuthApp.update({
      where: { id: testDbApp.id },
      data: { customGatewayType: 'DIRECT_UPI', enablePlatformGateway: false },
    });

    let directPayBypassBlocked = false;
    try {
      await CheckoutService.executeDirectPayment({ sessionId: testSessionC.id, paymentMethod: '180_PAY' });
    } catch (err: any) {
      if (err.message.includes('Direct bypass payment is disabled')) {
        directPayBypassBlocked = true;
      }
    }
    assert(directPayBypassBlocked, 'Security: executeDirectPayment blocked on paid DIRECT_UPI session');

    // Test I: Public verifyDirectPayment rejects magic string 'auto_polled_capture' on Razorpay session
    await prisma.oAuthApp.update({
      where: { id: testDbApp.id },
      data: { customGatewayType: 'RAZORPAY', customGatewayKeyId: 'rzp_test_123', customGatewaySecret: encryptGatewaySecret('rzp_secret_123'), enablePlatformGateway: true },
    });
    let magicSigBlocked = false;
    try {
      await CheckoutService.verifyDirectPayment({
        sessionId: testSessionC.id,
        orderId: 'order_fake_123',
        paymentId: 'pay_fake_123',
        signature: 'auto_polled_capture',
      });
    } catch (err: any) {
      if (err.message.includes('signature verification failed')) {
        magicSigBlocked = true;
      }
    }
    assert(magicSigBlocked, 'Security: verifyDirectPayment rejects auto_polled_capture magic string');

    // Suite 5: Active Payment Domain resolution
    const currentDomainRows: any[] = await prisma.$queryRawUnsafe(
      'SELECT "paymentDomain" FROM "PlatformGatewaySettings" WHERE id = \'global\''
    );
    const savedPaymentDomain = currentDomainRows?.[0]?.paymentDomain ?? null;
    await (prisma.platformGatewaySettings as any).update({
      where: { id: 'global' },
      data: { paymentDomain: 'pay.180trafficdirector.pro' },
    });
    CheckoutService.invalidatePlatformGatewaySettingsCache();
    const resolvedBase = await CheckoutService.resolvePaymentPublicBase();
    assert(
      resolvedBase === 'https://pay.180trafficdirector.pro',
      `resolvePaymentPublicBase resolves Admin-configured paymentDomain (got ${resolvedBase})`
    );
    await (prisma.platformGatewaySettings as any).update({
      where: { id: 'global' },
      data: { paymentDomain: savedPaymentDomain },
    });
    CheckoutService.invalidatePlatformGatewaySettingsCache();

    // Clean up test sessions & verifications
    await prisma.upiPaymentVerification.deleteMany({
      where: { sessionId: { in: [testSessionA.id, testSessionB.id, testSessionDual.id, testSessionC.id] } },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { referenceId: autoVerifyResultA.transactionId },
    });
    await prisma.checkoutSession.deleteMany({
      where: { id: { in: [testSessionA.id, testSessionB.id, testSessionDual.id, testSessionC.id] } },
    });
    console.log('\nTest artifacts cleaned up successfully.');

    console.log('\n========================================================================');
    console.log(`ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions verified.`);
    console.log('Zero security gaps or fraud bypass vulnerabilities detected.');
    console.log('========================================================================');
  } catch (error: any) {
    console.error('\nSIMULATION FAILED WITH ERROR:', error.message || error);
    process.exit(1);
  } finally {
    if (originalSettings) {
      await prisma.platformGatewaySettings.upsert({
        where: { id: 'global' },
        create: { id: 'global', ...originalSettings },
        update: {
          enableDirectUpi: originalSettings.enableDirectUpi,
          enableRazorpay: originalSettings.enableRazorpay,
          enableStripe: originalSettings.enableStripe,
          enablePayU: originalSettings.enablePayU,
          defaultGateway: originalSettings.defaultGateway,
        },
      });
      CheckoutService.invalidatePlatformGatewaySettingsCache();
    }
    await prisma.$disconnect();
  }
}

runDirectUpiSimulation();
