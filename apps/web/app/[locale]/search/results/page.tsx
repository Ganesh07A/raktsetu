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
  Building2,
  PhoneCall,
  Navigation,
  ShieldCheck,
  Send,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
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
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const parsedLat = latParam ? Number(latParam) : Number.NaN;
  const parsedLng = lngParam ? Number(lngParam) : Number.NaN;
  const hasCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const lat = hasCoordinates ? parsedLat : 20.5937;
  const lng = hasCoordinates ? parsedLng : 78.9629;
  const radiusKm = (parseInt(searchParams.get('radiusKm') || '10') || 10) as RadiusPreset;
  const componentType = (searchParams.get('componentType') as ComponentType) || 'whole_blood';
  const unitsNeeded = parseInt(searchParams.get('unitsNeeded') || '1') || 1;
  const state = searchParams.get('state') || '';
  const district = searchParams.get('district') || '';

  // Data fetching states
  const [loading, setLoading] = React.useState(true);
  const [banks, setBanks] = React.useState<BloodBankCardData[]>([]);
  const hasBankStock = banks.some((bank) =>
    bank.distanceKm !== null &&
    bank.distanceKm <= radiusKm &&
    bank.stock?.some((item) =>
      item.bloodGroup === bloodGroup &&
      item.componentType === componentType &&
      item.unitsAvailable >= unitsNeeded
    )
  );
  const hasMeasuredBankDistances = banks.some((bank) => bank.distanceKm !== null);
  const hasUnknownBankDistances = banks.some((bank) => bank.distanceKm === null);
  const [hasCompatibleDonors, setHasCompatibleDonors] = React.useState<boolean | null>(null);

  // Emergency broadcast modal states
  const [isBroadcastOpen, setIsBroadcastOpen] = React.useState(false);
  const [patientName, setPatientName] = React.useState('');
  const [hospitalName, setHospitalName] = React.useState('');
  const [isBroadcasting, setIsBroadcasting] = React.useState(false);
  const [broadcastError, setBroadcastError] = React.useState<string | null>(null);

  // Fetch Stage 1 (Blood Banks) and Stage 2 (Compatible Donors)
  React.useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      if (!hasCoordinates) {
        setBanks([]);
        setHasCompatibleDonors(false);
        setLoading(false);
        return;
      }
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

        // Keep all returned banks. Rank banks with enough matching stock first,
        // then use actual measured distance. Unknown distances are listed last.
        const rankedBanks = [...foundBanks].sort((a, b) => {
          const aHasStock = a.stock?.some((item) =>
            item.bloodGroup === bloodGroup &&
            item.componentType === componentType &&
            item.unitsAvailable >= unitsNeeded
          ) ?? false;
          const bHasStock = b.stock?.some((item) =>
            item.bloodGroup === bloodGroup &&
            item.componentType === componentType &&
            item.unitsAvailable >= unitsNeeded
          ) ?? false;
          if (aHasStock !== bHasStock) return aHasStock ? -1 : 1;
          if (a.distanceKm === null && b.distanceKm !== null) return 1;
          if (a.distanceKm !== null && b.distanceKm === null) return -1;
          if (a.distanceKm === null || b.distanceKm === null) return 0;
          return a.distanceKm - b.distanceKm;
        });

        if (isMounted) {
          setBanks(rankedBanks);
        }

        // Always query compatible donors for potential fallback
        const donorRes = await fetch(
          `http://localhost:3002/api/v1/donors/compatible?bloodGroup=${encodeURIComponent(bloodGroup)}&lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`
        );
        if (donorRes.ok) {
          const donorData = await donorRes.json();
          if (isMounted) {
            // Only expose whether a fallback exists, not donor identities before acceptance.
            setHasCompatibleDonors(Array.isArray(donorData.donors) && donorData.donors.length > 0);
          }
        } else if (isMounted) {
          setHasCompatibleDonors(false);
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
  }, [bloodGroup, lat, lng, radiusKm, componentType, state, district, hasCoordinates]);

  // Create the request; the API matches donors with active push subscriptions and dispatches FCM.
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCoordinates) {
      setBroadcastError(isHi
        ? 'कृपया पहले GPS या राज्य/ज़िला से स्थान तय करें।'
        : 'Please resolve a real location before creating an emergency request.');
      return;
    }
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
          ...(state ? { state } : {}),
          ...(district ? { district } : {}),
          emergencyType: 'surgery',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to dispatch emergency request');
      }

      const data = await res.json();
      if (data.request?.id) {
        const closeToken = typeof data.requestCloseToken === 'string'
          ? `?closeToken=${encodeURIComponent(data.requestCloseToken)}`
          : '';
        router.push(`/request/${data.request.id}${closeToken}`);
        return;
      }
      throw new Error('The API did not return a request ID.');
    } catch (err: any) {
      setBroadcastError(err.message || 'Error broadcasting emergency alert');
      setIsBroadcasting(false);
    }
  };

  // Only plot blood banks when the source provides their real coordinates.
  const mapMarkers: MapMarkerItem[] = React.useMemo(() => banks.flatMap((bank) => {
    if (bank.latitude === null || bank.longitude === null) return [];
    return [{
      id: bank.id,
      name: bank.name,
      latitude: bank.latitude,
      longitude: bank.longitude,
      type: 'bank' as const,
      address: bank.address || undefined,
      phone: bank.phone || undefined,
      ...(bank.distanceKm !== null ? { distanceKm: bank.distanceKm } : {}),
      isVerified: bank.isVerified,
      stock: bank.stock,
    }];
  }), [banks]);

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

      {!hasCoordinates && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {isHi
            ? 'खोज परिणामों में स्थान निर्देशांक नहीं मिले। कृपया GPS या राज्य/ज़िला चयन से स्थान तय करके दोबारा खोजें।'
            : 'Search coordinates are missing. Please set a location using GPS or state/district selection before searching.'}
        </div>
      )}

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
          userLocation={hasCoordinates ? [lat, lng] : undefined}
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
                    : `Blood banks in this area (${banks.length})`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasMeasuredBankDistances
                  ? (isHi ? 'पहले उपलब्ध स्टॉक, फिर मापी गई दूरी के क्रम में।' : 'Matching stock first, then measured distance where available.')
                  : (isHi ? 'स्टॉक उपलब्धता के अनुसार। दूरी का डेटा उपलब्ध नहीं है।' : 'Ordered by stock availability. Distance data is not available for these records.')}
              </p>
            </div>
            <Badge variant="success" className="text-xs">
              {isHi ? (hasBankStock ? 'स्टॉक उपलब्ध' : 'स्टॉक नहीं मिला') : (hasBankStock ? 'Matching stock found' : 'No matching stock')}
            </Badge>
          </div>

          {hasUnknownBankDistances && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {isHi
                ? 'कुछ आधिकारिक स्टॉक रिकॉर्ड में बैंक के GPS निर्देशांक नहीं हैं। ऐसे रिकॉर्ड ज़िला-स्तर पर दिखते हैं; उनकी 25/50/100 किमी दूरी सत्यापित नहीं की जा सकती और वे मानचित्र पर नहीं दिखेंगे।'
                : 'Some official stock records do not include bank GPS coordinates. They are district-level results; their 25/50/100 km distance cannot be verified and they are not plotted on the map.'}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4">
            {banks.map((bank) => {
              const matchedStock = bank.stock?.find(
                (s) => s.bloodGroup === bloodGroup && s.componentType === componentType && s.unitsAvailable > 0
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
                          {bank.distanceKm !== null ? `${bank.distanceKm.toFixed(1)} km` : (isHi ? 'दूरी उपलब्ध नहीं' : 'Distance unavailable')}
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

                      {bank.latitude !== null && bank.longitude !== null && (
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

          {/* Push-notification donor fallback */}
          <div className="p-4 rounded-xl border border-dashed border-red-200 bg-red-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-900">
                {isHi ? 'क्या आपको अतिरिक्त रक्तदाता सहायता चाहिए?' : 'Need volunteer donor support?'}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {isHi
                  ? (hasCompatibleDonors ? 'इस क्षेत्र में सूचना-सक्षम संगत रक्तदाता उपलब्ध हैं।' : 'अभी कोई सक्रिय सूचना-सक्षम संगत रक्तदाता नहीं मिला।')
                  : (hasCompatibleDonors ? 'Compatible donors with active push alerts are available in this area.' : 'No compatible donors with active push alerts were found in this area.')}
              </p>
            </div>
            <Button
              onClick={() => setIsBroadcastOpen(true)}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100 font-bold shrink-0"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              <span>{isHi ? 'पुश अनुरोध भेजें' : 'Send push request'}</span>
            </Button>
          </div>
        </section>
      )}

      {/* STAGE 2: Push fallback when no bank inventory is returned */}
      {!loading && !hasBankStock && (
        <section className="space-y-4">
          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="h-5 w-5 text-slate-600" />
                {isHi ? 'रक्तदाता सहायता उपलब्धता' : 'Volunteer donor fallback'}
              </CardTitle>
              <CardDescription>
                {isHi
                  ? 'रक्तदाता का नाम या संपर्क विवरण उसकी स्वीकृति से पहले नहीं दिखाया जाएगा।'
                  : 'Donor identities and contact details stay private until a donor accepts your request.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700">
                {hasCompatibleDonors
                  ? (isHi ? 'इस क्षेत्र में संगत और सूचना-सक्षम रक्तदाता हैं। आपातकालीन अनुरोध भेजने पर उन्हें पुश अलर्ट भेजा जाएगा।' : 'Compatible donors with active push subscriptions are available in this area. Send an emergency request to notify them.')
                  : (isHi ? 'अभी इस क्षेत्र में संगत और सूचना-सक्षम रक्तदाता नहीं मिले।' : 'No compatible registered donors with active push subscriptions were found in this area right now.')}
              </p>
              <Button onClick={() => setIsBroadcastOpen(true)} className="w-full bg-red-600 text-white hover:bg-red-700">
                <Send className="mr-2 h-4 w-4" />
                {isHi ? 'आपातकालीन पुश अनुरोध भेजें' : 'Create emergency push request'}
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Emergency Broadcast Confirmation Dialog */}
      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <Droplet className="h-5 w-5 fill-current" />
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isHi ? 'आपातकालीन पुश अनुरोध भेजें' : 'Send Emergency Push Request'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 pt-1">
              {isHi
                ? 'यह अनुरोध केवल इस क्षेत्र के संगत और पुश-सूचना चालू रखने वाले रक्तदाताओं को भेजा जाएगा।'
                : 'This request will be sent only to compatible nearby donors who have enabled push notifications.'}
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
                <span>{isHi ? 'पुश अनुरोध भेजें' : 'Send push request'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
