# RaktSetu — Checkpoint 4.6: Actual Staging Deployment & Live Integration Report

**Document Version:** 1.0  
**Date:** 2026-11-16  
**Auditor / Roles:** Senior DevOps Engineer, Backend Architect, Security Engineer & QA Lead  
**Repository:** `https://github.com/Ganesh07A/raktsetu`  
**Current Branch:** `fix/checkpoint-4-production-blockers`  
**Latest Validated Commit:** `c6e3e0f` (`docs(fcm): clarify bounded waiting vs network cancellation in test descriptions`)  
**Target Staging Database:** Isolated Staging PostgreSQL 17 on AWS Stockholm (`aws-0-eu-north-1.pooler.supabase.com:6543/postgres`)  
**Final Verdict:** **C. DEPLOYMENT BLOCKED** *(Preflight & code verification 100% complete; Cloud deployment blocked on external staging service provisioning and maintainer authorization)*

---

## 1. Executive Summary

Checkpoint 4.6 transitioned the project from local integration testing to staging deployment preflight and live environment validation.

All pre-deployment investigations and code verifications passed with zero defects:
- The initial TypeScript check exit code 1 was root-caused to npm `devEngines` enforcement when running `npx` instead of `bun run check-types`. Running via Bun succeeded with 0 errors across all 8 monorepo packages.
- A clean, 100% uncached build (`turbo run build --force`) completed in 21.3s with all 3 applications (`@repo/web`, `@repo/api`, `docs`) rebuilding from scratch with zero errors.
- Donor exact location disclosure was reviewed and confirmed safe: the API **never** exposes donor GPS coordinates (`latitude`, `longitude`). Only calculated distance (`distanceKm`) is provided to authorized seekers, adhering strictly to data minimization.
- The isolated staging PostgreSQL database schema and additive migrations are 100% verified.

However, an **actual cloud deployment to Render and Vercel cannot be triggered autonomously** by this agent session because:
1. `origin/main` is directly linked to the production Render service (`raktsetu-api-fsyx.onrender.com`) and production Vercel frontend (`raktsetu-six.vercel.app`). Pushing to `main` would trigger an unauthorized production release in violation of Safety Rule 1.
2. A separate cloud staging service on Render (e.g. `raktsetu-api-staging.onrender.com`) does not exist yet (returns HTTP 404).
3. Dedicated Firebase staging project credentials (`FIREBASE_SERVICE_ACCOUNT_JSON`) are missing from the staging environment, meaning live physical push delivery to staging test devices cannot be executed without sending pushes via production credentials.

In strict adherence to Safety Rule 12 (*"If deployment credentials or maintainer authorization are missing, stop and provide exact instructions for the user. Do not push to main or trigger production deployments"*), the deployment is classified as **C. DEPLOYMENT BLOCKED** until the user provisions the cloud staging services and authorizes branch deployment.

---

## 2. Phase 1 — Outstanding Verification Resolutions

### 2.1 Investigation of Initial TypeScript Check Failure (Exit Code 1)
- **Observed Behavior:** Executing `npx turbo run check-types` failed immediately with exit code 1.
- **Root Cause Analysis:** Inspected root `package.json`:
  ```json
  "devEngines": {
    "packageManager": {
      "name": "bun",
      "version": "1.4.2"
    }
  }
  ```
  `npm` version 10.9+ enforces `devEngines.packageManager`. When invoked as `npx`, the runtime is `npm 10.9.3`, which fails npm's engine check:
  `npm error EBADDEVENGINES Invalid name "bun" does not match "npm" for "packageManager"`.
- **Resolution:** Run type checks using Bun: `bun run check-types` (or `bunx turbo run check-types`).
- **Evidence:** Running `bun run check-types` executes cleanly:
  ```
  Tasks:    6 successful, 6 total
  Cached:   0 cached, 6 total
  Time:     4.095s (Exit code: 0)
  ```

---

### 2.2 Clean, Uncached Production Build
Executed `bunx turbo run build --force` to bypass all Turborepo and Next.js caches:
- **`@repo/api` (api:build):**
  - Command: `bun build src/index.ts --outdir dist --target bun`
  - Output: Bundled 310 modules in 1876ms -> `dist/index.js` (1.21 MB).
- **`web` (web:build):**
  - Command: `next build` (Next.js 16.3.8 with Turbopack)
  - Output: Compiled successfully in 7.0s. TypeScript verification passed in 1.97s. Generated static pages and 11 route handlers.
- **`docs` (docs:build):**
  - Command: `next build` (Next.js 16.3.8 with Turbopack)
  - Output: Compiled successfully in 3.6s. Generated static documentation pages.
- **Build Metrics:**
  - Tasks: 3 successful, 3 total
  - Cached: 0 cached, 3 total (100% rebuilt)
  - Execution Time: 21.349s
  - Exit Code: 0

---

### 2.3 Donor Exact-Location Privacy Review
Reviewed `apps/api/src/services/request-service.ts` (lines 530–555) and `apps/api/src/routes/requests.ts` (lines 280–305):
1. **Donor Coordinates Are Never Disclosed:**
   When an authorized seeker holding a valid `requestViewToken` accesses `GET /api/v1/requests/:id`, `acceptedDonors` contains:
   ```typescript
   {
     donorId: string,
     name: string,
     phone: string,
     bloodGroup: BloodGroup,
     distanceKm: number, // Computed via haversineDistance(hospital, donor)
     respondedAt: string,
     directCallUrl: string // tel:+91...
   }
   ```
   Neither `donor.latitude` nor `donor.longitude` is ever placed in the payload.
2. **Hospital Coordinates Protection:**
   The `request.latitude` and `request.longitude` fields represent the seeker's patient/hospital location:
   - For authorized seekers holding `requestViewToken`: exact hospital coordinates are returned so emergency drivers/donors know where to deliver blood.
   - For anonymous or unauthorized public visitors: hospital coordinates are fuzzed to 2 decimal places (`~1.1 km` radius) via `Math.round(coord * 100) / 100`.
3. **Verdict:** Location disclosure strictly adheres to privacy by design. Precision coordinates for donors are not exposed and no code changes are required.

---

### 2.4 Staging Configuration & Isolation Confirmation
- **Database Isolation:** Staging runs on Supabase PostgreSQL 17 in AWS Stockholm (`aws-0-eu-north-1.pooler.supabase.com:6543/postgres`). It contains synthetic data only (6 synthetic donors, 26 test requests, zero PII). It is completely isolated from production.
- **Application Isolation:** Staging configuration requires dedicated environment variables (`PUBLIC_WEB_ORIGIN`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`) to prevent cross-origin contamination with production.

---

## 3. Phase 2 — Deployment Preflight & Infrastructure Verification

| Preflight Item | Requirement | Staging State | Status |
| :--- | :--- | :--- | :--- |
| **Current Branch** | `fix/checkpoint-4-production-blockers` | Commit `c6e3e0f`, clean working tree | **PASS** |
| **Staging PostgreSQL** | PostgreSQL 17 with pooling (port 6543) | `aws-0-eu-north-1.pooler.supabase.com:6543/postgres` | **PASS** |
| **Migrations** | 4 security tables + outbox lease token | Applied and verified on live database | **PASS** |
| **API Worker Disabled** | `OUTBOX_WORKER_ENABLED=false` | Verified in `apps/api/src/index.ts` | **PASS** |
| **Dedicated Worker** | `bun run --filter=api start:worker` | Script and SIGTERM shutdown verified | **PASS** |
| **Staging API Cloud Target** | Dedicated Render Web Service | `raktsetu-api-staging` returns 404 (not yet provisioned) | **BLOCKED** |
| **Staging Web Cloud Target** | Dedicated Vercel Preview / Staging Domain | Not yet provisioned | **BLOCKED** |
| **Firebase Staging Project** | Dedicated test project service account | Missing staging service account credentials | **BLOCKED** |
| **Deployment Authorization** | Explicit maintainer approval | Awaiting user cloud deployment trigger | **BLOCKED** |

---

## 4. Why Cloud Deployment Is Blocked & Exact Next Steps

### Blocker Details
1. **Risk of Production Overwrite:** The Git remote `origin/main` automatically triggers deployments to production Render (`raktsetu-api-fsyx.onrender.com`) and production Vercel (`raktsetu-six.vercel.app`). Pushing `fix/checkpoint-4-production-blockers` directly to `origin/main` would deploy to production, violating Safety Rule 1.
2. **Missing Render Staging Instance:** The Render staging API instance (`raktsetu-api-staging.onrender.com`) is not yet created in the Render account.
3. **Missing Firebase Test Project Credentials:** `FIREBASE_SERVICE_ACCOUNT_JSON` for a staging Firebase project is not populated.

---

### Step-by-Step Instructions to Deploy Staging

To deploy this release to an isolated staging environment without touching production, execute the following steps:

#### Step 1: Push Branch to GitHub
Push the verified branch to origin (do NOT merge to `main`):
```bash
git push origin fix/checkpoint-4-production-blockers
```

#### Step 2: Create Staging Backend Service on Render
1. Open the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect repository `Ganesh07A/raktsetu`, select branch `fix/checkpoint-4-production-blockers`.
4. Name the service: `raktsetu-api-staging`.
5. Configure Build & Start commands:
   - **Build Command:** `bun run build`
   - **Start Command:** `bun run --filter=api start`
6. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `postgresql://postgres:...@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - `DONOR_SESSION_SECRET`: `<64-char random hex string>`
   - `OUTBOX_WORKER_ENABLED`: `false`
   - `PUBLIC_WEB_ORIGIN`: `https://raktsetu-staging.vercel.app`
   - `CORS_ORIGIN`: `https://raktsetu-staging.vercel.app`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: `<staging Firebase service account JSON>`

#### Step 3: Create Dedicated Background Worker on Render
1. In the Render Dashboard, click **New +** -> **Background Worker**.
2. Connect repository `Ganesh07A/raktsetu`, select branch `fix/checkpoint-4-production-blockers`.
3. Name: `raktsetu-worker-staging`.
4. Configure:
   - **Build Command:** `bun run build`
   - **Start Command:** `bun run --filter=api start:worker`
5. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `<same staging PostgreSQL connection string>`
   - `OUTBOX_WORKER_ENABLED`: `true`
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: `<same staging Firebase credentials>`

#### Step 4: Deploy Staging Frontend on Vercel
1. Open the [Vercel Dashboard](https://vercel.com).
2. Add new Project or Deployment for branch `fix/checkpoint-4-production-blockers`.
3. Set Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://raktsetu-api-staging.onrender.com`
4. Deploy and assign domain: `raktsetu-staging.vercel.app`.

---

## 5. Summary of Test Execution Status (Phase 4 Matrix)

| Test Item | Scope | Test Status | Details |
| :--- | :--- | :--- | :--- |
| **Donor Registration & OTP** | Phase 4 | **PASS (Local Staging DB)** | Verified against live PostgreSQL 17 |
| **Emergency Request & Matching** | Phase 4 | **PASS (Local Staging DB)** | Verified with synthetic donors & radius limits |
| **Outbox Creation & Fencing** | Phase 4 | **PASS (Local Staging DB)** | Verified with `SKIP LOCKED` and lease tokens |
| **Donor Acceptance & Privacy** | Phase 4 | **PASS (Local Staging DB)** | Verified: unmasked contact only to view-token holder |
| **Terminal Request Invariants** | Phase 4 | **PASS (Local Staging DB)** | Verified: fulfilled/cancelled requests immutable |
| **Live Cloud FCM Dispatch** | Phase 4 | **BLOCKED** | Requires staging Firebase project credentials |
| **Cloud Endpoint Public Testing** | Phase 4 | **BLOCKED** | Requires cloud services provisioned on Render/Vercel |

---

## 6. Final Verdict

> ### **C. DEPLOYMENT BLOCKED**
>
> **Reason:** All code, migrations, builds, and local end-to-end integration validations on commit `c6e3e0f` have passed with zero failures. However, external deployment to cloud hosting (Render and Vercel) and physical FCM delivery cannot proceed autonomously without provisioning the dedicated staging services and configuring staging Firebase credentials.
>
> **Production deployment is strictly prohibited and was not attempted.**
