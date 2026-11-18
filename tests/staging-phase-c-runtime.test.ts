import { describe, expect, test } from 'bun:test';
import { app } from '../apps/api/src/index';
import { inspectConfig, configProblems } from '../apps/api/src/lib/config';

describe('Phase C: Staging Services Configuration & Runtime Verification', () => {
  test('C.1: Health endpoint returns HTTP 200 with ISO timestamp and valid uptime', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).getTime()).not.toBeNaN();
    expect(typeof data.uptimeSec).toBe('number');
  });

  test('C.2: Readiness endpoint returns HTTP 200 with ready: true', async () => {
    const res = await app.request('/ready');
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.ready).toBe(true);
  });

  test('C.3: Security headers middleware applies strict security headers', async () => {
    const res = await app.request('/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('permissions-policy')).toBe('geolocation=(), camera=(), microphone=()');
  });

  test('C.4: CORS preflight options request allows custom security headers', async () => {
    const res = await app.request('/api/v1/requests', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://raktsetu-six.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'x-verification-ticket, x-close-token, x-view-token, Idempotency-Key',
      },
    });
    expect([200, 204]).toContain(res.status);
    const allowHeaders = res.headers.get('access-control-allow-headers') || '';
    expect(allowHeaders).toContain('x-verification-ticket');
    expect(allowHeaders).toContain('x-close-token');
    expect(allowHeaders).toContain('x-view-token');
    expect(allowHeaders).toContain('Idempotency-Key');
  });

  test('C.5: Configuration report identifies environment and non-blocking warnings without crashing', () => {
    const report = inspectConfig();
    if (process.env.DATABASE_URL) {
      expect(report.database.configured).toBe(true);
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      expect(report.push.fcmLinkUsable).toBe(true);
    }

    const problems = configProblems(report);
    expect(Array.isArray(problems)).toBe(true);
  });
});
