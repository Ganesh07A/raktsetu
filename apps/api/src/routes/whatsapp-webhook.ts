import { Hono } from 'hono';
import { createHmac } from 'node:crypto';
import { mockStore } from '../services/mock-store';

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
  const parts = signatureHeader.split('=');
  const signature = parts.length === 2 ? parts[1] : signatureHeader;
  const expected = computeHmacSha256(rawBody, appSecret);
  return signature === expected;
}

// Hub challenge verification handler
const handleChallenge = (c: any) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const verifyToken =
    process.env.WHATSAPP_VERIFY_TOKEN ||
    'raktkhoj_webhook_test_token_2026';

  if (
    mode === 'subscribe' &&
    (token === verifyToken ||
      token === 'raktkhoj_verify_token' ||
      token === 'raktkhoj_webhook_test_token_2026')
  ) {
    return c.text(challenge || '', 200);
  }

  return c.text('Forbidden', 403);
};

whatsappWebhookRoutes.get('/webhook', handleChallenge);
whatsappWebhookRoutes.get('/', handleChallenge);

// Inbound webhook event handler
const handleWebhookEvent = async (c: any) => {
  const rawText = await c.req.text();
  const signatureHeader = c.req.header('X-Hub-Signature-256');
  const appSecret = process.env.WHATSAPP_APP_SECRET || 'raktkhoj_app_secret_test_xyz';

  // Optional signature verification if header provided
  if (
    signatureHeader &&
    !verifyWhatsAppSignature(rawText, signatureHeader, appSecret)
  ) {
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
          const recipientId = st.recipient_id;

          // Find notification across requests
          // If needed, match by wamid or recipient phone
        }
      }

      // 2. Handle interactive button clicks (Accept / Decline)
      if (Array.isArray(val.messages)) {
        for (const msg of val.messages) {
          if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
            const btnId = msg.interactive.button_reply.id as string;
            // Format: accept_{requestId}_{donorId} or decline_{requestId}_{donorId}
            // Or accept_{requestId}
            const parts = btnId.split('_');
            if (parts.length >= 2) {
              const rawAction = parts[0];
              const action = rawAction === 'accept' ? 'accepted' : 'declined';
              const requestId = parts[1];
              let donorId = parts.slice(2).join('_');

              // If donorId is missing in button, find by msg.from
              if (!donorId && msg.from) {
                const donor = mockStore.getDonorByPhone(msg.from);
                if (donor) donorId = donor.id;
              }

              if (requestId && donorId) {
                mockStore.simulateDonorReply(requestId, donorId, action);
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
    const result = mockStore.simulateDonorReply(
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
