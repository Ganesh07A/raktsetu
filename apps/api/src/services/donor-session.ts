import { createHmac, timingSafeEqual } from 'node:crypto';

type SignedPayload = {
  purpose: 'donor-session' | 'donor-response';
  donorId: string;
  requestId?: string;
  expiresAt: number;
};

function signingSecret(): string {
  const secret = process.env.DONOR_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DONOR_SESSION_SECRET must be configured with at least 32 characters');
  }
  return 'raktsetu-local-development-secret-change-before-deployment';
}

function sign(payload: SignedPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token: string, purpose: SignedPayload['purpose']): SignedPayload | null {
  const [encoded, supplied, extra] = token.split('.');
  if (!encoded || !supplied || extra || token.length > 4096) return null;

  const expected = createHmac('sha256', signingSecret()).update(encoded).digest();
  const actual = Buffer.from(supplied, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedPayload;
    if (
      payload.purpose !== purpose ||
      typeof payload.donorId !== 'string' ||
      !payload.donorId ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createDonorSessionToken(donorId: string): string {
  return sign({
    purpose: 'donor-session',
    donorId,
    expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });
}

export function verifyDonorSessionToken(token: string): { donorId: string } | null {
  const payload = verify(token, 'donor-session');
  return payload ? { donorId: payload.donorId } : null;
}

export function createDonorResponseToken(requestId: string, donorId: string): string {
  return sign({
    purpose: 'donor-response',
    donorId,
    requestId,
    expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });
}

export function verifyDonorResponseToken(token: string): { requestId: string; donorId: string } | null {
  const payload = verify(token, 'donor-response');
  return payload?.requestId ? { requestId: payload.requestId, donorId: payload.donorId } : null;
}
