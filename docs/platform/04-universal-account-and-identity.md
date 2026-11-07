---
id: 04-universal-account-and-identity
title: Universal Account & Single Sign-On
sidebar_label: Universal Account & SSO
sidebar_position: 4
description: Sovereign account architecture, @username naming convention, WhatsApp 1-Tap OTP, and zero-password authentication.
---

# Universal Account & Single Sign-On

In the 180 ecosystem, identity is not fragmented across multiple registration forms, passwords, and user databases. Every user registers once to receive a **Sovereign Universal Account** anchored by their unique `@username`.

```mermaid
graph TD
    User([Universal User: @username]) --> AuthPortal[180 Identity Engine]
    
    subgraph "Zero-Password Verification Rails"
        AuthPortal --> WA[WhatsApp 1-Tap OTP]
        AuthPortal --> SMS[Carrier SMS OTP]
        AuthPortal --> OAuth[Google & Apple OAuth]
        AuthPortal --> Passkey[WebAuthn Passkeys / Biometrics]
    end

    AuthPortal --> SessionToken[Ephemeral JWT Session<br/>15m Access Token + 7d Rotating Refresh]

    subgraph "Authorized Sovereign Services"
        SessionToken --> WS[180 Workspace]
        SessionToken --> SS[180 Social Studio]
        SessionToken --> TD[180 Traffic Director]
        SessionToken --> ExtApps[Third-Party Developer Apps]
    end
```

---

## 1. The Sovereign `@username` Model

Traditional web applications rely on email addresses as primary identity anchors. However, email is prone to deliverability issues, spam filters, phishing, and slow verification cycles.

180 introduces the **Sovereign Identity Format**:
- **Identifier**: `@handle` (e.g. `@siddharth`, `@growth_agency`).
- **Global Uniqueness**: Claimed globally across all 180 services.
- **Per-App Identity Isolation**: When a developer integrates 180 Identity, usernames can be mapped into application-specific profiles (`AppUserIdentity`), preventing namespace pollution between enterprise tenants and third-party developer apps.

---

## 2. Zero-Password Authentication Rails

180 completely removes passwords from the authentication loop, eliminating 80% of credential stuffing vulnerabilities and support tickets for forgotten passwords.

### 1. WhatsApp 1-Tap OTP
For mobile and international users, authentication occurs in seconds via official WhatsApp Enterprise Gateways:
1. User enters their phone number or `@username`.
2. A cryptographically secure 6-digit OTP is delivered straight to their verified WhatsApp chat.
3. On mobile devices, 1-tap deep links automatically confirm verification without manual typing.

### 2. WebAuthn Passkeys & Biometrics
Desktop and modern mobile users can log in using Touch ID, Face ID, or Windows Hello hardware security tokens.

### 3. OpenID Connect & OAuth 2.0 PKCE
Third-party enterprise clients integrate with 180 Identity using the industry standard Authorization Code flow with Proof Key for Code Exchange (PKCE).

---

## 3. Token Lifecycle & Cryptographic Security

180 Identity enforces a strict, defense-in-depth token rotation architecture:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Web / Mobile Client
    participant Identity as 180 Identity Service
    participant Resource as 180 API / Service

    Client->>Identity: /oauth/token (Exchange Code + PKCE Verifier)
    Identity-->>Client: Returns { access_token (15m), refresh_token (7d) }
    
    Client->>Resource: GET /api/v1/projects (Authorization: Bearer access_token)
    Resource-->>Client: Returns 200 OK + Resource Data

    Note over Client,Resource: After 15 minutes, access token expires...
    Client->>Resource: GET /api/v1/projects (Expired token)
    Resource-->>Client: Returns 401 Unauthorized

    Client->>Identity: POST /oauth/refresh { refresh_token }
    Identity->>Identity: Verifies token hash & issues new rotated token pair
    Identity-->>Client: Returns { new_access_token, new_refresh_token }
```

### Security Guarantees:
- **15-Minute Short-Lived Access Tokens**: Reduces exposure window in the event of client-side token interception.
- **Automatic Refresh Token Invalidation**: If an old refresh token is reused, 180 Identity detects the replay attack and terminates all active sessions associated with that user family.
- **Centralized Revocation**: Users and administrators can terminate active sessions across all devices instantly with a single click.

---

## 4. Single Sign-On Across the Workspace

When an employee or creator logs into 180:
- Navigating from **180 Workspace** to **180 Social Studio** or **180 Traffic Director** requires zero re-authentication.
- Tenant context (`companyId`) is preserved in workspace claims, enabling instant organization switching without signing out.
- Role-Based Access Control (RBAC) dynamically adjusts permissions based on the active company context.

---

## Next Steps

- Integrate 180 Identity into your own application: **[180 Identity Integration Guide](/docs/products/180-core/180-identity/getting-started)**.
- Review developer SDK specs: **[Global Developer Experience](/docs/05-global-developer-experience)**.
