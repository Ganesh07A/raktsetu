import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { securityStore } from './security-store';

type SignedPayload = {
  purpose: 'donor-session' | 'donor-response' | 'request-close' | 'request-view' | 'otp-ticket';
  donorId?: string;
  requestId?: string;
  phone?: string;
  ticketPurpose?: string;
  nonce?: string;
  expiresAt: number;
};

// Set of consumed single-use ticket nonces to prevent ticket replay attacks
const consumedTicketNonces = new Set<string>();

export function getConsumedTicketsCount(): number {
  return consumedTicketNonces.size;
}

export function resetConsumedTickets(): void {
  consumedTicketNonces.clear();
}

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
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) return null;
    if ((purpose === 'donor-session' || purpose === 'donor-response') &&
      (typeof payload.donorId !== 'string' || !payload.donorId)) return null;
    if ((purpose === 'donor-response' || purpose === 'request-close' || purpose === 'request-view') &&
      (typeof payload.requestId !== 'string' || !payload.requestId)) return null;
    if (purpose === 'otp-ticket' && (!payload.phone || !payload.nonce)) return null;
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
  return payload?.donorId ? { donorId: payload.donorId } : null;
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
  return payload?.requestId && payload.donorId
    ? { requestId: payload.requestId, donorId: payload.donorId }
    : null;
}

/** Signed capability held by the seeker who created a request; permits closing only that request. */
export function createRequestCloseToken(requestId: string): string {
  return sign({
    purpose: 'request-close',
    requestId,
    expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });
}

export function verifyRequestCloseToken(token: string): { requestId: string } | null {
  const payload = verify(token, 'request-close');
  return payload?.requestId ? { requestId: payload.requestId } : null;
}

/** Signed capability held by the seeker who created a request; permits viewing request details & waiting room status. */
export function createRequestViewToken(requestId: string): string {
  return sign({
    purpose: 'request-view',
    requestId,
    expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });
}

export function verifyRequestViewToken(token: string): { requestId: string } | null {
  const payload = verify(token, 'request-view');
  return payload?.requestId ? { requestId: payload.requestId } : null;
}

/** Generate a single-use verification ticket for a verified phone number */
export function createOtpVerificationTicket(phone: string, ticketPurpose: string): string {
  return sign({
    purpose: 'otp-ticket',
    phone,
    ticketPurpose,
    nonce: randomUUID(),
    expiresAt: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes validity
  });
}

/** Atomically verify and consume single-use verification ticket to prevent replay (P0.2) */
export async function consumeOtpVerificationTicket(
  ticket: string,
  expectedPurpose: string,
  expectedPhone: string
): Promise<{ success: boolean; error?: string }> {
  const payload = verify(ticket, 'otp-ticket');
  if (!payload || !payload.nonce || !payload.phone) {
    return { success: false, error: 'Invalid or expired phone verification ticket' };
  }

  if (payload.ticketPurpose && payload.ticketPurpose !== expectedPurpose) {
    return { success: false, error: 'Verification ticket was issued for a different operation' };
  }

  const normalizedExpected = expectedPhone.replace(/\D/g, '').slice(-10);
  const normalizedTicketPhone = payload.phone.replace(/\D/g, '').slice(-10);
  if (normalizedExpected !== normalizedTicketPhone) {
    return { success: false, error: 'Verification ticket phone does not match requested phone' };
  }

  // Atomically consume single-use nonce via distributed shared storage (PostgreSQL / Redis)
  return await securityStore.consumeTicketNonce(
    payload.nonce,
    normalizedExpected,
    expectedPurpose,
    payload.expiresAt
  );
}

