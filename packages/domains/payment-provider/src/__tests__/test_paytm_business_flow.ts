'use strict';

/**
 * End-to-end flow test for the Paytm for Business connector against an in-memory Prisma stub
 * and a mocked Paytm Transaction Status API. No database or network needed.
 *
 *   npx tsx src/__tests__/test_paytm_business_flow.ts
 */

import Module from 'module';
import path from 'path';

// ---------- In-memory Prisma stub (redirects @workspace/db-180core) ----------
const db = {
  sessions: new Map<string, any>(),
  verifications: new Map<string, any>(),
  apps: new Map<string, any>(),
  ledger: [] as any[],
};
const clone = (o: any) => (o ? JSON.parse(JSON.stringify(o), (_k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v)) : o);
const withApp = (s: any) => (s ? { ...clone(s), app: clone(db.apps.get(s.appId)) } : null);

const stubPrisma: any = {
  checkoutSession: {
    findUnique: async ({ where }: any) => withApp(db.sessions.get(where.id)),
    findMany: async () => [...db.sessions.values()].map(withApp),
    update: async ({ where, data }: any) => {
      const cur = db.sessions.get(where.id);
      if (!cur) throw new Error('not found');
      Object.assign(cur, clone(data));
      return withApp(cur);
    },
  },
  upiPaymentVerification: {
    findUnique: async ({ where }: any) =>
      where.utr ? [...db.verifications.values()].find((v) => v.utr === where.utr) || null : db.verifications.get(where.sessionId) || null,
    upsert: async ({ where, create, update }: any) => {
      if ([...db.verifications.values()].some((v) => v.utr === (update.utr || create.utr) && v.sessionId !== where.sessionId)) {
        const e: any = new Error('Unique constraint');
        e.code = 'P2002';
        throw e;
      }
      const cur = db.verifications.get(where.sessionId);
      const next = cur ? { ...cur, ...update } : { ...create };
      db.verifications.set(where.sessionId, next);
      return next;
    },
  },
  wallet: {
    findUnique: async () => null,
    create: async ({ data }: any) => ({ id: 'w1', balance: 0, ...data }),
  },
  ledgerEntry: { create: async ({ data }: any) => (db.ledger.push(data), data) },
  oAuthApp: { findUnique: async ({ where }: any) => clone(db.apps.get(where.id)) || null, findFirst: async () => null },
  platformGatewaySettings: {
    findUnique: async () => ({
      id: 'global',
      enableDirectUpi: true,
      enableRazorpay: true,
      enableStripe: true,
      enablePayU: true,
      defaultGateway: 'RAZORPAY',
      allowDeveloperByog: true,
    }),
  },
  webhookEndpoint: { findMany: async () => [] },
  $transaction: async (fn: any) => fn(stubPrisma),
};
const stubPath = path.join(__dirname, '__db_stub__.js');
(require as any).cache[stubPath] = {
  id: stubPath,
  filename: stubPath,
  loaded: true,
  exports: { developersPrisma: stubPrisma, corePrisma: stubPrisma, prisma: stubPrisma },
};
const origResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, ...rest: any[]) {
  if (request === '@workspace/db-180core') return stubPath;
  return origResolve.call(this, request, ...rest);
};

// ---------- Paytm API mock ----------
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');
let paytmReply: any = null;
let paytmCalls = 0;
let lastPaytmOrderId = '';
axios.post = async (url: string, body: string) => {
  if (!String(url).includes('paytm')) throw new Error(`unexpected POST ${url}`);
  paytmCalls++;
  lastPaytmOrderId = JSON.parse(body).body.orderId;
  return { data: typeof paytmReply === 'function' ? paytmReply(lastPaytmOrderId) : paytmReply };
};
axios.get = async () => {
  throw new Error('no network in tests');
};

const NO_RECORD = { body: { resultInfo: { resultStatus: 'TXN_FAILURE', resultCode: '334', resultMsg: 'Invalid Order Id.' } } };
const success = (amount: string, rrn = '') => ({
  body: { resultInfo: { resultStatus: 'TXN_SUCCESS', resultCode: '01' }, txnId: `PTMTXN${Date.now()}`, bankTxnId: rrn, txnAmount: amount, paymentMode: 'UPI' },
});
const FAILURE = { body: { resultInfo: { resultStatus: 'TXN_FAILURE', resultCode: '227', resultMsg: 'Payment failed' }, txnId: 'PTMFAIL1' } };

// A UTR-shaped RRN valid "today" (year digit + julian day + 8 digits)
function todayRrn(seq: string) {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const jd = String(Math.floor((now.getTime() - start) / 86400000) + 1).padStart(3, '0');
  return `${String(now.getUTCFullYear()).slice(-1)}${jd}${seq}`;
}

let passed = 0;
let total = 0;
function assert(cond: any, name: string, detail?: any) {
  total++;
  if (!cond) {
    console.error(`[FAIL] ${total}: ${name}`, detail ?? '');
    throw new Error(name);
  }
  passed++;
  console.log(`[PASS] ${total}: ${name}`);
}
async function expectThrow(fn: () => Promise<any>, match: RegExp, name: string) {
  try {
    await fn();
    assert(false, name, 'did not throw');
  } catch (e: any) {
    assert(match.test(e.message), name, e.message);
  }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CheckoutService, encryptGatewaySecret } = require('../checkout/checkout.service');

  const baseApp = {
    clientId: 'cli',
    name: 'Shop',
    allowedOrigins: [],
    redirectUris: [],
    customGatewayWebhookSecret: null,
    customUpiName: 'Shop',
    enableDirectUpi: true,
    enablePlatformGateway: false,
  };
  db.apps.set('app_paytm', {
    ...baseApp,
    id: 'app_paytm',
    customGatewayType: 'PAYTM_BUSINESS',
    customGatewayKeyId: 'TestMid12345678901234',
    customGatewaySecret: encryptGatewaySecret('AbCd1234EfGh5678'),
    customUpiId: 'paytmqr281005050101abc@paytm',
  });
  db.apps.set('app_personal', {
    ...baseApp,
    id: 'app_personal',
    customGatewayType: 'DIRECT_UPI',
    customGatewayKeyId: null,
    customGatewaySecret: null,
    customUpiId: 'someone@okhdfc',
  });
  const mkSession = (id: string, appId: string, amount = 199, expiresInMs = 30 * 60000) =>
    db.sessions.set(id, {
      id,
      appId,
      amount,
      originalAmount: amount,
      currency: 'INR',
      status: 'PENDING',
      mode: 'payment',
      title: 'Order',
      metadata: {},
      returnUrl: 'https://shop.example/done',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInMs),
    });

  // 1. Order creation for a Paytm Business app
  mkSession('sess_a1', 'app_paytm');
  const order = await CheckoutService.createDirectOrder('sess_a1');
  const meta = db.sessions.get('sess_a1').metadata;
  assert(order.gatewayType === 'DIRECT_UPI' && order.directUpi, 'Paytm app routes to Direct UPI rail');
  assert(order.directUpi.qrPayload.includes(`&tr=${meta.paytmOrderId}`), 'QR carries tr=<paytmOrderId>', order.directUpi.qrPayload);
  assert(order.directUpi.qrPayload.includes('pa=paytmqr281005050101abc%40paytm') && order.directUpi.qrPayload.includes('am=199.00'), 'QR pays merchant VPA the exact amount');
  assert(order.directUpi.autoVerification === 'PAYTM_BUSINESS_STATUS_API', 'popup is told auto-verification is Paytm');
  assert(meta.paytmExpectedAmount === 199 && meta.paytmMid === 'TestMid12345678901234', 'order id, amount and MID stored on session');

  // 2. Personal VPA keeps the old behaviour
  mkSession('sess_p1', 'app_personal');
  const pOrder = await CheckoutService.createDirectOrder('sess_p1');
  assert(!pOrder.directUpi.qrPayload.includes('&tr='), 'personal VPA QR has no tr');
  assert(pOrder.directUpi.autoVerification === 'BANK_ALERT_WEBHOOK', 'personal VPA uses bank alerts');
  assert(!db.sessions.get('sess_p1').metadata.paytmOrderId, 'personal VPA session has no Paytm order');

  // 3. Not paid yet -> stays pending
  paytmReply = NO_RECORD;
  await wait(2100);
  let rec = await CheckoutService.reconcileSession('sess_a1');
  assert(!rec.reconciled && db.sessions.get('sess_a1').status === 'PENDING', 'unpaid order stays PENDING');

  // 4. SECURITY: client submits a fake (well-formed) UTR -> must NOT capture
  await expectThrow(
    () => CheckoutService.autoVerifyDirectUpiPayment({ sessionId: 'sess_a1', approvalRefNo: todayRrn('99887766'), status: 'SUCCESS', responseCode: '00' }),
    /not confirmed/i,
    'fake client UTR is rejected for Paytm sessions'
  );
  assert(db.sessions.get('sess_a1').status === 'PENDING', 'session still PENDING after fake UTR');

  // 5. Throttle: two polls inside 2s call Paytm once
  await wait(2100);
  const before = paytmCalls;
  await CheckoutService.reconcileSession('sess_a1');
  await CheckoutService.reconcileSession('sess_a1');
  assert(paytmCalls - before === 1, 'Paytm polled at most once per 2s per session', paytmCalls - before);

  // 6. Paid wrong amount -> not captured
  paytmReply = success('1.00', todayRrn('11112222'));
  await wait(2100);
  rec = await CheckoutService.reconcileSession('sess_a1');
  assert(!rec.reconciled && db.sessions.get('sess_a1').status === 'PENDING', 'amount mismatch is not captured');

  // 7. Paid correct amount -> captured via the status endpoint path
  const rrn = todayRrn('12345678');
  paytmReply = success('199.00', rrn);
  await wait(2100);
  rec = await CheckoutService.reconcileSession('sess_a1');
  const s1 = db.sessions.get('sess_a1');
  assert(rec.reconciled && s1.status === 'CAPTURED', 'TXN_SUCCESS + exact amount captures the session');
  assert(s1.metadata.verificationType === 'PAYTM_BUSINESS_STATUS_API' && s1.metadata.utr === rrn, 'capture records Paytm source and bank RRN');
  assert(db.verifications.get('sess_a1').utr === rrn, 'verification row stores RRN');

  // 8. Idempotent: polling again doesn't double-capture
  const ledgerBefore = db.ledger.length;
  await wait(2100);
  rec = await CheckoutService.reconcileSession('sess_a1');
  assert(rec.alreadyCaptured && db.ledger.length === ledgerBefore, 'already-captured session is not captured twice');

  // 9. Client verify triggers a Paytm check and captures when Paytm says paid
  mkSession('sess_a2', 'app_paytm', 50);
  await CheckoutService.createDirectOrder('sess_a2');
  paytmReply = success('50.00', todayRrn('22223333'));
  const cv = await CheckoutService.autoVerifyDirectUpiPayment({ sessionId: 'sess_a2', status: 'SUCCESS' });
  assert(cv.status === 'CAPTURED' && !cv.isProvisional, 'client verify captures only after Paytm confirms');

  // 10. Same RRN cannot be replayed onto another session
  mkSession('sess_a3', 'app_paytm', 50);
  await CheckoutService.createDirectOrder('sess_a3');
  await expectThrow(
    () => CheckoutService.autoVerifyDirectUpiPayment({ sessionId: 'sess_a3', status: 'SUCCESS' }),
    /already been processed/i,
    'RRN reused for another session is rejected'
  );

  // 11. Non-UTR-shaped bankTxnId falls back to Paytm txnId, still captured
  mkSession('sess_a4', 'app_paytm', 75);
  await CheckoutService.createDirectOrder('sess_a4');
  paytmReply = success('75.00', '');
  await wait(2100);
  rec = await CheckoutService.reconcileSession('sess_a4');
  assert(rec.reconciled && db.sessions.get('sess_a4').metadata.utr.startsWith('PTM_'), 'missing RRN falls back to PTM_<txnId>');

  // 12. Payment finished after expiry still captures (money was received)
  mkSession('sess_a5', 'app_paytm', 20);
  await CheckoutService.createDirectOrder('sess_a5');
  db.sessions.get('sess_a5').expiresAt = new Date(Date.now() - 60000);
  paytmReply = success('20.00', todayRrn('44445555'));
  rec = await CheckoutService.reconcileSession('sess_a5');
  assert(rec.reconciled && db.sessions.get('sess_a5').status === 'CAPTURED', 'late but Paytm-confirmed payment is captured');

  // 13. Failed attempt -> retry gets a fresh order id
  mkSession('sess_a6', 'app_paytm', 30);
  await CheckoutService.createDirectOrder('sess_a6');
  const firstId = db.sessions.get('sess_a6').metadata.paytmOrderId;
  paytmReply = FAILURE;
  rec = await CheckoutService.reconcileSession('sess_a6');
  assert(!rec.reconciled && db.sessions.get('sess_a6').metadata.paytmOrderFailed === true, 'TXN_FAILURE flags the order');
  const retry = await CheckoutService.createDirectOrder('sess_a6');
  const secondId = db.sessions.get('sess_a6').metadata.paytmOrderId;
  assert(secondId !== firstId && secondId.endsWith('R1') && retry.directUpi.qrPayload.includes(`tr=${secondId}`), 'retry QR uses a fresh order id', secondId);
  assert(db.sessions.get('sess_a6').metadata.paytmOrderFailed === false, 'failure flag reset for the new attempt');
  await expectThrow(
    () => CheckoutService.autoVerifyDirectUpiPayment({ sessionId: 'sess_a6', status: 'SUCCESS' }),
    /failed/i,
    'client verify after a failed Paytm payment reports failure'
  );

  // 14. Paytm outage -> no capture, no crash
  mkSession('sess_a7', 'app_paytm', 10);
  await CheckoutService.createDirectOrder('sess_a7');
  paytmReply = () => {
    throw new Error('ECONNRESET');
  };
  rec = await CheckoutService.reconcileSession('sess_a7');
  assert(!rec.reconciled && db.sessions.get('sess_a7').status === 'PENDING', 'Paytm outage leaves session pending without throwing');

  console.log(`\n${passed}/${total} Paytm for Business flow assertions passed.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e?.stack || e);
  process.exit(1);
});
