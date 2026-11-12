import { notificationOutbox } from './services/notification-outbox';
import { logConfigProblems } from './lib/config';

console.log('[@repo/api-worker] Starting dedicated RaktSetu Outbox Background Worker...');
logConfigProblems();

const pollInterval = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 3000);
const workerId = `render-worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

notificationOutbox.startWorker(workerId, pollInterval);

console.log(`[@repo/api-worker] Worker initialized (ID: ${workerId}, Poll: ${pollInterval}ms)`);

process.on('SIGTERM', () => {
  console.log('[@repo/api-worker] SIGTERM received. Stopping worker...');
  notificationOutbox.stopWorker();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[@repo/api-worker] SIGINT received. Stopping worker...');
  notificationOutbox.stopWorker();
  process.exit(0);
});

