'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '../../../../src/routing';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import {
  Droplet,
  MapPin,
  Clock,
  Activity,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { PushNotificationOptIn } from '../../../components/push-notification-opt-in';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

type DonorProfileView = {
  id: string;
  name: string | null;
  phone: string | null;
  bloodGroup: string;
  state: string;
  district: string;
  city?: string | null;
  isAvailable: boolean;
  searchRadiusKm: number;
  lastDonationDate?: string | null;
  createdAt: string;
};

type AcceptedRequest = {
  requestId: string;
  patientName: string;
  hospitalName: string;
  bloodGroupNeeded: string;
  unitsNeeded: number;
  requestCreatedAt: string;
  respondedAt: string | null;
};

export default function DonorDashboardPage() {
  const locale = useLocale();
  const isHi = locale === 'hi';

  const [donorId, setDonorId] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<DonorProfileView | null>(null);
  const [acceptedRequests, setAcceptedRequests] = React.useState<AcceptedRequest[]>([]);
  const [confirmedDonationsCount, setConfirmedDonationsCount] = React.useState(0);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [updatingAvailability, setUpdatingAvailability] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const storedId = localStorage.getItem('raktkhoj_donor_id');
    if (storedId) {
      setDonorId(storedId);
    } else {
      setProfileError(isHi ? 'दाता सत्र नहीं मिला। कृपया पहले पंजीकरण करें।' : 'Donor session not found. Please register first.');
      setLoading(false);
    }
  }, [isHi]);

  React.useEffect(() => {
    if (!donorId) return;
    const currentDonorId = donorId;

    const controller = new AbortController();
    async function loadProfile() {
      setLoading(true);
      setProfileError(null);
      try {
        const session = localStorage.getItem('raktkhoj_donor_token');
        if (!session) throw new Error('Donor sign-in session is missing. Please register again.');

        const response = await fetch(`${API_BASE}/api/v1/donors/profile/${encodeURIComponent(currentDonorId)}`, {
          headers: { Authorization: `Bearer ${session}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Unable to load donor profile.');
        if (!data.profile) throw new Error('Donor profile was not returned by the API.');

        setProfile(data.profile as DonorProfileView);
        setIsAvailable(Boolean(data.profile.isAvailable));
        setAcceptedRequests(Array.isArray(data.acceptedRequests) ? data.acceptedRequests : []);
        setConfirmedDonationsCount(Number(data.confirmedDonationsCount || 0));
      } catch (error) {
        if (controller.signal.aborted) return;
        setProfileError(error instanceof Error ? error.message : 'Unable to load donor profile.');
        setProfile(null);
        setAcceptedRequests([]);
        setConfirmedDonationsCount(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [donorId]);

  const handleToggleAvailability = async () => {
    if (!donorId) return;
    const session = localStorage.getItem('raktkhoj_donor_token');
    if (!session) {
      setStatusMessage(null);
      setProfileError('Donor sign-in session is missing. Please register again.');
      return;
    }

    const nextValue = !isAvailable;
    setUpdatingAvailability(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/donors/profile/${encodeURIComponent(donorId)}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
        },
        body: JSON.stringify({ isAvailable: nextValue }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update availability.');

      setIsAvailable(nextValue);
      setProfile((current) => current ? { ...current, isAvailable: nextValue } : current);
      setStatusMessage(
        nextValue
          ? (isHi ? 'आपकी स्थिति उपलब्ध में बदल दी गई है।' : 'Status set to Available.')
          : (isHi ? 'आपकी स्थिति अनुपलब्ध में बदल दी गई है।' : 'Status set to Unavailable.')
      );
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update availability.');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return isHi ? 'दर्ज नहीं' : 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN');
  };

  if (loading) {
    return <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">
      {isHi ? 'दाता प्रोफ़ाइल लोड हो रही है…' : 'Loading donor profile…'}
    </div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-700" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">{isHi ? 'प्रोफ़ाइल उपलब्ध नहीं' : 'Profile unavailable'}</h1>
        <p role="alert" className="mt-2 text-sm text-slate-700">{profileError || 'Unable to load donor profile.'}</p>
        <Link href="/donor/register" className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
          {isHi ? 'दाता पंजीकरण' : 'Donor registration'}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-600 to-red-800 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-red-600 shadow-md">
              {profile.bloodGroup}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black sm:text-2xl">{profile.name || (isHi ? 'रक्तदाता' : 'Blood donor')}</h1>
                <Badge variant="outline" className="border-white/30 bg-white/20 text-[10px] text-white">
                  {isHi ? 'पंजीकृत दाता' : 'Registered donor'}
                </Badge>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-red-100">
                <MapPin className="h-3.5 w-3.5" />
                <span>{profile.district}, {profile.state}</span>
                <span>•</span>
                <span>{profile.phone || ''}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-red-900/40 p-3 backdrop-blur-xs">
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-medium text-red-200">{isHi ? 'दान उपलब्धता' : 'Availability'}</p>
              <p className="text-sm font-bold text-white">
                {isAvailable ? (isHi ? 'उपलब्ध' : 'Available') : (isHi ? 'अनुपलब्ध' : 'Unavailable')}
              </p>
            </div>
            <button
              type="button"
              disabled={updatingAvailability}
              aria-label={isAvailable ? 'Set unavailable' : 'Set available'}
              aria-pressed={isAvailable}
              onClick={handleToggleAvailability}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors ${isAvailable ? 'bg-emerald-500' : 'bg-slate-400'} disabled:opacity-60`}
            >
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition ${isAvailable ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      <PushNotificationOptIn />

      {profileError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
          <AlertCircle className="h-4 w-4" />
          <span>{profileError}</span>
        </div>
      )}
      {statusMessage && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border border-slate-200 p-4 text-center">
          <Droplet className="mx-auto h-5 w-5 text-red-600" />
          <p className="mt-2 text-2xl font-black text-slate-900">{confirmedDonationsCount}</p>
          <p className="text-xs text-slate-500">{isHi ? 'पुष्ट रक्तदान' : 'Confirmed donations'}</p>
        </Card>
        <Card className="border border-slate-200 p-4 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
          <p className="mt-2 text-2xl font-black text-slate-900">{acceptedRequests.length}</p>
          <p className="text-xs text-slate-500">{isHi ? 'स्वीकृत अनुरोध' : 'Accepted requests'}</p>
        </Card>
        <Card className="border border-slate-200 p-4 text-center">
          <Activity className="mx-auto h-5 w-5 text-blue-600" />
          <p className="mt-2 text-2xl font-black text-slate-900">{profile.searchRadiusKm} km</p>
          <p className="text-xs text-slate-500">{isHi ? 'प्रतिक्रिया दायरा' : 'Response radius'}</p>
        </Card>
        <Card className="border border-slate-200 p-4 text-center">
          <Calendar className="mx-auto h-5 w-5 text-amber-600" />
          <p className="mt-2 text-lg font-black text-slate-900">{formatDate(profile.lastDonationDate)}</p>
          <p className="text-xs text-slate-500">{isHi ? 'पिछला रक्तदान' : 'Last donation'}</p>
        </Card>
      </div>

      <Card className="border border-slate-200">
        <CardHeader className="p-4 pb-3 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Clock className="h-4 w-4 text-red-600" />
              <span>{isHi ? 'आपातकालीन प्रतिक्रिया इतिहास' : 'Emergency response history'}</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">{acceptedRequests.length} {isHi ? 'अनुरोध' : 'requests'}</Badge>
          </div>
          <CardDescription className="text-xs text-slate-500">
            {isHi
              ? 'यहाँ केवल वे अनुरोध दिखते हैं जिन्हें आपने स्वीकार किया है।'
              : 'Only emergency requests that you accepted are listed here. An accepted request is not proof that a blood donation was completed.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5">
          {acceptedRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <Droplet className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {isHi ? 'अभी कोई स्वीकृत अनुरोध नहीं है।' : 'No accepted requests yet.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isHi ? 'आपके द्वारा अनुरोध स्वीकार करने के बाद इतिहास यहाँ दिखेगा।' : 'Your response history will appear here after you accept an emergency request.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {acceptedRequests.map((item) => (
                <div key={item.requestId} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.hospitalName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {isHi ? 'रोगी:' : 'Patient:'} {item.patientName} • {formatDate(item.respondedAt || item.requestCreatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-xs font-bold text-red-700">{item.bloodGroupNeeded}</Badge>
                    <Badge variant="success" className="text-xs">{isHi ? 'अनुरोध स्वीकृत' : 'Request accepted'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
