'use client';

import { useEffect } from 'react';
import { listenForForegroundPush } from '../../src/lib/firebase-messaging';

export function ForegroundPushListener() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    void listenForForegroundPush(async (payload) => {
      if (!active || !('serviceWorker' in navigator)) return;
      const data = payload.data || {};
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(data.title || 'RaktSetu', {
        body: data.body || 'A nearby patient may need your help.',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        tag: data.tag || `raktsetu-${data.requestId || 'alert'}`,
        data: { responsePath: data.responsePath || '/' },
        actions: [
          { action: 'accept', title: "I'm available" },
          { action: 'decline', title: 'Not available' },
        ],
      });
    }).then((stop) => { if (active) unsubscribe = stop; else stop(); }).catch((error) => {
      console.warn('[Push] Foreground listener unavailable:', error);
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return null;
}
