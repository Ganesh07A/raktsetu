import { Hono } from 'hono';
import { verifyDonorSessionToken } from '../services/donor-session';
import { telegramStore } from '../services/telegram/telegram-store';
import { rateLimiter } from '../middleware/rate-limiter';

export const telegramRoutes = new Hono();

function getSessionDonorId(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const session = verifyDonorSessionToken(header.slice(7).trim());
  return session ? session.donorId : null;
}

// Rate limiter for link token generation (max 10 requests per 10 minutes)
const linkTokenLimiter = rateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: 'Too many link token requests. Please wait a few minutes.',
});

/**
 * POST /api/v1/telegram/link-token
 * Authenticated donor requests a single-use deep-link token to connect their Telegram
 */
telegramRoutes.post('/link-token', linkTokenLimiter, async (c) => {
  const donorId = getSessionDonorId(c.req.header('Authorization'));
  if (!donorId) {
    return c.json({ error: 'Valid donor session required' }, 401);
  }

  const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'RaktKhojDonorBot').replace(/^@/, '');
  const ttlSeconds = 600; // 10 minutes
  const token = await telegramStore.createLinkToken(donorId, ttlSeconds);
  const deepLink = `https://t.me/${botUsername}?start=${token}`;

  return c.json({
    success: true,
    token,
    botUsername,
    deepLink,
    expiresInSeconds: ttlSeconds,
  });
});

/**
 * GET /api/v1/telegram/status
 * Check current Telegram connection status and alert preferences for the donor
 */
telegramRoutes.get('/status', async (c) => {
  const donorId = getSessionDonorId(c.req.header('Authorization'));
  if (!donorId) {
    return c.json({ error: 'Valid donor session required' }, 401);
  }

  const sub = await telegramStore.getSubscriptionByDonorId(donorId);
  return c.json({
    success: true,
    connected: Boolean(sub && sub.alertsEnabled),
    subscription: sub
      ? {
          telegramUsername: sub.telegramUsername ? `@${sub.telegramUsername}` : null,
          alertsEnabled: sub.alertsEnabled,
          linkedAt: sub.linkedAt,
        }
      : null,
  });
});

/**
 * POST /api/v1/telegram/unlink
 * Disconnect Telegram notifications from this donor profile
 */
telegramRoutes.post('/unlink', async (c) => {
  const donorId = getSessionDonorId(c.req.header('Authorization'));
  if (!donorId) {
    return c.json({ error: 'Valid donor session required' }, 401);
  }

  await telegramStore.unlinkSubscription(donorId);
  return c.json({
    success: true,
    message: 'Telegram disconnected successfully',
  });
});

/**
 * PATCH /api/v1/telegram/preferences
 * Toggle Telegram alerts on or off
 */
telegramRoutes.patch('/preferences', async (c) => {
  const donorId = getSessionDonorId(c.req.header('Authorization'));
  if (!donorId) {
    return c.json({ error: 'Valid donor session required' }, 401);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body?.alertsEnabled !== 'boolean') {
    return c.json({ error: 'alertsEnabled boolean is required' }, 400);
  }

  await telegramStore.updatePreferences(donorId, body.alertsEnabled);
  return c.json({
    success: true,
    alertsEnabled: body.alertsEnabled,
  });
});
