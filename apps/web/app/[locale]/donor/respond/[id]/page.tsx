'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '../../../../../src/routing';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import {
  Heart,
  Droplet,
  Building2,
  Navigation,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Clock,
  MapPin,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { BloodRequest } from '@repo/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

export default function DonorRespondPage() {
  const locale = useLocale();
  const isHi = locale === 'hi';
  const params = useParams();
  const searchParams = useSearchParams();

  const requestId = (params?.id as string) || '';
  const responseToken = searchParams.get('responseToken') || '';
  const autoAction = searchParams.get('action');
  const autoActionHandled = React.useRef(false);

  const [request, setRequest] = React.useState<BloodRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Response state
  const [submitting, setSubmitting] = React.useState(false);
  const [respondedStatus, setRespondedStatus] = React.useState<'accepted' | 'declined' | null>(null);

  React.useEffect(() => {
    async function loadRequest() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/requests/${requestId}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error('Emergency request not found');
        }
        const data = await res.json();
        setRequest(data.request);
      } catch (err: any) {
        setError(err.message || 'Error loading request');
      } finally {
        setLoading(false);
      }
    }

    if (requestId) {
      loadRequest();
    }
  }, [requestId]);

  const handleRespond = async (status: 'accepted' | 'declined') => {
    setSubmitting(true);
    try {
      if (!responseToken) throw new Error('This notification response link is missing or expired.');
      const res = await fetch(`${API_BASE}/api/v1/push/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: status, responseToken }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to record response');
      }

      setRespondedStatus(status);
    } catch (err: any) {
      alert(err.message || 'Error submitting response');
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (loading || !request || !responseToken || autoActionHandled.current) return;
    if (autoAction !== 'accepted' && autoAction !== 'declined') return;
    autoActionHandled.current = true;
    void (async () => {
      setSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/push/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: autoAction, responseToken }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || 'Unable to record notification response');
        setRespondedStatus(autoAction);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to record response');
      } finally {
        setSubmitting(false);
      }
    })();
  }, [loading, request, responseToken, autoAction]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-10 h-10 rounded-full border-4 border-red-600 border-t-transparent animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-700">
          {isHi ? 'आपातकालीन अनुरोध लोड हो रहा है...' : 'Loading Emergency Request...'}
        </p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          {isHi ? 'अनुरोध नहीं मिला' : 'Request Not Found'}
        </h2>
        <p className="text-sm text-slate-600">
          {isHi
            ? 'यह रक्त अनुरोध समाप्त हो चुका है अथवा लिंक अमान्य है।'
            : 'This blood request has either expired or the link is invalid.'}
        </p>
        <Button asChild className="bg-red-600 text-white font-bold">
          <Link href="/">
            <span>{isHi ? 'मुख्य पृष्ठ' : 'Go Home'}</span>
          </Link>
        </Button>
      </div>
    );
  }

  // Response Completed State
  if (respondedStatus === 'accepted') {
    return (
      <div className="max-w-xl mx-auto py-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg animate-bounce">
          <Heart className="h-10 w-10 fill-current" />
        </div>

        <div className="space-y-2">
          <Badge variant="success" className="text-xs px-3 py-1 font-bold">
            {isHi ? '✓ स्वीकृति दर्ज हुई' : '✓ Acceptance Recorded'}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {isHi ? 'एक जीवन बचाने के लिए धन्यवाद!' : 'Thank You For Saving a Life!'}
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {isHi
              ? 'मरीज के परिजनों को आपकी स्वीकृति की सूचना दे दी गई है। कृपया यथाशीघ्र अस्पताल पहुंचें।'
              : 'The family has been alerted that you are on your way. Please head to the hospital as soon as possible.'}
          </p>
        </div>

        {/* Hospital Directions Card */}
        <Card className="border-2 border-emerald-300 bg-emerald-50/50 text-left p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                {isHi ? 'गंतव्य अस्पताल' : 'Hospital Destination'}
              </p>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">{request.hospitalName}</h3>
              <p className="text-xs text-slate-600 mt-1">
                {isHi ? 'रोगी का नाम:' : 'Patient Name:'} <strong className="text-slate-900">{request.patientName}</strong>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-600 text-white font-black text-xl flex items-center justify-center">
              {request.bloodGroupNeeded}
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
            >
              <Navigation className="h-4 w-4" />
              <span>{isHi ? 'गूगल मैप्स नेविगेशन' : 'Google Maps Directions'}</span>
            </a>

            <Button asChild variant="outline" className="border-slate-300 text-xs">
              <Link href={`/request/${requestId}`}>
                <span>{isHi ? 'वेटिंग रूम देखें' : 'View Waiting Room'}</span>
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (respondedStatus === 'declined') {
    return (
      <div className="max-w-xl mx-auto py-10 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
          <XCircle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isHi ? 'हमें सूचित करने के लिए धन्यवाद!' : 'Thank You for Letting Us Know!'}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {isHi
              ? 'हम समझते हैं कि आप इस समय उपलब्ध नहीं हैं। सिस्टम अन्य नजदीकी संगत रक्तदाताओं को सूचित करेगा।'
              : 'We understand you are unavailable right now. Other compatible volunteer donors have been alerted.'}
          </p>
        </div>
        <Button asChild variant="outline" className="border-slate-300">
          <Link href="/">
            <span>{isHi ? 'मुख्य पृष्ठ' : 'Go Home'}</span>
          </Link>
        </Button>
      </div>
    );
  }

  // Active Emergency Response Screen
  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Urgency Alert Badge */}
      <div className="p-4 rounded-xl border border-red-300 bg-red-50 text-center space-y-1">
        <Badge variant="destructive" className="animate-pulse">
          {isHi ? 'तत्काल रक्त आवश्यकता' : 'Urgent Emergency Blood Request'}
        </Badge>
        <p className="text-xs text-red-900 font-semibold">
          {isHi
            ? 'आपके पंजीकृत स्थान के निकट एक मरीज को तत्काल रक्त की आवश्यकता है।'
            : 'A patient near your registered location urgently requires blood.'}
        </p>
      </div>

      {/* Request Details Card */}
      <Card className="border-2 border-red-200 shadow-md">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isHi ? 'रक्त अनुरोध विवरण' : 'Blood Request Summary'}
              </p>
              <CardTitle className="text-2xl font-black text-slate-900 mt-1">
                {request.patientName}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                <Building2 className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <span className="font-semibold text-slate-800">{request.hospitalName}</span>
              </CardDescription>
            </div>

            <div className="w-16 h-16 rounded-2xl bg-red-600 text-white font-black text-2xl flex items-center justify-center shadow-sm">
              {request.bloodGroupNeeded}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-500">{isHi ? 'आवश्यक मात्रा:' : 'Units Needed:'}</span>
              <p className="font-bold text-slate-900 mt-0.5">{request.unitsNeeded} Unit(s) ({request.componentType})</p>
            </div>
            <div>
              <span className="text-slate-500">{isHi ? 'आपातकाल प्रकार:' : 'Emergency Type:'}</span>
              <p className="font-bold text-slate-900 mt-0.5 uppercase">{request.emergencyType || 'Critical'}</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {!responseToken && <p role="alert" className="text-xs text-red-700 text-center">This response link is invalid or expired. Open the latest RaktSetu notification to respond.</p>}
            <p className="text-xs font-bold text-slate-800 text-center">
              {isHi
                ? 'क्या आप अभी इस मरीज के लिए रक्तदान कर सकते हैं?'
                : 'Can you donate blood for this patient right now?'}
            </p>

            {/* TWO LARGE INTERACTIVE ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => handleRespond('accepted')}
                loading={submitting}
                disabled={!responseToken}
                className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  {isHi ? '✅ मैं रक्तदान के लिए तैयार हूँ' : '✅ I Can Donate'}
                </span>
              </Button>

              <Button
                type="button"
                onClick={() => handleRespond('declined')}
                loading={submitting}
                disabled={!responseToken}
                variant="outline"
                className="h-14 border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
                <span>
                  {isHi ? '❌ अभी उपलब्ध नहीं' : '❌ Not Available'}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
