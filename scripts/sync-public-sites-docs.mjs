import fs from 'fs';
import path from 'path';

const CORE_ROOT = 'C:\\Users\\saavi\\Desktop\\180 Project\\180 core';
const SITES_ROOT = 'C:\\Users\\saavi\\Desktop\\180 Project\\180 public sites';

console.log('================================================================');
console.log('📚 Synchronizing 180 Public Sites Documentation & SDK');
console.log('================================================================\n');

// 1. Synchronize SDK Source Packages
console.log('1️⃣ Synchronizing SDK source packages...');
const sdkSrc = path.join(CORE_ROOT, 'packages', 'identity-sdk', 'src');
const sdkDest = path.join(SITES_ROOT, 'packages', 'identity-sdk', 'src');

if (fs.existsSync(sdkDest)) {
  fs.copyFileSync(path.join(sdkSrc, '180-core-sdk.js'), path.join(sdkDest, '180-core-sdk.js'));
  fs.copyFileSync(path.join(sdkSrc, '180-core-sdk.min.js'), path.join(sdkDest, '180-core-sdk.min.js'));
  fs.copyFileSync(path.join(sdkSrc, 'index.tsx'), path.join(sdkDest, 'index.tsx'));
  console.log('  ✅ Copied 180-core-sdk.js, 180-core-sdk.min.js, index.tsx to 180 public sites/packages/identity-sdk/src');
} else {
  console.log('  ⚠️ Target SDK dir does not exist:', sdkDest);
}

// 2. 02-universal-login-flow.md
console.log('\n2️⃣ Updating 02-universal-login-flow.md...');
const loginFlowPath = path.join(SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/02-universal-login-flow.md');
if (fs.existsSync(loginFlowPath)) {
  let content = fs.readFileSync(loginFlowPath, 'utf8');
  content = content.replace(
    /description: In-depth guide on popup vs bottom sheet vs redirect UX modes.*/,
    'description: In-depth guide on the unified adaptive bottom sheet presentation model, PKCE S256 validation, and per-app username isolation.'
  );

  const newHeader = `# Universal Login Flow & Adaptive Sheet Architecture

180 Identity uses an adaptive in-DOM presentation model that is fully responsive across mobile and desktop devices with zero developer configuration:

| Viewport / Device | Presentation | Behavior |
| :--- | :--- | :--- |
| **Mobile (< 768px)** | **Touch-Friendly Bottom Sheet** | Slides up smoothly from the bottom with WhatsApp 1-tap OTP and credential login. Zero popup blocker failure on Safari iOS, Chrome Android, and privacy-shielded browsers. |
| **Desktop (≥ 768px)** | **Centered Glass Modal Card** | Centers a focused \`480px\` modal dialog with backdrop blur directly within the app DOM. Communicates securely via \`postMessage\` and resolves the authentication token directly into your Promise. |

:::tip Zero Popup Blockers & Reliable Payment Gateway Return
Because the sheet renders directly inside the application DOM via an isolated iframe overlay rather than a detached browser window (\`window.open\`), it is completely immune to mobile browser popup blockers and avoids severed \`window.opener\` references when completing third-party payment gateways like PhonePe or UPI.
:::

---

## 1. Zero-Config UX Architecture

Developers never need to configure or toggle complex display modes or handle device-specific popup branches. The SDK automatically detects the viewport and manages the presentation:

- **Mobile Viewports**: Auto-docks as a bottom sheet with touch gestures.
- **Desktop Viewports**: Auto-centers as a modal card with smooth backdrop animations.
- **Single-Line Trigger**: \`OneEighty.auth.signIn({ clientId: '...' })\` or \`OneEightyIdentity.openBottomSheet({ clientId: '...' })\`.
- **Legacy Aliases**: Calls to \`openPopup()\` or \`openLoginPopup()\` are preserved for backward compatibility and seamlessly route to the adaptive in-DOM sheet.

---

## 2. Using PKCE`;

  content = content.replace(
    /# Universal Login Flow & UX Modes[\s\S]*?## 2\. Using PKCE/,
    newHeader
  );
  fs.writeFileSync(loginFlowPath, content, 'utf8');
  console.log('  ✅ Updated 02-universal-login-flow.md');
}

// 3. 05-sdk-reference.md
console.log('\n3️⃣ Updating 05-sdk-reference.md...');
const sdkRefPath = path.join(SITES_ROOT, 'apps/docs/docs/products/180-core/180-identity/05-sdk-reference.md');
if (fs.existsSync(sdkRefPath)) {
  let content = fs.readFileSync(sdkRefPath, 'utf8');
  content = content.replace(
    /\/\/ Modal \/ Popup fallback\s+window\.OneEightyIdentity\.openLoginPopup\(options\): Promise<AuthResult \| null>/,
    '// Standard & backward-compatible aliases (all delegate to adaptive sheet)\nwindow.OneEightyIdentity.openAuth(options): Promise<AuthResult | null>\nwindow.OneEightyIdentity.openPopup(options): Promise<AuthResult | null>\nwindow.OneEightyIdentity.openLoginPopup(options): Promise<AuthResult | null>'
  );
  fs.writeFileSync(sdkRefPath, content, 'utf8');
  console.log('  ✅ Updated 05-sdk-reference.md');
}

// 4. 01-overview.md
console.log('\n4️⃣ Updating 01-overview.md...');
const overviewPath = path.join(SITES_ROOT, 'apps/docs/docs/products/180-core/01-overview.md');
if (fs.existsSync(overviewPath)) {
  let content = fs.readFileSync(overviewPath, 'utf8');
  content = content.replace(/SDK -->\|OAuth 2\.0 PKCE \/ Popup\| Identity/g, 'SDK -->|OAuth 2.0 PKCE / Bottom Sheet| Identity');
  content = content.replace(/- \*\*1-Click Bottom Sheet & Popup Checkout\*\*/g, '- **1-Click Adaptive Bottom Sheet Checkout**');
  fs.writeFileSync(overviewPath, content, 'utf8');
  console.log('  ✅ Updated 01-overview.md');
}

// 5. 05-global-developer-experience.md & platform-overview.md
console.log('\n5️⃣ Updating 05-global-developer-experience.md & platform-overview.md...');
['apps/docs/docs/05-global-developer-experience.md', 'apps/docs/docs/platform-overview.md'].forEach(rel => {
  const p = path.join(SITES_ROOT, rel);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/mode="popup"\s*/g, '');
    fs.writeFileSync(p, content, 'utf8');
    console.log('  ✅ Cleaned up mode="popup" in ' + rel);
  }
});

// 6. 180-core/index.astro
console.log('\n6️⃣ Updating apps/marketing-web/src/pages/180-core/index.astro...');
const astroCorePath = path.join(SITES_ROOT, 'apps/marketing-web/src/pages/180-core/index.astro');
if (fs.existsSync(astroCorePath)) {
  let content = fs.readFileSync(astroCorePath, 'utf8');
  content = content.replace(/calls <code[^>]*>openPopup\(\)<\/code>/g, 'calls <code class="text-blue-600 dark:text-blue-300 font-mono text-[11px] bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">openBottomSheet()</code>');
  content = content.replace(/Test 180 Identity Flow \(Live Popup\)/g, 'Test 180 Identity Flow (Live Sheet)');
  content = content.replace(/Launches real sovereign OAuth popup with fallback redirect/g, 'Launches real sovereign in-DOM auth sheet (zero popup blockers)');
  fs.writeFileSync(astroCorePath, content, 'utf8');
  console.log('  ✅ Updated apps/marketing-web/src/pages/180-core/index.astro');
}

// 7. Update UI components: OneEightyAuthButton.tsx and OneEightyPayButton.tsx
console.log('\n7️⃣ Updating OneEightyAuthButton.tsx in 180 public sites...');
const authButtonPath = path.join(SITES_ROOT, 'packages/ui/src/components/OneEightyAuthButton.tsx');
if (fs.existsSync(authButtonPath)) {
  let content = fs.readFileSync(authButtonPath, 'utf8');
  // Update interface
  content = content.replace(/uxMode\?: 'popup' \| 'redirect';/, "uxMode?: 'bottom_sheet' | 'popup' | 'redirect';");
  content = content.replace(/uxMode = 'popup',/, "uxMode = 'bottom_sheet',");
  
  // Make sure fallback loads SDK or uses in-DOM sheet instead of raw window.open
  const replacementClick = `  const handleClick = async () => {
    // 1. Ensure 180 Core SDK is loaded for in-DOM adaptive bottom sheet
    if (typeof window !== 'undefined' && !(window as any).OneEighty?.auth?.signIn) {
      if (!document.querySelector('script[src*="180-core-sdk"]')) {
        const script = document.createElement('script');
        script.src = 'https://profile.180core.cloud/sdk/v1/180-core-sdk.js';
        script.async = true;
        document.head.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
          script.onerror = resolve;
        });
      }
    }

    if (typeof window !== 'undefined' && (window as any).OneEighty?.auth?.signIn) {
      setLoading(true);
      try {
        const result = await (window as any).OneEighty.auth.signIn({
          clientId,
          scope,
          redirectUri,
          state,
          uxMode: 'bottom_sheet',
          onSuccess: (res: any) => {
            setLoading(false);
            if (onSuccess) onSuccess(res?.code || res?.token || res?.accessToken);
          },
          onError: (err: any) => {
            setLoading(false);
            if (onError) onError(err?.message || 'Authentication failed');
          },
          onCancel: () => {
            setLoading(false);
          },
        });
        if (result && onSuccess) {
          onSuccess(result.code || result.token || result.accessToken);
        }
      } catch (err: any) {
        if (onError) onError(err?.message || 'Authentication failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Direct Web Fallback (Redirect if SDK unavailable)
    const base = getResolvedAuthBase();
    const resolvedRedirect = redirectUri || (typeof window !== 'undefined' ? window.location.href : '');
    const resolvedState = state || 'st_' + Math.random().toString(36).substring(2, 12);
    const authUrl = \`\${base}?client_id=\${encodeURIComponent(clientId)}&redirect_uri=\${encodeURIComponent(
      resolvedRedirect
    )}&scope=\${encodeURIComponent(scope)}&state=\${encodeURIComponent(resolvedState)}&response_type=code&ux_mode=bottom_sheet\`;
    window.location.href = authUrl;
  };`;

  content = content.replace(/const handleClick = async \(\) => {[\s\S]*?const isDark = variant === 'dark';/, replacementClick + "\n\n  const isDark = variant === 'dark';");
  fs.writeFileSync(authButtonPath, content, 'utf8');
  console.log('  ✅ Updated OneEightyAuthButton.tsx to use in-DOM adaptive bottom sheet');
}

console.log('\n================================================================');
console.log('🎉 180 Public Sites Documentation Synchronization Complete!');
console.log('================================================================');
