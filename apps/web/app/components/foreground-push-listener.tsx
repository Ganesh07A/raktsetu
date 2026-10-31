'use client';

import { useEffect } from 'react';
import { listenForForegroundPush } from '../../src/lib/firebase-messaging';

// The standard DOM NotificationOptions type omits the service-worker actions extension.
type ActionableNotificationOptions = NotificationOptions & {
  actions: Array<{ action: string; title: string }>;
};

export function ForegroundPushListener() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    void listenForForegroundPush(async (payload) => {
      if (!active || !('serviceWorker' in navigator)) return;
      const data = payload.data || {};
      const registration = await navigator.serviceWorker.ready;
      const options: ActionableNotificationOptions = {
        body: data.body || 'A nearby patient may need your help.',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: data.tag || `raktsetu-${data.requestId || 'alert'}`,
        data: { responsePath: data.responsePath || '/' },
        requireInteraction: true,
        actions: data.language === 'hi'
          ? [
              { action: 'accept', title: 'मैं उपलब्ध हूँ' },
              { action: 'decline', title: 'अभी उपलब्ध नहीं' },
            ]
          : [
              { action: 'accept', title: "I'm available" },
              { action: 'decline', title: 'Not available' },
            ],
      };
      await registration.showNotification(data.title || 'RaktSetu', options);
    }).then((stop) => { if (active) unsubscribe = stop; else stop(); }).catch((error) => {
      console.warn('[Push] Foreground listener unavailable:', error);
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return null;
}
