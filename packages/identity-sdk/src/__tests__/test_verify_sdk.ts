/**
 * 180 Verify SDK tests (run: npx tsx packages/identity-sdk/src/__tests__/test_verify_sdk.ts)
 *  - postMessage filtering: origin + source + sessionId (TS module and vanilla UMD bundle)
 *  - outcome mapping (APPROVED / MANUAL_REVIEW → success, REJECTED → VERIFICATION_REJECTED)
 *  - server helpers: Basic auth, JWS verification via JwksVerifier, fail-closed checks
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { filterVerifyMessage, resolveVerifyOutcome, getVerifyOrigin, startVerification, validateVerifyDocuments } from '../verify-client';
import {
  createJwksSignatureVerifier,
  createVerificationSession,
  fetchVerificationResult,
  VerificationSignatureError,
} from '../verify-server';
import { JwksVerifier } from '../jwks-verifier';
import { use180Verify, OneEightyVerify, OneEighty } from '../index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vanilla: any = require('../180-core-sdk.js');

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`❌ FAIL: ${msg}`);
  passed++;
  console.log(`  ✅ ${msg}`);
}
async function assertRejects(p: Promise<unknown>, code: string, msg: string) {
  try {
    await p;
  } catch (err: any) {
    assert(err?.code === code, `${msg} (code ${err?.code})`);
    return;
  }
  throw new Error(`❌ FAIL: ${msg} (did not throw)`);
}

function messageFilterSuite(name: string, filter: (event: any, ctx: any) => any) {
  console.log(`\n--- postMessage filter: ${name} ---`);
  const iframeWindow = { id: 'iframe-window' };
  const otherWindow = { id: 'other-window' };
  const ctx = { expectedOrigin: 'https://profile.180core.cloud', sessionId: 'vs_abc123', iframeWindow };
  const good = { origin: ctx.expectedOrigin, source: iframeWindow };

  const ok = filter({ ...good, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED' } }, ctx);
  assert(ok && ok.type === '180_VERIFY_COMPLETE' && ok.status === 'APPROVED', 'accepts valid COMPLETE');

  assert(
    filter({ origin: 'https://evil.example', source: iframeWindow, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED' } }, ctx) === null,
    'rejects wrong origin'
  );
  assert(
    filter({ origin: 'https://profile.180core.cloud.evil.example', source: iframeWindow, data: { type: '180_VERIFY_READY', sessionId: 'vs_abc123' } }, ctx) === null,
    'rejects look-alike origin'
  );
  assert(
    filter({ origin: ctx.expectedOrigin, source: otherWindow, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED' } }, ctx) === null,
    'rejects message from another window on the same origin'
  );
  assert(
    filter({ origin: ctx.expectedOrigin, source: null, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED' } }, ctx) === null,
    'rejects null source'
  );
  assert(
    filter({ ...good, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_other', status: 'APPROVED' } }, ctx) === null,
    'rejects mismatched sessionId'
  );
  assert(filter({ ...good, data: { type: '180_VERIFY_COMPLETE', status: 'APPROVED' } }, ctx) === null, 'rejects missing sessionId');
  assert(filter({ ...good, data: JSON.stringify({ type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED' }) }, ctx) === null, 'rejects string payloads');
  assert(filter({ ...good, data: { type: '180_PAY_SUCCESS', sessionId: 'vs_abc123' } }, ctx) === null, 'rejects unrelated message types');
  assert(filter({ ...good, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123' } }, ctx) === null, 'rejects COMPLETE without status');
  assert(
    filter({ ...good, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED' } }, { ...ctx, iframeWindow: null }) === null,
    'rejects when iframe window is gone'
  );

  const pii = filter({ ...good, data: { type: '180_VERIFY_COMPLETE', sessionId: 'vs_abc123', status: 'APPROVED', fullName: 'X', pan: 'ABCDE1234F' } }, ctx);
  assert(pii && Object.keys(pii).sort().join(',') === 'sessionId,status,type', 'copies only whitelisted fields (no PII passthrough)');

  const err = filter({ ...good, data: { type: '180_VERIFY_ERROR', sessionId: 'vs_abc123' } }, ctx);
  assert(err && err.code === 'VERIFICATION_ERROR', 'ERROR without code gets default code');
  assert(filter({ ...good, data: { type: '180_VERIFY_READY', sessionId: 'vs_abc123' } }, ctx)?.type === '180_VERIFY_READY', 'accepts READY');
  assert(filter({ ...good, data: { type: '180_VERIFY_CLOSE', sessionId: 'vs_abc123' } }, ctx)?.type === '180_VERIFY_CLOSE', 'accepts CLOSE');
}

function outcomeSuite(name: string, resolve: (msg: any) => any) {
  console.log(`\n--- outcome mapping: ${name} ---`);
  const approved = resolve({ type: '180_VERIFY_COMPLETE', sessionId: 's', status: 'APPROVED' });
  assert(approved.kind === 'success' && approved.result.status === 'APPROVED' && approved.result.sessionId === 's', 'APPROVED → success');
  const review = resolve({ type: '180_VERIFY_COMPLETE', sessionId: 's', status: 'MANUAL_REVIEW' });
  assert(review.kind === 'success' && review.result.status === 'MANUAL_REVIEW', 'MANUAL_REVIEW → success');
  const rejected = resolve({ type: '180_VERIFY_COMPLETE', sessionId: 's', status: 'REJECTED' });
  assert(rejected.kind === 'error' && rejected.error.code === 'VERIFICATION_REJECTED', 'REJECTED → onError VERIFICATION_REJECTED');
  const expired = resolve({ type: '180_VERIFY_COMPLETE', sessionId: 's', status: 'EXPIRED' });
  assert(expired.kind === 'error' && expired.error.code === 'VERIFICATION_FAILED', 'other status → VERIFICATION_FAILED');
  assert(resolve({ type: '180_VERIFY_CLOSE', sessionId: 's' }).kind === 'close', 'CLOSE → close');
  assert(resolve({ type: '180_VERIFY_ERROR', sessionId: 's', code: 'CAMERA_DENIED' }).error.code === 'CAMERA_DENIED', 'ERROR keeps code');
}

async function serverSuite() {
  console.log('\n--- server helpers ---');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' }) as any;
  const jwksVerifier = new JwksVerifier('http://127.0.0.1:1/never-fetched');
  jwksVerifier.setKeys({ keys: [{ kty: 'RSA', use: 'sig', alg: 'RS256', kid: 'k1', n: jwk.n, e: jwk.e }] });
  const signatureVerifier = createJwksSignatureVerifier({ jwksVerifier });

  const profile = {
    fullName: 'ASHA KUMARI',
    dob: '1990-01-01',
    documents: { PAN: { verified: true, numberMasked: 'XXXXX1234X' } },
    bankVerified: true,
    faceMatchConfidence: 97,
    livenessScore: 0.98,
    verifiedAt: '2026-11-10T00:00:00Z',
  };
  const sign = (claims: object, key: crypto.KeyObject = privateKey) =>
    jwt.sign(claims, key.export({ format: 'pem', type: 'pkcs8' }) as string, { algorithm: 'RS256', keyid: 'k1' });

  const calls: { url: string; init: any }[] = [];
  const mockFetch = (body: any, status = 200) =>
    (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
    }) as typeof fetch;

  const goodClaims = { sessionId: 'vs_1', status: 'APPROVED', verifiedProfile: profile, environment: 'sandbox', aud: '180_client_x' };
  const goodBody = { sessionId: 'vs_1', status: 'APPROVED', verifiedProfile: profile, environment: 'sandbox', signature: sign(goodClaims) };
  const base = { sessionId: 'vs_1', clientId: '180_client_x', clientSecret: 'shh', apiBaseUrl: 'https://api.test/', signatureVerifier };

  const res = await fetchVerificationResult({ ...base, fetchImpl: mockFetch(goodBody) });
  assert(res.status === 'APPROVED' && res.verifiedProfile?.fullName === 'ASHA KUMARI', 'valid signed result is returned');
  const last = calls[calls.length - 1];
  assert(last.url === 'https://api.test/api/v1/identity/verify/session/vs_1/result', 'calls GET /session/:id/result');
  assert(
    last.init.headers.Authorization === `Basic ${Buffer.from('180_client_x:shh').toString('base64')}`,
    'uses Basic clientId:clientSecret auth'
  );

  const { privateKey: attackerKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ ...goodBody, signature: sign(goodClaims, attackerKey) }) }),
    'SIGNATURE_INVALID',
    'rejects signature from a different key'
  );
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ ...goodBody, signature: undefined }) }),
    'SIGNATURE_MISSING',
    'rejects missing signature'
  );
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ ...goodBody, sessionId: undefined, signature: sign({ ...goodClaims, sessionId: 'vs_2' }) }) }),
    'SIGNATURE_SESSION_MISMATCH',
    'rejects signature for another session'
  );
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ ...goodBody, signature: sign({ ...goodClaims, aud: '180_client_other' }) }) }),
    'SIGNATURE_AUDIENCE_MISMATCH',
    'rejects signature issued to another client'
  );
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ ...goodBody, status: 'APPROVED', signature: sign({ ...goodClaims, status: 'REJECTED' }) }) }),
    'SIGNATURE_PAYLOAD_MISMATCH',
    'rejects unsigned status that disagrees with signed status'
  );
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ ...goodBody, signature: sign({ ...goodClaims, verifiedProfile: undefined }) }) }),
    'SIGNED_CLAIMS_INCOMPLETE',
    'rejects APPROVED result whose profile is not signed'
  );
  await assertRejects(
    fetchVerificationResult({ ...base, fetchImpl: mockFetch({ error: 'unauthorized', message: 'bad secret' }, 401) }),
    'unauthorized',
    'surfaces API errors'
  );
  assert(new VerificationSignatureError('X', 'y').name === 'VerificationSignatureError', 'error classes exported');

  const session = await createVerificationSession({
    clientId: '180_client_x',
    clientSecret: 'shh',
    documents: ['PAN', 'FACE_MATCH'],
    strictNameMatching: true,
    parentOrigin: 'https://app.example',
    apiBaseUrl: 'https://api.test',
    fetchImpl: mockFetch({ sessionId: 'vs_9', sessionToken: 't', verifyUrl: 'https://profile.test/verify/vs_9', expiresAt: 'x', documents: ['PAN'], environment: 'sandbox' }, 201),
  });
  const c = calls[calls.length - 1];
  const sent = JSON.parse(c.init.body);
  assert(session.sessionId === 'vs_9' && c.url === 'https://api.test/api/v1/identity/verify/session' && c.init.method === 'POST', 'createVerificationSession POSTs /session');
  assert(sent.strictNameMatching === true && sent.parentOrigin === 'https://app.example' && c.init.headers.Authorization.startsWith('Basic '), 'createVerificationSession sends body + Basic auth');
}

async function main() {
  console.log('=== 180 Verify SDK tests ===');
  messageFilterSuite('verify-client.ts', filterVerifyMessage);
  messageFilterSuite('180-core-sdk.js (vanilla)', vanilla.OneEightyVerify._internal.filterMessage);
  outcomeSuite('verify-client.ts', resolveVerifyOutcome);
  outcomeSuite('180-core-sdk.js (vanilla)', vanilla.OneEightyVerify._internal.resolveOutcome);

  console.log('\n--- misc ---');
  assert(getVerifyOrigin('https://profile.180core.cloud/verify/s?x=1') === 'https://profile.180core.cloud', 'origin derived from verifyUrl');
  assert(getVerifyOrigin('http://localhost:3009/verify') === 'http://localhost:3009', 'http allowed on localhost');
  let threw = 0;
  for (const bad of ['javascript:alert(1)', 'http://profile.180core.cloud/verify', 'data:text/html,hi']) {
    try {
      getVerifyOrigin(bad);
    } catch {
      threw++;
    }
  }
  assert(threw === 3, 'insecure verifyUrl schemes are refused');
  try {
    vanilla.OneEightyVerify._internal.originOf('javascript:alert(1)');
    assert(false, 'vanilla refuses javascript: verifyUrl');
  } catch {
    assert(true, 'vanilla refuses javascript: verifyUrl');
  }
  assert(validateVerifyDocuments(['PAN', 'UPI'])?.code === 'INVALID_DOCUMENTS', 'unknown document types rejected');
  assert(validateVerifyDocuments([]) !== null && validateVerifyDocuments(['PAN', 'FACE_MATCH']) === null, 'document validation');

  let ssrError: any = null;
  const ctrl = startVerification({ clientId: 'c', documents: ['PAN'], apiBaseUrl: 'https://api.test', onError: (e) => (ssrError = e) });
  assert((await ctrl.promise) === null && ssrError?.code === 'BROWSER_ONLY', 'SSR-safe: launching on the server reports BROWSER_ONLY');

  assert(typeof use180Verify === 'function', 'use180Verify exported');
  assert(typeof OneEightyVerify === 'function' && typeof OneEightyVerify.launch === 'function', 'OneEightyVerify component + .launch exported');
  assert((OneEighty as any).verify === OneEightyVerify, 'OneEighty.verify namespace wired');
  assert(typeof vanilla.OneEightyVerify.launch === 'function' && vanilla.OneEighty.verify === vanilla.OneEightyVerify, 'vanilla bundle exposes OneEightyVerify');

  await serverSuite();

  console.log(`\n✅ 180 Verify SDK tests PASSED (${passed} assertions)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
