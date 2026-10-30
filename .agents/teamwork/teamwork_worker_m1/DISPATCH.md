## 2026-10-30T05:03:14Z

You are Milestone 1 Worker (teamwork_worker).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_1\survey_report.md
4. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_explorer_survey_2\survey_report.md
5. C:\Users\workg\.gemini\antigravity\brain\47a1dc18-104f-45a1-afcc-e69799eb0a31\raktkhoj-implementation-plan.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write ownership of:
- `packages/eslint-config/base.js` and `packages/eslint-config/package.json` (to fix ESLint `@babel/preset-typescript` resolution)
- `packages/shared/**`
- `packages/db/**`
- `apps/api/**`
- Root `package.json`, `turbo.json`, `bun.lock` (for workspace linking and scripts)

OBJECTIVE & DELIVERABLES:
Implement Milestone 1 (Foundation & Core Domain):
1. **ESLint Resolution Fix**:
   - In `packages/eslint-config`, fix the `@babel/preset-typescript` resolution issue so that `bun run lint` succeeds across packages without "Cannot find package '@babel/preset-typescript'" errors.
2. **`packages/shared`**:
   - Create package with `package.json`, `tsconfig.json`, `src/index.ts`.
   - `src/blood-compatibility.ts`: Implement `RBC_COMPATIBILITY`, `getCompatibleDonorGroups(recipientGroup)`, `isDonorCompatible(donorGroup, recipientGroup)`.
   - `src/geo-utils.ts`: Implement `haversineDistance(lat1, lon1, lat2, lon2)` (in km), `getBoundingBox(lat, lon, radiusKm)`, `isWithinRadius(lat1, lon1, lat2, lon2, radiusKm)`.
   - `src/types.ts`: Comprehensive TypeScript interfaces/types for BloodGroup ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'), ComponentType ('whole_blood', 'prbc', 'ffp', 'platelets'), EmergencyType, User, DonorProfile, BloodRequest, DonorNotification, BloodBank, BloodStock.
   - `src/constants.ts`: RADIUS_PRESETS = [5, 10, 50], ELIGIBILITY_MALE_DAYS = 90, ELIGIBILITY_FEMALE_DAYS = 120, DEFAULT_SEARCH_RADIUS_KM = 10.
   - `src/i18n/`: `en.ts` and `hi.ts` translation dictionaries with all keys specified in survey report & plan.
   - Unit tests for blood-compatibility and geo-utils (`src/blood-compatibility.test.ts`, `src/geo-utils.test.ts`).
3. **`packages/db`**:
   - Create package with `package.json`, `tsconfig.json`, `drizzle.config.ts`.
   - Implement Drizzle ORM schema for the 6 core tables in `src/schema/`:
     * `users.ts`
     * `donor-profiles.ts`
     * `blood-requests.ts`
     * `donor-notifications.ts`
     * `blood-banks.ts`
     * `blood-stock.ts`
     * `index.ts` (re-exporting all tables and relations)
   - Include composite indexes for spatial and matching queries: `(blood_group, is_available, whatsapp_consent)`, `(latitude, longitude)`, `(request_id, status)`.
   - `src/index.ts`: Initialize drizzle client using `postgres` (postgres-js), exporting `db` and schema types. Handle missing DATABASE_URL gracefully with mock client or warning when offline.
4. **`apps/api` Skeleton**:
   - Create package with `package.json`, `tsconfig.json`.
   - Dependencies: `hono`, `@hono/zod-validator`, `zod`, `@repo/db`, `@repo/shared`.
   - `src/index.ts`: Hono application running on Bun with CORS, logger, `/health` endpoint returning `{ status: "ok", timestamp: ... }`.
   - Mount router stubs for `/api/v1/blood-banks`, `/api/v1/donors`, `/api/v1/requests`, `/api/v1/whatsapp`.
5. **Monorepo Linking & Verification**:
   - Run `bun install` to link the new workspaces and update `bun.lock`.
   - Run `bun run check-types` across all workspaces.
   - Run `bun test` in `packages/shared`.
   - Ensure the API server can start or build cleanly (`bun run build` or typecheck in `apps/api`).

REPORTING:
- Write your comprehensive work log to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1\changes.md`
- Write your final handoff report to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1\handoff.md`
- When complete, send a message to parent with build/test verification results.
