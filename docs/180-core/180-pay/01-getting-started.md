---
id: getting-started
title: 180 Pay Quickstart & Architecture
sidebar_label: 180 Pay Overview
sidebar_position: 1
description: The complete guide to 1-Click Sovereign Checkout, whole currency standards, dual-domain ecosystem architecture, and frictionless payment collection.
---

# 180 Pay Quickstart & Architecture

> Looking for the public product overview, pricing calculator, and competitor comparisons? Visit the [180 Pay Sovereign 0.8% UPI & Subscription Platform](https://180workspace.com/180-pay).

**180 Pay** is a universal 1-click checkout engine built specifically for developers, SaaS founders, and creators. It replaces bulky checkout flows and merchant registration hurdles with a unified, sovereign checkout experience.

:::danger ⚠️ CRITICAL RULE: Strictly Whole Currency Units (No Paise / Cents)
Unlike legacy gateways (Stripe, Razorpay, Cashfree) that mandate amounts in smallest currency subunits (e.g. passing `49900` paise for ₹499 INR or cents for $49.00 USD), **180 Pay universally operates on whole currency units**:
- **Correct**: `amount: 499` for ₹499.00 INR, or `amount: 49.00` for $49.00 USD.
- **Danger**: Passing `amount: 49900` without unit flags will generate an order for **₹49,900**!

*Safety Net*: If you are migrating existing Stripe/Razorpay code and pass `amountInPaise: 49900` or `amount_in_cents: 4990`, 180 Pay backend automatically detects the legacy parameter, safely converts it to whole units (499), and logs a diagnostic warning.
:::

:::tip Universal Parameter Normalization
180 Core's payment engine universally accepts both snake_case and camelCase parameters:
- `order_id` ↔ `orderId`
- `return_url` ↔ `returnUrl`
- `cancel_url` ↔ `cancelUrl`
- `session_id` ↔ `sessionId`
- `coupon_code` ↔ `couponCode` / `coupon`
- `client_id` ↔ `clientId`
:::

---

## 💡 The "Zero Custom Screen" Mandate (Zero UI Requirement)

**Is any custom payment screen required? NO.**

Developers do **NOT** build, style, or maintain:
- ❌ Payment method selector screens
- ❌ Credit / Debit card input forms
- ❌ UPI QR codes or Intent triggers
- ❌ Coupon code validation & discount math
- ❌ World Bank PPP purchasing power parity currency conversion logic
- ❌ 3D Secure OTP verification screens
- ❌ Receipt generation & fulfillment screens

### How It Integrates (4 Pre-Built Options):
1. **Adaptive Bottom Sheet / Modal (Web)**: Call `OneEightyPay.checkout({ amount: 499, currency: 'INR' })`. The bottom sheet slides up in under 45ms, handles method selection (UPI, Cards, Netbanking, Prepaid Wallet, PPP Discounts), and resolves securely.
2. **Hosted Checkout Screen (Mobile WebViews)**: Open `https://profile.180core.cloud/checkout/:sessionId`. On payment capture, 180 Pay posts to `OneEightyPaymentChannel` and redirects back to the mobile custom scheme (`myapp://payment/callback?status=success&session_id=...&amount=499`) with full transaction query parameters.
3. **Shareable Payment Links (`/pay/l/:slug`)**: Completely zero-code. Generate a link in your console and share it anywhere.
4. **Drop-in Component**: `<one-eighty-pay-button amount="499" currency="INR" title="Upgrade Now"></one-eighty-pay-button>`.

---

## 🌐 Authoritative Dual-Domain Ecosystem Directory

To prevent 404s, CORS rejections, and routing confusion, 180 Core strictly segments browser-facing user interfaces from backend engine APIs:

| Domain | Role & Purpose | Canonical Endpoints |
| :--- | :--- | :--- |
| **`profile.180core.cloud`** | **Hosted User Interfaces & CDN SDK**<br/>(1-Click Sovereign Checkout, Universal SSO, Customer Portal) | `GET /checkout?clientId=...`<br/>`GET /checkout?sessionId=...`<br/>`GET /auth/login`<br/>`GET /sdk/v1/180-core-sdk.js` |
| **`api.180core.cloud`** | **Core Engine REST APIs**<br/>(Server-to-Server Session Creation, Code Exchange & JWKS) | `POST /api/v1/pay/checkout-session`<br/>`POST /api/oauth/token`<br/>`GET /api/oauth/userinfo`<br/>`GET /certs/jwks.json` |
| **`developer.180core.cloud`** | **Developer Management Console** | API Keys, Webhook URL Config, Allowed Origins |

---

## ⚡ The Two Checkout Initiation Patterns

180 Pay provides two flexible patterns to initiate checkout depending on your architecture:

```mermaid
graph TD
    subgraph Pattern A: Server-Side Signed Session (Recommended)
        A1[Frontend App] -->|1. Request Checkout| A2[Your Backend Server]
        A2 -->|2. POST /api/v1/pay/checkout-session| A3[180 Core API Engine]
        A3 -->|3. Signed sessionId + checkoutUrl| A2
        A2 -->|4. Return checkoutUrl| A1
        A1 -->|5. Open Hosted Checkout URL| A4[profile.180core.cloud/checkout]
    end

    subgraph Pattern B: In-DOM Client Bottom Sheet (Fastest SPA)
        B1[Frontend App] -->|OneEightyPay.openBottomSheet| B2[In-DOM Responsive Sheet]
        B2 -->|Direct Capture & QR| A3
    end
```

### Pattern A: Server-Side Signed Session (Recommended for Web & Mobile)
Your backend calls the 180 Core REST API with your confidential secret key to create a signed session. This prevents client-side price tampering and supports custom fulfillment metadata:

```typescript
// Backend (Node.js / Express / Fastify / Next.js)
const response = await fetch('https://api.180core.cloud/api/v1/pay/checkout-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.ONE_EIGHTY_CLIENT_SECRET}`
  },
  body: JSON.stringify({
    client_id: process.env.NEXT_PUBLIC_180_CLIENT_ID,
    amount: 499, // Whole currency units (₹499 INR)
    currency: 'INR',
    title: 'Annual Pro Subscription',
    order_id: 'ord_' + Date.now(),
    return_url: 'https://yourapp.com/checkout/success',
    cancel_url: 'https://yourapp.com/checkout/cancel',
    metadata: { customerEmail: 'buyer@example.com' }
  })
});

const { sessionId, checkoutUrl } = await response.json();
// Direct your client to: checkoutUrl
```

### Pattern B: In-DOM Client Bottom Sheet (Direct Web SPA)
For Single Page Applications, trigger the non-blocking in-DOM slide-up sheet with zero popup blocker interference:

```tsx
import { OneEightyPay } from '@workspace/identity-sdk';

export function PurchaseButton() {
  const handlePay = () => {
    OneEightyPay.openBottomSheet({
      amount: 499, // Whole units: ₹499 INR or $49.00 USD
      currency: 'INR',
      title: 'Pro Armor Upgrade',
      orderId: 'ord_12345',
      onSuccess: (data) => {
        console.log('Payment Successful! Transaction ID:', data.transactionId);
        window.location.href = '/dashboard?upgraded=true';
      },
      onCancel: () => {
        console.log('User dismissed checkout sheet');
      },
    });
  };

  return <button onClick={handlePay}>Upgrade to Pro (₹499)</button>;
}
```

---

## 🔒 Automated Webhook Fulfillment (1 Line)

Never fulfill user entitlements based only on client callbacks. Use 180 Pay's turnkey `constructWebhookEvent` helper to verify incoming HMAC-SHA256 signatures with automatic 5-minute replay defense:

```typescript
import { constructWebhookEvent } from '@workspace/identity-sdk';

// Next.js App Router / Express / Fastify handler
app.post('/api/webhooks/180-pay', async (req, res) => {
  const event = constructWebhookEvent(
    req.rawBody,
    req.headers['x-180-signature'],
    process.env.ONE_EIGHTY_WEBHOOK_SECRET!,
    req.headers['x-180-timestamp']
  );

  if (event.event === 'payment.captured') {
    const { orderId, amount, currency, customerEmail } = event.data;
    await fulfillOrderInDatabase(orderId);
  }

  res.json({ received: true });
});
```

Explore the comprehensive [Checkout Integration Guide](./checkout-integration) for parameter schemas and Flutter integration, or read the [Webhook Verification Protocol](./webhook-integration).
