/**
 * 180 Verify - session flow, mock fixtures, auth, name matching and production guard tests.
 *
 * Run:  cd apps/180-core-backend && npx tsx src/tests/test_verify_session_flow.ts
 *
 * Self-contained: uses the in-memory session store, a fake app directory and a fake biometrics
 * engine, and serves the real verification router over HTTP on an ephemeral port. No database or
 * network access required (DATABASE_URL is stubbed and never connected).
 */

process.env.NODE_ENV = 'test';
process.env.VERIFY_PROVIDER_MODE = 'mock';
process.env.VERIFY_MOCK_LATENCY_MS = '0';
process.env.VERIFY_SESSION_SECRET = 'test-session-secret-0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://stub:stub@127.0.0.1:1/stub';
delete process.env.VERIFY_APISETU_MODE;
delete process.env.VERIFY_RAZORPAY_MODE;

import assert from 'assert';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

import NameMatcherService from '../services/name-matcher.service';
import CrossDocumentValidatorService from '../services/cross-document-validator.service';
import apiSetuService from '../services/apisetu.service';
import razorpayVerificationService from '../services/razorpay-verification.service';
import { checkVerificationConfig } from '../services/verification/config';
import { ProviderUnavailableError } from '../services/verification/errors';
import { InMemorySessionStore, setSessionStore } from '../services/verification/session-store';
import { setBiometricsPort, BiometricsPort } from '../services/verification/biometrics-port';
import { FaceCache } from '../services/verification/face-cache';
import { verifyResultSignature } from '../services/verification/tokens';
import { generateChallengeSteps } from '../services/verification/session.service';
import { gstinCheckChar, validateAadhaar, validateDrivingLicense, validateEpic, validateGstin, validateIfsc, validatePan, validateVpa, verhoeffCheckDigit } from '../services/verification/validators';
import { maskAccount, maskPan } from '../services/verification/pii';
import { hashSecret, setAppDirectory, VerifyApp } from '../middleware/verification-auth.middleware';
import { createVerificationRouter } from '../routes/verification.routes';

// ─── tiny harness ────────────────────────────────────────────────────────────
let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${err?.message || err}`);
  }
}

// ─── fakes ───────────────────────────────────────────────────────────────────
const store = new InMemorySessionStore();
setSessionStore(store);

const APP: VerifyApp = {
  id: 'app_test_1',
  clientId: '180_client_test',
  name: 'Test Lender',
  logoUrl: 'https://example.com/logo.png',
  clientSecretHash: hashSecret('test_secret_1'),
  allowedOrigins: ['https://lender.example.com'],
  redirectUris: ['https://lender.example.com/kyc/callback'],
  isActive: true,
};
const OTHER_APP: VerifyApp = { ...APP, id: 'app_test_2', clientId: '180_client_other', name: 'Other', clientSecretHash: hashSecret('other_secret') };
setAppDirectory({
  async findByClientId(id: string) {
    return [APP, OTHER_APP].find((a) => a.clientId === id) || null;
  },
});

const bio = { liveness: true, antiSpoof: true, verdict: 'APPROVE' as 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT', crossInconsistent: false, badImage: false, unavailable: false, calls: [] as string[] };
const fakeBiometrics: BiometricsPort = {
  async extractFaceFromDocument(image) {
    bio.calls.push('extract');
    if (bio.unavailable) throw Object.assign(new Error('down'), { code: 'BIOMETRICS_ENGINE_UNAVAILABLE' });
    if (bio.badImage) throw Object.assign(new Error('bad image'), { name: 'BiometricsRequestError', status: 400, code: 'IMAGE_DECODE_FAILED' });
    const noFace = image.includes('NOFACE');
    return { hasFace: !noFace, faceCount: noFace ? 0 : 1, faceBase64: noFace ? undefined : 'data:image/jpeg;base64,FACECROP', confidence: 0.99 };
  },
  async evaluateLiveness(frames) {
    bio.calls.push('liveness:' + frames.map((f) => f.step).join(','));
    if (bio.unavailable) throw Object.assign(new Error('down'), { code: 'BIOMETRICS_ENGINE_UNAVAILABLE' });
    return { passed: bio.liveness, score: bio.liveness ? 0.93 : 0.2, antiSpoofApplied: bio.antiSpoof, reasons: bio.liveness ? [] : ['Head turn not detected'], perFrame: [] };
  },
  async matchFaces(_probe, refs) {
    bio.calls.push('match:' + refs.length);
    if (bio.unavailable) throw Object.assign(new Error('down'), { code: 'BIOMETRICS_ENGINE_UNAVAILABLE' });
    const conf = bio.verdict === 'APPROVE' ? 91 : bio.verdict === 'MANUAL_REVIEW' ? 64 : 22;
    return {
      overallConfidence: conf,
      verdict: bio.verdict,
      comparisons: refs.map((r) => ({ documentType: r.docType, similarityScore: conf / 100, confidencePercentage: conf, isMatch: bio.verdict === 'APPROVE', faceFound: true })),
      crossDocument: [],
      overallMatch: bio.verdict === 'APPROVE' || bio.crossInconsistent,
      mismatchReason: bio.crossInconsistent ? 'CROSS_DOCUMENT_INCONSISTENT' : bio.verdict === 'APPROVE' ? undefined : 'Low similarity',
      thresholds: {},
    };
  },
  async health() {
    return { ok: true, models: { detector: true, recognizer: true, antiSpoof: true } };
  },
};
setBiometricsPort(fakeBiometrics);

const IMG = 'data:image/jpeg;base64,' + 'QUJD'.repeat(64);
const IMG_NOFACE = 'data:image/jpeg;base64,' + 'QUJD'.repeat(64) + 'NOFACE';

// ─── HTTP plumbing ───────────────────────────────────────────────────────────
let base = '';
const basic = (id: string, secret: string) => 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
async function call(method: string, path: string, opts: { body?: any; headers?: Record<string, string>; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const r = await fetch(base + path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, body: json };
}

async function newSession(documents: string[], extra: any = {}) {
  const r = await call('POST', '/v/session', { body: { documents, ...extra }, headers: { Authorization: basic(APP.clientId, 'test_secret_1') } });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  return r.body as { sessionId: string; sessionToken: string; verifyUrl: string; expiresAt: string; documents: string[]; environment: string };
}

const ARJUN = { name: 'Arjun Vikram Mehta', dob: '1990-04-12', gender: 'MALE' };

async function completeWithChallenge(s: { sessionId: string; sessionToken: string }, mutate?: (steps: string[]) => string[]) {
  const ch = await call('POST', `/v/session/${s.sessionId}/liveness/challenge`, { token: s.sessionToken });
  assert.strictEqual(ch.status, 200, JSON.stringify(ch.body));
  const steps: string[] = mutate ? mutate(ch.body.steps) : ch.body.steps;
  const now = Date.now();
  const frames = steps.map((step, i) => ({ step, image: IMG, capturedAt: now + i * 500 }));
  const r = await call('POST', `/v/session/${s.sessionId}/complete`, { token: s.sessionToken, body: { challengeId: ch.body.challengeId, selfie: IMG, frames } });
  return { ch, r, frames };
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/v', createVerificationRouter(process.env));
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  console.log('\n[1] Name matching (Indian names)');
  const m = (a: string, b: string) => NameMatcherService.compare(a, b);
  await test('honorifics stripped (Shri / Smt / Kumari / Mr / Dr)', () => {
    assert.ok(m('Shri Ramesh Kumar', 'RAMESH KUMAR').isMatch);
    assert.ok(m('Smt. Priya Iyer', 'PRIYA IYER').isMatch);
    assert.ok(m('Kumari Neha Gupta', 'NEHA GUPTA').isMatch);
    assert.ok(m('Dr. Arjun Mehta', 'Mr Arjun Mehta').isMatch);
  });
  await test('KUMAR / trailing KUMARI kept as name parts', () => {
    assert.strictEqual(NameMatcherService.normalize('PRINCE KUMAR SINGH'), 'PRINCE KUMAR SINGH');
    assert.strictEqual(NameMatcherService.normalize('PRIYA KUMARI'), 'PRIYA KUMARI');
    assert.strictEqual(NameMatcherService.normalize('MRINAL SEN'), 'MRINAL SEN');
  });
  await test('initials: R. KUMAR ~ RAMESH KUMAR; ARJUN V MEHTA ~ ARJUN VIKRAM MEHTA', () => {
    assert.ok(m('R. KUMAR', 'RAMESH KUMAR').isMatch);
    assert.ok(m('ARJUN V MEHTA', 'ARJUN VIKRAM MEHTA').isMatch);
    assert.ok(m('A V MEHTA', 'ARJUN VIKRAM MEHTA').isMatch);
  });
  await test('only initials never match', () => assert.ok(!m('R K', 'RAMESH KUMAR').isMatch));
  await test('token reordering', () => assert.ok(m('SHARMA RAJESH', 'RAJESH SHARMA').score >= 98));
  await test('missing middle name matches', () => assert.ok(m('RAJESH SHARMA', 'RAJESH KUMAR SHARMA').isMatch));
  await test('different first name is a mismatch (RAMESH vs RAJESH, SURESH vs RAMESH)', () => {
    assert.ok(!m('RAMESH KUMAR', 'RAJESH KUMAR').isMatch);
    assert.ok(!m('SURESH KUMAR SHARMA', 'ARJUN VIKRAM MEHTA').isMatch);
  });
  await test('PRIYA vs PRIYANKA is a mismatch', () => assert.ok(!m('PRIYA SHARMA', 'PRIYANKA SHARMA').isMatch));
  await test('single-name record matches at threshold only', () => {
    const r = m('PRIYA', 'PRIYA KUMARI');
    assert.ok(r.isMatch && r.score <= 80 && r.confidence === 'MODERATE');
  });
  await test('transliteration: LAKSHMI/LAXMI, MD/MOHAMMED, joined tokens', () => {
    assert.ok(m('LAKSHMI NARAYAN', 'LAXMI NARAYAN').isMatch);
    assert.ok(m('MD IRFAN KHAN', 'MOHAMMAD IRFAN KHAN').isMatch);
    assert.ok(m('RAMKUMAR SINGH', 'RAM KUMAR SINGH').isMatch);
  });
  await test('relation suffix cut: "RAMESH KUMAR S/O MAHESH"', () => assert.strictEqual(NameMatcherService.normalize('Ramesh Kumar S/O Mahesh'), 'RAMESH KUMAR'));
  await test('father normalizer: S/O LATE SHRI ..., keeps SHRIDHAR', () => {
    assert.strictEqual(CrossDocumentValidatorService.normalizeFatherOrGuardianName('S/O Late Shri Ramesh Iyer'), 'RAMESH IYER');
    assert.strictEqual(CrossDocumentValidatorService.normalizeFatherOrGuardianName('C/O: Shridhar Rao'), 'SHRIDHAR RAO');
    assert.strictEqual(CrossDocumentValidatorService.normalizeFatherOrGuardianName('W/O Mrinal Das'), 'MRINAL DAS');
  });

  console.log('\n[2] DOB normalization & cross-document weighting');
  const nd = (s: string) => CrossDocumentValidatorService.normalizeDob(s);
  await test('DD/MM/YYYY == YYYY-MM-DD == 12 Apr 1990', () => {
    assert.strictEqual(nd('12/04/1990')!.isoString, '1990-04-12');
    assert.strictEqual(nd('1990-04-12')!.isoString, '1990-04-12');
    assert.strictEqual(nd('12-Apr-1990')!.isoString, '1990-04-12');
    assert.strictEqual(nd('12.04.1990')!.isoString, '1990-04-12');
  });
  await test('year-only Aadhaar YOB compares on year', () => {
    assert.ok(nd('YOB: 1990')!.isYearOnly);
    assert.ok(CrossDocumentValidatorService.compareDobs(nd('1990')!, nd('12/04/1990')!).isMatch);
    assert.ok(!CrossDocumentValidatorService.compareDobs(nd('1991')!, nd('12/04/1990')!).isMatch);
  });
  await test('impossible dates and free text are rejected (not coerced to year-only)', () => {
    assert.strictEqual(nd('31/02/1990'), null);
    assert.strictEqual(nd('04/13/1990'), null);
    assert.strictEqual(nd('born sometime in 1990'), null);
  });
  await test('registry-vs-registry conflict is critical; self-declared conflict is review only', () => {
    const crit = CrossDocumentValidatorService.validateDocuments([
      { docType: 'PAN Card', source: 'REGISTRY', name: 'ARJUN VIKRAM MEHTA', dob: '1990-04-12' },
      { docType: 'Driving License', source: 'REGISTRY', name: 'ARJUN VIKRAM MEHTA', dob: '1988-01-01' },
    ]);
    assert.ok(!crit.isValid && crit.criticalMismatches[0].field === 'DOB');
    const rev = CrossDocumentValidatorService.validateDocuments([
      { docType: 'PAN Card', source: 'REGISTRY', name: 'ARJUN VIKRAM MEHTA', dob: '1990-04-12' },
      { docType: 'Aadhaar Card', source: 'SELF_DECLARED', name: 'SOMEONE ELSE', dob: '1990' },
    ]);
    assert.ok(rev.isValid && rev.requiresManualReview);
    assert.strictEqual(rev.primaryIdentity.fullName, 'ARJUN VIKRAM MEHTA'); // registry wins
    assert.strictEqual(rev.primaryIdentity.source, 'REGISTRY');
  });

  console.log('\n[3] Format & checksum validators, PII masking');
  await test('PAN / DL / EPIC / IFSC / VPA', () => {
    assert.ok(validatePan('afzpm4821k').valid && !validatePan('AFZQM4821K').valid && !validatePan('ABC1234567').valid);
    assert.ok(validateDrivingLicense('MH02 2019 0012345').valid && !validateDrivingLicense('12345').valid);
    assert.ok(validateEpic('ZRT1234567').valid && !validateEpic('ZR1234567').valid);
    assert.ok(validateIfsc('HDFC0001234').valid && !validateIfsc('HDFC1001234').valid);
    assert.ok(validateVpa('arjun.mehta@okhdfc').valid && !validateVpa('arjun').valid);
  });
  await test('GSTIN checksum (27AAPFU0939F1ZV known-good)', () => {
    assert.strictEqual(gstinCheckChar('27AAPFU0939F1Z'), 'V');
    assert.ok(validateGstin('27AFZPM4821K1ZQ').valid && !validateGstin('27AFZPM4821K1ZA').valid);
  });
  await test('Aadhaar Verhoeff', () => {
    assert.ok(validateAadhaar('2345 6789 0124').valid);
    assert.ok(!validateAadhaar('234567890125').valid);
    assert.ok(!validateAadhaar('134567890124').valid);
    assert.strictEqual(verhoeffCheckDigit('23456789012'), 4);
  });
  await test('masking: PAN ABXXXXX34F style, account last 4', () => {
    assert.strictEqual(maskPan('ABCDE1234F'), 'ABXXXXX34F');
    assert.strictEqual(maskAccount('100020003000'), 'XXXXXXXX3000');
  });

  console.log('\n[4] Production guard & provider mode');
  await test('mock in production without opt-in refuses to start the module', () => {
    const c = checkVerificationConfig({ NODE_ENV: 'production', VERIFY_PROVIDER_MODE: 'mock', VERIFY_SESSION_SECRET: 'x' } as any);
    assert.ok(!c.ok && c.problems.some((p) => /Mock/.test(p)));
  });
  await test('production defaults to live; missing credentials are reported', () => {
    const c = checkVerificationConfig({ NODE_ENV: 'production', VERIFY_SESSION_SECRET: 'x' } as any);
    assert.strictEqual(c.environment, 'live');
    assert.ok(!c.ok && c.problems.some((p) => /API Setu/.test(p)) && c.problems.some((p) => /RAZORPAYX_ACCOUNT_NUMBER/.test(p)));
  });
  await test('explicit VERIFY_ALLOW_SANDBOX_IN_PRODUCTION=true is allowed and stamped sandbox', () => {
    const c = checkVerificationConfig({ NODE_ENV: 'production', VERIFY_PROVIDER_MODE: 'mock', VERIFY_ALLOW_SANDBOX_IN_PRODUCTION: 'true', VERIFY_SESSION_SECRET: 'x' } as any);
    assert.ok(c.ok && c.environment === 'sandbox');
  });
  await test('misconfigured router answers 503 VERIFY_MODULE_MISCONFIGURED', async () => {
    const a = express();
    a.use(express.json());
    a.use('/p', createVerificationRouter({ NODE_ENV: 'production', VERIFY_PROVIDER_MODE: 'mock' } as any));
    const s = http.createServer(a);
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r()));
    const r = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/p/session/demo`, { method: 'POST' });
    const b: any = await r.json();
    s.close();
    assert.strictEqual(r.status, 503);
    assert.strictEqual(b.error_code, 'VERIFY_MODULE_MISCONFIGURED');
  });
  await test('live mode error throws ProviderUnavailableError (no mock fallback)', async () => {
    const saved = { ...process.env };
    process.env.VERIFY_PROVIDER_MODE = 'live';
    process.env.APISETU_CLIENT_ID = 'com.simplicion';
    process.env.APISETU_API_KEY = 'test';
    process.env.APISETU_BASE_URL = 'http://127.0.0.1:1';
    apiSetuService.reset();
    try {
      await apiSetuService.verifyPan('AFZPM4821K', { name: 'ARJUN VIKRAM MEHTA' });
      assert.fail('expected ProviderUnavailableError');
    } catch (err) {
      assert.ok(err instanceof ProviderUnavailableError, String(err));
    } finally {
      process.env = saved;
      apiSetuService.reset();
    }
  });

  console.log('\n[5] Mock registry fixtures');
  await test('PAN fixture never echoes the caller name', async () => {
    const r = await apiSetuService.verifyPan('AFZPM4821K', { name: 'TOTALLY DIFFERENT PERSON' });
    assert.strictEqual(r.name, 'ARJUN VIKRAM MEHTA');
    assert.strictEqual(r.environment, 'sandbox');
    const mismatch = await apiSetuService.verifyPan('BKDPS7310L', { name: 'ARJUN VIKRAM MEHTA' });
    assert.strictEqual(mismatch.name, 'SURESH KUMAR SHARMA');
  });
  await test('unknown well-formed numbers => NOT_FOUND', async () => {
    assert.strictEqual((await apiSetuService.verifyPan('ABCPZ1234Q')).found, false);
    assert.strictEqual((await apiSetuService.verifyDrivingLicense('UP3220200000001')).found, false);
    assert.strictEqual((await apiSetuService.verifyVoterId('QQQ0000001')).found, false);
    assert.strictEqual((await razorpayVerificationService.validateUpi('nobody@okaxis')).found, false);
    assert.strictEqual((await razorpayVerificationService.verifyBankAccount('123412341234', 'HDFC0001234')).accountStatus, 'INVALID');
  });
  await test('bank registered_name never falls back to an expected name', async () => {
    const r = await razorpayVerificationService.verifyBankAccount('200030004000', 'ICIC0000456', 'ARJUN');
    assert.strictEqual(r.registeredName, 'NEHA RAJESH GUPTA');
    const pending = await razorpayVerificationService.verifyBankAccount('300040005001', 'SBIN0001111');
    assert.strictEqual(pending.accountStatus, 'PENDING');
    assert.strictEqual(pending.registeredName, undefined);
  });
  await test('outage fixture => ProviderUnavailableError', async () => {
    await assert.rejects(() => apiSetuService.verifyPan('ZZZPZ9999Z'), ProviderUnavailableError);
  });
  await test('challenge steps: NEUTRAL + 2 distinct, always one TURN_*', () => {
    for (let i = 0; i < 200; i++) {
      const s = generateChallengeSteps();
      assert.strictEqual(s.length, 3);
      assert.strictEqual(s[0], 'NEUTRAL');
      assert.notStrictEqual(s[1], s[2]);
      assert.ok(s[1].startsWith('TURN_'));
    }
  });

  console.log('\n[6] Authentication');
  await test('B2B endpoint without credentials => 401 envelope', async () => {
    const r = await call('POST', '/v/pan', { body: { panNumber: 'AFZPM4821K' } });
    assert.strictEqual(r.status, 401);
    assert.strictEqual(r.body.status, 'FAILED');
    assert.strictEqual(r.body.error_code, 'CLIENT_AUTH_REQUIRED');
  });
  await test('B2B endpoint with wrong secret => 401 INVALID_CLIENT', async () => {
    const r = await call('POST', '/v/pan', { body: { panNumber: 'AFZPM4821K' }, headers: { Authorization: basic(APP.clientId, 'nope') } });
    assert.strictEqual(r.status, 401);
    assert.strictEqual(r.body.error_code, 'INVALID_CLIENT');
  });
  await test('B2B endpoint with valid credentials returns masked data', async () => {
    const r = await call('POST', '/v/pan', { body: { panNumber: 'AFZPM4821K', name: 'Arjun Mehta' }, headers: { Authorization: basic(APP.clientId, 'test_secret_1') } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.environment, 'sandbox');
    assert.strictEqual(r.body.data.panMasked, 'AFXXXXX21K');
    assert.ok(!JSON.stringify(r.body).includes('ARJUN VIKRAM MEHTA'));
    assert.ok(r.body.data.nameComparison.passed);
  });
  await test('POST /session from unregistered Origin => 403 ORIGIN_NOT_ALLOWED', async () => {
    const r = await call('POST', '/v/session', { body: { clientId: APP.clientId, documents: ['PAN'] }, headers: { Origin: 'https://evil.example.com' } });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.body.error_code, 'ORIGIN_NOT_ALLOWED');
  });
  await test('POST /session from registered Origin => 201 with fragment token', async () => {
    const r = await call('POST', '/v/session', { body: { clientId: APP.clientId, documents: ['PAN', 'FACE_MATCH'] }, headers: { Origin: 'https://lender.example.com' } });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.ok(/\/verify\?session_id=vsess_[0-9a-f]{32}#st=/.test(r.body.verifyUrl));
    assert.strictEqual(r.body.environment, 'sandbox');
  });
  await test('POST /session rejects unregistered redirectUri / parentOrigin', async () => {
    const a = await call('POST', '/v/session', { body: { documents: ['PAN'], redirectUri: 'https://evil.example.com/cb' }, headers: { Authorization: basic(APP.clientId, 'test_secret_1') } });
    assert.strictEqual(a.status, 400);
    const b = await call('POST', '/v/session', { body: { documents: ['PAN'], parentOrigin: 'https://evil.example.com' }, headers: { Authorization: basic(APP.clientId, 'test_secret_1') } });
    assert.strictEqual(b.status, 400);
  });
  await test('session endpoints require the bound session token', async () => {
    const s1 = await newSession(['PAN']);
    const s2 = await newSession(['PAN']);
    assert.strictEqual((await call('GET', `/v/session/${s1.sessionId}/public`)).status, 401);
    assert.strictEqual((await call('GET', `/v/session/${s1.sessionId}/public`, { token: s2.sessionToken })).status, 401);
    assert.strictEqual((await call('GET', `/v/session/${s1.sessionId}/public`, { token: 'garbage' })).status, 401);
    const ok = await call('GET', `/v/session/${s1.sessionId}/public`, { token: s1.sessionToken });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.body.appName, 'Test Lender');
    assert.deepStrictEqual(ok.body.steps.documents.PAN, { status: 'PENDING', faceDetected: false });
  });
  await test('demo session works without auth in sandbox', async () => {
    const r = await call('POST', '/v/session/demo');
    assert.strictEqual(r.status, 201);
    assert.deepStrictEqual(r.body.documents, ['PAN', 'DRIVING_LICENSE', 'VOTER_ID', 'AADHAAR', 'BANK_ACCOUNT', 'FACE_MATCH']);
    const pub = await call('GET', `/v/session/${r.body.sessionId}/public`, { token: r.body.sessionToken });
    assert.strictEqual(pub.body.parentOrigin, null);
    assert.strictEqual(pub.body.appName, '180 Verify Sandbox');
  });

  console.log('\n[7] Full session flow');
  const s = await newSession(['PAN', 'DRIVING_LICENSE', 'VOTER_ID', 'AADHAAR', 'BANK_ACCOUNT', 'FACE_MATCH']);
  const doc = (body: any) => call('POST', `/v/session/${s.sessionId}/documents`, { token: s.sessionToken, body });

  await test('PAN name mismatch fixture => REJECTED DOCUMENT_NAME_MISMATCH', async () => {
    const r = await doc({ docType: 'PAN', number: 'BKDPS7310L', ...ARJUN });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.errors[0].code, 'DOCUMENT_NAME_MISMATCH');
    assert.ok(!r.body.registry.nameMatch.passed);
  });
  await test('suspended PAN => REJECTED DOCUMENT_INVALID', async () => {
    const r = await doc({ docType: 'PAN', number: 'CQRPX5555Z', ...ARJUN });
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.errors[0].code, 'DOCUMENT_INVALID');
  });
  await test('happy PAN (re-submit replaces) => VERIFIED, masked name, face detected', async () => {
    const r = await doc({ docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG });
    assert.strictEqual(r.body.status, 'VERIFIED', JSON.stringify(r.body));
    assert.strictEqual(r.body.faceDetected, true);
    assert.strictEqual(r.body.registry.nameMasked, 'A**** V***** M****');
    assert.strictEqual(r.body.registry.dobMatch, true);
    assert.ok(r.body.registry.nameMatch.passed);
  });
  await test('DL DOB mismatch fixture => DOCUMENT_DOB_MISMATCH', async () => {
    const r = await doc({ docType: 'DRIVING_LICENSE', number: 'KA0120150045678', ...ARJUN });
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.ok(r.body.errors.some((e: any) => e.code === 'DOCUMENT_DOB_MISMATCH'));
  });
  await test('expired DL => DOCUMENT_EXPIRED with validTill', async () => {
    const r = await doc({ docType: 'DRIVING_LICENSE', number: 'DL0420100098765', ...ARJUN });
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.errors[0].code, 'DOCUMENT_EXPIRED');
    assert.strictEqual(r.body.registry.validTill, '2020-06-30');
  });
  await test('happy DL', async () => {
    const r = await doc({ docType: 'DRIVING_LICENSE', number: 'MH0220190012345', ...ARJUN, fatherName: 'S/O Vikram Singh Mehta' });
    assert.strictEqual(r.body.status, 'VERIFIED', JSON.stringify(r.body));
    assert.ok(r.body.registry.fatherMatch.passed);
  });
  await test('voter gender mismatch fixture => DOCUMENT_GENDER_MISMATCH', async () => {
    const r = await doc({ docType: 'VOTER_ID', number: 'GHJ1112223', ...ARJUN });
    assert.strictEqual(r.body.errors[0].code, 'DOCUMENT_GENDER_MISMATCH');
  });
  await test('unknown voter => DOCUMENT_NOT_FOUND', async () => {
    const r = await doc({ docType: 'VOTER_ID', number: 'QQQ0000001', ...ARJUN });
    assert.strictEqual(r.body.errors[0].code, 'DOCUMENT_NOT_FOUND');
  });
  await test('happy voter', async () => {
    const r = await doc({ docType: 'VOTER_ID', number: 'ZRT1234567', ...ARJUN });
    assert.strictEqual(r.body.status, 'VERIFIED');
  });
  await test('invalid Aadhaar checksum => 400; valid => self-declared, last-4 only', async () => {
    const bad = await doc({ docType: 'AADHAAR', number: '234567890125', name: 'Arjun Mehta', dob: '1990-04-12' });
    assert.strictEqual(bad.status, 400);
    const r = await doc({ docType: 'AADHAAR', number: '2345 6789 0124', name: 'Arjun Mehta', dob: '1990-04-12', image: IMG });
    assert.strictEqual(r.body.status, 'VERIFIED', JSON.stringify(r.body));
    assert.strictEqual(r.body.source, 'SELF_DECLARED');
    const row = await store.get(s.sessionId);
    const json = JSON.stringify(row);
    assert.ok(!json.includes('234567890124') && !json.includes('2345 6789 0124'), 'full Aadhaar persisted');
    assert.strictEqual(row!.steps.documents.AADHAAR!.numberMasked, 'XXXX XXXX 0124');
    assert.ok(!json.includes('base64'), 'image persisted');
  });
  await test('oversized image => 413 IMAGE_TOO_LARGE', async () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(Math.ceil((4 * 1024 * 1024 + 10) / 3) * 4);
    const r = await doc({ docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: big });
    assert.strictEqual(r.status, 413);
    assert.strictEqual(r.body.error_code, 'IMAGE_TOO_LARGE');
  });
  await test('bank with different holder => REJECTED BANK_NAME_MISMATCH', async () => {
    const r = await call('POST', `/v/session/${s.sessionId}/bank`, { token: s.sessionToken, body: { mode: 'ACCOUNT', accountNumber: '200030004000', ifsc: 'ICIC0000456' } });
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.errors[0].code, 'BANK_NAME_MISMATCH');
    assert.strictEqual(r.body.registeredNameMasked, 'N*** R***** G****');
  });
  await test('UPI not found => REJECTED UPI_NOT_FOUND', async () => {
    const r = await call('POST', `/v/session/${s.sessionId}/bank`, { token: s.sessionToken, body: { mode: 'UPI', vpa: 'nobody@okaxis' } });
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.errors[0].code, 'UPI_NOT_FOUND');
  });
  await test('happy bank (bank-style initials ARJUN V MEHTA) => VERIFIED', async () => {
    const r = await call('POST', `/v/session/${s.sessionId}/bank`, { token: s.sessionToken, body: { mode: 'ACCOUNT', accountNumber: '100020003000', ifsc: 'HDFC0001234' } });
    assert.strictEqual(r.body.status, 'VERIFIED', JSON.stringify(r.body));
  });
  await test('frames out of challenge order => REJECTED LIVENESS_CHECK_FAILED (retryable)', async () => {
    const { r } = await completeWithChallenge(s, (steps) => [steps[0], steps[2], steps[1]]);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.error_code, 'LIVENESS_CHECK_FAILED');
    assert.strictEqual(r.body.final, false);
    assert.strictEqual(r.body.attemptsRemaining, 2);
  });
  await test('challenge is single-use', async () => {
    const ch = await call('POST', `/v/session/${s.sessionId}/liveness/challenge`, { token: s.sessionToken });
    const frames = ch.body.steps.map((step: string, i: number) => ({ step, image: IMG, capturedAt: Date.now() + i }));
    bio.liveness = false;
    const first = await call('POST', `/v/session/${s.sessionId}/complete`, { token: s.sessionToken, body: { challengeId: ch.body.challengeId, selfie: IMG, frames } });
    bio.liveness = true;
    assert.strictEqual(first.body.error_code, 'LIVENESS_CHECK_FAILED');
    const again = await call('POST', `/v/session/${s.sessionId}/complete`, { token: s.sessionToken, body: { challengeId: ch.body.challengeId, selfie: IMG, frames } });
    assert.strictEqual(again.status, 409);
    assert.strictEqual(again.body.error_code, 'CHALLENGE_INVALID');
  });
  await test('biometrics outage => 503 and the attempt is not consumed', async () => {
    bio.unavailable = true;
    const { r } = await completeWithChallenge(s);
    bio.unavailable = false;
    assert.strictEqual(r.status, 503);
    assert.strictEqual(r.body.error_code, 'BIOMETRICS_ENGINE_UNAVAILABLE');
    assert.strictEqual((await store.get(s.sessionId))!.completeAttempts, 2);
  });
  await test('final attempt passes => APPROVED; frames match challenge; cache purged', async () => {
    const before = bio.calls.length;
    const { r, ch } = await completeWithChallenge(s);
    assert.strictEqual(r.body.status, 'APPROVED', JSON.stringify(r.body));
    assert.strictEqual(r.body.summary.faceMatchConfidence, 91);
    assert.strictEqual(r.body.summary.livenessScore, 0.93);
    assert.strictEqual(r.body.summary.fullNameMasked, 'A**** V***** M****');
    assert.ok(bio.calls.slice(before).includes('liveness:' + ch.body.steps.join(',')));
    assert.ok(bio.calls.slice(before).includes('match:2')); // PAN + Aadhaar crops
    assert.strictEqual(FaceCache.list(s.sessionId).length, 0);
    const again = await call('POST', `/v/session/${s.sessionId}/documents`, { token: s.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN } });
    assert.strictEqual(again.status, 409);
    assert.strictEqual(again.body.error_code, 'SESSION_COMPLETED');
  });
  await test('GET /result: owner only, RS256 JWS with kid/aud/iss/exp, status equals signed status', async () => {
    const other = await call('GET', `/v/session/${s.sessionId}/result`, { headers: { Authorization: basic(OTHER_APP.clientId, 'other_secret') } });
    assert.strictEqual(other.status, 404);
    const none = await call('GET', `/v/session/${s.sessionId}/result`);
    assert.strictEqual(none.status, 401);
    const r = await call('GET', `/v/session/${s.sessionId}/result`, { headers: { Authorization: basic(APP.clientId, 'test_secret_1') } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.status, 'APPROVED');
    const header = jwt.decode(r.body.signature, { complete: true })!.header as any;
    assert.strictEqual(header.alg, 'RS256');
    assert.ok(header.kid);
    const claims: any = verifyResultSignature(r.body.signature, APP.clientId);
    assert.strictEqual(claims.status, r.body.status);
    assert.strictEqual(claims.aud, APP.clientId);
    assert.strictEqual(claims.iss, '180-verify');
    assert.ok(claims.exp > claims.iat);
    assert.strictEqual(claims.sessionId, s.sessionId);
    assert.strictEqual(claims.environment, 'sandbox');
    assert.strictEqual(claims.verifiedProfile.fullName, 'ARJUN VIKRAM MEHTA');
    assert.strictEqual(claims.verifiedProfile.dob, '1990-04-12');
    assert.strictEqual(claims.verifiedProfile.documents.PAN.numberMasked, 'AFXXXXX21K');
    assert.strictEqual(claims.verifiedProfile.documents.AADHAAR.verified, false); // self-declared
    assert.strictEqual(claims.verifiedProfile.bankVerified, true);
    assert.deepStrictEqual({ ...r.body, signature: undefined }, { ...claims, signature: undefined });
  });

  console.log('\n[8] Verdict rules');
  await test('face MANUAL_REVIEW is NOT approved', async () => {
    const t = await newSession(['PAN', 'FACE_MATCH']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG } });
    bio.verdict = 'MANUAL_REVIEW';
    const { r } = await completeWithChallenge(t);
    bio.verdict = 'APPROVE';
    assert.strictEqual(r.body.status, 'MANUAL_REVIEW', JSON.stringify(r.body));
  });
  await test('face REJECT x3 => final REJECTED FACE_MISMATCH_DETECTED', async () => {
    const t = await newSession(['PAN', 'FACE_MATCH']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG } });
    bio.verdict = 'REJECT';
    const a = (await completeWithChallenge(t)).r.body;
    const b = (await completeWithChallenge(t)).r.body;
    const c = (await completeWithChallenge(t)).r.body;
    bio.verdict = 'APPROVE';
    assert.deepStrictEqual([a.final, b.final, c.final], [false, false, true]);
    assert.strictEqual(c.error_code, 'FACE_MISMATCH_DETECTED');
    const ch = await call('POST', `/v/session/${t.sessionId}/liveness/challenge`, { token: t.sessionToken });
    assert.strictEqual(ch.status, 409);
  });
  await test('CROSS_DOCUMENT_INCONSISTENT => MANUAL_REVIEW with FACE_CROSS_DOCUMENT check', async () => {
    const t = await newSession(['PAN', 'DRIVING_LICENSE', 'FACE_MATCH']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG } });
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'DRIVING_LICENSE', number: 'MH0220190012345', ...ARJUN, image: IMG } });
    bio.verdict = 'MANUAL_REVIEW';
    bio.crossInconsistent = true;
    const { r } = await completeWithChallenge(t);
    bio.verdict = 'APPROVE';
    bio.crossInconsistent = false;
    assert.strictEqual(r.body.status, 'MANUAL_REVIEW', JSON.stringify(r.body));
    const c = r.body.summary.checks.find((x: any) => x.id === 'FACE_CROSS_DOCUMENT');
    assert.ok(c && c.passed === false);
  });
  await test('engine BiometricsRequestError => 400 INVALID_IMAGE (not 503)', async () => {
    const t = await newSession(['PAN', 'FACE_MATCH']);
    bio.badImage = true;
    const r = await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG } });
    bio.badImage = false;
    assert.strictEqual(r.status, 400, JSON.stringify(r.body));
    assert.strictEqual(r.body.error_code, 'INVALID_IMAGE');
  });
  await test('FACE_MATCH required: no document face => 409 NO_DOCUMENT_FACE (no attempt used)', async () => {
    const t = await newSession(['PAN', 'FACE_MATCH']);
    const d = await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG_NOFACE } });
    assert.strictEqual(d.body.faceDetected, false);
    const { r } = await completeWithChallenge(t);
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error_code, 'NO_DOCUMENT_FACE');
    assert.strictEqual((await store.get(t.sessionId))!.completeAttempts, 0);
  });
  await test('without FACE_MATCH, faceMatchConfidence is null (never defaulted to 100)', async () => {
    const t = await newSession(['PAN', 'DRIVING_LICENSE']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN } });
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'DRIVING_LICENSE', number: 'MH0220190012345', ...ARJUN } });
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.body.status, 'APPROVED', JSON.stringify(r.body));
    assert.strictEqual(r.body.summary.faceMatchConfidence, null);
  });
  await test('complete before all steps => 409 STEP_INCOMPLETE', async () => {
    const t = await newSession(['PAN', 'BANK_ACCOUNT']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN } });
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error_code, 'STEP_INCOMPLETE');
  });
  await test('rejected document => final REJECTED with its code, result has no profile', async () => {
    const t = await newSession(['PAN']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'BKDPS7310L', ...ARJUN } });
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.body.status, 'REJECTED');
    assert.strictEqual(r.body.error_code, 'DOCUMENT_NAME_MISMATCH');
    assert.strictEqual(r.body.final, true);
    const res = await call('GET', `/v/session/${t.sessionId}/result`, { headers: { Authorization: basic(APP.clientId, 'test_secret_1') } });
    assert.strictEqual(res.body.verifiedProfile, null);
    assert.strictEqual(res.body.error_code, 'DOCUMENT_NAME_MISMATCH');
  });
  await test('Aadhaar-only session can at best be MANUAL_REVIEW', async () => {
    const t = await newSession(['AADHAAR']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'AADHAAR', name: 'Arjun Mehta', dob: '1990-04-12' } });
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.body.status, 'MANUAL_REVIEW', JSON.stringify(r.body));
  });
  await test('strictNameMatching=false: weak name => MANUAL_REVIEW (not APPROVED)', async () => {
    const t = await newSession(['PAN'], { strictNameMatching: false });
    const d = await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'BKDPS7310L', ...ARJUN } });
    assert.strictEqual(d.body.status, 'VERIFIED');
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.body.status, 'MANUAL_REVIEW');
  });
  await test('async penny drop: PENDING then polled to VERIFIED at /complete', async () => {
    const t = await newSession(['PAN', 'BANK_ACCOUNT']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN } });
    const b = await call('POST', `/v/session/${t.sessionId}/bank`, { token: t.sessionToken, body: { mode: 'ACCOUNT', accountNumber: '300040005000', ifsc: 'SBIN0001111' } });
    assert.strictEqual(b.body.status, 'PENDING');
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.body.status, 'APPROVED', JSON.stringify(r.body));
  });
  await test('penny drop never completing => MANUAL_REVIEW', async () => {
    const t = await newSession(['PAN', 'BANK_ACCOUNT']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN } });
    await call('POST', `/v/session/${t.sessionId}/bank`, { token: t.sessionToken, body: { mode: 'ACCOUNT', accountNumber: '300040005001', ifsc: 'SBIN0001111' } });
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: {} });
    assert.strictEqual(r.body.status, 'MANUAL_REVIEW');
  });
  await test('provider outage on a document => 502 PROVIDER_UNAVAILABLE', async () => {
    const t = await newSession(['PAN']);
    const r = await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'ZZZPZ9999Z', ...ARJUN } });
    assert.strictEqual(r.status, 502);
    assert.strictEqual(r.body.error_code, 'PROVIDER_UNAVAILABLE');
  });
  await test('max 5 attempts per document type', async () => {
    const t = await newSession(['PAN']);
    for (let i = 0; i < 5; i++) await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'BKDPS7310L', ...ARJUN } });
    const r = await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN } });
    assert.strictEqual(r.status, 429);
  });
  await test('expired session => 410 SESSION_EXPIRED', async () => {
    const t = await newSession(['PAN']);
    store.rows.get(t.sessionId)!.expiresAt = new Date(Date.now() - 1000);
    const r = await call('GET', `/v/session/${t.sessionId}/public`, { token: t.sessionToken });
    assert.strictEqual(r.status, 410);
    assert.strictEqual(r.body.error_code, 'SESSION_EXPIRED');
  });
  await test('expired challenge => 410 CHALLENGE_EXPIRED', async () => {
    const t = await newSession(['PAN', 'FACE_MATCH']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG } });
    const ch = await call('POST', `/v/session/${t.sessionId}/liveness/challenge`, { token: t.sessionToken });
    store.rows.get(t.sessionId)!.challengeExpiresAt = new Date(Date.now() - 1);
    const frames = ch.body.steps.map((step: string, i: number) => ({ step, image: IMG, capturedAt: i }));
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: { challengeId: ch.body.challengeId, selfie: IMG, frames } });
    assert.strictEqual(r.status, 410);
    assert.strictEqual(r.body.error_code, 'CHALLENGE_EXPIRED');
  });
  await test('more than 6 liveness frames => 400', async () => {
    const t = await newSession(['PAN', 'FACE_MATCH']);
    await call('POST', `/v/session/${t.sessionId}/documents`, { token: t.sessionToken, body: { docType: 'PAN', number: 'AFZPM4821K', ...ARJUN, image: IMG } });
    const ch = await call('POST', `/v/session/${t.sessionId}/liveness/challenge`, { token: t.sessionToken });
    const frames = Array.from({ length: 7 }, (_, i) => ({ step: 'NEUTRAL', image: IMG, capturedAt: i }));
    const r = await call('POST', `/v/session/${t.sessionId}/complete`, { token: t.sessionToken, body: { challengeId: ch.body.challengeId, selfie: IMG, frames } });
    assert.strictEqual(r.status, 400);
  });
  await test('full-kyc (B2B) without selfie: faceMatchConfidence null, registry name used', async () => {
    const r = await call('POST', '/v/full-kyc', {
      headers: { Authorization: basic(APP.clientId, 'test_secret_1') },
      body: { pan: { number: 'AFZPM4821K', name: 'Arjun Mehta', dob: '1990-04-12' }, dl: { number: 'MH0220190012345', name: 'Arjun V Mehta', dob: '12/04/1990' } },
    });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.status, 'APPROVED');
    assert.strictEqual(r.body.verifiedProfile.fullName, 'ARJUN VIKRAM MEHTA');
    assert.strictEqual(r.body.verifiedProfile.faceMatchConfidence, null);
  });
  await test('full-kyc selfie without liveness frames => MANUAL_REVIEW at best', async () => {
    const r = await call('POST', '/v/full-kyc', {
      headers: { Authorization: basic(APP.clientId, 'test_secret_1') },
      body: { pan: { number: 'AFZPM4821K', name: 'Arjun Mehta', imageBase64: IMG }, liveSelfie: IMG },
    });
    assert.strictEqual(r.body.status, 'MANUAL_REVIEW', JSON.stringify(r.body));
  });

  server.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
