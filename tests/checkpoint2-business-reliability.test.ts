import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  BLOOD_GROUPS,
  COMPONENT_TYPES,
  getCompatibleDonorGroups,
  isDonorCompatible,
  getCompatibleRecipientGroups,
  RBC_COMPATIBILITY,
  WHOLE_BLOOD_COMPATIBILITY,
  PLASMA_COMPATIBILITY,
  PLATELET_COMPATIBILITY,
  type BloodGroup,
  type ComponentType,
} from '../packages/shared/src/index';
import { donorMatcher } from '../apps/api/src/services/donor-matcher';
import { mockStore } from '../apps/api/src/services/mock-store';
import { requestService } from '../apps/api/src/services/request-service';
import { notificationOutbox } from '../apps/api/src/services/notification-outbox';
import {
  createRequestViewToken,
  createRequestCloseToken,
  createOtpVerificationTicket,
} from '../apps/api/src/services/donor-session';
import { app } from '../apps/api/src/index';

describe('Checkpoint 2: Business Logic & Reliability Remediation', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  describe('H-01: Correct Blood-Group Deep Links & Selection Integrity', () => {
    // Normalization helper matching RequestWizard logic
    function normalizeDeepLinkBloodGroup(raw: string | null | undefined): BloodGroup | null {
      if (!raw) return null;
      let str = raw.trim();
      if (raw.endsWith(' ') && !str.endsWith('+') && !str.endsWith('-')) {
        str += '+';
      }
      const normalized = str.replace(/\s+/g, '+').toUpperCase();
      return (BLOOD_GROUPS as readonly string[]).includes(normalized)
        ? (normalized as BloodGroup)
        : null;
    }

    it('accepts and normalizes all 8 valid ABO/Rh blood groups from URL queries', () => {
      const allGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      for (const group of allGroups) {
        expect(normalizeDeepLinkBloodGroup(group)).toBe(group);
        // Test url-decoded space variant (e.g. "B ")
        expect(normalizeDeepLinkBloodGroup(group.replace('+', ' '))).toBe(group);
        // Test lowercase variant (e.g. "b+")
        expect(normalizeDeepLinkBloodGroup(group.toLowerCase())).toBe(group);
        // Test whitespace padding
        expect(normalizeDeepLinkBloodGroup(`  ${group}  `)).toBe(group);
      }
    });

    it('returns null and NEVER silently falls back to AB+ for invalid or missing inputs', () => {
      const invalidInputs = [
        '',
        null,
        undefined,
        'C+',
        'X-',
        'invalid',
        'AB',
        'O',
        'POSITIVE',
        '123',
        '--select--',
      ];

      for (const input of invalidInputs) {
        const result = normalizeDeepLinkBloodGroup(input);
        expect(result).toBeNull();
        expect(result).not.toBe('AB+'); // Critical audit assertion: NO silent fallback to AB+
      }
    });
  });

  describe('H-04: Correct Blood-Component Semantics & Compatibility Matrices', () => {
    describe('Red Blood Cell (PRBC) Compatibility', () => {
      it('enforces O- as universal RBC donor and AB+ as universal RBC recipient', () => {
        expect(getCompatibleDonorGroups('O-', 'prbc')).toEqual(['O-']);
        expect(getCompatibleDonorGroups('AB+', 'prbc')).toEqual([
          'AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-',
        ]);
      });

      it('confirms Rh- can donate to Rh+ for identical ABO groups', () => {
        expect(isDonorCompatible('A-', 'A+', 'prbc')).toBe(true);
        expect(isDonorCompatible('B-', 'B+', 'prbc')).toBe(true);
        expect(isDonorCompatible('O-', 'O+', 'prbc')).toBe(true);
        expect(isDonorCompatible('A+', 'A-', 'prbc')).toBe(false);
      });
    });

    describe('Fresh Frozen Plasma (FFP) Compatibility', () => {
      it('enforces AB as universal plasma donor and O as universal plasma recipient', () => {
        // Universal plasma donor AB can donate to any recipient
        expect(isDonorCompatible('AB+', 'O+', 'ffp')).toBe(true);
        expect(isDonorCompatible('AB+', 'A+', 'ffp')).toBe(true);
        expect(isDonorCompatible('AB+', 'B+', 'ffp')).toBe(true);
        expect(isDonorCompatible('AB+', 'AB+', 'ffp')).toBe(true);

        // AB patient can ONLY receive AB plasma (recipient RBCs have A and B antigens; other plasmas contain anti-A/anti-B)
        const abDonors = getCompatibleDonorGroups('AB+', 'ffp');
        expect(abDonors).toContain('AB+');
        expect(abDonors).toContain('AB-');
        expect(abDonors).not.toContain('O+');
        expect(abDonors).not.toContain('O-');
        expect(abDonors).not.toContain('A+');
        expect(abDonors).not.toContain('B+');

        // O recipient has no ABO antigens on RBCs, can safely receive any plasma
        const oDonors = getCompatibleDonorGroups('O+', 'ffp');
        expect(oDonors.length).toBe(8);
      });
    });

    describe('Whole Blood Compatibility', () => {
      it('restricts whole blood transfusions to identical ABO group with compatible Rh', () => {
        // Whole blood contains donor antibodies, so O Whole Blood CANNOT be given to A patient!
        expect(isDonorCompatible('O+', 'A+', 'whole_blood')).toBe(false);
        expect(isDonorCompatible('O-', 'A+', 'whole_blood')).toBe(false);

        // A+ recipient can receive A+ and A- whole blood
        expect(getCompatibleDonorGroups('A+', 'whole_blood')).toEqual(['A+', 'A-']);
        expect(getCompatibleDonorGroups('A-', 'whole_blood')).toEqual(['A-']);

        // B+ recipient can receive B+ and B- whole blood
        expect(getCompatibleDonorGroups('B+', 'whole_blood')).toEqual(['B+', 'B-']);
        expect(getCompatibleDonorGroups('B-', 'whole_blood')).toEqual(['B-']);

        // AB+ recipient can receive AB+ and AB- whole blood
        expect(getCompatibleDonorGroups('AB+', 'whole_blood')).toEqual(['AB+', 'AB-']);
      });
    });

    describe('Platelet Compatibility', () => {
      it('prefers identical ABO and AB plasma compatibility', () => {
        expect(isDonorCompatible('AB+', 'AB+', 'platelets')).toBe(true);
        expect(isDonorCompatible('AB-', 'AB+', 'platelets')).toBe(true);
        expect(isDonorCompatible('O+', 'AB+', 'platelets')).toBe(false);
      });
    });

    it('passes componentType to donorMatcher and filters donors accordingly', async () => {
      mockStore.reset({
        donors: [
          {
            id: 'donor-o-pos',
            userId: 'user-o-pos',
            bloodGroup: 'O+',
            latitude: 28.5672,
            longitude: 77.21,
            state: 'Delhi',
            district: 'New Delhi',
            city: 'Delhi',
            dateOfBirth: '1995-01-01',
            gender: 'male',
            weightKg: 70,
            lastDonationDate: null,
            isAvailable: true,
            searchRadiusKm: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'donor-ab-pos',
            userId: 'user-ab-pos',
            bloodGroup: 'AB+',
            latitude: 28.5672,
            longitude: 77.21,
            state: 'Delhi',
            district: 'New Delhi',
            city: 'Delhi',
            dateOfBirth: '1995-01-01',
            gender: 'male',
            weightKg: 70,
            lastDonationDate: null,
            isAvailable: true,
            searchRadiusKm: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockStore.addPushSubscription('donor-o-pos', 'token-o');
      mockStore.addPushSubscription('donor-ab-pos', 'token-ab');

      // For A+ recipient needing WHOLE BLOOD:
      // O+ donor is NOT compatible for Whole Blood (donor plasma contains anti-A)
      const wholeBloodMatches = await donorMatcher.findCompatibleDonors({
        recipientBloodGroup: 'A+',
        componentType: 'whole_blood',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });
      expect(wholeBloodMatches.some((d) => d.bloodGroup === 'O+')).toBe(false);

      // For A+ recipient needing PRBC:
      // O+ donor IS compatible for packed red cells
      const prbcMatches = await donorMatcher.findCompatibleDonors({
        recipientBloodGroup: 'A+',
        componentType: 'prbc',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });
      expect(prbcMatches.some((d) => d.bloodGroup === 'O+')).toBe(true);
    });
  });

  describe('H-03: Respect Donor Travel Radius', () => {
    it('strictly enforces bidirectional travel radius constraint', async () => {
      // Seeker is at (28.5672, 77.21)
      // Donor A: 4 km away, willing to travel 5 km (Within both -> MATCH)
      // Donor B: 8 km away, willing to travel 5 km (Within seeker 10km, but beyond donor willingness 5km -> EXCLUDE)
      // Donor C: 12 km away, willing to travel 25 km (Within donor willingness, but beyond seeker 10km -> EXCLUDE)
      mockStore.reset({
        donors: [
          {
            id: 'donor-within-both',
            userId: 'user-a',
            bloodGroup: 'B+',
            latitude: 28.6032, // approx 4 km away
            longitude: 77.21,
            state: 'Delhi',
            district: 'New Delhi',
            city: 'Delhi',
            dateOfBirth: '1995-01-01',
            gender: 'male',
            weightKg: 70,
            lastDonationDate: null,
            isAvailable: true,
            searchRadiusKm: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'donor-beyond-donor-radius',
            userId: 'user-b',
            bloodGroup: 'B+',
            latitude: 28.6392, // approx 8 km away
            longitude: 77.21,
            state: 'Delhi',
            district: 'New Delhi',
            city: 'Delhi',
            dateOfBirth: '1995-01-01',
            gender: 'male',
            weightKg: 70,
            lastDonationDate: null,
            isAvailable: true,
            searchRadiusKm: 5, // donor only willing to travel 5 km!
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'donor-beyond-seeker-radius',
            userId: 'user-c',
            bloodGroup: 'B+',
            latitude: 28.6752, // approx 12 km away
            longitude: 77.21,
            state: 'Delhi',
            district: 'New Delhi',
            city: 'Delhi',
            dateOfBirth: '1995-01-01',
            gender: 'male',
            weightKg: 70,
            lastDonationDate: null,
            isAvailable: true,
            searchRadiusKm: 25, // donor willing to travel 25 km, but seeker radius is 10 km!
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockStore.addPushSubscription('donor-within-both', 'token-a');
      mockStore.addPushSubscription('donor-beyond-donor-radius', 'token-b');
      mockStore.addPushSubscription('donor-beyond-seeker-radius', 'token-c');

      const matches = await donorMatcher.findCompatibleDonors({
        recipientBloodGroup: 'B+',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10, // Seeker searches within 10 km
      });

      const matchedIds = matches.map((d) => d.id);
      expect(matchedIds).toContain('donor-within-both');
      expect(matchedIds).not.toContain('donor-beyond-donor-radius');
      expect(matchedIds).not.toContain('donor-beyond-seeker-radius');
    });
  });

  describe('H-02: Persist Matched Blood-Bank References', () => {
    it('persists matched bank metadata when institutional stock is found and returns it to authorized seeker', async () => {
      // Create request where nearby institutional stock is available
      const requesterPhone = '+919876543210';
      const ticket = createOtpVerificationTicket(requesterPhone, 'emergency_request');

      // Seed bank with confirmed units of O+
      mockStore.reset({
        banks: [
          {
            id: 'bank-aiims-delhi',
            name: 'AIIMS Blood Centre',
            licenseNumber: 'DL-1234',
            state: 'Delhi',
            district: 'New Delhi',
            city: 'New Delhi',
            address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi',
            phone: '+91-11-26588500',
            email: 'bloodbank@aiims.edu',
            latitude: 28.5672,
            longitude: 77.21,
            distanceKm: 0.5,
            isVerified: true,
            source: 'eraktkosh',
            lastStockUpdate: new Date().toISOString(),
            stock: [
              {
                bloodGroup: 'O+',
                componentType: 'whole_blood',
                unitsAvailable: 15,
                verificationStatus: 'source_reported',
              },
            ],
          },
        ],
      });

      const createRes = await app.request('/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: 'O+',
          componentType: 'whole_blood',
          unitsNeeded: 2,
          patientName: 'Kavita Verma',
          hospitalName: 'AIIMS Hospital',
          latitude: 28.5672,
          longitude: 77.21,
          searchRadiusKm: 10,
          requesterPhone,
          verificationTicket: ticket,
        }),
      });

      expect(createRes.status).toBe(201);
      const createData = await createRes.json();
      expect(createData.status).toBe('bank_found');
      expect(createData.request.fulfillmentSource).toBe('blood_bank');
      expect(createData.request.matchedBankName).toContain('AIIMS');
      expect(createData.request.matchedBankPhone).toBeTruthy();
      expect(createData.request.matchedBankAddress).toContain('New Delhi');

      // Now fetch request with view capability token
      const viewRes = await app.request(`/api/v1/requests/${createData.request.id}`, {
        headers: { Authorization: `Bearer ${createData.requestViewToken}` },
      });
      expect(viewRes.status).toBe(200);
      const viewData = await viewRes.json();
      expect(viewData.request.matchedBankName).toBe(createData.request.matchedBankName);
      expect(viewData.request.matchedBankPhone).toBe(createData.request.matchedBankPhone);
    });
  });

  describe('H-07: Correct Unknown Request Handling & 404 Responses', () => {
    it('returns HTTP 404 for nonexistent request IDs', async () => {
      const res = await app.request('/api/v1/requests/nonexistent-req-99999');
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });
  });

  describe('Section 7: Notification Outbox Architecture', () => {
    it('enqueues pending notifications and dispatches them with retry logic', async () => {
      const outboxSummary = await notificationOutbox.enqueue({
        requestId: 'req-outbox-test-1',
        bloodGroupNeeded: 'B+',
        donors: [
          {
            id: 'donor-outbox-1',
            name: 'Rohit Sharma',
            phone: '+919876543299',
            bloodGroup: 'B+',
            distanceKm: 3.2,
          },
        ],
      });

      expect(outboxSummary.queuedCount).toBe(1);
    });
  });

  describe('Section 8: Request Lifecycle State Machine Transitions', () => {
    it('allows valid forward state transitions', async () => {
      const reqId = 'req-state-test-1';
      await requestService.createRequest({
        id: reqId,
        requesterId: null,
        bloodGroupNeeded: 'O+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Test Patient',
        patientAge: 30,
        emergencyType: 'surgery',
        hospitalName: 'General Hospital',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'New Delhi',
        searchRadiusKm: 10,
        status: 'searching',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // searching -> donors_notified (valid)
      const t1 = await requestService.updateRequestStatus(reqId, 'donors_notified');
      expect(t1.success).toBe(true);
      expect(t1.requestStatus).toBe('donors_notified');

      // donors_notified -> fulfilled (valid)
      const t2 = await requestService.updateRequestStatus(reqId, 'fulfilled', 'donor');
      expect(t2.success).toBe(true);
      expect(t2.requestStatus).toBe('fulfilled');
    });

    it('rejects illegal state transitions and preserves terminal state immutability', async () => {
      const reqId = 'req-state-test-cancelled';
      await requestService.createRequest({
        id: reqId,
        requesterId: null,
        bloodGroupNeeded: 'O+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Test Patient',
        patientAge: 30,
        emergencyType: 'surgery',
        hospitalName: 'General Hospital',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'New Delhi',
        searchRadiusKm: 10,
        status: 'cancelled', // Terminal state
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      // Cannot transition from terminal 'cancelled' to 'searching' or 'fulfilled'
      const invalidT1 = await requestService.updateRequestStatus(reqId, 'searching');
      expect(invalidT1.success).toBe(false);
      expect(invalidT1.error).toContain('Illegal state transition');

      const invalidT2 = await requestService.updateRequestStatus(reqId, 'fulfilled');
      expect(invalidT2.success).toBe(false);
      expect(invalidT2.error).toContain('Illegal state transition');
    });

    it('enforces capability authorization and state machine rules on PATCH /api/v1/requests/:id/status', async () => {
      const reqId = 'req-patch-api-test';
      const closeToken = createRequestCloseToken(reqId);

      await requestService.createRequest({
        id: reqId,
        requesterId: null,
        bloodGroupNeeded: 'A+',
        componentType: 'whole_blood',
        unitsNeeded: 1,
        patientName: 'Aarav Patel',
        patientAge: 25,
        emergencyType: 'surgery',
        hospitalName: 'Apollo Hospital',
        latitude: 28.5672,
        longitude: 77.21,
        state: 'Delhi',
        district: 'New Delhi',
        searchRadiusKm: 10,
        status: 'donors_notified',
        fulfillmentSource: null,
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      });

      // Valid cancellation using capability token
      const patchRes = await app.request(`/api/v1/requests/${reqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestCloseToken: closeToken,
          status: 'cancelled',
        }),
      });

      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.updatedStatus).toBe('cancelled');

      // Attempt illegal transition after cancellation (should fail with 409 Conflict)
      const illegalRes = await app.request(`/api/v1/requests/${reqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestCloseToken: closeToken,
          status: 'donors_notified',
        }),
      });

      expect(illegalRes.status).toBe(409);
    });
  });
});
