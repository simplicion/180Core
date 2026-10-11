import crypto from 'crypto';
import { Sovereign180Pay, Sovereign180PayClient } from '../pay-server';

async function main() {
  console.log('--- Testing Phase 11 Developer SDK Server Helpers ---');

  const secret = 'whsec_developer_live_secret_777';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify({
    event: 'coupon.redeemed',
    data: { code: 'WELCOME10', discountAmount: 100 },
  });

  const signPayload = `${timestamp}.${rawBody}`;
  const validSignature = crypto.createHmac('sha256', secret).update(signPayload).digest('hex');

  // 1. Verify Valid Signature
  const isValid = Sovereign180Pay.verifyWebhookSignature({
    rawBody,
    signature: validSignature,
    timestamp,
    secret,
  });

  console.log('SDK Webhook Signature Verification:', isValid ? '✅ PASS' : '❌ FAIL');
  if (!isValid) throw new Error('Valid signature rejected');

  // 2. Client verification helper
  const client = new Sovereign180PayClient({
    clientId: 'test-app-client-id',
    clientSecret: secret,
    baseUrl: 'http://localhost:4003',
  });

  const isClientVerified = client.webhooks.verifySignature({
    rawBody,
    signature: validSignature,
    timestamp,
  });

  console.log('Client Instance Webhook Verification:', isClientVerified ? '✅ PASS' : '❌ FAIL');
  if (!isClientVerified) throw new Error('Client webhook verification failed');

  // 3. Client modules check
  if (!client.coupons || !client.paymentLinks || !client.portal || !client.agents) {
    throw new Error('Client modules missing');
  }

  console.log('✅ Client Modules (coupons, paymentLinks, portal, agents) Initialized Successfully');
  console.log('✅ Phase 11 Developer SDK Server Helpers 100% PASSED!');
}

main().catch((err) => {
  console.error('Phase 11 Test Failed:', err);
  process.exit(1);
});
