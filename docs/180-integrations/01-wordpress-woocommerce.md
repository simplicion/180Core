---
id: wordpress-woocommerce
title: WordPress & WooCommerce Integration (Official 180 Core Plugin)
sidebar_label: WordPress & WooCommerce
sidebar_position: 1
description: Complete guide to installing and configuring the official unified 180 Core plugin for universal payments, booking sites, donations, and WooCommerce checkouts.
---

# WordPress & WooCommerce Integration (Official 180 Core Plugin)

> **Official Release**: `v1.0.0 Unified` | **Requires**: WordPress 5.8+, PHP 7.4+ (Tested up to PHP 8.3 & WC 9.3)  
> **Direct Download**: Available in your [Developer Console](https://developer.180core.cloud) or download [`180-core.zip`](https://developer.180core.cloud/downloads/180-core.zip).

**180 Core** is the official unified plugin for WordPress and WooCommerce. Rather than forcing merchants to juggle multiple disjointed plugins, **`180-core.zip`** provides both **180 Identity** (Universal SSO via WhatsApp OTP/Google) and **180 Pay** (Universal Checkout Gateway & Standalone Payment Buttons) in a single turnkey package with independent feature toggles.

---

## 1. Zero-Setup Installation

1. In your project's **Developer Console** (`developer.180core.cloud/apps/[id]`), download **`180-core.zip`**.
2. In your WordPress Admin Dashboard, go to **Plugins** → **Add New** → **Upload Plugin**.
3. Select `180-core.zip`, click **Install Now**, and then **Activate Plugin**.
4. In the WordPress sidebar, open **180 Core**:
   - Paste your **Client ID** and **Client Secret**.
   - Toggle **180 Identity** and/or **180 Pay** according to your needs.
   - Click **Save Credentials**.

---

## 2. Universal Payments for ANY WordPress Site (No WooCommerce Required)

You do **not** need WooCommerce to accept payments with 180 Pay. If you are building a **booking website, consultation booking, event ticketing system, donation page, or custom service business**, you can drop universal 180 Pay buttons anywhere using shortcodes or the bundled JavaScript SDK.

### Standalone Shortcode:
```html
[180_pay amount="500" currency="INR" title="Dr. Sharma Consultation" text="Book Appointment for ₹500" redirect="/booking-confirmed"]
```

#### Shortcode Attributes:
| Attribute | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `amount` | Whole currency unit amount (Strict standard: ₹500 is `500`, not `50000`). | `0` | `amount="499"` |
| `currency` | 3-letter currency code (INR, USD, EUR, GBP). | `INR` | `currency="INR"` |
| `title` | Purpose or order title displayed in the 180 Pay bottom sheet. | `180 Pay Payment` | `title="Seat Reservation #14"` |
| `order_id` | Optional unique booking or reservation reference. | Auto-generated | `order_id="booking_oct27_01"` |
| `text` | Custom label on the button. | `Pay {amount} with 180 Pay` | `text="Reserve Seat for ₹750"` |
| `redirect` | Destination URL upon successful payment. | Current page | `redirect="/thank-you"` |

### Universal Bottom-Sheet UX:
When a customer clicks the payment button:
1. The bundled **180 Core SDK** opens the responsive, glassmorphic **180 Pay Bottom Sheet** right on the page (swipeable on mobile, centered modal on desktop).
2. The user pays via **Instant UPI, QR Code, Credit/Debit Cards, NetBanking, or 180 Sovereign Wallet**.
3. Upon success, the page redirects to your `redirect` URL with `180_status=paid` and transaction reference details.

### Developer Hooks (PHP & JavaScript):
You can listen to completed payments in your custom theme or booking plugin:

```php
// functions.php - Hook into standalone payments
add_action('180_pay_payment_completed', function($payload) {
    $order_id = sanitize_text_field($payload['orderId'] ?? $payload['order_id'] ?? '');
    $txn_id = sanitize_text_field($payload['transactionId'] ?? '');
    $amount = floatval($payload['amount'] ?? 0);

    // Confirm booking in your database, send customer email, or unlock digital access
    error_log("180 Pay payment confirmed for {$order_id}, Txn: {$txn_id}");
});
```

---

## 3. WooCommerce Store Checkout Gateway

If you run an eCommerce store with WooCommerce, 180 Core automatically registers the **180 Pay Gateway**:
1. Go to **WooCommerce** → **Settings** → **Payments** → **180 Pay**.
2. Verify **Enable 180 Pay** is checked.
3. Configure your order settlement status (`Processing` or `Completed`).
4. Copy the Webhook Listener URL:
   ```text
   https://yourdomain.com/?wc-api=wc_180pay_gateway
   ```
5. Paste it under **180 Pay** → **Webhooks** in your Developer Console.

### High-Performance eCommerce Features:
- **HPOS Compatible**: 100% compliant with WooCommerce High-Performance Order Storage (Custom Order Tables).
- **Strict Whole-Currency Units**: Automatically formats cart totals as whole numbers (`₹499.00` passed as `499`, never `49900` paise).
- **Instant Webhook Settlement**: Real-time transition from `Pending payment` to `Processing` with cryptographic HMAC-SHA256 signature verification.

---

## 4. 180 Identity (Universal Single Sign-On)

180 Identity eliminates password friction for your WordPress site or membership community:
- **WhatsApp 1-Tap OTP**: Users log in instantly via verified WhatsApp messages without waiting for SMS delivery delays.
- **Google SSO & Passkeys**: 1-click biometric sign-in on Android, iOS, and desktop browsers.
- **Auto-Registration**: Automatically creates new WordPress accounts for verified emails with safe role isolation (defends against privilege escalation).

### Login Shortcode:
```html
[180_login text="Sign in with 180 ID" redirect="/dashboard"]
```

---

## 5. Security & Cryptographic Integrity

- **Cryptographic HMAC Signatures**: Webhooks are verified using HMAC-SHA256 with timestamp replay attack mitigation (5-minute window).
- **Tamper-Proof OAuth State**: Login redirects are signed with HMAC using WordPress site salts, completely mitigating OAuth CSRF and open redirects.
- **CSP Compliant**: All click interactions use unobtrusive event delegation, conforming to strict Content Security Policies.
