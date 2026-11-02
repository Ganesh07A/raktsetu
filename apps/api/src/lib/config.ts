/**
 * Single source of truth for how this API is configured.
 * IMPORTANT: never return secret *values* from here — only booleans and non-secret identifiers.
 */
export type ProblemLevel = 'warn' | 'error';
export interface ConfigProblem {
  key: string;
  level: ProblemLevel;
  message: string;
  fix: string;
}
export interface ConfigReport {
  nodeEnv: string;
  commit: string;
  mockServices: boolean;
  database: { configured: boolean };
  push: {
    configured: boolean;
    credentialSource: 'FIREBASE_SERVICE_ACCOUNT_JSON' | 'GOOGLE_APPLICATION_CREDENTIALS' | null;
    projectId: string | null;
    publicOrigin: string | null;
    fcmLinkUsable: boolean;
  };
  cors: { origins: string[] };
}
const read = (name: string): string => (process.env[name] ?? '').trim();
export function inspectConfig(): ConfigReport {
  const serviceAccountJson = read('FIREBASE_SERVICE_ACCOUNT_JSON');
  const adcPath = read('GOOGLE_APPLICATION_CREDENTIALS');
  const publicOrigin = read('PUBLIC_WEB_ORIGIN') || null;
  let projectId = read('FIREBASE_PROJECT_ID') || null;
  if (!projectId && serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as { project_id?: string };
      projectId = parsed.project_id ?? null;
    } catch {
      projectId = null;
    }
  }
  const credentialSource = serviceAccountJson
    ? 'FIREBASE_SERVICE_ACCOUNT_JSON'
    : adcPath
      ? 'GOOGLE_APPLICATION_CREDENTIALS'
      : null;
  const corsOrigins = (read('CORS_ORIGIN') || 'http://localhost:3000,https://raktkhoj.org')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    commit: read('RENDER_GIT_COMMIT') || read('GIT_SHA') || 'unknown',
    mockServices: read('MOCK_SERVICES') === 'true',
    database: { configured: Boolean(read('DATABASE_URL')) },
    push: {
      configured: credentialSource !== null,
      credentialSource,
      projectId,
      publicOrigin,
      // Firebase Admin requires webpush.fcmOptions.link to be an absolute https URL.
      fcmLinkUsable: publicOrigin !== null && /^https:\/\/[^/\s]+/i.test(publicOrigin),
    },
    cors: { origins: corsOrigins },
  };
}
export function configProblems(report: ConfigReport = inspectConfig()): ConfigProblem[] {
  const isProd = report.nodeEnv === 'production';
  const level = (blocking: boolean): ProblemLevel => (isProd && blocking ? 'error' : 'warn');
  const problems: ConfigProblem[] = [];
  if (report.mockServices && isProd) {
    problems.push({
      key: 'MOCK_SERVICES',
      level: 'error',
      message:
        'MOCK_SERVICES=true in production: push calls report success without contacting FCM, and writes are not persisted.',
      fix: 'Unset MOCK_SERVICES on the hosting platform.',
    });
  }
  if (!report.database.configured) {
    problems.push({
      key: 'DATABASE_URL',
      level: level(true),
      message:
        'No DATABASE_URL: the database client is an offline proxy that resolves every query to []. Donors, push tokens and requests are lost on restart.',
      fix: 'Set DATABASE_URL to the Supabase pooler URI (port 6543, ?pgbouncer=true).',
    });
  }
  if (!report.push.configured) {
    problems.push({
      key: 'FIREBASE_SERVICE_ACCOUNT_JSON',
      level: level(true),
      message:
        'No Firebase Admin credentials: every push send returns mode "disabled" and no donor is ever notified.',
      fix:
        'Set FIREBASE_SERVICE_ACCOUNT_JSON to the service-account JSON on one line, or GOOGLE_APPLICATION_CREDENTIALS to a file path.',
    });
  }
  if (!report.push.fcmLinkUsable) {
    problems.push({
      key: 'PUBLIC_WEB_ORIGIN',
      level: level(true),
      message:
        'PUBLIC_WEB_ORIGIN is missing or is not an absolute https origin. webpush.fcmOptions.link must be absolute https or Firebase rejects the entire batch.',
      fix: 'Set PUBLIC_WEB_ORIGIN=https://raktsetu-six.vercel.app',
    });
  }
  if (report.push.publicOrigin && !report.cors.origins.includes(report.push.publicOrigin)) {
    problems.push({
      key: 'CORS_ORIGIN',
      level: level(true),
      message: `The public web origin ${report.push.publicOrigin} is not present in CORS_ORIGIN. Browsers will block API responses on the deployed site.`,
      fix: `Add ${report.push.publicOrigin} to CORS_ORIGIN (comma-separated).`,
    });
  }
  return problems;
}
/** Prints one readable block at boot. Never throws — a bad config must not crash the server. */
export function logConfigProblems(report: ConfigReport = inspectConfig()): ConfigProblem[] {
  const problems = configProblems(report);
  if (problems.length === 0) {
    console.log('[@repo/api] configuration OK');
    return problems;
  }
  const blocking = problems.filter((p) => p.level === 'error').length;
  console.log(`[@repo/api] configuration problems (${blocking} blocking):`);
  for (const problem of problems) {
    console.log(`  ${problem.level === 'error' ? 'x' : '!'} ${problem.key}: ${problem.message}`);
    console.log(`      fix: ${problem.fix}`);
  }
  return problems;
}
