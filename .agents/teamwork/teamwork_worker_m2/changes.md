# Milestone 2: Backend Services & API Layer — Changes Log

**Worker**: Milestone 2 Worker (`teamwork_worker_m2`)  
**Timestamp**: 2026-10-30T06:06:00Z  
**Scope**: `apps/api/**`, `packages/db/**`

---

## 1. Summary of Changes

Milestone 2 implements the complete backend services and REST API layer for RaktKhoj (रक्तखोज), providing real-time blood bank inventory search, eRaktKosh proxy with 15-minute in-memory caching and offline database fallback, intelligent donor matching enforcing red blood cell compatibility with soft eligibility badges, WhatsApp Business Cloud API notification dispatch with zero-credential mock simulation, inbound Meta webhook handling with HMAC signature validation, blood requests lifecycle management with real-time waiting room contact unlocks, donor registration, realistic Indian seed data, and a suite of unit and integration tests.

---

## 2. Detailed File Modifications & New Additions

### `packages/db/`
- **`packages/db/src/seed-data.ts` (NEW)**:
  - Realistic healthcare fixtures: 8 Indian blood banks (AIIMS New Delhi, Safdarjung Hospital, Max Super Speciality Saket, Fortis Hospital Vasant Kunj, Indian Red Cross Society HQ, King George's Medical University Lucknow, Rotary Blood Bank Noida, LifeLine Blood Bank Saket).
  - 12 realistic volunteer donors across Delhi NCR and Lucknow across diverse blood groups (A+, O-, AB-, B+, O+, B-), genders, donation intervals, and availability flags.
  - Complete master list of Indian states (`DL`, `UP`, `MH`, `KA`, `TN`, `WB`, `GJ`, `RJ`) and their districts.
- **`packages/db/src/seed.ts` (NEW)**:
  - Automated seeding runner inserting `users`, `donor_profiles`, `blood_banks`, and `blood_stock` into PostgreSQL when `DATABASE_URL` is set, or graceful offline logging when running locally.
- **`packages/db/src/index.ts` (MODIFIED)**:
  - Exported seed data and Drizzle ORM query operators (`eq`, `and`, `or`, `desc`, `asc`, `sql`).
- **`packages/db/package.json` (MODIFIED)**:
  - Exported `./seed-data` submodule and added `seed` script.

### `apps/api/`
- **`apps/api/src/services/eraktkosh-proxy.ts` (NEW)**:
  - External proxy scraper for official eRaktKosh portal (`eraktkosh.mohfw.gov.in`) with 3.5s timeout.
  - In-memory 15-minute TTL caching (`Map<string, CacheEntry>`).
  - Resilient fallback to local database and seed fixtures when offline or external requests fail.
  - State and district master endpoints: `getStateList()`, `getDistrictList(stateCode)`.
- **`apps/api/src/services/donor-matcher.ts` (NEW)**:
  - ABO/Rh Red Blood Cell compatibility matching utilizing `@repo/shared` matrix (`getCompatibleDonorGroups`).
  - Great-circle distance calculations via `haversineDistance` sorted ascending.
  - Availability and WhatsApp consent filtering (`isAvailable = true`, `whatsappConsent = true`).
  - Soft eligibility calculation: calculates elapsed days against 90-day (male) and 120-day (female) norms, generating warning badges and remaining cooldown days without excluding candidate donors.
  - Seamless dual-mode execution: queries live PostgreSQL tables via Drizzle when `DATABASE_URL` is configured, or in-memory `mockStore` in local development.
- **`apps/api/src/services/mock-store.ts` (NEW)**:
  - In-memory data store providing zero-credential local development and test reproducibility.
  - Manages blood banks, donors, requests, notifications, and outbound WhatsApp messages.
  - Supports simulated donor replies via `simulateDonorReply(requestId, donorId, action)`.
  - Implements contact unlocking for accepted donors (`getAcceptedDonors`).
- **`apps/api/src/services/whatsapp.ts` (NEW)**:
  - `sendDonationRequest`: Sends template message (`blood_donation_request`) with body parameters and interactive quick reply buttons (`accept_{requestId}_{donorId}`, `decline_{requestId}_{donorId}`).
  - Automatically records outbound notifications in `mockStore`.
  - Supports live Meta Cloud API dispatch when `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are configured.
- **`apps/api/src/routes/blood-banks.ts` (MODIFIED/IMPLEMENTED)**:
  - `GET /api/v1/blood-banks/search`: Validates `lat`, `lng`, `radiusKm` (defaults to 10), optional `bloodGroup` (handles URL-decoded spaces), `state`, `district`. Sorts by distance ascending. Returns `{ banks, totalCount, source: "combined" }`.
  - `GET /api/v1/blood-banks/states`: Returns list of Indian states.
  - `GET /api/v1/blood-banks/districts/:stateCode`: Returns districts for given state code (returns 404 for invalid state).
  - `GET /api/v1/blood-banks/:id`: Returns single blood bank details.
- **`apps/api/src/routes/donors.ts` (MODIFIED/IMPLEMENTED)**:
  - `POST /api/v1/donors/register`: Validates Indian phone number (+91 normalization), blood group, and mandatory `whatsappConsent === true`. Checks for duplicate registration (409 Conflict). Inserts donor profile and returns HTTP 201 with `{ donor, token }`.
  - `GET /api/v1/donors/compatible`: Returns candidate donors matching query coordinates and blood group.
  - `POST /api/v1/donors/match`: Endpoint for matching compatible donors.
  - `GET /api/v1/donors/profile/:id`: Returns donor profile.
  - `PATCH /api/v1/donors/profile/:id/availability`: Toggles `isAvailable` boolean.
- **`apps/api/src/routes/requests.ts` (MODIFIED/IMPLEMENTED)**:
  - `POST /api/v1/requests`: Validates blood request payload. Checks institutional blood bank stock. If bank has stock, marks `status = 'bank_found'`, `fulfillmentSource = 'blood_bank'`. If no bank has stock, automatically cascades to compatible donors via `donorMatcher`, creates `donor_notifications`, and dispatches WhatsApp messages. Returns HTTP 201 with `{ request, compatibleDonorsCount, notificationsSent }`.
  - `GET /api/v1/requests/:id`: Waiting room status endpoint. Returns masked phone numbers (`+91 98****3210`) while pending. When a donor accepts, unlocks full contact details (`phone`, `tel:`, and direct `https://wa.me/` chat link).
  - `POST /api/v1/requests/:id/respond`: Deep-link donor direct response endpoint (`/donor/respond/[requestId]`). Transitions request to `fulfilled` if accepted.
  - `PATCH /api/v1/requests/:id/status`: Updates lifecycle status.
- **`apps/api/src/routes/whatsapp-webhook.ts` (NEW)**:
  - `GET /api/v1/whatsapp/webhook` & `GET /api/v1/whatsapp/`: Meta Webhook challenge verification (`hub.mode === 'subscribe'`).
  - `POST /api/v1/whatsapp/webhook` & `POST /api/v1/whatsapp/`: Inbound Meta payload parser, HMAC-SHA256 signature verification (`X-Hub-Signature-256`), interactive quick-reply button click handling (`accept` / `decline`), notification status updates, and request fulfillment.
  - `POST /api/v1/whatsapp/mock-reply`: Dev simulator endpoint for triggering donor replies in local development and automated testing.
- **`apps/api/src/routes/whatsapp.ts` (MODIFIED)**:
  - Re-exports `whatsappWebhookRoutes`.
- **`apps/api/src/index.ts` (MODIFIED)**:
  - Mounted routes (`/api/v1/blood-banks`, `/api/v1/donors`, `/api/v1/requests`, `/api/v1/whatsapp`).

### Automated Test Suites Added in `apps/api/`
- **`apps/api/src/index.test.ts`**: Integration test suite verifying all HTTP endpoints.
- **`apps/api/src/services/eraktkosh-proxy.test.ts`**: Tests caching, state/district listings, and distance sorting.
- **`apps/api/src/services/donor-matcher.test.ts`**: Tests ABO/Rh matching, soft eligibility calculations (90/120 days), availability and consent filtering.
- **`apps/api/src/services/whatsapp.test.ts`**: Tests message templating, quick-reply buttons, mock store recording, and simulated replies.
- **`apps/api/src/routes/blood-banks.test.ts`**: Tests search, validation, distance sorting, state/district filtering.
- **`apps/api/src/routes/donors.test.ts`**: Tests registration validation, phone normalization, duplicate conflict handling, compatibility queries.
- **`apps/api/src/routes/requests.test.ts`**: Tests request creation, institutional hit, donor cascade, masked and unlocked contact details in waiting room.
- **`apps/api/src/routes/whatsapp-webhook.test.ts`**: Tests hub challenge verification, signature validation, button replies, mock reply simulation.

---

## 3. Verification Commands & Results

| Command | Result | Details |
|---|---|---|
| `bun test apps/api` | **PASS** | 65 tests passed across 8 test suites (0 failures) |
| `bun test tests/e2e` | **PASS** | 328 tests passed across 4 tiers (0 failures) |
| `bun test` | **PASS** | 496 tests passed across 17 test suites (0 failures) |
| `bun run --cwd apps/api check-types` | **PASS** | Clean compilation, 0 TypeScript errors |
| `bun run --cwd packages/db check-types` | **PASS** | Clean compilation, 0 TypeScript errors |
| `bun run --cwd apps/api lint` | **PASS** | 0 ESLint errors, 0 warnings |
| `bun run --cwd packages/db lint` | **PASS** | 0 ESLint errors, 0 warnings |
| `bun run --cwd apps/api build` | **PASS** | Bundled `index.js` (0.46 MB) in 26ms |
