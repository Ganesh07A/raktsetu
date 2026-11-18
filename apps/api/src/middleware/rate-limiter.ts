import type { Context, MiddlewareHandler } from 'hono';
import { securityStore } from '../services/security-store';

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  keyGenerator?: (c: Context) => string | Promise<string>;
  message?: string;
  skipInTests?: boolean;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore {
  private store = new Map<string, RateLimitRecord>();

  public increment(key: string, windowMs: number): { count: number; resetAt: number } {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now >= existing.resetAt) {
      const record: RateLimitRecord = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, record);
      return record;
    }

    existing.count += 1;
    return existing;
  }

  public reset(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

export const defaultRateLimitStore = new MemoryRateLimitStore();

export function getClientIp(c: Context): string {
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

export function rateLimiter(options: RateLimitOptions, store: MemoryRateLimitStore = defaultRateLimitStore): MiddlewareHandler {
  const {
    windowMs,
    limit,
    keyGenerator = (c) => getClientIp(c),
    message = 'Too many requests. Please slow down and try again later.',
    skipInTests = false,
  } = options;

  return async (c, next) => {
    // In test environment, rate limiting is skipped unless explicitly enforced with header
    if (process.env.NODE_ENV === 'test' && c.req.header('x-enforce-rate-limit') !== 'true') {
      return next();
    }

    // In local development, bypass rate limiting on loopback to prevent developer lockouts
    const clientIp = getClientIp(c);
    if (
      process.env.NODE_ENV !== 'production' &&
      c.req.header('x-enforce-rate-limit') !== 'true' &&
      (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost')
    ) {
      return next();
    }

    const key = await keyGenerator(c);
    let result: { count: number; resetAt: number };
    try {
      result = await securityStore.incrementRateLimit(key, windowMs);
    } catch {
      if (process.env.NODE_ENV === 'production') {
        return c.json({ error: 'Service rate limiter temporarily unavailable' }, 503);
      }
      result = store.increment(key, windowMs);
    }
    const now = Date.now();
    const resetSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));

    c.header('RateLimit-Limit', String(limit));
    c.header('RateLimit-Remaining', String(Math.max(0, limit - result.count)));
    c.header('RateLimit-Reset', String(resetSeconds));

    if (result.count > limit) {
      c.header('Retry-After', String(resetSeconds));
      return c.json(
        {
          error: message,
          status: 429,
          retryAfter: resetSeconds,
        },
        429
      );
    }

    await next();
  };
}
