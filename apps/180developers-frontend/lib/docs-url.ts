/**
 * Utility helper for deep links into 180 Documentation.
 * Routes directly to the internal /docs hub or respects NEXT_PUBLIC_DOCS_URL if configured.
 */
export function getDocsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_DOCS_URL) {
    return process.env.NEXT_PUBLIC_DOCS_URL;
  }
  return '';
}

export function getDocsUrl(path = '/docs'): string {
  const base = getDocsBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

export const DOCS_LINKS = {
  CORE_OVERVIEW: '/docs?section=overview',
  AI_MASTER_PROMPT: '/docs?section=ai-master-prompt',
  IDENTITY_QUICKSTART: '/docs?section=identity-quickstart',
  IDENTITY_UNIVERSAL_LOGIN: '/docs?section=identity-sso',
  IDENTITY_VERIFY: '/docs?section=identity-verify',
  IDENTITY_WHATSAPP_ONE_TAP: '/docs?section=identity-sso',
  IDENTITY_TOKEN_LIFECYCLE: '/docs?section=identity-jwks',
  IDENTITY_SDK_REFERENCE: '/docs?section=identity-sdk',
  IDENTITY_BACKEND_VERIFICATION: '/docs?section=identity-jwks',
  IDENTITY_WEBHOOKS: '/docs?section=pay-webhooks',
  PAY_QUICKSTART: '/docs?section=pay-quickstart',
  PAY_CHECKOUT: '/docs?section=pay-checkout',
  PAY_SUBSCRIPTIONS: '/docs?section=pay-subscriptions',
  PAY_COUPONS_GEO: '/docs?section=pay-ppp',
  PAY_BYOG: '/docs?section=pay-checkout',
  PAY_CUSTOMER_PORTAL: '/docs?section=pay-subscriptions',
  PAY_WEBHOOKS: '/docs?section=pay-webhooks',
  PAY_PAYOUTS: '/docs?section=pay-checkout',
  API_REFERENCE: '/docs?section=api-reference',
} as const;
