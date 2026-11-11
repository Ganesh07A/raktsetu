# RaktSetu Production Remediation Master Plan

## 1. Executive Summary & Audit Baseline
This document tracks the remediation of vulnerabilities identified in the RaktKhoj Independent QA, PWA & Security Assessment v1.0.
The remediation is executed in three targeted checkpoints:
- **Checkpoint 1: Security Containment** (C-01 to C-05, H-05, H-06, and suspicious API routes)
- **Checkpoint 2: Business Logic & Reliability** (H-01 to H-04, H-07, request lifecycle, outbox notifications)
- **Checkpoint 3: Production Polish & Verification** (M-01 to M-14, PWA, accessibility, and release documentation)

Current Branch: `fix/checkpoint-1-security-containment`

---

## 2. Checkpoint 1 Remediation Matrix

### C-01: Eliminate Synthetic Blood-Bank Inventory
- **Finding ID**: C-01
- **Severity**: Critical (P0)
- **Affected Files**:
  - `apps/api/src/services/eraktkosh-proxy.ts`
  - `apps/api/src/routes/blood-banks.ts`
  - `packages/shared/src/types.ts`
  - `packages/db/src/seed-data.ts`
- **Root Cause**:
  - `fetchNearbyOpenDataBloodBanks` in `eraktkosh-proxy.ts` was generating synthetic stock using character hash arithmetic `(name.charCodeAt(0) + bg.charCodeAt(0)) % 15 + 3`, a fallback default phone `+91-240-2334411`, query-time timestamps, and marked items as `isVerified: true` with `source: 'partner'`.
  - Fallback in `blood-banks.ts` returned hardcoded mockStore stock in search paths.
- **Proposed Solution**:
  - Introduce explicit provenance tags (`source: 'eraktkosh' | 'partner' | 'manual' | 'unverified'`) and verification statuses (`'source_reported' | 'partner_confirmed' | 'unverified' | 'unavailable'`).
  - Strip all fabricated phone numbers and mathematical stock generators.
  - Return truthful availability: directory information without manufactured stock quantities (`unitsAvailable: null` or empty stock with status `'unverified'`).
  - Never fabricate distances when coordinates are missing (`distanceKm: null`).
  - Add standard medical disclaimer to search results.
- **Acceptance Criteria**:
  - No synthetic inventory reaches production responses.
  - Unknown inventory returns truthful directory/unavailable state, never `bank_found`.
- **Test Coverage**:
  - Unit tests in `eraktkosh-proxy.test.ts` and `blood-banks.test.ts` asserting no synthetic quantities, valid provenance headers, and truthful fallback.
- **Status**: COMPLETED (Verified via `checkpoint1-security-containment.test.ts` & `eraktkosh-proxy.test.ts`)

---

### C-02: Secure Emergency Request Creation
- **Finding ID**: C-02
- **Severity**: Critical (P0)
- **Affected Files**:
  - `apps/api/src/routes/requests.ts`
  - `apps/api/src/services/request-service.ts`
  - `packages/shared/src/validation.ts`
- **Root Cause**:
  - `POST /api/v1/requests` permitted unauthenticated request submission without rate limits, phone ownership verification, idempotency checks, or notification fan-out throttles.
- **Proposed Solution**:
  - Enforce server-side Zod validation with `createBloodRequestSchema.strict()`.
  - Require verified requester phone ownership via `verificationTicket` (issued after server OTP verification).
  - Add layered rate limiting (3 requests/phone/hour, 10 requests/IP/hour).
  - Add `Idempotency-Key` support to reject or safely de-duplicate rapid submissions.
  - Respect `NOTIFICATIONS_ENABLED=false` kill switch and bounded recipient limits (`MAX_DONORS_PER_REQUEST`).
- **Acceptance Criteria**:
  - Unverified requests rejected.
  - Rate limit returns HTTP 429 with `Retry-After`.
  - Duplicate idempotency keys return identical response without extra fan-out.
  - Emergency notification dispatch disabled when kill switch is engaged.
- **Test Coverage**:
  - Tests in `requests.test.ts` for rate limits, idempotency, and kill switch.
- **Status**: COMPLETED (Verified via automated tests)

---

### C-03: Protect Donor Personal Information
- **Finding ID**: C-03
- **Severity**: Critical (P0)
- **Affected Files**:
  - `apps/api/src/routes/donors.ts`
  - `apps/api/src/services/donor-matcher.ts`
  - `packages/shared/src/types.ts`
- **Root Cause**:
  - Public discovery endpoints `GET /api/v1/donors/compatible` and `POST /api/v1/donors/match` returned internal donor database entities including names, phone numbers, exact latitude/longitude, and internal IDs.
- **Proposed Solution**:
  - Separate internal entities from public discovery DTOs.
  - Return only aggregate/anonymized discovery summaries (e.g. `matchedCount`, `radiusKm`, `bloodGroup`) to unauthenticated users.
  - Strip exact coordinates and full phone numbers.
  - Enforce server-side hard radius maximum of 50 km.
  - Release donor contact details strictly after a verified emergency request receives an explicit donor acceptance and request is active.
- **Acceptance Criteria**:
  - Anonymous scraping of donor directory is impossible.
  - Exact coordinates never appear in public discovery endpoints.
  - Donor contact released only upon explicit acceptance.
- **Test Coverage**:
  - Security tests verifying redaction of coordinates, phone, and donor names in discovery.
- **Status**: COMPLETED (Verified via automated tests)

---

### C-04: Genuine Server-Side OTP Verification
- **Finding ID**: C-04
- **Severity**: Critical (P0)
- **Affected Files**:
  - `apps/api/src/services/otp-service.ts` [NEW]
  - `apps/api/src/routes/auth.ts` [NEW]
  - `apps/api/src/services/donor-session.ts`
  - `apps/api/src/routes/donors.ts`
  - `apps/web/app/[locale]/donor/register/page.tsx`
- **Root Cause**:
  - Donor registration in web had pre-filled mock code `123456`, client-side-only verification `otpCode === '123456' || otpCode.length === 6`, and backend `POST /api/v1/donors/register` accepted arbitrary unverified phone numbers.
- **Proposed Solution**:
  - Implement server-side OTP flow:
    - `POST /api/v1/auth/otp/send`: Generates 6-digit cryptographic OTP, hashes with HMAC-SHA256, stores with 5-minute TTL.
    - `POST /api/v1/auth/otp/verify`: Verifies hash, max 5 attempts, issues signed short-lived single-use `verificationTicket`.
  - In `POST /api/v1/donors/register`, verify and atomically consume ticket.
  - Remove all client-side pre-filled codes and client equality shortcuts.
  - Adapter architecture for SMS providers with fail-closed production mode.
- **Acceptance Criteria**:
  - Cannot register a donor without proving ownership via verified ticket.
  - Brute force locked out after 5 failed attempts.
  - Tickets cannot be replayed.
- **Test Coverage**:
  - OTP lifecycle, attempt throttling, ticket replay prevention, and registration security tests.
- **Status**: COMPLETED (Verified via automated tests)

---

### C-05: Enforce Donor Medical Eligibility Server-Side
- **Finding ID**: C-05
- **Severity**: Critical (P0)
- **Affected Files**:
  - `packages/shared/src/validation.ts`
  - `packages/shared/src/constants.ts`
  - `apps/api/src/routes/donors.ts`
  - `apps/api/src/services/donor-matcher.ts`
- **Root Cause**:
  - Registration backend did not strictly validate age, weight, or cooldown intervals, and matching service retained soft-ineligible donors in notification cascades.
- **Proposed Solution**:
  - Server-side validation of:
    - Age: 18 to 65 years.
    - Weight: $\ge 45$ kg.
    - No future last donation date.
    - Gender cooldown (male 90 days, female 120 days).
  - Reject ineligible registrations with field-level 400 errors.
  - Exclude ineligible/cooldown donors from the notification matching pool during emergency requests.
- **Acceptance Criteria**:
  - Underage, underweight, and cooldown-violating registration attempts are rejected.
  - Ineligible donors never receive push notifications.
- **Test Coverage**:
  - Boundary tests for age, weight, and cooldown in registration and matching services.
- **Status**: COMPLETED (Verified via automated tests)

---

### H-05: Protect Request Detail Endpoints
- **Finding ID**: H-05
- **Severity**: High (P1)
- **Affected Files**:
  - `apps/api/src/routes/requests.ts`
  - `apps/api/src/services/donor-session.ts`
- **Root Cause**:
  - `GET /api/v1/requests/:id` returned full patient names, coordinates, and request state to anyone with the UUID.
  - `PATCH /api/v1/requests/:id/status` was exposed unauthenticated.
- **Proposed Solution**:
  - Introduce `requestViewToken` (signed capability token).
  - Requests queried without view token return redacted information (no exact coordinates, masked patient name).
  - `requestCloseToken` cannot be used for reading.
  - Remove or protect `PATCH /:id/status`.
- **Acceptance Criteria**:
  - Anonymous callers cannot read exact patient coordinates or unmasked personal data.
  - Separate capabilities enforced for viewing vs closing vs accepting.
- **Test Coverage**:
  - Capability authorization and redaction tests.
- **Status**: COMPLETED (Verified via automated tests)

---

### H-06: Centralized API Rate Limiting
- **Finding ID**: H-06
- **Severity**: High (P1)
- **Affected Files**:
  - `apps/api/src/middleware/rate-limiter.ts` [NEW]
  - `apps/api/src/index.ts`
- **Root Cause**:
  - Missing rate limiting across sensitive endpoints (OTP, registration, requests, push response).
- **Proposed Solution**:
  - Reusable rate limiting middleware supporting sliding window / fixed window atomic counters per IP and per key.
  - Returns HTTP 429, `Retry-After: <seconds>`, and standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- **Acceptance Criteria**:
  - Burst attacks and excessive attempts receive 429.
- **Test Coverage**:
  - Rate limiting tests on OTP and request endpoints.
- **Status**: COMPLETED (Verified via automated tests)

---

## 3. Checkpoint 2 Remediation Matrix: Business Logic & Reliability

### H-01: Correct Blood-Group Deep Links & Selection Integrity
- **Finding ID**: H-01
- **Severity**: High (P1)
- **Affected Files**:
  - `apps/web/app/[locale]/request/page.tsx`
  - `apps/web/components/request-wizard.tsx`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Root Cause**:
  - `RequestWizard` hardcoded state initialization to `'AB+'` and ignored `useSearchParams()`.
  - When deep-linking with `/request?bloodGroup=...`, the parameter was ignored.
  - If invalid or missing, it silently selected `'AB+'`.
  - Language toggle discarded search query parameters.
- **Proposed Solution**:
  - Read `searchParams.get('bloodGroup')`, normalizing whitespace and URL-encoded plus signs (`%2B`, `+`, trailing spaces).
  - Validate across all 8 ABO/Rh blood groups (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
  - Initialize to `null` if absent or invalid; NEVER default silently to `AB+`.
  - Disable Continue button in Step 1 until explicit user selection.
  - Preserve selection across navigation, step history, and language toggle.
  - Wrap page in `<React.Suspense>` to ensure Next.js SSR hydration safety.
- **Acceptance Criteria**:
  - Navigating to `/request?bloodGroup=B%2B` selects B+.
  - Invalid blood groups do not select any blood group.
  - Switching language retains selected blood group in URL.
- **Test Coverage**:
  - 8-group normalization and invalid-value exclusion tests in `checkpoint2-business-reliability.test.ts`.
- **Status**: COMPLETED (Verified via automated tests)

---

### H-02: Persist Matched Blood-Bank References
- **Finding ID**: H-02
- **Severity**: High (P1)
- **Affected Files**:
  - `packages/db/src/schema/blood-requests.ts`
  - `packages/shared/src/types.ts`
  - `apps/api/src/routes/requests.ts`
  - `apps/api/src/services/request-service.ts`
  - `apps/web/components/waiting-room.tsx`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Root Cause**:
  - When institutional stock was found, request status transitioned to `bank_found`, but matched blood bank identifier, name, phone, address, and distance were discarded and never persisted to the request record.
  - Waiting room UI did not surface actionable blood bank contacts to the seeker.
- **Proposed Solution**:
  - Extended `blood_requests` schema and `BloodRequest` interface with:
    `matched_bank_id`, `matched_bank_name`, `matched_bank_phone`, `matched_bank_address`, `matched_bank_distance_km`, `matched_bank_provenance`, `matched_bank_verification_status`.
  - Stored verified matched bank details during request creation in both Postgres DB and mock store.
  - Returned matched bank details in `GET /api/v1/requests/:id` to authorized seekers.
  - Rendered actionable blood bank card in waiting room with direct call button (`tel:`) and location details.
- **Acceptance Criteria**:
  - Request marked `bank_found` contains full matched bank reference.
  - Waiting room presents actionable blood bank contact and address.
- **Test Coverage**:
  - Verified in `checkpoint2-business-reliability.test.ts` via request creation and capability retrieval.
- **Status**: COMPLETED (Verified via automated tests)

---

### H-03: Respect Donor Travel Radius
- **Finding ID**: H-03
- **Severity**: High (P1)
- **Affected Files**:
  - `apps/api/src/services/donor-matcher.ts`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Root Cause**:
  - Donor matching previously applied donor travel willingness radius inconsistently or allowed seeker radius to override donor willingness.
- **Proposed Solution**:
  - Enforced strict bidirectional filtering:
    `dist <= effectiveSeekerRadius && dist <= donorMaxRadius`.
  - Ensured donor's configured willingness radius (e.g. 5 km) strictly prevents matching when the donor is farther away (e.g. 8 km), regardless of seeker search radius (e.g. 10 km or 50 km).
- **Acceptance Criteria**:
  - Donors beyond their own travel willingness radius are never matched.
  - Donors beyond seeker radius are never matched.
- **Test Coverage**:
  - Boundary distance tests in `checkpoint2-business-reliability.test.ts`.
- **Status**: COMPLETED (Verified via automated tests)

---

### H-04: Correct Blood-Component Semantics
- **Finding ID**: H-04
- **Severity**: High (P1)
- **Affected Files**:
  - `packages/shared/src/blood-compatibility.ts`
  - `packages/shared/src/types.ts`
  - `apps/api/src/services/donor-matcher.ts`
  - `apps/api/src/routes/donors.ts`
  - `apps/api/src/routes/requests.ts`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Root Cause**:
  - System applied Red Blood Cell (RBC) compatibility rules to all component types.
  - RBC rules are clinically hazardous for Fresh Frozen Plasma (FFP), where donor antibodies are transfused (e.g. AB is universal plasma donor, O is universal plasma recipient).
  - Whole blood requires identical ABO groups to avoid recipient red cell hemolysis from donor plasma antibodies.
- **Proposed Solution**:
  - Implemented component-specific compatibility matrices:
    - `RBC_COMPATIBILITY` (PRBC): Universal donor O-, universal recipient AB+.
    - `WHOLE_BLOOD_COMPATIBILITY`: Identical ABO group with compatible Rh.
    - `PLASMA_COMPATIBILITY` (FFP): Universal donor AB, universal recipient O.
    - `PLATELET_COMPATIBILITY`: ABO identical and plasma-compatible.
  - Enhanced `getCompatibleDonorGroups(recipientGroup, componentType)` and `isDonorCompatible(donorGroup, recipientGroup, componentType)`.
  - Integrated `componentType` into `donorMatcher.findCompatibleDonors` and routes.
- **Acceptance Criteria**:
  - FFP compatibility follows plasma rules (AB gives to all; O receives all).
  - Whole blood never matches mismatched ABO groups.
- **Test Coverage**:
  - Comprehensive clinical matrix tests in `checkpoint2-business-reliability.test.ts`.
- **Status**: COMPLETED (Verified via automated tests)

---

### H-07: Correct Unknown Request Handling & Terminal State Guidance
- **Finding ID**: H-07
- **Severity**: High (P1)
- **Affected Files**:
  - `apps/web/components/waiting-room.tsx`
  - `apps/api/src/routes/requests.ts`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Root Cause**:
  - Unknown request IDs caused generic errors without stopping infinite polling loops.
  - Cancelled and expired requests were not distinguished.
  - No emergency guidance or navigation back to safety was offered.
- **Proposed Solution**:
  - In `WaitingRoom`:
    - On HTTP 404, immediately clearInterval and cancel active polling.
    - Render dedicated "Emergency Request Not Found" state.
    - Prominently display verified national emergency helplines:
      - 108 (Ambulance & Emergency Medical)
      - 104 (National Blood Bank & Health Helpline)
      - 1910 (NACO Blood Transfusion Helpline)
      - 112 (National Unified Emergency)
    - Provide single-click "Create New Emergency Request" button.
    - Distinctly handle `cancelled` vs `expired` statuses with specific badges and guidance.
- **Acceptance Criteria**:
  - 404 stops polling immediately.
  - Emergency helplines and retry actions rendered clearly.
- **Test Coverage**:
  - 404 response test in `checkpoint2-business-reliability.test.ts`.
- **Status**: COMPLETED (Verified via automated tests)

---

### Section 7: Notification Outbox Architecture
- **Finding ID**: Architecture & Reliability Requirement
- **Severity**: High (P1)
- **Affected Files**:
  - `apps/api/src/services/notification-outbox.ts` [NEW]
  - `apps/api/src/routes/requests.ts`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Implementation**:
  - Built `NotificationOutboxService` with durable `pending` status recording.
  - Decoupled push notification delivery from synchronous HTTP request flow.
  - Implemented automatic retry loop with exponential backoff (up to 3 attempts).
  - Automatic pruning of dead/unregistered FCM push tokens (`messaging/registration-token-not-registered`).
- **Status**: COMPLETED (Verified via automated tests)

---

### Section 8: Request Lifecycle State Machine & Terminal Concurrency
- **Finding ID**: Architecture & Concurrency Requirement
- **Severity**: High (P1)
- **Affected Files**:
  - `docs/REQUEST_LIFECYCLE.md` [NEW]
  - `apps/api/src/services/request-service.ts`
  - `apps/api/src/routes/requests.ts`
  - `tests/checkpoint2-business-reliability.test.ts`
- **Implementation**:
  - Published comprehensive technical specification and mermaid diagram in `docs/REQUEST_LIFECYCLE.md`.
  - Implemented `updateRequestStatus` in `request-service.ts` with strict `ALLOWED_TRANSITIONS`:
    `searching` -> `bank_found` | `donors_notified` -> `fulfilled` | `cancelled` | `expired`.
  - Guaranteed terminal state immutability: Requests in `cancelled` or `expired` states reject all further state transitions (returns HTTP 409 Conflict).
  - Enforced conditional atomic SQL updates and row-level locking (`FOR UPDATE`) in PostgreSQL transactions.
- **Status**: COMPLETED (Verified via automated tests)


