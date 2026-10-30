# Handoff Report — Backend Architecture, Database Schema & Services Survey

**Agent**: Survey Explorer 2 (`teamwork_explorer_survey_2`)  
**Parent Conversation ID**: `9c9197d0-fd6d-4bbf-8faa-7bae79786334`  
**Working Directory**: `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_2`  
**Type**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

1. **Repository Layout & Tech Stack**:
   - Monorepo configured via Turborepo (`d:\MEGA PROJECTS\raktsetu\turbo.json`) and Bun package manager (`package.json:20-23` `"devEngines": { "packageManager": { "name": "bun", "version": "1.4.2" } }`).
   - Root `package.json` workspaces defines `apps/*` and `packages/*`.
   - Existing workspaces: `apps/web`, `apps/docs`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config`.
   - Currently missing workspaces: `packages/shared`, `packages/db`, and `apps/api`.

2. **Authoritative Specifications**:
   - `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md`: Requires investigation of `packages/shared`, `packages/db`, `apps/api`, 6 core database tables, eRaktKosh proxy, donor matcher with soft eligibility, WhatsApp Business Cloud API in free test mode, and mocking strategy.
   - `C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md` lines 107–207, 329–539, 543–675, 806–1062: Defines full schemas, blood compatibility logic, Haversine formula, bilingual requirements, and WhatsApp message payloads.

3. **External Integrations**:
   - **eRaktKosh**: Official portal at `https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt` uses session-based form POST requests (`stateCode`, `districtCode`, `bloodGroup`) without a public REST API. A scraper with 15-minute caching and local fallback is mandatory.
   - **WhatsApp Business Cloud API**: Free test mode in Meta Developer Console provides 5 pre-registered test recipient numbers, test templates (`blood_donation_request`) with interactive quick-reply buttons (`accept_{requestId}`, `decline_{requestId}`), and standard webhook verification/event handling (`GET/POST /api/v1/whatsapp/webhook`).

---

## 2. Logic Chain

1. **Decoupling Domain Logic into `packages/shared`**:
   - *Observation*: Both `apps/api` and `apps/web` need blood compatibility matrix rules, distance calculations, and translation dictionaries.
   - *Reasoning*: Placing `RBC_COMPATIBILITY_MATRIX`, `haversineDistance`, `getBoundingBox`, and bilingual dictionaries in `@repo/shared` prevents code duplication, maintains synchronization between server-side matching and frontend filtering, and guarantees type consistency.

2. **Database Integrity in `packages/db`**:
   - *Observation*: The system requires tracking users, donor medical profiles, emergency requests, real-time donor notification statuses, blood banks, and live stock.
   - *Reasoning*: Implementing the 6 tables in Drizzle ORM with composite indexes (`(blood_group, is_available, whatsapp_consent)`, `(latitude, longitude)`, `(request_id, status)`) enables fast bounding box queries and sub-second emergency response times. Foreign key cascades protect orphaned notifications when requests are deleted.

3. **Resilient Architecture for External Services in `apps/api`**:
   - *Observation*: Government websites (eRaktKosh) and third-party APIs (Meta WhatsApp) can be unavailable, rate-limited, or require developer credentials that may not be present in local development.
   - *Reasoning*: Building `apps/api` with an integrated mock fallback layer (`MockStore`, simulated WhatsApp auto-reply, deterministic blood bank seeds) ensures 100% development velocity and offline testing capability, while switching transparently to production services when credentials are provided in `.env`.

---

## 3. Caveats

1. **eRaktKosh Portal Instability**: Because eRaktKosh lacks a documented public API, website HTML changes on their end could disrupt the HTML scraper. The system must always treat the local database and mock seed as equal first-class fallbacks.
2. **WhatsApp Free Test Mode Recipient Limitation**: Meta's test environment strictly restricts outbound messages to up to 5 verified phone numbers added in the Meta Developer Console. Full production broadcasts to arbitrary Indian phone numbers require Meta Business Account verification.
3. **Assumptions on Bun PostgreSQL Driver**: `packages/db` uses `postgres` (postgres.js) with `drizzle-orm/postgres-js`. If Supabase connection pooling (pgbouncer on port 6543) is used in transaction mode, prepared statements should be disabled (`prepare: false`).

---

## 4. Conclusion

The backend architecture, database schema, and service contracts for RaktKhoj have been mapped out in detail. All requirements from the approved implementation plan have been translated into exact schemas, endpoint signatures, domain algorithms, and mock designs.

Comprehensive report written to:
`d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_2\survey_report.md`

Key deliverables ready for implementation:
1. `@repo/shared`: Complete RBC compatibility matrix, Haversine geo calculations, Indian phone validation, and English/Hindi i18n dictionaries.
2. `@repo/db`: Complete Drizzle ORM schema for 6 core tables with indexes, relations, and migrations configuration.
3. `apps/api`: Full Hono.js REST API with 12 endpoints across 4 modules (`blood-banks`, `donors`, `requests`, `whatsapp`).
4. Services: Resilient eRaktKosh scraper proxy with caching, Donor Matcher with soft eligibility flags, WhatsApp Business Cloud API with interactive buttons, and zero-credential local mock development strategy.

---

## 5. Verification Method

To independently verify the findings in this report:

1. **Inspect Survey Report**:
   ```powershell
   Get-Content "d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_2\survey_report.md"
   ```
2. **Verify Monorepo Configuration**:
   ```powershell
   Get-Content "d:\MEGA PROJECTS\raktsetu\turbo.json"
   Get-Content "d:\MEGA PROJECTS\raktsetu\package.json"
   ```
3. **Verify Implementation Plan References**:
   Inspect `C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md` sections for Phase 1, Phase 3, Phase 4, and Database Schema to confirm alignment.
4. **Invalidation Conditions**:
   - If Meta removes interactive quick-reply buttons in WhatsApp Business Cloud API v21+.
   - If eRaktKosh releases a public authenticated REST API, rendering HTML scraping unnecessary.
   - If client requirements change blood group compatibility from RBC to Plasma or Platelet rules (which have inverted donor-recipient relationships).
