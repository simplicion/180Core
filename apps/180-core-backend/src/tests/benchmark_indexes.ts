import { developersPrisma as prisma } from '@workspace/db-180core';

async function benchmark() {
  console.log('⚡ Starting Database Index & Execution Benchmark...');

  // 1. Benchmark OAuthApp lookup by customPayDomain + isActive
  const t0 = performance.now();
  const appByDomain = await prisma.oAuthApp.findFirst({
    where: { customPayDomain: 'pay.example.com', isActive: true },
    select: { id: true, name: true, customPayDomain: true, isActive: true },
  });
  const t1 = performance.now();
  console.log(`✓ OAuthApp customPayDomain query: ${(t1 - t0).toFixed(2)}ms (Result: ${appByDomain ? appByDomain.id : 'not found'})`);

  // 2. Benchmark OAuthApp lookup by clientId + isActive
  const t2 = performance.now();
  const appByClientId = await prisma.oAuthApp.findFirst({
    where: { clientId: 'test-client-id', isActive: true },
    select: { id: true, name: true, clientId: true },
  });
  const t3 = performance.now();
  console.log(`✓ OAuthApp clientId query: ${(t3 - t2).toFixed(2)}ms`);

  // 3. Benchmark CheckoutSession query by appId + status + createdAt
  const t4 = performance.now();
  const sessionCheck = await prisma.checkoutSession.findFirst({
    where: {
      status: 'PENDING',
      createdAt: { gte: new Date(Date.now() - 3600000) },
    },
    select: { id: true, status: true, createdAt: true },
  });
  const t5 = performance.now();
  console.log(`✓ CheckoutSession composite query: ${(t5 - t4).toFixed(2)}ms (Found: ${sessionCheck ? sessionCheck.id : 'none'})`);

  console.log('🎉 Index benchmark completed successfully.');
  process.exit(0);
}

benchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
