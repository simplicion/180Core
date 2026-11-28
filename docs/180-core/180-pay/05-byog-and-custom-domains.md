---
id: byog-and-custom-domains
title: Bring Your Own Gateway & Custom Domains
sidebar_label: BYOG & Custom Domains
sidebar_position: 5
description: Connect custom Razorpay, Stripe or Paytm for Business merchant accounts and whitelist branded custom payment subdomains.
---

# Bring Your Own Gateway & Custom Domains

Enterprise and high-volume developers can process payments directly through their existing corporate gateway accounts and route checkouts through custom branded subdomains.

---

## 1. Bring Your Own Gateway (BYOG)

In your **[180 Developer Console](https://developer.180core.cloud) -> your app -> Pay -> Gateways**, choose your gateway provider:

| Gateway Type | Credentials Required | Benefit |
| :--- | :--- | :--- |
| **180 Sovereign Vault (Default)** | None | Zero gateway maintenance, 1-click startup, instant payouts. |
| **Razorpay (India / APAC)** | `Key ID`, `Key Secret`, `Webhook Secret` | Funds deposit directly into your company's own Indian bank account. |
| **Stripe (Global / US / EU)** | `Publishable Key`, `Secret Key`, `Webhook Secret` | Process credit cards under your company's direct merchant descriptor. |
| **Paytm for Business (Direct UPI)** | Paytm Business `UPI ID`, Production `MID`, `Merchant Key` | 0% UPI payments straight to your bank, confirmed automatically via Paytm's status API. See [Direct UPI & Paytm Business](./09-direct-upi-and-paytm-business.md). |

One custom gateway can be active per app: Paytm for Business and a custom Razorpay/Stripe account cannot be combined on the same app.

---

## 2. Custom Branded Pay Domain

Deliver a 100% white-label checkout experience by mapping your own domain (e.g., `pay.yourbrand.com`):

### DNS Configuration Step:
Add a `CNAME` record in your DNS provider (Cloudflare, GoDaddy, AWS Route53):

| Record Type | Host | Points To | TTL |
| :--- | :--- | :--- | :--- |
| `CNAME` | `pay` | `cname.180workspace.com` | Auto (or 300s) |

### Verification:
1. In Developer Console, enter `pay.yourbrand.com` and click **Verify DNS**.
2. 180 Core's edge network issues an automated TLS/SSL certificate via Let's Encrypt / Cloudflare for your subdomain.
3. Your checkout sheets and payment URLs will now load under `https://pay.yourbrand.com`.
