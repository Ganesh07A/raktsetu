# RaktSetu / RaktKhoj — Staging & Production Deployment Checklist
**Document Version:** 1.0  
**Target Environments:** Staging (`raktsetu-staging`), Production (`raktsetu-six.vercel.app`, `raktsetu-api-fsyx.onrender.com`)

---

## 1. Pre-Deployment Configuration & Environment Variables

Verify that all required environment variables are set in Render (API service) and Vercel (Web frontend) before initiating the build or traffic migration.

### 1.1 Backend API (`apps/api`) — Render Environment Variables

| Variable Name | Required | Example / Guidance | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables production error sanitization and strict security checks. |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:...@...:6543/postgres?pgbouncer=true` | PostgreSQL database connection string. |
| `DONOR_SESSION_SECRET` | **Yes** | *Min 64-char high-entropy string* | Signs and verifies capability tokens (`requestViewToken`, `requestCloseToken`, `verificationTicket`). |
| `CORS_ORIGIN` | **Yes** | `https://raktkhoj.org,https://raktsetu-six.vercel.app` | Whitelist of allowed web frontend origins. |
| `PUBLIC_WEB_ORIGIN` | **Yes** | `https://raktsetu-six.vercel.app` | Absolute origin used for deep-link push notifications and webhooks. |
| `PORT` | Optional | `3002` (or injected by Render) | Port on which the API listens. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional | *One-line minified JSON string* | Enables Web Push notifications to donors. (If omitted, push notifications run in safe disabled mode). |
| `OTP_PROVIDER_API_KEY` | Optional | *SMS gateway secret* | Production SMS gateway token. (If omitted, OTP requests return 503 instead of falling back to insecure dev codes). |

---

### 1.2 Frontend Web (`apps/web`) — Vercel Environment Variables

| Variable Name | Required | Example / Guidance | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://raktsetu-api-fsyx.onrender.com` | Base URL for backend API calls. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Optional | `pk.eyJ...` | Optional Mapbox vector tile token for map visualizer. |

---

## 2. Database Migration Procedure

The Checkpoint 4 distributed security state migration is non-destructive and backward-compatible. It introduces four new tables without modifying existing application tables.

### 2.1 Applying the Migration
Apply the SQL migration file located at:  
`packages/db/migrations/20261112_shared_security_state.sql`

#### Option A: Direct PostgreSQL CLI (`psql`)
```bash
psql "$DATABASE_URL" -f packages/db/migrations/20261112_shared_security_state.sql
```

#### Option B: Supabase / Cloud SQL Dashboard SQL Editor
1. Open the SQL editor in the database console.
2. Copy the contents of `packages/db/migrations/20261112_shared_security_state.sql`.
3. Execute the script.

### 2.2 Verifying Migration Success
Run the following SQL verification query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('rate_limit_counters', 'idempotency_keys', 'otp_sessions', 'consumed_ticket_nonces');
```
*Expected Output:* 4 rows returned.

---

## 3. Step-by-Step Staging Rollout Procedure

1. **Tag and Merge Release Candidate:**
   ```bash
   git checkout main
   git merge --ff-only fix/checkpoint-4-production-blockers
   git tag -a v1.0.0-rc.1 -m "Release Candidate 1: Production Blockers Remediated"
   git push origin main --tags
   ```

2. **Deploy Database Migration:**
   - Execute `20261112_shared_security_state.sql` against the staging database.

3. **Deploy Backend API:**
   - Trigger build and deployment on Render.
   - Verify build completes successfully: `bun build src/index.ts --outdir dist --target bun`.
   - Monitor deploy logs for `[@repo/api] configuration problems`.

4. **Verify Backend Health & Readiness:**
   ```bash
   curl -i https://raktsetu-api-staging.onrender.com/health
   # Expected: HTTP 200 {"status":"ok","timestamp":"..."}
   # Verify security headers: X-Content-Type-Options: nosniff, X-Frame-Options: DENY

   curl -i https://raktsetu-api-staging.onrender.com/ready
   # Expected: HTTP 200 {"ready":true}
   ```

5. **Deploy Frontend Web Application:**
   - Deploy to Vercel staging preview.
   - Verify Next.js build succeeds with 0 errors.

---

## 4. Post-Deployment Smoke Test Protocol

Perform the following smoke tests on the deployed staging environment:

1. **Emergency Request Creation:**
   - Open `/request` in browser.
   - Complete Step 1 through Step 6 and dispatch emergency blood request.
   - Verify navigation to `/request/<id>` (check URL does **NOT** expose `closeToken` or `viewToken`).
   - Verify browser `sessionStorage` contains `raktkhoj_view_token_<id>`.
2. **Anonymous Privacy Check:**
   - Copy `/request/<id>` and open in a private / incognito browser window.
   - Verify that the waiting room loads cleanly with fuzzed coordinates and no donor contact cards.
3. **Donor Acceptance Flow:**
   - Simulate donor acceptance via deep link.
   - In the seeker's original window, verify accepted donor card unlocks name, phone, and direct call button.
   - In the private / incognito window, refresh and verify accepted donor phone remains completely redacted.
4. **Close Search Flow:**
   - In the seeker window, click "Close Search".
   - Verify request status transitions to `cancelled`.
   - Refresh page: verify accepted donor contact details are now withheld.
5. **CORS & Preflight Check:**
   - Inspect browser DevTools Network tab: verify preflight `OPTIONS` requests return `204 No Content` with `Access-Control-Allow-Headers: Content-Type, Authorization, Idempotency-Key...`.

