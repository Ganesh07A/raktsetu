import { Hono } from 'hono';
import {
  BLOOD_GROUPS,
  createBloodRequestSchema,
  type BloodGroup,
  type ComponentType,
  type EmergencyType,
  type RadiusPreset,
  type BloodRequest,
} from '@repo/shared';
import { mockStore } from '../services/mock-store';
import { donorMatcher } from '../services/donor-matcher';
import { pushNotificationService } from '../services/push-notifications';
import {
  createDonorResponseToken,
  createRequestCloseToken,
  verifyRequestCloseToken,
  createRequestViewToken,
  verifyRequestViewToken,
  consumeOtpVerificationTicket,
} from '../services/donor-session';
import { eraktkoshProxy } from '../services/eraktkosh-proxy';
import { requestService } from '../services/request-service';
import { rateLimiter, getClientIp } from '../middleware/rate-limiter';

export const requestRoutes = new Hono();

// Idempotency cache to prevent duplicate request creation and duplicate fan-out (C-02)
const idempotencyStore = new Map<string, { response: any; createdAt: number }>();

function cleanupIdempotencyStore(): void {
  const now = Date.now();
  for (const [key, val] of idempotencyStore.entries()) {
    if (now - val.createdAt > 10 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}

// Rate limiter for emergency request creation: 10/hr per IP, 3/hr per phone (C-02, H-06)
const requestCreationRateLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Maximum emergency requests exceeded for this IP. Please call emergency services.',
});

// POST /api/v1/requests - Create an emergency blood request
requestRoutes.post('/', requestCreationRateLimiter, async (c) => {
  cleanupIdempotencyStore();

  const idempotencyKey =
    c.req.header('idempotency-key') || c.req.header('x-idempotency-key');
  if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
    const cached = idempotencyStore.get(idempotencyKey)!;
    return c.json(cached.response, 201);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Expected JSON object in request body' }, 400);
  }

  // Strict server-side validation using shared schema (C-02)
  const validation = createBloodRequestSchema.safeParse(body);
  if (!validation.success) {
    return c.json(
      {
        error: validation.error.issues[0]?.message || 'Invalid blood request payload',
        details: validation.error.issues,
      },
      400
    );
  }

  const validData = validation.data;
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
  } = validData;

  // Phone verification requirement (C-02)
  const verificationTicket =
    validData.verificationTicket ||
    body.verificationTicket ||
    c.req.header('x-verification-ticket');

  if (requesterPhone && verificationTicket) {
    const ticketCheck = consumeOtpVerificationTicket(
      verificationTicket,
      'emergency_request',
      requesterPhone
    );
    if (!ticketCheck.success) {
      return c.json({ error: ticketCheck.error }, 401);
    }
  } else if (requesterPhone && process.env.NODE_ENV === 'production') {
    return c.json(
      { error: 'Verified requester phone ownership ticket is required' },
      401
    );
  }

  const radiusKm = Number(searchRadiusKm) as RadiusPreset;
  const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Stage 1: Radius-aware stock search.
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
      (stock.unitsAvailable ?? 0) >= unitsNeeded
    );
    // A bank whose distance is unknown or unverified is not treated as radius-confirmed stock.
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

  // Durable request persistence must succeed before any notification fanout (C-02)
  await requestService.createRequest(newRequest);

  let compatibleDonorsCount = 0;
  let notificationsSent = 0;

  // Notification Fan-out Kill Switch & Quota checks (C-02)
  const notificationsEnabled = process.env.NOTIFICATIONS_ENABLED !== 'false';
  const maxDonorsPerRequest = Math.min(
    Number(process.env.MAX_DONORS_PER_REQUEST || 10),
    50
  );

  // Stage 2 Fallback: If no bank found with stock, cascade to eligible donors
  if (!bankFound) {
    const matchedDonors = await donorMatcher.findCompatibleDonors({
      recipientBloodGroup: bloodGroupNeeded as BloodGroup,
      latitude,
      longitude,
      radiusKm,
      excludeIneligible: true, // Ineligible donors never enter notification pool (C-05)
    });

    const eligibleDonors = matchedDonors.slice(0, maxDonorsPerRequest);
    compatibleDonorsCount = eligibleDonors.length;

    if (notificationsEnabled) {
      for (const donor of eligibleDonors) {
        const notifId = `notif-${requestId}-${donor.id}`;

        // Mask phone number for privacy until donor accepts (C-03)
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
  }

  const responsePayload = {
    request: newRequest,
    compatibleDonorsCount,
    notificationsSent,
    requestViewToken: createRequestViewToken(requestId),
    requestCloseToken: createRequestCloseToken(requestId),
  };

  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, {
      response: responsePayload,
      createdAt: Date.now(),
    });
  }

  return c.json(responsePayload, 201);
});

// GET /api/v1/requests/:id - Get request details, status, & waiting room state (H-05)
requestRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const details = await requestService.getRequestWithDetails(id);

  if (!details || !details.request) {
    return c.json(
      { error: `Request with ID ${id} not found` },
      404
    );
  }

  // Capability authorization check (H-05)
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : c.req.query('token') || '';

  // Reject close tokens when used as read tokens (H-05)
  if (token && verifyRequestCloseToken(token)) {
    return c.json(
      { error: 'Close token cannot be used to view request details. Use requestViewToken.' },
      403
    );
  }

  // Redact exact coordinates from public outputs (C-03, H-05)
  const safeLatitude = Math.round(details.request.latitude * 100) / 100;
  const safeLongitude = Math.round(details.request.longitude * 100) / 100;

  const safeRequest = {
    ...details.request,
    latitude: safeLatitude,
    longitude: safeLongitude,
  };

  return c.json({
    request: safeRequest,
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

// PATCH /api/v1/requests/:id/status - Update status manually (Protected, requires close capability or auth)
requestRoutes.patch('/:id/status', async (c) => {
  const { id } = c.req.param();
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Must provide close capability token or admin authorization
  const token = body?.requestCloseToken || c.req.header('x-close-token');
  const signed = token ? verifyRequestCloseToken(String(token)) : null;

  if (!signed || signed.requestId !== id) {
    return c.json({ error: 'Unauthorized request status update' }, 401);
  }

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
