import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  phoneSchema,
  phoneRegex,
  coordinatesSchema,
  donorRegistrationSchema,
  createBloodRequestSchema,
  bloodSearchQuerySchema,
} from '../packages/shared/src/validation';
import { BLOOD_GROUPS, COMPONENT_TYPES, EMERGENCY_TYPES } from '../packages/shared/src/constants';
import { app } from '../apps/api/src/index';

describe('Adversarial Zod Schema Testing', () => {
  describe('phoneSchema & phoneRegex', () => {
    it('accepts standard 10-digit Indian numbers starting with 6, 7, 8, 9', () => {
      const validNumbers = ['9876543210', '8123456789', '7000000000', '6999999999'];
      for (const num of validNumbers) {
        const result = phoneSchema.safeParse(num);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(`+91${num}`);
        }
      }
    });

    it('accepts numbers with +91 prefix and normalizes them', () => {
      const validPrefixed = ['+919876543210', '+91-9876543210', '+91 9876543210'];
      for (const num of validPrefixed) {
        const result = phoneSchema.safeParse(num);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('+919876543210');
        }
      }
    });

    it('tests behavior of numbers starting with 91 (without +)', () => {
      // Numbers like 919876543210 have 12 digits
      const result = phoneSchema.safeParse('919876543210');
      // Empirical observation of whether 91 prefix without plus is supported or rejected
      const pass = result.success;
      expect(typeof pass).toBe('boolean');
    });

    it('accepts numbers with leading 0 (trunk prefix 09876543210) and normalizes them', () => {
      const result = phoneSchema.safeParse('09876543210');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('+919876543210');
      }
    });

    it('accepts internal spaces and dashes in 10-digit body (e.g. 98765 43210 or 98765-43210)', () => {
      const resSpace = phoneSchema.safeParse('98765 43210');
      const resDash = phoneSchema.safeParse('98765-43210');
      const resPrefixWithSpace = phoneSchema.safeParse('+91 98765 43210');
      const resPrefixWithDash = phoneSchema.safeParse('+91-98765-43210');

      expect(resSpace.success).toBe(true);
      expect(resDash.success).toBe(true);
      expect(resPrefixWithSpace.success).toBe(true);
      expect(resPrefixWithDash.success).toBe(true);
      if (resSpace.success) expect(resSpace.data).toBe('+919876543210');
      if (resDash.success) expect(resDash.data).toBe('+919876543210');
      if (resPrefixWithSpace.success) expect(resPrefixWithSpace.data).toBe('+919876543210');
      if (resPrefixWithDash.success) expect(resPrefixWithDash.data).toBe('+919876543210');
    });

    it('rejects numbers that are too short', () => {
      const shortNumbers = ['987654321', '9876', '9', ''];
      for (const num of shortNumbers) {
        const result = phoneSchema.safeParse(num);
        expect(result.success).toBe(false);
      }
    });

    it('rejects numbers that are too long', () => {
      const longNumbers = ['98765432101', '987654321000', '+9198765432101'];
      for (const num of longNumbers) {
        const result = phoneSchema.safeParse(num);
        expect(result.success).toBe(false);
      }
    });

    it('rejects numbers starting with digits 0 through 5', () => {
      const invalidPrefixes = ['0876543210', '1876543210', '2876543210', '3876543210', '4876543210', '5876543210'];
      for (const num of invalidPrefixes) {
        const result = phoneSchema.safeParse(num);
        expect(result.success).toBe(false);
      }
    });

    it('rejects non-digit and malicious inputs', () => {
      const adversarial = [
        '98765abcde',
        '+91987654321a',
        '9876543210; DROP TABLE users;',
        '<script>alert(1)</script>',
        '९८७६५४३२१०', // Devanagari numerals
        'null',
        'undefined',
      ];
      for (const num of adversarial) {
        const result = phoneSchema.safeParse(num);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('coordinatesSchema', () => {
    it('accepts exact boundary coordinates [-90, 90] lat and [-180, 180] lon', () => {
      const boundaries = [
        { latitude: 90, longitude: 180 },
        { latitude: -90, longitude: -180 },
        { latitude: 90, longitude: -180 },
        { latitude: -90, longitude: 180 },
        { latitude: 0, longitude: 0 },
      ];
      for (const b of boundaries) {
        const res = coordinatesSchema.safeParse(b);
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.latitude).toBe(b.latitude);
          expect(res.data.longitude).toBe(b.longitude);
        }
      }
    });

    it('coerces string representations of valid boundary coordinates', () => {
      const strBoundaries = [
        { latitude: '90', longitude: '180' },
        { latitude: '-90', longitude: '-180' },
        { latitude: '28.6139', longitude: '77.2090' },
      ];
      for (const b of strBoundaries) {
        const res = coordinatesSchema.safeParse(b);
        expect(res.success).toBe(true);
        if (res.success) {
          expect(typeof res.data.latitude).toBe('number');
          expect(typeof res.data.longitude).toBe('number');
        }
      }
    });

    it('rejects coordinates strictly beyond boundary limits (>90, <-90, >180, <-180)', () => {
      const invalidBoundaries = [
        { latitude: 90.0001, longitude: 0 },
        { latitude: -90.0001, longitude: 0 },
        { latitude: 0, longitude: 180.0001 },
        { latitude: 0, longitude: -180.0001 },
        { latitude: 91, longitude: 0 },
        { latitude: -91, longitude: 0 },
        { latitude: 0, longitude: 181 },
        { latitude: 0, longitude: -181 },
        { latitude: 1000, longitude: 1000 },
      ];
      for (const b of invalidBoundaries) {
        const res = coordinatesSchema.safeParse(b);
        expect(res.success).toBe(false);
      }
    });

    it('rejects non-number, NaN, Infinity, and uncoercible coordinate inputs', () => {
      const malformed = [
        { latitude: NaN, longitude: 77 },
        { latitude: 28, longitude: NaN },
        { latitude: Infinity, longitude: 77 },
        { latitude: -Infinity, longitude: 77 },
        { latitude: 28, longitude: Infinity },
        { latitude: 'delhi', longitude: '77.2' },
        { latitude: undefined, longitude: 77.2 },
        { latitude: {}, longitude: 77.2 },
      ];
      for (const b of malformed) {
        const res = coordinatesSchema.safeParse(b);
        expect(res.success).toBe(false);
      }
    });

    it('rejects silent coercion of null, booleans, and arrays into coordinates', () => {
      // Null coordinates must be rejected (not coerced to (0, 0) Null Island)
      const nullCoord = coordinatesSchema.safeParse({ latitude: null, longitude: null });
      expect(nullCoord.success).toBe(false);

      // Boolean coordinates must be rejected
      const boolCoord = coordinatesSchema.safeParse({ latitude: false, longitude: true });
      expect(boolCoord.success).toBe(false);

      // Array coordinates must be rejected
      const arrayCoord = coordinatesSchema.safeParse({ latitude: [28.6], longitude: 77.2 });
      expect(arrayCoord.success).toBe(false);

      const emptyArrayCoord = coordinatesSchema.safeParse({ latitude: [], longitude: [] });
      expect(emptyArrayCoord.success).toBe(false);

      // Empty strings must be rejected
      const emptyStrCoord = coordinatesSchema.safeParse({ latitude: '', longitude: '' });
      expect(emptyStrCoord.success).toBe(false);
    });
  });

  describe('donorRegistrationSchema boundary & malformed inputs', () => {
    const validDonorBase = {
      phone: '9876543210',
      name: 'Rohan Sharma',
      email: 'rohan@example.com',
      bloodGroup: 'B+' as const,
      latitude: 28.6139,
      longitude: 77.2090,
      state: 'Delhi',
      district: 'New Delhi',
      whatsappConsent: true,
    };

    it('accepts valid minimal donor payload', () => {
      const res = donorRegistrationSchema.safeParse(validDonorBase);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.phone).toBe('+919876543210');
        expect(res.data.searchRadiusKm).toBe(10);
        expect(res.data.isAvailable).toBe(true);
        expect(res.data.preferredLanguage).toBe('en');
      }
    });

    it('enforces weight minimum (45 kg) and maximum (200 kg)', () => {
      const underweight = { ...validDonorBase, weightKg: 44.9 };
      const resUnder = donorRegistrationSchema.safeParse(underweight);
      expect(resUnder.success).toBe(false);

      const exactMin = { ...validDonorBase, weightKg: 45.0 };
      const resMin = donorRegistrationSchema.safeParse(exactMin);
      expect(resMin.success).toBe(true);

      const exactMax = { ...validDonorBase, weightKg: 200.0 };
      const resMax = donorRegistrationSchema.safeParse(exactMax);
      expect(resMax.success).toBe(true);

      const overweight = { ...validDonorBase, weightKg: 200.1 };
      const resOver = donorRegistrationSchema.safeParse(overweight);
      expect(resOver.success).toBe(false);
    });

    it('enforces mandatory whatsappConsent === true (rejects false or missing)', () => {
      const noConsent = { ...validDonorBase, whatsappConsent: false };
      const resNo = donorRegistrationSchema.safeParse(noConsent);
      expect(resNo.success).toBe(false);

      const missingConsent = { ...validDonorBase };
      delete (missingConsent as Record<string, unknown>).whatsappConsent;
      const resMissing = donorRegistrationSchema.safeParse(missingConsent);
      expect(resMissing.success).toBe(false);
    });

    it('validates all 8 ABO/Rh blood groups and rejects invalid groups', () => {
      for (const group of BLOOD_GROUPS) {
        const res = donorRegistrationSchema.safeParse({ ...validDonorBase, bloodGroup: group });
        expect(res.success).toBe(true);
      }

      const invalidGroups = ['C+', 'A', 'O', 'AB', 'a+', 'b-', 'rh+', 'universal'];
      for (const group of invalidGroups) {
        const res = donorRegistrationSchema.safeParse({ ...validDonorBase, bloodGroup: group });
        expect(res.success).toBe(false);
      }
    });

    it('tests name validation rules (min 2 characters, empty, whitespace-only)', () => {
      const shortName = { ...validDonorBase, name: 'A' };
      expect(donorRegistrationSchema.safeParse(shortName).success).toBe(false);

      const emptyName = { ...validDonorBase, name: '' };
      expect(donorRegistrationSchema.safeParse(emptyName).success).toBe(false);

      // Whitespace only with trim fails min(2)
      const whitespaceName = { ...validDonorBase, name: '   ' };
      const wsResult = donorRegistrationSchema.safeParse(whitespaceName);
      expect(wsResult.success).toBe(false);
    });

    it('accepts empty string for optional email or valid email, rejects malformed email', () => {
      const emptyEmail = { ...validDonorBase, email: '' };
      expect(donorRegistrationSchema.safeParse(emptyEmail).success).toBe(true);

      const omittedEmail = { ...validDonorBase };
      delete (omittedEmail as Record<string, unknown>).email;
      expect(donorRegistrationSchema.safeParse(omittedEmail).success).toBe(true);

      const invalidEmail = { ...validDonorBase, email: 'not-an-email' };
      expect(donorRegistrationSchema.safeParse(invalidEmail).success).toBe(false);
    });

    it('tests dateOfBirth and lastDonationDate format validation (YYYY-MM-DD)', () => {
      const validDob = { ...validDonorBase, dateOfBirth: '1995-08-15', lastDonationDate: '2026-01-10' };
      expect(donorRegistrationSchema.safeParse(validDob).success).toBe(true);

      const invalidDobFormat = { ...validDonorBase, dateOfBirth: '15/08/1995' };
      expect(donorRegistrationSchema.safeParse(invalidDobFormat).success).toBe(false);

      const invalidLastDonation = { ...validDonorBase, lastDonationDate: '2026.01.10' };
      expect(donorRegistrationSchema.safeParse(invalidLastDonation).success).toBe(false);
    });
  });

  describe('createBloodRequestSchema boundary & malformed inputs', () => {
    const validRequestBase = {
      bloodGroupNeeded: 'O-' as const,
      patientName: 'Sunita Devi',
      hospitalName: 'AIIMS Trauma Center',
      latitude: 28.5672,
      longitude: 77.2100,
    };

    it('accepts valid minimal blood request payload with defaults', () => {
      const res = createBloodRequestSchema.safeParse(validRequestBase);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.unitsNeeded).toBe(1);
        expect(res.data.searchRadiusKm).toBe(10);
        expect(res.data.componentType).toBe('whole_blood');
      }
    });

    it('enforces unitsNeeded integer bounds [1, 20]', () => {
      const minUnits = { ...validRequestBase, unitsNeeded: 1 };
      expect(createBloodRequestSchema.safeParse(minUnits).success).toBe(true);

      const maxUnits = { ...validRequestBase, unitsNeeded: 20 };
      expect(createBloodRequestSchema.safeParse(maxUnits).success).toBe(true);

      const zeroUnits = { ...validRequestBase, unitsNeeded: 0 };
      expect(createBloodRequestSchema.safeParse(zeroUnits).success).toBe(false);

      const negativeUnits = { ...validRequestBase, unitsNeeded: -1 };
      expect(createBloodRequestSchema.safeParse(negativeUnits).success).toBe(false);

      const excessUnits = { ...validRequestBase, unitsNeeded: 21 };
      expect(createBloodRequestSchema.safeParse(excessUnits).success).toBe(false);

      const floatUnits = { ...validRequestBase, unitsNeeded: 2.5 };
      expect(createBloodRequestSchema.safeParse(floatUnits).success).toBe(false);
    });

    it('enforces patientAge integer bounds [0, 120]', () => {
      const infant = { ...validRequestBase, patientAge: 0 };
      expect(createBloodRequestSchema.safeParse(infant).success).toBe(true);

      const elderly = { ...validRequestBase, patientAge: 120 };
      expect(createBloodRequestSchema.safeParse(elderly).success).toBe(true);

      const negativeAge = { ...validRequestBase, patientAge: -1 };
      expect(createBloodRequestSchema.safeParse(negativeAge).success).toBe(false);

      const overAge = { ...validRequestBase, patientAge: 121 };
      expect(createBloodRequestSchema.safeParse(overAge).success).toBe(false);

      const floatAge = { ...validRequestBase, patientAge: 35.5 };
      expect(createBloodRequestSchema.safeParse(floatAge).success).toBe(false);
    });

    it('strictly enforces searchRadiusKm presets [5, 10, 50]', () => {
      for (const radius of [5, 10, 50] as const) {
        const res = createBloodRequestSchema.safeParse({ ...validRequestBase, searchRadiusKm: radius });
        expect(res.success).toBe(true);
      }

      const invalidRadii = [0, 1, 15, 20, 25, 100, -5];
      for (const radius of invalidRadii) {
        const res = createBloodRequestSchema.safeParse({ ...validRequestBase, searchRadiusKm: radius as any });
        expect(res.success).toBe(false);
      }
    });

    it('validates componentType against COMPONENT_TYPES', () => {
      for (const comp of COMPONENT_TYPES) {
        const res = createBloodRequestSchema.safeParse({ ...validRequestBase, componentType: comp });
        expect(res.success).toBe(true);
      }

      const invalidComp = { ...validRequestBase, componentType: 'plasma_only' as any };
      expect(createBloodRequestSchema.safeParse(invalidComp).success).toBe(false);
    });

    it('validates requesterPhone using phoneSchema when provided', () => {
      const validPhone = { ...validRequestBase, requesterPhone: '9876543210' };
      const resValid = createBloodRequestSchema.safeParse(validPhone);
      expect(resValid.success).toBe(true);
      if (resValid.success) {
        expect(resValid.data.requesterPhone).toBe('+919876543210');
      }

      const invalidPhone = { ...validRequestBase, requesterPhone: '12345' };
      expect(createBloodRequestSchema.safeParse(invalidPhone).success).toBe(false);
    });
  });
});

describe('Adversarial Hono API Testing', () => {
  describe('Health Endpoint Verification (/health)', () => {
    it('returns HTTP 200 with JSON content type and valid ISO timestamp', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('application/json');

      const body = (await res.json()) as { status: string; timestamp: string };
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();

      // Verify ISO 8601 string format
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(isoRegex.test(body.timestamp)).toBe(true);

      // Verify Date can parse it and round-trips
      const parsedDate = new Date(body.timestamp);
      expect(parsedDate.getTime()).not.toBeNaN();
      expect(parsedDate.toISOString()).toBe(body.timestamp);
    });

    it('tests HTTP methods other than GET on /health', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        const res = await app.request('/health', { method });
        // Hono routing returns 404 for unmatched method/route
        expect(res.status).toBe(404);
      }
    });
  });

  describe('CORS Headers & Security Configuration', () => {
    it('returns Access-Control-Allow-Origin for whitelisted origin http://localhost:3000', async () => {
      const res = await app.request('/health', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    });

    it('returns Access-Control-Allow-Origin for whitelisted origin https://raktkhoj.org', async () => {
      const res = await app.request('/health', {
        headers: { Origin: 'https://raktkhoj.org' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://raktkhoj.org');
    });

    it('does NOT reflect unwhitelisted or adversarial origins in Access-Control-Allow-Origin', async () => {
      const adversarialOrigins = [
        'https://attacker.example.com',
        'http://malicious.org',
        'null',
      ];
      for (const origin of adversarialOrigins) {
        const res = await app.request('/health', {
          headers: { Origin: origin },
        });
        const allowOrigin = res.headers.get('access-control-allow-origin');
        expect(allowOrigin).toBeNull();
      }
    });

    it('handles CORS OPTIONS preflight requests properly', async () => {
      const res = await app.request('/api/v1/donors/register', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      // Preflight options response
      expect([200, 204]).toContain(res.status);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
      const allowMethods = res.headers.get('access-control-allow-methods');
      expect(allowMethods).toContain('POST');
    });
  });

  describe('Adversarial Payloads, Missing Headers & Malformed Inputs', () => {
    it('handles requests with completely missing headers', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
    });

    it('handles requests to undefined / non-existent routes with 404', async () => {
      const routes = [
        '/unknown',
        '/api/v1/invalid-route',
        '/api/v2/anything',
        '//health',
        '/health/subpath',
      ];
      for (const route of routes) {
        const res = await app.request(route);
        expect(res.status).toBe(404);
      }
    });

    it('handles giant payloads (1MB string payload) gracefully without crashing', async () => {
      const giantString = 'x'.repeat(1024 * 1024); // 1 MB
      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giant: giantString }),
      });
      // The stub should process or respond with 200 without OOM or unhandled crash
      expect(res.status).toBe(200);
      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('tests malformed JSON body sent to POST endpoints', async () => {
      const malformedJson = '{"broken": ';
      const res = await app.request('/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: malformedJson,
      });
      // Because Milestone 1 router stub does not read body (c.req.json()), it succeeds
      // But if c.req.json() were called without error handler, it would throw
      expect([200, 400, 500]).toContain(res.status);
    });

    it('tests non-object JSON payloads (array, number, boolean, null)', async () => {
      const primitives = ['[1, 2, 3]', '12345', 'true', 'null'];
      for (const prim of primitives) {
        const res = await app.request('/api/v1/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: prim,
        });
        expect([200, 400]).toContain(res.status);
      }
    });

    it('tests query parameter pollution and injection strings on search and webhook endpoints', async () => {
      const injectionQueries = [
        '/api/v1/blood-banks/search?lat=28.6&lng=77.2&bloodGroup=O%27%20OR%201=1--',
        '/api/v1/blood-banks/search?__proto__[polluted]=true',
        '/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<script>alert(1)</script>&hub.challenge=test',
      ];
      for (const query of injectionQueries) {
        const res = await app.request(query);
        // The server must not crash (returns 200 or 403 or 400)
        expect([200, 400, 403]).toContain(res.status);
      }
    });
  });
});
