## 2026-10-30T05:47:11Z
You are Milestone 2 Worker (teamwork_worker).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m2\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_2\survey_report.md
4. C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write ownership of:
- `apps/api/**`
- `packages/db/**` (e.g. seed data, migrations, helper queries)

OBJECTIVE & DELIVERABLES:
Implement Milestone 2 (Backend Services & API Layer):
1. **eRaktKosh Proxy & Cache Service (`apps/api/src/services/eraktkosh-proxy.ts`)**:
   - Query government portal or scrape with 15-minute in-memory cache.
   - Fall back to local DB/seed data gracefully if external request fails or offline.
   - Expose state and district lists: `getStateList()`, `getDistrictList(stateCode)`.
2. **Blood Banks Search API (`apps/api/src/routes/blood-banks.ts`)**:
   - `GET /api/v1/blood-banks/search`: Accept `lat`, `lng`, `bloodGroup`, `radiusKm` (defaults to 10), optional `state`, `district`.
   - Query blood banks within radius, fetch available stock for `bloodGroup`, sort by distance ascending.
   - Return `{ banks: BloodBankCardData[], totalCount: number, source: "database" | "eraktkosh" | "combined" }`.
   - `GET /api/v1/blood-banks/states`: Return list of Indian states.
   - `GET /api/v1/blood-banks/districts/:stateCode`: Return list of districts for state.
3. **Donor Matching Engine (`apps/api/src/services/donor-matcher.ts`)**:
   - Find compatible donors within `radiusKm` using `@repo/shared` compatibility (`isDonorCompatible`, `getCompatibleDonorGroups`) and `haversineDistance`.
   - Filter `isAvailable = true` and `whatsappConsent = true`.
   - Implement soft eligibility enforcement: calculate days since `lastDonationDate` against male (90d) / female (120d) limits; flag with `isEligible: boolean` and `cooldownRemainingDays`, but DO NOT exclude the donor.
   - Sort by distance ascending.
4. **WhatsApp Business Cloud API Service (`apps/api/src/services/whatsapp.ts`)**:
   - Implement `sendDonationRequest`: Send template message `blood_donation_request` with body parameters and quick reply buttons (`accept_{requestId}`, `decline_{requestId}`).
   - Local Mocking Layer (`apps/api/src/services/mock-store.ts`): If `WHATSAPP_ACCESS_TOKEN` is unset or mock mode enabled, log outbound payload, record notification in mock store, and support simulated donor response for local development/testing.
5. **WhatsApp Webhook Router (`apps/api/src/routes/whatsapp-webhook.ts`)**:
   - `GET /`: Hub challenge verification (`hub.mode === 'subscribe'`, `hub.verify_token === WHATSAPP_VERIFY_TOKEN`).
   - `POST /`: Parse Meta webhook payloads, handle delivery receipts (`sent`, `delivered`, `read`), and handle button clicks (`accept_{requestId}` or `decline_{requestId}`), updating `donor_notifications` and transitioning `blood_requests` status.
6. **Blood Requests Lifecycle API (`apps/api/src/routes/requests.ts`)**:
   - `POST /api/v1/requests`: Validate request payload (bloodGroupNeeded, unitsNeeded, patientName, hospitalName, latitude, longitude, searchRadiusKm).
   - If banks not found or stock empty, automatically trigger donor matcher cascade, create `donor_notifications`, and dispatch WhatsApp alerts.
   - `GET /api/v1/requests/:id`: Return request details, counts (sent, delivered, accepted, declined), and if accepted, display donor name and unmasked contact (`phone`, `tel:`, `https://wa.me/`).
   - `POST /api/v1/requests/:id/respond`: Direct response endpoint from deep link `/donor/respond/[requestId]`.
7. **Donor Registration API (`apps/api/src/routes/donors.ts`)**:
   - `POST /api/v1/donors/register`: Validate using `donorRegistrationSchema` from `@repo/shared`, insert user and donor profile in DB/mock store, return registered donor.
8. **Database Seed Data (`packages/db/src/seed.ts` or `packages/db/src/seed-data.ts`)**:
   - Provide realistic Indian seed data: AIIMS Delhi, Safdarjung Hospital, Max Super Speciality, Fortis Hospital, King George's Medical University Lucknow, plus 10 realistic volunteer donors across blood groups in Delhi NCR and Lucknow.
9. **Automated Verification**:
   - Add comprehensive unit/integration tests in `apps/api/src/` testing all endpoints, matching, eRaktKosh proxy, mock WhatsApp, and request lifecycle.
   - Run `bun test`, `bun test tests/e2e`, `bun run check-types`, `bun run lint`, and `bun run build`.

REPORTING:
- Write your changes log to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m2\changes.md`
- Write your final handoff to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m2\handoff.md`
- When complete, send a message to parent reporting test verification results.
