## 2026-10-30T06:32:49Z
[Message] sender=9c9197d0-fd6d-4bbf-8faa-7bae79786334 priority=MESSAGE_PRIORITY_HIGH
You are the Final Forensic Integrity Auditor (teamwork_auditor) for RaktKhoj (रक्तखोज).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_auditor_final\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\TEST_INFRA.md
4. d:\MEGA PROJECTS\raktsetu\TEST_READY.md
5. C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md
6. All worker handoffs:
   - d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1_iter2\handoff.md
   - d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m2\handoff.md
   - d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m3\handoff.md
   - d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m4\handoff.md

OBJECTIVE:
Perform a full, adversarial forensic audit of the entire codebase and test suites across all 5 milestones:
1. **Source Code & Algorithmic Authenticity (Static Analysis)**:
   - Check `packages/shared`: RBC compatibility rules, Haversine formula, Zod validation, i18n dictionaries. Verify NO hardcoded test results, NO facades, NO dummy returns.
   - Check `packages/db`: Drizzle ORM schema for all 6 tables (`users`, `donor_profiles`, `blood_requests`, `donor_notifications`, `blood_banks`, `blood_stock`), composite indexes, relations, seed data (`packages/db/src/seed-data.ts`).
   - Check `apps/api`: Hono REST API routes (`blood-banks`, `donors`, `requests`, `whatsapp-webhook`), eRaktKosh proxy service, donor matcher engine, WhatsApp Cloud API service & mock store.
   - Check `packages/ui`: 10 shadcn/ui components (`button`, `card`, `input`, `select`, `badge`, `dialog`, `toast`, `skeleton`, `stepper`, `phone-input`), utility `cn`.
   - Check `apps/web`: Next.js 16 App Router PWA, Tailwind CSS v4, manifest.ts, service worker `public/sw.js`, bilingual routing with `next-intl` (`en` and `hi`), Leaflet map view, search form, cascading results, waiting room, donor portal, deep-link response handler.
2. **Behavioral & Runtime Verification (All Commands Must Be Run Live & Uncached)**:
   - `bun run check-types -- --force` (Verify all 6 workspaces compile with 0 TypeScript errors).
   - `bun run lint -- --force` (Verify all 6 workspaces pass with 0 errors and 0 warnings).
   - `bun run build -- --force` (Verify Next.js 16 Turbopack production build succeeds for `web` and `docs`, and Bun bundles `api`).
   - `bun test` (Verify 100% of unit and integration tests pass).
   - `bun test tests/e2e` (Verify 100% of 4-tier E2E tests pass — all 328 tests).
3. **Adversarial Integrity Forensics**:
   - Verify that test cases assert against actual behavior and genuine logic, not pre-computed constants.
   - Verify that privacy masking and contact unmasking in the waiting room function authentically.
   - Verify that soft donor eligibility flags recent donations under 90/120 days without blocking emergency notifications.
4. Provide a definitive binary verdict: **CLEAN** or **INTEGRITY VIOLATION**.

REPORTING:
- Write your comprehensive audit evidence report to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_auditor_final\audit_report.md`
- Write your final handoff report to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_auditor_final\handoff.md`
- When complete, send a message to parent reporting your verdict (CLEAN / INTEGRITY VIOLATION).
