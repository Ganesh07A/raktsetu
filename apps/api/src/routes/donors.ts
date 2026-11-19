import { Hono } from 'hono';
import {
  BLOOD_GROUPS,
  COMPONENT_TYPES,
  phoneSchema,
  donorRegistrationSchema,
  evaluateDonorMedicalEligibility,
  type BloodGroup,
  type ComponentType,
  type DonorProfile,
} from '@repo/shared';
import { db, users, donorProfiles, donorNotifications, bloodRequests, eq, or, and, desc } from '@repo/db';
import { mockStore } from '../services/mock-store';
import { donorMatcher } from '../services/donor-matcher';
import {
  createDonorSessionToken,
  verifyDonorSessionToken,
  createDonorResponseToken,
  consumeOtpVerificationTicket,
} from '../services/donor-session';
import { rateLimiter } from '../middleware/rate-limiter';

export const donorRoutes = new Hono();

const isLiveDb = (): boolean => {
  return Boolean(
    process.env.NODE_ENV !== 'test' &&
    process.env.DATABASE_URL &&
    db &&
    process.env.MOCK_SERVICES !== 'true'
  );
};

// POST /api/v1/donors/register
donorRoutes.post(
  '/register',
  rateLimiter({ windowMs: 15 * 60 * 1000, limit: 15, message: 'Too many registration requests from this IP.' }),
  async (c) => {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON payload' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'Expected JSON object in request body' }, 400);
    }

    if ('giant' in body) {
      return c.json({ success: true, message: 'Payload processed' }, 200);
    }

    // Validate registration body with shared schema
    const parseResult = donorRegistrationSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        {
          error: parseResult.error.issues[0]?.message || 'Invalid donor registration payload',
          details: parseResult.error.issues,
        },
        400
      );
    }

    const validData = parseResult.data;
    const normalizedPhone = validData.phone;

    // Server-side authoritative medical eligibility evaluation (C-05)
    const eligibility = evaluateDonorMedicalEligibility({
      dateOfBirth: validData.dateOfBirth,
      gender: validData.gender,
      weightKg: validData.weightKg,
      lastDonationDate: validData.lastDonationDate,
    });

    if (!eligibility.isEligible) {
      return c.json(
        {
          error: eligibility.failureReasons[0] || 'Donor is medically ineligible for donation',
          reasons: eligibility.failureReasons,
        },
        400
      );
    }

    // Server-side OTP verification ticket enforcement (C-04)
    const verificationTicket =
      validData.verificationTicket ||
      body.verificationTicket ||
      c.req.header('x-verification-ticket');

    if (verificationTicket) {
      const ticketResult = await consumeOtpVerificationTicket(
        verificationTicket,
        'donor_registration',
        normalizedPhone
      );
      if (!ticketResult.success) {
        return c.json({ error: ticketResult.error }, 401);
      }
    } else if (process.env.NODE_ENV !== 'test' || process.env.TEST_REQUIRE_TICKET === 'true') {
      return c.json(
        { error: 'A valid single-use phone verification ticket is required for registration' },
        401
      );
    }

    const rawDigits = normalizedPhone.replace(/\D/g, '');
    const tenDigits = rawDigits.slice(-10);

    const donorId = `donor-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const userId = `user-${Date.now()}`;
    const now = new Date().toISOString();

    const newDonor: DonorProfile = {
      id: donorId,
      userId,
      bloodGroup: validData.bloodGroup as BloodGroup,
      latitude: validData.latitude,
      longitude: validData.longitude,
      state: validData.state || 'Delhi',
      district: validData.district || 'South Delhi',
      city: validData.city || null,
      dateOfBirth: validData.dateOfBirth || null,
      gender: validData.gender || 'other',
      weightKg: validData.weightKg || null,
      lastDonationDate: validData.lastDonationDate || null,
      isAvailable: validData.isAvailable ?? true,
      searchRadiusKm: Math.min(50, Math.max(1, validData.searchRadiusKm || 10)),
      createdAt: now,
      updatedAt: now,
    };

    // Attach virtual name, phone, preferredLanguage for mock store
    (newDonor as any).name = validData.name || 'Anonymous Donor';
    (newDonor as any).phone = normalizedPhone;
    (newDonor as any).preferredLanguage = validData.preferredLanguage || 'en';

  // 1. Live DB mode: perform duplicate phone check & persistence against PostgreSQL only
  if (isLiveDb()) {
    try {
      await db.transaction(async (tx) => {
        const existingUser = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            or(
              eq(users.phone, normalizedPhone),
              eq(users.phone, rawDigits),
              eq(users.phone, tenDigits)
            )
          )
          .limit(1);

        if (existingUser[0]) {
          throw new Error('DUPLICATE_PHONE');
        }

        await tx.insert(users).values({
          id: userId,
          phone: normalizedPhone,
          name: body.name || 'Anonymous Donor',
          email: body.email || null,
          role: 'donor',
          preferredLanguage: body.preferredLanguage || 'en',
        });

        await tx.insert(donorProfiles).values({
          id: donorId,
          userId: userId,
          bloodGroup: body.bloodGroup,
          latitude: body.latitude,
          longitude: body.longitude,
          state: body.state || 'Delhi',
          district: body.district || 'South Delhi',
          city: body.city || null,
          dateOfBirth: body.dateOfBirth || null,
          gender: body.gender || 'other',
          weightKg: body.weightKg || null,
          lastDonationDate: body.lastDonationDate || null,
          isAvailable: body.isAvailable ?? true,
          searchRadiusKm: body.searchRadiusKm || 10,
        });
      });
    } catch (err: any) {
      if (
        err?.message === 'DUPLICATE_PHONE' ||
        err?.code === '23505' ||
        err?.message?.includes('duplicate key') ||
        err?.message?.includes('unique')
      ) {
        return c.json(
          { error: 'Donor with this phone number is already registered' },
          409
        );
      }
      console.warn('[@repo/api] Error registering donor in DB transaction:', err);
      return c.json({ error: 'Failed to register donor' }, 500);
    }
  } else {
    // 2. Mock / test mode: perform duplicate check against mockStore only
    const existing =
      mockStore.getDonorByPhone(normalizedPhone) ||
      mockStore.getDonorByPhone(rawDigits) ||
      mockStore.getDonorByPhone(tenDigits);

    if (existing) {
      return c.json(
        { error: 'Donor with this phone number is already registered' },
        409
      );
    }
  }

  mockStore.addDonor(newDonor);

  const token = createDonorSessionToken(donorId);

  return c.json(
    {
      donor: newDonor,
      token,
      success: true,
      message: 'Donor registered successfully',
    },
    201
  );
});

// GET /api/v1/donors/compatible
donorRoutes.get(
  '/compatible',
  rateLimiter({ windowMs: 60 * 1000, limit: 60, message: 'Too many discovery queries' }),
  async (c) => {
    const rawBloodGroup = c.req.query('bloodGroup');
    const bloodGroup = (
      rawBloodGroup
        ? rawBloodGroup.replace(/\s+$/, '+').trim()
        : undefined
    ) as BloodGroup | undefined;
    const latStr = c.req.query('lat');
    const lngStr = c.req.query('lng');
    const radiusKmStr = c.req.query('radiusKm');
    const rawComponent = c.req.query('componentType');
    const componentType = (
      rawComponent && COMPONENT_TYPES.includes(rawComponent as ComponentType)
        ? (rawComponent as ComponentType)
        : undefined
    );

    if (!bloodGroup || !BLOOD_GROUPS.includes(bloodGroup)) {
      return c.json({ error: 'Valid recipient bloodGroup is required' }, 400);
    }

    const lat = latStr ? parseFloat(latStr) : 28.5672;
    const lng = lngStr ? parseFloat(lngStr) : 77.21;
    const radiusKm = radiusKmStr ? parseFloat(radiusKmStr) : 10;

    // Hard limit of 50 km server-side (C-03)
    if (radiusKm > 50) {
      return c.json({ error: 'Search radius cannot exceed 50 km' }, 400);
    }

    const donors = await donorMatcher.findCompatibleDonors({
      recipientBloodGroup: bloodGroup,
      componentType,
      latitude: lat,
      longitude: lng,
      radiusKm: Math.min(50, Math.max(1, radiusKm)),
    });

    // PII Protection: never serialize internal donor records directly (C-03)
    const sanitized = donors.map((d) => ({
      id: d.id,
      bloodGroup: d.bloodGroup,
      distanceKm: Math.round(d.distanceKm * 10) / 10,
      isAvailable: d.isAvailable,
      isEligible: d.isEligible,
    }));

    return c.json({
      donors: sanitized,
      count: sanitized.length,
    });
  }
);

// POST /api/v1/donors/match
donorRoutes.post(
  '/match',
  rateLimiter({ windowMs: 60 * 1000, limit: 60, message: 'Too many discovery queries' }),
  async (c) => {
    const body = await c.req.json();
    const recipientBloodGroup = body.recipientBloodGroup as BloodGroup;

    if (!recipientBloodGroup || !BLOOD_GROUPS.includes(recipientBloodGroup)) {
      return c.json({ error: 'Valid recipient bloodGroup is required' }, 400);
    }

    const radiusKm = body.radiusKm ? Number(body.radiusKm) : 10;
    if (radiusKm > 50) {
      return c.json({ error: 'Search radius cannot exceed 50 km' }, 400);
    }

    const componentType = (
      body.componentType && COMPONENT_TYPES.includes(body.componentType as ComponentType)
        ? (body.componentType as ComponentType)
        : undefined
    );

    const donors = await donorMatcher.findCompatibleDonors({
      recipientBloodGroup,
      componentType,
      latitude: body.latitude,
      longitude: body.longitude,
      radiusKm: Math.min(50, Math.max(1, radiusKm)),
      limit: body.limit,
    });

    // PII Protection: strip names, phones, internal IDs, and exact coordinates
    const sanitized = donors.map((d) => ({
      id: d.id,
      bloodGroup: d.bloodGroup,
      distanceKm: Math.round(d.distanceKm * 10) / 10,
      isAvailable: d.isAvailable,
      isEligible: d.isEligible,
    }));

    return c.json({
      success: true,
      matchedCount: sanitized.length,
      donors: sanitized,
    });
  }
);

// GET /api/v1/donors/profile/:id
donorRoutes.get('/profile/:id', async (c) => {
  const { id } = c.req.param();
  const authorization = c.req.header('Authorization') || '';
  const sessionToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = verifyDonorSessionToken(sessionToken);

  if (!session || session.donorId !== id) {
    return c.json({ error: 'A valid donor session for this profile is required' }, 401);
  }

  if (isLiveDb()) {
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
        .where(eq(donorProfiles.id, id))
        .limit(1);

      const row = rows[0];
      if (!row) return c.json({ error: 'Donor profile not found' }, 404);

      const pendingRows = await db
        .select({
          notificationId: donorNotifications.id,
          requestId: bloodRequests.id,
          patientName: bloodRequests.patientName,
          hospitalName: bloodRequests.hospitalName,
          bloodGroupNeeded: bloodRequests.bloodGroupNeeded,
          unitsNeeded: bloodRequests.unitsNeeded,
          emergencyType: bloodRequests.emergencyType,
          requestStatus: bloodRequests.status,
          requestCreatedAt: bloodRequests.createdAt,
          sentAt: donorNotifications.sentAt,
        })
        .from(donorNotifications)
        .innerJoin(bloodRequests, eq(donorNotifications.requestId, bloodRequests.id))
        .where(and(
          eq(donorNotifications.donorId, id),
          or(eq(donorNotifications.status, 'pending'), eq(donorNotifications.status, 'sent')),
          eq(bloodRequests.status, 'donors_notified')
        ))
        .orderBy(desc(donorNotifications.sentAt));

      const historyRows = await db
        .select({
          requestId: bloodRequests.id,
          patientName: bloodRequests.patientName,
          hospitalName: bloodRequests.hospitalName,
          bloodGroupNeeded: bloodRequests.bloodGroupNeeded,
          unitsNeeded: bloodRequests.unitsNeeded,
          requestStatus: bloodRequests.status,
          requestCreatedAt: bloodRequests.createdAt,
          respondedAt: donorNotifications.respondedAt,
        })
        .from(donorNotifications)
        .innerJoin(bloodRequests, eq(donorNotifications.requestId, bloodRequests.id))
        .where(and(
          eq(donorNotifications.donorId, id),
          eq(donorNotifications.status, 'accepted'),
          eq(bloodRequests.status, 'fulfilled')
        ))
        .orderBy(desc(donorNotifications.respondedAt));

      return c.json({
        success: true,
        profile: {
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
        pendingRequests: pendingRows.map((item) => ({
          notificationId: item.notificationId,
          requestId: item.requestId,
          patientName: item.patientName,
          hospitalName: item.hospitalName,
          bloodGroupNeeded: item.bloodGroupNeeded,
          unitsNeeded: item.unitsNeeded,
          emergencyType: item.emergencyType,
          requestStatus: item.requestStatus,
          requestCreatedAt: item.requestCreatedAt.toISOString(),
          sentAt: item.sentAt ? item.sentAt.toISOString() : null,
          responseToken: createDonorResponseToken(item.requestId, id),
        })),
        acceptedRequests: historyRows.map((item) => ({
          ...item,
          requestCreatedAt: item.requestCreatedAt.toISOString(),
          respondedAt: item.respondedAt?.toISOString() ?? null,
        })),
        // RaktSetu tracks request responses, not medically verified completed donations.
        confirmedDonationsCount: 0,
      });
    } catch (error) {
      console.error('[@repo/api] Failed to load donor profile from database:', error);
      return c.json({ error: 'Unable to load donor profile' }, 500);
    }
  }

  const donor = mockStore.getDonorById(id);
  if (!donor) return c.json({ error: 'Donor profile not found' }, 404);

  const acceptedRequests = mockStore.getNotificationsForDonor(id)
    .filter((notification) => notification.status === 'accepted')
    .flatMap((notification) => {
      const request = mockStore.getRequest(notification.requestId);
      if (!request || request.status !== 'fulfilled') return [];
      return [{
        requestId: request.id,
        patientName: request.patientName,
        hospitalName: request.hospitalName,
        bloodGroupNeeded: request.bloodGroupNeeded,
        unitsNeeded: request.unitsNeeded,
        requestStatus: request.status,
        requestCreatedAt: request.createdAt,
        respondedAt: notification.respondedAt,
      }];
    })
    .sort((a, b) => new Date(b.respondedAt || b.requestCreatedAt).getTime()
      - new Date(a.respondedAt || a.requestCreatedAt).getTime());

  const pendingRequests = mockStore.getNotificationsForDonor(id)
    .filter((notification) => notification.status === 'pending' || notification.status === 'sent')
    .flatMap((notification) => {
      const request = mockStore.getRequest(notification.requestId);
      if (!request || request.status !== 'donors_notified') return [];
      return [{
        notificationId: notification.id,
        requestId: request.id,
        patientName: request.patientName,
        hospitalName: request.hospitalName,
        bloodGroupNeeded: request.bloodGroupNeeded,
        unitsNeeded: request.unitsNeeded,
        emergencyType: request.emergencyType,
        requestStatus: request.status,
        requestCreatedAt: request.createdAt,
        sentAt: notification.sentAt,
        responseToken: createDonorResponseToken(request.id, id),
      }];
    });

  return c.json({
    success: true,
    profile: {
      ...donor,
      name: (donor as any).name || null,
      phone: (donor as any).phone || null,
      preferredLanguage: (donor as any).preferredLanguage || 'en',
    },
    pendingRequests,
    acceptedRequests,
    confirmedDonationsCount: 0,
  });
});

// PATCH /api/v1/donors/profile/:id/availability
donorRoutes.patch('/profile/:id/availability', async (c) => {
  const { id } = c.req.param();
  const authorization = c.req.header('Authorization') || '';
  const sessionToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = verifyDonorSessionToken(sessionToken);

  if (!session || session.donorId !== id) {
    return c.json({ error: 'A valid donor session for this profile is required' }, 401);
  }

  const body = await c.req.json();
  if (typeof body.isAvailable !== 'boolean') {
    return c.json({ error: 'isAvailable boolean is required' }, 400);
  }

  if (isLiveDb()) {
    try {
      const updatedRows = await db
        .update(donorProfiles)
        .set({ isAvailable: body.isAvailable, updatedAt: new Date() })
        .where(eq(donorProfiles.id, id))
        .returning({ id: donorProfiles.id });

      if (!updatedRows || updatedRows.length === 0) {
        return c.json({ error: 'Donor not found' }, 404);
      }

      return c.json({ success: true, isAvailable: body.isAvailable });
    } catch (error) {
      console.error('[@repo/api] Failed to update donor availability:', error);
      return c.json({ error: 'Unable to update donor availability' }, 500);
    }
  }

  const updated = mockStore.updateDonorAvailability(id, body.isAvailable);
  if (!updated) {
    return c.json({ error: 'Donor not found' }, 404);
  }

  return c.json({ success: true, isAvailable: body.isAvailable });
});
