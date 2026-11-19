'use client';

import * as React from 'react';
import { Send, CheckCircle2, AlertCircle, ExternalLink, Unlink, Bell, BellOff, RefreshCw } from 'lucide-react';

const API_BASE = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002');

export function TelegramNotificationOptIn() {
  const [connected, setConnected] = React.useState(false);
  const [alertsEnabled, setAlertsEnabled] = React.useState(true);
  const [telegramUsername, setTelegramUsername] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deepLink, setDeepLink] = React.useState<string | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const session = localStorage.getItem('raktkhoj_donor_token');
      if (!session) {
        setChecking(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/v1/telegram/status`, {
        headers: { Authorization: `Bearer ${session}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          setConnected(Boolean(data.connected));
          if (data.subscription) {
            setAlertsEnabled(Boolean(data.subscription.alertsEnabled));
            setTelegramUsername(data.subscription.telegramUsername || null);
          } else {
            setTelegramUsername(null);
          }
        }
      }
    } catch {
      // Quiet fail on status check
    } finally {
      setChecking(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Connect flow: Request single-use link token and launch deep link
  const connectTelegram = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const session = localStorage.getItem('raktkhoj_donor_token');
      if (!session) throw new Error('Please register or sign in as a donor first.');

      const response = await fetch(`${API_BASE}/api/v1/telegram/link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to generate Telegram connection link.');

      if (data.deepLink) {
        setDeepLink(data.deepLink);
        // Open Telegram bot in new tab
        window.open(data.deepLink, '_blank', 'noopener,noreferrer');
        setMessage('Telegram opened. Press "Start" in Telegram to complete linking.');

        // Poll for completion every 3 seconds for 60 seconds
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const checkRes = await fetch(`${API_BASE}/api/v1/telegram/status`, {
            headers: { Authorization: `Bearer ${session}` },
            cache: 'no-store',
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json().catch(() => ({}));
            if (checkData.connected) {
              setConnected(true);
              setTelegramUsername(checkData.subscription?.telegramUsername || null);
              setAlertsEnabled(Boolean(checkData.subscription?.alertsEnabled));
              setMessage('✅ Telegram account successfully linked! You will receive emergency alerts here.');
              clearInterval(interval);
            }
          }
          if (attempts >= 20) {
            clearInterval(interval);
          }
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect Telegram.');
    } finally {
      setBusy(false);
    }
  };

  // Disconnect flow
  const disconnectTelegram = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const session = localStorage.getItem('raktkhoj_donor_token');
      if (!session) throw new Error('Please register or sign in as a donor first.');

      const response = await fetch(`${API_BASE}/api/v1/telegram/unlink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to disconnect Telegram.');

      setConnected(false);
      setTelegramUsername(null);
      setDeepLink(null);
      setMessage('Telegram disconnected. You will no longer receive alerts on Telegram.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disconnect Telegram.');
    } finally {
      setBusy(false);
    }
  };

  // Toggle alerts
  const toggleAlerts = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const nextVal = !alertsEnabled;
    try {
      const session = localStorage.getItem('raktkhoj_donor_token');
      if (!session) throw new Error('Please register or sign in as a donor first.');

      const response = await fetch(`${API_BASE}/api/v1/telegram/preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({ alertsEnabled: nextVal }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to update preferences.');

      setAlertsEnabled(nextVal);
      setMessage(nextVal ? 'Telegram alerts are now enabled.' : 'Telegram alerts are paused.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update preferences.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 text-left text-xs text-sky-800">
        Checking Telegram connection status…
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 text-left space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sky-950">
          <Send className="h-5 w-5 text-sky-600" />
          <h2 className="font-bold text-base">Telegram Donor Notifications</h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              connected ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {connected ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Connected {telegramUsername ? `(${telegramUsername})` : ''}
              </span>
            ) : (
              'Not Connected'
            )}
          </span>
          {connected && (
            <button
              type="button"
              onClick={void fetchStatus}
              title="Refresh status"
              className="p-1 text-sky-700 hover:text-sky-900 rounded"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-sky-900/80 leading-relaxed">
        Receive emergency blood requests directly in Telegram. You can respond with{' '}
        <span className="font-semibold text-slate-800">❤️ I&apos;m Available</span> or{' '}
        <span className="font-semibold text-slate-800">❌ Not Available</span> with a single tap.
      </p>

      {message && (
        <div role="status" className="p-3 bg-white/80 rounded-lg border border-sky-200 text-sm text-sky-900 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {!connected ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={connectTelegram}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {busy ? 'Opening Telegram…' : 'Connect Telegram'}
            </button>

            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 underline"
              >
                <span>Open Bot Manually</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={toggleAlerts}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
                alertsEnabled
                  ? 'bg-slate-700 hover:bg-slate-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {alertsEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {busy ? 'Updating…' : alertsEnabled ? 'Pause Alerts' : 'Resume Alerts'}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={disconnectTelegram}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition disabled:opacity-60"
            >
              <Unlink className="h-4 w-4 text-slate-500" />
              Disconnect
            </button>
          </>
        )}
      </div>

      <div className="text-[11px] text-sky-950/70 border-t border-sky-200/60 pt-3">
        {!connected ? (
          <span>
            Instructions: Click &ldquo;Connect Telegram&rdquo;, press <strong>Start</strong> in{' '}
            <code className="text-sky-800">@RaktKhojDonorBot</code>, and your account will link automatically.
          </span>
        ) : (
          <span>
            Your Telegram chat is securely linked. You can type <code className="text-sky-800">/status</code> or{' '}
            <code className="text-sky-800">/unlink</code> in Telegram at any time.
          </span>
        )}
      </div>
    </section>
  );
}
