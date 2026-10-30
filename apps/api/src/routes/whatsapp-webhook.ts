import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mockStore } from '../services/mock-store';
import { requestService } from '../services/request-service';

export const whatsappWebhookRoutes = new Hono();

export function computeHmacSha256(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;

  // Header must strictly match: sha256=<64 hexadecimal characters>
  const match = signatureHeader.trim().match(/^sha256=([0-9a-fA-F]{64})$/);
  if (!match || !match[1]) {
    return false;
  }

  const signatureHex = match[1].toLowerCase();
  const expectedHex = computeHmacSha256(rawBody, appSecret);

  try {
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    const expectedBuffer = Buffer.from(expectedHex, 'hex');

    if (signatureBuffer.length !== 32 || expectedBuffer.length !== 32) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Hub challenge verification handler
const handleChallenge = (c: any) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return c.text('WHATSAPP_VERIFY_TOKEN is not configured', 503);
  }

  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken) {
    return c.text(challenge || '', 200);
  }

  return c.text('Forbidden', 403);
};

whatsappWebhookRoutes.get('/webhook', handleChallenge);
whatsappWebhookRoutes.get('/', handleChallenge);

/**
 * Parse and classify donor free-text intent into 'accepted' | 'declined' | null.
 *
 * Rules:
 * 1. Normalize whitespace, smart quotes, and punctuation.
 * 2. Evaluate negative phrases and negation BEFORE positive keywords.
 * 3. Never treat standalone ambiguous words ("ready", "available", "agree") as acceptance without affirmative context.
 * 4. Contradictory messages containing both affirmative and negative intent must return null (unprocessed).
 */
export function parseDonorTextIntent(rawText: string): 'accepted' | 'declined' | null {
  if (!rawText) return null;

  // 1. Normalize whitespace, smart quotes, and punctuation
  const normalized = rawText
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[,\.!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  // 2. Evaluate negative phrases and negation patterns
  const NEGATIVE_PHRASES = [
    /\bnot\s+ready(\s+to\s+donate)?\b/,
    /\bnot\s+available(\s+to\s+donate)?\b/,
    /\bnot\s+willing(\s+to\s+donate)?\b/,
    /\bnot\s+happy(\s+to\s+donate)?\b/,
    /\bnot\s+able\s+to\s+donate\b/,
    /\bunable\s+to\s+donate\b/,
    /\b(don't|dont|do\s+not)\s+agree\b/,
    /\b(don't|dont|do\s+not)\s+accept\b/,
    /\bnot\s+accept(ed)?\b/,
    /\bnot\s+sure\b/,
    /\b(can't|cant|cannot|can\s+not|will\s+not|won't|wont)\s+donate\b/,
    /\b(can't|cant|cannot|can\s+not)\s+come\b/,
    /\b(can't|cant|cannot|can\s+not)\s+help\b/,
    /\bnot\s+possible\b/,
    /\bnot\s+donating\b/,
  ];

  const NEGATIVE_TOKENS = [
    /\bno\b/,
    /\bdecline\b/,
    /\bdeclined\b/,
    /\bnahi\b/,
    /\bna\b/,
    /\bcannot\b/,
    /\bcan't\b/,
    /\bcant\b/,
    /\brefuse\b/,
    /\brefused\b/,
    /\bbusy\b/,
    /\bunable\b/,
    /\bcancel\b/,
    /\bcancelled\b/,
  ];

  // Check if any negative phrase matches the normalized text
  // Mask matched negative phrases out of textForAffirmative so negated phrases don't falsely trigger affirmative match
  let textForAffirmative = normalized;
  let hasNegativePhrase = false;
  for (const regex of NEGATIVE_PHRASES) {
    if (regex.test(normalized)) {
      hasNegativePhrase = true;
      textForAffirmative = textForAffirmative.replace(new RegExp(regex.source, 'gi'), ' ');
    }
  }
  textForAffirmative = textForAffirmative.replace(/\s+/g, ' ').trim();

  const hasNegativeToken = NEGATIVE_TOKENS.some((regex) => regex.test(normalized));
  const isNegative = hasNegativePhrase || hasNegativeToken;

  // 3. Evaluate affirmative intent on text where negative phrases were stripped
  // Affirmative phrases: require clear context (not standalone ambiguous words like "ready", "available", "agree")
  const AFFIRMATIVE_PHRASES = [
    /\b(i\s+can|can)\s+donate\b/,
    /\b(i\s+will|will)\s+donate\b/,
    /\b(ready|willing|happy)\s+to\s+donate\b/,
    /\bavailable\s+to\s+donate\b/,
    /\b(i\s+am|im|i'm)\s+ready\b/,
    /\b(i\s+am|im|i'm)\s+available\b/,
    /\b(i)\s+agree\b/,
  ];

  const AFFIRMATIVE_TOKENS = [
    /\byes\b/,
    /\bhaan\b/,
    /\bha\b/,
    /\baccept\b/,
    /\baccepted\b/,
    /\bsure\b/,
    /\bdefinitely\b/,
    /\babsolutely\b/,
  ];

  const hasAffirmativePhrase = AFFIRMATIVE_PHRASES.some((regex) => regex.test(textForAffirmative));
  const hasAffirmativeToken = AFFIRMATIVE_TOKENS.some((regex) => regex.test(textForAffirmative));
  const isAffirmative = hasAffirmativePhrase || hasAffirmativeToken;

  // 4. If contradictory (both affirmative and negative intent present), return null (unprocessed)
  if (isAffirmative && isNegative) {
    return null;
  }

  if (isAffirmative) {
    return 'accepted';
  }

  if (isNegative) {
    return 'declined';
  }

  return null;
}

// Inbound webhook event handler
const handleWebhookEvent = async (c: any) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return c.json({ error: 'WHATSAPP_APP_SECRET is not configured' }, 503);
  }

  const signatureHeader = c.req.header('X-Hub-Signature-256');
  if (!signatureHeader) {
    return c.json({ error: 'Missing X-Hub-Signature-256 signature header' }, 401);
  }

  const rawText = await c.req.text();
  if (!verifyWhatsAppSignature(rawText, signatureHeader, appSecret)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return c.json({ error: 'Malformed JSON payload' }, 400);
  }

  const entries = payload.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const val = change.value || {};

      // 1. Handle delivery status receipts (sent, delivered, read, failed)
      if (Array.isArray(val.statuses)) {
        for (const st of val.statuses) {
          const wamid = st.id;
          const status = st.status; // sent, delivered, read, failed
          if (wamid && (status === 'delivered' || status === 'read' || status === 'failed')) {
            await requestService.handleDeliveryReceipt(wamid, status);
          }
        }
      }

      // 2. Handle interactive button clicks (Accept / Decline) and direct text replies
      if (Array.isArray(val.messages)) {
        for (const msg of val.messages) {
          const senderPhone = msg.from;
          if (!senderPhone) {
            continue;
          }

          // Resolve sender to registered donor via phone lookup
          const senderDonor = await requestService.findDonorByPhone(senderPhone);

          // A. Interactive Quick-Reply Button Click
          if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
            const btnId = msg.interactive.button_reply.id as string;
            // Format: accept_{requestId}_{donorId} or decline_{requestId}_{donorId}
            const parts = btnId.split('_');
            if (parts.length >= 2) {
              const rawAction = parts[0];
              if (rawAction !== 'accept' && rawAction !== 'decline') {
                console.warn(
                  `[@repo/api] Invalid button reply action: "${rawAction}" in button ID ${btnId}. Rejecting.`
                );
                continue;
              }
              const action: 'accepted' | 'declined' = rawAction === 'accept' ? 'accepted' : 'declined';
              const requestId = parts[1];
              const encodedDonorId = parts.slice(2).join('_');

              if (!requestId) {
                continue;
              }

              // 1. Reject if sender is not a registered donor
              if (!senderDonor) {
                console.warn(
                  `[@repo/api] Unauthorized button response: sender ${senderPhone} is not a registered donor`
                );
                continue;
              }

              // 2. Verify resolved donor matches encoded donorId (never trust payload alone)
              if (encodedDonorId && encodedDonorId !== senderDonor.donorId) {
                console.warn(
                  `[@repo/api] Donor mismatch: sender donorId ${senderDonor.donorId} does not match button donorId ${encodedDonorId}`
                );
                continue;
              }

              // 3. Verify sender has a matching notification for this exact request
              const existingNotif = await requestService.getNotificationForDonorAndRequest(
                requestId,
                senderDonor.donorId
              );
              if (!existingNotif) {
                console.warn(
                  `[@repo/api] Rejected button response: sender ${senderDonor.donorId} has no notification for request ${requestId}`
                );
                continue;
              }

              if (requestId) {
                try {
                  await requestService.handleDonorReply(requestId, senderDonor.donorId, action);
                } catch (err) {
                  console.error(`[@repo/api] Error handling button reply:`, err);
                }
              }
            }
          }

          // B. Direct Text Reply (Donor types "YES", "ACCEPT", "NO", "DECLINE")
          if (msg.type === 'text' && msg.text?.body) {
            const textBody = msg.text.body;
            const action = parseDonorTextIntent(textBody);

            if (action) {
              // 1. Reject if sender is not a registered donor
              if (!senderDonor) {
                console.warn(
                  `[@repo/api] Unauthorized text response: sender ${senderPhone} is not a registered donor`
                );
                continue;
              }

              // 2. Resolve pending notifications for this donor from database & mock store
              const pendingNotifs = await requestService.getPendingNotificationsForDonor(
                senderDonor.donorId
              );

              if (pendingNotifs.length === 0) {
                console.info(
                  `[@repo/api] No pending requests found for donor ${senderDonor.donorId}`
                );
                continue;
              }

              const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

              if (pendingNotifs.length === 1) {
                // Exactly one pending request - check it does not conflict with a specific request ID token mentioned
                const single = pendingNotifs[0]!;
                const mentionedReqIds = textBody.match(/\breq-[a-z0-9-]+\b/gi);
                if (
                  mentionedReqIds &&
                  !mentionedReqIds.some((id: string) => id.toLowerCase() === single.requestId.toLowerCase())
                ) {
                  console.warn(
                    `[@repo/api] Conflicting request ID in text: mentioned ${mentionedReqIds.join(', ')} does not match pending ${single.requestId}`
                  );
                  continue;
                }

                try {
                  await requestService.handleDonorReply(
                    single.requestId,
                    senderDonor.donorId,
                    action,
                    textBody
                  );
                } catch (err) {
                  console.error(`[@repo/api] Error handling text reply:`, err);
                }
              } else {
                // Ambiguous: donor has multiple pending requests
                // Find matching requests by exact token request ID or full patient name (>= 3 chars)
                const matching = pendingNotifs.filter((p) => {
                  const reqIdRegex = new RegExp(`\\b${escapeRegex(p.requestId)}\\b`, 'i');
                  const reqIdMatch = reqIdRegex.test(textBody);
                  let nameMatch = false;
                  if (p.patientName && p.patientName.trim().length >= 3) {
                    const cleanPatient = p.patientName.trim();
                    const nameRegex = new RegExp(`\\b${escapeRegex(cleanPatient)}\\b`, 'i');
                    nameMatch = nameRegex.test(textBody);
                  }
                  return reqIdMatch || nameMatch;
                });

                if (matching.length === 1) {
                  try {
                    await requestService.handleDonorReply(
                      matching[0]!.requestId,
                      senderDonor.donorId,
                      action,
                      textBody
                    );
                  } catch (err) {
                    console.error(
                      `[@repo/api] Error handling disambiguated text reply:`,
                      err
                    );
                  }
                } else if (matching.length > 1) {
                  console.warn(
                    `[@repo/api] Ambiguous reply from donor ${senderDonor.donorId}: multiple matching requests (${matching.length}) found in text. Refusing arbitrary selection.`
                  );
                } else {
                  console.warn(
                    `[@repo/api] Ambiguous reply from donor ${senderDonor.donorId}: ${pendingNotifs.length} active pending requests with no matching identifier in text. Refusing arbitrary selection.`
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  return c.json({ success: true, processed: true, status: 'EVENT_RECEIVED' });
};

whatsappWebhookRoutes.post('/webhook', handleWebhookEvent);
whatsappWebhookRoutes.post('/', handleWebhookEvent);

// POST /api/v1/whatsapp/send-test (Live WhatsApp test dispatcher)
whatsappWebhookRoutes.post('/send-test', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { phone, text } = body;
  if (!phone) {
    return c.json({ error: 'phone is required (e.g. 919876543210)' }, 400);
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneId) {
    return c.json({ error: 'WhatsApp credentials not configured in .env' }, 500);
  }

  // 1. Try sending direct text message (immediate delivery inside 24h window)
  const textPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'text',
    text: {
      body: text || '🚨 *RaktKhoj Emergency Blood Network*\n\nHello! This is a test notification confirming your number is successfully registered to receive emergency blood requests. 🩸\n\nThank you for volunteering to save lives!',
    },
  };

  const textRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(textPayload),
  });

  const textJson = await textRes.json();

  if (textRes.ok) {
    return c.json({
      success: true,
      messageType: 'direct_text',
      data: textJson,
    });
  }

  // 2. If direct text failed (e.g. outside 24h window), try default hello_world template
  const templatePayload = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' },
    },
  };

  const templateRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(templatePayload),
  });

  const templateJson = await templateRes.json();

  return c.json({
    textAttempt: textJson,
    templateAttempt: templateJson,
    success: templateRes.ok,
  }, templateRes.ok ? 200 : 400);
});

// POST /api/v1/whatsapp/mock-reply (Dev & testing simulation endpoint)
whatsappWebhookRoutes.post('/mock-reply', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { requestId, donorPhone, donorId, action, note } = body;

  if (!requestId) {
    return c.json({ error: 'requestId is required' }, 400);
  }

  const normalizedAction =
    action === 'accept' || action === 'accepted' ? 'accepted' : 'declined';
  const identifier = donorId || donorPhone;

  if (!identifier) {
    return c.json({ error: 'donorId or donorPhone is required' }, 400);
  }

  try {
    const result = await requestService.handleDonorReply(
      requestId,
      identifier,
      normalizedAction,
      note
    );
    return c.json({
      success: true,
      simulatedAction: normalizedAction,
      status: result.requestStatus,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 404);
  }
});
