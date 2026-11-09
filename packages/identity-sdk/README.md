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

---

## 180 Verify (KYC: PAN, Driving Licence, Voter ID, Aadhaar, Bank Account, Face Match)

180 Verify is a drop-in like 180 Pay. The SDK creates a verification session, opens the hosted flow in an iframe (an 80vh bottom sheet with drag-to-dismiss on mobile, a centered modal on desktop) and tells you when the user finishes.

> ### ⚠️ The browser callback is NOT proof of verification
> `onSuccess` receives only `{ sessionId, status }`. Anything that runs in the browser can be forged by the end user. It **never** contains the verified profile.
> **Your server must call `fetchVerificationResult()`** with your `clientSecret`. That call returns the signed result and the verified profile. Never unlock KYC-gated features based on the client callback alone.

### 1. Client (React)

```tsx
'use client';
import { use180Verify } from '@workspace/identity-sdk';

export function KycButton() {
  const { launchVerification, isVerifying, close } = use180Verify({
    clientId: '180_client_...',
    documents: ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'],
    strictNameMatching: true,
    onSuccess: async (result) => {
      // result = { sessionId, status: 'APPROVED' | 'MANUAL_REVIEW' }. NOT proof, and no PII.
      // Send the sessionId to your backend. The backend fetches and verifies the signed result.
      await fetch('/api/kyc/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: result.sessionId }),
      });
    },
    onError: (err) => {
      // err = { code, message, sessionId? }
      // e.g. VERIFICATION_REJECTED, ORIGIN_NOT_ALLOWED, INVALID_DOCUMENTS, NETWORK_ERROR
      console.error(err.code, err.message);
    },
    onClose: () => console.log('User closed the verification sheet'),
  });

  return (
    <button onClick={() => launchVerification()} disabled={isVerifying}>
      {isVerifying ? 'Verifying…' : 'Verify identity'}
    </button>
  );
}
```

> The founder's plan used `result.verifiedProfile` inside `onSuccess`. That is intentionally **not** provided client-side. Read `verifiedProfile` on your server from `fetchVerificationResult()` (see step 3).

There is also a ready-made component:

```tsx
<OneEightyVerify
  clientId="180_client_..."
  documents={['PAN', 'FACE_MATCH']}
  onSuccess={({ sessionId }) => confirmOnServer(sessionId)}
  onError={(err) => console.error(err)}
/>
```

`OneEightyVerify.launch(options)` returns a promise that resolves to `{ sessionId, status }` or `null`. `OneEightyVerify.start(options)` returns `{ promise, close() }`. Use these when you are not using React.

**Hook options:** `{ clientId, documents, strictNameMatching?, apiBaseUrl?, environment?, title?, onSuccess, onError, onClose? }`.
The hook returns `{ launchVerification(), isVerifying, close() }`.

**Outcome mapping:**

| Hosted page reports | Callback |
| --- | --- |
| `180_VERIFY_COMPLETE` with `APPROVED` or `MANUAL_REVIEW` | `onSuccess({ sessionId, status })` |
| `180_VERIFY_COMPLETE` with `REJECTED` | `onError({ code: 'VERIFICATION_REJECTED' })` |
| `180_VERIFY_COMPLETE` with any other status | `onError({ code: 'VERIFICATION_FAILED' })` |
| `180_VERIFY_ERROR` | `onError({ code })` |
| `180_VERIFY_CLOSE`, or user dismissal (close button, backdrop, Esc, drag down) | `onClose()` |

**Document types:** `PAN`, `DRIVING_LICENSE`, `VOTER_ID`, `AADHAAR`, `BANK_ACCOUNT`, `FACE_MATCH`.

**Origin registration:** the page's origin must be registered as an allowed origin of your app in the developer console. The SDK sends `parentOrigin = window.location.origin`, and the hosted page only posts messages back to that origin.

### 2. Client (script tag / vanilla JS)

```html
<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.min.js"></script>
<script>
  OneEighty.init({ clientId: '180_client_...' });
  document.querySelector('#kyc').onclick = () =>
    OneEightyVerify.launch({
      documents: ['PAN', 'BANK_ACCOUNT', 'FACE_MATCH'],
      strictNameMatching: true,
      onSuccess: ({ sessionId }) => fetch('/api/kyc/confirm', { method: 'POST', body: JSON.stringify({ sessionId }) }),
      onError: (err) => console.error(err.code, err.message),
    });
</script>
```

### 3. Server: get the verified profile (required)

```ts
// app/api/kyc/confirm/route.ts (server only, never ship clientSecret to the browser)
import { fetchVerificationResult } from '@workspace/identity-sdk/verify-server';

export async function POST(req: Request) {
  const { sessionId } = await req.json();
  const result = await fetchVerificationResult({
    sessionId,
    clientId: process.env.CORE_CLIENT_ID!,
    clientSecret: process.env.CORE_CLIENT_SECRET!,
    // apiBaseUrl: 'http://localhost:4003', // optional, defaults to https://api.180core.cloud
  });
  // `result` is built ONLY from the JWS-signed claims:
  // { sessionId, status, verifiedProfile: { fullName, dob, fatherName, gender,
  //   documents: { PAN: { verified, numberMasked }, ... }, bankVerified,
  //   faceMatchConfidence, livenessScore, verifiedAt }, environment, signature, claims }
  if (result.status === 'APPROVED') {
    // mark the user as verified; you may persist result.signature as portable proof
  } else if (result.status === 'MANUAL_REVIEW') {
    // hold until approved
  }
  return Response.json({ status: result.status });
}
```

`fetchVerificationResult` calls `GET /api/v1/identity/verify/session/:id/result` with HTTP Basic auth (`clientId:clientSecret`). It then verifies the `signature` (a JWS compact token) against the platform JWKS at `{apiBaseUrl}/.well-known/jwks.json`, using the same `JwksVerifier` that checks ID tokens (RS256 with `kid`). The call **fails closed** and throws `VerificationSignatureError` in these cases:

- `SIGNATURE_MISSING` or `SIGNATURE_INVALID`.
- `SIGNATURE_SESSION_MISMATCH`: the signed `sessionId` (or `sid` / `sub`) is not the session you asked for.
- `SIGNATURE_AUDIENCE_MISMATCH`: the signed `aud` / `clientId` is present but is not your client.
- `SIGNATURE_PAYLOAD_MISMATCH`: the unsigned `status` disagrees with the signed one.
- `SIGNED_CLAIMS_INCOMPLETE`: the signature does not cover `status`, or for APPROVED / MANUAL_REVIEW it does not cover `verifiedProfile`.

HTTP failures throw `VerificationApiError` with `{ code, httpStatus }`.

To use a different signing scheme or JWKS location, pass `signatureVerifier`. For example, use `createJwksSignatureVerifier({ jwksUrl })`, or supply your own object that implements `{ verify(jws, ctx) }`. `verifyVerificationSignature(signature, { clientId, sessionId, apiBaseUrl })` re-verifies a JWS you stored earlier.

**Creating sessions server-side (optional):**

```ts
import { createVerificationSession } from '@workspace/identity-sdk/verify-server';
const session = await createVerificationSession({
  clientId, clientSecret,
  documents: ['PAN', 'FACE_MATCH'],
  strictNameMatching: true,
  parentOrigin: 'https://app.example.com',
});
// -> { sessionId, sessionToken, verifyUrl, expiresAt, documents, environment }
```

### Security notes

- **postMessage filtering:** the SDK accepts a `180_VERIFY_*` message only when all three checks pass:
  - `event.origin === new URL(verifyUrl).origin`
  - `event.source === iframe.contentWindow`
  - `data.sessionId` matches the session the SDK created.

  It copies only whitelisted fields (`type`, `sessionId`, `status`, `code`). A `verifyUrl` must be `https:` (`http:` is allowed only on localhost).
- **Iframe permissions:**
  - `allow="camera; fullscreen"`
  - `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` (no top-level navigation)
  - `referrerpolicy="strict-origin-when-cross-origin"`
- **Accessibility and cleanup:** the dialog uses `role="dialog"` and `aria-modal`, traps focus, closes on Esc, and locks body scroll. On close, the iframe is removed right away so the camera is released, all listeners are detached, and focus returns to the element that had it before.
- **Single surface:** only one verification surface is open at a time. The React hook closes the surface silently when the component unmounts.
- **Client secret:** never expose `clientSecret` to the browser. The `verify-server` helpers log a warning if they run in a browser.
