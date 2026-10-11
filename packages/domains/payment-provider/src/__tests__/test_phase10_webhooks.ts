import { WebhookDispatcherService, WebhookEventType } from '../webhook/webhook-dispatcher.service';

async function main() {
  console.log('--- Testing Phase 10 Webhook Dispatcher & Security Logic ---');

  const testSecret = 'whsec_test_secret_key_987654321';
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const testPayload = {
    event: 'coupon.redeemed' as WebhookEventType,
    data: {
      couponId: 'coup_123',
      code: 'SUMMER50',
      discountAmount: 250,
      sessionId: 'cs_session_456',
      customerEmail: 'buyer@example.com',
    },
    timestamp: new Date().toISOString(),
  };

  const rawBody = JSON.stringify(testPayload);

  // 1. Compute HMAC Signature
  const signature = WebhookDispatcherService.computeSignature(rawBody, timestamp, testSecret);
  console.log('✅ Signature Computed:', signature);

  // 2. Verify Valid Signature
  const isValid = WebhookDispatcherService.verifySignature({
    rawBody,
    signature,
    timestamp,
    secret: testSecret,
    toleranceSeconds: 300,
  });

  console.log('Valid Signature Verification:', isValid ? '✅ PASS' : '❌ FAIL');
  if (!isValid) {
    throw new Error('Valid signature was rejected');
  }

  // 3. Verify Tampered Body is Rejected
  const tamperedBody = JSON.stringify({ ...testPayload, data: { ...testPayload.data, discountAmount: 9999 } });
  const isTamperedValid = WebhookDispatcherService.verifySignature({
    rawBody: tamperedBody,
    signature,
    timestamp,
    secret: testSecret,
  });

  console.log('Tampered Body Rejection:', !isTamperedValid ? '✅ BLOCKED AS EXPECTED' : '❌ FAILED');
  if (isTamperedValid) {
    throw new Error('Tampered payload should have been rejected');
  }

  // 4. Verify Replay Attack Protection (Expired timestamp)
  const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
  const expiredSignature = WebhookDispatcherService.computeSignature(rawBody, expiredTimestamp, testSecret);
  const isExpiredValid = WebhookDispatcherService.verifySignature({
    rawBody,
    signature: expiredSignature,
    timestamp: expiredTimestamp,
    secret: testSecret,
    toleranceSeconds: 300, // 5 min tolerance
  });

  console.log('Replay Window Protection:', !isExpiredValid ? '✅ BLOCKED AS EXPECTED' : '❌ FAILED');
  if (isExpiredValid) {
    throw new Error('Expired timestamp should have been rejected');
  }

  // 5. Test Event Payload Formats for all Phase 10 new event types
  const events: WebhookEventType[] = [
    'coupon.redeemed',
    'payment_link.completed',
    'subscription.cancelled_by_customer',
    'agent.purchase_settled',
  ];

  for (const event of events) {
    const payload = { event, data: { test: true }, timestamp: new Date().toISOString() };
    const sig = WebhookDispatcherService.computeSignature(JSON.stringify(payload), timestamp, testSecret);
    const valid = WebhookDispatcherService.verifySignature({
      rawBody: JSON.stringify(payload),
      signature: sig,
      timestamp,
      secret: testSecret,
    });
    if (!valid) throw new Error(`Verification failed for event: ${event}`);
  }

  console.log('✅ All 4 Event Types Verified Cryptographically');
  console.log('✅ Phase 10 Webhook Dispatcher 100% PASSED!');
}

main().catch((err) => {
  console.error('Phase 10 Test Failed:', err);
  process.exit(1);
});
