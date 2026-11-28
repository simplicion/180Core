'use strict';

import axios from 'axios';
import {
  generatePaytmSignature,
  verifyPaytmSignature,
  fetchPaytmOrderStatus,
  buildPaytmOrderId,
  isValidPaytmMid,
  isValidPaytmMerchantKey,
} from '../checkout/paytm-business';

let passed = 0;
let total = 0;
function assert(condition: boolean, name: string) {
  total++;
  if (!condition) throw new Error(`[FAIL] Test ${total}: ${name}`);
  passed++;
  console.log(`[PASS] Test ${total}: ${name}`);
}

const KEY = 'AbCd1234EfGh5678'; // 16 chars, test-only
const MID = 'TestMid12345678901234';

async function withMockedPost(response: any, fn: (captured: { url?: string; body?: string }) => Promise<void>) {
  const original = axios.post;
  const captured: { url?: string; body?: string } = {};
  (axios as any).post = async (url: string, body: string) => {
    captured.url = url;
    captured.body = body;
    if (response instanceof Error) throw response;
    return { data: response };
  };
  try {
    await fn(captured);
  } finally {
    (axios as any).post = original;
  }
}

async function run() {
  // Validators and order ids
  assert(isValidPaytmMid(MID), 'accepts alphanumeric MID');
  assert(!isValidPaytmMid('bad mid!'), 'rejects malformed MID');
  assert(isValidPaytmMerchantKey(KEY), 'accepts 16-char merchant key');
  assert(!isValidPaytmMerchantKey('short'), 'rejects short merchant key');
  const oid = buildPaytmOrderId('sess_9f2c-41aa-b1c3-0dd2e5f6a7b8');
  assert(/^[A-Za-z0-9]{1,50}$/.test(oid) && oid.startsWith('180P'), 'order id is Paytm-safe and prefixed');
  assert(buildPaytmOrderId('sess_9f2c-41aa-b1c3-0dd2e5f6a7b8') === oid, 'order id is deterministic per session');

  // Checksum: fixed-salt vector is stable, round-trips, and rejects tampering
  const body = JSON.stringify({ mid: MID, orderId: oid });
  const sigA = generatePaytmSignature(body, KEY, 'aB3d');
  assert(sigA === generatePaytmSignature(body, KEY, 'aB3d'), 'signature deterministic for a fixed salt');
  assert(verifyPaytmSignature(body, KEY, sigA), 'signature verifies');
  assert(verifyPaytmSignature(body, KEY, generatePaytmSignature(body, KEY)), 'random-salt signature verifies');
  assert(!verifyPaytmSignature(body + ' ', KEY, sigA), 'tampered body fails verification');
  assert(!verifyPaytmSignature(body, 'ZZZZ1234EfGh5678', sigA), 'wrong key fails verification');

  // Request shape: body is signed exactly as sent
  await withMockedPost({ body: { resultInfo: { resultStatus: 'TXN_SUCCESS', resultCode: '01' }, txnId: 'T1', bankTxnId: '633212345678', txnAmount: '199.00' } }, async (cap) => {
    const r = await fetchPaytmOrderStatus({ mid: MID, merchantKey: KEY, orderId: oid });
    const sent = JSON.parse(cap.body!);
    assert(cap.url === 'https://securegw.paytm.in/v3/order/status', 'calls production status endpoint');
    assert(verifyPaytmSignature(JSON.stringify(sent.body), KEY, sent.head.signature), 'sent signature matches sent body');
    assert(r.status === 'TXN_SUCCESS' && r.txnAmount === 199 && r.bankTxnId === '633212345678', 'maps TXN_SUCCESS with amount and RRN');
  });

  const cases: Array<[any, string, string]> = [
    [{ body: { resultInfo: { resultStatus: 'PENDING', resultCode: '402' } } }, 'PENDING', 'maps PENDING'],
    [{ body: { resultInfo: { resultStatus: 'TXN_FAILURE', resultCode: '334', resultMsg: 'Invalid Order Id.' } } }, 'NO_RECORD', 'maps unknown order to NO_RECORD'],
    [{ body: { resultInfo: { resultStatus: 'TXN_FAILURE', resultCode: '330', resultMsg: 'Paytm checksum mismatch.' } } }, 'ERROR', 'checksum mismatch is a config ERROR, not a failed payment'],
    [{ body: { resultInfo: { resultStatus: 'TXN_FAILURE', resultCode: '335', resultMsg: 'Mid is invalid' } } }, 'ERROR', 'invalid MID is a config ERROR'],
    [{ body: { resultInfo: { resultStatus: 'TXN_FAILURE', resultCode: '227' }, txnId: 'T2' } }, 'TXN_FAILURE', 'maps genuine payment failure'],
    [new Error('timeout'), 'ERROR', 'network failure becomes ERROR without throwing'],
  ];
  for (const [resp, expected, name] of cases) {
    await withMockedPost(resp, async () => {
      const r = await fetchPaytmOrderStatus({ mid: MID, merchantKey: KEY, orderId: oid });
      assert(r.status === expected, name);
    });
  }

  console.log(`\n${passed}/${total} Paytm for Business connector assertions passed.`);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
