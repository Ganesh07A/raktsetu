# Operational Health & Configuration Reporting

RaktSetu API provides two endpoints to inspect service health, configuration state, and push telemetry.

## `/health` vs `/ready`

- **`GET /health`** (Liveness Probe): Always returns HTTP `200` to prevent hosting platforms (such as Render) from entering restart loops. It reports `status: "ok"` when healthy or `status: "degraded"` when configuration errors exist, along with full diagnostics and telemetry.
- **`GET /ready`** (Readiness & Deploy Gate): Returns HTTP `200` (`{ ready: true }`) when operational, and HTTP `503` (`{ ready: false, blocking: [...] }`) when production-blocking configuration problems are detected (`NODE_ENV=production`). Use this endpoint for deploy verification and uptime monitoring.

## Diagnostic Fields

| Field | Meaning |
|---|---|
| `mode.database.configured` | `true` if `DATABASE_URL` is set; `false` if using the fallback offline mock proxy. |
| `push.configured` | `true` if Firebase Admin credentials are provided via JSON or ADC path. |
| `push.fcmLinkUsable` | `true` if `PUBLIC_WEB_ORIGIN` is configured as a valid absolute `https://` URL for FCM notification links. |
| `cors.origins` | Effective allowlist of origins permitted for cross-origin browser requests. |
| `push.stats.*` | In-process push counters (`attempts`, `sent`, `failed`, `disabled`, `skippedNoTokens`, `mockSends`, `invalidTokensRemoved`, `lastSuccessAt`, `lastErrorAt`, `lastError`). |
| `providers.eraktkosh.*` | Upstream provider call telemetry (`calls`, `lastOkAt`, `lastErrorAt`, `lastError`). |

> Telemetry counters are held in-memory and reset on service restart until persistent delivery receipts are implemented.

## Problem Resolution Guide

| `problems[].key` | Level in Prod | Recommended Fix |
|---|---|---|
| `DATABASE_URL` | `error` | Set `DATABASE_URL` to the Supabase pooler connection string (port 6543, `?pgbouncer=true`). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `error` | Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the single-line service account JSON, or set `GOOGLE_APPLICATION_CREDENTIALS` to a valid credentials file. |
| `PUBLIC_WEB_ORIGIN` | `error` | Set `PUBLIC_WEB_ORIGIN=https://raktsetu-six.vercel.app` (must be absolute `https://`). |
| `CORS_ORIGIN` | `error` | Add the deployed web origin (`https://raktsetu-six.vercel.app`) to `CORS_ORIGIN` (comma-separated). |
| `MOCK_SERVICES` | `error` | Unset `MOCK_SERVICES` (or set to `false`) in the production environment settings. |
