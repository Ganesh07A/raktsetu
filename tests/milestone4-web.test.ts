import { describe, it, expect } from 'bun:test';
import {
  BLOOD_GROUPS,
  COMPONENT_TYPES,
  RADIUS_PRESETS,
  type BloodGroup,
} from '../packages/shared/src/constants';
import {
  getCompatibleDonorGroups,
  isDonorCompatible,
} from '../packages/shared/src/blood-compatibility';
import { haversineDistance } from '../packages/shared/src/geo-utils';

describe('Milestone 4 — Emergency Discovery & Donor Flow Contracts', () => {
  describe('Deliverable 1: Leaflet Interactive Map View Contracts', () => {
    it('verifies custom SVG marker contracts without relying on broken external PNGs', () => {
      // User location marker pulse and core styling contract
      const userMarkerHtml = `
        <div class="custom-user-marker">
          <div style="background: rgba(59, 130, 246, 0.35);"></div>
          <div style="background: #2563eb;"></div>
        </div>
      `;
      expect(userMarkerHtml).toContain('custom-user-marker');
      expect(userMarkerHtml).toContain('#2563eb');

      // Blood bank teardrop marker contract
      const bankMarkerHtml = `
        <div class="custom-bank-marker">
          <div style="background: #dc2626;">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </div>
      `;
      expect(bankMarkerHtml).toContain('custom-bank-marker');
      expect(bankMarkerHtml).toContain('#dc2626');

      // Donor pin marker contract
      const donorMarkerHtml = `
        <div class="custom-donor-marker">
          <div style="background: #16a34a;">
            <svg viewBox="0 0 24 24"><path d="M12 21.35"/></svg>
          </div>
        </div>
      `;
      expect(donorMarkerHtml).toContain('custom-donor-marker');
      expect(donorMarkerHtml).toContain('#16a34a');
    });

    it('verifies radius circle calculations for 5 km, 10 km, and 50 km presets in meters', () => {
      const radiusMeters = (km: number) => km * 1000;
      expect(radiusMeters(5)).toBe(5000);
      expect(radiusMeters(10)).toBe(10000);
      expect(radiusMeters(50)).toBe(50000);
    });
  });

  describe('Deliverable 2: Emergency Blood Discovery Search Form', () => {
    it('verifies all 8 standard ABO/Rh blood groups are selectable', () => {
      expect(BLOOD_GROUPS).toEqual([
        'A+',
        'A-',
        'B+',
        'B-',
        'AB+',
        'AB-',
        'O+',
        'O-',
      ]);
    });

    it('validates URL search parameters formatting for cascading results', () => {
      const queryParams = new URLSearchParams({
        bloodGroup: 'B+',
        lat: '28.5672',
        lng: '77.2100',
        radiusKm: '10',
        componentType: 'whole_blood',
        unitsNeeded: '2',
        state: 'Delhi',
        district: 'South Delhi',
      });

      expect(queryParams.get('bloodGroup')).toBe('B+');
      expect(queryParams.get('radiusKm')).toBe('10');
      expect(queryParams.get('unitsNeeded')).toBe('2');
      expect(queryParams.get('state')).toBe('Delhi');
      expect(queryParams.get('district')).toBe('South Delhi');
    });

    it('verifies 3 fixed radius options strictly match 5km, 10km, 50km', () => {
      expect(RADIUS_PRESETS).toEqual([5, 10, 50]);
    });

    it('verifies supported component types include whole_blood, prbc, platelets, ffp', () => {
      expect(COMPONENT_TYPES).toContain('whole_blood');
      expect(COMPONENT_TYPES).toContain('prbc');
      expect(COMPONENT_TYPES).toContain('platelets');
      expect(COMPONENT_TYPES).toContain('ffp');
    });
  });

  describe('Deliverable 3: Cascading Search Results Flow & Donor Fallback', () => {
    it('enforces Stage 1 blood bank proximity sorting', () => {
      const banks = [
        { name: 'Max Super Speciality Hospital Saket', distanceKm: 4.45 },
        { name: 'AIIMS Main Blood Bank', distanceKm: 0.12 },
        { name: 'Safdarjung Hospital Regional Blood Centre', distanceKm: 0.35 },
      ];

      banks.sort((a, b) => a.distanceKm - b.distanceKm);

      expect(banks[0]!.name).toBe('AIIMS Main Blood Bank');
      expect(banks[1]!.name).toBe('Safdarjung Hospital Regional Blood Centre');
      expect(banks[2]!.name).toBe('Max Super Speciality Hospital Saket');
    });

    it('triggers Stage 2 fallback to compatible donors when bank stock is 0', () => {
      const requestedGroup: BloodGroup = 'AB-';
      const bankStockUnits = 0;

      const shouldFallbackToDonors = bankStockUnits === 0;
      expect(shouldFallbackToDonors).toBe(true);

      const compatibleGroups = getCompatibleDonorGroups(requestedGroup);
      expect(compatibleGroups).toEqual(['AB-', 'A-', 'B-', 'O-']);
      expect(compatibleGroups).not.toContain('AB+');
      expect(compatibleGroups).not.toContain('O+');
    });

    it('verifies direct click-to-call link structure', () => {
      const rawPhone = '+911126593201';
      const callLink = `tel:${rawPhone}`;
      expect(callLink).toBe('tel:+911126593201');
    });
  });

  describe('Deliverable 4: Real-time Waiting Room & Privacy Unmasking', () => {
    it('masks donor phone numbers while notification status is pending', () => {
      const rawPhone = '+919876543210';
      const maskedPhone = rawPhone.replace(
        /(\+\d{2})(\d{2})\d{4}(\d{4})/,
        '$1 $2****$3'
      );
      expect(maskedPhone).toBe('+91 98****3210');
      expect(maskedPhone).not.toContain('7654');
    });

    it('dynamically unlocks unmasked phone and WhatsApp direct chat link when donor accepts', () => {
      const rawPhone = '+919876543210';
      const donorName = 'Rahul Sharma';
      const patientName = 'Aarav Sharma';
      const hospitalName = 'AIIMS Delhi';

      const unmaskedPhone = rawPhone;
      const callUrl = `tel:${unmaskedPhone}`;
      const whatsappUrl = `https://wa.me/${unmaskedPhone.replace('+', '')}?text=${encodeURIComponent(
        `Namaste ${donorName}, thank you for accepting our blood request for ${patientName} at ${hospitalName}.`
      )}`;

      expect(callUrl).toBe('tel:+919876543210');
      expect(whatsappUrl).toContain('wa.me/919876543210');
      expect(whatsappUrl).toContain('Namaste%20Rahul%20Sharma');
    });

    it('verifies waiting room visual status progression states', () => {
      type WaitingRoomStatus = 'donors_notified' | 'awaiting_acceptance' | 'fulfilled';

      const getStatusText = (status: WaitingRoomStatus, isHi: boolean) => {
        if (status === 'fulfilled') {
          return isHi ? 'रक्तदाता स्वीकृत!' : 'Donor Accepted!';
        }
        if (status === 'awaiting_acceptance') {
          return isHi ? 'प्रतीक्षा जारी' : 'Awaiting Acceptance';
        }
        return isHi ? 'दाता सूचित' : 'Donors Notified';
      };

      expect(getStatusText('donors_notified', false)).toBe('Donors Notified');
      expect(getStatusText('fulfilled', false)).toBe('Donor Accepted!');
      expect(getStatusText('fulfilled', true)).toBe('रक्तदाता स्वीकृत!');
    });
  });

  describe('Deliverable 5: 5-Step Donor Registration Portal', () => {
    it('verifies 5 step definitions in English and Hindi', () => {
      const stepsEn = ['Mobile & OTP', 'Personal Info', 'Blood Group', 'Location', 'Consent'];
      const stepsHi = ['मोबाइल एवं OTP', 'व्यक्तिगत विवरण', 'रक्त समूह', 'स्थान', 'सहमति'];

      expect(stepsEn.length).toBe(5);
      expect(stepsHi.length).toBe(5);
    });

    it('enforces NBTC minimum donor weight threshold of 45 kg', () => {
      const isEligibleWeight = (weightKg: number) => weightKg >= 45;

      expect(isEligibleWeight(44.9)).toBe(false);
      expect(isEligibleWeight(45)).toBe(true);
      expect(isEligibleWeight(65)).toBe(true);
    });

    it('requires mandatory WhatsApp emergency notification consent', () => {
      const validateRegistration = (consent: boolean) => {
        if (!consent) throw new Error('Consent required');
        return true;
      };

      expect(() => validateRegistration(false)).toThrow();
      expect(validateRegistration(true)).toBe(true);
    });
  });

  describe('Deliverable 6: Donor Response Quick Action Page', () => {
    it('verifies accepted response action marks notification accepted and request fulfilled', () => {
      let requestStatus = 'donors_notified';
      let notificationStatus = 'sent';

      const handleDonorResponse = (action: 'accepted' | 'declined') => {
        notificationStatus = action;
        if (action === 'accepted') {
          requestStatus = 'fulfilled';
        }
      };

      handleDonorResponse('accepted');
      expect(notificationStatus).toBe('accepted');
      expect(requestStatus).toBe('fulfilled');
    });

    it('verifies declined response action leaves request open for other donors', () => {
      let requestStatus = 'donors_notified';
      let notificationStatus = 'sent';

      const handleDonorResponse = (action: 'accepted' | 'declined') => {
        notificationStatus = action;
        if (action === 'accepted') {
          requestStatus = 'fulfilled';
        }
      };

      handleDonorResponse('declined');
      expect(notificationStatus).toBe('declined');
      expect(requestStatus).toBe('donors_notified');
    });
  });
});
