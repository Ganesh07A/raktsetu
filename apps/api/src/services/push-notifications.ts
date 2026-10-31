import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { mockStore } from './mock-store';

export interface DonationPushParams {
  tokens: string[];
  requestId: string;
  responseToken: string;
  language?: 'en' | 'hi';
  bloodGroup: string;
  distanceKm: number;
}

export interface DonationPushResult {
  success: boolean;
  messageId: string | null;
  mode: 'live' | 'mock' | 'disabled';
  invalidTokens: string[];
}

function getMessagingClient() {
  if (process.env.MOCK_SERVICES === 'true' || process.env.NODE_ENV === 'test') return null;
  const existing = getApps()[0];
  if (existing) return getMessaging(existing);

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const options = raw
      ? (() => {
          const serviceAccount = JSON.parse(raw);
          if (serviceAccount.private_key) {
            serviceAccount.private_key = String(serviceAccount.private_key).replace(/\\n/g, '\n');
          }
          return { credential: cert(serviceAccount), ...(projectId ? { projectId } : {}) };
        })()
      : process.env.GOOGLE_APPLICATION_CREDENTIALS
        ? { credential: applicationDefault(), ...(projectId ? { projectId } : {}) }
        : null;

    if (!options) return null;
    return getMessaging(initializeApp(options));
  } catch (error) {
    console.error('[@repo/api] Firebase Admin initialization failed:', error);
    return null;
  }
}

export class PushNotificationService {
  async sendDonationRequest(params: DonationPushParams): Promise<DonationPushResult> {
    const tokens = [...new Set(params.tokens)].filter(Boolean);
    if (tokens.length === 0) {
      return { success: false, messageId: null, mode: 'disabled', invalidTokens: [] };
    }

    const title = 'A patient needs your help!';
    const article = /^[AO]/i.test(params.bloodGroup) ? 'An' : 'A';
    const body = params.language === 'hi'
      ? `आपके निकट ${params.bloodGroup} रक्तदाता की तत्काल आवश्यकता है।`
      : `${article} ${params.bloodGroup} blood donor is urgently needed near your registered location.`;
    const responsePath =
      `/${params.language || 'en'}/donor/respond/${encodeURIComponent(params.requestId)}` +
      `?responseToken=${encodeURIComponent(params.responseToken)}`;

    if (process.env.MOCK_SERVICES === 'true' || process.env.NODE_ENV === 'test') {
      const messageId = `mock-push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      mockStore.recordOutboundPush({
        id: messageId,
        requestId: params.requestId,
        title,
        body,
        recipientCount: tokens.length,
        timestamp: new Date().toISOString(),
      });
      return { success: true, messageId, mode: 'mock', invalidTokens: [] };
    }

    const messaging = getMessagingClient();
    if (!messaging) {
      console.warn('[@repo/api] FCM is not configured; push notification was not sent.');
      return { success: false, messageId: null, mode: 'disabled', invalidTokens: [] };
    }

    const invalidTokens: string[] = [];
    let firstMessageId: string | null = null;
    let successCount = 0;
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const messages: Message[] = batch.map((token) => ({
        token,
        data: {
          title,
          body,
          requestId: params.requestId,
          responseToken: params.responseToken,
          responsePath,
          icon: '/icons/icon-192x192.png',
          tag: `blood-request-${params.requestId}`,
        },
        webpush: { headers: { TTL: '3600', Urgency: 'high' } },
      }));

      try {
        const result = await messaging.sendEach(messages);
        result.responses.forEach((response, index) => {
          if (response.success) {
            successCount += 1;
            firstMessageId ||= response.messageId || null;
            return;
          }
          const code = response.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) invalidTokens.push(batch[index]!);
        });
      } catch (error) {
        console.error('[@repo/api] FCM batch send failed:', error);
      }
    }

    return {
      success: successCount > 0,
      messageId: firstMessageId,
      mode: 'live',
      invalidTokens,
    };
  }
}

export const pushNotificationService = new PushNotificationService();
