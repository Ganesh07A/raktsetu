import { describe, expect, it } from 'bun:test';
import {
  RBC_COMPATIBILITY,
  getCompatibleDonorGroups,
  getCompatibleRecipientGroups,
  isDonorCompatible,
} from './blood-compatibility';
import { BLOOD_GROUPS, type BloodGroup } from './constants';
import {
  getBoundingBox,
  haversineDistance,
  isWithinRadius,
  toRad,
} from './geo-utils';

/**
 * Independent Medical Ground Truth Oracle for Red Blood Cell (RBC) compatibility.
 * Based on ABO and Rh(D) antigen-antibody immunohematology:
 * 1. ABO Compatibility:
 *    - Recipient has antibodies against any ABO antigen they lack.
 *    - Donor RBCs must NOT carry antigens foreign to recipient.
 *    - Antigens: O has none, A has {A}, B has {B}, AB has {A, B}.
 *    - Invariant: donorAntigens is a subset of recipientAntigens.
 * 2. Rh(D) Compatibility:
 *    - Rh- recipient has or will form anti-D antibodies if exposed to Rh+ RBCs.
 *    - Rh- recipient can ONLY receive Rh- blood.
 *    - Rh+ recipient can receive both Rh+ and Rh- blood.
 */
function medicalOracleRBC(donor: string, recipient: string): boolean {
  const parseGroup = (group: string) => {
    const match = group.match(/^(A|B|AB|O)(\+|\-)$/);
    if (!match || !match[1] || !match[2]) return null;
    return {
      abo: match[1],
      rh: match[2],
    };
  };

  const donorParsed = parseGroup(donor);
  const recipientParsed = parseGroup(recipient);

  if (!donorParsed || !recipientParsed) return false;

  // Rule 1: Rh compatibility
  // Rh- recipients can NEVER receive Rh+ blood
  if (recipientParsed.rh === '-' && donorParsed.rh === '+') {
    return false;
  }

  // Rule 2: ABO compatibility
  const getAntigens = (abo: string): Set<string> => {
    if (abo === 'O') return new Set();
    if (abo === 'A') return new Set(['A']);
    if (abo === 'B') return new Set(['B']);
    if (abo === 'AB') return new Set(['A', 'B']);
    return new Set();
  };

  const donorAntigens = getAntigens(donorParsed.abo);
  const recipientAntigens = getAntigens(recipientParsed.abo);

  // Every antigen on donor RBC must exist on recipient RBC
  for (const antigen of donorAntigens) {
    if (!recipientAntigens.has(antigen)) {
      return false;
    }
  }

  return true;
}

describe('Empirical Adversarial Challenge: Milestone 1 Core Domain Logic', () => {
  describe('1. Adversarial Blood Compatibility Matrix Testing', () => {
    it('exhaustively tests all 64 recipient x donor pairs against medical immunohematology oracle', () => {
      let compatibleCount = 0;
      let incompatibleCount = 0;
      const discrepancyList: string[] = [];

      for (const recipient of BLOOD_GROUPS) {
        for (const donor of BLOOD_GROUPS) {
          const actualResult = isDonorCompatible(donor, recipient);
          const oracleResult = medicalOracleRBC(donor, recipient);

          if (actualResult !== oracleResult) {
            discrepancyList.push(
              `Mismatch for Donor: ${donor} -> Recipient: ${recipient}. Actual: ${actualResult}, Oracle: ${oracleResult}`
            );
          }

          if (actualResult) {
            compatibleCount++;
          } else {
            incompatibleCount++;
          }
        }
      }

      expect(discrepancyList).toEqual([]);
      // In medical immunohematology, exactly 27 of 64 combinations are RBC-compatible
      expect(compatibleCount).toBe(27);
      expect(incompatibleCount).toBe(37);
      expect(compatibleCount + incompatibleCount).toBe(64);
    });

    describe('Critical Medical Invariants', () => {
      it('Universal RBC Donor invariant: O- can donate to all 8 blood groups', () => {
        for (const recipient of BLOOD_GROUPS) {
          expect(isDonorCompatible('O-', recipient)).toBe(true);
        }
        const recipientsForONeg = getCompatibleRecipientGroups('O-');
        expect(recipientsForONeg.length).toBe(8);
        expect(recipientsForONeg.sort()).toEqual([...BLOOD_GROUPS].sort());
      });

      it('O- recipient restriction: O- can receive ONLY from O-', () => {
        const donorsForONeg = getCompatibleDonorGroups('O-');
        expect(donorsForONeg).toEqual(['O-']);
        for (const donor of BLOOD_GROUPS) {
          if (donor === 'O-') {
            expect(isDonorCompatible(donor, 'O-')).toBe(true);
          } else {
            expect(isDonorCompatible(donor, 'O-')).toBe(false);
          }
        }
      });

      it('Universal RBC Recipient invariant: AB+ can receive from all 8 blood groups', () => {
        const donorsForABPos = getCompatibleDonorGroups('AB+');
        expect(donorsForABPos.length).toBe(8);
        for (const donor of BLOOD_GROUPS) {
          expect(isDonorCompatible(donor, 'AB+')).toBe(true);
        }
      });

      it('AB+ donor restriction: AB+ can donate RBC ONLY to AB+', () => {
        const recipientsForABPos = getCompatibleRecipientGroups('AB+');
        expect(recipientsForABPos).toEqual(['AB+']);
        for (const recipient of BLOOD_GROUPS) {
          if (recipient === 'AB+') {
            expect(isDonorCompatible('AB+', recipient)).toBe(true);
          } else {
            expect(isDonorCompatible('AB+', recipient)).toBe(false);
          }
        }
      });

      it('Rh- Invariant: Rh- recipients can NEVER receive Rh+ blood (16 forbidden pairs)', () => {
        const rhNegativeRecipients: BloodGroup[] = ['O-', 'A-', 'B-', 'AB-'];
        const rhPositiveDonors: BloodGroup[] = ['O+', 'A+', 'B+', 'AB+'];

        for (const recipient of rhNegativeRecipients) {
          for (const donor of rhPositiveDonors) {
            const compatible = isDonorCompatible(donor, recipient);
            expect(compatible).toBe(false);
          }
        }
      });

      it('Self-compatibility: Every blood group is compatible with itself (8 pairs)', () => {
        for (const group of BLOOD_GROUPS) {
          expect(isDonorCompatible(group, group)).toBe(true);
          const donors = getCompatibleDonorGroups(group);
          expect(donors).toContain(group);
          // First preference should be identical match
          expect(donors[0]).toBe(group);
        }
      });

      it('Mathematical duality: isDonorCompatible(D, R) matches getCompatibleRecipientGroups(D)', () => {
        for (const donor of BLOOD_GROUPS) {
          const compatibleRecipients = getCompatibleRecipientGroups(donor);
          for (const recipient of BLOOD_GROUPS) {
            const isComp = isDonorCompatible(donor, recipient);
            expect(compatibleRecipients.includes(recipient)).toBe(isComp);
          }
        }
      });
    });

    describe('Adversarial & Malformed Blood Group Inputs', () => {
      const malformedInputs = [
        'C+',
        'O',
        'ab+',
        'A+ ',
        ' A+',
        'AB',
        'Rh+',
        'XY-',
        'o-',
        'a+',
        'b-',
        'ab-',
        'A++',
        'B+-',
        'null',
        'undefined',
        '',
        '   ',
        '!@#$',
        '123',
      ];

      it('getCompatibleDonorGroups returns empty array [] for all malformed inputs without throwing', () => {
        for (const input of malformedInputs) {
          expect(getCompatibleDonorGroups(input)).toEqual([]);
        }
        // Also test non-string types safely coerced or cast
        expect(getCompatibleDonorGroups(null as unknown as string)).toEqual([]);
        expect(
          getCompatibleDonorGroups(undefined as unknown as string)
        ).toEqual([]);
        expect(getCompatibleDonorGroups(123 as unknown as string)).toEqual([]);
        expect(getCompatibleDonorGroups({} as unknown as string)).toEqual([]);
      });

      it('isDonorCompatible returns false for any malformed donor or recipient', () => {
        for (const bad of malformedInputs) {
          // Malformed recipient with valid donor
          expect(isDonorCompatible('O-', bad)).toBe(false);
          // Malformed donor with valid recipient
          expect(isDonorCompatible(bad, 'AB+')).toBe(false);
          // Both malformed
          expect(isDonorCompatible(bad, bad)).toBe(false);
        }

        // Null and undefined
        expect(
          isDonorCompatible(
            null as unknown as string,
            'AB+'
          )
        ).toBe(false);
        expect(
          isDonorCompatible(
            'O-',
            undefined as unknown as string
          )
        ).toBe(false);
      });

      it('getCompatibleRecipientGroups returns empty array for malformed donors', () => {
        for (const bad of malformedInputs) {
          expect(getCompatibleRecipientGroups(bad)).toEqual([]);
        }
        expect(
          getCompatibleRecipientGroups(null as unknown as string)
        ).toEqual([]);
      });
    });
  });

  describe('2. Adversarial Geo-utils Testing', () => {
    describe('Haversine Formula on Extreme & Boundary Coordinates', () => {
      it('returns 0 for identical points at various latitudes', () => {
        expect(haversineDistance(0, 0, 0, 0)).toBe(0);
        expect(haversineDistance(90, 0, 90, 0)).toBe(0);
        expect(haversineDistance(-90, 0, -90, 0)).toBe(0);
        expect(haversineDistance(45.123, -120.456, 45.123, -120.456)).toBe(0);
      });

      it('computes antipodal points across the globe as ~20,015 km (half Earth circumference)', () => {
        const expectedCircumferenceHalf = Math.round(Math.PI * 6371 * 10) / 10; // ≈ 20015.1 km

        // Equator antipodes: (0, 0) to (0, 180)
        const dEquatorAntipode = haversineDistance(0, 0, 0, 180);
        expect(dEquatorAntipode).toBeCloseTo(expectedCircumferenceHalf, 0);
        expect(dEquatorAntipode).toBeGreaterThan(20010);
        expect(dEquatorAntipode).toBeLessThan(20020);

        // Polar antipodes: North pole (90, 0) to South pole (-90, 0)
        const dPoles = haversineDistance(90, 0, -90, 0);
        expect(dPoles).toBeCloseTo(expectedCircumferenceHalf, 0);

        // Arbitrary antipodes: (45, 60) to (-45, -120)
        const dArbitrary = haversineDistance(45, 60, -45, -120);
        expect(dArbitrary).toBeCloseTo(expectedCircumferenceHalf, 0);

        // Arbitrary antipodes: (28.6139, 77.209) to (-28.6139, -102.791)
        const dDelhiAntipode = haversineDistance(28.6139, 77.209, -28.6139, -102.791);
        expect(dDelhiAntipode).toBeCloseTo(expectedCircumferenceHalf, 0);
      });

      it('computes equator points correctly (quarter circumference ≈ 10,007.5 km)', () => {
        const expectedQuarter = Math.round((Math.PI / 2) * 6371 * 10) / 10; // ≈ 10007.5 km
        const dist = haversineDistance(0, 0, 0, 90);
        expect(dist).toBeCloseTo(expectedQuarter, 0);
        expect(dist).toBeGreaterThan(10000);
        expect(dist).toBeLessThan(10015);
      });

      it('handles polar singularities correctly (any longitude at pole = same point)', () => {
        // At North pole, moving longitude does not change the physical location
        const northPoleLon1 = haversineDistance(90, 0, 90, 90);
        const northPoleLon2 = haversineDistance(90, -180, 90, 180);
        expect(northPoleLon1).toBe(0);
        expect(northPoleLon2).toBe(0);

        // At South pole
        const southPoleLon1 = haversineDistance(-90, 0, -90, 120);
        expect(southPoleLon1).toBe(0);
      });

      it('correctly handles longitude wrapping across the International Date Line (179° to -179°)', () => {
        // Two points on equator separated by 2 degrees across antimeridian:
        // (0, 179) and (0, -179)
        // Expected distance: 2 degrees along equator = 2 * (2 * pi * 6371 / 360) ≈ 222.4 km
        const distAcrossDateline = haversineDistance(0, 179, 0, -179);
        const expected2Deg = Math.round(((2 * Math.PI * 6371) / 360) * 2 * 10) / 10;
        expect(distAcrossDateline).toBeCloseTo(expected2Deg, 1);
        expect(distAcrossDateline).toBeGreaterThan(220);
        expect(distAcrossDateline).toBeLessThan(225);

        // Close to date line: (10, 179.9) and (10, -179.9) -> 0.2 degrees
        const dSmall = haversineDistance(10, 179.9, 10, -179.9);
        expect(dSmall).toBeGreaterThan(20);
        expect(dSmall).toBeLessThan(25);
      });

      it('preserves metric properties: symmetry and triangle inequality', () => {
        const pA = { lat: 28.6139, lon: 77.209 }; // Delhi
        const pB = { lat: 19.076, lon: 72.8777 }; // Mumbai
        const pC = { lat: 12.9716, lon: 77.5946 }; // Bengaluru

        const dAB = haversineDistance(pA.lat, pA.lon, pB.lat, pB.lon);
        const dBA = haversineDistance(pB.lat, pB.lon, pA.lat, pA.lon);
        expect(dAB).toBe(dBA);

        const dBC = haversineDistance(pB.lat, pB.lon, pC.lat, pC.lon);
        const dAC = haversineDistance(pA.lat, pA.lon, pC.lat, pC.lon);

        // Triangle inequality: d(A, C) <= d(A, B) + d(B, C)
        expect(dAC).toBeLessThanOrEqual(dAB + dBC);
      });
    });

    describe('Bounding Box Calculations on Extreme Coordinates', () => {
      it('correctly computes bounding box for standard Indian cities', () => {
        const delhi = { lat: 28.6139, lon: 77.209 };
        const box = getBoundingBox(delhi.lat, delhi.lon, 10);

        expect(box.minLat).toBeLessThan(delhi.lat);
        expect(box.maxLat).toBeGreaterThan(delhi.lat);
        expect(box.minLon).toBeLessThan(delhi.lon);
        expect(box.maxLon).toBeGreaterThan(delhi.lon);

        // Verification that a point 5km away is strictly inside the 10km bounding box
        // 5km north: ~ 5 / 111 deg lat ≈ 0.045 deg
        const point5kmNorth = { lat: delhi.lat + 0.04, lon: delhi.lon };
        expect(point5kmNorth.lat).toBeGreaterThan(box.minLat);
        expect(point5kmNorth.lat).toBeLessThan(box.maxLat);
        expect(point5kmNorth.lon).toBeGreaterThanOrEqual(box.minLon);
        expect(point5kmNorth.lon).toBeLessThanOrEqual(box.maxLon);
      });

      it('prevents division by zero at poles using safeCosLat', () => {
        // At North pole (lat = 90)
        const northBox = getBoundingBox(90, 0, 10);
        expect(Number.isFinite(northBox.minLat)).toBe(true);
        expect(Number.isFinite(northBox.maxLat)).toBe(true);
        expect(Number.isFinite(northBox.minLon)).toBe(true);
        expect(Number.isFinite(northBox.maxLon)).toBe(true);
        expect(northBox.minLat).toBeLessThan(90);

        // At South pole (lat = -90)
        const southBox = getBoundingBox(-90, 0, 10);
        expect(Number.isFinite(southBox.minLat)).toBe(true);
        expect(Number.isFinite(southBox.maxLat)).toBe(true);
        expect(Number.isFinite(southBox.minLon)).toBe(true);
        expect(Number.isFinite(southBox.maxLon)).toBe(true);
      });

      it('observes bounding box behavior across International Date Line (180°)', () => {
        const boxAt180 = getBoundingBox(0, 180, 10);
        // Note: minLon < 180 and maxLon > 180 (unwrapped Cartesian box)
        expect(boxAt180.minLon).toBeLessThan(180);
        expect(boxAt180.maxLon).toBeGreaterThan(180);
        expect(Number.isFinite(boxAt180.minLon)).toBe(true);
        expect(Number.isFinite(boxAt180.maxLon)).toBe(true);
      });
    });
  });
});
