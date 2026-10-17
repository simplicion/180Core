import fs from 'fs';
import path from 'path';

const PUBLIC_SITES_ROOT = 'C:\\Users\\saavi\\Desktop\\180 Project\\180 public sites';

console.log('================================================================');
console.log('📝 Updating Documentation with Zero Custom Screen Requirement');
console.log('================================================================\n');

// 1. 180-identity/01-getting-started.md
const idFile = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/01-getting-started.md');
if (fs.existsSync(idFile)) {
  let content = fs.readFileSync(idFile, 'utf8');
  const zeroUiIdentity = `
## 💡 Do You Need to Build Any Custom Screens? (Zero UI Requirement)

**Answer: NO. You do not need to create or maintain ANY custom screen.**

When integrating 180 Identity into your application (whether Web, Mobile, or Desktop), all authentication UI and user lifecycle flows are **100% pre-built, hosted, and secure out-of-the-box**:

- **Pre-Built Screens Handled Entirely by 180 Sovereign Cloud**:
  - Sign-in, Sign-up, and User Registration screens
  - WhatsApp 1-Tap OTP verification
  - Biometric Passkey / WebAuthn registration & verification
  - Magic Link / Email OTP screens
  - Social Logins (Google, GitHub, Microsoft)
  - Multi-Factor / Two-Factor Authentication (2FA) verification
  - Password reset, forgot password, and account recovery flows
  - OAuth 2.0 Consent & Permission grant dialogs

- **How It Displays in Your Application**:
  1. **In-DOM Bottom Sheet / Glass Modal (Web & Hybrid)**: With 1 line of code (\`OneEightyIdentity.openBottomSheet({ clientId: '...' })\`), 180 Identity displays an adaptive bottom sheet on mobile devices and an ultra-sleek glassmorphism modal on desktop. Users never leave your website or application.
  2. **Pre-Built Drop-in Button Component**: Include \`<one-eighty-auth-button>\` (HTML / Web Components) or \`<OneEightyButton />\` (React) for an immediate, branded, animated login button that manages the entire lifecycle.
  3. **Hosted Cloud Screen (Native Mobile — Flutter, React Native, Android, iOS)**: Open \`https://profile.180core.cloud/auth/login?client_id=YOUR_CLIENT_ID\` inside an In-App WebView (e.g. \`flutter_inappwebview\`) or Custom Tab. Once the user signs in, 180 Identity automatically communicates with your mobile app via deep link redirect (\`myapp://oauth/callback?code=...\`) or the \`OneEightyMobileChannel\` JavaScript bridge.
`;

  if (!content.includes('Do You Need to Build Any Custom Screens?')) {
    content = content.replace('## 🚀 The New Reality: Integrated in 60 Seconds', `${zeroUiIdentity}\n## 🚀 The New Reality: Integrated in 60 Seconds`);
    fs.writeFileSync(idFile, content, 'utf8');
    console.log(`✅ [UPDATED] ${idFile}`);
  } else {
    console.log(`ℹ️ [ALREADY PRESENT] ${idFile}`);
  }
}

// 2. 180-identity/02-universal-login-and-sso.md
const idFile2 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/02-universal-login-and-sso.md');
if (fs.existsSync(idFile2)) {
  let content = fs.readFileSync(idFile2, 'utf8');
  const zeroUiCallout = `
:::info 💡 Zero Custom UI / Screen Requirement
You do **not** need to design or build custom login, OTP, registration, or password reset screens. 180 Identity provides pre-built, responsive, and branded login surfaces across Bottom Sheet (\`bottom_sheet\`), Popup (\`popup\`), Full Page (\`full_page\`), and Native Mobile WebViews (\`profile.180core.cloud/auth/login\`).
:::
`;
  if (!content.includes('Zero Custom UI / Screen Requirement')) {
    content = content.replace('# Universal Login & Single Sign-On', `# Universal Login & Single Sign-On\n${zeroUiCallout}`);
    fs.writeFileSync(idFile2, content, 'utf8');
    console.log(`✅ [UPDATED] ${idFile2}`);
  }
}

// 3. 180-pay/01-getting-started.md
const payFile = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-pay/01-getting-started.md');
if (fs.existsSync(payFile)) {
  let content = fs.readFileSync(payFile, 'utf8');
  const zeroUiPay = `
## 💡 Do You Need to Build Any Custom Payment Screens? (Zero Checkout UI Requirement)

**Answer: NO. You do not need to create or maintain ANY payment, card, or checkout screens.**

When integrating 180 Pay into your store, SaaS, or mobile app, the entire checkout and payment experience is **100% handled out-of-the-box**:

- **Pre-Built Payment Flows Handled Entirely by 180 Pay**:
  - Universal Payment Method selection (Instant UPI QR, UPI Intent, Credit/Debit Cards, Netbanking, International Wallets)
  - 180 Sovereign Prepaid Wallet 1-click balance deduction
  - Dynamic World Bank PPP (Purchasing Power Parity) localized currency & pricing
  - Coupon code entry, validation, and real-time discount calculation
  - Payment gateway invocation, 3D Secure OTP authentication, and cryptographic signature verification
  - Automated digital fulfillment secret reveal & downloadable payment receipts

- **How It Displays in Your Application**:
  1. **Adaptive Bottom Sheet / Glass Dialog (Web & Hybrid)**: Call \`OneEightyPay.checkout({ amount: 499, currency: 'INR' })\`. A bottom sheet slides up on mobile and a modal opens on desktop. No cart redirects, zero customer drop-off.
  2. **Hosted Checkout Screen (Native Mobile — Flutter, React Native, iOS, Android)**: Open \`https://profile.180core.cloud/checkout/:sessionId\` inside your In-App WebView. On success, 180 Pay automatically dispatches the \`OneEightyPaymentChannel\` event and redirects to your mobile custom scheme (\`myapp://payment/callback?status=success&session_id=...&amount=499\`).
  3. **Shareable Payment Links (\`/pay/l/:slug\`)\**: Completely zero-code. Generate a link from the Developer Console and share it anywhere.
  4. **Drop-in Web Component**: \`<one-eighty-pay-button amount="499" currency="INR" title="Upgrade Now"></one-eighty-pay-button>\`.
`;

  if (!content.includes('Do You Need to Build Any Custom Payment Screens?')) {
    content = content.replace('## 🌐 Autonomous Dual-Domain Sovereign Architecture', `${zeroUiPay}\n## 🌐 Autonomous Dual-Domain Sovereign Architecture`);
    fs.writeFileSync(payFile, content, 'utf8');
    console.log(`✅ [UPDATED] ${payFile}`);
  } else {
    console.log(`ℹ️ [ALREADY PRESENT] ${payFile}`);
  }
}

// 4. 180-pay/02-checkout-integration.md
const payFile2 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-pay/02-checkout-integration.md');
if (fs.existsSync(payFile2)) {
  let content = fs.readFileSync(payFile2, 'utf8');
  const zeroUiPayCallout = `
:::info 💡 Zero Checkout UI / Screen Requirement
You do **not** need to design or build custom credit card forms, UPI input fields, or checkout screens. 180 Pay provides pre-built, responsive, and PCI-DSS compliant checkout surfaces across Adaptive Bottom Sheet (\`bottom_sheet\`), Popup Window (\`popup\`), Full Page (\`full_page\`), and Hosted Checkout (\`https://profile.180core.cloud/checkout/:sessionId\`).
:::
`;
  if (!content.includes('Zero Checkout UI / Screen Requirement')) {
    content = content.replace('# 1-Click Sovereign Checkout Integration', `# 1-Click Sovereign Checkout Integration\n${zeroUiPayCallout}`);
    fs.writeFileSync(payFile2, content, 'utf8');
    console.log(`✅ [UPDATED] ${payFile2}`);
  }
}

console.log('\n================================================================');
console.log('🎉 ZERO CUSTOM SCREEN DOCUMENTATION SUCCESSFULLY ADDED!');
console.log('================================================================');
