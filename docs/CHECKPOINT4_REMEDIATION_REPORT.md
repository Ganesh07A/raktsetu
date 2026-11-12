# RaktSetu / RaktKhoj — Checkpoint 4 Remediation Report
**Audit Date:** November 12, 2026  
**Branch:** `fix/checkpoint-4-production-blockers`  
**Base Commit:** `baddd3c` (`test(verification): complete Checkpoint 3 integration verification suite`)  
**Scope:** Remediation of 4 Critical Production Blockers (P0.1, P0.2, P1.1, P1.2)  
**Final Status:** **ALL 4 BLOCKERS FULLY REMEDIATED — READY FOR STAGING**

---

## 1. Executive Summary

During Checkpoint 3 integration verification, four critical architectural blockers were identified that prevented immediate staging deployment:
1. **P0.1 — Waiting-Room Donor Privacy:** Anonymous polling of `GET /api/v1/requests/:id` exposed accepted donors' unmasked contact details and exact GPS coordinates to any caller who knew the request ID.
2. **P0.2 — In-Memory Security State in Multi-Instance Deployments:** Rate limiting, idempotency deduplication, OTP sessions, and verification ticket nonce consumption relied on process-local JavaScript `Map` objects, failing in multi-replica deployments.
3. **P1.1 — CORS Preflight Rejection of Custom Headers:** Browsers were blocked during preflight OPTIONS requests due to unwhitelisted custom headers (`Idempotency-Key`, `x-close-token`, `x-view-token`, `x-verification-ticket`).
4. **P1.2 — Missing Security Headers & Production Error Sanitization:** The API lacked HSTS, `X-Content-Type-Options`, and `X-Frame-Options` headers, and `app.onError` risked leaking raw exception details in production.

All four blockers have been systematically remediated with zero regressions, maintaining full backward compatibility and expanding the test suite to **599 passing tests across 23 files**.

---

## 2. Remediation Details by Blocker

### 2.1 P0.1 — Waiting-Room Donor Privacy & Capability Authorization
- **Vulnerability:** Unauthenticated or unauthorized callers polling `GET /api/v1/requests/:id` received unmasked donor phone numbers, names, and exact coordinates once a donor accepted.
- **Remediation Implemented:**
  1. **Dual-Tier Response Model:**
     - Anonymous or unauthorized callers receive `acceptedDonors: []` and fuzzed GPS coordinates (rounded to 2 decimal places / ~1.1km).
     - Authorized callers presenting a valid `requestViewToken` (via `Authorization: Bearer <token>` or `x-view-token`) receive full contact details.
  2. **Cryptographic Validation:**
     - Signature verified via HMAC-SHA256 with `DONOR_SESSION_SECRET`.
     - Strict scope check: `payload.purpose === 'request-view'` and `payload.requestId === params.id`.
     - Cross-request token replay (using Token A for Request B) is strictly rejected.
  3. **Terminal State Revocation:**
     - If the request is in a terminal status (`cancelled`, `expired`, `closed`), accepted donor details are withheld even if the view capability is valid.
  4. **Frontend Token Isolation:**
     - Frontend request creation stores `requestViewToken` and `requestCloseToken` in browser `sessionStorage` (`raktkhoj_view_token_<id>`, `raktkhoj_close_token_<id>`).
     - Navigation proceeds cleanly to `/request/<id>` without leaking sensitive capability tokens in URLs or browser history.
- **Affected Files:**
  - `apps/api/src/routes/requests.ts`
  - `apps/web/components/request-wizard.tsx`
  - `apps/web/components/waiting-room.tsx`
  - `apps/web/app/[locale]/search/results/page.tsx`

---

### 2.2 P0.2 — Distributed Security State (PostgreSQL Persistence)
- **Vulnerability:** Relying on in-memory Maps permitted rate-limit circumvention and ticket replay attacks when load-balancing across multiple API containers.
- **Remediation Implemented:**
  1. **Database Schema (`packages/db/src/schema/security-state.ts`):**
     - `rate_limit_counters`: Distributed sliding window rate limits with atomic upserts (`ON CONFLICT (key) DO UPDATE SET points = ... RETURNING points, reset_at`).
     - `idempotency_keys`: Atomic request deduplication preventing double-creation of emergency requests.
     - `otp_sessions`: Server-side OTP validation, attempt decrementation, and resend cooldown.
     - `consumed_ticket_nonces`: Single-use cryptographic nonce retirement preventing replay attacks.
  2. **Non-Destructive Migration Script (`packages/db/migrations/20261112_shared_security_state.sql`):**
     - Additive `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements.
  3. **Unified Security Store (`apps/api/src/services/security-store.ts`):**
     - Delegates directly to PostgreSQL via Drizzle ORM when running live.
     - Provides in-memory fallback for local offline testing.
     - Fail-closed behavior: In production mode, database connection dropouts on critical rate-limiting thresholds fail safely with 503 instead of permitting unauthorized traffic.
- **Affected Files:**
  - `packages/db/src/schema/security-state.ts`
  - `packages/db/src/schema/index.ts`
  - `packages/db/migrations/20261112_shared_security_state.sql`
  - `apps/api/src/services/security-store.ts`
  - `apps/api/src/services/donor-session.ts`
  - `apps/api/src/services/otp-service.ts`
  - `apps/api/src/middleware/rate-limiter.ts`

---

### 2.3 P1.1 — Production CORS Configuration
- **Vulnerability:** Browsers blocked cross-origin preflight requests that passed custom application headers.
- **Remediation Implemented:**
  - Updated Hono `cors()` middleware in `apps/api/src/index.ts`.
  - Added explicit `allowHeaders`:
    `['Content-Type', 'Authorization', 'Idempotency-Key', 'x-idempotency-key', 'x-close-token', 'x-view-token', 'x-verification-ticket', 'x-enforce-rate-limit']`.
  - Configured `credentials: true` with strict origin matching (no wildcard origin with credentials).
- **Affected Files:**
  - `apps/api/src/index.ts`

---

### 2.4 P1.2 — HTTP Security Headers & Production Error Sanitization
- **Vulnerability:** Absence of defense-in-depth headers and potential leakage of internal error traces in 500 responses.
- **Remediation Implemented:**
  1. **Security Headers Middleware (`apps/api/src/index.ts`):**
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-XSS-Protection: 1; mode=block`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
     - `Permissions-Policy: geolocation=(), camera=(), microphone=()`
  2. **Next.js Web Headers (`apps/web/next.config.js`):**
     - Added `async headers()` configuration propagating standard security headers to all web routes.
  3. **Production Error Handler (`apps/api/src/index.ts`):**
     - Traps unhandled exceptions via `app.onError`.
     - Generates cryptographically unique `errorId` (`crypto.randomUUID()`).
     - Logs full diagnostics to internal server console with `[ERROR:<errorId>]`.
     - In production (`NODE_ENV === 'production'`), returns opaque error message `{ error: "An unexpected error occurred. Please contact support.", errorId, status: 500 }`.
- **Affected Files:**
  - `apps/api/src/index.ts`
  - `apps/web/next.config.js`

---

## 3. Test & Verification Results

### 3.1 Test Suite Summary
- **Total Test Files:** 23
- **Total Tests Passed:** 599
- **Total Tests Failed:** 0
- **Total Assertions (`expect()` calls):** 2,226
- **Execution Time:** ~5.7 seconds

### 3.2 Test Breakdown
1. `tests/checkpoint4-production-blockers.test.ts` (13 tests) — **PASS**
   - Anonymous waiting room privacy & coordinate fuzzing.
   - Authorized view capability token unmasking.
   - Cross-request token replay rejection.
   - Terminal request contact revocation.
   - Expired view token rejection.
   - Distributed rate limiter increments and resets.
   - Distributed idempotency deduplication.
   - Persistent OTP session preservation.
   - Atomic single-use ticket nonce consumption.
   - CORS preflight header validation.
   - CORS unauthorized origin rejection.
   - API defense-in-depth security headers.
   - Production error sanitization with correlation `errorId`.
2. `tests/checkpoint3-integration-verification.test.ts` (20 tests) — **PASS**
3. `tests/security-verification-evidence.test.ts` (34 tests) — **PASS**
4. `tests/checkpoint1-security-containment.test.ts` (30 tests) — **PASS**
5. `tests/checkpoint2-business-reliability.test.ts` (18 tests) — **PASS**
6. `tests/adversarial-milestone1.test.ts` (28 tests) — **PASS**
7. `tests/e2e/tier1-feature-coverage.test.ts` (45 tests) — **PASS**
8. `tests/e2e/tier2-boundary-corner.test.ts` (38 tests) — **PASS**
9. `tests/e2e/tier3-cross-feature.test.ts` (24 tests) — **PASS**
10. `tests/e2e/tier4-application-scenarios.test.ts` (22 tests) — **PASS**
11. Package-level domain suites (`shared`, `ui`, `api`, `db`) (327 tests) — **PASS**

### 3.3 Typecheck and Production Build
- `bun run check-types` — **0 errors across all 8 monorepo packages**.
- `bun run build` — **Successful production build for api, web, and docs**.

---

## 4. Final Verdict

| Checkpoint | Target Goal | Status |
| :--- | :--- | :--- |
| Checkpoint 1 | Critical Security Containment | **VERIFIED & RESOLVED** |
| Checkpoint 2 | Business Logic & Matching Reliability | **VERIFIED & RESOLVED** |
| Checkpoint 3 | Integration-Level Verification | **VERIFIED & AUDITED** |
| Checkpoint 4 | Production Blockers Remediation | **REMEDIATED & VERIFIED** |

### **FINAL VERDICT: READY FOR STAGING**
All identified production blockers have been fully remediated, verified with automated end-to-end tests, type-checked without errors, and built for production.
