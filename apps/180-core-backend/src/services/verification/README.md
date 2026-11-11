# 180 Verify: backend module

KYC sessions (PAN, driving licence, voter ID, Aadhaar (self-declared), bank/UPI, face match with liveness) for the 180 Profile `/verify` page and the identity SDK. Mounted at `/api/v1/identity/verify` and `/api/v1/verify`.

## Provider modes

| Env | Values | Default |
| --- | --- | --- |
| `VERIFY_PROVIDER_MODE` | `mock` \| `live` | `mock` when `NODE_ENV !== 'production'`, else `live` |
| `VERIFY_APISETU_MODE` / `VERIFY_RAZORPAY_MODE` | per-provider override | inherits `VERIFY_PROVIDER_MODE` |
| `VERIFY_ALLOW_SANDBOX_IN_PRODUCTION` | `true` to allow mock in prod | `false`. Without it the module answers 503 `VERIFY_MODULE_MISCONFIGURED` |

Every response and signed result carries `environment: 'sandbox'` when **any** provider is mocked, and `'live'` only when both are live. In live mode, an upstream failure returns **HTTP 502 `PROVIDER_UNAVAILABLE`**. Mock data is never substituted.

Switching to live tomorrow: set `VERIFY_PROVIDER_MODE=live`, `APISETU_CLIENT_ID=com.simplicion`, `APISETU_API_KEY`, `RAZORPAY_KEY_ID/SECRET`, `RAZORPAYX_ACCOUNT_NUMBER`, `VERIFY_SESSION_SECRET`. Then resolve the `TODO(api-setu-subscription)` markers in `../apisetu.service.ts` against the specs shown in your API Setu dashboard.

## Sandbox test identities (mock mode)

The mock is **deterministic and driven only by the document number**. It never echoes the name or DOB you type, so name, DOB and gender matching are exercised for real. **Any well-formed number that is not in this table returns NOT_FOUND.** Each call waits a random 100–400 ms (`VERIFY_MOCK_LATENCY_MS` overrides it).

**Persona A, happy path:** `ARJUN VIKRAM MEHTA`, DOB `1990-04-12`, father `VIKRAM SINGH MEHTA`, `MALE`.
**Persona B:** `PRIYA RAMESH IYER`, DOB `1994-11-03`, father `RAMESH IYER`, `FEMALE`.

| Doc | Number | Registry returns | Expected outcome when you enter Persona A |
| --- | --- | --- | --- |
| PAN | `AFZPM4821K` | Persona A, VALID, Aadhaar-seeded | VERIFIED |
| PAN | `BKDPS7310L` | `SURESH KUMAR SHARMA`, same DOB | REJECTED `DOCUMENT_NAME_MISMATCH` |
| PAN | `CQRPX5555Z` | Persona A, **DEACTIVATED** | REJECTED `DOCUMENT_INVALID` |
| PAN | `DJKPM1111A` | Persona A, **INOPERATIVE** (not Aadhaar-linked) | REJECTED `DOCUMENT_INVALID` |
| PAN | `AGJPI2468B` | Persona B, VALID | VERIFIED with Persona B details |
| PAN | `ZZZPZ9999Z` | simulated upstream outage | HTTP 502 `PROVIDER_UNAVAILABLE` |
| DL | `MH0220190012345` | Persona A, ACTIVE, valid till 2040-04-11 | VERIFIED |
| DL | `KA0120150045678` | Persona A but DOB `1988-01-01` | REJECTED `DOCUMENT_DOB_MISMATCH` |
| DL | `DL0420100098765` | Persona A, **EXPIRED** 2020-06-30 | REJECTED `DOCUMENT_EXPIRED` |
| DL | `TN0920170033333` | Persona A, **SUSPENDED** | REJECTED `DOCUMENT_INVALID` |
| DL | `KL0720160024680` | `PRIYA R IYER` (initial), Persona B DOB | VERIFIED for Persona B |
| Voter | `ZRT1234567` | Persona A, ACTIVE | VERIFIED |
| Voter | `KLX7654321` | `PRIYA R IYER`, DOB year-only `1994` | VERIFIED for Persona B |
| Voter | `GHJ1112223` | Persona A but gender **FEMALE** | REJECTED `DOCUMENT_GENDER_MISMATCH` (when you enter MALE) |
| Aadhaar | `2345 6789 0124` (also `9876 5432 1012`, `4567 8912 3451`) | n/a: **SELF_DECLARED**, Verhoeff-valid | Accepted; never registry truth. An Aadhaar-only session can reach MANUAL_REVIEW at best |
| Bank | `100020003000` / `HDFC0001234` | `ARJUN V MEHTA` | VERIFIED |
| Bank | `200030004000` / `ICIC0000456` | `NEHA RAJESH GUPTA` | REJECTED `BANK_NAME_MISMATCH` |
| Bank | `300040005000` / `SBIN0001111` | async: PENDING, then `MR ARJUN VIKRAM MEHTA` on poll | `PENDING` → VERIFIED at `/complete` |
| Bank | `300040005001` / `SBIN0001111` | never completes | `PENDING` → final MANUAL_REVIEW |
| Bank | `400050006000` / `UTIB0000789` | closed/invalid | REJECTED `BANK_ACCOUNT_INVALID` |
| Bank | `500060007000` / `KKBK0000321` | `PRIYA R IYER` | VERIFIED for Persona B |
| Bank | `999999999999` / `HDFC0001234` | simulated outage | HTTP 502 `PROVIDER_UNAVAILABLE` |
| UPI | `arjun.mehta@okhdfc` | `ARJUN VIKRAM MEHTA` | VERIFIED |
| UPI | `arjun@ybl` | `Arjun Mehta` | VERIFIED (missing middle name) |
| UPI | `neha.gupta@okicici` | `NEHA RAJESH GUPTA` | REJECTED `BANK_NAME_MISMATCH` |
| UPI | `priya.iyer@oksbi` | `PRIYA IYER` | VERIFIED for Persona B |
| UPI | `nobody@okaxis` (or any unknown) | not found | REJECTED `UPI_NOT_FOUND` |
| RC (B2B) | `MH02AB1234` | owner Persona A, ACTIVE | found |
| RC (B2B) | `DL3CAB0001` | owner `SURESH KUMAR SHARMA`, BLACKLISTED | found, status BLACKLISTED |
| GSTIN (B2B) | `27AFZPM4821K1ZQ` | `ARJUN VIKRAM MEHTA` / MEHTA TRADERS, ACTIVE | found |
| GSTIN (B2B) | `29AGJPI2468B1ZG` | Persona B, CANCELLED | found, status CANCELLED |

Quick start without an app: `POST /api/v1/identity/verify/session/demo` (sandbox only) and open the returned `verifyUrl`. For server-to-server `GET /session/:id/result` on demo sessions, use Basic auth `180_verify_sandbox_demo:180_verify_sandbox_demo_secret` (sandbox only).

## Session API (as implemented)

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `POST /session` | Basic `clientId:clientSecret` (server) **or** `{clientId}` + registered `Origin` (browser) | 201 `{sessionId, sessionToken, verifyUrl, expiresAt, documents, environment}`. Bad origin → 403 `ORIGIN_NOT_ALLOWED`. Wildcard `*` origins are not honoured |
| `POST /session/demo` | none (sandbox only) | all doc types, `parentOrigin: null` |
| `GET /session/:id/public` | Bearer sessionToken | `steps.bank.status` / `steps.face.status` are `NOT_REQUESTED` when not requested |
| `POST /session/:id/documents` | Bearer | max 5 attempts per doc type; format errors → 400 `INVALID_DOCUMENT_NUMBER` (not counted) |
| `POST /session/:id/bank` | Bearer | requires one registry-verified identity doc first (409 `STEP_INCOMPLETE`) |
| `POST /session/:id/liveness/challenge` | Bearer | single use, 2-minute expiry, a new challenge replaces the old one |
| `POST /session/:id/complete` | Bearer | max 3 attempts; adds `final` and `attemptsRemaining` |
| `GET /session/:id/result` | Basic (owning app) | RS256 JWS (`kid` of `/.well-known/jwks.json`), claims include `aud`=clientId, `iss`=`180-verify`, `iat`, `exp` |

Error envelope: `{status:'FAILED', error_code, error_message}`.

## Data handling

* Images are **never** stored in Postgres. Document face crops live in an in-process cache (`face-cache.ts`) for at most 30 minutes and are purged on completion or expiry.
  **Multi-instance limitation:** with more than one backend instance, `/documents` and `/complete` for a session must reach the same instance (sticky sessions), or the cache must move to an encrypted shared store such as Redis with a TTL.
* Aadhaar: only the last 4 digits survive validation (`XXXX XXXX 1234`). It is never logged, returned or stored in full, and is labelled `source: 'SELF_DECLARED'`.
* Logs carry masked identifiers only (`ABXXXXX34F`, `XXXXXXXX3000`).
* The DB stores registry name, DOB, father's name and gender (needed for the signed result), masked numbers, verdicts and audit events. Add a retention job for `VerificationSession` and `VerificationAuditEvent` rows.
