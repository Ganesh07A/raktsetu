'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { useRouter, Link } from '../../../../src/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import { Input } from '@repo/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@repo/ui/dialog';
import { MapView, type MapMarkerItem } from '@/components/map-view';
import {
  Search,
  Building2,
  Users,
  PhoneCall,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Send,
  Droplet,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  getCompatibleDonorGroups,
  type BloodGroup,
  type BloodBankCardData,
  type RadiusPreset,
  type ComponentType,
} from '@repo/shared';

export default function SearchResultsPage() {
  const locale = useLocale();
  const isHi = locale === 'hi';
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL parameters
  const bloodGroup = (searchParams.get('bloodGroup') as BloodGroup) || 'O+';
  const lat = parseFloat(searchParams.get('lat') || '28.5672');
  const lng = parseFloat(searchParams.get('lng') || '77.2100');
  const radiusKm = (parseInt(searchParams.get('radiusKm') || '10') || 10) as RadiusPreset;
  const componentType = (searchParams.get('componentType') as ComponentType) || 'whole_blood';
  const unitsNeeded = parseInt(searchParams.get('unitsNeeded') || '1') || 1;
  const state = searchParams.get('state') || '';
  const district = searchParams.get('district') || '';

  // Data fetching states
  const [loading, setLoading] = React.useState(true);
  const [banks, setBanks] = React.useState<BloodBankCardData[]>([]);
  const [compatibleDonorsCount, setCompatibleDonorsCount] = React.useState<number | null>(null);
  const [compatibleDonors, setCompatibleDonors] = React.useState<any[]>([]);

  // Emergency broadcast modal states
  const [isBroadcastOpen, setIsBroadcastOpen] = React.useState(false);
  const [patientName, setPatientName] = React.useState('');
  const [hospitalName, setHospitalName] = React.useState(district ? `${district} Hospital` : 'AIIMS Delhi');
  const [isBroadcasting, setIsBroadcasting] = React.useState(false);
  const [broadcastError, setBroadcastError] = React.useState<string | null>(null);

  // Fetch Stage 1 (Blood Banks) and Stage 2 (Compatible Donors)
  React.useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          bloodGroup,
          radiusKm: radiusKm.toString(),
          componentType,
        });
        if (state) queryParams.set('state', state);
        if (district) queryParams.set('district', district);

        // Fetch blood banks
        const bankRes = await fetch(`http://localhost:3002/api/v1/blood-banks/search?${queryParams.toString()}`);
        let foundBanks: BloodBankCardData[] = [];
        if (bankRes.ok) {
          const bankData = await bankRes.json();
          foundBanks = bankData.banks || [];
        }

        // Check if banks have stock for the requested group
        const banksWithStock = foundBanks.filter((b) =>
          b.stock?.some((s) => s.bloodGroup === bloodGroup && s.unitsAvailable > 0)
        );

        if (isMounted) {
          setBanks(banksWithStock);
        }

        // Always query compatible donors for potential fallback
        const donorRes = await fetch(
          `http://localhost:3002/api/v1/donors/compatible?bloodGroup=${encodeURIComponent(bloodGroup)}&lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`
        );
        if (donorRes.ok) {
          const donorData = await donorRes.json();
          if (isMounted) {
            setCompatibleDonorsCount(donorData.count ?? donorData.donors?.length ?? 0);
            setCompatibleDonors(donorData.donors || []);
          }
        }
      } catch (err) {
        console.error('Failed to load search results:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [bloodGroup, lat, lng, radiusKm, componentType, state, district]);

  // Handle WhatsApp Emergency Broadcast Submission
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setBroadcastError(isHi ? 'कृपया रोगी का नाम दर्ज करें' : 'Please enter patient name');
      return;
    }
    if (!hospitalName.trim()) {
      setBroadcastError(isHi ? 'कृपया अस्पताल का नाम दर्ज करें' : 'Please enter hospital name');
      return;
    }

    setIsBroadcasting(true);
    setBroadcastError(null);

    try {
      const res = await fetch('http://localhost:3002/api/v1/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bloodGroupNeeded: bloodGroup,
          componentType,
          unitsNeeded,
          patientName: patientName.trim(),
          hospitalName: hospitalName.trim(),
          latitude: lat,
          longitude: lng,
          searchRadiusKm: radiusKm,
          state: state || 'Delhi',
          district: district || 'South Delhi',
          emergencyType: 'surgery',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to dispatch emergency request');
      }

      const data = await res.json();
      if (data.request?.id) {
        router.push(`/request/${data.request.id}`);
      }
    } catch (err: any) {
      setBroadcastError(err.message || 'Error broadcasting emergency alert');
      setIsBroadcasting(false);
    }
  };

  // Prepare map markers
  const mapMarkers: MapMarkerItem[] = React.useMemo(() => {
    const list: MapMarkerItem[] = [];

    // Add blood bank markers
    banks.forEach((b) => {
      if (b.latitude && b.longitude) {
        list.push({
          id: b.id,
          name: b.name,
          latitude: b.latitude,
          longitude: b.longitude,
          type: 'bank',
          address: b.address,
          phone: b.phone,
          distanceKm: b.distanceKm,
          isVerified: b.isVerified,
          stock: b.stock,
        });
      }
    });

    // Add compatible donor markers if fallback stage
    if (banks.length === 0 && compatibleDonors.length > 0) {
      compatibleDonors.forEach((d) => {
        if (d.latitude && d.longitude) {
          list.push({
            id: d.id,
            name: d.name ? `Donor (${d.bloodGroup})` : `Volunteer (${d.bloodGroup})`,
            latitude: d.latitude,
            longitude: d.longitude,
            type: 'donor',
            distanceKm: d.distanceKm,
            stock: [{ bloodGroup: d.bloodGroup, componentType: 'whole_blood', unitsAvailable: 1 }],
          });
        }
      });
    }

    return list;
  }, [banks, compatibleDonors]);

  const compatibleGroups = getCompatibleDonorGroups(bloodGroup);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Breadcrumb & Query Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
            {bloodGroup}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              {isHi
                ? `${bloodGroup} रक्त खोज परिणाम (${radiusKm} किमी दायरा)`
                : `${bloodGroup} Blood Search Results (${radiusKm} km radius)`}
            </h1>
            <p className="text-xs text-slate-500">
              {isHi
                ? `${district ? district + ', ' : ''}${state ? state : 'जीपीएस स्थान'} | घटक: ${componentType} (${unitsNeeded} यूनिट)`
                : `${district ? district + ', ' : ''}${state ? state : 'GPS Location'} | Component: ${componentType} (${unitsNeeded} unit)`}
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="shrink-0 border-slate-300">
          <Link href="/search">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            <span>{isHi ? 'मापदंड बदलें' : 'Change Search'}</span>
          </Link>
        </Button>
      </div>

      {/* Embedded Leaflet Map View */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600 px-1">
          <span className="font-bold flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-red-600" />
            {isHi ? 'मानचित्र दृश्य (लाइव स्थान एवं बैंक)' : 'Interactive Proximity Map'}
          </span>
          <span className="text-[11px] text-slate-500">
            {isHi ? `खोज परिधि: ${radiusKm} किमी` : `Search Radius: ${radiusKm} km`}
          </span>
        </div>
        <MapView
          center={[lat, lng]}
          userLocation={[lat, lng]}
          radiusKm={radiusKm}
          markers={mapMarkers}
          height="360px"
        />
      </section>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      )}

      {/* STAGE 1: Institutional Results (Blood Banks with Available Stock) */}
      {!loading && banks.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-red-600" />
                <span>
                  {isHi
                    ? `सत्यापित ब्लड बैंक उपलब्ध (${banks.length})`
                    : `Verified Blood Banks with Available Stock (${banks.length})`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isHi
                  ? 'निकटता के क्रम में व्यवस्थित। तुरंत संपर्क करने के लिए कॉल करें।'
                  : 'Sorted by proximity to your search coordinates.'}
              </p>
            </div>
            <Badge variant="success" className="text-xs">
              {isHi ? 'स्टॉक उपलब्ध' : 'Stock In-Hand'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {banks.map((bank) => {
              const matchedStock = bank.stock?.find(
                (s) => s.bloodGroup === bloodGroup && s.unitsAvailable > 0
              );
              const availableUnits = matchedStock?.unitsAvailable ?? 0;

              return (
                <Card
                  key={bank.id}
                  className="border border-slate-200 hover:border-red-300 transition-all shadow-xs"
                >
                  <CardHeader className="p-4 sm:p-5 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                            {bank.name}
                          </CardTitle>
                          {bank.isVerified && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-semibold flex items-center gap-1"
                            >
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              <span>eRaktKosh Verified</span>
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{bank.address}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="destructive"
                          className="text-xs font-bold px-2.5 py-1"
                        >
                          {availableUnits} {isHi ? 'यूनिट उपलब्ध' : 'Units Available'}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-semibold text-slate-700">
                          {bank.distanceKm.toFixed(1)} km
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                    {/* Stock Breakdown Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">
                        {isHi ? 'घटक उपलब्धता:' : 'Available Components:'}
                      </span>
                      {bank.stock?.map((item, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            item.bloodGroup === bloodGroup
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.bloodGroup} ({item.componentType}): {item.unitsAvailable}
                        </span>
                      ))}
                    </div>

                    {/* Direct Contact Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {bank.phone && (
                        <a
                          href={`tel:${bank.phone}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                        >
                          <PhoneCall className="h-3.5 w-3.5 fill-current" />
                          <span>{isHi ? 'ब्लड बैंक को कॉल करें' : 'Call Blood Bank'} ({bank.phone})</span>
                        </a>
                      )}

                      {bank.latitude && bank.longitude && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${bank.latitude},${bank.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors"
                        >
                          <Navigation className="h-3.5 w-3.5 text-slate-500" />
                          <span>{isHi ? 'दिशा-निर्देश देखें' : 'Get Directions'}</span>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Secondary Action: Also trigger WhatsApp cascade if family wants additional donors */}
          <div className="p-4 rounded-xl border border-dashed border-red-200 bg-red-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">
                {isHi ? 'क्या आपको अतिरिक्त यूनिट्स की आवश्यकता है?' : 'Need More Units or Backup Donors?'}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {isHi
                  ? `आस-पास ${compatibleDonorsCount ?? 0} संगत स्वयंसेवी रक्तदाता उपलब्ध हैं।`
                  : `${compatibleDonorsCount ?? 0} compatible volunteer donors are nearby.`}
              </p>
            </div>
            <Button
              onClick={() => setIsBroadcastOpen(true)}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100 font-bold shrink-0"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              <span>{isHi ? 'दाताओं को बैकअप अलर्ट भेजें' : 'Broadcast to Donors'}</span>
            </Button>
          </div>
        </section>
      )}

      {/* STAGE 2: Dynamic Volunteer Donor Fallback (When No Bank Has Stock) */}
      {!loading && banks.length === 0 && (
        <section className="space-y-6">
          {/* Prominent Emergency Fallback Alert Banner */}
          <div className="rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-600 to-red-800 text-white p-6 sm:p-8 shadow-lg space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-xs text-white shrink-0 mt-1">
                <AlertTriangle className="h-8 w-8 text-amber-300 animate-bounce" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-black">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{isHi ? 'चरण 2: स्वतः रक्तदाता नेटवर्क सक्रिय' : 'Stage 2: Community Donor Cascade'}</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-snug">
                  {isHi
                    ? `चुने गए ${radiusKm} किमी दायरे में ${bloodGroup} ब्लड बैंक स्टॉक उपलब्ध नहीं है।`
                    : `No blood banks found with available stock within ${radiusKm} km radius.`}
                </h2>
                <p className="text-sm sm:text-base text-red-100 leading-relaxed max-w-2xl">
                  {isHi
                    ? 'घबराएं नहीं! रक्तखोज ने आपके निकटतम संगत स्वयंसेवी रक्तदाताओं की पहचान कर ली है। नीचे दिए गए बटन से तुरंत आपातकालीन व्हाट्सएप संदेश भेजें।'
                    : 'Searching for compatible volunteer donors... We can immediately dispatch WhatsApp emergency alert messages with interactive Accept buttons.'}
                </p>
              </div>
            </div>

            {/* Compatible Blood Groups Box */}
            <div className="p-4 rounded-xl bg-red-900/40 border border-white/20 backdrop-blur-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-red-200 uppercase tracking-wider">
                    {isHi ? 'संगत लाल रक्त कोशिका (RBC) समूह:' : 'Compatible Donor Blood Groups:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {compatibleGroups.map((group) => (
                      <span
                        key={group}
                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-white text-red-900 font-extrabold text-sm shadow-xs"
                      >
                        {group}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs text-red-200">
                    {isHi ? 'निकटतम संगत दाता' : 'Compatible Donors Nearby'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-amber-300">
                    {compatibleDonorsCount !== null ? compatibleDonorsCount : '...'} {isHi ? 'दाता मिले' : 'Donors'}
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <Button
                onClick={() => setIsBroadcastOpen(true)}
                size="lg"
                className="w-full h-14 bg-white text-red-700 hover:bg-red-50 font-black text-base sm:text-lg rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <Send className="h-5 w-5 text-red-600" />
                <span>
                  {isHi
                    ? `संगत रक्तदाताओं को आपातकालीन व्हाट्सएप अलर्ट भेजें`
                    : `Broadcast Emergency WhatsApp Alert to Compatible Donors`}
                </span>
                <ArrowRight className="h-5 w-5 text-red-500 ml-1" />
              </Button>
            </div>
          </div>

          {/* Donor Directory Preview Card */}
          {compatibleDonors.length > 0 && (
            <Card className="border border-slate-200">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-600" />
                  <span>
                    {isHi
                      ? `सक्रिय स्वयंसेवी रक्तदाता (${compatibleDonors.length})`
                      : `Active Volunteer Donors Within Radius (${compatibleDonors.length})`}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {isHi
                    ? 'गोपनीयता के लिए संपर्क नंबर सुरक्षित रखे गए हैं। दाता द्वारा स्वीकृति दिए जाने पर तुरंत लाइव वेटिंग रूम में प्रदर्शित होंगे।'
                    : 'Contact numbers are masked for privacy until a donor accepts your emergency notification.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {compatibleDonors.map((donor) => (
                    <div
                      key={donor.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-sm flex items-center justify-center">
                          {donor.bloodGroup}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {donor.name || 'Volunteer Donor'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {donor.distanceKm !== undefined ? `${donor.distanceKm.toFixed(1)} km away` : 'Within radius'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-white text-emerald-700 border-emerald-300">
                        {isHi ? 'उपलब्ध' : 'Available'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Emergency Broadcast Confirmation Dialog */}
      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <Droplet className="h-5 w-5 fill-current" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isHi ? 'आपातकालीन व्हाट्सएप अलर्ट भेजें' : 'Send Emergency WhatsApp Broadcast'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 pt-1">
              {isHi
                ? `यह अनुरोध ${bloodGroup} के सभी ${compatibleDonorsCount ?? ''} संगत रक्तदाताओं को व्हाट्सएप इंटरैक्टिव बटन के साथ तुरंत भेजा जाएगा।`
                : `This will dispatch immediate WhatsApp notifications with Accept/Decline buttons to all ${compatibleDonorsCount ?? ''} compatible donors.`}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBroadcastSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {isHi ? 'रोगी का नाम (Patient Name)' : 'Patient Name'} *
              </label>
              <Input
                required
                placeholder={isHi ? 'उदा. राहुल शर्मा' : 'e.g. Aarav Sharma'}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {isHi ? 'अस्पताल का नाम एवं पता (Hospital Name)' : 'Hospital Name & Location'} *
              </label>
              <Input
                required
                placeholder={isHi ? 'उदा. एम्स ट्रॉमा सेंटर' : 'e.g. AIIMS Trauma Center'}
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>{isHi ? 'रक्त समूह:' : 'Blood Group Needed:'}</span>
                <span className="font-bold text-red-700">{bloodGroup}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isHi ? 'आवश्यक मात्रा:' : 'Units Needed:'}</span>
                <span className="font-bold text-slate-900">{unitsNeeded} Unit(s) ({componentType})</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isHi ? 'खोज दायरा:' : 'Search Radius:'}</span>
                <span className="font-bold text-slate-900">{radiusKm} km</span>
              </div>
            </div>

            {broadcastError && (
              <p className="text-xs text-red-600 font-semibold">{broadcastError}</p>
            )}

            <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBroadcastOpen(false)}
                className="w-full sm:w-auto"
              >
                {isHi ? 'रद्द करें' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                loading={isBroadcasting}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                <Send className="h-4 w-4 mr-1.5" />
                <span>{isHi ? 'तुरंत अलर्ट भेजें' : 'Broadcast Alert Now'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
