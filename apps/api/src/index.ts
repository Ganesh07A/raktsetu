import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bloodBankRoutes } from './routes/blood-banks';
import { donorRoutes } from './routes/donors';
import { requestRoutes } from './routes/requests';
import { pushRoutes } from './routes/push';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,https://raktkhoj.org')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || 'Internal Server Error', status: 500 }, 500);
});

app.notFound((c) => c.json({ error: 'Not Found', status: 404 }, 404));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/v1/blood-banks', bloodBankRoutes);
app.route('/api/v1/donors', donorRoutes);
app.route('/api/v1/requests', requestRoutes);
app.route('/api/v1/push', pushRoutes);

const port = Number(process.env.PORT || process.env.API_PORT || 3002);

export default { port, fetch: app.fetch };
export { app };
