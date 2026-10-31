'use client';

import * as React from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { getWebPushToken, removeWebPushToken } from '../../src/lib/firebase-messaging';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

export function PushNotificationOptIn() {
  const [enabled, setEnabled] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEnabled(localStorage.getItem('raktkhoj_fcm_enabled') === 'true');
  }, []);

  const enable = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const session = localStorage.getItem('raktkhoj_donor_token');
      if (!session) throw new Error('Please register or sign in as a donor first.');
      if (!window.isSecureContext) throw new Error('Notifications require HTTPS (localhost is supported for development).');
      const fcmToken = await getWebPushToken();
      const response = await fetch(`${API_BASE}/api/v1/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify({ fcmToken }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to register this device.');
      localStorage.setItem('raktkhoj_fcm_token', fcmToken);
      localStorage.setItem('raktkhoj_fcm_enabled', 'true');
      setEnabled(true);
      setMessage('This device is ready to receive RaktSetu alerts.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable notifications.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const session = localStorage.getItem('raktkhoj_donor_token');
      const fcmToken = localStorage.getItem('raktkhoj_fcm_token');
      if (session && fcmToken) {
        await fetch(`${API_BASE}/api/v1/push/register`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
          body: JSON.stringify({ fcmToken }),
        });
      }
      await removeWebPushToken().catch(() => undefined);
      localStorage.removeItem('raktkhoj_fcm_token');
      localStorage.removeItem('raktkhoj_fcm_enabled');
      setEnabled(false);
      setMessage('Notifications are disabled on this device.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disable notifications.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-left space-y-3">
      <div className="flex items-center gap-2 text-emerald-900">
        {enabled ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        <h2 className="font-bold">Emergency push notifications</h2>
        <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          {enabled ? 'Enabled on this device' : 'Optional'}
        </span>
      </div>
      <p className="text-sm text-emerald-900/80">
        Get nearby blood requests on this device. You can change this permission any time.
      </p>
      {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</p>}
      <button type="button" disabled={busy} onClick={enabled ? disable : enable}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${enabled ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
        {enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {busy ? 'Please wait…' : enabled ? 'Disable on this device' : 'Enable notifications'}
      </button>
      <p className="text-[11px] text-emerald-900/70">Notification permission is stored by your browser. Enabling this device does not enable notifications on your other devices.</p>
    </section>
  );
}
