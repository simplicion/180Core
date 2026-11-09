/**
 * 180 Verify - provider mode / environment configuration.
 *
 *   VERIFY_PROVIDER_MODE=mock|live    (default: mock when NODE_ENV !== 'production', live in production)
 *   VERIFY_APISETU_MODE / VERIFY_RAZORPAY_MODE  optional per-provider overrides (e.g. go live on
 *                                     Razorpay before the API Setu subscription is approved)
 *   VERIFY_ALLOW_SANDBOX_IN_PRODUCTION=true     explicit opt-in to run mock providers in production
 *
 * Every result is stamped environment:'sandbox' (any provider mocked) or 'live' (all providers live).
 */

export type ProviderMode = 'mock' | 'live';
export type VerifyEnvironment = 'sandbox' | 'live';

function clean(v: string | undefined): string {
  return (v || '').trim().replace(/^['"]|['"]$/g, '');
}

function parseMode(raw: string | undefined, fallback: ProviderMode): ProviderMode {
  const v = clean(raw).toLowerCase();
  if (v === 'mock' || v === 'sandbox') return 'mock';
  if (v === 'live' || v === 'production') return 'live';
  return fallback;
}

type Env = NodeJS.ProcessEnv;

export function isProduction(env: Env = process.env): boolean {
  return clean(env.NODE_ENV).toLowerCase() === 'production';
}

export function getProviderMode(env: Env = process.env): ProviderMode {
  return parseMode(env.VERIFY_PROVIDER_MODE, isProduction(env) ? 'live' : 'mock');
}

export function getApiSetuMode(env: Env = process.env): ProviderMode {
  return parseMode(env.VERIFY_APISETU_MODE, getProviderMode(env));
}

export function getRazorpayMode(env: Env = process.env): ProviderMode {
  return parseMode(env.VERIFY_RAZORPAY_MODE, getProviderMode(env));
}

export function getEnvironment(env: Env = process.env): VerifyEnvironment {
  return getApiSetuMode(env) === 'live' && getRazorpayMode(env) === 'live' ? 'live' : 'sandbox';
}

export function isSandbox(env: Env = process.env): boolean {
  return getEnvironment(env) === 'sandbox';
}

export function requirePassiveAntiSpoof(): boolean {
  const raw = clean(process.env.REQUIRE_PASSIVE_ANTISPOOF).toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return isProduction(); // default: off in dev, on in prod
}

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;
export const MAX_DOC_ATTEMPTS = 5;
export const MAX_BANK_ATTEMPTS = 5;
export const MAX_COMPLETE_ATTEMPTS = 3;
export const MAX_CHALLENGES_PER_SESSION = 10;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_LIVENESS_FRAMES = 6;

/** Built-in sandbox client used by POST /session/demo (sandbox environment only). */
export const SANDBOX_DEMO_CLIENT_ID = '180_verify_sandbox_demo';
export const SANDBOX_DEMO_CLIENT_SECRET = '180_verify_sandbox_demo_secret';
export const SANDBOX_DEMO_APP_NAME = '180 Verify Sandbox';

export function getProfileFrontendUrl(): string {
  return (clean(process.env.PROFILE_FRONTEND_URL) || 'http://localhost:3008').replace(/\/+$/, '');
}

export function getSessionSecret(): string {
  const explicit = clean(process.env.VERIFY_SESSION_SECRET);
  if (explicit) return explicit;
  if (isProduction()) return ''; // must be configured explicitly in production (see assertVerificationConfig)
  return clean(process.env.JWT_SECRET) || 'dev-only-180-verify-session-secret-change-me';
}

export interface ConfigCheck {
  ok: boolean;
  environment: VerifyEnvironment;
  problems: string[];
}

/**
 * Production guard. In production the verification module refuses to serve requests when:
 *  - any provider is in mock mode and VERIFY_ALLOW_SANDBOX_IN_PRODUCTION !== 'true'
 *  - VERIFY_SESSION_SECRET is missing
 *  - a live provider is missing its credentials
 */
export function checkVerificationConfig(env: Env = process.env): ConfigCheck {
  {
    const problems: string[] = [];
    const environment = getEnvironment(env);
    if (isProduction(env)) {
      const allowSandbox = clean(env.VERIFY_ALLOW_SANDBOX_IN_PRODUCTION).toLowerCase() === 'true';
      if (environment === 'sandbox' && !allowSandbox) {
        problems.push(
          'Mock (sandbox) verification providers are active in production. Set VERIFY_PROVIDER_MODE=live, or set VERIFY_ALLOW_SANDBOX_IN_PRODUCTION=true to explicitly allow sandbox results.'
        );
      }
      if (!clean(env.VERIFY_SESSION_SECRET)) {
        problems.push('VERIFY_SESSION_SECRET must be set in production.');
      }
    }
    if (getApiSetuMode(env) === 'live' && (!clean(env.APISETU_CLIENT_ID) || !clean(env.APISETU_API_KEY) || /your_apisetu/i.test(clean(env.APISETU_API_KEY)))) {
      problems.push('API Setu is in live mode but APISETU_CLIENT_ID / APISETU_API_KEY are not configured.');
    }
    if (getRazorpayMode(env) === 'live') {
      if (!clean(env.RAZORPAY_KEY_ID) || !clean(env.RAZORPAY_KEY_SECRET)) {
        problems.push('Razorpay is in live mode but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.');
      }
      if (!clean(env.RAZORPAYX_ACCOUNT_NUMBER)) {
        problems.push('Razorpay is in live mode but RAZORPAYX_ACCOUNT_NUMBER (RazorpayX source account for penny drop) is not configured.');
      }
    }
    return { ok: problems.length === 0, environment, problems };
  }
}
