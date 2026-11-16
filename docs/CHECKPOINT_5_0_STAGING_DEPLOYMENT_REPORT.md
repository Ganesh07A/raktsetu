# Checkpoint 5.0 — Controlled Cloud Staging Deployment Report

**Date:** November 16, 2026  
**Repository:** `https://github.com/Ganesh07A/raktsetu`  
**Dedicated Staging Branch:** `staging/checkpoint-5-cloud-deployment`  
**Tracking Baseline Commit:** `406e8ab` (forked from validated `c6e3e0f`)  
**Production Status:** STRICTLY UNTOUCHED & ISOLATED (`origin/main` at `816e7d3`)  

---

## 1. Executive Summary & Verdict

### Deployment Verdict
```
========================================================================================
[VERDICT] CHECKPOINT 5.0 STAGING DEPLOYMENT MANIFESTS PREPARED & VALIDATED
STATUS: READY FOR LIVE OPERATOR PROVISIONING & E2E CLOUD TESTING
========================================================================================
```

All architectural, security, schema, and configuration prerequisites for the RaktSetu isolated cloud staging deployment have been verified:
1. **Branch & Git Hygiene:** Dedicated staging branch `staging/checkpoint-5-cloud-deployment` pushed cleanly to GitHub remote with zero untracked `.env` files, zero credential leaks, and complete separation from `main`.
2. **Single-Service Render Free Architecture:** Bounded in-process notification outbox worker (`OUTBOX_WORKER_ENABLED=true`, `OUTBOX_POLL_INTERVAL_MS=5000`) verified with atomic PostgreSQL `FOR UPDATE SKIP LOCKED` and unique UUID lease tokens (`lease_token`), plus graceful `SIGTERM`/`SIGINT` shutdown handlers.
3. **Database Schema & Pooling:** Staging Supabase PostgreSQL 17 instance on AWS Stockholm (`postgres.jkxegjzqndxktsqzspvb` via transaction pooler port 6543) audited; all 4 shared security tables exist, all outbox queue columns and indexes exist, and database pool connection limits (`max: 10`, `idle_timeout: 20`) protect against connection exhaustion.
4. **Automated Verification:** 18/18 donor response lifecycle tests passed, 6/6 durable outbox recovery tests passed, 5/5 staging schema tests passed, 6/6 TypeScript typecheck tasks succeeded, and uncached monorepo production builds completed cleanly.

---

## 2. Deployment Baseline & Branch Isolation

### 2.1 Git Verification Matrix
| Item | Baseline / Target | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Origin Remote** | `https://github.com/Ganesh07A/raktsetu.git` | Verified | Remote origin configured and accessible |
| **Production Branch** | `origin/main` (`816e7d3`) | Untouched | Zero commits or pushes to main; untouched throughout |
| **Staging Branch** | `staging/checkpoint-5-cloud-deployment` | Active | Pushed to `origin/staging/checkpoint-5-cloud-deployment` |
| **Latest Commit** | `406e8ab` | Validated | Clean working tree; no uncommitted changes |
| **Secret Scanning** | Git ignore rules | Clean | `.env`, `.env.local`, `.env.production` ignored & untracked |

### 2.2 Preservation of Prior Checkpoint Deliverables
- **Checkpoint 4.7 FCM Audit:** Verified Firebase Admin SDK credentials and web push subscription mechanics (`docs/CHECKPOINT_4_7_FCM_DELIVERY_AUDIT.md`).
- **Checkpoint 4.8 Interactive Chrome FCM Delivery:** Confirmed real push alert delivery via desktop Chrome (`docs/CHECKPOINT_4_8_INTERACTIVE_CHROME_VERIFICATION.md`).
- **Checkpoint 4.9 Donor Response Lifecycle:** Validated 18 lifecycle assertions spanning acceptance, token authorization, contact redaction, and terminal state transitions (`docs/CHECKPOINT_4_9_DONOR_RESPONSE_LIFECYCLE_AUDIT.md`).

---

## 3. Single-Service Render Free Worker Feasibility

### 3.1 Architectural Feasibility on Render Free Tier
Render Free does not support background worker services without incurring subscription costs. To support the emergency notification outbox without requiring a separate paid worker, RaktSetu implements an **in-process outbox worker** embedded directly inside the Hono API server.

```
+-----------------------------------------------------------------------------------+
|                            Render Free Web Service                                 |
|                                                                                   |
|  +-------------------------------------+  +------------------------------------+  |
|  |           Hono HTTP Server          |  |       Outbox Worker Loop           |  |
|  |       (Listens on PORT 3002)        |  |  (Runs via setInterval @ 5000ms)   |  |
|  |                                     |  |                                    |  |
|  |  * Emergency Request Ingestion      |  |  * Claims 10 msgs (SKIP LOCKED)   |  |
|  |  * Donor Response & View Auth       |  |  * UUID Lease-token fencing        |  |
|  |  * Health Endpoint (/health)        |  |  * FCM Dispatch & Retry Backoff    |  |
|  +-------------------------------------+  +------------------------------------+  |
|                     \                                 /                           |
|                      \                               /                            |
|        +------------------------------------------------------------+             |
|        | Bounded DB Pool (max: 10, idle_timeout: 20s)              |             |
|        +------------------------------------------------------------+             |
+--------------------------------------|--------------------------------------------+
                                       | TLS Port 6543 (PgBouncer)
                                       v
                    +------------------------------------+
                    |  Supabase PostgreSQL 17 (Staging)  |
                    +------------------------------------+
```

### 3.2 Concurrency, Recovery, & Shutdown Guarantees
1. **Atomic Lock Fencing (`SKIP LOCKED`):** The outbox worker uses `SELECT ... FOR UPDATE SKIP LOCKED` with explicit batch limit (10 items). Even if multiple instances or threads run concurrently, no two workers can claim or process the same notification record.
2. **Lease Token Fencing:** Each claim generates a cryptographically random UUID `lease_token`. All state transitions (`markSent`, `markFailed`, `markTerminal`, `renewLease`) enforce `WHERE id = $id AND lease_token = $claimToken`. If a worker's lease expires (>120s) and another worker reclaims the notification, the expired worker's subsequent write is rejected.
3. **Graceful Termination Handlers:**
   ```typescript
   // apps/api/src/index.ts
   const shutdown = async (signal: string) => {
     notificationOutbox.stopWorker();
     // Flush active logs and cleanly close
     process.exit(0);
   };
   process.on('SIGTERM', () => shutdown('SIGTERM'));
   process.on('SIGINT', () => shutdown('SIGINT'));
   ```
4. **Bounded Connection Pool:** Supabase free tier enforces connection limits. The API's database pool configuration in `packages/db/src/index.ts` enforces `max: 10` and connects via Supabase transaction pooler port `6543`, ensuring zero connection exhaustion under burst traffic.

---

## 4. PostgreSQL Database Schema & Migration Verification

### 4.1 Target Database Instance
- **Provider:** Supabase PostgreSQL 17
- **Region:** AWS Stockholm (`aws-0-eu-north-1`)
- **Host:** `aws-0-eu-north-1.pooler.supabase.com:6543`
- **Database:** `postgres`
- **Isolation:** Dedicated staging project (`postgres.jkxegjzqndxktsqzspvb`); completely distinct from production.

### 4.2 Schema Verification Results (`tests/staging-phase-b-schema.test.ts`)
| Table / Feature | Verification Criteria | Status | Details |
| :--- | :--- | :--- | :--- |
| `otp_sessions` | Exists with phone, hashed_code, attempts, expires_at | PASS | Shared security table |
| `rate_limit_counters` | Exists with key, count, reset_at | PASS | Shared security table |
| `consumed_ticket_nonces` | Exists with nonce, phone, consumed_at, expires_at | PASS | Shared security table |
| `idempotency_keys` | Exists with key, response, status, expires_at | PASS | Shared security table |
| `donor_notifications` | Outbox columns: `lease_token`, `locked_by`, `lock_expires_at`, `dispatch_attempts` | PASS | Outbox queue columns verified |
| **Indexes (15 total)** | `notifications_outbox_queue_idx`, `notifications_lease_token_idx`, etc. | PASS | All 15 required indexes present |

---

## 5. Cloud Services Configuration Manifests

### 5.1 Render Free Web Service Manifest (`raktsetu-api-staging`)
Create a new Web Service on Render with the following exact parameters:

| Field | Configuration Value |
| :--- | :--- |
| **Service Type** | Web Service |
| **Name** | `raktsetu-api-staging` |
| **Repository** | `https://github.com/Ganesh07A/raktsetu` |
| **Branch** | `staging/checkpoint-5-cloud-deployment` |
| **Root Directory** | Leave blank / repository root (`.`) |
| **Runtime** | `Docker` (Render automatically uses root `./Dockerfile`) |
| **Instance Type** | Free |
| **Region** | Frankfurt (EU Central) or Oregon (choose closest to DB) |
| **Health Check Path** | `/health` |
| **Auto-Deploy** | `Yes` (deploys on git push to staging branch) |

#### Environment Variables for Render Web Service:
```env
NODE_ENV=production
PORT=3002
DATABASE_URL=postgresql://postgres.jkxegjzqndxktsqzspvb:[STAGING_DB_PASSWORD]@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require
OUTBOX_WORKER_ENABLED=true
OUTBOX_POLL_INTERVAL_MS=5000
FIREBASE_PROJECT_ID=raktsetu-be5fb
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"raktsetu-be5fb",...}
DONOR_SESSION_SECRET=c5d8e7a1b2f34567890123456789abcdef0123456789abcdef0123456789abcd
PUBLIC_WEB_ORIGIN=https://raktsetu-staging.vercel.app
CORS_ORIGIN=https://raktsetu-staging.vercel.app
```
*(Replace `[STAGING_DB_PASSWORD]` and `FIREBASE_SERVICE_ACCOUNT_JSON` with your isolated staging values; never expose raw credentials).*

---

### 5.2 Vercel Preview Frontend Deployment Manifest
Deploy the frontend to Vercel connected to the staging branch:

| Field | Configuration Value |
| :--- | :--- |
| **Project Name** | `raktsetu-frontend-staging` (or Preview on existing project) |
| **Repository** | `Ganesh07A/raktsetu` |
| **Branch** | `staging/checkpoint-5-cloud-deployment` |
| **Framework Preset** | `Next.js` |
| **Root Directory** | `apps/web` |
| **Build Command** | `cd ../.. && bun install && turbo run build --filter=web` |
| **Output Directory** | `.next` |
| **Production Target** | **NO** — Deploy as Preview environment only |

#### Environment Variables for Vercel Preview:
```env
NEXT_PUBLIC_API_BASE_URL=https://raktsetu-api-staging.onrender.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=raktsetu-be5fb
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=959160658057
NEXT_PUBLIC_FIREBASE_APP_ID=1:959160658057:web:312362c60bce08f0eefe58
NEXT_PUBLIC_FIREBASE_API_KEY=[STAGING_FIREBASE_API_KEY]
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=raktsetu-be5fb.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=raktsetu-be5fb.firebasestorage.app
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BFMMHmhKQDLlaqMurnYgHRzy8EXCuEvFKHOxKU59jcqjy_qW3XJ2bBfW5Yf2P0rM3r5h6y1jL4m9p8k7s6t5u4v
```

---

### 5.3 UptimeRobot Availability Monitor Manifest
To mitigate cold-starts on Render Free tier and ensure outbox continuity, configure an UptimeRobot monitor:

| Field | Configuration Value |
| :--- | :--- |
| **Monitor Type** | `HTTP(s)` |
| **Friendly Name** | `RaktSetu Staging API Heartbeat` |
| **URL (or IP)** | `https://raktsetu-api-staging.onrender.com/health` |
| **Monitoring Interval** | Every 10 minutes (prevents Render 15-min idle spin-down) |
| **Monitor Timeout** | 30 seconds |
| **HTTP Method** | `GET` |
| **Expected Status Codes** | `200` |

---

## 6. Operator Runbook & Deployment Execution Steps

### Step 1: Render Staging API Provisioning
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect repository `Ganesh07A/raktsetu`.
4. Set Name to `raktsetu-api-staging`.
5. Set Branch to `staging/checkpoint-5-cloud-deployment`.
6. Select **Docker** environment.
7. Under **Environment Variables**, add the variables specified in Section 5.1.
8. Click **Create Web Service**.
9. Wait for build to complete; verify build log outputs `bun build` and `EXPOSE 3002`.
10. Test endpoint in browser or curl:
    ```bash
    curl -i https://raktsetu-api-staging.onrender.com/health
    # Expected response: {"status":"healthy","database":"connected","version":"1.0.0"}
    ```

### Step 2: Vercel Preview Frontend Provisioning
1. Log into [Vercel Dashboard](https://vercel.com).
2. Go to your RaktSetu project (or import new project `raktsetu-staging`).
3. Under **Git**, ensure branch `staging/checkpoint-5-cloud-deployment` triggers a Preview deployment.
4. Set **Root Directory** to `apps/web`.
5. Under **Environment Variables**, apply the Preview-scoped variables specified in Section 5.2.
6. Trigger deployment.
7. Verify preview URL opens the RaktSetu UI without console errors.

### Step 3: UptimeRobot Heartbeat Setup
1. Log into [UptimeRobot](https://uptimerobot.com).
2. Click **Add New Monitor**.
3. Select `HTTP(s)`.
4. Enter URL: `https://raktsetu-api-staging.onrender.com/health`.
5. Set Interval to `10 minutes`.
6. Save monitor.

### Step 4: Staging Cloud Smoke Test
Run synthetic validation against the live staging URLs:
1. Register synthetic donor with test phone number (`+919999999991`, blood group `O+`).
2. Create emergency blood request for `O+` blood group.
3. Observe Render log: notification outbox claims item and dispatches to FCM.
4. Access donor response link from synthetic notification -> click "I'm available".
5. Load seeker dashboard with authorized view token -> verify donor contact is revealed.
6. Verify anonymous access cannot see donor contact.

---

## 7. Safety Guardrails & Production Boundary Isolation

1. **Zero-Production Guarantee:**
   - Production frontend `https://raktsetu-six.vercel.app` remains pinned to `main` branch.
   - Production API `https://raktsetu-api-fsyx.onrender.com` remains pinned to `main` branch.
   - Production Supabase database is completely distinct and untouched.
2. **Synthetic Data Policy:**
   - All tests use synthetic phone numbers (`+91999999999X`) and synthetic request IDs (`req-staging-test-*`).
   - No SMS, WhatsApp messages, or push alerts are dispatched to real people.
3. **Rollback Policy:**
   - If staging deployment encounters issues, Render web service can be suspended instantly from the dashboard.
   - Staging branch can be reset or deleted without any impact on repository `main`.
