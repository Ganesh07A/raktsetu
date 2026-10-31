import {
  getCompatibleDonorGroups,
  haversineDistance,
  getBoundingBox,
  DONATION_INTERVAL_DAYS,
  type BloodGroup,
  type Gender,
  type DonorProfile,
} from '@repo/shared';
import { db, donorProfiles, donorPushSubscriptions, users, eq } from '@repo/db';
import { mockStore } from './mock-store';

export interface DonorEligibilityAssessment {
  eligible: boolean;
  daysSinceLastDonation: number | null;
  requiredIntervalDays: number;
  remainingDays: number;
  warningBadge: boolean;
  reason?: string;
}

export interface MatchedDonor {
  id: string;
  userId: string;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  gender: Gender | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isAvailable: boolean;
  lastDonationDate: string | null;
  isEligibleSoft: boolean;
  isEligible: boolean;
  cooldownRemainingDays: number;
  eligibilityWarning: string | null;
  eligibleBadge: DonorEligibilityAssessment;
  preferredLanguage?: 'en' | 'hi';
}

export interface DonorMatcherParams {
  recipientBloodGroup: BloodGroup;
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
  referenceDate?: Date;
}

export class DonorMatcherService {
  /**
   * Evaluate soft eligibility for a donor based on gender and last donation date
   */
  public evaluateEligibility(
    gender: Gender | string | null | undefined,
    lastDonationDate: string | null | undefined,
    referenceDate: Date = new Date()
  ): DonorEligibilityAssessment {
    const normGender = (gender || 'male').toLowerCase() as Gender;
    const requiredDays = DONATION_INTERVAL_DAYS[normGender] || 90;

    if (!lastDonationDate) {
      return {
        eligible: true,
        daysSinceLastDonation: null,
        requiredIntervalDays: requiredDays,
        remainingDays: 0,
        warningBadge: false,
      };
    }

    const lastDate = new Date(lastDonationDate);
    const diffTime = referenceDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < requiredDays) {
      const remainingDays = requiredDays - diffDays;
      return {
        eligible: false,
        daysSinceLastDonation: diffDays,
        requiredIntervalDays: requiredDays,
        remainingDays,
        warningBadge: true,
        reason: `Recent donation ${diffDays} days ago (< ${requiredDays} days required for ${gender ?? 'donor'})`,
      };
    }

    return {
      eligible: true,
      daysSinceLastDonation: diffDays,
      requiredIntervalDays: requiredDays,
      remainingDays: 0,
      warningBadge: false,
    };
  }

  /**
   * Find compatible donors within search radius
   */
  public async findCompatibleDonors(
    params: DonorMatcherParams
  ): Promise<MatchedDonor[]> {
    const {
      recipientBloodGroup,
      latitude,
      longitude,
      radiusKm = 10,
      limit,
      referenceDate = new Date(),
    } = params;

    const compatibleGroups = getCompatibleDonorGroups(recipientBloodGroup);

    // Candidates source: Try real Postgres DB if available, else mock store
    let candidateDonors: Array<
      DonorProfile & {
        name?: string;
        phone?: string;
        preferredLanguage?: 'en' | 'hi';
      }
    > = [];

    const isLiveDb = Boolean(
      process.env.NODE_ENV !== 'test' &&
      process.env.DATABASE_URL &&
      db &&
      process.env.MOCK_SERVICES !== 'true'
    );

    if (isLiveDb) {
      try {
        const rows = await db
          .select({
            id: donorProfiles.id,
            userId: donorProfiles.userId,
            bloodGroup: donorProfiles.bloodGroup,
            latitude: donorProfiles.latitude,
            longitude: donorProfiles.longitude,
            state: donorProfiles.state,
            district: donorProfiles.district,
            city: donorProfiles.city,
            dateOfBirth: donorProfiles.dateOfBirth,
            gender: donorProfiles.gender,
            weightKg: donorProfiles.weightKg,
            lastDonationDate: donorProfiles.lastDonationDate,
            isAvailable: donorProfiles.isAvailable,
            searchRadiusKm: donorProfiles.searchRadiusKm,
            createdAt: donorProfiles.createdAt,
            updatedAt: donorProfiles.updatedAt,
            name: users.name,
            phone: users.phone,
            preferredLanguage: users.preferredLanguage,
          })
          .from(donorProfiles)
          .innerJoin(users, eq(donorProfiles.userId, users.id))
          .innerJoin(donorPushSubscriptions, eq(donorPushSubscriptions.donorId, donorProfiles.id))
          .where(eq(donorProfiles.isAvailable, true));

        candidateDonors = [...new Map(rows.map((r) => [r.id, r])).values()].map((r) => ({
          id: r.id,
          userId: r.userId,
          bloodGroup: r.bloodGroup as BloodGroup,
          latitude: r.latitude,
          longitude: r.longitude,
          state: r.state,
          district: r.district,
          city: r.city,
          dateOfBirth: r.dateOfBirth,
          gender: r.gender as Gender | null,
          weightKg: r.weightKg,
          lastDonationDate: r.lastDonationDate,
          isAvailable: r.isAvailable,
          searchRadiusKm: r.searchRadiusKm,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          name: r.name ?? 'Volunteer Donor',
          phone: r.phone,
          preferredLanguage: (r.preferredLanguage as 'en' | 'hi') || 'en',
        }));
      } catch (err) {
        console.warn(
          '[@repo/api] Database query failed; falling back to mock store for donor matching:',
          err
        );
        candidateDonors = this.getCandidatesFromMockStore();
      }
    } else {
      candidateDonors = this.getCandidatesFromMockStore();
    }

    const matchedList: MatchedDonor[] = [];

    for (const donor of candidateDonors) {
      // 1. Availability and active push subscription are checked before matching.
      if (!donor.isAvailable) {
        continue;
      }

      // 2. ABO/Rh Compatibility filter
      if (!compatibleGroups.includes(donor.bloodGroup)) {
        continue;
      }

      // 3. Distance calculation
      const dist = haversineDistance(
        latitude,
        longitude,
        donor.latitude,
        donor.longitude
      );

      // Check within radius
      if (dist <= radiusKm) {
        // 4. Soft eligibility assessment
        const assessment = this.evaluateEligibility(
          donor.gender,
          donor.lastDonationDate,
          referenceDate
        );

        matchedList.push({
          id: donor.id,
          userId: donor.userId,
          name: donor.name || 'Volunteer Donor',
          phone: donor.phone || '+919999999999',
          bloodGroup: donor.bloodGroup,
          gender: donor.gender,
          latitude: donor.latitude,
          longitude: donor.longitude,
          distanceKm: dist,
          isAvailable: donor.isAvailable,
          lastDonationDate: donor.lastDonationDate,
          isEligibleSoft: assessment.eligible,
          isEligible: assessment.eligible,
          cooldownRemainingDays: assessment.remainingDays,
          eligibilityWarning: assessment.reason || null,
          eligibleBadge: assessment,
          preferredLanguage: donor.preferredLanguage || 'en',
        });
      }
    }

    // 5. Sort by distance ascending
    matchedList.sort((a, b) => a.distanceKm - b.distanceKm);

    if (limit && matchedList.length > limit) {
      return matchedList.slice(0, limit);
    }

    return matchedList;
  }

  private getCandidatesFromMockStore() {
    return mockStore.getDonors().filter((d) => mockStore.hasPushSubscription(d.id)).map((d) => {
      const anyD = d as any;
      return {
        ...d,
        name: anyD.name || 'Volunteer Donor',
        phone: anyD.phone || '+919876543210',
        preferredLanguage: (anyD.preferredLanguage as 'en' | 'hi') || 'en',
      };
    });
  }
}

export const donorMatcher = new DonorMatcherService();
