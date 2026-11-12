# RaktSetu / RaktKhoj — Staging & Production Rollback Plan
**Document Version:** 1.0  
**Target Environments:** Render API, Vercel Web, PostgreSQL Database

---

## 1. Rollback Triggers & Criteria

Initiate this rollback procedure immediately if any of the following critical conditions are observed during staging verification or production rollout:
1. **Critical Service Disruption:** Sustained HTTP 500 error rate exceeding 1% across API endpoints.
2. **Database Contention:** Database connection pool exhaustion or high lock contention on security tables.
3. **Core Workflow Regression:** Inability for requesters to submit emergency requests or donors to submit responses.
4. **Security Check Failures:** Critical regression where unauthorized callers can access donor PII.

---

## 2. Emergency Kill-Switches (Zero-Downtime Fallback)

Before initiating a full rollback, consider the non-destructive kill-switch flags:

### 2.1 Disable Database Security State (`DISABLE_DB_SECURITY`)
If PostgreSQL experiences severe connection latency or query spikes due to `rate_limit_counters` or `idempotency_keys`:
1. In Render Dashboard, set:
   ```env
   DISABLE_DB_SECURITY=true
   ```
2. Save and redeploy.
3. **Impact:** The API immediately switches back to the high-performance, process-local in-memory store for rate limiting, idempotency, and OTP sessions without taking down the service.

---

## 3. Rollback Execution Steps

### Step 1: Frontend Rollback (Vercel) — ~30 Seconds
The Vercel deployment allows instant rollback to the previous stable deployment:
1. Navigate to the **Vercel Project Dashboard** -> **Deployments**.
2. Locate the last known good deployment (prior to the Checkpoint 4 rollout).
3. Click the **three dots menu (`...`)** -> **Instant Rollback**.
4. Confirm the rollback. All web traffic will instantly route to the previous build.

---

### Step 2: Backend API Rollback (Render) — ~2 Minutes
1. Navigate to the **Render Dashboard** -> **Services** -> `raktsetu-api`.
2. Go to the **Deploys** tab.
3. Select the previous stable commit (e.g. commit `2c8dfe7` or `baddd3c`).
4. Click **Rollback to this version**.
5. Alternatively, via Git:
   ```bash
   git revert --no-edit HEAD
   git push origin main
   ```
6. Monitor the deploy logs until the `/health` and `/ready` endpoints return `200 OK`.

---

### Step 3: Database Reversibility & Rollback (PostgreSQL)
The database changes introduced in Checkpoint 4 are **100% additive**.
- Existing tables (`donors`, `blood_requests`, `notifications`, `blood_banks`, `inventory_batches`) were **not altered**.
- Rolling back the API code does **not** require rolling back the database tables, because previous code versions simply do not query the new security tables.

#### Optional: Reverting Security State Tables
If you need to completely remove the security tables for a fresh migration:
```sql
-- Reversible cleanup script for Checkpoint 4 security state
DROP TABLE IF EXISTS rate_limit_counters;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS otp_sessions;
DROP TABLE IF EXISTS consumed_ticket_nonces;
```
*Note: Dropping these tables does not impact donor records, blood bank inventories, or existing emergency blood requests.*

---

## 4. Post-Rollback Verification

Following a rollback, confirm that the system is stable:
1. Verify `/health` returns `200 OK`:
   ```bash
   curl -i https://raktsetu-api-fsyx.onrender.com/health
   ```
2. Verify `/ready` returns `200 OK`:
   ```bash
   curl -i https://raktsetu-api-fsyx.onrender.com/ready
   ```
3. Test emergency blood request dispatch on web frontend:
   - Create a test request.
   - Confirm request status is `searching` or `donors_notified`.
   - Confirm no errors appear in Render API console.
