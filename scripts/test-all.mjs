import { execSync } from 'child_process';
import path from 'path';

const rootDir = process.cwd();

const testSuites = [
  { name: '180 Core SDK End-to-End Suite', cmd: 'node scripts/test-180-core-sdk-e2e.mjs' },
  { name: 'Dedicated Identity Database & Domain Wiring', cmd: 'npx tsx apps/180-core-backend/src/tests/test-dedicated-identity-db.ts' },
  { name: 'Architecture Decoupling & Isolation Audit', cmd: 'npx tsx apps/180-core-backend/src/tests/test-phase1-decoupling.ts' },
  { name: 'Relying Party (RP) Handshake Audit', cmd: 'npx tsx apps/180-core-backend/src/tests/test-relying-party-handshake.ts' },
  { name: 'Developer Platform & App Management Flow', cmd: 'npx tsx apps/180-core-backend/src/tests/test-developer-portal-flow.ts' },
  { name: 'Phase 7: Coupon & Discount Engine', cmd: 'npx tsx packages/domains/payment-provider/src/__tests__/test_phase7_coupon_api.ts' },
  { name: 'Phase 10: HMAC Webhook Dispatcher', cmd: 'npx tsx packages/domains/payment-provider/src/__tests__/test_phase10_webhooks.ts' },
  { name: 'Phase 11: Developer SDK Server Helpers', cmd: 'npx tsx packages/identity-sdk/src/__tests__/test_phase11_sdk.ts' },
  { name: 'Phase 12: Client Components & Web Components', cmd: 'npx tsx packages/identity-sdk/src/__tests__/test_phase12_components.ts' },
  { name: 'Phase 19: E2E Master Integration Flow', cmd: 'npx tsx apps/180-core-backend/src/tests/test_phase19_e2e_master.ts' },
  { name: 'Phase 24: Production-Grade Master Verification', cmd: 'npx tsx apps/180-core-backend/src/tests/test_phase24_production_master.ts' }
];

console.log('================================================================');
console.log('🚀 180 CORE PLATFORM: COMPREHENSIVE AUTOMATED TEST RUNNER');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

for (const suite of testSuites) {
  console.log(`▶ Running: ${suite.name}...`);
  try {
    execSync(suite.cmd, { cwd: rootDir, stdio: 'inherit' });
    console.log(`✅ [PASS] ${suite.name}\n`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${suite.name}\n`);
    failed++;
  }
}

console.log('================================================================');
console.log(`📊 TEST SUMMARY: ${passed} passed, ${failed} failed (Total: ${testSuites.length})`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL SUITES PASSED! 180 Core platform is 100% verified.');
  process.exit(0);
}
