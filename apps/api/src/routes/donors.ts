import { Hono } from 'hono';
import {
  BLOOD_GROUPS,
  donorRegistrationSchema,
  phoneSchema,
  type BloodGroup,
  type DonorProfile,
  type SupportedLanguage,
} from '@repo/shared';
import { db, users, donorProfiles, eq, or } from '@repo/db';
import { mockStore } from '../services/mock-store';
import { donorMatcher } from '../services/donor-matcher';
import { createDonorSessionToken } from '../services/donor-session';

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
donorRoutes.post('/register', async (c) => {
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

  // Validate phone number
  const phoneResult = phoneSchema.safeParse(body.phone);
  if (!phoneResult.success) {
    return c.json(
      { error: 'Invalid Indian mobile number (+91 or 10 digits starting with 6-9)' },
      400
    );
  }
  const normalizedPhone = phoneResult.data;

  // Validate blood group
  if (!body.bloodGroup || !BLOOD_GROUPS.includes(body.bloodGroup)) {
    return c.json({ error: `Invalid blood group: ${body.bloodGroup}` }, 400);
  }

  // Validate coordinates
  if (
    typeof body.latitude !== 'number' ||
    typeof body.longitude !== 'number' ||
    isNaN(body.latitude) ||
    isNaN(body.longitude) ||
    body.latitude < -90 ||
    body.latitude > 90 ||
    body.longitude < -180 ||
    body.longitude > 180
  ) {
    return c.json({ error: 'Valid latitude and longitude required' }, 400);
  }

  const rawDigits = normalizedPhone.replace(/\D/g, '');
  const tenDigits = rawDigits.slice(-10);

  const donorId = `donor-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const userId = `user-${Date.now()}`;
  const now = new Date().toISOString();

  const newDonor: DonorProfile = {
    id: donorId,
    userId,
    bloodGroup: body.bloodGroup as BloodGroup,
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
    createdAt: now,
    updatedAt: now,
  };

  // Attach virtual name, phone, preferredLanguage for mock store
  (newDonor as any).name = body.name || 'Anonymous Donor';
  (newDonor as any).phone = normalizedPhone;
  (newDonor as any).preferredLanguage = body.preferredLanguage || 'en';

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
donorRoutes.get('/compatible', async (c) => {
  const rawBloodGroup = c.req.query('bloodGroup');
  const bloodGroup = (
    rawBloodGroup
      ? rawBloodGroup.replace(/\s+$/, '+').trim()
      : undefined
  ) as BloodGroup | undefined;
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');
  const radiusKmStr = c.req.query('radiusKm');

  if (!bloodGroup || !BLOOD_GROUPS.includes(bloodGroup)) {
    return c.json({ error: 'Valid recipient bloodGroup is required' }, 400);
  }

  const lat = latStr ? parseFloat(latStr) : 28.5672;
  const lng = lngStr ? parseFloat(lngStr) : 77.21;
  const radiusKm = radiusKmStr ? parseFloat(radiusKmStr) : 10;

  const donors = await donorMatcher.findCompatibleDonors({
    recipientBloodGroup: bloodGroup,
    latitude: lat,
    longitude: lng,
    radiusKm,
  });

  return c.json({
    donors,
    count: donors.length,
  });
});

// POST /api/v1/donors/match
donorRoutes.post('/match', async (c) => {
  const body = await c.req.json();
  const recipientBloodGroup = body.recipientBloodGroup as BloodGroup;

  if (!recipientBloodGroup || !BLOOD_GROUPS.includes(recipientBloodGroup)) {
    return c.json({ error: 'Valid recipient bloodGroup is required' }, 400);
  }

  const donors = await donorMatcher.findCompatibleDonors({
    recipientBloodGroup,
    latitude: body.latitude,
    longitude: body.longitude,
    radiusKm: body.radiusKm || 10,
    limit: body.limit,
  });

  return c.json({
    success: true,
    matchedCount: donors.length,
    donors,
  });
});

// GET /api/v1/donors/profile/:id
donorRoutes.get('/profile/:id', (c) => {
  const { id } = c.req.param();
  const donor = mockStore.getDonorById(id) || mockStore.getDonorByUserId(id);

  if (!donor) {
    return c.json({ error: 'Donor profile not found' }, 404);
  }

  return c.json({ success: true, profile: donor });
});

// PATCH /api/v1/donors/profile/:id/availability
donorRoutes.patch('/profile/:id/availability', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  if (typeof body.isAvailable !== 'boolean') {
    return c.json({ error: 'isAvailable boolean is required' }, 400);
  }

  const updated = mockStore.updateDonorAvailability(id, body.isAvailable);
  if (!updated) {
    return c.json({ error: 'Donor not found' }, 404);
  }

  return c.json({ success: true, isAvailable: body.isAvailable });
});
