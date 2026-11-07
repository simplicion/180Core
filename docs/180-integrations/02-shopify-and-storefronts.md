---
id: shopify-and-storefronts
title: Shopify & Headless Storefront Integration Guide
sidebar_label: Shopify & Custom Stores
sidebar_position: 2
description: Complete architectural guide to 180 Pay on Shopify, explaining automatic payment verification, cryptographic capture, and instant order release.
---

# Shopify & Headless Storefront Integration Guide

Accepting payments with 180 Pay on **Shopify** and **custom storefronts** gives merchants sovereign 0.8% transaction rates with instant UPI and 180 Wallet payments.

This guide explains how **180 Pay cryptographically captures payments and automatically triggers order release / digital fulfillment in Shopify**.

---

## 1. How Shopify Automatically Captures Payment & Releases Orders

Because Shopify is a managed cloud platform, it cannot execute PHP plugins directly. Instead, 180 Pay integrates via the **Shopify Admin API (Draft Orders & Orders API)** to provide 100% automated order settlement and digital release:

```
Customer Taps "180 Pay" Button on Shopify Store
                   │
                   ▼
Responsive 180 Pay Bottom-Sheet Opens (Instant UPI / QR / Cards / 180 Wallet)
                   │
                   ▼
Customer Completes Payment
                   │
                   ▼
180 Pay Core Engine verifies cryptographic banking confirmation & HMAC
                   │
                   ▼
180 Pay Server calls Shopify Admin API:
POST https://{shop}.myshopify.com/admin/api/2024-01/draft_orders/{id}/complete.json
                   │
                   ▼
Shopify Transitions Order to "PAID"
                   ├── Native Shopify confirmation email sent to buyer
                   ├── Inventory automatically decremented
                   └── Digital downloads released / physical fulfillment triggered
```

---

## 2. Method 1: Turnkey No-Code (1-Click Buy Buttons & Payment Links)

For standard Shopify stores (Shopify Basic, Standard, Advanced):

### Step 1: Create a Payment Link in 180 Developer Console
1. In your [180 Developer Console](https://developer.180core.cloud), open your project and go to **180 Pay** → **Payment Links**.
2. Click **Create Payment Link**.
3. Set the product title (e.g. `Premium Leather Bag`), whole-currency amount (e.g. `₹1,499`), and product thumbnail.
4. Set the **Success Redirect URL** to your Shopify thank-you page:
   ```text
   https://your-shopify-store.myshopify.com/pages/order-confirmed
   ```
5. Click **Publish Link**. You will receive your sovereign checkout link:
   `https://pay.180core.cloud/p/lnk_88319f0`

### Step 2: Add 1-Click Buy Button to Shopify Theme
1. In Shopify Admin, open **Online Store** → **Themes** → **Customize**.
2. Navigate to your product page template.
3. Add a **Custom Liquid** block.
4. Paste the 180 Pay 1-Click button:
   ```html
   <!-- 180 Pay 1-Click Buy Button -->
   <a 
     href="https://pay.180core.cloud/p/lnk_88319f0?customer_email={{ customer.email | default: '' }}&customer_name={{ customer.name | default: '' }}"
     style="display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#09090b;color:#ffffff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.1);"
     target="_blank"
   >
     <span>Buy Now with 180 Pay (UPI / Cards)</span>
     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
   </a>
   ```

---

## 3. Method 2: Automatic Shopify Fulfillment via Webhook

When a payment succeeds on 180 Pay, you can verify and mark the order as paid in Shopify automatically:

### Webhook Listener Payload:
```json
{
  "event": "payment.succeeded",
  "transactionId": "txn_180_live_confirmed_9981",
  "orderId": "shopify_draft_91823901",
  "amount": 1499,
  "currency": "INR",
  "status": "COMPLETED",
  "metadata": {
    "shopify_draft_order_id": "91823901",
    "customer_email": "customer@example.com"
  }
}
```

### Shopify API Order Settlement (Node.js / Cloudflare Worker / Next.js):
```typescript
import crypto from 'crypto';

export async function handle180PayWebhook(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-180-signature');
  const secret = process.env.ONE_EIGHTY_CLIENT_SECRET!;

  // 1. Verify HMAC Signature
  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (signature !== expectedSignature) {
    return new Response('Invalid Signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event === 'payment.succeeded') {
    const draftOrderId = payload.metadata?.shopify_draft_order_id;

    // 2. Automatically complete Draft Order in Shopify
    await fetch(`https://${process.env.SHOPIFY_SHOP}.myshopify.com/admin/api/2024-01/draft_orders/${draftOrderId}/complete.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN!,
        'Content-Type': 'application/json',
      },
    });

    // Shopify marks order as PAID, decrements inventory, and releases digital goods!
    return new Response('Shopify order completed successfully', { status: 200 });
  }

  return new Response('Event ignored', { status: 200 });
}
```

---

## 4. Headless & Custom Storefronts (Next.js, Remix, Astro)

For headless storefronts, use the 180 Core SDK client-side modal or server session creation:

```typescript
import { OneEighty } from '@180core/sdk';

// Open Universal 180 Pay Bottom Sheet
const result = await OneEighty.pay.openBottomSheet({
  amount: 499,
  currency: 'INR',
  title: 'Annual Pro Subscription',
  orderId: 'sub_ord_4491',
});

if (result.status === 'completed') {
  console.log('Payment successful. Transaction ID:', result.transactionId);
}
```
