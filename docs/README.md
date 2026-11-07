# 180 Core Technical Documentation & Architecture Blueprints

Welcome to the sovereign developer and infrastructure documentation for **180 Core** (`180core.cloud`).

180 Core provides the cryptographic identity kernel (RFC 7636 OAuth 2.0 PKCE, WhatsApp OTP authentication, Passkeys), high-speed fintech payment rails (180 Pay, flat 0.8% UPI settlement, BYOG fallback cascade), developer SDKs, and webhook infrastructure for the 180 ecosystem.

---

## Documentation Structure

### 1. [Overview & Core Architecture](01-overview.md)
Foundational architecture of 180 Core, system boundaries, security models, microservices topology, and RS256 JWKS token validation.

### 2. [Master AI Integration Prompt](02-ai-master-prompt.md)
The production-grade, 1-click instruction blueprint for AI agents and coding assistants to integrate 180 Identity and 180 Pay into client applications in under 5 minutes.

---

## Sub-Modules & Developer Guides

### 180 Identity (`docs/180-identity/`)
- [01. Quickstart & Architecture](180-identity/01-getting-started.md): Installation, environment configuration, and initialization.
- [02. Universal Login & UX Modes](180-identity/02-universal-login-flow.md): Modal bottom-sheet, redirect mode, and pop-up UX.
- [03. WhatsApp 1-Tap OTP Authentication](180-identity/03-whatsapp-one-tap.md): 99.2% deliverability via WhatsApp Business API without SMS carrier drops.
- [04. Token Lifecycle & Sessions](180-identity/04-token-lifecycle-and-sessions.md): RS256 JWT access tokens, rotating refresh tokens, and cross-domain logout.
- [05. SDK Reference](180-identity/05-sdk-reference.md): Complete `@180core/identity` TypeScript/JavaScript API methods and event handlers.
- [06. Backend Token Verification](180-identity/06-backend-token-verification.md): Sub-millisecond local RS256 verification via `/.well-known/jwks.json`.
- [07. Webhook Integration](180-identity/07-webhook-integration.md): Real-time security events, user profile updates, and HMAC-SHA256 signatures.

### 180 Pay (`docs/180-pay/`)
- [01. Quickstart & Architecture](180-pay/01-getting-started.md): Flat 0.8% UPI settlement, instant T+0 automated bank payouts.
- [02. Checkout Integration](180-pay/02-checkout-integration.md): In-DOM bottom-sheet modal checkout (<45ms) and server-side session creation.
- [03. Recurring Subscriptions](180-pay/03-recurring-subscriptions.md): Automated subscription engine, billing intervals, and dunning cycles.
- [04. Coupons & Dynamic Geo-Pricing](180-pay/04-coupons-and-geo-pricing.md): Multi-currency localized pricing (USD/INR/EUR/GBP/AED) and developer coupons.
- [05. Bring Your Own Gateway (BYOG)](180-pay/05-byog-and-custom-domains.md): Custom domain checkouts and automated fallback cascades (Razorpay, Stripe, Cashfree).
- [06. Customer Billing Portal](180-pay/06-customer-portal.md): Self-service invoice downloads, payment method management, and plan upgrades.
- [07. Webhook Integration](180-pay/07-webhook-integration.md): Payment events, HMAC-SHA256 verification, and idempotency guarantees.
- [08. Payouts & Settlements](180-pay/08-payouts-and-settlements.md): Instant T+0 vendor payouts via IMPS/NEFT rails and ledger auditing.

### 180 Integrations (`docs/180-integrations/`)
- [01. WordPress & WooCommerce](180-integrations/01-wordpress-woocommerce.md): Official plugin for 1-click WhatsApp OTP login and 0.8% 180 Pay checkout.
- [02. Shopify & Headless Storefronts](180-integrations/02-shopify-and-storefronts.md): Integration guide for custom headless ecommerce, Next.js Commerce, and Shopify.

### Platform Blueprints (`docs/platform/`)
- [Universal Account & Identity](platform/04-universal-account-and-identity.md): Sovereign federated profile specifications across first-party subdomains.
- [Global Developer Experience](platform/05-global-developer-experience.md): CLI, SDK design principles, and developer dashboard specs.
- [Security, Multi-Tenancy & Trust](platform/06-security-and-trust.md): Cryptographic guarantees, rate limiting, and tenant boundary enforcement.

