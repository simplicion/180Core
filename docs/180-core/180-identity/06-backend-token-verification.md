---
id: backend-token-verification
title: Backend Token Exchange & Verification Guide
sidebar_label: Backend Verification
sidebar_position: 6
description: Complete guide for server-to-server authorization code exchange, standard OIDC claims normalization, RFC 8252 loopback matching, and stateless RS256 JWKS verification.
---

# Backend Token Exchange & Verification Guide

When a client application completes 180 Identity login, it receives an authorization code (`code`). To establish a secure server-side session or API authentication, your backend performs a server-to-server exchange with 180 Sovereign Cloud.

---

## 1. Full Server-to-Server Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser / Mobile App
    participant App as Partner Frontend
    participant Server as Partner Server
    participant Cloud as 180 Core Auth Server (api.180core.cloud)

    User->>App: Clicks "Sign in with 180"
    App->>Cloud: Presents In-DOM Bottom Sheet (profile.180core.cloud)
    User->>Cloud: Authenticates (WhatsApp 1-Tap / Biometric Passkey)
    Cloud-->>App: postMessage({ code: "auth_code_..." })
    App->>Server: POST /auth/exchange { code }
    Server->>Cloud: POST https://api.180core.cloud/api/oauth/token
    Note over Server,Cloud: grant_type=authorization_code + client_id + client_secret
    Cloud-->>Server: 200 OK { access_token, id_token, user }
    Server->>Cloud: GET https://api.180core.cloud/api/oauth/userinfo (Bearer token)
    Cloud-->>Server: 200 OK (OIDC Standard Claims: sub, email, phone_number, name)
    Server-->>App: Set Secure HTTP-Only Session Cookie / JWT
```

---

## 2. Server-to-Server Token Exchange (RFC 6749)

### Option A: Turnkey 1-Line Helper (`@workspace/identity-sdk`)

```typescript
import { exchangeAuthCode } from '@workspace/identity-sdk';

const { user, tokens } = await exchangeAuthCode(code, {
  clientId: process.env.ONE_EIGHTY_CLIENT_ID,
  clientSecret: process.env.ONE_EIGHTY_CLIENT_SECRET,
});

console.log('User profile:', user.name, user.email, user.phone_number);
```

### Option B: Raw HTTP Request

```http
POST https://api.180core.cloud/api/oauth/token HTTP/1.1
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "180_client_b26aee801c22cb3295f041ff2a3597db",
  "client_secret": "180_secret_live_9981240183...",
  "code": "auth_code_9a8f2c3b4d5e",
  "redirect_uri": "https://yourapp.com/callback"
}
```

#### JSON Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_87a9b0c1d2e3f4",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "openid identity:read identity:email identity:phone",
  "user": {
    "id": "usr_9f82b1c2-3e4a-4d5f-9a1b-8c7d6e5f4a3b",
    "sub": "usr_9f82b1c2-3e4a-4d5f-9a1b-8c7d6e5f4a3b",
    "name": "Sovereign Developer",
    "preferred_username": "developer",
    "username": "developer",
    "email": "user@example.com",
    "phone_number": "+919876543210",
    "phone": "+919876543210",
    "phoneNumber": "+919876543210",
    "picture": "https://profile.180core.cloud/avatars/user.png",
    "avatarUrl": "https://profile.180core.cloud/avatars/user.png"
  }
}
```

---

## 3. Retrieve Verified OIDC Profile (`/api/oauth/userinfo`)

### HTTP Request:
```http
GET https://api.180core.cloud/api/oauth/userinfo HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Normalized Standard Claims Response:
180 Core strictly normalizes user profile claims to prevent database schema errors across different ORMs:

```json
{
  "sub": "usr_9f82b1c2-3e4a-4d5f-9a1b-8c7d6e5f4a3b",
  "name": "Sovereign Developer",
  "preferred_username": "developer",
  "username": "developer",
  "email": "user@example.com",
  "email_verified": true,
  "phone_number": "+919876543210",
  "phone": "+919876543210",
  "phoneNumber": "+919876543210",
  "phone_verified": true,
  "picture": "https://profile.180core.cloud/avatars/user.png",
  "avatarUrl": "https://profile.180core.cloud/avatars/user.png",
  "companyId": "comp_12345",
  "role": "OWNER",
  "user": {
    "id": "usr_9f82b1c2-3e4a-4d5f-9a1b-8c7d6e5f4a3b",
    "email": "user@example.com",
    "name": "Sovereign Developer",
    "phone": "+919876543210"
  }
}
```

---

## 4. RFC 8252 Dynamic Loopback Interface Matching

During local development, your frontends frequently run on dynamic ports (e.g., `localhost:3000`, `localhost:3005`, `127.0.0.1:5173`, or `10.0.2.2` in Android emulators).

In accordance with **RFC 8252 (OAuth 2.0 for Native and Local Apps)**:
- 180 Core automatically matches any valid local loopback port dynamically.
- You do **not** need to register every local dev port in the Developer Console.
- Standard loopback patterns permitted: `http://localhost:*`, `http://127.0.0.1:*`, `http://10.0.2.2:*`, and `http://[::1]:*`.

---

## 5. Stateless Verification with JWKS (Local Token Validation)

Verify RS256 JWT signatures statelessly in your microservices without querying 180 services on every request:

- **JWKS Endpoint**: `https://api.180core.cloud/certs/jwks.json`
- **OIDC Discovery**: `https://api.180core.cloud/.well-known/openid-configuration`

### Node.js Example (Fastify 5.x / Express / Next.js with `jose`):

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://api.180core.cloud/certs/jwks.json')
);

export async function verify180BearerToken(bearerToken: string) {
  try {
    const { payload } = await jwtVerify(bearerToken, JWKS, {
      issuer: 'https://profile.180core.cloud',
      audience: process.env.ONE_EIGHTY_CLIENT_ID,
    });
    return payload; // { sub, email, name, phone_number, ... }
  } catch (err: any) {
    throw new Error(`Token verification failed: ${err.message}`);
  }
}
```

### Python FastAPI Example (with `PyJWKClient`):

```python
import jwt
from jwt import PyJWKClient
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app = FastAPI()
security = HTTPBearer()

jwks_client = PyJWKClient("https://api.180core.cloud/certs/jwks.json")

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid RS256 token: {str(e)}")

@app.get("/api/me")
def get_me(user: dict = Depends(verify_token)):
    return {"user_id": user.get("sub"), "email": user.get("email")}
```

---

## 6. Server-to-Server Token Introspection (RFC 7662)

To actively check if a token was revoked by the user before its natural expiration:

```http
POST https://api.180core.cloud/api/oauth/introspect HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <base64(client_id:client_secret)>

token=eyJhbGciOiJSUzI1NiIs...
```

### Response:
```json
{
  "active": true,
  "scope": "openid identity:read identity:email identity:phone",
  "client_id": "180_client_b26aee801c22cb3295f041ff2a3597db",
  "sub": "usr_9f82b1c2-3e4a-4d5f-9a1b-8c7d6e5f4a3b",
  "exp": 1728135600,
  "iat": 1728134700
}
```
If the session has been terminated by the user or application, `{"active": false}` is returned.
