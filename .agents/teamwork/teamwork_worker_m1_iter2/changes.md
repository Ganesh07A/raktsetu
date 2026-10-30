# Changes Log — Milestone 1 Worker Iteration 2

**Agent**: teamwork_worker (`teamwork_worker_m1_iter2`)  
**Parent Conversation ID**: `9c9197d0-fd6d-4bbf-8faa-7bae79786334`  
**Date**: 2026-10-30  

---

## 1. Overview of Changes

Applied the exact fixes identified during the Milestone 1 Gate Check by Challenger 1, Challenger 2, and Reviewer 2:

1. **Floating-point precision clamping in Haversine formula and latitude bounds clamping** (`packages/shared/src/geo-utils.ts`)
2. **Resilient Zod validation schemas for coordinates, phone numbers, and string fields** (`packages/shared/src/validation.ts`)
3. **Global JSON error and 404 handlers in Hono API server** (`apps/api/src/index.ts`)
4. **Interface contract namespace alias `request` in bilingual dictionaries** (`packages/shared/src/i18n/en.ts` & `packages/shared/src/i18n/hi.ts`)
5. **Adversarial test suite synchronization** (`tests/adversarial-milestone1.test.ts`)

---

## 2. File-by-File Details

### `packages/shared/src/geo-utils.ts`
- **Haversine formula antipodal clamp**:
  In IEEE-754 double precision arithmetic, $\sin^2(\Delta \phi / 2) + \cos(\phi_1)\cos(\phi_2)\sin^2(\Delta \lambda / 2)$ on antipodal coordinates ($180^\circ$ apart) can round up to $1.0000000000000002$. Computing $\sqrt{1 - a}$ evaluates $\sqrt{-2.22 \times 10^{-16}}$, producing `NaN`.
  - Added clamp: `const clampedA = Math.min(1, Math.max(0, a));`
  - Replaced `Math.sqrt(1 - a)` with `Math.sqrt(1 - clampedA)`.
- **Bounding box polar latitude clamp**:
  In `getBoundingBox(lat, lon, radiusKm)`, wrapped `lat - latDelta` in `Math.max(-90, ...)` and `lat + latDelta` in `Math.min(90, ...)`.

### `packages/shared/src/validation.ts`
- **Coordinate & Search Query Coercion Prevention**:
  Replaced bare `z.coerce.number()` which coerced `null`, `false`, `""`, and `[]` into `0` (Null Island). Created `coordinateField` with `z.preprocess`:
  - Rejects `null`, boolean values, arrays, and empty strings.
  - Converts valid numeric strings and numbers.
  - Applied to `coordinatesSchema` (`latitude`, `longitude`) and `bloodSearchQuerySchema` (`lat`, `lng`, `radiusKm`).
- **Phone Pre-normalization**:
  Updated `phoneSchema` to preprocess inbound phone strings:
  - Trims leading/trailing whitespace.
  - Strips spaces, dashes, parentheses (`/[\s\-\(\)]/g`).
  - Strips trunk leading `0` when followed by 10 digits starting with 6-9 (`/^0[6789]\d{9}$/`).
  - Prepends `+` to raw `91XXXXXXXXXX` (matching Meta WhatsApp Cloud API webhook format).
  - Prepends `+91` to 10-digit Indian numbers (`/^[6789]\d{9}$/`).
  - Validates against `^\+91[6789]\d{9}$` and outputs standardized E.164 `+91XXXXXXXXXX`.
- **String Fields Trimming**:
  Added `.trim()` before `.min(2)` on string fields (`name`, `patientName`, `hospitalName`, `state`, `district`) so that whitespace-only strings fail length validation.

### `apps/api/src/index.ts`
- **Global Error Handler**: Added `app.onError((err, c) => c.json({ error: err.message || 'Internal Server Error', status: 500 }, 500))`.
- **Global 404 Handler**: Added `app.notFound((c) => c.json({ error: 'Not Found', status: 404 }, 404))`.
- Fixed trailing tilde typo from earlier code.

### `packages/shared/src/i18n/en.ts` & `packages/shared/src/i18n/hi.ts`
- Added `request` namespace to both English (`en.ts`) and Hindi (`hi.ts`) translation dictionaries, providing full parity with `PROJECT.md § Interface Contracts` and containing keys from `waitingRoom` and `whatsapp`:
  - `title`, `waitingRoomTitle`, `requestActive`, `donorsContacted`, `awaitingResponses`, `donorAccepted`, `acceptedDonors`, `contactDonorDirectly`, `allDeclined`, `expandRadius`, `templateHeader`, `templateBody`, `acceptButton`, `declineButton`, `callNow`, `whatsappChat`.

### `tests/adversarial-milestone1.test.ts`
- Adapted tests from observing initial defects to asserting the resilient, fixed behavior:
  - Leading `0` and spaces/dashes in mobile numbers are normalized and accepted.
  - `null`, boolean, empty string, and array coordinates are rejected (`success === false`).
  - Whitespace-only names fail `.min(2)` validation (`success === false`).

---

## 3. Verification Commands & Results

1. **Monorepo Test Suite**:
   ```powershell
   bun test
   ```
   **Result**: `415 pass, 0 fail, 1442 expect() calls` across 9 files (100% pass).

2. **E2E 4-Tier Test Suite**:
   ```powershell
   bun test tests/e2e
   ```
   **Result**: `328 pass, 0 fail, 816 expect() calls` across 4 files (100% pass).

3. **TypeScript Strict Typecheck**:
   ```powershell
   bun run check-types -- --force
   ```
   **Result**: `6 successful, 6 total` (0 errors across `@repo/db`, `@repo/shared`, `@repo/ui`, `api`, `docs`, `web`).

4. **ESLint Monorepo Pass**:
   ```powershell
   bun run lint -- --force
   ```
   **Result**: `6 successful, 6 total` (0 errors, 0 warnings).

5. **Monorepo Build**:
   ```powershell
   bun run build -- --force
   ```
   **Result**: `3 successful, 3 total` (`api`, `web`, `docs`).
