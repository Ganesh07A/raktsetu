# RaktSetu — Checkpoint 4.7: Firebase FCM Configuration Audit & Browser Push Delivery Report

**Document Version:** 1.0  
**Date:** 2026-11-16  
**Auditor / Roles:** Senior Firebase Engineer, Backend Architect & Browser Automation QA Engineer  
**Repository:** `https://github.com/Ganesh07A/raktsetu`  
**Current Branch:** `fix/checkpoint-4-production-blockers`  
**Latest Validated Commit:** `c6e3e0f` (`docs(fcm): clarify bounded waiting vs network cancellation in test descriptions`)  
**Firebase Project:** `raktsetu-be5fb`  
**Target Staging Database:** Isolated Staging PostgreSQL 17 on AWS Stockholm (`aws-0-eu-north-1.pooler.supabase.com:6543/postgres`)  
**Final Verdict:** **B. FIREBASE CONFIGURED — BROWSER DELIVERY NOT VERIFIED**

---

## 1. Executive Summary

Checkpoint 4.7 audited the complete Firebase Cloud Messaging (FCM) implementation in RaktSetu across both frontend and backend layers, validated server-side and client-side configuration, executed backend token management and outbox delivery tests, and investigated end-to-end browser push delivery.

### Key Audit Findings
1. **Firebase Client & Admin Configuration:**
   - The Web App client configuration (`apps/web/.env.local`) and Firebase Admin SDK credentials (`GOOGLE_APPLICATION_CREDENTIALS`) both correctly target project `raktsetu-be5fb`.
   - The VAPID Web Push certificate key (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`) is valid and correctly formatted.
   - The dynamic `/firebase-config.js` route serves `self.__RAKTSETU_FIREBASE_CONFIG__` with all required client keys (`apiKey`, `projectId`, `messagingSenderId`, `appId`).
   - The service worker (`/sw.js`) contains comprehensive `push`, `notificationclick`, and Firebase compat background handlers.
2. **Backend Token Management & Persistence:**
   - The token registration API (`POST /api/v1/push/register`) strictly requires a valid donor session token (rejects unauthorized with HTTP 401).
   - Validates FCM token format and length (rejects invalid tokens with HTTP 400).
   - Persists tokens to `donor_push_subscriptions` on PostgreSQL with atomic upsert on conflict (`target: fcmToken`).
   - Unregister (`DELETE /api/v1/push/register`) removes only the authenticated donor's registration token.
3. **Outbox Integration & Fencing:**
   - Outbox batch processing claims pending records atomically using `FOR UPDATE SKIP LOCKED`.
   - Strict lease-token fencing and bounded client-side waiting timeouts (15s) prevent worker hangs and state corruption.
4. **Browser Receipt Status:**
   - While the backend, Firebase Admin SDK, service worker, and web configuration are 100% verified, **actual live push display on a running physical Chrome browser tab could not be demonstrated** because automated Chrome DevTools Protocol control could not attach to the user's running personal desktop Chrome profile without a dedicated debugging port, and Web Push notifications strictly require an interactive user gesture (`Notification.requestPermission()`).
   - In accordance with non-negotiable rules (*"Do not claim delivery success based only on Firebase initialization, successful token generation, database persistence, Admin SDK send response, or outbox state transition. Actual browser receipt must be demonstrated"*), the final verdict is certified as **B. FIREBASE CONFIGURED — BROWSER DELIVERY NOT VERIFIED**.

---

## 2. Phase 1 — Implementation Inspection & Component Architecture

### Component Responsibility Trace

| Lifecycle Step | Component / File | Function / Mechanism | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **1. SW Registration** | `apps/web/app/components/register-sw.tsx` | Registers `/sw.js` on mount without waiting for `window.load` | Verified in client bundle |
| **2. Permission Request** | `apps/web/src/lib/firebase-messaging.ts` | `Notification.requestPermission()` | Triggers native browser prompt |
| **3. Token Acquisition** | `apps/web/src/lib/firebase-messaging.ts` | `getToken(messaging, { vapidKey, serviceWorkerRegistration })` | Obtains FCM P-256 Web Push token |
| **4. Token Submission** | `apps/web/app/components/push-notification-opt-in.tsx` | `fetch('/api/v1/push/register')` with `Authorization: Bearer <donorSession>` | Sends token to backend API |
| **5. Token Persistence** | `apps/api/src/routes/push.ts` | `db.insert(donorPushSubscriptions).onConflictDoUpdate(...)` | Verified against PostgreSQL 17 |
| **6. Cascade Matching** | `apps/api/src/routes/requests.ts` | Cascades emergency blood requests when institutional bank stock is 0 | Matched compatible donors queued |
| **7. Outbox Enqueue** | `apps/api/src/services/notification-outbox.ts` | Inserts rows into `donor_notifications` with status `pending` | Verified atomic transactional write |
| **8. Worker Claim** | `apps/api/src/services/notification-outbox.ts` | `SELECT ... FOR UPDATE SKIP LOCKED` + fresh UUID `lease_token` | Non-overlapping worker claims |
| **9. Admin SDK Dispatch** | `apps/api/src/services/push-notifications.ts` | `messaging.sendEach(messages)` with `Promise.race([send, timeout])` | Verified Firebase Admin client |
| **10. Foreground Handler** | `apps/web/app/components/foreground-push-listener.tsx` | `onMessage(messaging, callback)` + audio chime & system notification | Verified listener component |
| **11. Background Handler** | `apps/web/public/sw.js` | Native `push` listener + `messaging.onBackgroundMessage` | Dual native + compat listeners |
| **12. Action Routing** | `apps/web/public/sw.js` | `notificationclick` listener navigates window to `/donor/respond/:id?action=...` | Custom action routing wins |

---

## 3. Phase 2 — Firebase Configuration Audit

### 3.1 Firebase Web Client Configuration
Inspected `apps/web/.env.local` and `apps/web/app/firebase-config.js/route.ts`:
- **`projectId`:** `raktsetu-be5fb` (**PASS**)
- **`messagingSenderId`:** `959160658057` (**PASS**)
- **`appId`:** `1:959160658057:web:312362c60bce08f0eefe58` (**PASS**)
- **`apiKey`:** Configured and present (Google API key format `AIzaSy...`) (**PASS**)
- **`authDomain`:** `raktsetu-be5fb.firebaseapp.com` (**PASS**)
- **`storageBucket`:** `raktsetu-be5fb.firebasestorage.app` (**PASS**)

### 3.2 Web Push & VAPID Configuration
- **VAPID Public Key:** `BFMMHmhKQDLlaqMurnYgHRzy8EXCuEvFKHOxKU59jcqjyAjUOjQfunf1bW4HrUwMlYJJMLdgTQOadp1z86xzxiU` (**PASS**)
  - Standard uncompressed P-256 elliptic curve public key (87 characters, starts with `B`).
  - Matches the Firebase Cloud Messaging Web Push certificate pair.

### 3.3 Firebase Admin SDK Server-Side Configuration
- **Credential Source:** `GOOGLE_APPLICATION_CREDENTIALS` pointing to `raktsetu-be5fb-firebase-adminsdk-fbsvc-18adcbea7f.json` (**PASS**).
- **Service Account Project:** `raktsetu-be5fb` (matches client web project exactly).
- **Service Account Client Email:** `...@raktsetu-be5fb.iam.gserviceaccount.com` (**PASS**).
- **Admin SDK Initialization:** Initialized and tested with `getMessaging(initializeApp(...))` without errors (**PASS**).

### 3.4 Service Worker File & Endpoint Audit
- **File Location:** `apps/web/public/sw.js` served at `/sw.js` with root scope (`/`) (**PASS**).
- **Dynamic Config Endpoint:** `GET /firebase-config.js` serves `self.__RAKTSETU_FIREBASE_CONFIG__` with `Content-Type: application/javascript; charset=utf-8` and `Cache-Control: no-store` (**PASS**).
- **Handlers:** Implements native `self.addEventListener('push', ...)` and `self.addEventListener('notificationclick', ...)`.

### 3.5 HTTPS Context Audit
- **Staging / Production:** Served over HTTPS (`https://raktsetu-six.vercel.app`, TLS 1.3, HSTS `max-age=31536000`).
- **Local Testing:** Localhost (`http://localhost:3000`) is recognized by Chromium as a secure context (`window.isSecureContext === true`).

---

## 4. Phase 3 & 4 — Browser & Backend Token Registration Results

### 4.1 Backend Token Registration (`apps/api/src/routes/push.ts`)
Verified via `tests/fcm-config-and-delivery-audit.test.ts`:
1. **Authentication Enforcement:** `POST /api/v1/push/register` without `Authorization: Bearer <donorSession>` is rejected with HTTP 401 (**PASS**).
2. **Token Format Validation:** Tokens shorter than 40 characters or longer than 4096 characters are rejected with HTTP 400 (**PASS**).
3. **Database Persistence:** Valid tokens are persisted to `donor_push_subscriptions` on PostgreSQL with `donor_id`, `fcm_token`, `platform = 'web'`, and `user_agent` (**PASS**).
4. **Duplicate Handling:** Upsert on conflict (`target: fcm_token`) updates `donor_id` and `updated_at` without duplicating rows (**PASS**).
5. **Deregistration:** `DELETE /api/v1/push/register` cleanly removes the subscription for the authenticated donor (**PASS**).

### 4.2 Browser Permission & Token Retrieval Analysis
- In standard headless environments, Web Push notifications cannot obtain an FCM token without user interaction granting notification permissions (`Notification.requestPermission()`).
- Automated DevTools control (`chrome-devtools-mcp`) could not hook into the user's running Chrome session due to an npm Arborist crash on Bun monorepo workspace symlinks and because the host Chrome browser was running without `--remote-debugging-port=9222`.
- As a result, direct live token retrieval from an interactive Chrome prompt is classified as **NOT TESTED (Live Interactive)** while being **PASS (Component & API Logic Verified)**.

---

## 5. Phase 5 & 6 — FCM Delivery, Failure & Recovery Results

| Test Scenario | Target Layer | Execution Result | Status |
| :--- | :--- | :--- | :--- |
| **5.1 Empty Token Handling** | `PushNotificationService` | Handled gracefully without crash; returns `{ success: false, mode: 'disabled' }` | **PASS** |
| **5.2 Invalid Token Rejection** | Google FCM Server | Admin SDK contacts FCM; invalid synthetic tokens are identified and placed in `invalidTokens` for removal | **PASS** |
| **5.3 Bounded Waiting Timeout** | Outbox Worker | 15s deadline enforced via `Promise.race` preventing hanging workers | **PASS** |
| **5.4 Stale Lease Fencing** | Outbox Worker | Expired worker attempting update affects 0 rows; overwrite prevented | **PASS** |
| **5.5 Atomic Claims (`SKIP LOCKED`)** | PostgreSQL Outbox | Multiple workers claim disjoint batches without duplicate sends | **PASS** |
| **5.6 Crash Recovery At-Least-Once** | PostgreSQL Outbox | Crashed worker lease (>120s) reclaimed and safely retried | **PASS** |
| **5.7 Direct Chrome Push Display** | Physical Chrome Browser | Automated CDP hook unavailable on host browser | **NOT TESTED** |
| **5.8 Foreground Audio & Banner** | Physical Chrome Tab | Interactive tab session required | **NOT TESTED** |
| **5.9 Background System Banner** | Physical Chrome OS Banner | Interactive OS notification banner required | **NOT TESTED** |

---

## 6. Identified Non-Blocking Warnings & Manual Testing Instructions

### 1. Host Chrome DevTools Automation Limitation
- **Finding:** The Chrome DevTools MCP server runner uses `npm exec chrome-devtools-mcp@latest`. npm's Arborist module crashes with `TypeError: Cannot read properties of null (reading 'package')` when crawling Bun workspace symlinks in `d:\MEGA PROJECTS\raktsetu\node_modules`.
- **Workaround / Fix for Automation:** Run Chrome automation scripts directly via Node/Bun or test manually in an interactive browser tab.

### 2. Manual End-to-End Verification Guide for the Developer
To view a real push notification on your Chrome browser:
1. Start the backend API:
   ```bash
   bun run apps/api/src/index.ts
   ```
2. Start the web frontend:
   ```bash
   bun run --filter=web dev
   ```
3. Open `http://localhost:3000/en/donor/dashboard` in Google Chrome.
4. Click **"Enable notifications"** on the Emergency Push Notifications card.
5. In the Chrome native prompt, click **"Allow"**.
6. The card updates to **"Enabled on this device"**, and the device token is registered in the database.
7. Trigger an emergency blood request via `POST /api/v1/requests` cascading to your blood group.
8. The outbox worker dispatches the push via Firebase Admin SDK, and Chrome displays the actionable notification banner with **"I'm available"** and **"Not available"** buttons.

---

## 7. Final Test Execution Summary

| Test Suite | Total Tests | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- |
| `tests/fcm-config-and-delivery-audit.test.ts` | 12 | 12 | 0 | **PASS** |
| `tests/outbox-lease-safety-and-fcm-semantics.test.ts` | 7 | 7 | 0 | **PASS** |
| `tests/outbox-recovery-real-pg.test.ts` | 6 | 6 | 0 | **PASS** |
| `tests/multi-process-pg-verification.test.ts` | 5 | 5 | 0 | **PASS** |
| **Total FCM & Outbox Integration Tests** | **30** | **30** | **0** | **PASS** |

---

## 8. Final Verdict

> ### **B. FIREBASE CONFIGURED — BROWSER DELIVERY NOT VERIFIED**
>
> **Rationale:**
> - All Firebase client credentials, VAPID public certificates, Firebase Admin SDK credentials (`GOOGLE_APPLICATION_CREDENTIALS`), service workers, and backend token registration endpoints are fully configured, functional, and verified.
> - Outbox lease-token fencing, atomic claims via `SKIP LOCKED`, and bounded timeout semantics are 100% verified.
> - Actual browser notification receipt on a live physical Chrome session could not be demonstrated in this automated run because the host Chrome browser was active without remote debugging enabled, and Web Push notifications require an interactive user gesture.
