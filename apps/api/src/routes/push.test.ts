import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../index';
import { createDonorSessionToken } from '../services/donor-session';
import { mockStore } from '../services/mock-store';

describe('Push subscription API (/api/v1/push)', () => {
  beforeEach(() => mockStore.reset());

  it('rejects push registration without a signed donor session', async () => {
    const response = await app.request('/api/v1/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcmToken: `test-fcm-token-${'x'.repeat(64)}` }),
    });
    expect(response.status).toBe(401);
  });

  it('registers a device token for the donor in the signed session', async () => {
    const donorId = 'donor-amit-ab-neg';
    const token = `test-fcm-token-${'x'.repeat(64)}`;
    const response = await app.request('/api/v1/push/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${createDonorSessionToken(donorId)}`,
      },
      body: JSON.stringify({ fcmToken: token }),
    });
    expect(response.status).toBe(200);
    expect(mockStore.getPushTokensForDonor(donorId)).toContain(token);
  });

  it('removes only the current donor device token', async () => {
    const donorId = 'donor-amit-ab-neg';
    const token = `test-fcm-token-${'y'.repeat(64)}`;
    mockStore.addPushSubscription(donorId, token);
    const response = await app.request('/api/v1/push/register', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${createDonorSessionToken(donorId)}`,
      },
      body: JSON.stringify({ fcmToken: token }),
    });
    expect(response.status).toBe(200);
    expect(mockStore.getPushTokensForDonor(donorId)).not.toContain(token);
  });

  it('rejects response actions with an invalid signed token', async () => {
    const response = await app.request('/api/v1/push/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accepted', responseToken: 'not-a-signed-token' }),
    });
    expect(response.status).toBe(401);
  });
});
