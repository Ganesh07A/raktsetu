import { describe, expect, it, beforeEach } from 'bun:test';
import { DonorMatcherService } from './donor-matcher';
import { mockStore } from './mock-store';

describe('DonorMatcherService', () => {
  let matcher: DonorMatcherService;

  beforeEach(() => {
    matcher = new DonorMatcherService();
    mockStore.reset();
  });

  describe('Soft Eligibility Assessment', () => {
    it('marks donor with no prior donation history as fully eligible', () => {
      const result = matcher.evaluateEligibility('male', null);
      expect(result.eligible).toBe(true);
      expect(result.warningBadge).toBe(false);
      expect(result.daysSinceLastDonation).toBeNull();
      expect(result.remainingDays).toBe(0);
    });

    it('enforces 90-day cooldown for male donors with warning badge but without excluding', () => {
      const refDate = new Date('2026-10-30T00:00:00Z');

      // Donated 30 days ago (< 90)
      const recent = matcher.evaluateEligibility('male', '2026-09-30', refDate);
      expect(recent.eligible).toBe(false);
      expect(recent.warningBadge).toBe(true);
      expect(recent.requiredIntervalDays).toBe(90);
      expect(recent.remainingDays).toBe(60);
      expect(recent.reason).toContain('Recent donation');

      // Donated 100 days ago (>= 90)
      const eligible = matcher.evaluateEligibility('male', '2026-07-22', refDate);
      expect(eligible.eligible).toBe(true);
      expect(eligible.warningBadge).toBe(false);
      expect(eligible.remainingDays).toBe(0);
    });

    it('enforces 120-day cooldown for female donors with warning badge', () => {
      const refDate = new Date('2026-10-30T00:00:00Z');

      // Donated 100 days ago (< 120 for female)
      const recent = matcher.evaluateEligibility('female', '2026-07-22', refDate);
      expect(recent.eligible).toBe(false);
      expect(recent.warningBadge).toBe(true);
      expect(recent.requiredIntervalDays).toBe(120);
      expect(recent.remainingDays).toBe(20);

      // Donated 130 days ago (>= 120)
      const eligible = matcher.evaluateEligibility('female', '2026-06-22', refDate);
      expect(eligible.eligible).toBe(true);
      expect(eligible.warningBadge).toBe(false);
    });
  });

  describe('Geographic & RBC Compatibility Matching', () => {
    it('finds compatible donors for O- (only O- donors compatible)', async () => {
      const matches = await matcher.findCompatibleDonors({
        recipientBloodGroup: 'O-',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });

      expect(matches.length).toBeGreaterThan(0);
      for (const donor of matches) {
        expect(donor.bloodGroup).toBe('O-');
        expect(donor.isAvailable).toBe(true);
        expect(donor.whatsappConsent).toBe(true);
        expect(donor.distanceKm).toBeLessThanOrEqual(10);
      }
    });

    it('finds all compatible donor groups for AB+ universal recipient', async () => {
      const matches = await matcher.findCompatibleDonors({
        recipientBloodGroup: 'AB+',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });

      expect(matches.length).toBeGreaterThan(0);
      const groups = new Set(matches.map((m) => m.bloodGroup));
      // Should include various compatible groups like A+, B+, O-, etc.
      expect(groups.size).toBeGreaterThan(1);
    });

    it('preserves soft-ineligible donors with warning flags without filtering them out', async () => {
      const matches = await matcher.findCompatibleDonors({
        recipientBloodGroup: 'A+',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });

      const neha = matches.find((m) => m.id === 'donor-neha-recent-warning');
      expect(neha).toBeDefined();
      expect(neha?.isEligibleSoft).toBe(false);
      expect(neha?.eligibleBadge.warningBadge).toBe(true);
      expect(neha?.cooldownRemainingDays).toBeGreaterThan(0);
      expect(neha?.eligibilityWarning).toBeDefined();
    });

    it('strictly excludes donors with isAvailable === false', async () => {
      const matches = await matcher.findCompatibleDonors({
        recipientBloodGroup: 'A+',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });

      const unavailable = matches.find((m) => m.id === 'donor-rajesh-unavailable');
      expect(unavailable).toBeUndefined();
    });

    it('strictly excludes donors with whatsappConsent === false', async () => {
      const matches = await matcher.findCompatibleDonors({
        recipientBloodGroup: 'A+',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 10,
      });

      const noConsent = matches.find((m) => m.id === 'donor-manish-no-consent');
      expect(noConsent).toBeUndefined();
    });

    it('sorts donors by distance ascending (nearest first)', async () => {
      const matches = await matcher.findCompatibleDonors({
        recipientBloodGroup: 'A+',
        latitude: 28.5672,
        longitude: 77.21,
        radiusKm: 50,
      });

      expect(matches.length).toBeGreaterThan(1);
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i]!.distanceKm).toBeLessThanOrEqual(matches[i + 1]!.distanceKm);
      }
    });
  });
});
