# RaktSetu / RaktKhoj — Security Architecture Specification
**Document Version:** 2.0 (Post-Checkpoint 4 Remediation)  
**Target Environments:** Staging & Production (`raktkhoj.org`, Render API, Vercel Web)

---

## 1. Executive Security Architecture Overview

RaktSetu / RaktKhoj is an emergency blood coordination network operating in high-stress, mission-critical healthcare scenarios. In emergency coordination systems, user friction must be minimized while strictly upholding zero-trust data protection principles. 

The architecture employs **Cryptographic Capability-Based Security** combined with **Shared Distributed Security State** across API replicas to eliminate reliance on centralized sessions, prevent PII harvesting, guarantee request idempotency, enforce distributed rate limiting, and protect patient and donor privacy.

```
+----------------------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION (PWA / Web)                                  |
|   - SessionStorage Isolation (View & Close Tokens never stored in URLs or browser history)         |
|   - Hardened HTTP Headers (CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff)       |
+----------------------------------------------------------------------------------------------------+
                                      |                       |
                 Signed Capability    |                       | CORS Preflight
                 Authorization Tokens |                       | (Allowed Headers & Strict Origin)
                                      v                       v
+----------------------------------------------------------------------------------------------------+
|                                      API LAYER (Hono / Bun)                                        |
|   - Fail-Closed Security Middleware Stack                                                          |
|   - HMAC-SHA256 Token Verification (Strict Purpose, Time-to-Live, Scope Binding)                   |
|   - Production Error Sanitization (Masked internals with UUID correlation errorId)                 |
+----------------------------------------------------------------------------------------------------+
                                      |                       |
                   Atomic Upserts &   |                       | Database Connection Pool
                   Single-Use Nonces  |                       | (Drizzle ORM)
                                      v                       v
+----------------------------------------------------------------------------------------------------+
|                              SHARED DISTRIBUTED STATE (PostgreSQL)                                 |
|   - `rate_limit_counters`: Distributed sliding window rate limiting across instances               |
|   - `idempotency_keys`: Atomic request deduplication & cached response replay                      |
|   - `otp_sessions`: Server-side OTP validation, attempt decrementation, and resend cooldown         |
|   - `consumed_ticket_nonces`: Single-use cryptographic nonce retirement preventing replay attacks   |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Cryptographic Capability Token System

Traditional session cookies or persistent bearer logins create barriers for emergency blood seekers who need immediate access without registration. Conversely, using public request IDs as authorization keys allows unauthorized crawlers or scrapers to harvest sensitive patient and donor data.

RaktSetu implements **Signed Capability Tokens** signed with `DONOR_SESSION_SECRET` via `HMAC-SHA256`. Each capability token encapsulates:
1. `purpose`: Strict scope identifier preventing cross-purpose privilege escalation.
2. `expiresAt`: Explicit UNIX timestamp expiration.
3. Cryptographic payload binding (e.g., `requestId`, `donorId`, `phone`, `nonce`).

### Capability Token Matrix

| Token Name | Purpose Scope | Issued At | Consumer Endpoint | Authorization Boundary |
| :--- | :--- | :--- | :--- | :--- |
| **`requestViewToken`** | `request-view` | `POST /api/v1/requests` | `GET /api/v1/requests/:id` | Grants seeker read access to accepted donor contact details (name, phone, direct call URL) and exact hospital coordinates for this specific request. Revoked if request is terminal (`cancelled`, `expired`). |
| **`requestCloseToken`** | `request-close` | `POST /api/v1/requests` | `POST /api/v1/requests/:id/close` | Grants seeker exclusive authority to cancel and conclude the active search. Valid once; revokes view capabilities. |
| **`donorResponseToken`** | `donor-response` | Cascade Dispatch (Push/SMS) | `POST /api/v1/push/respond` | Deep link capability sent to specific compatible donor. Permits donor to `accepted` or `declined` without requiring a pre-existing authenticated session. |
| **`verificationTicket`** | `donor_registration` / `request_creation` | `POST /api/v1/auth/verify-otp` | `POST /api/v1/donors/register`, `POST /api/v1/requests` | Single-use cryptographic proof of verified phone ownership with embedded UUID nonce. Atomic DB consumption prevents replay. |

---

## 3. Privacy & PII Boundary Enforcement (P0.1 Remediation)

### 3.1 Waiting Room Access Control (`GET /api/v1/requests/:id`)
Prior to Checkpoint 4 remediation, any anonymous client knowing a request UUID could retrieve accepted donors' personal phone numbers and names.

Under the remediated architecture:
1. **Anonymous Callers / Observers:**
   - `acceptedDonors` is **strictly redacted to empty array (`[]`)**.
   - Notifications list contains only anonymized status records (donor IDs and phone numbers are stripped).
   - GPS coordinates are fuzzed to 2 decimal places (~1.1 km precision) to obscure exact location.
2. **Authorized Seeker:**
   - Must supply `requestViewToken` via `Authorization: Bearer <requestViewToken>` header or `x-view-token`.
   - The token signature is verified; `payload.purpose === 'request-view'` and `payload.requestId === params.id` are asserted.
   - If the request status is `cancelled`, `expired`, or terminal, accepted donor details are withheld.
   - Unmasked contact cards (`name`, `phone`, `tel:+91...`) and exact coordinates are returned only when active and authorized.
3. **URL Leakage Prevention:**
   - Capability tokens are no longer persisted in query parameters.
   - The Next.js frontend stores `requestViewToken` and `requestCloseToken` in isolated browser `sessionStorage` (`raktkhoj_view_token_<id>`, `raktkhoj_close_token_<id>`).
   - Browser navigation transitions cleanly to `/request/<id>` without exposing secrets in browser history or web server access logs.

---

## 4. Distributed Security State Architecture (P0.2 Remediation)

In a multi-replica deployment (e.g., auto-scaled Render or Kubernetes nodes), in-memory Maps allow replay attacks and bypass rate limits across nodes. RaktSetu persists all security and rate-limiting state directly to PostgreSQL using atomic SQL operations.

### 4.1 Schema Definitions (`packages/db/src/schema/security-state.ts`)

#### 1. `rate_limit_counters`
- Primary key: `key` (IP or IP+Endpoint hash).
- Columns: `points` (integer), `reset_at` (timestamptz).
- Atomic Upsert Logic:
  ```sql
  INSERT INTO rate_limit_counters (key, points, reset_at)
  VALUES ($1, 1, $2)
  ON CONFLICT (key) DO UPDATE SET
    points = CASE WHEN rate_limit_counters.reset_at < NOW() THEN 1 ELSE rate_limit_counters.points + 1 END,
    reset_at = CASE WHEN rate_limit_counters.reset_at < NOW() THEN $2 ELSE rate_limit_counters.reset_at END
  RETURNING points, reset_at;
  ```

#### 2. `idempotency_keys`
- Primary key: `key` (Unique idempotency key from header).
- Columns: `requester_id` (text), `operation` (text), `response_payload` (jsonb), `created_at` (timestamptz), `expires_at` (timestamptz).
- Prevents duplicate emergency request creation during mobile network disconnects and retries.

#### 3. `otp_sessions`
- Primary key: `(phone, purpose)`.
- Columns: `hashed_otp` (HMAC-SHA256 hex), `attempts` (integer), `max_attempts` (integer default 5), `expires_at` (timestamptz), `last_sent_at` (timestamptz).
- Enforces strict 60-second cooldown on resends and locks out sessions after 5 failed attempts across all replicas.

#### 4. `consumed_ticket_nonces`
- Primary key: `nonce` (UUID string).
- Columns: `phone` (text), `purpose` (text), `consumed_at` (timestamptz), `expires_at` (timestamptz).
- Atomic Single-Use Consumption:
  ```sql
  INSERT INTO consumed_ticket_nonces (nonce, phone, purpose, expires_at)
  VALUES ($1, $2, $3, $4);
  ```
  A duplicate nonce instantly triggers a unique key violation (`23505`), preventing concurrent and replay attacks.

---

## 5. Network Security, CORS & Defense-in-Depth Headers (P1.1 & P1.2 Remediation)

### 5.1 Production CORS Policy
- Allowed Origins: Configurable via `CORS_ORIGIN` (defaults to `http://localhost:3000,https://raktkhoj.org,https://raktsetu-six.vercel.app`).
- Allowed Methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Allowed Custom Headers:
  - `Content-Type`
  - `Authorization`
  - `Idempotency-Key` / `x-idempotency-key`
  - `x-close-token`
  - `x-view-token`
  - `x-verification-ticket`
  - `x-enforce-rate-limit`
- Credentials: `credentials: true` with strict origin matching (no wildcard `*` with credentials).

### 5.2 HTTP Security Headers
All API and Web responses emit strict defense-in-depth headers:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type confusion attacks.
- `X-Frame-Options: DENY`: Prevents clickjacking and unauthorized iframe embedding.
- `X-XSS-Protection: 1; mode=block`: Legacy browser XSS filter enforcement.
- `Referrer-Policy: strict-origin-when-cross-origin`: Obscures internal paths on outbound links.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`: Forces HTTPS across all connections.
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`: Restricts sensitive browser features.

### 5.3 Production Error Sanitization
In production (`NODE_ENV=production`), `app.onError` traps all unhandled exceptions:
- Generates a cryptographically random UUID correlation ID (`errorId = crypto.randomUUID()`).
- Logs the full stack trace and error message internally with `[ERROR:<errorId>]`.
- Returns an opaque, sanitized JSON response to the client:
  ```json
  {
    "error": "An unexpected error occurred. Please contact support.",
    "errorId": "f49b263b-502d-4365-8ffc-5299fea3913c",
    "status": 500
  }
  ```
- Prevents database connection strings, schema names, or driver internals from leaking to attackers.

