# 180 Core Platform

Enterprise-grade sovereign identity, payment processing, developer gateway, and client SDK infrastructure for distributed applications and relying parties.

---

## 1. Executive Summary

180 Core is the foundational platform for identity management, digital asset ledgers, transaction processing, and developer ecosystem operations. Built on OpenID Connect (OIDC), OAuth 2.0, WebAuthn, and dual payment processing gateways, 180 Core provides an autonomous platform where external applications (relying parties) can delegate authentication and monetization without deploying or maintaining custom authentication or checkout screens.

### Core Architectural Capabilities

- **Universal Identity Provider (OIDC / OAuth 2.0)**: RFC 7519, RFC 7517, and RFC 7636 PKCE compliant authorization server with asymmetric RSA-256 token issuance and public JWKS distribution.
- **Zero-Custom-Screen Client SDK**: Cross-framework JavaScript/TypeScript SDK and autonomous Web Components (`<one-eighty-auth-button>`, `<one-eighty-pay-button>`) that orchestrate authentication and checkout flows via adaptive bottom sheets, modals, and native mobile In-App WebViews.
- **Dual Payment & Sovereign Ledger Engine**: Unified checkout engine supporting Razorpay (UPI, Netbanking, Cards) and Stripe (Global Cards, Apple Pay, Google Pay, BYOG), combined with a double-entry balance ledger and real-time Purchasing Power Parity (PPP) localized pricing.
- **Developer Ecosystem & API Gateway**: Self-service developer portal for managing OAuth client applications, API key provisioning, granular permission scopes, and cryptographically verified HMAC SHA-256 webhook subscriptions.
- **Operations & Fleet Governance**: Centralized administrative panel for treasury accounting, merchant settlement reconciliation, dispute resolution, and automated subscriber lifecycle management.

---

## 2. System Architecture

The following diagram illustrates the boundary separation and communication flows between consumer applications, the 180 Core API Gateway, the sovereign database layer, and external infrastructure providers.

```
+---------------------------------------------------------------------------------------------------+
|                                      CONSUMER ECOSYSTEM                                           |
|                                                                                                   |
|  Web Applications (React/Next/Vue)       Mobile Apps (Flutter/React Native)      Headless Servers |
|         |                                        |                                       |        |
|         | Zero-UI SDK                            | WebView / Deep Link                   | REST   |
|         v                                        v                                       v        |
+---------+----------------------------------------+---------------------------------------+--------+
                                                   |
                                                   v
+---------------------------------------------------------------------------------------------------+
|                                     180 CORE API GATEWAY                                          |
|                                     (Port 4003 - Express)                                         |
|                                                                                                   |
|  [Security Middlewares]                                                                           |
|  - Helmet Security Headers           - Strict CORS Whitelisting       - Distributed Rate Limiter  |
|  - Snake/Camel Case Normalization    - Request Body Size Bounds       - TLS 1.3 Transport         |
|                                                                                                   |
|  [Subsystems & Routing]                                                                           |
|  +---------------------------+ +----------------------------+ +--------------------------------+  |
|  | OIDC & Identity Provider  | | Sovereign Payment Engine   | | Developer & Partner Platform   |  |
|  | - RFC 7636 PKCE Evaluator | | - Dual Gateway Router      | | - Scoped API Key Validator     |  |
|  | - Asymmetric RSA-256 JWKS | | - Double-Entry Ledger      | | - HMAC SHA-256 Webhooks        |  |
|  | - WebAuthn / Passkeys     | | - Purchasing Power Parity  | | - Dynamic Pricing Tables       |  |
|  | - OTP (WhatsApp / SMS)    | | - Subscription Recurring   | | - Coupon & Promo Engine        |  |
|  +---------------------------+ +----------------------------+ +--------------------------------+  |
+----------------------------------------------+----------------------------------------------------+
                                               |
                       +-----------------------+-----------------------+
                       |                                               |
                       v                                               v
+----------------------------------------------+ +--------------------------------------------------+
|             STORAGE & PERSISTENCE            | |               EXTERNAL PROVIDERS                 |
|                                              | |                                                  |
|  PostgreSQL Database (Prisma ORM Client)     | |  - Payment Gateways: Stripe / Razorpay           |
|  - User Identity & Passkey Credentials       | |  - Media Storage: Cloudflare R2 / AWS S3         |
|  - OAuth 2.0 Clients, Codes & Tokens         | |  - Telephony / OTP: MSG91 (WhatsApp & SMS)       |
|  - Ledger Accounts & Transactions            | |  - Transactional Mail: SMTP Relay                |
|  - Subscription Cycles & Invoices            | |  - Relying Parties: Downstream Webhooks          |
+----------------------------------------------+ +--------------------------------------------------+
```

---

## 3. Monorepo Organization

This repository is managed as an enterprise monorepo using Turborepo and pnpm workspaces. The boundary separation is strictly divided into applications (`apps/`), shared domain libraries (`packages/`), and automated tooling (`scripts/`).

```
180 core/
├── apps/
│   ├── 180-core-backend/          # Core Express API (Port 4003): OIDC, Wallets, 180 Pay, Webhooks
│   ├── 180-profile-frontend/      # Next.js 15 App (Port 3009): Identity, Consent, Settings, QR
│   ├── 180developers-frontend/    # Next.js 15 App (Port 3008): Developer Portal, API Keys, Docs
│   └── 180-admin-frontend/        # Next.js App (Port 3010): Operations, Treasury, Settlements
├── packages/
│   ├── db-180core/                # Dedicated Prisma ORM layer and PostgreSQL schema
│   ├── domains/
│   │   ├── identity-provider/     # RFC 7519 JWT, RFC 7517 JWKS, RFC 7636 PKCE, RSA Engine
│   │   ├── payment-provider/      # Dual Gateway, Ledger, Subscriptions, Geo-Pricing PPP
│   │   └── integrations/          # Object storage (Cloudflare R2 / AWS S3) abstraction
│   ├── identity-sdk/              # Zero-dependency Client SDK and Custom Web Components
│   ├── sdk/                       # Unified SDK client distribution package
│   ├── ui/                        # Shared Design System (Tailwind CSS, Radix UI primitives)
│   ├── plugins/
│   │   └── wordpress-180-core/    # WordPress integration plugin for 180 Core
│   ├── keys/                      # Cryptographic key distribution and rotation vault
│   ├── typescript-config/         # Shared strict TypeScript configuration presets
│   └── eslint-config/             # Shared ESLint linting rules
└── scripts/                       # Orchestration runner, CDN deployment, and verification suites
```

### Application Runtime Allocations

| Service                  | Technology                     | Runtime Port | Default Production Host           | Purpose                                      |
| :----------------------- | :----------------------------- | :----------- | :-------------------------------- | :------------------------------------------- |
| `180-core-backend`       | Node.js / Express / TypeScript | `4003`       | `https://api.180core.cloud`       | OIDC Authorization, Payment Engine, APIs     |
| `180-profile-frontend`   | Next.js 15 (App Router)        | `3009`       | `https://profile.180core.cloud`   | Sovereign Identity, OAuth Consent, QR        |
| `180developers-frontend` | Next.js 15 (App Router)        | `3008`       | `https://developer.180core.cloud` | App Management, API Keys, Webhooks, Sandbox  |
| `180-admin-frontend`     | Next.js (App Router)           | `3010`       | `https://admin.180core.cloud`     | Treasury, Reconciliation, Dispute Management |

---

## 4. Subsystems Specification

### 4.1. Identity Provider & OAuth 2.0 / OIDC

180 Core implements a certified OpenID Connect identity provider that completely decouples user authentication from relying party business logic.

- **Cryptographic Engine**: Signs JSON Web Tokens (JWT) using asymmetric RSA-256 keypairs (`RS256`).
- **JWKS Endpoint**: Publishes active public keys at `/.well-known/jwks.json` and `/certs/jwks.json` for independent cryptographic verification by third parties.
- **PKCE Enforcement**: Enforces Proof Key for Code Exchange (RFC 7636) with `S256` code challenges on all authorization code grants to eliminate interception risks.
- **Authentication Factors**: Supports WebAuthn biometric passkeys, WhatsApp OTP (via MSG91), SMS OTP, email magic links, and Google OAuth federation.
- **Normalization**: Provides automatic parameter normalization supporting both `snake_case` (RFC standard) and `camelCase` across requests.

### 4.2. Sovereign Payment Engine & Ledger

The billing subsystem provides payment facilitation, international localization, and financial tracking:

- **Dual-Gateway Routing**: Dynamic orchestration between Razorpay (domestic India, UPI, Rupay, Netbanking) and Stripe (international cards, Apple Pay, Google Pay).
- **Double-Entry Balance Ledger**: Every transaction records balanced debit and credit entries across user wallets, platform fee escrows, and merchant reserves.
- **Purchasing Power Parity (PPP)**: Automatic client geo-detection and real-time price conversion based on regional purchasing power indices.
- **Promotions & Coupons**: Configurable discount rules, usage quotas, expiry limits, and dynamic checkout validation.
- **Recurring Subscriptions**: Autonomous billing cycle scheduler evaluating renewals, grace periods, dunning states, and automated webhooks.

### 4.3. Zero-Custom-Screen Client SDK

The `@workspace/identity-sdk` package is built to minimize third-party integration friction:

- **Zero UI Requirement**: Eliminates the need for consumer applications to build custom login forms, SMS verification dialogues, card input fields, or UPI interfaces.
- **Adaptive Presentation Modes**: Supports modal popups, slide-up bottom sheets (optimized for mobile), new tabs, and full window redirects.
- **Web Components**: Exposes custom HTML elements (`<one-eighty-auth-button>`, `<one-eighty-pay-button>`) that bind to custom configurations declaratively.
- **Mobile Bridge Integration**: Exposes postMessage listeners (`OneEightyMobileChannel`, `OneEightyPaymentChannel`) and handles custom URL scheme callbacks (`myapp://oauth/callback`).
- **CDN Distribution**: Deployed to high-availability CDN edge points (`https://profile.180core.cloud/sdk/v1/180-core-sdk.js`).

---

## 5. Technology Stack & Requirements

### System Requirements

- **Runtime**: Node.js `>= 20.0.0`
- **Package Manager**: pnpm `9.x`
- **Database Engine**: PostgreSQL `>= 15.0`
- **Build Orchestrator**: Turborepo `>= 2.0.0`
- **Compiler**: TypeScript `>= 5.4.0`

### Core Dependencies

- **Backend**: Express, Helmet, CORS, Compression, Morgan, Express-Rate-Limit, Dotenv, Jose, SimpleWebAuthn
- **Database & Modeling**: Prisma ORM, `@prisma/client`
- **Frontend**: Next.js 15, React 19, Tailwind CSS, Radix UI primitives, Lucide Icons
- **Cryptographic Tooling**: Node.js `crypto`, Jose, RFC-compliant JWKS generators

---

## 6. Environment Configuration & Security Doctrine

### Security Policy

Under the platform security standard, hardcoded secrets, connection strings, credentials, or private keys are strictly prohibited from all repository files. All sensitive values must be injected dynamically via environment variables or managed KMS providers.

### Environment Variable Reference

Before launching the system, configure a `.env` file in the repository root based on `.env.example`:

```bash
# Network & Environment
PORT=4003
NODE_ENV=development

# Database Connection
DATABASE_URL="postgresql://user:password@localhost:5432/180core_db?schema=public"

# Cryptographic Signatures
JWT_SECRET="replace_with_cryptographically_secure_random_string"
JWT_REFRESH_SECRET="replace_with_cryptographically_secure_random_string"

# Sovereign Payment Gateway Configuration (Options: "RAZORPAY" | "STRIPE")
PAYMENT_GATEWAY="RAZORPAY"

# Razorpay Credentials (India / UPI / Domestic Settlements)
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your_razorpay_secret"
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"

# Stripe Credentials (Global Cards / Apple Pay / Foreign Currencies)
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email SMTP Relay (OTP & Security Alerts)
SMTP_HOST="smtp.mailprovider.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="notifications@180core.cloud"
SMTP_PASS="your_smtp_password"
EMAIL_FROM="notifications@180core.cloud"

# MSG91 WhatsApp & SMS OTP Provider
MSG91_AUTH_KEY="your_msg91_auth_key"
MSG91_OTP_TEMPLATE_ID="your_otp_template_id"
MSG91_WHATSAPP_INTEGRATED_NUMBER="919381420546"
MSG91_WHATSAPP_TEMPLATE_NAME="welcome"
MSG91_WHATSAPP_LANG="en"

# Recurring Billing & Internal Scheduler Security
BILLING_CRON_SECRET="your_secure_cron_authentication_token"

# First-Party OAuth Client Registration
CORE_CLIENT_ID="180_client_system_primary"
CORE_CLIENT_SECRET="your_core_client_secret"
CORE_WEBHOOK_SECRET="your_core_webhook_secret"

# Allowed Origins & Redirect Whitelist
CORE_REDIRECT_URIS="http://localhost:3008/oauth/callback,http://localhost:3009/oauth/callback"
PROFILE_FRONTEND_URL="http://localhost:3009"
DEVELOPERS_FRONTEND_URL="http://localhost:3008"
CLIENT_URL="http://localhost:3008,http://localhost:3009,http://localhost:3010"
```

---

## 7. Local Development Workflow

### Step 1: Install Dependencies

Install all workspace dependencies using pnpm:

```bash
pnpm install
```

### Step 2: Database Preparation

Generate the Prisma client bindings and synchronize the schema with your local PostgreSQL instance:

```bash
# Generate Prisma Client
pnpm db:generate

# Push Schema to Local PostgreSQL
pnpm db:push

# (Alternative) Run Versioned Migrations
pnpm db:migrate
```

### Step 3: Compile Client SDK

Build the TypeScript distribution of `@workspace/identity-sdk` and bundle the CDN distribution:

```bash
pnpm build:sdk
```

### Step 4: Run Development Services

Launch the services using the custom development orchestrator:

```bash
# Launch Default Development Stack (Backend, Profile, Developers)
pnpm dev

# Launch Complete Suite (Including Admin Panel)
pnpm dev:all
```

Alternatively, services can be launched individually:

```bash
pnpm dev:backend      # Port 4003 (Core API)
pnpm dev:profile      # Port 3009 (Identity & Auth Frontend)
pnpm dev:developers   # Port 3008 (Developer Portal)
pnpm dev:admin        # Port 3010 (Operations & Admin Panel)
```

---

## 8. API Gateway Endpoints & Discovery

### OpenID Connect & OAuth 2.0 Routes

| Endpoint                            | Method | Description                                                           |
| :---------------------------------- | :----- | :-------------------------------------------------------------------- |
| `/.well-known/openid-configuration` | `GET`  | OpenID Connect discovery document                                     |
| `/.well-known/jwks.json`            | `GET`  | Cryptographic JSON Web Key Set (RS256 Public Keys)                    |
| `/certs/jwks.json`                  | `GET`  | Mirror JWKS endpoint                                                  |
| `/api/oauth/authorize`              | `GET`  | Interactive authorization code grant endpoint                         |
| `/api/oauth/token`                  | `POST` | Token issuance endpoint (Authorization Code with PKCE, Refresh Token) |
| `/api/oauth/userinfo`               | `GET`  | Authenticated user profile claim resolver                             |
| `/api/oauth/revoke`                 | `POST` | Access and refresh token revocation endpoint                          |

### Payment & Checkout Routes

| Endpoint                                  | Method        | Description                                                |
| :---------------------------------------- | :------------ | :--------------------------------------------------------- |
| `/api/v1/pay/checkout-session`            | `POST`        | Initialize a sovereign checkout session                    |
| `/api/v1/pay/verify`                      | `POST`        | Cryptographically verify gateway payment proof             |
| `/api/v1/pay/links`                       | `GET`, `POST` | Create and query direct payment links                      |
| `/api/v1/geo-pricing/calculate`           | `POST`        | Evaluate local currency conversion and PPP multipliers     |
| `/api/v1/coupons/validate`                | `POST`        | Validate promotional coupon codes and compute discounts    |
| `/api/v1/subscriptions`                   | `POST`, `GET` | Create and inspect recurring subscriptions                 |
| `/api/v1/subscriptions/run-billing-cycle` | `POST`        | Automated scheduler endpoint for recurring billing charges |

### System & Health Endpoints

| Endpoint  | Method | Description                                                   |
| :-------- | :----- | :------------------------------------------------------------ |
| `/`       | `GET`  | API Gateway status, metadata, and root route discovery        |
| `/health` | `GET`  | Infrastructure health check (DB connectivity, memory, uptime) |

---

## 9. Integration Specification

### 9.1. Client SDK Integration (Web Applications)

#### Option A: HTML Script Tag (CDN Mirror)

Add the zero-dependency script directly into your application head:

```html
<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.min.js"></script>
```

#### Option B: NPM Monorepo Package

```bash
pnpm add @workspace/identity-sdk
```

#### Implementation Code Sample

```typescript
import { OneEighty, OneEightyPay } from "@workspace/identity-sdk";

// 1. Initialize Authentication (Zero Custom UI)
await OneEighty.signIn({
  clientId: "180_client_your_application_id",
  uxMode: "bottom_sheet", // 'bottom_sheet' | 'popup' | 'redirect'
  onSuccess: (response) => {
    console.log("Authentication Successful:", response.tokens.accessToken);
    console.log("User Claims:", response.user);
  },
  onError: (error) => {
    console.error("Authentication Failed:", error.message);
  },
});

// 2. Initialize Sovereign Checkout (Zero Custom UI)
await OneEightyPay.checkout({
  amount: 499,
  currency: "INR",
  title: "Enterprise Subscription",
  description: "Monthly access tier with unlimited seats",
  onSuccess: (transaction) => {
    console.log("Payment Verified:", transaction.paymentId);
  },
  onDismiss: () => {
    console.log("Checkout modal closed by user");
  },
});
```

#### Declarative Web Components

```html
<!-- Drop-in Authentication Button -->
<one-eighty-auth-button
  client-id="180_client_your_application_id"
  ux-mode="bottom_sheet"
  label="Sign in with 180"
></one-eighty-auth-button>

<!-- Drop-in Checkout Button -->
<one-eighty-pay-button
  amount="499"
  currency="INR"
  title="Pro Membership"
  client-id="180_client_your_application_id"
></one-eighty-pay-button>
```

---

### 9.2. Server-to-Server OAuth 2.0 PKCE Flow

For custom integrations without the SDK, implement the standard RFC 7636 Authorization Code Flow:

1. **Generate PKCE Parameters**:
   Create a cryptographically random `code_verifier` (43 to 128 characters) and compute its SHA-256 hash formatted as Base64URL (`code_challenge`).

2. **Redirect to Authorization Server**:

   ```
   GET https://profile.180core.cloud/oauth/authorize?
     response_type=code
     &client_id=YOUR_CLIENT_ID
     &redirect_uri=https://yourapp.com/callback
     &scope=openid%20profile%20email
     &code_challenge=COMPUTED_CODE_CHALLENGE
     &code_challenge_method=S256
     &state=RANDOM_STATE_STRING
   ```

3. **Exchange Code for Access & ID Tokens**:

   ```http
   POST https://api.180core.cloud/api/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &client_id=YOUR_CLIENT_ID
   &client_secret=YOUR_CLIENT_SECRET
   &redirect_uri=https://yourapp.com/callback
   &code=RECEIVED_AUTHORIZATION_CODE
   &code_verifier=ORIGINAL_CODE_VERIFIER
   ```

4. **Verify Token Signature**:
   Fetch the public key from `https://api.180core.cloud/.well-known/jwks.json` matching the token header `kid` and verify the RS256 signature locally.

---

### 9.3. Webhook Signature Verification

All webhook payloads dispatched by 180 Core contain a cryptographic signature header `X-180-Signature` calculated as an HMAC SHA-256 digest using your application webhook secret.

```typescript
import crypto from "crypto";

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const calculatedSignature = hmac.update(rawBody).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature, "utf8"),
    Buffer.from(signatureHeader, "utf8"),
  );
}
```

---

## 10. Automated Verification & Test Suite

The platform includes a test execution runner covering unit tests, cryptographic audit tests, decoupled identity suites, and end-to-end integration flows.

### Execute Master Test Suite

```bash
pnpm test
```

### Test Suite Breakdown

| Test Suite                         | Execution Target                                                       | Coverage Domain                                       |
| :--------------------------------- | :--------------------------------------------------------------------- | :---------------------------------------------------- |
| **SDK E2E Suite**                  | `scripts/test-180-core-sdk-e2e.mjs`                                    | Client SDK runtime, bundle generation, modal bindings |
| **Dedicated Identity DB Wiring**   | `apps/180-core-backend/src/tests/test-dedicated-identity-db.ts`        | Prisma client isolation and connection resilience     |
| **Decoupling Audit**               | `apps/180-core-backend/src/tests/test-phase1-decoupling.ts`            | Multi-tenant company ID and tenant isolation          |
| **Relying Party Handshake**        | `apps/180-core-backend/src/tests/test-relying-party-handshake.ts`      | PKCE, token exchange, and refresh token cycles        |
| **Developer Portal Flow**          | `apps/180-core-backend/src/tests/test-developer-portal-flow.ts`        | App provisioning, API key issuance, and RBAC          |
| **Coupon Engine Suite**            | `packages/domains/payment-provider/.../test_phase7_coupon_api.ts`      | Discount calculation, quotas, and expiration rules    |
| **Webhook Dispatcher Suite**       | `packages/domains/payment-provider/.../test_phase10_webhooks.ts`       | Event emission, retry loops, and HMAC generation      |
| **SDK Server Helpers**             | `packages/identity-sdk/.../test_phase11_sdk.ts`                        | Server-side validation helpers and token decoders     |
| **Web Components Suite**           | `packages/identity-sdk/.../test_phase12_components.ts`                 | DOM component mounting and event lifecycle            |
| **OAuth Resilience & Domains**     | `apps/180-core-backend/src/tests/test_oauth_resilience_and_domains.ts` | Boundary validation and parameter normalization       |
| **Production Master Verification** | `apps/180-core-backend/src/tests/test_phase24_production_master.ts`    | Full-stack end-to-end transaction validation          |

### Static Analysis & Formatting

```bash
# Run Turborepo Linter
pnpm lint

# Format Codebase via Prettier
pnpm format
```

---

## 11. Production Operations & Deployment

### Compilation & Build

To generate production-optimized artifacts across all apps and packages:

```bash
pnpm build
```

This script sequentially:

1. Compiles the `@workspace/identity-sdk` package.
2. Generates the distribution CDN bundle and maps it into public assets.
3. Invokes `turbo run build` across backend and frontend workspaces.

### Database Migration in Production

When deploying schema updates to staging or production databases:

```bash
pnpm --filter @workspace/db-180core prisma migrate deploy
```

### High Availability & Resiliency Checklist

- Ensure `DATABASE_URL` utilizes a connection pooler (e.g., PgBouncer) in high-throughput environments.
- Maintain separate RSA keypair rotation schedules, keeping historical public keys active in `jwks.json` during grace periods.
- Configure automated monitoring for the recurring billing scheduler (`POST /api/v1/subscriptions/run-billing-cycle`) using an external cron monitor.
- Implement central log aggregation (ELK, Datadog, or Grafana Loki) to capture structured JSON audit logs from API middleware.

---

## 12. License & Governance

Proprietary and confidential software. Copyright (c) 180 Workspace Platform. All rights reserved. Unauthorized reproduction, distribution, decompilation, or transmission in any form or by any means is strictly prohibited.
