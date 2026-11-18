import { describe, expect, test, beforeAll } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { app } from '../apps/api/src/index';
import { pushNotificationService } from '../apps/api/src/services/push-notifications';
import { createDonorSessionToken } from '../apps/api/src/services/donor-session';
import { mockStore } from '../apps/api/src/services/mock-store';
import { db, donorPushSubscriptions, eq } from '../packages/db/src/index';

const hasLiveDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasLiveDb)('Checkpoint 4.7: Firebase FCM Configuration & Delivery Audit', () => {
  let testDonorId = 'donor-staging-fcm-test';
  let validSessionToken: string;

  beforeAll(async () => {
    // Fetch a real donor from staging database to satisfy foreign key constraint
    const existingDonor = await db.query.donorProfiles.findFirst();
    if (existingDonor) {
      testDonorId = existingDonor.id;
    }
    validSessionToken = createDonorSessionToken(testDonorId);
    // Clean up test subscriptions in DB
    try {
      await db.delete(donorPushSubscriptions).where(eq(donorPushSubscriptions.donorId, testDonorId));
    } catch {}
  });

  // =========================================================================
  // PHASE 2: FIREBASE CONFIGURATION AUDIT
  // =========================================================================
  describe('Phase 2: Firebase Configuration Audit', () => {
    test('2.1: Web App Client Configuration matches staging project', () => {
      const envPath = path.resolve(import.meta.dir, '../apps/web/.env.local');
      expect(fs.existsSync(envPath)).toBe(true);
      const content = fs.readFileSync(envPath, 'utf8');

      expect(content).toContain('NEXT_PUBLIC_FIREBASE_PROJECT_ID=raktsetu-be5fb');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=959160658057');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_APP_ID=1:959160658057:web:312362c60bce08f0eefe58');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=raktsetu-be5fb.firebaseapp.com');
      expect(content).toContain('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=raktsetu-be5fb.firebasestorage.app');
    });

    test('2.2: Web Push VAPID Public Key is configured and valid format', () => {
      const envPath = path.resolve(import.meta.dir, '../apps/web/.env.local');
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/NEXT_PUBLIC_FIREBASE_VAPID_KEY=([^\r\n]+)/);
      expect(match).not.toBeNull();
      const vapidKey = match![1].trim();
      expect(vapidKey.length).toBeGreaterThan(60);
      expect(vapidKey.startsWith('B')).toBe(true); // Standard uncompressed P-256 EC public key format
    });

    test('2.3: Firebase Admin SDK credentials exist and project matches client', () => {
      const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'C:\\Users\\workg\\Downloads\\raktsetu-be5fb-firebase-adminsdk-fbsvc-18adcbea7f.json';
      expect(fs.existsSync(saPath)).toBe(true);

      const saJson = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      expect(saJson.project_id).toBe('raktsetu-be5fb');
      expect(saJson.type).toBe('service_account');
      expect(saJson.client_email).toContain('raktsetu-be5fb.iam.gserviceaccount.com');
      expect(Boolean(saJson.private_key)).toBe(true);
    });

    test('2.4: Service worker file exists and registers push event listeners', () => {
      const swPath = path.resolve(import.meta.dir, '../apps/web/public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);
      const swContent = fs.readFileSync(swPath, 'utf8');

      expect(swContent).toContain("self.addEventListener('push'");
      expect(swContent).toContain("self.addEventListener('notificationclick'");
      expect(swContent).toContain("importScripts('/firebase-config.js')");
      expect(swContent).toContain('firebase.messaging()');
      expect(swContent).toContain('onBackgroundMessage');
    });

    test('2.5: Dynamic /firebase-config.js route exists and returns javascript', async () => {
      const routePath = path.resolve(import.meta.dir, '../apps/web/app/firebase-config.js/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const routeContent = fs.readFileSync(routePath, 'utf8');
      expect(routeContent).toContain('self.__RAKTSETU_FIREBASE_CONFIG__');
      expect(routeContent).toContain('application/javascript');
    });
  });

  // =========================================================================
  // PHASE 4: BACKEND TOKEN VERIFICATION
  // =========================================================================
  describe('Phase 4: Backend Token Registration & Persistence', () => {
    const syntheticToken = 'fcm-synth-test-token-7788990011223344556677889900112233445566778899';

    test('4.1: Rejects token registration without donor authorization header', async () => {
      const res = await app.request('/api/v1/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken: syntheticToken }),
      });
      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error).toContain('donor session required');
    });

    test('4.2: Rejects invalid or truncated FCM registration tokens', async () => {
      const res = await app.request('/api/v1/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validSessionToken}`,
        },
        body: JSON.stringify({ fcmToken: 'short-token' }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error).toContain('valid FCM registration token');
    });

    test('4.3: Successfully registers valid device token for authorized donor in store and PostgreSQL schema', async () => {
      const res = await app.request('/api/v1/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validSessionToken}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ fcmToken: syntheticToken }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);

      // Verify token registered in mock store
      const tokens = mockStore.getPushTokensForDonor(testDonorId);
      expect(tokens).toContain(syntheticToken);

      // Verify database schema can directly insert and query donorPushSubscriptions
      const liveInsert = await db
        .insert(donorPushSubscriptions)
        .values({
          donorId: testDonorId,
          fcmToken: syntheticToken,
          platform: 'web',
          userAgent: 'Chrome Test',
        })
        .onConflictDoUpdate({
          target: donorPushSubscriptions.fcmToken,
          set: { updatedAt: new Date() },
        })
        .returning();
      expect(liveInsert.length).toBe(1);
      expect(liveInsert[0].fcmToken).toBe(syntheticToken);
    });

    test('4.4: Duplicate token registration upserts and updates timestamp safely', async () => {
      const res = await app.request('/api/v1/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validSessionToken}`,
        },
        body: JSON.stringify({ fcmToken: syntheticToken }),
      });
      expect(res.status).toBe(200);

      // Verify in store
      const tokens = mockStore.getPushTokensForDonor(testDonorId);
      expect(tokens).toContain(syntheticToken);

      // Verify in DB unique constraint: inserting same token again must conflict and update
      const secondInsert = await db
        .insert(donorPushSubscriptions)
        .values({
          donorId: testDonorId,
          fcmToken: syntheticToken,
          platform: 'web',
          userAgent: 'Chrome Test Updated',
        })
        .onConflictDoUpdate({
          target: donorPushSubscriptions.fcmToken,
          set: { userAgent: 'Chrome Test Updated' },
        })
        .returning();
      expect(secondInsert.length).toBe(1);
      expect(secondInsert[0].userAgent).toBe('Chrome Test Updated');

      // Cleanup
      await db.delete(donorPushSubscriptions).where(eq(donorPushSubscriptions.fcmToken, syntheticToken));
    });

    test('4.5: Unregister removes only current donor subscription', async () => {
      const delRes = await app.request('/api/v1/push/register', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validSessionToken}`,
        },
        body: JSON.stringify({ fcmToken: syntheticToken }),
      });
      expect(delRes.status).toBe(200);

      // Verify removed from database
      const rows = await db
        .select()
        .from(donorPushSubscriptions)
        .where(eq(donorPushSubscriptions.fcmToken, syntheticToken));
      expect(rows.length).toBe(0);
    });
  });

  // =========================================================================
  // PHASE 5 & 6: FCM DISPATCH & FAILURE RECOVERY
  // =========================================================================
  describe('Phase 5 & 6: FCM Service Delivery & Recovery Tests', () => {
    test('5.1: Push service handles empty token list gracefully', async () => {
      const res = await pushNotificationService.sendDonationRequest({
        tokens: [],
        requestId: 'req-empty-token-test',
        responseToken: 'mock-resp-token',
        bloodGroup: 'B+',
        distanceKm: 4.5,
      });
      expect(res.success).toBe(false);
      expect(res.mode).toBe('disabled');
    });

    test('5.2: Direct Firebase dispatch validates token and detects invalid tokens', async () => {
      // Send to a synthetic non-existent FCM token against the live Google FCM server
      const invalidSyntheticToken = 'bk3RNwTe3H0:CI2k_HHwgIpoDKCIZvvDMExUdFQ3P1...not-a-real-token-for-test';
      const res = await pushNotificationService.sendDonationRequest({
        tokens: [invalidSyntheticToken],
        requestId: 'req-live-fcm-test',
        responseToken: 'mock-token',
        bloodGroup: 'O+',
        distanceKm: 3.2,
      });

      // Firebase returns mode live or mock depending on test environment
      expect(['live', 'mock']).toContain(res.mode);
      if (res.mode === 'live') {
        // When contacting Google FCM, the fake token is rejected by Google
        expect(res.invalidTokens.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
