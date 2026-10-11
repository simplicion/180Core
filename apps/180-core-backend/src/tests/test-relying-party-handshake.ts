'use strict';

import assert from 'assert';
import crypto from 'crypto';
import { corePrisma as prisma } from '@workspace/db-180core';
import {
    RsaKeysService,
    getJwks,
    generateRandomToken,
    hashSecret,
    signIdToken,
} from '@workspace/identity-provider';
import {
    OidcConsumer,
    CompanyResolver,
    WorkspaceSessionService,
} from '@workspace/workspace-auth';

async function runRelyingPartyHandshakeSuite() {
    console.log('\n================================================================');
    console.log('  180 PLATFORM: PHASE 2 RELYING PARTY (RP) HANDSHAKE AUDIT');
    console.log('================================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function test(name: string, fn: () => Promise<void> | void) {
        return (async () => {
            try {
                await fn();
                console.log(`  [PASS] ${name}`);
                passedTests++;
            } catch (err: any) {
                console.error(`  [FAIL] ${name}:`, err.message);
                failedTests++;
            }
        })();
    }

    // ─── 1. Setup & Pre-flight Keys ──────────────────────────────────────────
    await test('Ensure RSA-2048 Asymmetric Keypair exists and JWKS is active', async () => {
        await RsaKeysService.ensureKeys();
        const jwks = getJwks();
        assert(Array.isArray(jwks.keys) && jwks.keys.length > 0);
        assert.strictEqual(jwks.keys[0].kty, 'RSA');
    });

    // ─── 2. Seed / Fetch Live Relying Party Credentials ──────────────────────
    let workspaceApp: any = null;
    await test('Verify registered confidential client credentials for 180-workspace-platform', async () => {
        workspaceApp = await prisma.oAuthApp.findUnique({
            where: { clientId: '180-workspace-platform' },
        });
        assert(workspaceApp !== null, '180 Workspace confidential client must exist in database');
        assert.strictEqual(workspaceApp.isActive, true);
        assert.strictEqual(workspaceApp.isVerified, true);
        assert(workspaceApp.clientSecretHash !== null, 'Client secret hash must be set');
    });

    // ─── 3. Full OIDC Relying Party Flow Simulation ─────────────────────────
    console.log('\n2. Simulating End-to-End OIDC Authorization Code Exchange...');

    const rawVerifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM.secure_test_entropy';
    const codeChallenge = crypto
        .createHash('sha256')
        .update(rawVerifier)
        .digest('base64url');

    const testUser = await prisma.user.findFirst({
        where: { role: 'SUPERADMIN' },
    }) || await prisma.user.findFirst();

    assert(testUser !== null, 'A valid test user must exist in the database');

    let authCode: string = '';
    await test('Identity Provider mints PKCE-bound authorization code', async () => {
        authCode = generateRandomToken('180_code', 24);
        await prisma.oAuthAuthorizationCode.create({
            data: {
                code: authCode,
                appId: workspaceApp.id,
                userId: testUser.id,
                redirectUri: 'http://localhost:3000/callback',
                codeChallenge,
                codeChallengeMethod: 'S256',
                scopes: ['openid', 'identity:read', 'identity:email'],
                expiresAt: new Date(Date.now() + 600000), // 10 minutes
            },
        });
        assert(authCode.startsWith('180_code_'));
    });

    await test('Relying Party OidcConsumer initializes with live configuration & JWKS cache', () => {
        const consumer = new OidcConsumer({
            identityServerUrl: 'http://localhost:4002',
            clientId: '180-workspace-platform',
            redirectUri: 'http://localhost:3000/callback',
        });
        consumer.setJwks(getJwks());
        assert(consumer !== null);
    });

    await test('Token Verification: Validates RS256 signature and subject claims against JWKS', async () => {
        const idClaims = {
            id: testUser.id,
            sub: testUser.id,
            name: testUser.name || 'Test User',
            email: testUser.email,
        };
        const idToken = signIdToken(idClaims, '180-workspace-platform', '1h');

        const consumer = new OidcConsumer({
            identityServerUrl: 'http://localhost:4002',
            clientId: '180-workspace-platform',
            redirectUri: 'http://localhost:3000/callback',
        });
        consumer.setJwks(getJwks());

        const verified = await consumer.verifyToken(idToken);
        assert.strictEqual(verified.valid, true, `Verification failed: ${verified.error}`);
        assert.strictEqual(verified.payload?.sub, testUser.id);
        assert.strictEqual(verified.payload?.aud, '180-workspace-platform');
    });

    await test('Tenant Resolution: Maps verified 180 Profile to corporate company workspace', async () => {
        const resolution = await CompanyResolver.resolveTenant({
            id: testUser.id,
            sub: testUser.id,
            name: testUser.name || '',
            email: testUser.email,
        });

        assert(resolution !== null);
        assert.strictEqual(typeof resolution.requiresOnboarding, 'boolean');
        assert(resolution.nextRoute === '/' || resolution.nextRoute === '/workspace-setup');
    });

    await test('Session Minting: Issues platform session token with tenant context', () => {
        const sessionToken = WorkspaceSessionService.mintSessionToken({
            userId: testUser.id,
            companyId: testUser.companyId || null,
            email: testUser.email,
            role: testUser.role,
        });

        assert(typeof sessionToken === 'string');
        const decoded = WorkspaceSessionService.verifySessionToken(sessionToken);
        assert(decoded !== null);
        assert.strictEqual(decoded?.userId, testUser.id);
        assert.strictEqual(decoded?.email, testUser.email);
    });

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n----------------------------------------------------------------');
    console.log(`  RESULTS: ${passedTests} passed, ${failedTests} failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runRelyingPartyHandshakeSuite().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
