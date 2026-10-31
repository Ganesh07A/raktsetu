import { Hono } from 'hono';
import { and, db, donorPushSubscriptions, eq } from '@repo/db';
import { mockStore } from '../services/mock-store';
import { requestService } from '../services/request-service';
import { verifyDonorResponseToken, verifyDonorSessionToken } from '../services/donor-session';

export const pushRoutes = new Hono();

const isLiveDb = () => Boolean(
  process.env.NODE_ENV !== 'test' &&
  process.env.DATABASE_URL &&
  process.env.MOCK_SERVICES !== 'true'
);

function sessionFromAuthorization(header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return null;
  return verifyDonorSessionToken(header.slice(7).trim());
}

pushRoutes.post('/register', async (c) => {
  const session = sessionFromAuthorization(c.req.header('Authorization'));
  if (!session) return c.json({ error: 'Valid donor session required' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const fcmToken = typeof body?.fcmToken === 'string' ? body.fcmToken.trim() : '';
  if (fcmToken.length < 40 || fcmToken.length > 4096) {
    return c.json({ error: 'A valid FCM registration token is required' }, 400);
  }

  if (isLiveDb()) {
    const now = new Date();
    await db.insert(donorPushSubscriptions).values({
      donorId: session.donorId,
      fcmToken,
      platform: 'web',
      userAgent: c.req.header('User-Agent')?.slice(0, 500) || null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: donorPushSubscriptions.fcmToken,
      set: {
        donorId: session.donorId,
        platform: 'web',
        userAgent: c.req.header('User-Agent')?.slice(0, 500) || null,
        updatedAt: now,
      },
    });
  } else {
    mockStore.addPushSubscription(session.donorId, fcmToken);
  }

  return c.json({ success: true, message: 'Notifications enabled on this device' });
});

pushRoutes.delete('/register', async (c) => {
  const session = sessionFromAuthorization(c.req.header('Authorization'));
  if (!session) return c.json({ error: 'Valid donor session required' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const fcmToken = typeof body?.fcmToken === 'string' ? body.fcmToken.trim() : '';
  if (!fcmToken) return c.json({ error: 'fcmToken is required' }, 400);

  if (isLiveDb()) {
    await db.delete(donorPushSubscriptions).where(and(
      eq(donorPushSubscriptions.donorId, session.donorId),
      eq(donorPushSubscriptions.fcmToken, fcmToken)
    ));
  } else {
    mockStore.removePushSubscription(session.donorId, fcmToken);
  }

  return c.json({ success: true, message: 'Notifications disabled on this device' });
});

pushRoutes.post('/respond', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  if (body?.action !== 'accepted' && body?.action !== 'declined') {
    return c.json({ error: 'action must be accepted or declined' }, 400);
  }

  const signed = verifyDonorResponseToken(String(body?.responseToken || ''));
  if (!signed) return c.json({ error: 'Response link is invalid or expired' }, 401);

  try {
    const result = await requestService.handleDonorReply(
      signed.requestId,
      signed.donorId,
      body.action,
      'Responded from RaktSetu push notification'
    );
    return c.json({
      success: true,
      status: body.action,
      requestStatus: result.requestStatus,
      duplicate: result.duplicate ?? false,
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Unable to record response',
    }, 409);
  }
});
