'use strict';

import assert from 'assert';
import {
    RsaKeysService,
    signIdToken,
    getJwks,
    generateRandomToken,
    hashSecret,
    ISSUER,
} from '@workspace/identity-provider';
import {
    JwksVerifier,
    TokenExchangeClient,
    UserInfoClient,
} from '@workspace/identity-sdk';
import {
    OidcConsumer,
    CompanyResolver,
    WorkspaceSessionService,
} from '@workspace/workspace-auth';

async function runDecouplingSuite() {
    console.log('\n================================================================');
    console.log('  180 PLATFORM: PHASE 1 ARCHITECTURE DECOUPLING & ISOLATION AUDIT');
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

    // ─── 1. Sovereign Identity Provider (@workspace/identity-provider) ───────
    console.log('1. Auditing Sovereign Identity Provider Domain...');

    await test('@workspace/identity-provider initializes RSA keys and exposes RFC 7517 JWKS', async () => {
        await RsaKeysService.ensureKeys();
        const jwks = getJwks();
        assert(Array.isArray(jwks.keys), 'JWKS must return an array of keys');
        assert(jwks.keys.length > 0, 'JWKS must contain at least one public key');
        const key = jwks.keys[0];
        assert.strictEqual(key.kty, 'RSA');
        assert.strictEqual(key.use, 'sig');
        assert.strictEqual(key.alg, 'RS256');
        assert(typeof key.n === 'string' && key.n.length > 0, 'JWK must have modulus n');
        assert(typeof key.e === 'string' && key.e.length > 0, 'JWK must have exponent e');
    });

    let signedIdToken: string = '';
    const testClaims = {
        id: 'usr_decoupled_test_48102',
        sub: 'usr_decoupled_test_48102',
        name: 'Sarah Connor',
        username: 'sarahc',
        email: 'sarah@180workspace.com',
        phone: '+14155552671',
    };

    await test('@workspace/identity-provider mints cryptographically valid RS256 token', () => {
        signedIdToken = signIdToken(testClaims, '180-workspace-platform', '1h');
        assert(typeof signedIdToken === 'string');
        const parts = signedIdToken.split('.');
        assert.strictEqual(parts.length, 3, 'JWT must have 3 dot-separated parts');
    });

    // ─── 2. Zero-Dependency OIDC Client SDK (@workspace/identity-sdk) ─────
    console.log('\n2. Auditing Zero-Dependency Relying Party Client SDK...');

    await test('@workspace/identity-sdk verifies RS256 token against IdP JWKS', async () => {
        const verifier = new JwksVerifier();
        // Seed verifier with public keys from IdP
        verifier.setKeys(getJwks());

        const result = await verifier.verifyToken(signedIdToken, '180-workspace-platform');
        assert.strictEqual(result.valid, true, `Token verification failed: ${result.error}`);
        assert.strictEqual(result.payload?.sub, testClaims.sub);
        assert.strictEqual(result.payload?.email, testClaims.email);
        assert.strictEqual(result.payload?.username, testClaims.username);
    });

    await test('@workspace/identity-sdk rejects forged or tampered token signatures', async () => {
        const verifier = new JwksVerifier();
        verifier.setKeys(getJwks());

        const parts = signedIdToken.split('.');
        // Tamper with signature
        const forgedToken = `${parts[0]}.${parts[1]}.fake_signature_bytes_1234567890`;
        const result = await verifier.verifyToken(forgedToken);
        assert.strictEqual(result.valid, false, 'Forged token must be rejected');
    });

    await test('@workspace/identity-sdk rejects audience mismatch attacks', async () => {
        const verifier = new JwksVerifier();
        verifier.setKeys(getJwks());

        const result = await verifier.verifyToken(signedIdToken, 'malicious-attacker-app');
        assert.strictEqual(result.valid, false, 'Audience mismatch must fail validation');
    });

    // ─── 3. Workspace Tenant Auth (@workspace/workspace-auth) ────────────────
    console.log('\n3. Auditing 180 Workspace Tenant Authentication Domain...');

    await test('@workspace/workspace-auth OidcConsumer validates tokens and configuration', async () => {
        const consumer = new OidcConsumer({
            identityServerUrl: 'http://localhost:4002',
            clientId: '180-workspace-platform',
            redirectUri: 'http://localhost:3000/callback',
        });
        consumer.setJwks(getJwks());

        const verification = await consumer.verifyToken(signedIdToken);
        assert.strictEqual(verification.valid, true);
    });

    await test('@workspace/workspace-auth WorkspaceSessionService mints and verifies sessions', () => {
        const sessionPayload = {
            userId: testClaims.id,
            companyId: 'comp_test_enterprise_99',
            email: testClaims.email,
            role: 'ADMIN',
        };

        const sessionToken = WorkspaceSessionService.mintSessionToken(sessionPayload);
        assert(typeof sessionToken === 'string');

        const verified = WorkspaceSessionService.verifySessionToken(sessionToken);
        assert(verified !== null);
        assert.strictEqual(verified?.userId, testClaims.id);
        assert.strictEqual(verified?.companyId, 'comp_test_enterprise_99');
    });

    await test('@workspace/workspace-auth CompanyResolver handles onboarding routing correctly', async () => {
        const unassignedProfile = {
            id: 'usr_no_company_user_123',
            sub: 'usr_no_company_user_123',
            name: 'New Founder',
            email: 'newfounder@180workspace.com',
        };

        const resolution = await CompanyResolver.resolveTenant(unassignedProfile);
        assert.strictEqual(resolution.hasCompany, false);
        assert.strictEqual(resolution.requiresOnboarding, true);
        assert.strictEqual(resolution.nextRoute, '/workspace-setup');
    });

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n----------------------------------------------------------------');
    console.log(`  RESULTS: ${passedTests} passed, ${failedTests} failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runDecouplingSuite().catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
});
