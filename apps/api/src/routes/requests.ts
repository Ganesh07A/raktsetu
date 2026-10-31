import { Hono } from 'hono';
import {
  BLOOD_GROUPS,
  type BloodGroup,
  type ComponentType,
  type EmergencyType,
  type RadiusPreset,
  type BloodRequest,
} from '@repo/shared';
import { mockStore } from '../services/mock-store';
import { donorMatcher } from '../services/donor-matcher';
import { pushNotificationService } from '../services/push-notifications';
import { createDonorResponseToken, createRequestCloseToken, verifyRequestCloseToken } from '../services/donor-session';
import { eraktkoshProxy } from '../services/eraktkosh-proxy';
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

  // Stage 1: Use the same radius-aware stock search in tests and production.
  // The proxy supplies seeded fixtures only in test mode and live results otherwise.
  const bankSearch = await eraktkoshProxy.searchStock({
    lat: latitude,
    lng: longitude,
    radiusKm,
    bloodGroup: bloodGroupNeeded as BloodGroup,
    componentType: componentType as ComponentType,
    stateCode: state,
    districtCode: district,
  });

  const bankFound = bankSearch.banks.some((bank) => {
    const measuredNearby = bank.distanceKm !== null && bank.distanceKm <= radiusKm;
    const hasRequiredStock = bank.stock.some((stock) =>
      stock.bloodGroup === bloodGroupNeeded &&
      stock.componentType === componentType &&
      stock.unitsAvailable >= unitsNeeded
    );
    // A bank whose distance is unknown is not treated as radius-confirmed stock.
    return measuredNearby && hasRequiredStock;
  });

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
      requestCloseToken: createRequestCloseToken(requestId),
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
    // Do not disclose identities of donors who have not accepted the request.
    notifications: details.notifications.map((notification) => ({
      id: notification.id,
      status: notification.status,
      sentAt: notification.sentAt,
      respondedAt: notification.respondedAt,
    })),
    acceptedDonors: details.acceptedDonors,
  });
});

// POST /api/v1/requests/:id/close - Stop an active search at the seeker's request.
requestRoutes.post('/:id/close', async (c) => {
  const { id } = c.req.param();
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const signed = verifyRequestCloseToken(String(body?.requestCloseToken || ''));
  if (!signed || signed.requestId !== id) {
    return c.json({ error: 'Request close link is invalid or expired' }, 401);
  }

  const closed = await requestService.closeRequest(id);
  if (!closed) {
    return c.json({ error: 'This request is already fulfilled, closed, expired, or does not exist' }, 409);
  }
  return c.json({ success: true, status: 'cancelled' });
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
