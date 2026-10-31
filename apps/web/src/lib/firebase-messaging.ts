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

export async function getWebPushToken(): Promise<string> {
  if (!(await isSupported())) throw new Error('Push notifications are not supported by this browser');
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('This browser does not support web notifications');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');
  const registration = await navigator.serviceWorker.ready;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('Firebase Web Push certificate (VAPID key) is not configured');
  return getToken(getMessaging(getFirebaseApp()), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
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
