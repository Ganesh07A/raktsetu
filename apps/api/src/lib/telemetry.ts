export type PushOutcome = 'sent' | 'failed' | 'disabled' | 'no_tokens';

export interface PushStats {
  attempts: number;
  sent: number;
  failed: number;
  disabled: number;
  skippedNoTokens: number;
  mockSends: number;
  invalidTokensRemoved: number;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

export interface ProviderStats {
  calls: number;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

const nowIso = (): string => new Date().toISOString();

const emptyPushStats = (): PushStats => ({
  attempts: 0,
  sent: 0,
  failed: 0,
  disabled: 0,
  skippedNoTokens: 0,
  mockSends: 0,
  invalidTokensRemoved: 0,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
});

const emptyProviderStats = (): ProviderStats => ({
  calls: 0,
  lastOkAt: null,
  lastErrorAt: null,
  lastError: null,
});

export const telemetry = {
  startedAt: nowIso(),
  push: emptyPushStats(),
  providers: {
    eraktkosh: emptyProviderStats(),
  },
};

/** Call this at every exit point of PushNotificationService.sendDonationRequest. */
export function recordPushOutcome(
  outcome: PushOutcome,
  detail: { error?: string; invalidTokens?: number; mock?: boolean } = {}
): void {
  const stats = telemetry.push;
  stats.attempts += 1;
  if (detail.invalidTokens) stats.invalidTokensRemoved += detail.invalidTokens;
  switch (outcome) {
    case 'sent':
      stats.sent += 1;
      stats.lastSuccessAt = nowIso();
      if (detail.mock) stats.mockSends += 1;
      break;
    case 'failed':
      stats.failed += 1;
      stats.lastError = detail.error ?? 'unknown error';
      stats.lastErrorAt = nowIso();
      break;
    case 'disabled':
      stats.disabled += 1;
      stats.lastError = detail.error ?? 'FCM is not configured';
      stats.lastErrorAt = nowIso();
      break;
    case 'no_tokens':
      stats.skippedNoTokens += 1;
      break;
  }
}

/** Test helper: restores a clean slate between tests. */
export function resetTelemetry(): void {
  telemetry.startedAt = nowIso();
  telemetry.push = emptyPushStats();
  telemetry.providers.eraktkosh = emptyProviderStats();
}
