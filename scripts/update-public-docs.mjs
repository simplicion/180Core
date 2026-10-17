import fs from 'fs';
import path from 'path';

const PUBLIC_SITES_ROOT = 'C:\\Users\\saavi\\Desktop\\180 Project\\180 public sites';

console.log('================================================================');
console.log('📝 180 PUBLIC SITES: AUDIT & DOCUMENTATION SYNCHRONIZATION');
console.log('================================================================\n');

// 1. 180-identity/01-getting-started.md
const file1 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/01-getting-started.md');
if (fs.existsSync(file1)) {
  let content = fs.readFileSync(file1, 'utf8');
  content = content.replace(
    /\|\s*\*\*`auth\.180workspace\.com`\*\*<br\/>\*\(\s*Mirror:\s*`profile\.180core\.cloud`\s*\)\*\s*\|\s*\*\*Hosted User Interfaces\*\*\s*<br\/>\(Universal SSO, 1-Click Sovereign Checkout\)\s*\|\s*`GET \/auth\/login`<br\/>`GET \/checkout`<br\/>`GET \/sdk\/v1\/180-core-sdk\.js`\s*\|/g,
    `| **\`profile.180core.cloud\`** | **Hosted User Interfaces & CDN SDK**<br/>(Universal SSO, WhatsApp 1-Tap OTP, 1-Click Sovereign Checkout) | \`GET /auth/login\`<br/>\`GET /checkout\`<br/>\`GET /sdk/v1/180-core-sdk.js\`<br/>\`GET /.well-known/openid-configuration\` |`
  );
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  
  // Add Cross-Platform & Parameter Normalization Note if not present
  if (!content.includes('Cross-Platform Mobile & Parameter Support')) {
    const tipSection = `

:::tip Cross-Platform Mobile & Parameter Support
- **Normalized Query Parameters**: 180 Core's OAuth engine seamlessly accepts both RFC 6749 \`snake_case\` (\`client_id\`, \`redirect_uri\`, \`response_type\`, \`code_challenge\`) and JavaScript \`camelCase\` (\`clientId\`, \`redirectUri\`, \`responseType\`, \`codeChallenge\`) to eliminate casing friction.
- **Compiled Mobile Frameworks (Flutter / React Native)**: The browser script bundle (\`180-core-sdk.js\`) is designed for HTML DOM manipulation. On compiled mobile platforms (Flutter Android/iOS), use In-App WebViews or Custom Tabs directing to \`https://profile.180core.cloud/auth/login\` and intercept redirect URI codes or listen to the \`OneEightyMobileChannel\` JavaScript bridge.
- **Flutter Web Path Routing**: RFC 6749 Section 3.1.2 strictly prohibits fragment identifiers (\`#\`) in OAuth redirect URIs. Ensure Flutter Web apps invoke \`usePathUrlStrategy()\` from \`package:flutter_web_plugins/url_strategy.dart\` so redirect URLs are clean (e.g. \`http://localhost:3000/auth/callback\`) and not truncated by hash-routing.
:::
`;
    content = content.replace('## 🚀 The New Reality: Integrated in 60 Seconds', `${tipSection}\n## 🚀 The New Reality: Integrated in 60 Seconds`);
  }
  
  fs.writeFileSync(file1, content, 'utf8');
  console.log(`✅ [UPDATED] ${file1}`);
}

// 2. 180-identity/05-sdk-reference.md
const file2 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/05-sdk-reference.md');
if (fs.existsSync(file2)) {
  let content = fs.readFileSync(file2, 'utf8');
  content = content.replace(
    /\|\s*\*\*`auth\.180workspace\.com`\*\*<br\/>\*\(\s*Mirror:\s*`profile\.180core\.cloud`\s*\)\*\s*\|\s*\*\*Hosted User Interfaces\*\*\s*<br\/>\(Universal SSO, 1-Click Checkout, CDN SDK script\)\s*\|\s*`GET \/sdk\/v1\/180-core-sdk\.js`<br\/>`GET \/auth\/login`<br\/>`GET \/checkout`\s*\|/g,
    `| **\`profile.180core.cloud\`** | **Hosted User Interfaces & CDN SDK**<br/>(Universal SSO, 1-Click Checkout, CDN SDK script) | \`GET /sdk/v1/180-core-sdk.js\`<br/>\`GET /auth/login\`<br/>\`GET /checkout\`<br/>\`GET /.well-known/openid-configuration\` |`
  );
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  fs.writeFileSync(file2, content, 'utf8');
  console.log(`✅ [UPDATED] ${file2}`);
}

// 3. 180-identity/06-backend-token-verification.md
const file3 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/06-backend-token-verification.md');
if (fs.existsSync(file3)) {
  let content = fs.readFileSync(file3, 'utf8');
  content = content.replace(/https:\/\/auth\.180workspace\.com\/\.well-known\/openid-configuration/g, 'https://api.180core.cloud/.well-known/openid-configuration');
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  fs.writeFileSync(file3, content, 'utf8');
  console.log(`✅ [UPDATED] ${file3}`);
}

// 4. 180-pay/01-getting-started.md
const file4 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-pay/01-getting-started.md');
if (fs.existsSync(file4)) {
  let content = fs.readFileSync(file4, 'utf8');
  content = content.replace(
    /\|\s*\*\*`auth\.180workspace\.com`\*\*<br\/>\*\(\s*Mirror:\s*`profile\.180core\.cloud`\s*\)\*\s*\|\s*\*\*Hosted User Interfaces\*\*\s*<br\/>\(1-Click Sovereign Checkout, Universal SSO, Customer Portal\)\s*\|\s*`GET \/checkout\?clientId=\.\.\.`<br\/>`GET \/checkout\?sessionId=\.\.\.`<br\/>`GET \/auth\/login`<br\/>`GET \/sdk\/v1\/180-core-sdk\.js`\s*\|/g,
    `| **\`profile.180core.cloud\`** | **Hosted User Interfaces & CDN SDK**<br/>(1-Click Sovereign Checkout, Universal SSO, Customer Portal) | \`GET /checkout?clientId=...\`<br/>\`GET /checkout?sessionId=...\`<br/>\`GET /auth/login\`<br/>\`GET /sdk/v1/180-core-sdk.js\` |`
  );
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  fs.writeFileSync(file4, content, 'utf8');
  console.log(`✅ [UPDATED] ${file4}`);
}

// 5. 180-pay/02-checkout-integration.md
const file5 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/180-pay/02-checkout-integration.md');
if (fs.existsSync(file5)) {
  let content = fs.readFileSync(file5, 'utf8');
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  fs.writeFileSync(file5, content, 'utf8');
  console.log(`✅ [UPDATED] ${file5}`);
}

// 6. 180-core/02-ai-master-prompt.md
const file6 = path.join(PUBLIC_SITES_ROOT, 'apps/docs/docs/products/180-core/02-ai-master-prompt.md');
if (fs.existsSync(file6)) {
  let content = fs.readFileSync(file6, 'utf8');
  content = content.replace(/https:\/\/auth\.180workspace\.com\/checkout/g, 'https://profile.180core.cloud/checkout');
  content = content.replace(/https:\/\/auth\.180workspace\.com\/auth\/login/g, 'https://profile.180core.cloud/auth/login');
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  fs.writeFileSync(file6, content, 'utf8');
  console.log(`✅ [UPDATED] ${file6}`);
}

// 7. marketing-web/src/pages/developers/index.astro
const file7 = path.join(PUBLIC_SITES_ROOT, 'apps/marketing-web/src/pages/developers/index.astro');
if (fs.existsSync(file7)) {
  let content = fs.readFileSync(file7, 'utf8');
  content = content.replace(/auth\.180workspace\.com/g, 'profile.180core.cloud');
  fs.writeFileSync(file7, content, 'utf8');
  console.log(`✅ [UPDATED] ${file7}`);
}

console.log('\n================================================================');
console.log('🎉 ALL PUBLIC SITE DOCS SYNCHRONIZED!');
console.log('================================================================');
