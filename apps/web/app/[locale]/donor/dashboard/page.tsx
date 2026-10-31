'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '../../../../src/routing';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import {
  Heart,
  Droplet,
  ShieldCheck,
  Calendar,
  MapPin,
  Clock,
  Activity,
  Award,
  Phone,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react';
import type { DonorProfile } from '@repo/shared';
import { PushNotificationOptIn } from '../../../components/push-notification-opt-in';

export default function DonorDashboardPage() {
  const locale = useLocale();
  const isHi = locale === 'hi';

  const [donorId, setDonorId] = React.useState<string>('donor-rahul-a-pos');
  const [profile, setProfile] = React.useState<any | null>(null);
  const [isAvailable, setIsAvailable] = React.useState<boolean>(true);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [updatingAvailability, setUpdatingAvailability] = React.useState<boolean>(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Load donor ID from localStorage if available
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('raktkhoj_donor_id');
      if (storedId) {
        setDonorId(storedId);
      }
    }
  }, []);

  // Fetch donor profile
  React.useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3002/api/v1/donors/profile/${donorId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setProfile(data.profile);
            setIsAvailable(data.profile.isAvailable ?? true);
          }
        } else {
          // Fallback to default mock profile if ID not found
          setProfile({
            id: donorId,
            name: 'Rahul Sharma',
            phone: '+91 98765 43210',
            bloodGroup: 'A+',
            state: 'Delhi',
            district: 'South Delhi',
            city: 'New Delhi',
            isAvailable: true,
            weightKg: 70,
            searchRadiusKm: 10,
            lastDonationDate: '2026-06-15',
            createdAt: '2026-01-10T10:00:00Z',
          });
        }
      } catch {
        // Fallback
        setProfile({
          id: donorId,
          name: 'Rahul Sharma',
          phone: '+91 98765 43210',
          bloodGroup: 'A+',
          state: 'Delhi',
          district: 'South Delhi',
          city: 'New Delhi',
          isAvailable: true,
          weightKg: 70,
          searchRadiusKm: 10,
          lastDonationDate: '2026-06-15',
          createdAt: '2026-01-10T10:00:00Z',
        });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [donorId]);

  // Toggle Availability
  const handleToggleAvailability = async () => {
    const nextVal = !isAvailable;
    setUpdatingAvailability(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`http://localhost:3002/api/v1/donors/profile/${donorId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: nextVal }),
      });

      if (res.ok) {
        setIsAvailable(nextVal);
        setStatusMessage(
          nextVal
            ? (isHi ? 'आपकी स्थिति "उपलब्ध" में बदल दी गई है' : 'Status set to Available')
            : (isHi ? 'आपकी स्थिति "अनुपलब्ध" में बदल दी गई है' : 'Status set to Unavailable')
        );
      } else {
        setIsAvailable(nextVal);
      }
    } catch {
      setIsAvailable(nextVal);
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const donationHistory = [
    {
      id: 'req-hist-1',
      date: '2026-09-12',
      hospital: 'AIIMS Trauma Center, New Delhi',
      patient: 'Rohan Verma',
      bloodGroup: 'A+',
      status: 'Fulfilled / दान संपन्न',
    },
    {
      id: 'req-hist-2',
      date: '2026-04-18',
      hospital: 'Safdarjung Hospital Regional Blood Centre',
      patient: 'Kavita Singh',
      bloodGroup: 'A+',
      status: 'Fulfilled / दान संपन्न',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-600 to-red-800 text-white p-6 sm:p-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white text-red-600 font-black text-2xl flex items-center justify-center shadow-md">
              {profile?.bloodGroup || 'A+'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black">{profile?.name || 'Rahul Sharma'}</h1>
                <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px]">
                  Life Saver
                </Badge>
              </div>
              <p className="text-xs text-red-100 mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{profile?.district || 'South Delhi'}, {profile?.state || 'Delhi'}</span>
                <span>•</span>
                <span>{profile?.phone || '+91 98765 43210'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-red-900/40 p-3 rounded-xl border border-white/10 backdrop-blur-xs">
            <div className="text-left sm:text-right">
              <p className="text-[11px] text-red-200 font-medium">{isHi ? 'दान उपलब्धता' : 'Availability'}</p>
              <p className="text-sm font-bold text-white">
                {isAvailable ? (isHi ? 'सक्रिय (उपलब्ध)' : 'Active (Available)') : (isHi ? 'अनुपलब्ध' : 'Paused')}
              </p>
            </div>
            <button
              type="button"
              disabled={updatingAvailability}
              onClick={handleToggleAvailability}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isAvailable ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isAvailable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <PushNotificationOptIn />

      {statusMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Contribution Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-slate-200 p-4 text-center">
          <Droplet className="h-5 w-5 text-red-600 mx-auto" />
          <p className="text-2xl font-black text-slate-900 mt-2">2</p>
          <p className="text-xs text-slate-500">{isHi ? 'कुल रक्तदान' : 'Total Donations'}</p>
        </Card>
        <Card className="border border-slate-200 p-4 text-center">
          <Heart className="h-5 w-5 text-emerald-600 mx-auto" />
          <p className="text-2xl font-black text-slate-900 mt-2">6</p>
          <p className="text-xs text-slate-500">{isHi ? 'प्राण सुरक्षित' : 'Lives Impacted'}</p>
        </Card>
        <Card className="border border-slate-200 p-4 text-center">
          <Activity className="h-5 w-5 text-blue-600 mx-auto" />
          <p className="text-2xl font-black text-slate-900 mt-2">10 km</p>
          <p className="text-xs text-slate-500">{isHi ? 'दायरा प्राथमिकता' : 'Response Radius'}</p>
        </Card>
        <Card className="border border-slate-200 p-4 text-center">
          <Award className="h-5 w-5 text-amber-600 mx-auto" />
          <p className="text-2xl font-black text-slate-900 mt-2">Gold</p>
          <p className="text-xs text-slate-500">{isHi ? 'दाता स्तर' : 'Donor Tier'}</p>
        </Card>
      </div>

      {/* Donation History */}
      <Card className="border border-slate-200">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-600" />
              <span>{isHi ? 'आपातकालीन प्रतिक्रिया इतिहास' : 'Emergency Donation History'}</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              2 Records
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-500">
            {isHi
              ? 'आपके द्वारा स्वीकृत एवं पूर्ण किए गए आपातकालीन रक्तदान अनुरोध'
              : 'Record of life-saving donations facilitated through RaktKhoj'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0">
          <div className="divide-y divide-slate-100">
            {donationHistory.map((item) => (
              <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.hospital}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isHi ? 'रोगी:' : 'Patient:'} {item.patient} • {item.date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200 text-xs font-bold">
                    {item.bloodGroup}
                  </Badge>
                  <Badge variant="success" className="text-xs">
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
