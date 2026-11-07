---
id: ai-master-prompt
title: Master AI Integration Prompt
sidebar_label: 1-Click AI Master Prompt
sidebar_position: 2
description: Copy-paste master AI integration prompt to automatically integrate 180 Identity and 180 Pay using ChatGPT, Claude, Cursor, or Antigravity into any independent application with zero friction and zero 404s.
---

# 🤖 Master AI Integration Prompt

Integrate **180 Identity** (Universal SSO, WhatsApp 1-Tap OTP, Biometric Passkeys) and **180 Pay** (Universal Sovereign 1-Click Checkout & Subscriptions) into any independent application in under 2 minutes.

Copy the master prompt below, replace the bracketed placeholders (`YOUR_CLIENT_ID`, `YOUR_CLIENT_SECRET`, `YOUR_WEBHOOK_SECRET`) with your credentials from the [180 Developer Console](https://developer.180core.cloud), and paste it directly into **Cursor, Claude 3.5 Sonnet, ChatGPT, Antigravity, or GitHub Copilot**.

:::caution ⚠️ CRITICAL RULE #1: Currency Units (Strictly Whole Currency Units)
Unlike legacy gateways (Stripe/Razorpay) that require smallest currency units (e.g., paise `49900` for ₹499), **180 Pay universally operates on whole currency units** (`amount=499` for ₹499 INR, or `amount=49.00` for $49.00 USD).  
**Warning:** Passing `49900` without unit flags will produce a ₹49,900 order! While 180 Pay backend includes an intelligent auto-conversion safety fallback if you pass `amountInPaise` or `amount_in_cents`, you should always pass whole units directly.
:::

:::tip Dual-Domain Ecosystem Directory
Prevent 404s and routing confusion by strictly separating user-facing hosted interfaces from server-to-server APIs:
- **Hosted User Interfaces (Checkout & SSO)**:
  - `https://profile.180core.cloud/checkout` (1-Click Sovereign Checkout)
  - `https://profile.180core.cloud/auth/login` (Hosted Universal SSO)
  - *Alternative mirror*: `https://profile.180core.cloud`
- **Core Engine REST APIs (Server-to-Server)**:
  - `https://api.180core.cloud/api/v1/pay/checkout-session` (Signed Checkout Session creation)
  - `https://api.180core.cloud/api/oauth/token` (RFC 6749 Auth Code exchange)
  - `https://api.180core.cloud/api/oauth/userinfo` (OIDC Standard Claims profile)
  - `https://api.180core.cloud/certs/jwks.json` (RS256 Public JWKS Key Set)
:::

---

## 📋 The Copy-Paste Master Prompt

```markdown
You are an expert senior full-stack engineer integrating 180 Core (180 Identity & 180 Pay) into my independent application.

Follow these strict, modern integration specifications with zero friction, zero 404s, and zero schema regressions:

### Application Credentials & Canonical Endpoints:
- CLIENT_ID: "YOUR_CLIENT_ID"
- CLIENT_SECRET: "YOUR_CLIENT_SECRET"
- WEBHOOK_SECRET: "YOUR_WEBHOOK_SECRET"
- CORE_API_URL: "https://api.180core.cloud"
- HOSTED_AUTH_URL: "https://profile.180core.cloud/auth/login" (Mirror: "https://profile.180core.cloud")
- HOSTED_CHECKOUT_URL: "https://profile.180core.cloud/checkout"
- JWKS_KEYRING_URL: "https://api.180core.cloud/certs/jwks.json"
- DEVELOPER_CONSOLE_URL: "https://developer.180core.cloud"

---

### 7 Critical Integration Principles to Enforce:
1. **The "Zero Custom Screen" Mandate**: NEVER build or design custom screens for login, user registration, WhatsApp OTP popups, biometric passkey modals, password recovery, 2FA, OAuth consent, payment method selectors, credit card forms, UPI QR displays, coupon calculation, or receipt generation. All flows are 100% pre-built and hosted via in-DOM bottom sheets (`OneEighty.signIn({ uxMode: 'bottom_sheet' })`, `OneEightyPay.checkout({ amount: 499, currency: 'INR' })`), drop-in components (`<one-eighty-auth-button>`, `<one-eighty-pay-button>`), or hosted mobile WebViews.
2. **Currency Units Standard**: 180 Pay universally operates on WHOLE CURRENCY UNITS (`amount: 499` for ₹499 INR, or `amount: 49.00` for $49.00 USD). Never pass paise or cents (`49900`) as the primary amount.
3. **Universal Parameter Normalization**: 180 Core's backend and SDK support seamless bidirectional mapping:
   - `client_id` ↔ `clientId`
   - `redirect_uri` ↔ `redirectUri`
   - `return_url` ↔ `returnUrl`
   - `cancel_url` ↔ `cancelUrl`
   - `order_id` ↔ `orderId`
   - `session_id` ↔ `sessionId`
   - `coupon_code` ↔ `couponCode` / `coupon`
4. **Dual-Domain Ecosystem Separation**:
   - User-facing checkout and login: `https://profile.180core.cloud` (e.g. `/checkout`, `/auth/login`).
   - Server-to-server REST endpoints: `https://api.180core.cloud` (e.g. `/api/v1/pay/checkout-session`, `/api/oauth/token`, `/api/oauth/userinfo`, `/certs/jwks.json`).
5. **Two Checkout Initiation Patterns**:
   - Pattern A (Server-Side Signed Session - Recommended for Web & Mobile Backends): Backend calls `POST https://api.180core.cloud/api/v1/pay/checkout-session` with secret key, receives `{ sessionId, checkoutUrl }`, and directs client to `checkoutUrl`.
   - Pattern B (In-DOM Client Bottom Sheet - Direct Web SPA): Trigger `OneEightyPay.openBottomSheet({ amount, currency, title, orderId, onSuccess })` to eliminate popup blockers.
6. **RFC 8252 Dynamic Loopback Compatibility**: 180 Identity dynamically supports local development across any port on `localhost`, `127.0.0.1`, `10.0.2.2` (Android emulator), and `::1` without redirect URI mismatch errors.
7. **Universal OIDC Claims Normalization**: The `/api/oauth/userinfo` response returns normalized standard claims (`sub`, `name`, `preferred_username`, `email`, `phone_number`, `picture`) alongside legacy aliases (`phone`, `phoneNumber`, `avatarUrl`) and nested `user: { ... }` so database schemas (Prisma, Drizzle, TypeORM) never crash.

---

### Step 1: Environment Variables
Add the following to your `.env` (or `.env.local` / `.env.production`) file:
```env
# Public Client Configuration
NEXT_PUBLIC_180_CLIENT_ID=YOUR_CLIENT_ID
NEXT_PUBLIC_180_CORE_URL=https://api.180core.cloud
NEXT_PUBLIC_180_AUTH_URL=https://profile.180core.cloud

# Server-Only Confidential Secrets (NEVER expose to client bundles)
ONE_EIGHTY_CLIENT_SECRET=YOUR_CLIENT_SECRET
ONE_EIGHTY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

---

### Step 2: 180 Identity Integration (Client & Server in 3 Lines)

#### Frontend (React / Next.js / Vite SPA):
```tsx
'use client';

import React from 'react';
import { OneEightyIdentity } from '@workspace/identity-sdk';

export function LoginButton() {
  const handleLogin = () => {
    // 1. Opens non-blocking in-DOM slide-up sheet (zero popup blockers!)
    OneEightyIdentity.openBottomSheet({
      clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID!,
      onSuccess: async ({ code }) => {
        // 2. Send code to your backend exchange route
        const res = await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (res.ok) window.location.href = '/dashboard';
      },
    });
  };

  return (
    <button onClick={handleLogin} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md">
      Sign in with 180
    </button>
  );
}
```

#### Vanilla HTML / Script Tag:
```html
<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.js" async></script>
<button onclick="window.OneEightyAuth.openBottomSheet({ clientId: 'YOUR_CLIENT_ID', onSuccess: (res) => sendCode(res.code) })">
  Sign in with 180
</button>
```

#### Backend Token Exchange (1-Line Server Exchange):
```typescript
// app/api/auth/exchange/route.ts (Next.js App Router) or Express/Fastify handler
import { NextResponse } from 'next/server';
import { exchangeAuthCode } from '@workspace/identity-sdk';

export async function POST(req: Request) {
  const { code } = await req.json();
  
  // 1-line exchange retrieves OIDC normalized profile & tokens:
  const { user, tokens } = await exchangeAuthCode(code, {
    clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID,
    clientSecret: process.env.ONE_EIGHTY_CLIENT_SECRET,
  });

  console.log('Logged in user:', user.name, user.email, user.phone_number);

  // Set HTTP-only session cookie
  const response = NextResponse.json({ success: true, user });
  response.cookies.set('session', tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
```

---

### Step 3: 180 Pay Integration (Two Bulletproof Patterns)

#### Pattern A: Server-Side Signed Checkout Session (Recommended for Web & Mobile)
```typescript
// 1. Backend creates signed session
// Endpoint: POST https://api.180core.cloud/api/v1/pay/checkout-session
export async function createCheckoutSession(orderId: string, userEmail: string) {
  const res = await fetch('https://api.180core.cloud/api/v1/pay/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ONE_EIGHTY_CLIENT_SECRET}`
    },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_180_CLIENT_ID,
      amount: 499, // WHOLE UNITS: ₹499 INR or $49.00 USD (DO NOT pass 49900)
      currency: 'INR',
      title: 'Annual Pro Subscription',
      order_id: orderId,
      return_url: 'https://yourapp.com/checkout/success',
      cancel_url: 'https://yourapp.com/checkout/cancel',
      metadata: { customerEmail: userEmail }
    })
  });

  const { sessionId, checkoutUrl } = await res.json();
  // 2. Direct client to checkoutUrl (e.g. https://profile.180core.cloud/checkout?sessionId=...)
  return { sessionId, checkoutUrl };
}
```

#### Pattern B: Direct Frontend In-DOM Bottom Sheet
```tsx
import { OneEightyPay } from '@workspace/identity-sdk';

export function CheckoutButton() {
  const handleCheckout = () => {
    OneEightyPay.openBottomSheet({
      amount: 499,         // Whole currency units
      currency: 'INR',     // Any ISO currency (USD, EUR, INR, GBP, etc.)
      title: 'Annual Pro Subscription',
      orderId: 'ord_' + Date.now(),
      onSuccess: (res) => {
        console.log('Payment captured! Transaction ID:', res.transactionId);
        window.location.href = '/dashboard?upgraded=true';
      },
    });
  };

  return <button onClick={handleCheckout}>Upgrade to Pro (₹499)</button>;
}
```

---

### Step 4: Cryptographic HMAC-SHA256 Webhook Verification Protocol

Every authentic webhook from 180 Pay includes:
- `x-180-signature`: HMAC-SHA256 of `${timestamp}.${rawBody}`
- `x-180-timestamp`: Unix epoch seconds of dispatch
- `x-180-event`: Event type (`payment.captured`, `subscription.created`, etc.)

#### 4A: Next.js App Router (`app/api/webhooks/180-pay/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import { constructWebhookEvent } from '@workspace/identity-sdk';

export async function POST(req: Request) {
  try {
    // 1. Read raw body as text before any JSON parser runs
    const rawBody = await req.text();
    const signature = req.headers.get('x-180-signature');
    const timestamp = req.headers.get('x-180-timestamp');

    // 2. Turnkey 1-line verification (handles 5-min replay defense + raw bytes HMAC-SHA256)
    const event = constructWebhookEvent(
      rawBody,
      signature,
      process.env.ONE_EIGHTY_WEBHOOK_SECRET!,
      timestamp
    );

    // 3. Fulfill user entitlement idempotently
    if (event.event === 'payment.captured') {
      const { orderId, amount, currency, customerEmail } = event.data;
      console.log(`Payment captured for order ${orderId}: ${currency} ${amount}`);
      // await fulfillOrder(orderId);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook verification error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
```

#### 4B: Node.js Fastify 5.x Server
```typescript
import Fastify from 'fastify';
import rawBody from '@fastify/raw-body';
import { constructWebhookEvent } from '@workspace/identity-sdk';

const fastify = Fastify();

// CRITICAL: Fastify re-serializes JSON by default, altering byte order.
// Register @fastify/raw-body to preserve unparsed buffer:
await fastify.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

fastify.post('/api/webhooks/180-pay', { config: { rawBody: true } }, async (req, reply) => {
  try {
    const event = constructWebhookEvent(
      (req as any).rawBody,
      req.headers['x-180-signature'] as string,
      process.env.ONE_EIGHTY_WEBHOOK_SECRET!,
      req.headers['x-180-timestamp'] as string
    );

    if (event.event === 'payment.captured') {
      // Fulfill order in database
    }
    return reply.status(200).send({ received: true });
  } catch (err: any) {
    return reply.status(401).send({ error: err.message });
  }
});
```

#### 4C: Node.js Express Server
```javascript
const express = require('express');
const { constructWebhookEvent } = require('@workspace/identity-sdk');
const app = express();

// CRITICAL: Mount raw body parser specifically on webhook route BEFORE express.json()
app.post(
  '/api/webhooks/180-pay',
  express.raw({ type: '*/*' }),
  (req, res) => {
    try {
      const rawBody = req.body.toString('utf8');
      const event = constructWebhookEvent(
        rawBody,
        req.headers['x-180-signature'],
        process.env.ONE_EIGHTY_WEBHOOK_SECRET,
        req.headers['x-180-timestamp']
      );

      if (event.event === 'payment.captured') {
        // Fulfill order
      }
      res.json({ received: true });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  }
);

// Standard body parser for all other routes
app.use(express.json());
```

#### 4D: Python FastAPI Backend
```python
import hmac
import hashlib
import time
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET"

@app.post("/api/webhooks/180-pay")
async def handle_180_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-180-signature")
    timestamp = request.headers.get("x-180-timestamp")

    if not signature or not timestamp:
        raise HTTPException(status_code=400, detail="Missing security headers")

    # 1. Replay attack defense (< 300 seconds)
    if abs(int(time.time()) - int(timestamp)) > 300:
        raise HTTPException(status_code=401, detail="Webhook timestamp expired")

    # 2. Compute canonical HMAC-SHA256 signature
    sign_payload = f"{timestamp}.{raw_body.decode('utf-8')}".encode("utf-8")
    expected_sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), sign_payload, hashlib.sha256).hexdigest()

    # 3. Constant-time comparison
    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    payload = await request.json()
    if payload.get("event") == "payment.captured":
        print(f"Fulfilling order: {payload.get('data')}")

    return {"received": True}
```

---

### Step 5: Flutter 3.24+ / Dart 3.5+ Mobile Integration

#### A. In-App WebView with JavaScript Channels (`OneEightyMobileChannel` & `OneEightyPaymentChannel`):
```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

InAppWebView(
  initialUrlRequest: URLRequest(url: WebUri("https://profile.180core.cloud/auth/login?client_id=$clientId&redirect_uri=$redirectUri")),
  onWebViewCreated: (controller) {
    controller.addJavaScriptHandler(
      handlerName: 'OneEightyMobileChannel',
      callback: (args) {
        final data = jsonDecode(args[0]);
        if (data['type'] == '180_IDENTITY_SUCCESS') {
          // Handle authentication code/token
        }
      },
    );
    controller.addJavaScriptHandler(
      handlerName: 'OneEightyPaymentChannel',
      callback: (args) {
        final data = jsonDecode(args[0]);
        if (data['type'] == '180_PAYMENT_SUCCESS') {
          // Handle payment confirmation
        }
      },
    );
  },
)
```

#### B. Custom URI Scheme Registration:
- Android (`AndroidManifest.xml`): `<data android:scheme="myapp" android:host="oauth" />` & `<data android:scheme="myapp" android:host="payment" />`
- iOS (`Info.plist`): Add `myapp` under `CFBundleURLSchemes`
- Developer Console: Register `myapp://oauth/callback` and `myapp://payment/callback` at `https://developer.180core.cloud`

#### C. Lightweight `url_launcher` Fallback Service:
```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OneEightyIntegrationService {
  static const String hostedAuthUrl = 'https://profile.180core.cloud/auth/login';
  static const String hostedCheckoutUrl = 'https://profile.180core.cloud/checkout';

  /// Launch Universal 180 Identity SSO
  static Future<bool> launchHostedLogin({
    required String clientId,
    required String redirectUri,
    String scope = 'openid identity:read identity:email identity:phone',
  }) async {
    final uri = Uri.parse(
      '$hostedAuthUrl?client_id=$clientId&redirect_uri=${Uri.encodeComponent(redirectUri)}&response_type=code&scope=${Uri.encodeComponent(scope)}&ux_mode=bottom_sheet',
    );
    return await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
  }

  /// Launch 180 Pay Sovereign 1-Click Checkout
  static Future<bool> launchCheckout({
    required String orderId,
    required num amountInRupees, // WHOLE UNITS (e.g. 499 for ₹499)
    required String title,
    required String returnUrl,
    String currency = 'INR',
    String? clientId,
  }) async {
    final uri = Uri.parse(
      '$hostedCheckoutUrl?amount=$amountInRupees&currency=$currency&title=${Uri.encodeComponent(title)}&order_id=$orderId&return_url=${Uri.encodeComponent(returnUrl)}',
    );
    return await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
  }
}
```

---

Now inspect my current codebase, detect the framework, and write the files cleanly matching my project's conventions.
```

---

## How to Use with Cursor or Antigravity

1. Open your project in **Cursor** or **Antigravity**.
2. Press `Cmd + L` (or `Ctrl + L`) to open the Composer / Chat window.
3. Paste the prompt above.
4. Replace `YOUR_CLIENT_ID`, `YOUR_CLIENT_SECRET`, and `YOUR_WEBHOOK_SECRET` with the credentials from your [180 Developer Console](https://developer.180core.cloud).
5. Watch the AI automatically generate all frontend components, backend handlers, and webhook verification routes in 30 seconds!
