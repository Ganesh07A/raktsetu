'use client';

import { getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function hasFirebaseWebConfig(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId);
}

function getFirebaseApp() {
  if (!hasFirebaseWebConfig()) throw new Error('Firebase web configuration is incomplete');
  const existing = getApps().find((app) => app.name === 'raktsetu-web');
  return existing || initializeApp(firebaseConfig, 'raktsetu-web');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export async function getWebPushToken(): Promise<string> {
  if (!(await isSupported())) throw new Error('Push notifications are not supported by this browser');
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('This browser does not support web notifications');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  // Register explicitly here as well as in the app layout. This closes the race where
  // hydration happens after window.load and a load-event listener would never register it.
  await withTimeout(
    navigator.serviceWorker.register('/sw.js'),
    15000,
    'Service worker registration timed out. Refresh the page and try again.'
  );
  const registration = await withTimeout(
    navigator.serviceWorker.ready,
    15000,
    'Service worker did not become active. Refresh the page and try again.'
  );

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('Firebase Web Push certificate (VAPID key) is not configured');

  const token = await withTimeout(
    getToken(getMessaging(getFirebaseApp()), {
      vapidKey,
      serviceWorkerRegistration: registration,
    }),
    20000,
    'Firebase did not return a device token. Check the Firebase web config, VAPID public key, and browser console.'
  );
  if (!token) throw new Error('Firebase returned an empty device token. Check Firebase Messaging configuration.');
  return token;
}

export async function removeWebPushToken(): Promise<void> {
  if (!(await isSupported())) return;
  const messaging = getMessaging(getFirebaseApp());
  await deleteToken(messaging);
}

export async function listenForForegroundPush(
  callback: (payload: MessagePayload) => void
): Promise<() => void> {
  if (!(await isSupported())) return () => undefined;
  return onMessage(getMessaging(getFirebaseApp()), callback);
}
