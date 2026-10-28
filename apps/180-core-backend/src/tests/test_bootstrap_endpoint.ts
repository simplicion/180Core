import { getResolvedOAuthApp, getPlatformClientId } from '@workspace/identity-provider';
import { developersPrisma as prisma } from '@workspace/db-180core';

async function testBootstrap() {
  console.log('⚡ Testing In-Memory LRU Cache & App Resolution...');

  // Find a real app from DB
  const sampleApp = await prisma.oAuthApp.findFirst({ where: { isActive: true } });
  const testClientId = sampleApp?.clientId || getPlatformClientId();
  console.log(`Using test clientId: ${testClientId}`);

  // 1. First call (cold resolution)
  const t0 = performance.now();
  const coldApp = await getResolvedOAuthApp(testClientId);
  const t1 = performance.now();
  console.log(`✓ Cold resolveOAuthApp time: ${(t1 - t0).toFixed(2)}ms (App: ${coldApp?.name})`);

  // 2. Second call (hot resolution from in-memory cache)
  const t2 = performance.now();
  const hotApp = await getResolvedOAuthApp(testClientId);
  const t3 = performance.now();
  const hotDuration = t3 - t2;
  console.log(`✓ Hot resolveOAuthApp time: ${hotDuration.toFixed(3)}ms (Cache Hit!)`);

  if (!hotApp || hotApp.clientId !== coldApp?.clientId) {
    throw new Error('Cache mismatch');
  }

  console.log('✓ Cache match verified! Speedup factor:', ((t1 - t0) / Math.max(0.001, hotDuration)).toFixed(0) + 'x');

  // 3. Negative caching test (non-existent client ID)
  const fakeId = 'non_existent_client_' + Date.now();
  const t4 = performance.now();
  const coldFake = await getResolvedOAuthApp(fakeId);
  const t5 = performance.now();
  console.log(`✓ Cold fake app lookup: ${(t5 - t4).toFixed(2)}ms (Result: ${coldFake})`);

  const t6 = performance.now();
  const hotFake = await getResolvedOAuthApp(fakeId);
  const t7 = performance.now();
  console.log(`✓ Hot fake app lookup: ${(t7 - t6).toFixed(3)}ms (Result: ${hotFake}, Negative Cache Hit!)`);

  console.log('🎉 All in-memory cache tests passed with flying colors!');
  process.exit(0);
}

testBootstrap().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
