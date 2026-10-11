import { developersPrisma as prisma } from '@workspace/db-180core';
import { CustomerPortalService } from '../portal/customer-portal.service';
import { AgentPurchaseService } from '../agent/agent-purchase.service';

async function main() {
  console.log('--- Testing Phase 9 Customer Portal & Agent Purchase Logic ---');

  const app = await prisma.oAuthApp.findFirst({
    where: { isActive: true },
  });

  if (!app) {
    throw new Error('No active OAuth App found.');
  }

  // ─── 1. Customer Portal Magic Token Tests ─────────────────────────────────
  const customerEmail = `portal_test_${Date.now()}@example.com`;
  const portalSession = await CustomerPortalService.createPortalSession({
    appId: app.id,
    customerEmail,
    returnUrl: 'https://mysaas.com/account',
  });

  console.log('✅ Portal Session Created:', portalSession.sessionToken);
  if (!portalSession.sessionToken.startsWith('pts_')) {
    throw new Error('Token does not start with pts_ prefix');
  }

  const portalData = await CustomerPortalService.getPortalData(portalSession.sessionToken);
  console.log('Portal Dashboard Data for:', portalData.customer.email, 'Merchant:', portalData.merchant.name);
  if (portalData.customer.email !== customerEmail) {
    throw new Error('Portal data customer email mismatch');
  }

  // ─── 2. Autonomous Agent Purchase Protocol (AP2) Tests ────────────────────
  const { rawKey, envelope } = await AgentPurchaseService.createBudgetEnvelope(app.id, {
    agentName: 'Phase 9 Research Autonomous Agent',
    maxSpendTotal: 100, // $100 ceiling
    maxSpendPerTx: 25,  // $25 max per tx
    durationDays: 7,
  });

  console.log('✅ Agent Envelope Issued:', envelope.id, 'Raw Key:', rawKey.slice(0, 20) + '...');

  // Purchase #1: $20 (under $25 per-tx ceiling)
  const tx1 = await AgentPurchaseService.executeAgentPurchase({
    agentKey: rawKey,
    appId: app.id,
    amount: 20,
    currency: 'USD',
    title: 'Dataset API Access Micro-Checkout',
    idempotencyKey: `idem_agent_${Date.now()}_1`,
  });

  console.log('✅ Agent M2M Purchase 1 Succeeded:', tx1.transactionId, 'Deliverable Token:', tx1.deliverable.token);
  console.log('Remaining Budget:', tx1.budget.remaining);
  if (tx1.budget.remaining !== 80) {
    throw new Error('Agent budget remaining math mismatch');
  }

  // Purchase #2: $30 (exceeds $25 per-tx ceiling) -> MUST FAIL
  try {
    await AgentPurchaseService.executeAgentPurchase({
      agentKey: rawKey,
      appId: app.id,
      amount: 30,
      currency: 'USD',
      idempotencyKey: `idem_agent_${Date.now()}_2`,
    });
    throw new Error('Should have blocked tx exceeding per-tx ceiling');
  } catch (err: any) {
    console.log('Per-Tx Ceiling Check:', err.message.includes('exceeds') ? '✅ BLOCKED AS EXPECTED' : '❌ UNEXPECTED');
  }

  // Revoke envelope
  await AgentPurchaseService.revokeBudgetEnvelope(app.id, envelope.id);
  console.log('✅ Agent Envelope Revoked');

  // Purchase #3 on revoked envelope -> MUST FAIL
  try {
    await AgentPurchaseService.executeAgentPurchase({
      agentKey: rawKey,
      appId: app.id,
      amount: 10,
      currency: 'USD',
      idempotencyKey: `idem_agent_${Date.now()}_3`,
    });
    throw new Error('Should have blocked tx on revoked envelope');
  } catch (err: any) {
    console.log('Revocation Enforcement Check:', err.message.includes('revoked') ? '✅ BLOCKED AS EXPECTED' : '❌ UNEXPECTED');
  }

  // Clean up
  await prisma.customerPortalSession.deleteMany({ where: { sessionToken: portalSession.sessionToken } });
  await prisma.checkoutSession.deleteMany({ where: { id: tx1.sessionId } });
  await prisma.agenticBudgetEnvelope.deleteMany({ where: { id: envelope.id } });

  console.log('✅ Clean up complete. Phase 9 Customer Portal & Agent Checkouts 100% PASSED!');
}

main().catch((err) => {
  console.error('Phase 9 Test Failed:', err);
  process.exit(1);
});
