import { Hono } from 'hono';
import { configProblems, inspectConfig } from '../lib/config';
import { telemetry } from '../lib/telemetry';

export const healthRoutes = new Hono();
export const readyRoutes = new Hono();

const uptimeSeconds = (): number =>
  Math.max(0, Math.round((Date.now() - Date.parse(telemetry.startedAt)) / 1000));

healthRoutes.get('/', (c) => {
  const config = inspectConfig();
  const problems = configProblems(config);
  return c.json({
    // Legacy contract — keep these two fields exactly as they are.
    status: problems.some((problem) => problem.level === 'error') ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    commit: config.commit,
    startedAt: telemetry.startedAt,
    uptimeSec: uptimeSeconds(),
    mode: {
      nodeEnv: config.nodeEnv,
      mockServices: config.mockServices,
      database: config.database,
    },
    push: {
      configured: config.push.configured,
      credentialSource: config.push.credentialSource,
      projectId: config.push.projectId,
      publicOrigin: config.push.publicOrigin,
      fcmLinkUsable: config.push.fcmLinkUsable,
      stats: telemetry.push,
    },
    providers: telemetry.providers,
    cors: config.cors,
    problems,
  });
});

readyRoutes.get('/', (c) => {
  const config = inspectConfig();
  const blocking = configProblems(config).filter((problem) => problem.level === 'error');
  if (blocking.length > 0) {
    return c.json({ ready: false, blocking }, 503);
  }
  return c.json({ ready: true });
});
