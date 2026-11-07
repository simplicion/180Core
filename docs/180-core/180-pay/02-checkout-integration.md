---
id: checkout-integration
title: Checkout Integration & Server-Side Sessions
sidebar_label: Checkout & Embeds
sidebar_position: 2
description: Complete guide to initiating 180 Pay checkouts via server-side signed sessions (POST /api/v1/pay/checkout-session), in-DOM bottom sheets, pricing tables, and Flutter mobile apps.
---

# Checkout Integration & Server-Side Sessions

180 Pay provides flexible integration patterns for web, mobile, and server architectures:
1. **Server-Side Signed Checkout Session API (`POST /api/v1/pay/checkout-session`)** — *Recommended*
2. **Interactive In-DOM Client Drawer (`OneEightyPay.openBottomSheet`)**
3. **Embeddable Sovereign Pricing Table (`<one-eighty-pricing-table>` & React Component)**
4. **Mobile & Flutter Integration (with `url_launcher`)**

:::caution ⚠️ CRITICAL: Strictly Whole Currency Units
Always specify `amount` in whole currency units (e.g., `amount: 499` for ₹499 INR, or `amount: 49.00` for $49.00 USD).  
**Do NOT multiply by 100.** Passing `49900` will charge the customer ₹49,900.
:::

---

## 1. Server-to-Server Checkout Session API

Creating a checkout session on your server prevents client-side price tampering and allows you to attach secure business logic, customer emails, and order IDs.

### Canonical Endpoint
- **URL**: `POST https://api.180core.cloud/api/v1/pay/checkout-session`
- *Alias (Backward Compatible)*: `POST https://api.180core.cloud/api/v1/checkout/sessions`
- **Hosted Checkout Destination**: `https://profile.180core.cloud/checkout?sessionId={sessionId}`

### Authentication
Authenticate with either:
- HTTP Header: `Authorization: Bearer <YOUR_CLIENT_SECRET>`
- Or Request Body: `"client_secret": "<YOUR_CLIENT_SECRET>"`

### Request Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`client_id`** | string | Yes | Your Application Client ID (`180_client_...`) |
| **`amount`** | number | Yes | **Whole currency units** (e.g. `499` for ₹499 INR, `29.00` for $29 USD). |
| **`currency`** | string | Yes | 3-letter ISO currency code (`INR`, `USD`, `EUR`, `GBP`, etc.). |
| **`title`** | string | Yes | Product or subscription title shown on checkout UI. |
| **`order_id`** | string | Yes | Unique order ID from your database (e.g., `ord_98765`). |
| **`return_url`** | string | Yes | Redirect destination upon payment completion. |
| **`cancel_url`** | string | No | Redirect destination if user cancels or navigates back. |
| **`plan_code`** | string | No | Subscription plan identifier (e.g. `pro_monthly`). |
| **`mode`** | string | No | `"payment"` (one-time) or `"subscription"` (recurring). Default is `"payment"`. |
| **`metadata`** | object | No | Custom key-value pairs preserved throughout webhooks. |

### HTTP Request Example
```http
POST /api/v1/pay/checkout-session HTTP/1.1
Host: api.180core.cloud
Authorization: Bearer 180_secret_live_79a8bc43d2e1f0...
Content-Type: application/json

{
  "client_id": "180_client_b26aee801c22cb3295f041ff2a3597db",
  "amount": 499,
  "currency": "INR",
  "title": "Pro Armor Annual Pass",
  "order_id": "ord_20261017_001",
  "return_url": "https://yourapp.com/checkout/success?order_id=ord_20261017_001",
  "cancel_url": "https://yourapp.com/pricing",
  "metadata": {
    "customerEmail": "alex@startup.io",
    "organizationId": "org_456"
  }
}
```

### Response Example
```json
{
  "success": true,
  "sessionId": "cs_08ba67aa9755_9a1b8c7d",
  "checkoutUrl": "https://profile.180core.cloud/checkout?sessionId=cs_08ba67aa9755_9a1b8c7d",
  "amount": 499,
  "currency": "INR",
  "status": "PENDING"
}
```

---

## 2. Server Implementation Examples

### A. Node.js (Fastify 5.x)
```typescript
import Fastify from 'fastify';

const fastify = Fastify();

fastify.post('/api/create-checkout', async (request, reply) => {
  const { orderId, amount, customerEmail } = request.body as any;

  const res = await fetch('https://api.180core.cloud/api/v1/pay/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ONE_EIGHTY_CLIENT_SECRET}`
    },
    body: JSON.stringify({
      client_id: process.env.ONE_EIGHTY_CLIENT_ID,
      amount: amount, // Whole currency units (e.g. 499)
      currency: 'INR',
      title: 'Pro Subscription',
      order_id: orderId,
      return_url: 'https://myapp.com/checkout/success',
      cancel_url: 'https://myapp.com/checkout/cancel',
      metadata: { customerEmail }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    return reply.status(res.status).send({ error: data.error || 'Failed to create session' });
  }

  return reply.send({ checkoutUrl: data.checkoutUrl, sessionId: data.sessionId });
});
```

### B. Node.js (Express)
```javascript
const express = require('express');
const router = express.Router();

router.post('/api/checkout/session', async (req, res) => {
  try {
    const response = await fetch('https://api.180core.cloud/api/v1/pay/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ONE_EIGHTY_CLIENT_SECRET}`
      },
      body: JSON.stringify({
        client_id: process.env.ONE_EIGHTY_CLIENT_ID,
        amount: 499, // Whole currency units
        currency: 'INR',
        title: req.body.title || 'Pro Plan',
        order_id: req.body.orderId,
        return_url: `${req.protocol}://${req.get('host')}/success`,
        metadata: { customerId: req.body.customerId }
      })
    });

    const session = await response.json();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### C. Python (FastAPI)
```python
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class CheckoutRequest(BaseModel):
    order_id: str
    amount: float
    title: str

@router.post("/api/checkout/session")
async def create_checkout_session(payload: CheckoutRequest):
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.180core.cloud/api/v1/pay/checkout-session",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {os.environ['ONE_EIGHTY_CLIENT_SECRET']}"
            },
            json={
                "client_id": os.environ["ONE_EIGHTY_CLIENT_ID"],
                "amount": payload.amount, # Whole currency units
                "currency": "INR",
                "title": payload.title,
                "order_id": payload.order_id,
                "return_url": "https://myapp.com/success",
                "cancel_url": "https://myapp.com/cancel"
            }
        )
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail="Checkout session creation failed")
        return res.json()
```

---

## 3. Client Drawer Method (Direct SPA)

For fast web SPAs without an upfront backend roundtrip, open the drawer directly in the client DOM:

```tsx
import { OneEightyPay } from '@workspace/identity-sdk';

export function CheckoutButton() {
  const handleCheckout = () => {
    OneEightyPay.openBottomSheet({
      amount: 499, // Whole currency units (₹499 INR or $49.00 USD)
      currency: 'INR',
      title: 'Pro Armor Upgrade',
      orderId: 'ord_' + Date.now(),
      onSuccess: (res) => {
        console.log('Payment confirmed! Transaction:', res.transactionId);
        window.location.href = '/dashboard?upgraded=true';
      },
      onCancel: () => console.log('Checkout dismissed'),
    });
  };

  return <button onClick={handleCheckout}>Pay ₹499</button>;
}
```

---

## 4. Flutter 3.24+ / Dart 3.5+ Mobile Integration

Mobile applications can integrate 180 Pay Sovereign Checkout using either In-App WebViews with direct JavaScript bridges or external Custom Tabs with custom URI schemes.

### A. In-App WebView with JavaScript Bridge (`OneEightyPaymentChannel`) — Recommended

This pattern provides a seamless, zero-redirect experience where payment confirmation is communicated directly to Flutter without leaving the view:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

class OneEightyPaymentWebView extends StatelessWidget {
  final String sessionId; // Created via POST /api/v1/pay/checkout-session

  const OneEightyPaymentWebView({super.key, required this.sessionId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('180 Sovereign Checkout')),
      body: InAppWebView(
        initialUrlRequest: URLRequest(
          url: WebUri("https://profile.180core.cloud/checkout/$sessionId"),
        ),
        onWebViewCreated: (controller) {
          // Listen for 180 Pay capture events
          controller.addJavaScriptHandler(
            handlerName: 'OneEightyPaymentChannel',
            callback: (args) {
              final data = jsonDecode(args[0]);
              if (data['type'] == '180_PAYMENT_SUCCESS') {
                // Return transaction data to your Flutter state
                Navigator.pop(context, {
                  'status': 'success',
                  'transactionId': data['transactionId'],
                  'amount': data['amount'],
                });
              }
            },
          );
        },
      ),
    );
  }
}
```

### B. Custom URI Scheme Redirection (`myapp://payment/callback`)

When 180 Pay completes payment in a mobile webview or custom tab, it redirects back to your registered custom URI scheme with full transaction parameters:
```text
myapp://payment/callback?status=success&session_id=cs_08ba67aa9755_9a1b8c7d&amount=499&order_id=ord_12345
```

#### Android Configuration (`AndroidManifest.xml`)
```xml
<activity android:name=".MainActivity" android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" android:host="payment" />
  </intent-filter>
</activity>
```

#### iOS Configuration (`Info.plist`)
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

#### Register in Console
Register `myapp://payment/callback` as an **Allowed Redirect URI** in the [180 Developer Console](https://developer.180core.cloud).

### C. Lightweight `url_launcher` Fallback

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OneEightyPayService {
  static const String hostedCheckoutUrl = 'https://profile.180core.cloud/checkout';

  /// Launches the 180 Pay Sovereign Checkout in an in-app browser view
  static Future<bool> launchCheckout({
    required String orderId,
    required num amountInRupees, // Whole currency units (e.g. 499)
    required String title,
    required String returnUrl,
    String currency = 'INR',
    String? clientId,
  }) async {
    final queryParams = {
      'amount': amountInRupees.toString(),
      'currency': currency,
      'title': title,
      'order_id': orderId,
      'return_url': returnUrl,
      if (clientId != null) 'clientId': clientId,
    };

    final uri = Uri.parse(hostedCheckoutUrl).replace(queryParameters: queryParams);

    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    } else {
      throw Exception('Could not launch 180 Pay checkout: $uri');
    }
  }
}
```

---

## 5. Embeddable Sovereign Pricing Table

Embed customizable pricing tiers generated in the **180 Developer Console -> Pricing Tables Studio**:

### Option A: React / Next.js Component
```tsx
import { OneEightyPricingTable } from '@workspace/identity-sdk';

export function PricingSection() {
  return (
    <OneEightyPricingTable
      appId="YOUR_APP_ID"
      theme="auto"
      accentColor="#6366f1"
      onSelectPlan={(plan) => console.log('Selected:', plan)}
    />
  );
}
```

### Option B: Zero-Framework Sovereign Web Component
```html
<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.js" async></script>

<one-eighty-pricing-table
  app-id="YOUR_APP_ID"
  theme="auto"
  accent-color="#6366f1">
</one-eighty-pricing-table>
```

Next, configure your webhook endpoint in [Webhook Integration Guide](./webhook-integration) to receive automated capture events.
