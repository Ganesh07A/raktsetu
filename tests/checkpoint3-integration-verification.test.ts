import { describe, expect, test, beforeEach } from 'bun:test';
import { app } from '../apps/api/src/index';
import { otpService, ProductionSmsProvider } from '../apps/api/src/services/otp-service';
import {
  createDonorResponseToken,
  createRequestCloseToken,
  createRequestViewToken,
  createOtpVerificationTicket,
  consumeOtpVerificationTicket,
  resetConsumedTickets,
} from '../apps/api/src/services/donor-session';
import { mockStore } from '../apps/api/src/services/mock-store';
import { requestService } from '../apps/api/src/services/request-service';
import { eraktkoshProxy } from '../apps/api/src/services/eraktkosh-proxy';
import { defaultRateLimitStore } from '../apps/api/src/middleware/rate-limiter';

describe('Checkpoint 3: Production Integration Verification Test Suite', () => {
  beforeEach(() => {
    otpService.clear();
    resetConsumedTickets();
    mockStore.reset();
    eraktkoshProxy.clearCache();
    defaultRateLimitStore.clear();
  });

  // =========================================================================
  // SECTION 2: AUTHORIZATION AND PRIVACY INTEGRATION TESTS
  // =========================================================================
  describe('Area 2: Authorization and Privacy Under Multi-Identity Conditions', () => {
    test('Cross-Request Token Isolation: Token for Request A cannot close Request B', async () => {
      // 1. Create Request A
      const reqARes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Patient Alpha',
          hospitalName: 'Hospital A',
          bloodGroupNeeded: 'O+',
          unitsNeeded: 1,
          latitude: 28.6139,
          longitude: 77.209,
        }),
      });
      const reqAData = await reqARes.json();
      const reqAId = reqAData.request.id;
      const reqACloseToken = reqAData.requestCloseToken;

      // 2. Create Request B
      const reqBRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Patient Beta',
          hospitalName: 'Hospital B',
          bloodGroupNeeded: 'A+',
          unitsNeeded: 1,
          latitude: 28.6139,
          longitude: 77.209,
        }),
      });
      const reqBData = await reqBRes.json();
      const reqBId = reqBData.request.id;

      // 3. Attempt to close Request B using Request A's close token
      const crossCloseRes = await app.request(`/api/v1/requests/${reqBId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestCloseToken: reqACloseToken }),
      });

      // Must be rejected with 401 Unauthorized
      expect(crossCloseRes.status).toBe(401);
      const closeErr = await crossCloseRes.json();
      expect(closeErr.error).toContain('invalid or expired');
    });

    test('Expired and Replayed Signed Tokens are Rejected', async () => {
      // 1. Replayed OTP ticket
      const phone = '+919876543210';
      const ticket = createOtpVerificationTicket(phone, 'donor_registration');
      const consume1 = await consumeOtpVerificationTicket(ticket, 'donor_registration', phone);
      expect(consume1.success).toBe(true);

      const consume2 = await consumeOtpVerificationTicket(ticket, 'donor_registration', phone);
      expect(consume2.success).toBe(false);
      expect(consume2.error).toContain('already been used');

      // 2. Expired response token
      const expiredPayload = {
        purpose: 'donor-response',
        donorId: 'donor-test-1',
        requestId: 'req-test-1',
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      };
      const encoded = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const { createHmac } = require('node:crypto');
      const sig = createHmac('sha256', 'raktsetu-local-development-secret-change-before-deployment')
        .update(encoded)
        .digest('base64url');
      const expiredToken = `${encoded}.${sig}`;

      const { verifyDonorResponseToken } = require('../apps/api/src/services/donor-session');
      const verified = verifyDonorResponseToken(expiredToken);
      expect(verified).toBeNull();
    });

    test('Audit Finding: Requester B / Anonymous inspection of Request A accepted donors', async () => {
      // 1. Create Request A
      const reqRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: 'Requester A Patient',
          hospitalName: 'AIIMS New Delhi',
          bloodGroupNeeded: 'AB-',
          unitsNeeded: 1,
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
        }),
      });
      const reqData = await reqRes.json();
      const reqAId = reqData.request.id;

      // 2. Donor accepts
      const donorToken = createDonorResponseToken(reqAId, 'donor-amit-ab-neg');
      await app.request('/api/v1/push/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseToken: donorToken,
          action: 'accepted',
        }),
      });

      // 3. Anonymous caller fetches Request A
      const anonRes = await app.request(`/api/v1/requests/${reqAId}`);
      expect(anonRes.status).toBe(200);
      const anonData = await anonRes.json();

      // Current implementation returns acceptedDonors unconditionally if someone knows ID:
      const leaksAcceptedDonorsWithoutToken = Array.isArray(anonData.acceptedDonors) && anonData.acceptedDonors.length > 0;
      console.log('[INTEGRATION AUDIT] Does GET /requests/:id expose acceptedDonors to anonymous callers?', leaksAcceptedDonorsWithoutToken);
    });
  });

  // =========================================================================
  // SECTION 3: OTP AND REGISTRATION INTEGRATION TESTS
  // =========================================================================
  describe('Area 3: OTP and Registration Resiliency & Provider Failure', () => {
    test('Missing production SMS credentials fails-closed without pretending success', async () => {
      const origKey = process.env.OTP_PROVIDER_API_KEY;
      const origTwilio = process.env.TWILIO_AUTH_TOKEN;
      const origFast = process.env.FAST2SMS_API_KEY;

      try {
        delete process.env.OTP_PROVIDER_API_KEY;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.FAST2SMS_API_KEY;

        const prodProvider = new ProductionSmsProvider();
        const sendResult = await prodProvider.sendOtp('+919876543210', '123456', 'donor_registration');

        expect(sendResult.success).toBe(false);
        expect(sendResult.error).toContain('SMS service is currently unavailable');
      } finally {
        if (origKey) process.env.OTP_PROVIDER_API_KEY = origKey;
        if (origTwilio) process.env.TWILIO_AUTH_TOKEN = origTwilio;
        if (origFast) process.env.FAST2SMS_API_KEY = origFast;
      }
    });

    test('Production Registration Rejects Missing Verification Ticket', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const res = await app.request('/api/v1/donors/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Bypass Attempter',
            phone: '+919876543210',
            bloodGroup: 'O+',
            latitude: 28.6139,
            longitude: 77.209,
            state: 'Delhi',
            district: 'Central Delhi',
          }),
        });

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toContain('verification ticket is required');
      } finally {
        (process.env as any).NODE_ENV = origEnv;
      }
    });
  });

  // =========================================================================
  // SECTION 4: INVENTORY INTEGRITY INTEGRATION TESTS
  // =========================================================================
  describe('Area 4: Blood Inventory Parsing & OpenData Directory Isolation', () => {
    test('eRaktKosh HTML Stock Parser extracts exact counts and rejects synthetic counts', () => {
      // Simulate raw upstream rows
      const rawRows = [
        [
          '1',
          'City Charitable Blood Centre<br/>Plot 12, Sector 4<br/>Phone: +91 11 23456789<br/>Email: info@cityblood.org',
          'Charity',
          'Available, A+Ve:15, B+Ve:0, O+Ve:22',
          '2026-11-12 10:00:00',
          'Govt',
        ],
      ];

      const parsed = (eraktkoshProxy as any).parseERaktKoshJson(
        rawRows,
        { bloodGroup: 'A+' },
        'Delhi'
      );

      expect(parsed.length).toBe(1);
      const bank = parsed[0];
      expect(bank.name).toBe('City Charitable Blood Centre');
      expect(bank.phone).toBe('+91 11 23456789');
      expect(bank.isVerified).toBe(false);
      expect(bank.verificationStatus).toBe('source_reported');
      expect(bank.distanceKm).toBeNull(); // Upstream does not have GPS; never faked

      // Exact parsed stock
      expect(bank.stock.length).toBe(1);
      expect(bank.stock[0].bloodGroup).toBe('A+');
      expect(bank.stock[0].unitsAvailable).toBe(15);
    });

    test('OpenData directory fallback returns zero units and unverified badges', async () => {
      // In production mode with coords, photon/osm returns manual directory banks
      const origEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const res = await eraktkoshProxy.searchStock({
          lat: 12.9716,
          lng: 77.5946,
          radiusKm: 10,
          bloodGroup: 'AB-',
        });

        // Verify no directory result ever fabricates confirmed availability
        for (const bank of res.banks) {
          if (bank.source === 'manual') {
            expect(bank.isVerified).toBe(false);
            expect(bank.verificationStatus).toBe('unverified');
            expect(bank.stock).toHaveLength(0);
            expect(bank.isStockAvailable).toBe(false);
          }
        }
      } finally {
        (process.env as any).NODE_ENV = origEnv;
      }
    }, { timeout: 15000 });
  });

  // =========================================================================
  // SECTION 5: DISTRIBUTED ABUSE PROTECTION & PROCESS-LOCAL STORAGE AUDIT
  // =========================================================================
  describe('Area 5: Abuse Protection & Multi-Instance Process-Local Storage Audit', () => {
    test('Single-instance idempotency prevents duplicate requests', async () => {
      const key = 'test-idemp-unique-key-999';
      const payload = {
        patientName: 'Idempotent Seeker',
        hospitalName: 'Apollo Delhi',
        bloodGroupNeeded: 'O+',
        unitsNeeded: 1,
        latitude: 28.6139,
        longitude: 77.209,
      };

      const res1 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(payload),
      });
      const data1 = await res1.json();

      const res2 = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(payload),
      });
      const data2 = await res2.json();

      expect(data1.request.id).toBe(data2.request.id);
    });

    test('Audit Finding: Process-local storage resets when querying a separate memory store', () => {
      const { MemoryRateLimitStore } = require('../apps/api/src/middleware/rate-limiter');
      const instance1Store = new MemoryRateLimitStore();
      const instance2Store = new MemoryRateLimitStore();

      const ip = '198.51.100.1';
      // Fill limit on Instance 1
      for (let i = 0; i < 10; i++) {
        instance1Store.increment(ip, 60000);
      }
      const inst1Check = instance1Store.increment(ip, 60000);
      expect(inst1Check.count).toBe(11); // Exceeded on instance 1

      // Request hits Instance 2 (e.g. load balancer routes to replica B)
      const inst2Check = instance2Store.increment(ip, 60000);
      expect(inst2Check.count).toBe(1); // Bypassed! Fresh counter on instance 2
      console.log('[INTEGRATION AUDIT] Multi-instance rate limiting bypass confirmed due to process-local memory store');
    });
  });

  // =========================================================================
  // SECTION 7: OPERATIONAL READINESS AUDIT (CORS, HEADERS, HEALTH)
  // =========================================================================
  describe('Area 7: Operational Readiness & Security Headers', () => {
    test('Health and Readiness Endpoints Return Valid Status', async () => {
      const healthRes = await app.request('/health');
      expect(healthRes.status).toBe(200);
      const healthData = await healthRes.json();
      expect(healthData.status).toBe('ok');
      expect(healthData.timestamp).toBeDefined();

      const readyRes = await app.request('/ready');
      expect(readyRes.status).toBe(200);
      const readyData = await readyRes.json();
      expect(readyData.ready).toBe(true);
    });

    test('Audit Finding: CORS preflight headers check for custom application headers', async () => {
      // Simulate browser preflight OPTIONS request with Idempotency-Key and x-close-token
      const preflightRes = await app.request('/api/v1/requests', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://raktsetu-six.vercel.app',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Idempotency-Key, x-close-token',
        },
      });

      const allowedHeaders = preflightRes.headers.get('Access-Control-Allow-Headers') || '';
      const supportsCustomHeaders = allowedHeaders.includes('Idempotency-Key');
      console.log('[INTEGRATION AUDIT] Does CORS allow Idempotency-Key header?', supportsCustomHeaders, 'Allowed:', allowedHeaders);
    });

    test('Audit Finding: API responses lack HSTS, CSP, and X-Content-Type-Options secure headers', async () => {
      const res = await app.request('/health');
      const nosniff = res.headers.get('x-content-type-options');
      const hsts = res.headers.get('strict-transport-security');
      const xframe = res.headers.get('x-frame-options');

      console.log('[INTEGRATION AUDIT] Security Headers:', {
        'x-content-type-options': nosniff,
        'strict-transport-security': hsts,
        'x-frame-options': xframe,
      });
      // Confirm secure headers middleware is active
      expect(nosniff).toBe('nosniff');
      expect(xframe).toBe('DENY');
      expect(hsts).toContain('max-age=31536000');
    });
  });
});
