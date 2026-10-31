import { Hono } from 'hono';
import {
  BLOOD_GROUPS,
  haversineDistance,
  type BloodGroup,
  type ComponentType,
  type EmergencyType,
  type RadiusPreset,
  type BloodRequest,
  type DonorNotificationSummary,
  type AcceptedDonorContact,
} from '@repo/shared';
import { mockStore } from '../services/mock-store';
import { donorMatcher } from '../services/donor-matcher';
import { pushNotificationService } from '../services/push-notifications';
import { createDonorResponseToken } from '../services/donor-session';
import { requestService } from '../services/request-service';

export const requestRoutes = new Hono();

// POST /api/v1/requests - Create an emergency blood request
requestRoutes.post('/', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Expected JSON object in request body' }, 400);
  }

  const {
    bloodGroupNeeded,
    componentType = 'whole_blood',
    unitsNeeded = 1,
    patientName,
    patientAge,
    emergencyType,
    hospitalName,
    latitude,
    longitude,
    state,
    district,
    searchRadiusKm = 10,
    requesterPhone,
    requesterName,
  } = body;

  if (!bloodGroupNeeded || !BLOOD_GROUPS.includes(bloodGroupNeeded)) {
    return c.json(
      { error: `Invalid blood group needed: ${bloodGroupNeeded}` },
      400
    );
  }

  if (!patientName || typeof patientName !== 'string' || patientName.trim().length < 2) {
    return c.json(
      { error: 'Patient name must be at least 2 characters' },
      400
    );
  }

  if (!hospitalName || typeof hospitalName !== 'string' || hospitalName.trim().length < 2) {
    return c.json(
      { error: 'Hospital name must be at least 2 characters' },
      400
    );
  }

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    return c.json({ error: 'Latitude and longitude are required' }, 400);
  }

  const radiusKm = Number(searchRadiusKm) as RadiusPreset;
  const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Stage 1: Check nearby blood banks within radius for stock
  let bankFound = false;
  const allBanks = mockStore.getBloodBanks();

  for (const bank of allBanks) {
    if (bank.latitude === null || bank.longitude === null) continue;
    const dist = haversineDistance(latitude, longitude, bank.latitude, bank.longitude);
    if (dist <= radiusKm) {
      const hasStock = bank.stock.some(
        (s) =>
          s.bloodGroup === bloodGroupNeeded &&
          s.unitsAvailable >= unitsNeeded
      );
      if (hasStock) {
        bankFound = true;
        break;
      }
    }
  }

  const newRequest: BloodRequest = {
    id: requestId,
    requesterId: body.requesterId || null,
    bloodGroupNeeded: bloodGroupNeeded as BloodGroup,
    componentType: componentType as ComponentType,
    unitsNeeded,
    patientName: patientName.trim(),
    patientAge: patientAge ?? null,
    emergencyType: (emergencyType as EmergencyType) ?? 'surgery',
    hospitalName: hospitalName.trim(),
    latitude,
    longitude,
    state: state ?? null,
    district: district ?? null,
    searchRadiusKm: radiusKm,
    status: bankFound ? 'bank_found' : 'donors_notified',
    fulfillmentSource: bankFound ? 'blood_bank' : null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  await requestService.createRequest(newRequest);

  let compatibleDonorsCount = 0;
  let notificationsSent = 0;

  // Stage 2 Fallback: If no bank found with stock, automatically cascade to donors
  if (!bankFound) {
    const matchedDonors = await donorMatcher.findCompatibleDonors({
      recipientBloodGroup: bloodGroupNeeded as BloodGroup,
      latitude,
      longitude,
      radiusKm,
    });

    compatibleDonorsCount = matchedDonors.length;

    for (const donor of matchedDonors) {
      const notifId = `notif-${requestId}-${donor.id}`;

      // Mask phone number for privacy until donor accepts
      const maskedPhone = donor.phone.replace(
        /(\+\d{2})(\d{2})\d{4}(\d{4})/,
        '$1 $2****$3'
      );

      const responseToken = createDonorResponseToken(requestId, donor.id);
      await requestService.recordNotification({
        id: notifId,
        requestId,
        donorId: donor.id,
        status: 'pending',
        donorName: donor.name,
        donorBloodGroup: donor.bloodGroup,
        donorPhoneMasked: maskedPhone,
        sentAt: new Date().toISOString(),
      });

      const deviceTokens = await requestService.getPushTokensForDonor(donor.id);
      const sendResult = await pushNotificationService.sendDonationRequest({
        tokens: deviceTokens,
        requestId,
        responseToken,
        bloodGroup: newRequest.bloodGroupNeeded,
        distanceKm: donor.distanceKm,
        language: donor.preferredLanguage || 'en',
      });

      await requestService.updateNotificationDelivery({
        requestId,
        donorId: donor.id,
        status: sendResult.success ? 'sent' : 'failed',
        pushMessageId: sendResult.messageId,
      });

      for (const invalidToken of sendResult.invalidTokens) {
        await requestService.removePushSubscriptionToken(donor.id, invalidToken);
      }
      if (sendResult.success) notificationsSent++;
    }
  }

  return c.json(
    {
      request: newRequest,
      compatibleDonorsCount,
      notificationsSent,
    },
    201
  );
});

// GET /api/v1/requests/:id - Get request details, status, & waiting room state
requestRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const details = await requestService.getRequestWithDetails(id);

  if (!details || !details.request) {
    return c.json(
      { error: `Request with ID ${id} not found` },
      404
    );
  }

  return c.json({
    request: details.request,
    notifications: details.notifications,
    acceptedDonors: details.acceptedDonors,
  });
});

// POST /api/v1/requests/:id/respond - Direct response endpoint from deep link
requestRoutes.post('/:id/respond', async (c) => {
  const { id } = c.req.param();
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const details = await requestService.getRequestWithDetails(id);
  if (!details || !details.request) {
    return c.json({ error: `Request ${id} not found` }, 404);
  }

  const action = body.status || body.action;
  if (!action || !['accepted', 'declined', 'accept', 'decline'].includes(action)) {
    return c.json(
      { error: "Valid status ('accepted' or 'declined') is required" },
      400
    );
  }

  const normalizedAction =
    action === 'accepted' || action === 'accept' ? 'accepted' : 'declined';
  const donorId = body.donorId || body.donorPhone;

  if (donorId) {
    await requestService.handleDonorReply(
      id,
      donorId,
      normalizedAction,
      body.responseNote
    );
  }

  return c.json({ success: true, status: normalizedAction });
});

// PATCH /api/v1/requests/:id/status - Update status manually
requestRoutes.patch('/:id/status', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const request = mockStore.getRequest(id);
  if (!request) {
    return c.json({ error: `Request ${id} not found` }, 404);
  }

  if (body.status) {
    request.status = body.status;
  }
  if (body.fulfillmentSource) {
    request.fulfillmentSource = body.fulfillmentSource;
  }

  return c.json({ success: true, updatedStatus: request.status });
});
