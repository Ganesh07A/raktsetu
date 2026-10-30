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
          // A. Interactive Quick-Reply Button Click
          if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
            const btnId = msg.interactive.button_reply.id as string;
            // Format: accept_{requestId}_{donorId} or decline_{requestId}_{donorId}
            const parts = btnId.split('_');
            if (parts.length >= 2) {
              const rawAction = parts[0];
              const action = rawAction === 'accept' ? 'accepted' : 'declined';
              const requestId = parts[1];
              let donorId = parts.slice(2).join('_');

              // If donorId is missing in button payload, resolve by sender's phone
              if (!donorId && msg.from) {
                const donor = mockStore.getDonorByPhone(msg.from);
                if (donor) donorId = donor.id;
              }

              if (requestId && (donorId || msg.from)) {
                await requestService.handleDonorReply(requestId, donorId || msg.from, action);
              }
            }
          }

          // B. Direct Text Reply (Donor types "YES", "ACCEPT", "NO", "DECLINE")
          if (msg.type === 'text' && msg.text?.body && msg.from) {
            const textBody = msg.text.body.trim().toLowerCase();
            let action: 'accepted' | 'declined' | null = null;
            if (/^(yes|accept|haan|ha|i can donate|ready|available)/i.test(textBody)) {
              action = 'accepted';
            } else if (/^(no|decline|nahi|not available|cannot|busy|cancel)/i.test(textBody)) {
              action = 'declined';
            }

            if (action) {
              const donor = mockStore.getDonorByPhone(msg.from);
              const donorId = donor ? donor.id : msg.from;
              const allRequests = mockStore.getAllRequests();
              for (const req of allRequests) {
                const notifs = mockStore.getNotificationsForRequest(req.id);
                const hasPending = notifs.some(
                  (n) => (n.donorId === donorId || n.donorId === donor?.id) && n.status !== 'accepted' && n.status !== 'declined'
                );
                if (hasPending) {
                  await requestService.handleDonorReply(req.id, donorId, action, textBody);
                  break;
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
