'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import { Button } from '@repo/ui/button';
import {
  Clock,
  CheckCircle2,
  PhoneCall,
  AlertCircle,
  HeartHandshake,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { BloodRequest, AcceptedDonorContact, DonorNotificationSummary } from '@repo/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

type WaitingRoomNotification = Pick<DonorNotificationSummary, 'id' | 'status' | 'sentAt' | 'respondedAt'>;

export interface WaitingRoomProps {
  requestId: string;
  requestCloseToken?: string | null;
  initialData?: {
    request: BloodRequest;
    notifications: WaitingRoomNotification[];
    acceptedDonors: AcceptedDonorContact[];
  };
}

export function WaitingRoom({ requestId, requestCloseToken, initialData }: WaitingRoomProps) {
  const locale = useLocale();
  const isHi = locale === 'hi';

  const [request, setRequest] = React.useState<BloodRequest | null>(initialData?.request || null);
  const [notifications, setNotifications] = React.useState<WaitingRoomNotification[]>(initialData?.notifications || []);
  const [acceptedDonors, setAcceptedDonors] = React.useState<AcceptedDonorContact[]>(initialData?.acceptedDonors || []);
  const [loading, setLoading] = React.useState(!initialData);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState(false);
  const [closeError, setCloseError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/requests/${encodeURIComponent(requestId)}`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load request status.');

        if (!active) return;
        setRequest(data.request || null);
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setAcceptedDonors(Array.isArray(data.acceptedDonors) ? data.acceptedDonors : []);
        setLoadError(null);
        setLoading(false);

        const status = data.request?.status;
        if (['fulfilled', 'cancelled', 'expired'].includes(status)) {
          if (interval) clearInterval(interval);
        }
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Unable to refresh request status.');
        setLoading(false);
      }
    };

    void poll();
    interval = setInterval(() => { void poll(); }, 3000);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [requestId]);

  const prevDonorsCountRef = React.useRef(initialData?.acceptedDonors?.length || 0);

  React.useEffect(() => {
    if (acceptedDonors.length > prevDonorsCountRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
          osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.8);
        }
      } catch (e) {
        console.warn('Audio playback error:', e);
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
    prevDonorsCountRef.current = acceptedDonors.length;
  }, [acceptedDonors.length]);

  const isFulfilled = request?.status === 'fulfilled' || acceptedDonors.length > 0;
  const hasBankStock = request?.status === 'bank_found';
  const isClosed = request?.status === 'cancelled' || request?.status === 'expired';
  const pushSent = notifications.some((item) =>
    ['sent', 'delivered', 'read', 'accepted'].includes(item.status)
  );
  const allFailed = notifications.length > 0 && notifications.every((item) => item.status === 'failed');

  const handleCloseSearch = async () => {
    if (!requestCloseToken || closing || isFulfilled || isClosed) return;
    setClosing(true);
    setCloseError(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/requests/${encodeURIComponent(requestId)}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestCloseToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to close this search.');
      setRequest((current) => current ? { ...current, status: 'cancelled', fulfillmentSource: null } : current);
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : 'Unable to close this search.');
    } finally {
      setClosing(false);
    }
  };

  if (loading && !request) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-red-600" />
        <p className="mt-3 text-sm font-semibold text-slate-700">
          {isHi ? 'लाइव अनुरोध स्थिति लोड हो रही है…' : 'Loading live request status…'}
        </p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5 text-center">
        <AlertCircle className="mx-auto h-7 w-7 text-red-700" />
        <p role="alert" className="mt-2 text-sm text-red-800">{loadError || 'Request not found.'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      {acceptedDonors.length > 0 && (
        <section className="space-y-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 p-5 shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <HeartHandshake className="h-6 w-6 text-emerald-700" />
            <h2 className="text-lg font-black text-emerald-950">
              {isHi ? '🎉 रक्तदाता मिल गया! दाता ने आपका अनुरोध स्वीकार किया है:' : '🎉 Life Saver Found! A donor accepted your request:'}
            </h2>
          </div>
          {acceptedDonors.map((donor) => {
            const cleanPhone = donor.phone.replace(/[^0-9]/g, '');
            return (
              <Card key={donor.donorId} className="border-emerald-300 bg-white shadow-sm">
                <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-black text-slate-900">{donor.name}</p>
                      <Badge variant="success" className="font-bold text-xs">{donor.bloodGroup}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {donor.distanceKm !== null && donor.distanceKm !== undefined
                        ? `📍 ${donor.distanceKm.toFixed(1)} km away from patient`
                        : (isHi ? 'दूरी उपलब्ध नहीं' : 'Distance unavailable')}
                    </p>
                    <p className="text-sm font-black text-emerald-800 font-mono tracking-wide">{donor.phone}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={`tel:${donor.phone}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 shadow transition"
                    >
                      <PhoneCall className="h-4 w-4" />
                      {isHi ? 'रक्तदाता को कॉल करें' : 'Call Donor Now'}
                    </a>
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                          isHi
                            ? 'नमस्ते, RaktSetu पर रक्त दान अनुरोध स्वीकार करने के लिए धन्यवाद।'
                            : 'Hello, thank you for accepting our blood donation request on RaktSetu.'
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 shadow transition"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
      <Card className={isFulfilled ? 'border-emerald-300 bg-emerald-50/50' : isClosed ? 'border-slate-300 bg-slate-50' : 'border-red-200'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <Badge variant={isFulfilled || hasBankStock ? 'success' : 'outline'}>
              {hasBankStock
                ? (isHi ? 'ब्लड बैंक स्टॉक उपलब्ध' : 'Blood bank stock found')
                : isFulfilled
                  ? (isHi ? 'दाता ने अनुरोध स्वीकार किया' : 'Donor accepted')
                  : isClosed
                  ? (isHi ? 'खोज बंद' : 'Search closed')
                  : (isHi ? 'प्रतिक्रिया की प्रतीक्षा' : 'Waiting for responses')}
            </Badge>
            <span className="text-[11px] text-slate-500 font-mono">#{requestId}</span>
          </div>
          <CardTitle className="pt-2 text-xl">{request.patientName} · {request.bloodGroupNeeded}</CardTitle>
          <CardDescription>
            {request.hospitalName} · {request.unitsNeeded} {isHi ? 'यूनिट' : 'unit(s)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasBankStock ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{isHi ? 'चुने गए दायरे में ब्लड बैंक स्टॉक मिला। इसलिए रक्तदाता पुश अलर्ट भेजने की आवश्यकता नहीं पड़ी।' : 'Blood bank stock was found for this request, so no donor push alerts were needed.'}</p>
            </div>
          ) : isFulfilled ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{isHi ? 'एक या अधिक रक्तदाताओं ने अनुरोध स्वीकार किया है। नीचे उनके संपर्क विवरण उपलब्ध हैं।' : 'One or more registered donors accepted this request. Their contact details are shown below.'}</p>
            </div>
          ) : isClosed ? (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{isHi ? 'यह खोज बंद कर दी गई है। अब इस अनुरोध के लिए नए अलर्ट नहीं भेजे जाएंगे।' : 'This search is closed. No further alerts will be sent for this request.'}</p>
            </div>
          ) : pushSent ? (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <Clock className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{isHi ? 'आपके क्षेत्र के योग्य और सूचना-सक्षम रक्तदाताओं को अलर्ट भेजे गए हैं। हम उनके उत्तर की प्रतीक्षा कर रहे हैं।' : 'Push notifications have been sent to eligible nearby donors who enabled alerts. We are waiting for their responses.'}</p>
            </div>
          ) : allFailed ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{isHi ? 'अलर्ट डिलीवर नहीं हो सके। कृपया बाद में पुनः प्रयास करें या अस्पताल से संपर्क करें।' : 'The push alerts could not be delivered. Please try again later or contact the blood bank directly.'}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <Clock className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{isHi ? 'इस क्षेत्र में सक्रिय सूचना-सदस्यता वाले संगत रक्तदाता नहीं मिले।' : 'No compatible nearby donors with an active push subscription were found for this request.'}</p>
            </div>
          )}
          {loadError && <p role="alert" className="text-xs text-red-700">{loadError}</p>}
        </CardContent>
      </Card>

      {!isFulfilled && !hasBankStock && !isClosed && requestCloseToken && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-300"
            disabled={closing}
            onClick={handleCloseSearch}
          >
            {closing ? (isHi ? 'खोज बंद हो रही है…' : 'Closing search…') : (isHi ? 'मुझे रक्तदाता मिल गया — खोज बंद करें' : "I've found help — close search")}
          </Button>
          {closeError && <p role="alert" className="text-xs text-red-700">{closeError}</p>}
        </div>
      )}
    </div>
  );
}
