# @workspace/identity-sdk (180 Core SDK)

Universal Client SDK for **180 Identity** (Single Sign-On, WhatsApp 1-Tap OTP, Biometric Passkeys) and **180 Pay** (1-Click Sovereign Checkout, Dynamic PPP Geo-Pricing, Universal UPI & Cards).

## 💡 Zero Custom Screen Requirement

**You do NOT need to build or design any custom screens for authentication or payments.**

When integrating 180 Identity or 180 Pay, all user interfaces, security handshakes, forms, and validation modals are **100% pre-built and hosted out-of-the-box**:

- **No Custom Auth Screens Needed**:
  - No login forms, sign-up forms, or password reset screens
  - No custom WhatsApp OTP or SMS OTP entry dialogs
  - No WebAuthn/Passkey registration prompt code
  - No OAuth 2.0 consent UI
  - *How it works*: Trigger `OneEighty.signIn({ uxMode: 'bottom_sheet' })` or drop in `<one-eighty-auth-button>`. The sovereign bottom sheet or hosted window opens automatically.

- **No Custom Payment Screens Needed**:
  - No credit card forms or payment method selector screens
  - No UPI QR or intent launch dialogs
  - No coupon validation logic or currency converter inputs
  - *How it works*: Call `OneEightyPay.checkout({ amount: 499, currency: 'INR' })`. An adaptive bottom sheet (on mobile) or glass modal (on desktop) handles the entire transaction lifecycle and redirects back with cryptographic proof.

---

## Installation & Usage

### 1. Script Tag (CDN Mirror)

\`\`\`html
<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.min.js"></script>
\`\`\`

### 2. NPM / Monorepo Package

\`\`\`bash
pnpm add @workspace/identity-sdk
\`\`\`

\`\`\`typescript
import { OneEighty, OneEightyPay } from '@workspace/identity-sdk';

// 1. Authentication (Zero UI needed)
await OneEighty.signIn({
  clientId: 'your_client_id',
  uxMode: 'bottom_sheet',
  onSuccess: (res) => console.log('Logged in:', res.user),
});

// 2. Sovereign Checkout (Zero UI needed)
await OneEightyPay.checkout({
  amount: 499,
  currency: 'INR',
  title: 'Pro Membership',
  onSuccess: (res) => console.log('Paid:', res.transactionId),
});
\`\`\`

---

## Cross-Platform Mobile Support (Flutter / React Native / iOS / Android)

On native mobile applications:
1. Open the hosted endpoint inside an In-App WebView (e.g. `flutter_inappwebview`) or Custom Tab:
   - **Auth**: `https://profile.180core.cloud/auth/login?client_id=...&redirect_uri=myapp://oauth/callback`
   - **Pay**: `https://profile.180core.cloud/checkout/:sessionId`
2. 180 Core communicates back with your mobile app automatically via:
   - **Custom URI Scheme Redirection**: `myapp://oauth/callback?code=...` or `myapp://payment/callback?status=success&transaction_id=...`
   - **JavaScript Bridge**: Listens on `OneEightyMobileChannel` and `OneEightyPaymentChannel` for real-time postMessage events.
