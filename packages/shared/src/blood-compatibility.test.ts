import { describe, expect, it } from 'bun:test';
import {
  RBC_COMPATIBILITY,
  getCompatibleDonorGroups,
  getCompatibleRecipientGroups,
  isDonorCompatible,
} from './blood-compatibility';
import { BLOOD_GROUPS, type BloodGroup } from './constants';

describe('Blood Compatibility Matrix', () => {
  it('defines compatibility for all 8 standard blood groups', () => {
    for (const group of BLOOD_GROUPS) {
      expect(RBC_COMPATIBILITY[group]).toBeDefined();
      expect(Array.isArray(RBC_COMPATIBILITY[group])).toBe(true);
      expect(RBC_COMPATIBILITY[group].length).toBeGreaterThan(0);
    }
  });

  describe('Universal Donor (O-)', () => {
    it('O- can donate RBC to all 8 blood groups', () => {
      for (const recipient of BLOOD_GROUPS) {
        expect(isDonorCompatible('O-', recipient)).toBe(true);
      }
    });

    it('O- recipient can only receive from O-', () => {
      const compatible = getCompatibleDonorGroups('O-');
      expect(compatible).toEqual(['O-']);
      for (const donor of BLOOD_GROUPS) {
        if (donor === 'O-') {
          expect(isDonorCompatible(donor, 'O-')).toBe(true);
        } else {
          expect(isDonorCompatible(donor, 'O-')).toBe(false);
        }
      }
    });
  });

  describe('Universal Recipient (AB+)', () => {
    it('AB+ can receive RBC from all 8 blood groups', () => {
      const compatible = getCompatibleDonorGroups('AB+');
      expect(compatible.length).toBe(8);
      for (const donor of BLOOD_GROUPS) {
        expect(isDonorCompatible(donor, 'AB+')).toBe(true);
      }
    });

    it('AB+ can only donate to AB+', () => {
      const recipients = getCompatibleRecipientGroups('AB+');
      expect(recipients).toEqual(['AB+']);
      for (const recipient of BLOOD_GROUPS) {
        if (recipient === 'AB+') {
          expect(isDonorCompatible('AB+', recipient)).toBe(true);
        } else {
          expect(isDonorCompatible('AB+', recipient)).toBe(false);
        }
      }
    });
  });

  describe('Specific RBC rules', () => {
    it('A+ recipient can receive from A+, A-, O+, O-', () => {
      const donors = getCompatibleDonorGroups('A+');
      expect(donors).toEqual(['A+', 'A-', 'O+', 'O-']);
      expect(isDonorCompatible('A+', 'A+')).toBe(true);
      expect(isDonorCompatible('A-', 'A+')).toBe(true);
      expect(isDonorCompatible('O+', 'A+')).toBe(true);
      expect(isDonorCompatible('O-', 'A+')).toBe(true);
      expect(isDonorCompatible('B+', 'A+')).toBe(false);
      expect(isDonorCompatible('B-', 'A+')).toBe(false);
      expect(isDonorCompatible('AB+', 'A+')).toBe(false);
      expect(isDonorCompatible('AB-', 'A+')).toBe(false);
    });

    it('A- recipient can receive from A-, O- only', () => {
      const donors = getCompatibleDonorGroups('A-');
      expect(donors).toEqual(['A-', 'O-']);
      expect(isDonorCompatible('A-', 'A-')).toBe(true);
      expect(isDonorCompatible('O-', 'A-')).toBe(true);
      expect(isDonorCompatible('A+', 'A-')).toBe(false);
      expect(isDonorCompatible('O+', 'A-')).toBe(false);
    });

    it('B+ recipient can receive from B+, B-, O+, O-', () => {
      const donors = getCompatibleDonorGroups('B+');
      expect(donors).toEqual(['B+', 'B-', 'O+', 'O-']);
      expect(isDonorCompatible('B+', 'B+')).toBe(true);
      expect(isDonorCompatible('B-', 'B+')).toBe(true);
      expect(isDonorCompatible('O+', 'B+')).toBe(true);
      expect(isDonorCompatible('O-', 'B+')).toBe(true);
      expect(isDonorCompatible('A+', 'B+')).toBe(false);
      expect(isDonorCompatible('AB+', 'B+')).toBe(false);
    });

    it('B- recipient can receive from B-, O- only', () => {
      const donors = getCompatibleDonorGroups('B-');
      expect(donors).toEqual(['B-', 'O-']);
      expect(isDonorCompatible('B-', 'B-')).toBe(true);
      expect(isDonorCompatible('O-', 'B-')).toBe(true);
      expect(isDonorCompatible('B+', 'B-')).toBe(false);
    });

    it('AB- recipient can receive from AB-, A-, B-, O-', () => {
      const donors = getCompatibleDonorGroups('AB-');
      expect(donors).toEqual(['AB-', 'A-', 'B-', 'O-']);
      expect(isDonorCompatible('AB-', 'AB-')).toBe(true);
      expect(isDonorCompatible('A-', 'AB-')).toBe(true);
      expect(isDonorCompatible('B-', 'AB-')).toBe(true);
      expect(isDonorCompatible('O-', 'AB-')).toBe(true);
      expect(isDonorCompatible('A+', 'AB-')).toBe(false);
      expect(isDonorCompatible('B+', 'AB-')).toBe(false);
      expect(isDonorCompatible('AB+', 'AB-')).toBe(false);
    });

    it('O+ recipient can receive from O+, O- only', () => {
      const donors = getCompatibleDonorGroups('O+');
      expect(donors).toEqual(['O+', 'O-']);
      expect(isDonorCompatible('O+', 'O+')).toBe(true);
      expect(isDonorCompatible('O-', 'O+')).toBe(true);
      expect(isDonorCompatible('A+', 'O+')).toBe(false);
      expect(isDonorCompatible('B+', 'O+')).toBe(false);
    });
  });

  describe('Edge cases and safety', () => {
    it('returns empty array for invalid recipient group', () => {
      expect(getCompatibleDonorGroups('X+' as BloodGroup)).toEqual([]);
      expect(getCompatibleDonorGroups('')).toEqual([]);
    });

    it('returns false for unknown donor or recipient', () => {
      expect(isDonorCompatible('Unknown', 'A+')).toBe(false);
      expect(isDonorCompatible('A+', 'Unknown')).toBe(false);
    });

    it('getCompatibleRecipientGroups returns all recipients for O-', () => {
      const recipients = getCompatibleRecipientGroups('O-');
      expect(recipients.length).toBe(8);
      expect(recipients).toContain('O-');
      expect(recipients).toContain('AB+');
    });
  });
});
