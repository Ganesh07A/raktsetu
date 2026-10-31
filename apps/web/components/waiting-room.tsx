'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import {
  Clock,
  CheckCircle2,
  PhoneCall,
  AlertCircle,
  Users,
  ShieldCheck,
  Droplet,
  HeartHandshake,
  Check,
  Sparkles,
} from 'lucide-react';
import type {
  BloodRequest,
  DonorNotificationSummary,
  AcceptedDonorContact,
} from '@repo/shared';

export interface WaitingRoomProps {
  requestId: string;
  initialData?: {
    request: BloodRequest;
    notifications: (DonorNotificationSummary & {
      donorName?: string;
      donorBloodGroup?: string;
      donorPhoneMasked?: string;
    })[];
    acceptedDonors: (AcceptedDonorContact & {
      directCallUrl?: string;
    })[];
  };
}

export function WaitingRoom({ requestId, initialData }: WaitingRoomProps) {
  const locale = useLocale();
  const isHi = locale === 'hi';

  const [request, setRequest] = React.useState<BloodRequest | null>(
    initialData?.request || null
  );
  const [notifications, setNotifications] = React.useState<any[]>(
    initialData?.notifications || []
  );
  const [acceptedDonors, setAcceptedDonors] = React.useState<any[]>(
    initialData?.acceptedDonors || []
  );
  const [loading, setLoading] = React.useState(!initialData);

  // Polling engine: Queries GET /api/v1/requests/:id every 3 seconds
  React.useEffect(() => {
    let isMounted = true;

    async function pollRequestStatus() {
      try {
        const res = await fetch(`http://localhost:3002/api/v1/requests/${requestId}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.request) setRequest(data.request);
            if (data.notifications) setNotifications(data.notifications);
            if (data.acceptedDonors) setAcceptedDonors(data.acceptedDonors);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Waiting room polling error:', err);
      }
    }

    pollRequestStatus();
    const interval = setInterval(pollRequestStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [requestId]);

  // Derived metrics
  const sentCount = notifications.length;
  const deliveredCount = notifications.filter((n) =>
    ['delivered', 'read', 'accepted'].includes(n.status)
  ).length;
  const acceptedCount =
    acceptedDonors.length ||
    notifications.filter((n) => n.status === 'accepted').length;

  const isFulfilled =
    request?.status === 'fulfilled' || acceptedDonors.length > 0;

  if (loading && !request) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto p-6 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-red-600 border-t-transparent animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-700">
          {isHi ? 'लाइव वेटिंग रूम लोड हो रहा है...' : 'Connecting to Live Waiting Room...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Live Emergency Status Header Card */}
      <div
        className={`rounded-2xl p-6 sm:p-8 text-white shadow-lg transition-all ${
          isFulfilled
            ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 border-2 border-emerald-400'
            : 'bg-gradient-to-br from-red-600 via-red-700 to-red-900 border-2 border-red-400'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                {isHi ? 'वास्तविक समय लाइव ट्रैकिंग' : 'Live Real-Time Status'}
              </span>
              <span className="text-xs text-red-100 font-mono">#{requestId}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              {request?.patientName} — {request?.bloodGroupNeeded}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-red-100">
              <span className="flex items-center gap-1">
                <strong>{isHi ? 'अस्पताल:' : 'Hospital:'}</strong> {request?.hospitalName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <strong>{isHi ? 'आवश्यकता:' : 'Units:'}</strong> {request?.unitsNeeded} Unit(s) ({request?.componentType})
              </span>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/20">
            <div className="w-16 h-16 rounded-2xl bg-white text-slate-900 flex items-center justify-center font-black text-2xl shadow-md">
              {request?.bloodGroupNeeded}
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
              {isFulfilled
                ? isHi ? '✓ रक्तदाता स्वीकृत' : '✓ Donor Accepted'
                : isHi ? 'प्रतिक्रिया की प्रतीक्षा' : 'Awaiting Responses'}
            </span>
          </div>
        </div>

        {/* Visual Status Progress Flow */}
        <div className="mt-6 pt-6 border-t border-white/20">
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Step 1: Donors Notified */}
            <div className="flex flex-col items-center space-y-1">
              <div className="w-8 h-8 rounded-full bg-white text-emerald-700 flex items-center justify-center font-bold text-sm shadow-xs">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <span className="text-[11px] font-bold">
                {isHi ? 'दाता सूचित' : 'Donors Notified'}
              </span>
              <span className="text-[10px] text-red-100 opacity-80">
                {sentCount} {isHi ? 'संदेश भेजे' : 'Sent'}
              </span>
            </div>

            {/* Step 2: Awaiting Acceptance */}
            <div className="flex flex-col items-center space-y-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${
                  isFulfilled
                    ? 'bg-white text-emerald-700'
                    : 'bg-white/30 text-white animate-pulse'
                }`}
              >
                {isFulfilled ? <Check className="h-4 w-4 stroke-[3]" /> : '2'}
              </div>
              <span className="text-[11px] font-bold">
                {isHi ? 'प्रतीक्षा जारी' : 'Awaiting Acceptance'}
              </span>
              <span className="text-[10px] text-red-100 opacity-80">
                {deliveredCount} {isHi ? 'पहुंचे' : 'Delivered'}
              </span>
            </div>

            {/* Step 3: Donor Accepted */}
            <div className="flex flex-col items-center space-y-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${
                  isFulfilled
                    ? 'bg-amber-300 text-slate-900 ring-4 ring-emerald-300/40'
                    : 'bg-white/20 text-white/60'
                }`}
              >
                {isFulfilled ? <Sparkles className="h-4 w-4 fill-current" /> : '3'}
              </div>
              <span className="text-[11px] font-bold">
                {isHi ? 'रक्तदाता स्वीकृत!' : 'Donor Accepted!'}
              </span>
              <span className="text-[10px] text-red-100 opacity-80">
                {acceptedCount} {isHi ? 'स्वीकृत' : 'Accepted'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Notification Counters Banner */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-slate-200 text-center p-3 sm:p-4">
          <p className="text-xs text-slate-500 font-medium">{isHi ? 'व्हाट्सएप भेजे गए' : 'Alerts Sent'}</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{sentCount}</p>
        </Card>
        <Card className="border border-slate-200 text-center p-3 sm:p-4">
          <p className="text-xs text-slate-500 font-medium">{isHi ? 'डिलीवर हुए' : 'Delivered'}</p>
          <p className="text-xl sm:text-2xl font-black text-blue-600 mt-1">{deliveredCount}</p>
        </Card>
        <Card className="border border-slate-200 text-center p-3 sm:p-4">
          <p className="text-xs text-slate-500 font-medium">{isHi ? 'स्वीकृतियां' : 'Accepted'}</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{acceptedCount}</p>
        </Card>
      </div>

      {/* CRUCIAL FEATURE: UNLOCKED ACCEPTED DONOR CONTACT CARD */}
      {acceptedDonors.length > 0 && (
        <section className="space-y-4">
          <div className="p-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md">
            <div className="bg-white rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-emerald-100 text-emerald-800">
                  <HeartHandshake className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900">
                      {isHi ? 'रक्तदाता संपर्क विवरण अनलॉक हुआ!' : 'Donor Accepted — Contact Unlocked!'}
                    </h2>
                    <Badge variant="success" className="animate-bounce">
                      {isHi ? 'तैयार' : 'Ready to Donate'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    {isHi
                      ? 'रक्तदाता ने अस्पताल आने की पुष्टि की है। तुरंत कॉल या व्हाट्सएप करें:'
                      : 'The volunteer has accepted to donate blood. Connect directly below:'}
                  </p>
                </div>
              </div>

              {/* Accepted Donors List */}
              <div className="space-y-3 pt-2">
                {acceptedDonors.map((donor, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900">{donor.name}</span>
                        <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 font-bold text-xs">
                          {donor.bloodGroup}
                        </Badge>
                        {donor.distanceKm !== undefined && (
                          <span className="text-xs text-slate-500 font-medium">
                            ({donor.distanceKm.toFixed(1)} km away)
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-black text-emerald-900 tracking-wide">
                        {donor.phone}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <a
                        href={`tel:${donor.phone}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
                      >
                        <PhoneCall className="h-4 w-4 fill-current" />
                        <span>{isHi ? 'तुरंत कॉल करें' : 'Call Donor'}</span>
                      </a>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Active Notifications (Masked While Pending) */}
      <Card className="border border-slate-200">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-700" />
              <span>
                {isHi ? 'अधिसूचित स्वयंसेवी रक्तदाता' : 'Notified Volunteer Donors'}
              </span>
            </CardTitle>
            <span className="text-xs text-slate-500 font-medium">
              {isHi ? 'गोपनीयता सुरक्षित' : 'Privacy Protected'}
            </span>
          </div>
          <CardDescription className="text-xs text-slate-500">
            {isHi
              ? 'गोपनीयता के लिए फोन नंबर छिपाए गए हैं। दाता द्वारा स्वीकार करने पर तुरंत अनलॉक होंगे।'
              : 'Donor contact numbers remain masked until accepted to prevent spam.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0">
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              {isHi ? 'कोई सूचना प्रेषित नहीं' : 'No notifications sent'}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const isAccepted = n.status === 'accepted';
                return (
                  <div key={n.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isAccepted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {n.donorBloodGroup || '🩸'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {n.donorName || 'Volunteer Donor'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {isAccepted ? 'Unlocked above' : n.donorPhoneMasked || '+91 98****3210'}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isAccepted ? (
                        <Badge variant="success" className="text-[10px]">
                          {isHi ? '✓ स्वीकृत' : '✓ Accepted'}
                        </Badge>
                      ) : n.status === 'declined' ? (
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300">
                          {isHi ? 'अनुपलब्ध' : 'Declined'}
                        </Badge>
                      ) : n.status === 'delivered' ? (
                        <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50">
                          {isHi ? 'पहुंचा' : 'Delivered'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-600 bg-slate-50">
                          {isHi ? 'भेजा गया' : 'Sent'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
