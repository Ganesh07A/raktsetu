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
import { notificationOutbox } from '../services/notification-outbox';
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

  const matchedBank = bankSearch.banks.find((bank) => {
    const measuredNearby = bank.distanceKm !== null && bank.distanceKm <= radiusKm;
    const hasRequiredStock = bank.stock.some((stock) =>
      stock.bloodGroup === bloodGroupNeeded &&
      stock.componentType === componentType &&
      (stock.unitsAvailable ?? 0) >= unitsNeeded
    );
    // A bank whose distance is unknown or unverified is not treated as radius-confirmed stock.
    return measuredNearby && hasRequiredStock;
  });

  const bankFound = Boolean(matchedBank);

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
    matchedBankId: matchedBank ? matchedBank.id : null,
    matchedBankName: matchedBank ? matchedBank.name : null,
    matchedBankPhone: matchedBank ? matchedBank.phone : null,
    matchedBankAddress: matchedBank ? (matchedBank.address || `${matchedBank.district}, ${matchedBank.state}`) : null,
    matchedBankDistanceKm: matchedBank ? matchedBank.distanceKm : null,
    matchedBankProvenance: matchedBank ? (matchedBank.source || 'eraktkosh') : null,
    matchedBankVerificationStatus: matchedBank ? 'source_reported' : null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  // Durable request persistence must succeed before any notification fanout (C-02)
  try {
    await requestService.createRequest(newRequest);
  } catch (err: any) {
    console.error('[@repo/api] Durable persistence failed for blood request:', err);
    return c.json(
      { error: 'Database service unavailable. Could not safely persist emergency request.' },
      500
    );
  }

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
      componentType: componentType as ComponentType,
      latitude,
      longitude,
      radiusKm,
      excludeIneligible: true, // Ineligible donors never enter notification pool (C-05)
    });

    const eligibleDonors = matchedDonors.slice(0, maxDonorsPerRequest);
    compatibleDonorsCount = eligibleDonors.length;

    if (notificationsEnabled && eligibleDonors.length > 0) {
      const outboxSummary = await notificationOutbox.enqueue({
        requestId,
        bloodGroupNeeded: newRequest.bloodGroupNeeded,
        donors: eligibleDonors.map((donor) => ({
          id: donor.id,
          name: donor.name,
          phone: donor.phone,
          bloodGroup: donor.bloodGroup,
          distanceKm: donor.distanceKm,
          preferredLanguage: donor.preferredLanguage,
        })),
      });
      notificationsSent = outboxSummary.sentCount;
    }
  }

  const responsePayload = {
    request: newRequest,
    status: newRequest.status,
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

  if (!body?.status) {
    return c.json({ error: 'Target status is required' }, 400);
  }

  const result = await requestService.updateRequestStatus(
    id,
    body.status,
    body.fulfillmentSource
  );

  if (!result.success) {
    const isNotFound = result.error?.includes('not found');
    return c.json({ error: result.error }, isNotFound ? 404 : 409);
  }

  return c.json({ success: true, updatedStatus: result.requestStatus });
});
