import { describe, expect, test } from 'bun:test';
import { inspectConfig, configProblems } from '../apps/api/src/lib/config';

describe('Checkpoint 4.3: Environment Precedence & PUBLIC_WEB_ORIGIN Runtime Verification', () => {
  test('inspectConfig correctly resolves PUBLIC_WEB_ORIGIN as an absolute HTTPS origin', () => {
    const report = inspectConfig();
    expect(report.push.publicOrigin).toBeTruthy();
    expect(report.push.publicOrigin).toBe('https://raktsetu-six.vercel.app');
    expect(report.push.fcmLinkUsable).toBe(true);

    // Verify regex validation
    expect(/^https:\/\/[^/\s]+/i.test(report.push.publicOrigin!)).toBe(true);
  });

  test('configProblems emits no blocking error or warning for PUBLIC_WEB_ORIGIN', () => {
    const problems = configProblems();
    const originProblem = problems.find((p) => p.key === 'PUBLIC_WEB_ORIGIN');
    expect(originProblem).toBeUndefined();
  });
});

