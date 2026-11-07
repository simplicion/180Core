---
id: sdk-reference
title: 180 Core SDK & Architecture Reference
sidebar_label: SDK & Architecture Reference
sidebar_position: 5
description: Complete SDK reference, authoritative dual-domain directory, NextAuth v5 provider, Flutter 3.24+ service, and framework integration guides.
---

# 180 Core SDK & Architecture Reference

The **180 Core SDK** (`180-core-sdk.js` / `@workspace/identity-sdk`) is a zero-dependency, high-performance client library that provides universal modal injection, RFC 7636 PKCE cryptographic security, responsive bottom-sheet viewports, and unified single sign-on across the 180 ecosystem.

---

## 1. Authoritative Architecture & Dual-Domain Directory

To avoid 404 errors, routing confusion, and CORS misconfigurations:

| Domain | Role & Purpose | Key Endpoints |
| :--- | :--- | :--- |
| **`profile.180core.cloud`** | **Hosted User Interfaces & CDN SDK**<br/>(Universal SSO, 1-Click Checkout, CDN SDK script) | `GET /sdk/v1/180-core-sdk.js`<br/>`GET /auth/login`<br/>`GET /checkout`<br/>`GET /.well-known/openid-configuration` |
| **`api.180core.cloud`** | **Core OAuth & Token Engine**<br/>(RFC 6749 Auth Code Exchange, OIDC Profiles, 180 Pay APIs) | `POST /api/oauth/token`<br/>`GET /api/oauth/userinfo`<br/>`GET /certs/jwks.json` (RS256 Keyring)<br/>`POST /api/v1/pay/checkout-session` |
| **`developer.180core.cloud`** | **Developer Management Console** | Client Keys, Webhook URLs, Allowed Origins |

---

## 2. Global Namespaces & Window Aliases

When loaded via `<script src="https://profile.180core.cloud/sdk/v1/180-core-sdk.js"></script>`, the SDK attaches itself to the global `window` object:

```javascript
window.OneEighty         // Root instance: { auth, pay, ui, version, init, ... }
window.OneEightyCore     // Canonical alias for window.OneEighty
window.OneEightyAuth     // Canonical Auth service: { signIn, openBottomSheet, signOut, ... }
window.OneEightyIdentity // Alias for window.OneEightyAuth
window.OneEightyPay      // Universal Checkout service: { checkout, openBottomSheet, ... }
```

### Key Methods on `OneEightyIdentity` / `OneEightyAuth`:
```typescript
// Primary authentication trigger (opens in-DOM bottom sheet by default)
window.OneEightyIdentity.openBottomSheet(options): Promise<AuthResult | null>

// Standard & backward-compatible aliases (all delegate to adaptive sheet)
window.OneEightyIdentity.openAuth(options): Promise<AuthResult | null>
window.OneEightyIdentity.openPopup(options): Promise<AuthResult | null>
window.OneEightyIdentity.openLoginPopup(options): Promise<AuthResult | null>
window.OneEightyIdentity.signIn(options): Promise<AuthResult | null>

// Session & profile helpers
window.OneEightyIdentity.signOut(): void
window.OneEightyIdentity.getUser(): UserProfile | null
window.OneEightyIdentity.getAccessToken(): string | null
```

---

## 3. Normalized OpenID Connect Claims Contract

The `/api/oauth/userinfo` endpoint and the decoded identity token return universally normalized OIDC claims to ensure zero schema breakages across databases (Prisma, Drizzle, etc.):

```typescript
export interface OneEightyUserProfile {
  /** RFC 7519 Subject Identifier */
  sub: string;
  id: string;

  /** Standard OIDC Profile Claims */
  name: string;
  preferred_username?: string;
  username?: string;
  email: string;
  email_verified?: boolean;

  /** Phone number normalization */
  phone_number?: string;
  phone?: string;
  phoneNumber?: string;
  phone_verified?: boolean;

  /** Avatar normalization */
  picture?: string;
  avatarUrl?: string;

  /** Multi-tenant metadata */
  companyId?: string | null;
  role?: string;

  /** Nested compatibility object */
  user?: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    avatarUrl?: string;
  };
}
```

---

## 4. NextAuth.js (Auth.js v5) Custom Provider

Integrate 180 Identity directly into NextAuth.js applications:

```typescript
import NextAuth from 'next-auth';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: '180-identity',
      name: '180 Identity',
      type: 'oauth',
      authorization: {
        url: 'https://profile.180core.cloud/auth/login',
        params: {
          scope: 'openid identity:read identity:email identity:phone',
          ux_mode: 'bottom_sheet'
        },
      },
      token: 'https://api.180core.cloud/api/oauth/token',
      userinfo: 'https://api.180core.cloud/api/oauth/userinfo',
      clientId: process.env.ONE_EIGHTY_CLIENT_ID,
      clientSecret: process.env.ONE_EIGHTY_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub || profile.id,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          image: profile.picture || profile.avatarUrl,
        };
      },
    },
  ],
});
```

---

## 5. Flutter 3.24+ / Dart 3.5+ Mobile SDK & Architecture Service

Because compiled mobile frameworks (Flutter Android/iOS) lack an HTML browser DOM (`document.createElement`), they cannot mount the browser `180-core-sdk.js` script. Instead, mobile applications implement the **`OneEightyIntegrationService`** architectural pattern using **In-App Custom Tabs & Safari View Controllers** (`LaunchMode.inAppBrowserView`).

### 🏛️ Core Architectural Benefits
1. **Single Point of Truth (Zero Hardcoded URLs)**:
   Avoid scattering login and checkout URLs across screens (`login_screen.dart`, `language_selection_screen.dart`, etc.). Modifying `hostedAuthUrl` updates the entire app cleanly.
2. **Cross-Platform Abstraction (Web vs. Native Mobile)**:
   - On **Web (`kIsWeb`)**: Trigger web redirection or mount the in-DOM bottom sheet.
   - On **Mobile (Android & iOS)**: Launch via `LaunchMode.inAppBrowserView`, presenting the 180 bottom sheet natively inside Android Custom Tabs / iOS `SFSafariViewController` without kicking the user out to Chrome or Safari.
3. **Zero-Risk Infrastructure Adaptability**:
   Seamlessly adapt to domain migrations, sovereign clouds, or tenant-specific vanity subdomains in a single line.

### 📱 Production-Grade Dart Implementation

```dart
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OneEightyIntegrationService {
  // Canonical production authentication & checkout endpoints
  static const String hostedAuthUrl = 'https://profile.180core.cloud/auth/login';
  static const String hostedCheckoutUrl = 'https://profile.180core.cloud/checkout';
  static const String defaultClientId = '180_client_YOUR_REGISTERED_ID';

  /// Launch Universal 180 Identity SSO
  static Future<bool> launchHostedLogin({
    String? clientId,
    required String redirectUri,
    String scope = 'openid identity:read identity:email identity:phone',
    String? state,
    String? codeChallenge,
  }) async {
    final effectiveClientId = clientId ?? defaultClientId;
    final uri = Uri.parse(hostedAuthUrl).replace(queryParameters: {
      'client_id': effectiveClientId,
      'redirect_uri': redirectUri,
      'response_type': 'code',
      'scope': scope,
      'ux_mode': 'bottom_sheet',
      if (state != null) 'state': state,
      if (codeChallenge != null) ...{
        'code_challenge': codeChallenge,
        'code_challenge_method': 'S256',
      },
    });

    if (await canLaunchUrl(uri)) {
      if (kIsWeb) {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      } else {
        return await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
      }
    }
    return false;
  }

  /// Launch 180 Pay Sovereign 1-Click Checkout
  static Future<bool> launchCheckout({
    required String orderId,
    required num amountInRupees, // WHOLE UNITS (e.g. 499 for ₹499)
    required String title,
    required String returnUrl,
    String currency = 'INR',
    String? clientId,
  }) async {
    final uri = Uri.parse(hostedCheckoutUrl).replace(queryParameters: {
      'amount': amountInRupees.toString(),
      'currency': currency,
      'title': title,
      'order_id': orderId,
      'return_url': returnUrl,
      if (clientId != null) 'clientId': clientId,
    });

    if (await canLaunchUrl(uri)) {
      return await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    }
    return false;
  }
}
```

### 🔗 Allowed Redirect URI Requirements & Scheme Rules

When registering your OAuth application in [https://developer.180core.cloud](https://developer.180core.cloud), ensure your **Allowed Redirect URIs** conform to the following specifications:

| Platform | Format / Scheme | Example Redirect URI | Behavior |
| :--- | :--- | :--- | :--- |
| **Web (Development)** | `http://localhost:<port>/<path>` | `http://localhost:3000/auth/callback` | RFC 8252 dynamic loopback ports permitted during development. |
| **Web (Production)** | `https://<yourdomain>/<path>` | `https://myapp.com/auth/callback` | Strict HTTPS enforcement. Fragment (`#`) identifiers strictly rejected per RFC 6749 Section 3.1.2. |
| **Native Mobile (Android/iOS)** | `<custom-scheme>://<path>` | `ayuhand://oauth/callback`<br/>`myapp://oauth-callback` | Intercepted by mobile app deep linking / App Links / Universal Links. |

:::warning Flutter Web Hash Routing Collision
Flutter Web defaults to hash routing (`http://localhost:3000/#/auth/callback`). RFC 6749 Section 3.1.2 strictly prohibits fragment identifiers (`#`) in OAuth redirect URIs because browser URL parsers truncate query parameters (`?code=...`) appended after the hash.

**Mandatory Resolution**: In your Flutter Web app's `main.dart`, enable HTML5 path URL strategy before `runApp()`:
```dart
import 'package:flutter_web_plugins/url_strategy.dart';

void main() {
  usePathUrlStrategy(); // Removes '#' from URL routes
  runApp(const MyApp());
}
```
:::


### 📲 Flutter In-App WebView Mobile Bridges (`OneEightyMobileChannel` & `OneEightyPaymentChannel`)

For Flutter applications using `flutter_inappwebview`, 180 Core provides dedicated JavaScript communication channels that eliminate external browser switching and handle instant in-app state updates:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

class OneEightyWebViewScreen extends StatefulWidget {
  final String clientId;
  final String redirectUri;

  const OneEightyWebViewScreen({
    super.key,
    required this.clientId,
    required this.redirectUri,
  });

  @override
  State<OneEightyWebViewScreen> createState() => _OneEightyWebViewScreenState();
}

class _OneEightyWebViewScreenState extends State<OneEightyWebViewScreen> {
  InAppWebViewController? webViewController;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: InAppWebView(
          initialUrlRequest: URLRequest(
            url: WebUri("https://profile.180core.cloud/auth/login?client_id=${widget.clientId}&redirect_uri=${widget.redirectUri}"),
          ),
          onWebViewCreated: (controller) {
            webViewController = controller;

            // 1. Listen for Universal 180 Identity SSO events
            controller.addJavaScriptHandler(
              handlerName: 'OneEightyMobileChannel',
              callback: (args) {
                final data = jsonDecode(args[0]);
                if (data['type'] == '180_IDENTITY_SUCCESS') {
                  // Handle authentication code / token
                  final code = data['code'];
                  Navigator.pop(context, code);
                }
              },
            );

            // 2. Listen for 180 Pay Sovereign Checkout events
            controller.addJavaScriptHandler(
              handlerName: 'OneEightyPaymentChannel',
              callback: (args) {
                final data = jsonDecode(args[0]);
                if (data['type'] == '180_PAYMENT_SUCCESS') {
                  // Handle payment confirmation
                  final transactionId = data['transactionId'];
                  Navigator.pop(context, transactionId);
                }
              },
            );
          },
        ),
      ),
    );
  }
}
```

### 📱 Android & iOS Custom Scheme Configuration

To intercept redirects such as `myapp://oauth/callback` or `myapp://payment/callback`:

#### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<activity
    android:name=".MainActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="myapp" android:host="oauth" />
        <data android:scheme="myapp" android:host="payment" />
    </intent-filter>
</activity>
```

#### iOS (`ios/Runner/Info.plist`)
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

---

## 6. Python (FastAPI) Token Verification with PyJWKClient

Verify RS256 Bearer tokens statelessly without remote database calls:

```python
import jwt
from jwt import PyJWKClient
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app = FastAPI()
security = HTTPBearer()

JWKS_URL = "https://api.180core.cloud/certs/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)

async def verify_180_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return data # Contains sub, email, name, phone_number
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )

@app.get("/api/protected-profile")
async def get_profile(user: dict = Depends(verify_180_token)):
    return {"status": "authenticated", "user": user}
```
