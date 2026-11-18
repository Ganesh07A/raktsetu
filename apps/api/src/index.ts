import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bloodBankRoutes } from './routes/blood-banks';
import { donorRoutes } from './routes/donors';
import { requestRoutes } from './routes/requests';
import { pushRoutes } from './routes/push';
import { authRoutes } from './routes/auth';
import { healthRoutes, readyRoutes } from './routes/health';
import { logConfigProblems } from './lib/config';
import { notificationOutbox } from './services/notification-outbox';

const app = new Hono();
logConfigProblems();

app.use('*', logger());

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
});

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://raktkhoj.org')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return allowedOrigins[0] || 'http://localhost:3000';
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'x-idempotency-key',
      'x-close-token',
      'x-view-token',
      'x-verification-ticket',
      'x-enforce-rate-limit',
    ],
  })
);

app.onError((err, c) => {
  const errorId = crypto.randomUUID();
  console.error(`[ERROR:${errorId}]`, err);
  const isProd = process.env.NODE_ENV === 'production';
  return c.json(
    {
      error: isProd ? 'An unexpected error occurred. Please contact support.' : (err.message || 'Internal Server Error'),
      errorId,
      status: 500,
    },
    500
  );
});

app.notFound((c) => c.json({ error: 'Not Found', status: 404 }, 404));

app.route('/health', healthRoutes);
app.route('/ready', readyRoutes);

app.route('/api/v1/blood-banks', bloodBankRoutes);
app.route('/api/v1/donors', donorRoutes);
app.route('/api/v1/requests', requestRoutes);
app.route('/api/v1/push', pushRoutes);
app.route('/api/v1/auth', authRoutes);

const port = Number(process.env.PORT || process.env.API_PORT || 3002);

if (process.env.NODE_ENV !== 'test' && process.env.OUTBOX_WORKER_ENABLED !== 'false') {
  const pollInterval = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 5000);
  console.log(`[@repo/api] Initializing outbox background worker (polling every ${pollInterval}ms)...`);
  notificationOutbox.startWorker(undefined, pollInterval);

  const shutdown = () => {
    console.log('[@repo/api] Gracefully stopping outbox background worker...');
    notificationOutbox.stopWorker();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default { port, fetch: app.fetch };
export { app };
