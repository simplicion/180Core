/**
 * Utility helper for dynamic deep links into the dedicated 180 Documentation app.
 * Resolves to http://localhost:3005 in local development, and https://docs.180workspace.com in production.
 */
export function getDocsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3005';
    }
  }
  return process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.180workspace.com';
}

export function getDocsUrl(path = '/docs/products/180-core/overview'): string {
  const base = getDocsBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export const DOCS_LINKS = {
  CORE_OVERVIEW: '/docs/products/180-core/overview',
  AI_MASTER_PROMPT: '/docs/products/180-core/ai-master-prompt',
  IDENTITY_QUICKSTART: '/docs/products/180-core/180-identity/getting-started',
  IDENTITY_UNIVERSAL_LOGIN: '/docs/products/180-core/180-identity/universal-login-flow',
  IDENTITY_WHATSAPP_ONE_TAP: '/docs/products/180-core/180-identity/whatsapp-one-tap',
  IDENTITY_TOKEN_LIFECYCLE: '/docs/products/180-core/180-identity/token-lifecycle-and-sessions',
  IDENTITY_SDK_REFERENCE: '/docs/products/180-core/180-identity/sdk-reference',
  IDENTITY_BACKEND_VERIFICATION: '/docs/products/180-core/180-identity/backend-token-verification',
  IDENTITY_WEBHOOKS: '/docs/products/180-core/180-identity/webhook-integration',
  PAY_QUICKSTART: '/docs/products/180-core/180-pay/getting-started',
  PAY_CHECKOUT: '/docs/products/180-core/180-pay/checkout-integration',
  PAY_SUBSCRIPTIONS: '/docs/products/180-core/180-pay/recurring-subscriptions',
  PAY_COUPONS_GEO: '/docs/products/180-core/180-pay/coupons-and-geo-pricing',
  PAY_BYOG: '/docs/products/180-core/180-pay/byog-and-custom-domains',
  PAY_CUSTOMER_PORTAL: '/docs/products/180-core/180-pay/customer-portal',
  PAY_WEBHOOKS: '/docs/products/180-core/180-pay/webhook-integration',
  PAY_PAYOUTS: '/docs/products/180-core/180-pay/payouts-and-settlements',
} as const;
