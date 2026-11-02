import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../index';

const MANAGED_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_PROJECT_ID',
  'PUBLIC_WEB_ORIGIN',
  'CORS_ORIGIN',
  'MOCK_SERVICES',
] as const;

const snapshot = new Map<string, string | undefined>(
  MANAGED_KEYS.map((key) => [key, process.env[key]])
);

const restoreEnv = (): void => {
  for (const key of MANAGED_KEYS) {
    const value = snapshot.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

describe('GET /health', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  it('keeps the legacy contract', async () => {
    process.env.NODE_ENV = 'test';
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('reports configuration and counters', async () => {
    process.env.NODE_ENV = 'test';
    const res = await app.request('/health');
    const body = (await res.json()) as {
      commit: string;
      mode: { database: { configured: boolean } };
      push: { configured: boolean; stats: { attempts: number } };
      cors: { origins: string[] };
      problems: unknown[];
    };
    expect(typeof body.commit).toBe('string');
    expect(typeof body.mode.database.configured).toBe('boolean');
    expect(typeof body.push.configured).toBe('boolean');
    expect(typeof body.push.stats.attempts).toBe('number');
    expect(Array.isArray(body.cors.origins)).toBe(true);
    expect(Array.isArray(body.problems)).toBe(true);
  });

  it('never leaks secret values', async () => {
    process.env.NODE_ENV = 'test';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'demo-project',
      client_email: 'svc@demo.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----SUPERSECRET-----END PRIVATE KEY-----',
    });

    const res = await app.request('/health');
    const text = await res.text();
    expect(text).not.toContain('SUPERSECRET');
    expect(text).not.toContain('private_key');
    expect(text).not.toContain('svc@demo.iam.gserviceaccount.com');

    const body = JSON.parse(text) as {
      push: { configured: boolean; projectId: string | null };
    };
    expect(body.push.configured).toBe(true);
    expect(body.push.projectId).toBe('demo-project');
  });

  it('flags the deployed web origin when it is missing from CORS_ORIGIN', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PUBLIC_WEB_ORIGIN = 'https://raktsetu-six.vercel.app';
    delete process.env.CORS_ORIGIN;
    const res = await app.request('/health');
    const body = (await res.json()) as { problems: Array<{ key: string }> };
    expect(body.problems.some((problem) => problem.key === 'CORS_ORIGIN')).toBe(true);
  });
});

describe('GET /ready', () => {
  beforeEach(restoreEnv);
  afterEach(restoreEnv);

  it('is ready outside production even when unconfigured', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const res = await app.request('/ready');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ready: boolean }).ready).toBe(true);
  });

  it('is NOT ready in production when push cannot work', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.PUBLIC_WEB_ORIGIN;

    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ready: boolean; blocking: Array<{ key: string }> };
    expect(body.ready).toBe(false);
    expect(body.blocking.some((problem) => problem.key === 'FIREBASE_SERVICE_ACCOUNT_JSON')).toBe(true);
    expect(body.blocking.some((problem) => problem.key === 'PUBLIC_WEB_ORIGIN')).toBe(true);
  });
});
