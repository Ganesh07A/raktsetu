'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Do not wait for window.load: React may hydrate after that event has already fired.
    // Register immediately so callers awaiting navigator.serviceWorker.ready cannot hang.
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log(
        '[SW] ServiceWorker registration successful with scope:',
        registration.scope
      );
    }).catch((error) => {
      console.warn('[SW] ServiceWorker registration failed:', error);
    });
  }, []);

  return null;
}
