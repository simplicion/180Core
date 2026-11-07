---
id: coupons-and-geo-pricing
title: Coupons & Dynamic Geo-Pricing
sidebar_label: Coupons & Geo-Pricing
sidebar_position: 4
description: Configure promotional discount codes, country-specific pricing overrides, and automated PPP currency conversion.
---

# Coupons & Dynamic Geo-Pricing

Maximize global sales by offering localized purchasing power parity (PPP) and marketing discount codes.

---

## 1. Coupon & Discount Engine

Create promotional discount codes in the **180 Developer Console -> Coupons** tab or via API:

### Coupon Types
- **`PERCENTAGE`**: e.g., `20%` off order total with optional `maxDiscountAmount` cap.
- **`FIXED_AMOUNT`**: e.g., `$10.00` or `₹500` flat discount.

### Creating a Coupon via API:
```http
POST /api/v1/coupons
Host: api.180core.cloud
Authorization: Bearer <client_secret>
Content-Type: application/json

{
  "code": "LAUNCH50",
  "discountType": "PERCENTAGE",
  "discountValue": 50,
  "maxDiscountAmount": 25.00,
  "minOrderAmount": 10.00,
  "maxRedemptions": 100,
  "perCustomerLimit": 1,
  "validPlans": ["traffic-starter", "traffic-pro"]
}
```

### Validating Coupons in Frontend Checkout:
When passed into `OneEightyPay.openBottomSheet({ couponCode: "LAUNCH50" })`, 180 Pay validates expiration dates, redemption quotas, and per-user limits before applying the discounted balance.

---

## 2. Dynamic Geo-Pricing (Purchasing Power Parity)

Customers in emerging markets (India, Brazil, Southeast Asia) often convert at significantly higher rates when priced in local currency with parity discounts:

```mermaid
graph TD
    Visitor[Global Visitor] --> GeoLookup[180 Anycast Edge IP Lookup]
    GeoLookup -->|India (IN)| INR[₹1,999 / mo · 40% Parity Discount · UPI]
    GeoLookup -->|Brazil (BR)| BRL[R$ 129 / mo · Pix & Boleto]
    GeoLookup -->|US / Global| USD[$49 / mo · Credit Card]
```

### Configuring Geo-Pricing Overrides:
```http
POST /api/v1/geo-pricing
Host: api.180core.cloud
Authorization: Bearer <client_secret>
Content-Type: application/json

{
  "countryCode": "IN",
  "currency": "INR",
  "overrideType": "PERCENTAGE_DISCOUNT",
  "discountPct": 40,
  "planOverrides": {
    "traffic-starter": 1299,
    "traffic-pro": 2499
  }
}
```

When customers view your pricing table or checkout drawer, 180 Pay automatically detects their geolocation and renders their regional price.
