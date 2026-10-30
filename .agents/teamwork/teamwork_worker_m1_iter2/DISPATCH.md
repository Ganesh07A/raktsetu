## 2026-10-30T05:33:28Z
You are Milestone 1 Worker Iteration 2 (teamwork_worker).
Your working directory is: d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1_iter2\

MANDATORY FIRST STEP:
Read the following authoritative documents:
1. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\ORIGINAL_REQUEST.md
2. d:\MEGA PROJECTS\raktsetu\PROJECT.md
3. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\orchestrator\GATE_STATUS.md
4. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_challenger_m1_1\handoff.md
5. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_challenger_m1_2\handoff.md
6. d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_reviewer_m1_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write ownership of:
- `packages/shared/**`
- `packages/db/**`
- `apps/api/**`

OBJECTIVE:
Apply the exact fixes identified during the Milestone 1 Gate Check by Challenger 1, Challenger 2, and Reviewer 2:

1. **Fix Haversine Floating-Point Precision on Antipodal Points (`packages/shared/src/geo-utils.ts`)**:
   - In `haversineDistance`, clamp `a` to $[0, 1]$ before computing `atan2`:
     ```ts
     const clampedA = Math.min(1, Math.max(0, a));
     const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
     ```
   - In `getBoundingBox`, clamp latitude bounds to $[-90, 90]$.

2. **Fix Zod Validation Resilience (`packages/shared/src/validation.ts`)**:
   - In `coordinatesSchema` and `bloodSearchQuerySchema`:
     Prevent `null`, empty string `""`, `false`, and arrays `[]` from silently coercing into `(0, 0)`. Use a pre-validation refinement or parse check ensuring the input is a valid non-empty numeric representation before coercing.
   - In `phoneSchema`:
     Pre-normalize string input (trim, remove spaces, dashes, parentheses, and leading `0`) before regex matching, and support both `+91` and raw `91` prefixes (matching WhatsApp Cloud API inbound webhook format `91XXXXXXXXXX`). Ensure final output is normalized to `+91XXXXXXXXXX`.
   - In string fields (`name`, etc.): add `.trim()` so whitespace-only strings fail `.min(2)`.

3. **Add JSON Error and 404 Handlers to Hono API (`apps/api/src/index.ts`)**:
   - Add `app.onError((err, c) => { console.error(err); return c.json({ error: err.message || 'Internal Server Error', status: 500 }, 500); })`
   - Add `app.notFound((c) => c.json({ error: 'Not Found', status: 404 }, 404))`

4. **Add Interface Contract Namespace Alias (`packages/shared/src/i18n/`)**:
   - In `en.ts` and `hi.ts`, ensure `request` namespace exists and contains keys from `waitingRoom` / `whatsapp` as specified in `PROJECT.md § Interface Contracts`.

5. **Verify All Suites**:
   - Run `bun test` across monorepo (must pass all unit tests and adversarial test suites).
   - Run `bun test tests/e2e` (must pass all 328 tests in 4 tiers).
   - Run `bun run check-types` (must pass 6/6 workspaces).
   - Run `bun run lint` (must pass 6/6 workspaces).
   - Run `bun run build` (must pass 3/3 targets).

REPORTING:
- Write your changes log to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1_iter2\changes.md`
- Write your final handoff to:
  `d:\MEGA PROJECTS\raktsetu\.agents\teamwork\teamwork_worker_m1_iter2\handoff.md`
- When complete, send a message to parent reporting test pass results.
