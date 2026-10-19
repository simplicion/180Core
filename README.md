# 180 Core Platform

The sovereign foundation of the 180 Ecosystem: Universal Identity, Sovereign Wallets, 180 Pay & Payouts, Developer Portal, and Zero-Dependency Client SDK.

## Architecture

```
180 core/
├── apps/
│   ├── 180-core-backend/        # Express API (Port 4003): OIDC/OAuth2 Provider, Wallets, 180 Pay, Payouts, Developer APIs
│   ├── 180-profile-frontend/    # Next.js 15 (Port 3009): Universal Identity Login, SSO Consent, Settings, Sovereign QR
│   └── 180developers-frontend/  # Next.js 15 (Port 3008): Developer Portal (OAuth Apps, API Keys, Webhooks, SDK Docs)
├── packages/
│   ├── db-180core/              # Dedicated Prisma ORM layer for 180 Core PostgreSQL database
│   ├── domains/
│   │   ├── identity-provider/   # RFC 7519 JWT / RFC 7517 JWKS / RFC 7636 PKCE / RSA Cryptographic Engine
│   │   ├── payment-provider/    # 180 Pay, Checkout Sessions, Wallet Ledger, Razorpay Subscriptions, Payouts
│   │   └── integrations/        # Cloudflare R2 / AWS S3 global media storage
│   ├── identity-sdk/            # Pure JavaScript/TypeScript SDK, Web Components (<one-eighty-auth-button>, <one-eighty-pay-button>)
│   ├── sdk/                     # Unified client distribution wrapper
│   ├── ui/                      # Shared platform UI primitives (Glassmorphism, Dark mode, Accessible Modals/Buttons)
│   ├── typescript-config/       # Shared strict tsconfig presets
│   └── eslint-config/           # Shared lint rules
└── scripts/                     # Dev runner, SDK CDN deployer, and test suites
```

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Generate Database Client & Push Schema
```bash
pnpm db:generate
pnpm db:push
```

### 3. Build SDK Distribution
```bash
pnpm build:sdk
```

### 4. Run Development Stack
```bash
pnpm dev
```

This launches:
- **180 Core Backend**: `http://localhost:4003`
- **180 Profile**: `http://localhost:3009`
- **180 Developers**: `http://localhost:3008`

## Consumer Integration

Any consumer application (e.g., Offmesh, Partner SaaS, or 3rd-party platforms) integrates with 180 Core via:
1. **OAuth 2.0 / OIDC Authorization Code Flow with PKCE**
2. **Client SDK Script**: `https://profile.180core.cloud/sdk/v1/180-core-sdk.js`
3. **Web Components**: `<one-eighty-auth-button>`, `<one-eighty-pay-button>`
