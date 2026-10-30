## 2026-10-30T05:03:28Z
You are the E2E Test Writer (teamwork_test_writer) for the Dual Track E2E Testing initiative on RaktKhoj.
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_test_writer_e2e\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\TEST_INFRA.md
4. C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All test implementations must be genuine, opaque-box, and derived from user requirements. DO NOT hardcode trivial pass criteria. A teamwork_auditor will independently inspect your test suite for authenticity.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write ownership of:
- `tests/**` (especially `tests/e2e/**`)
- `TEST_READY.md` (at project root `d:\MEGA PROJECTS\raktsetu\TEST_READY.md`)

OBJECTIVE & DELIVERABLES:
Build the complete, opaque-box E2E test suite for RaktKhoj adhering to the 4-tier methodology in `TEST_INFRA.md`:
1. **Test Infrastructure**:
   - Create test harness in `tests/e2e/harness.ts` with mock API server runner or client callers, geo fixtures, donor fixtures, blood bank stock fixtures.
2. **Tier 1 — Feature Coverage (>=5 test cases per feature)**:
   - Happy path tests verifying each feature in isolation (blood compatibility, geo utils, radius filtering, state/district lookup, donor registration payload validation, request creation, WhatsApp notification format, etc.).
3. **Tier 2 — Boundary & Corner Cases (>=5 test cases per feature)**:
   - Limits, empty inputs, extreme coordinates, 0 stock vs 1 unit stock, exact 5km / 10km / 50km boundary points, 89 vs 90 days last donation eligibility boundary, invalid Indian phone numbers, malformed WhatsApp webhooks.
4. **Tier 3 — Cross-Feature Combinations (>=30 pairwise tests)**:
   - Blood compatibility + geo radius queries.
   - eRaktKosh empty stock + donor matching cascade.
   - WhatsApp quick-reply accept payload + real-time request status transition.
   - Bilingual dictionary translation coverage across all emergency search and donor response keys.
5. **Tier 4 — Real-World Application Scenarios (>=6 realistic scenarios)**:
   - Scenario 1: Immediate blood bank hit for emergency surgery in Delhi.
   - Scenario 2: Rare negative blood group (AB-) cascading from empty bank stock to compatible volunteer donors within 10km.
   - Scenario 3: Donor accepts via WhatsApp quick reply, unlocking direct call / WhatsApp link for patient family in the waiting room.
   - Scenario 4: Offline connectivity handling with emergency helpline directory fallback.
   - Scenario 5: End-to-end seeker and donor journey in Hindi (`hi`).
   - Scenario 6: Soft donor eligibility warning display for donors with donations in <90 days.
6. **Publish `TEST_READY.md`**:
   - Write `d:\MEGA PROJECTS\raktsetu\TEST_READY.md` following the format specified in `PROJECT.md` and `TEST_INFRA.md`, summarizing test counts, commands to execute (`bun test tests/e2e`), and feature coverage checklist.

REPORTING:
- Write your comprehensive test suite documentation to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_test_writer_e2e\test_report.md`
- Write your final handoff report to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_test_writer_e2e\handoff.md`
- When finished, send a message to parent reporting test suite readiness.
