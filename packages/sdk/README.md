# @180workspace/sdk

Official Universal Client SDK for **180 Identity** (Single Sign-On & WhatsApp 1-Tap Auth) and **180 Pay** (Universal Sovereign Checkout).

[![npm version](https://img.shields.io/npm/v/@180workspace/sdk.svg)](https://www.npmjs.com/package/@180workspace/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

---

## Installation

```bash
npm install @180workspace/sdk
# or
pnpm add @180workspace/sdk
# or
yarn add @180workspace/sdk
```

---

## Quickstart

### 1. Next.js App Router & React ('use client')

```tsx
'use client';

import { OneEightyAuth } from '@180workspace/sdk';

export function LoginButton() {
  const handleLogin = async () => {
    await OneEightyAuth.signIn({
      clientId: process.env.NEXT_PUBLIC_180_CLIENT_ID!,
      uxMode: 'bottom_sheet', // Responsive bottom-sheet on mobile, sleek glass modal on desktop
      scope: 'openid identity:read identity:email',
      onSuccess: async (result) => {
        // Exchange authorization code on your backend
        await fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: result.code }),
        });
        window.location.href = '/dashboard';
      },
      onError: (err) => {
        console.error('Login failed:', err.message, err.hint);
      },
    });
  };

  return <button onClick={handleLogin}>Sign in with 180 Profile</button>;
}
```

### 2. Universal Sovereign Checkout (180 Pay)

```typescript
import { OneEightyPay } from '@180workspace/sdk';

// Trigger one-click bottom-sheet checkout
await OneEightyPay.checkout({
  amount: 29.99,
  currency: 'USD',
  planCode: 'pro_monthly',
  title: 'Pro Membership',
  uxMode: 'bottom_sheet',
  onSuccess: (payment) => {
    console.log('Payment successful:', payment.transactionId);
  },
});
```

---

## Server-Side Verification (Node.js / Express / Next.js API)

Exchange the authorization code for verified access tokens and user profile:

```typescript
// app/api/auth/exchange/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { code } = await req.json();

  const tokenResp = await fetch('https://services.180workspace.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.ONE_EIGHTY_CLIENT_ID,
      client_secret: process.env.ONE_EIGHTY_CLIENT_SECRET,
      redirect_uri: process.env.NEXT_PUBLIC_APP_URL + '/callback',
    }),
  });

  const { access_token, user } = await tokenResp.json();
  return NextResponse.json({ success: true, user });
}
```

---

## Documentation & Support

- **API Documentation**: [https://docs.180workspace.com](https://docs.180workspace.com)
- **Developer Portal**: [https://developers.180workspace.com](https://developers.180workspace.com)
- **Status Page**: [https://status.180workspace.com](https://status.180workspace.com)
