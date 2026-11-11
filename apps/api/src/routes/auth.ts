import { Hono } from 'hono';
import { authOtpSendSchema, authOtpVerifySchema } from '@repo/shared';
import { otpService } from '../services/otp-service';
import { rateLimiter, getClientIp } from '../middleware/rate-limiter';

export const authRoutes = new Hono();

// Rate limiter for OTP send: 5 requests per 10 minutes per IP/phone
const otpSendRateLimit = rateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  message: 'Too many OTP requests. Please wait a few minutes before trying again.',
  keyGenerator: async (c) => {
    try {
      const cloned = c.req.raw.clone();
      const body = await cloned.json();
      if (body?.phone && typeof body.phone === 'string') {
        const norm = body.phone.replace(/\D/g, '').slice(-10);
        return `otp:send:${norm}`;
      }
    } catch {
      // fallback to IP
    }
    return `otp:send:ip:${getClientIp(c)}`;
  },
});

// Rate limiter for OTP verify: 10 requests per 10 minutes per IP/phone
const otpVerifyRateLimit = rateLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: 'Too many verification attempts. Please wait before retrying.',
  keyGenerator: async (c) => {
    try {
      const cloned = c.req.raw.clone();
      const body = await cloned.json();
      if (body?.phone && typeof body.phone === 'string') {
        const norm = body.phone.replace(/\D/g, '').slice(-10);
        return `otp:verify:${norm}`;
      }
    } catch {
      // fallback to IP
    }
    return `otp:verify:ip:${getClientIp(c)}`;
  },
});

// POST /api/v1/auth/otp/send
authRoutes.post('/otp/send', otpSendRateLimit, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = authOtpSendSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Invalid phone or purpose parameters',
      },
      400
    );
  }

  const { phone, purpose } = parseResult.data;
  const result = await otpService.sendOtp(phone, purpose);

  if (!result.success) {
    const status = result.error === 'COOLDOWN_ACTIVE' ? 429 : 503;
    return c.json({ error: result.message, code: result.error }, status);
  }

  return c.json({
    success: true,
    message: result.message,
    phone,
    purpose,
  });
});

// POST /api/v1/auth/otp/verify
authRoutes.post('/otp/verify', otpVerifyRateLimit, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parseResult = authOtpVerifySchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Invalid verification request',
      },
      400
    );
  }

  const { phone, otp, purpose } = parseResult.data;
  const result = otpService.verifyOtp(phone, otp, purpose);

  if (!result.success) {
    return c.json(
      {
        error: result.error,
        remainingAttempts: result.remainingAttempts,
      },
      400
    );
  }

  return c.json({
    success: true,
    verificationTicket: result.verificationTicket,
    message: 'Mobile number verified successfully',
  });
});

