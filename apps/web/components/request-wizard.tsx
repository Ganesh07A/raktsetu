'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '../src/routing';
import { Button } from '@repo/ui/button';
import { MapView, type MapMarkerItem } from './map-view';
import { WaitingRoom } from './waiting-room';
import {
  ArrowLeft,
  X,
  Volume2,
  VolumeX,
  Search,
  MapPin,
  Crosshair,
  Check,
  CheckCircle,
  CheckCircle2,
  RotateCw,
  Phone,
  Share2,
  Navigation,
  Radio,
  Camera,
  Mic,
  Send,
  Loader2,
  Info,
  Building2,
  User,
  AlertCircle,
} from 'lucide-react';
import {
  BLOOD_GROUPS,
  getCompatibleDonorGroups,
  ALL_INDIAN_STATES,
  getDistrictsForState,
  type BloodGroup,
} from '@repo/shared';

// Blood Group rarity classification matching Reference Screen 1
const BLOOD_GROUP_METADATA: Record<
  BloodGroup,
  { rarity: 'Common' | 'Rare'; rarityHi: 'सामान्य' | 'दुर्लभ' }
> = {
  'O+': { rarity: 'Common', rarityHi: 'सामान्य' },
  'O-': { rarity: 'Common', rarityHi: 'सामान्य' },
  'A+': { rarity: 'Common', rarityHi: 'सामान्य' },
  'A-': { rarity: 'Common', rarityHi: 'सामान्य' },
  'B+': { rarity: 'Common', rarityHi: 'सामान्य' },
  'B-': { rarity: 'Rare', rarityHi: 'दुर्लभ' },
  'AB+': { rarity: 'Rare', rarityHi: 'दुर्लभ' },
  'AB-': { rarity: 'Rare', rarityHi: 'दुर्लभ' },
};

// Component Types matching Reference Screen 10
const COMPONENT_OPTIONS = [
  { id: 'whole_blood', labelEn: 'Whole Blood', labelHi: 'होल ब्लड (पूरा रक्त)' },
  { id: 'plasma', labelEn: 'Plasma', labelHi: 'प्लाज्मा' },
  { id: 'rbc', labelEn: 'RBC', labelHi: 'आरबीसी (लाल रक्त कोशिकाएं)' },
  { id: 'wbc', labelEn: 'WBC', labelHi: 'डब्ल्यूबीसी (श्वेत कोशिकाएं)' },
  { id: 'platelets', labelEn: 'Platelets', labelHi: 'प्लेटलेट्स' },
];

// Quick Condition Chips matching Reference Screen 11
const CONDITION_TAGS = [
  { id: 'Accident', labelEn: 'Accident', labelHi: 'दुर्घटना' },
  { id: 'Disease', labelEn: 'Disease', labelHi: 'गंभीर बीमारी' },
  { id: 'Critical', labelEn: 'Critical', labelHi: 'गंभीर स्थिति' },
  { id: 'Surgery', labelEn: 'Surgery', labelHi: 'सर्जरी / ऑपरेशन' },
  { id: 'Childbirth', labelEn: 'Childbirth', labelHi: 'प्रसव / डिलीवरी' },
];

import { type NearbyHospital, getHospitalsForDistrict } from './regional-hospitals';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';
const NOMINATIM_CACHE_PREFIX = 'raktkhoj-geocode-v1:';
let lastNominatimLookup = 0;

export type WizardStep =
  | 'STEP_1_BLOOD_GROUP'
  | 'STEP_2_LOCATION'
  | 'STEP_3_HOSPITAL'
  | 'SCREEN_RADAR'
  | 'SCREEN_BLOOD_BANKS'
  | 'SCREEN_DONORS_FOUND'
  | 'STEP_4_PATIENT_DETAILS'
  | 'STEP_5_COMPONENT'
  | 'STEP_6_SEND_REQUEST'
  | 'SCREEN_SENDING'
  | 'SCREEN_WAITING_ROOM';

export function RequestWizard() {
  const locale = useLocale();
  const isHi = locale === 'hi';
  const router = useRouter();

  // Wizard Navigation
  const [currentStep, setCurrentStep] = React.useState<WizardStep>('STEP_1_BLOOD_GROUP');
  const [stepHistory, setStepHistory] = React.useState<WizardStep[]>(['STEP_1_BLOOD_GROUP']);

  // Step 1: Blood Group
  const [selectedBloodGroup, setSelectedBloodGroup] = React.useState<BloodGroup | null>('AB+');
  const [showGroupHelperModal, setShowGroupHelperModal] = React.useState(false);

  // Step 2: Location
  const [locationType, setLocationType] = React.useState<'precise' | 'approximate'>('precise');
  const [selectedState, setSelectedState] = React.useState('Maharashtra');
  const [selectedDistrict, setSelectedDistrict] = React.useState('');
  // Coordinates are unresolved until GPS or district geocoding succeeds.
  const [lat, setLat] = React.useState<number>(20.5937);
  const [lng, setLng] = React.useState<number>(78.9629);
  const [isLocationResolved, setIsLocationResolved] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);
  const [locatingStatus, setLocatingStatus] = React.useState('');
  const [isGpsActive, setIsGpsActive] = React.useState(false);
  const [detectedLocationName, setDetectedLocationName] = React.useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = React.useState<string>('Precise');
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = React.useState(false);

  // Step 3: Hospital Selection
  const [hospitalSearch, setHospitalSearch] = React.useState('');
  const [isHospitalOptional, setIsHospitalOptional] = React.useState(false);

  // Active hospital list dynamically resolved based on selected state, district, and live GPS coordinates
  const activeRegionHospitals = React.useMemo(() => {
    return getHospitalsForDistrict(selectedState, selectedDistrict, lat, lng);
  }, [selectedState, selectedDistrict, lat, lng]);

  const [selectedHospital, setSelectedHospital] = React.useState<NearbyHospital>({
    id: 'unselected-hospital',
    name: '',
    city: '',
    lat: 20.5937,
    lng: 78.9629,
    distanceKm: null,
    type: 'Government',
  });

  // Auto-update selected hospital when state or district changes
  React.useEffect(() => {
    if (activeRegionHospitals && activeRegionHospitals.length > 0 && !isHospitalOptional) {
      setSelectedHospital(activeRegionHospitals[0]!);
    }
  }, [activeRegionHospitals, isHospitalOptional]);

  // Blood Bank Screen
  const [radiusKm, setRadiusKm] = React.useState<25 | 50 | 100>(25);
  const [banksList, setBanksList] = React.useState<any[]>([]);
  const [banksLoading, setBanksLoading] = React.useState(false);
  const [banksError, setBanksError] = React.useState<string | null>(null);

  // Donors Found Screen. The count is used only to describe whether matching registrations exist.
  const [donorsCount, setDonorsCount] = React.useState(0);
  const [donorLookupLoading, setDonorLookupLoading] = React.useState(false);
  const [donorLookupError, setDonorLookupError] = React.useState<string | null>(null);

  // Step 4: Patient Details
  const [patientName, setPatientName] = React.useState('');
  const [patientAge, setPatientAge] = React.useState('');
  const [patientGender, setPatientGender] = React.useState('Prefer not to say');
  const [unitsNeeded, setUnitsNeeded] = React.useState<number>(6);

  // Step 5: Component
  const [selectedComponent, setSelectedComponent] = React.useState('whole_blood');

  // Step 6: Send Request & Message
  const [patientCondition, setPatientCondition] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  // Waiting Room
  const [createdRequestId, setCreatedRequestId] = React.useState<string | null>(null);
  const [requestCloseToken, setRequestCloseToken] = React.useState<string | null>(null);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  // Audio / Speech Synthesis
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isHi ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Navigation handlers
  const goToStep = (next: WizardStep) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setStepHistory((prev) => [...prev, next]);
    setCurrentStep(next);
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    if (stepHistory.length > 1) {
      const nextHistory = [...stepHistory];
      nextHistory.pop();
      const prevStep = nextHistory[nextHistory.length - 1]!;
      setStepHistory(nextHistory);
      setCurrentStep(prevStep);
    } else {
      router.push('/');
    }
  };

  // Language toggle
  const toggleLanguage = () => {
    const nextLocale = isHi ? 'en' : 'hi';
    const currentPath = window.location.pathname;
    const newPath = currentPath.startsWith('/hi')
      ? currentPath.replace('/hi', '/en')
      : currentPath.replace('/en', '/hi');
    window.location.href = newPath;
  };

  // Reverse geocodes coordinates to State, District, and Area
  const reverseGeocodeAndSync = async (latitude: number, longitude: number) => {
    try {
      setLocatingStatus(isHi ? 'स्थान की पहचान की जा रही है...' : 'Identifying your city & state...');

      let stateName = '';
      let districtName = '';
      let suburbOrCity = '';
      let displayName = '';

      // 1. Try OpenStreetMap Nominatim reverse geocoding
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 4500);
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`,
          {
            headers: { 'User-Agent': 'RaktKhoj-BloodDiscovery/1.0' },
            signal: controller.signal,
          }
        );
        clearTimeout(tid);

        if (nomRes.ok) {
          const nomData = await nomRes.json();
          const addr = nomData.address || {};
          stateName = addr.state || '';
          districtName = addr.state_district || addr.county || addr.city_district || addr.city || '';
          suburbOrCity = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village || '';
          displayName = [suburbOrCity, districtName, stateName].filter(Boolean).join(', ');
        }
      } catch {
        // Fallback to secondary resolver
      }

      // 2. Secondary fallback: BigDataCloud Client-side Geolocation API
      if (!stateName) {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 4500);
          const bdcRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            { signal: controller.signal }
          );
          clearTimeout(tid);

          if (bdcRes.ok) {
            const bdcData = await bdcRes.json();
            stateName = bdcData.principalSubdivision || '';
            districtName = bdcData.locality || bdcData.city || '';
            suburbOrCity = bdcData.locality || '';
            displayName = [suburbOrCity, districtName, stateName].filter(Boolean).join(', ');
          }
        } catch {
          // Both network geocoders timed out or failed
        }
      }

      // 3. Apply reverse-geocoded state/district only when they match the official list.
      // Never let the shared helper's old Mumbai default override the actual GPS coordinates.
      const normalizedState = ALL_INDIAN_STATES.find(
        (candidate) => candidate.toLowerCase() === stateName.trim().toLowerCase()
      );

      if (normalizedState && districtName.trim()) {
        const validDistricts = getDistrictsForState(normalizedState) || [];
        const normalizedDistrict = validDistricts.find((candidate) => {
          const districtLower = candidate.toLowerCase();
          const geocoderDistrict = districtName.trim().toLowerCase();
          return districtLower === geocoderDistrict ||
            districtLower.includes(geocoderDistrict) ||
            geocoderDistrict.includes(districtLower);
        });

        setSelectedState(normalizedState);
        setSelectedDistrict(normalizedDistrict || '');
        setDetectedLocationName(
          displayName || [districtName, normalizedState].filter(Boolean).join(', ')
        );
      } else {
        // GPS is still valid even if the reverse-geocoder cannot identify a district.
        // Keep a recognized state, but never substitute a different district.
        if (normalizedState) setSelectedState(normalizedState);
        setSelectedDistrict('');
        setDetectedLocationName(displayName || (isHi ? 'जीपीएस स्थान' : 'GPS location'));
      }

      setIsLocationResolved(true);
      setIsGpsActive(true);
      setLocationError(null);
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
  };

  // Native Geolocation with live visual confirmation
  const requestDeviceLocation = (selectedMode: 'precise' | 'approximate' = locationType) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError(
        isHi
          ? 'आपके ब्राउज़र में जीपीएस समर्थित नहीं है।'
          : 'Geolocation is not supported by your browser.'
      );
      setShowLocationModal(false);
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setLocatingStatus(
      isHi ? 'जीपीएस स्थान प्राप्त हो रहा है...' : 'Acquiring GPS location...'
    );

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = pos.coords;
        setLat(coords.latitude);
        setLng(coords.longitude);
        setIsLocationResolved(true);
        setGpsAccuracy(
          coords.accuracy && coords.accuracy < 100 ? 'Precise' : 'Approximate'
        );
        setLocationType(selectedMode);

        await reverseGeocodeAndSync(coords.latitude, coords.longitude);

        setIsLocating(false);
        setLocatingStatus('');
        setShowLocationModal(false);
      },
      (err) => {
        setIsLocating(false);
        setLocatingStatus('');
        setShowLocationModal(false);
        let message = isHi
          ? 'स्थान की अनुमति नहीं मिली।'
          : 'Could not access device location.';
        if (err.code === 1) {
          message = isHi
            ? 'स्थान अनुमति अस्वीकृत कर दी गई है। कृपया नीचे दिए गए विकल्पों से अपना राज्य और ज़िला चुनें।'
            : 'Location permission was denied. Please select your State & District below.';
        } else if (err.code === 3) {
          message = isHi
            ? 'स्थान खोजने में समय समाप्त हो गया। कृपया नीचे से चुनें।'
            : 'Location request timed out. Please choose manually below.';
        }
        setLocationError(message);
      },
      {
        timeout: 10000,
        enableHighAccuracy: selectedMode === 'precise',
        maximumAge: 30000,
      }
    );
  };

  const resolveManualLocation = async () => {
    if (!selectedDistrict) {
      setLocationError(isHi ? 'कृपया पहले राज्य और ज़िला चुनें।' : 'Select a state and district first.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setLocatingStatus(isHi ? 'चुने गए ज़िले का स्थान खोजा जा रहा है…' : 'Resolving selected district coordinates…');
    try {
      const cacheKey = `${NOMINATIM_CACHE_PREFIX}${selectedState.toLowerCase()}:${selectedDistrict.toLowerCase()}`;
      let resolved: { lat: number; lng: number; displayName: string } | null = null;

      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) resolved = JSON.parse(cached) as { lat: number; lng: number; displayName: string };
      } catch {
        // Ignore stale or malformed local geocoding cache.
      }

      if (!resolved) {
        const waitMs = Math.max(0, 1100 - (Date.now() - lastNominatimLookup));
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
        lastNominatimLookup = Date.now();

        const query = new URLSearchParams({
          q: `${selectedDistrict}, ${selectedState}, India`,
          format: 'jsonv2',
          limit: '1',
          countrycodes: 'in',
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Location lookup service is unavailable.');
        const results = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
        const first = results[0];
        const nextLat = Number(first?.lat);
        const nextLng = Number(first?.lon);
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
          throw new Error(isHi
            ? 'इस ज़िले का मानचित्र स्थान नहीं मिला। कृपया GPS का उपयोग करें।'
            : 'Could not resolve this district on the map. Please use GPS instead.');
        }
        resolved = {
          lat: nextLat,
          lng: nextLng,
          displayName: first?.display_name || `${selectedDistrict}, ${selectedState}`,
        };
        try { sessionStorage.setItem(cacheKey, JSON.stringify(resolved)); } catch { /* cache is optional */ }
      }

      setLat(resolved.lat);
      setLng(resolved.lng);
      setIsLocationResolved(true);
      setIsGpsActive(false);
      setDetectedLocationName(resolved.displayName);
      const hospitals = getHospitalsForDistrict(selectedState, selectedDistrict, resolved.lat, resolved.lng);
      if (hospitals.length > 0) setSelectedHospital(hospitals[0]!);
      goToStep('STEP_3_HOSPITAL');
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Unable to resolve selected district.');
    } finally {
      setIsLocating(false);
      setLocatingStatus('');
    }
  };

  const fetchBloodBanks = async (searchRadius: 25 | 50 | 100) => {
    if (!isLocationResolved) {
      setBanksError(isHi ? 'पहले मानचित्र पर अपना स्थान तय करें।' : 'Resolve your location before searching for blood banks.');
      return;
    }

    setBanksLoading(true);
    setBanksError(null);
    try {
      const query = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        bloodGroup: selectedBloodGroup || 'AB+',
        radiusKm: searchRadius.toString(),
        state: selectedState,
        district: selectedDistrict,
        componentType: selectedComponent,
      });
      const response = await fetch(`${API_BASE}/api/v1/blood-banks/search?${query.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Blood bank search failed.');
      setBanksList(Array.isArray(data.banks) ? data.banks : []);
    } catch (error) {
      setBanksList([]);
      setBanksError(error instanceof Error ? error.message : 'Unable to search blood banks.');
    } finally {
      setBanksLoading(false);
    }
  };

  // Trigger the blood-bank search using only the resolved selected/GPS coordinates.
  const startRadarSearch = () => {
    if (!isLocationResolved) {
      setLocationError(isHi ? 'कृपया GPS या ज़िले का मानचित्र स्थान तय करें।' : 'Please resolve your location using GPS or your selected district first.');
      setCurrentStep('STEP_2_LOCATION');
      return;
    }

    goToStep('SCREEN_RADAR');
    void fetchBloodBanks(radiusKm);
    setTimeout(() => goToStep('SCREEN_BLOOD_BANKS'), 900);
  };

  const handleFindDonors = async () => {
    if (!isLocationResolved) {
      setDonorLookupError(isHi ? 'पहले अपना स्थान तय करें।' : 'Resolve your location before searching for donors.');
      return;
    }

    setDonorLookupLoading(true);
    setDonorLookupError(null);
    try {
      const query = new URLSearchParams({
        bloodGroup: selectedBloodGroup || 'AB+',
        lat: lat.toString(),
        lng: lng.toString(),
        radiusKm: radiusKm.toString(),
      });
      const response = await fetch(`${API_BASE}/api/v1/donors/compatible?${query.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Donor search failed.');
      setDonorsCount(Array.isArray(data.donors) ? data.donors.length : Number(data.count || 0));
      goToStep('SCREEN_DONORS_FOUND');
    } catch (error) {
      setDonorLookupError(error instanceof Error ? error.message : 'Unable to search donors.');
    } finally {
      setDonorLookupLoading(false);
    }
  };

  // Dispatch an actual blood request. The API determines matching subscribed donors and sends FCM.
  const handleSendRequest = async () => {
    setRequestError(null);
    if (!patientName.trim()) {
      setRequestError(isHi ? 'कृपया मरीज़ का नाम दर्ज करें।' : 'Enter the patient name before sending the request.');
      return;
    }
    if (!selectedHospital.name.trim()) {
      setRequestError(isHi ? 'अस्पताल चुनें या घर/ट्रांज़िट विकल्प चुनें।' : 'Select a hospital or choose the home/in-transit option.');
      return;
    }
    if (!isLocationResolved) {
      setRequestError(isHi ? 'अनुरोध भेजने से पहले स्थान तय करें।' : 'Resolve the location before sending the request.');
      return;
    }

    setIsSending(true);
    goToStep('SCREEN_SENDING');

    try {
      const payload = {
        bloodGroupNeeded: selectedBloodGroup || 'AB+',
        componentType: selectedComponent,
        unitsNeeded: Number(unitsNeeded) || 1,
        patientName: patientName.trim(),
        ...(patientAge ? { patientAge: parseInt(patientAge, 10) } : {}),
        emergencyType: 'other',
        hospitalName: selectedHospital.name,
        latitude: lat,
        longitude: lng,
        state: selectedState,
        district: selectedDistrict,
        searchRadiusKm: radiusKm,
      };

      const response = await fetch(`${API_BASE}/api/v1/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to create emergency request.');

      const requestId = data.request?.id;
      if (typeof requestId !== 'string' || !requestId) {
        throw new Error('The API did not return a valid request ID.');
      }

      setCreatedRequestId(requestId);
      setRequestCloseToken(typeof data.requestCloseToken === 'string' ? data.requestCloseToken : null);
      setTimeout(() => goToStep('SCREEN_WAITING_ROOM'), 700);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Unable to send emergency request.');
      goToStep('STEP_6_SEND_REQUEST');
    } finally {
      setIsSending(false);
    }
  };

  // Web Share
  const handleShare = (title: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, text, url: window.location.href }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${title} - ${text}`);
      alert(isHi ? 'विवरण क्लिपबोर्ड पर कॉपी किया गया' : 'Details copied to clipboard');
    }
  };

  // Only real blood-bank search results are displayed here. Curated hospitals remain
  // separate in the hospital-selection step and are never presented as blood banks.
  const displayBanks = banksList;

  const mapMarkers: MapMarkerItem[] = [
    ...(isLocationResolved ? [{
      id: 'user-pin',
      name: isHi ? 'मरीज़ का स्थान' : "Patient's Location",
      latitude: lat,
      longitude: lng,
      type: 'user' as const,
    }] : []),
    ...displayBanks.flatMap((bank: any) => {
      const bankLat = typeof bank.latitude === 'number' ? bank.latitude : null;
      const bankLng = typeof bank.longitude === 'number' ? bank.longitude : null;
      if (bankLat === null || bankLng === null) return [];
      return [{
        id: bank.id,
        name: bank.name,
        latitude: bankLat,
        longitude: bankLng,
        type: 'bank' as const,
        ...(typeof bank.distanceKm === 'number' ? { distanceKm: bank.distanceKm } : {}),
        isVerified: Boolean(bank.isVerified),
        stock: Array.isArray(bank.stock) ? bank.stock : [],
      }];
    }),
  ];

  // Helper text computation
  const compatibleList = selectedBloodGroup
    ? getCompatibleDonorGroups(selectedBloodGroup).join(', ')
    : 'AB-, A+, A-, B+, B-, O+, O-';

  const defaultGeneratedMessage = isHospitalOptional
    ? isHi
      ? `मुझे तत्काल ${selectedBloodGroup || 'AB+'} रक्त की आवश्यकता है (संगत समूह भी मान्य: ${compatibleList}) — ${unitsNeeded} यूनिट चाहिए। स्थान: ${selectedDistrict}, ${selectedState} (घर पर / ट्रांजिट में)। कृपया जीवन बचाने में सहायता करें।`
      : `I urgently need ${selectedBloodGroup || 'AB+'} blood (compatible groups also accepted: ${compatibleList}) — ${unitsNeeded} units required. Location: ${selectedDistrict}, ${selectedState} (At home / in transit). Please help if you can.`
    : isHi
      ? `मुझे तत्काल ${selectedBloodGroup || 'AB+'} रक्त की आवश्यकता है (संगत समूह भी मान्य: ${compatibleList}) — ${unitsNeeded} यूनिट चाहिए। मरीज़ ${selectedHospital.name} में भर्ती है। कृपया जीवन बचाने में सहायता करें।`
      : `I urgently need ${selectedBloodGroup || 'AB+'} blood (compatible groups also accepted: ${compatibleList}) — ${unitsNeeded} units required. Patient is at ${selectedHospital.name}. Please help if you can.`;

  // Filter only curated facilities. Unknown districts return no fabricated hospitals.
  const filteredHospitals = activeRegionHospitals.filter((h) =>
    h.name.toLowerCase().includes(hospitalSearch.toLowerCase()) ||
    h.city.toLowerCase().includes(hospitalSearch.toLowerCase())
  );

  // Compute progress bar percentage
  const getProgressPercentage = (): number => {
    switch (currentStep) {
      case 'STEP_1_BLOOD_GROUP':
        return 20;
      case 'STEP_2_LOCATION':
        return 40;
      case 'STEP_3_HOSPITAL':
        return 60;
      case 'STEP_4_PATIENT_DETAILS':
        return 80;
      case 'STEP_5_COMPONENT':
        return 80;
      case 'STEP_6_SEND_REQUEST':
        return 100;
      default:
        return 100;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center py-0 sm:py-6 px-0 sm:px-4">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-white min-h-screen sm:min-h-[840px] sm:rounded-3xl shadow-xl border-x border-slate-100 flex flex-col relative overflow-hidden font-sans pb-24">
        
        {/* ========================================================================= */}
        {/* HEADER BAR (Except Fullscreen Screens) */}
        {/* ========================================================================= */}
        {currentStep !== 'SCREEN_RADAR' && currentStep !== 'SCREEN_SENDING' && (
          <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 z-30">
            <div className="flex items-center justify-between px-4 h-14">
              {/* Back Button */}
              <button
                type="button"
                onClick={goBack}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
              </button>

              {/* Title / Step Tracker */}
              <div className="font-semibold text-base text-slate-900">
                {currentStep === 'STEP_1_BLOOD_GROUP' && (isHi ? 'चरण 1 / 5' : 'Step 1 of 5')}
                {currentStep === 'STEP_2_LOCATION' && (isHi ? 'चरण 2 / 5' : 'Step 2 of 5')}
                {currentStep === 'STEP_3_HOSPITAL' && (isHi ? 'चरण 3 / 5' : 'Step 3 of 5')}
                {currentStep === 'SCREEN_BLOOD_BANKS' && (isHi ? 'ब्लड बैंक' : 'Blood Banks')}
                {currentStep === 'SCREEN_DONORS_FOUND' && (isHi ? 'रक्तदाता मिले' : 'Donors found')}
                {currentStep === 'STEP_4_PATIENT_DETAILS' && (isHi ? 'मरीज़ का विवरण' : 'Patient Details')}
                {currentStep === 'STEP_5_COMPONENT' && (isHi ? 'मरीज़ का विवरण' : 'Patient Details')}
                {currentStep === 'STEP_6_SEND_REQUEST' && (isHi ? 'अनुरोध भेजें' : 'Send request')}
                {currentStep === 'SCREEN_WAITING_ROOM' && (isHi ? 'अनुरोध भेजा गया' : 'Request sent')}
              </div>

              {/* Action Buttons: Language Pill & Close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {isHi ? 'HI' : 'EN'}
                </button>

                {currentStep !== 'STEP_1_BLOOD_GROUP' && (
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar (Visible during 5-step flow) */}
            {[
              'STEP_1_BLOOD_GROUP',
              'STEP_2_LOCATION',
              'STEP_3_HOSPITAL',
              'STEP_4_PATIENT_DETAILS',
              'STEP_5_COMPONENT',
              'STEP_6_SEND_REQUEST',
            ].includes(currentStep) && (
              <div className="w-full bg-slate-100 h-1">
                <div
                  className="bg-rose-500 h-1 transition-all duration-300 ease-out"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            )}
          </header>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: BLOOD GROUP OF THE PATIENT (Matching Reference Screen 1) */}
        {/* ========================================================================= */}
        {currentStep === 'STEP_1_BLOOD_GROUP' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {isHi ? 'मरीज़ का रक्त समूह (ब्लड ग्रुप) क्या है?' : 'What is the blood group of the patient?'}
              </h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {isHi
                  ? 'हम मेल खाने वाले या संगत (कंपैटिबल) ग्रुप के साथ बैंकों और रक्तदाताओं की खोज करेंगे।'
                  : "We'll search banks and donors with a matching or compatible group."}
              </p>

              {/* 8-Grid Blood Group Cards */}
              <div className="grid grid-cols-4 gap-3 mt-6">
                {BLOOD_GROUPS.map((group) => {
                  const isSelected = selectedBloodGroup === group;
                  const meta = BLOOD_GROUP_METADATA[group];
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setSelectedBloodGroup(group)}
                      className={`h-24 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20 text-rose-700 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <span className="text-2xl font-extrabold tracking-tight">{group}</span>
                      <span className="text-[11px] text-slate-400 font-medium mt-1">
                        {isHi ? meta.rarityHi : meta.rarity}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Not sure which group helper */}
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowGroupHelperModal(true)}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  <Info className="w-4 h-4 text-slate-400" />
                  <span>{isHi ? 'रक्त समूह निश्चित नहीं है?' : 'Not sure which group?'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Continue Action */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30">
              <Button
                type="button"
                disabled={!selectedBloodGroup}
                onClick={() => goToStep('STEP_2_LOCATION')}
                className={`w-full h-12 rounded-xl text-base font-semibold shadow-md transition-all ${
                  selectedBloodGroup
                    ? 'bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.99]'
                    : 'bg-rose-200 text-white cursor-not-allowed'
                }`}
              >
                {isHi ? 'आगे बढ़ें' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: SHARE PATIENT'S LOCATION (Matching Reference Screens 2 & 3) */}
        {/* ========================================================================= */}
        {currentStep === 'STEP_2_LOCATION' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                  {isHi ? 'मरीज़ का स्थान साझा करें' : "Share patient's location"}
                </h1>
                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      isHi
                        ? 'मरीज़ का स्थान साझा करें। हम इसका उपयोग दूरी के भीतर वास्तविक ब्लड बैंकों और रक्तदाताओं को खोजने के लिए करते हैं।'
                        : "Share patient's location. We use it to find real blood banks and donors within range — nothing is stored or shared."
                    )
                  }
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                  aria-label="Speak"
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {isHi
                  ? 'हम इसका उपयोग दूरी के भीतर वास्तविक ब्लड बैंकों और रक्तदाताओं को खोजने के लिए करते हैं — कुछ भी संग्रहीत या साझा नहीं किया जाता है।'
                  : 'We use it to find real blood banks and donors within range — nothing is stored or shared.'}
              </p>

              {/* Status and Active Geolocation Displays */}
              <div className="mt-5 space-y-3">
                {/* Active Locating Feedback */}
                {isLocating && (
                  <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-700">
                        {isHi ? 'स्थान खोजा जा रहा है' : 'Acquiring GPS Location'}
                      </div>
                      <div className="text-sm font-semibold mt-0.5">
                        {locatingStatus || (isHi ? 'जीपीएस और शहर की पहचान हो रही है...' : 'Detecting your coordinates and city...')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Live GPS Active Confirmation Card */}
                {isGpsActive && detectedLocationName && !isLocating && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 shadow-xs">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            {isHi ? 'लाइव जीपीएस स्थान सक्रिय' : 'Live GPS Location Active'}
                          </div>
                          <div className="text-sm font-bold text-slate-900 leading-snug">
                            {detectedLocationName}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full shrink-0">
                        {gpsAccuracy}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-xs text-slate-600">
                      <span>📍 {lat.toFixed(4)}°N, {lng.toFixed(4)}°E</span>
                      <button
                        type="button"
                        onClick={() => requestDeviceLocation(locationType)}
                        className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>{isHi ? 'पुनः प्राप्त करें' : 'Refresh GPS'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Location Error Feedback */}
                {locationError && !isLocating && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">{locationError}</span>
                      <p className="mt-0.5 text-amber-800">
                        {isHi
                          ? 'चिंता न करें, आप नीचे दी गई सूची से आसानी से अपना राज्य और ज़िला चुन सकते हैं।'
                          : 'No problem, you can select your State and District from the list below.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* State & District Manual Dropdowns (All 36 States & 781 Districts) */}
              <div className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isHi ? 'राज्य / केंद्र शासित प्रदेश चुनें (सभी 36)' : 'Select State / UT (All 36)'}
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setSelectedState(newState);
                      setSelectedDistrict('');
                      setIsGpsActive(false);
                      setIsLocationResolved(false);
                      setDetectedLocationName(null);
                      setBanksList([]);
                      setSelectedHospital({
                        id: 'unselected-hospital',
                        name: '',
                        city: '',
                        lat,
                        lng,
                        distanceKm: null,
                        type: 'Government',
                      });
                    }}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:18px_18px] bg-[right_14px_center] bg-no-repeat"
                  >
                    {ALL_INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isHi ? 'ज़िला चुनें' : 'Select District'}
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      setIsGpsActive(false);
                      setIsLocationResolved(false);
                      setDetectedLocationName(null);
                      setBanksList([]);
                      setSelectedHospital({
                        id: 'unselected-hospital',
                        name: '',
                        city: '',
                        lat,
                        lng,
                        distanceKm: null,
                        type: 'Government',
                      });
                    }}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:18px_18px] bg-[right_14px_center] bg-no-repeat"
                  >
                    {(getDistrictsForState(selectedState) || []).map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLocationError(null);
                      setShowLocationModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-rose-200 bg-rose-50/50 text-rose-700 text-sm font-semibold hover:bg-rose-50 transition-colors"
                  >
                    <Crosshair className="w-4 h-4" />
                    <span>{isHi ? 'जीपीएस द्वारा लाइव लोकेशन उपयोग करें' : 'Detect Live GPS Location Instead'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Confirm Action */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30">
              <Button
                type="button"
                onClick={resolveManualLocation}
                disabled={isLocating || !selectedDistrict}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.99]"
              >
                {isLocating
                  ? (isHi ? 'स्थान खोजा जा रहा है…' : 'Resolving location…')
                  : (isHi ? 'स्थान की पुष्टि करें' : 'Confirm location')}
              </Button>
            </div>

            {/* In-App Device Location Permission Modal (Matching Reference Screen 2) */}
            {showLocationModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                <div className="w-full max-w-xs bg-slate-900 text-white rounded-3xl p-5 shadow-2xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sky-400">
                      <MapPin className="w-5 h-5 fill-sky-400 text-slate-900" />
                    </div>
                    <div className="text-sm font-semibold leading-snug">
                      <span className="font-bold">raktkhoj.org</span> wants to use your device&apos;s location
                    </div>
                  </div>

                  {/* Radio Choice: Precise vs Approximate */}
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setLocationType('precise')}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-colors ${
                        locationType === 'precise'
                          ? 'border-sky-500 bg-slate-800/80'
                          : 'border-slate-800 bg-slate-850 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                          <Crosshair className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold">Precise</div>
                          <div className="text-xs text-slate-400">Exact location</div>
                        </div>
                      </div>
                      {locationType === 'precise' && (
                        <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-slate-900">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setLocationType('approximate')}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-colors ${
                        locationType === 'approximate'
                          ? 'border-sky-500 bg-slate-800/80'
                          : 'border-slate-800 bg-slate-850 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold">Approximate</div>
                          <div className="text-xs text-slate-400">Neighbourhood</div>
                        </div>
                      </div>
                      {locationType === 'approximate' && (
                        <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-slate-900">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Permissions Action Buttons */}
                  <div className="mt-5 space-y-2">
                    <button
                      type="button"
                      onClick={() => requestDeviceLocation('precise')}
                      disabled={isLocating}
                      className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold text-slate-100 flex items-center justify-center gap-2"
                    >
                      {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>Allow while visiting the site</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeviceLocation(locationType)}
                      disabled={isLocating}
                      className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold text-slate-100 flex items-center justify-center gap-2"
                    >
                      {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>Allow this time</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLocationModal(false)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-sm font-semibold text-slate-400 hover:text-slate-200"
                    >
                      Never allow
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: CONFIRM THE HOSPITAL PATIENT IS AT (Matching Reference Screen 4) */}
        {/* ========================================================================= */}
        {currentStep === 'STEP_3_HOSPITAL' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                    {isHi ? 'अस्पताल की पुष्टि करें जहाँ मरीज़ भर्ती है' : 'Confirm the hospital patient is at'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {isHi
                      ? `${selectedDistrict}, ${selectedState} के प्रमुख अस्पताल (वैकल्पिक)`
                      : `Top hospitals in ${selectedDistrict}, ${selectedState} (Optional)`}
                  </p>
                </div>
              </div>

              {/* Hospital Search Input */}
              <div className="mt-4 relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={hospitalSearch}
                  onChange={(e) => {
                    setHospitalSearch(e.target.value);
                    if (isHospitalOptional) setIsHospitalOptional(false);
                  }}
                  placeholder={
                    isHi
                      ? `${selectedDistrict} में अस्पताल खोजें या टाइप करें...`
                      : `Search or type hospital in ${selectedDistrict}...`
                  }
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* List of Nearby Hospitals */}
              <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {/* Optional "Not at a hospital yet" Choice */}
                <button
                  type="button"
                  onClick={() => {
                    setIsHospitalOptional(true);
                    setSelectedHospital({
                      id: 'not-at-hospital',
                      name: isHi ? 'घर पर / ट्रांजिट में' : 'At Home / In Transit',
                      city: selectedDistrict,
                      distanceKm: null,
                      lat,
                      lng,
                      type: 'Private',
                    });
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    isHospitalOptional
                      ? 'border-rose-500 bg-rose-50/70 ring-1 ring-rose-500/30'
                      : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex-1 pr-3">
                    <div className="text-sm font-bold text-slate-900 leading-snug flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span>{isHi ? 'मरीज़ अभी अस्पताल में नहीं है (घर / ट्रांजिट)' : "Patient not at hospital yet (Home / In Transit)"}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {isHi ? 'अस्पताल चुनना वैकल्पिक है' : 'Hospital selection is optional'}
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isHospitalOptional
                        ? 'border-rose-500 bg-rose-500 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isHospitalOptional && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </button>

                {/* Custom Hospital Choice if typed something not in list */}
                {hospitalSearch.trim().length > 1 &&
                  !filteredHospitals.some(
                    (h) => h.name.toLowerCase() === hospitalSearch.trim().toLowerCase()
                  ) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsHospitalOptional(false);
                        const customHosp: NearbyHospital = {
                          id: `custom-${Date.now()}`,
                          name: hospitalSearch.trim(),
                          city: selectedDistrict,
                          distanceKm: null,
                          lat,
                          lng,
                          type: 'Private',
                        };
                        setSelectedHospital(customHosp);
                      }}
                      className="w-full p-3.5 rounded-2xl border border-rose-300 bg-rose-50/50 text-left flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs text-rose-600 font-bold uppercase tracking-wider">
                          {isHi ? 'कस्टम अस्पताल जोड़ें' : 'Use Custom Hospital'}
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">
                          &quot;{hospitalSearch.trim()}&quot;
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-rose-600 bg-white px-2.5 py-1 rounded-lg border border-rose-200">
                        Select
                      </div>
                    </button>
                  )}

                {/* Regional Real Hospital List */}
                {filteredHospitals.map((hospital) => {
                  const isSelected = !isHospitalOptional && selectedHospital.id === hospital.id;
                  return (
                    <button
                      key={hospital.id}
                      type="button"
                      onClick={() => {
                        setIsHospitalOptional(false);
                        setSelectedHospital(hospital);
                      }}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/70 ring-1 ring-rose-500/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex-1 pr-3">
                        <div className="text-sm font-bold text-slate-900 leading-snug">
                          {hospital.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <span>{hospital.city}</span>
                          <span>·</span>
                          <span className="font-semibold text-rose-600">
                            {hospital.distanceKm !== null
                              ? `${hospital.distanceKm.toFixed(1)} km`
                              : (isHi ? 'दूरी उपलब्ध नहीं' : 'Distance unavailable')}
                          </span>
                          <span>·</span>
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {hospital.type}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-rose-500 bg-rose-500 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Confirm Action & Skip Option */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30 space-y-2">
              <Button
                type="button"
                onClick={startRadarSearch}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.99]"
              >
                {isHi ? 'पुष्टि करें और आगे बढ़ें' : 'Confirm & Continue'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsHospitalOptional(true);
                    setSelectedHospital({
                      id: 'skipped',
                      name: isHi ? 'अस्पताल निर्दिष्ट नहीं' : 'Hospital Not Specified',
                      city: selectedDistrict,
                      distanceKm: null,
                      lat,
                      lng,
                      type: 'Private',
                    });
                    startRadarSearch();
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {isHi ? 'छोड़ें — मरीज़ अभी अस्पताल में नहीं है' : "Skip this step — I'm not at a hospital yet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RADAR SCANNING SCREEN (Matching Reference Screen 5) */}
        {/* ========================================================================= */}
        {currentStep === 'SCREEN_RADAR' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            {/* Circular Radar Animation */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Concentric rings */}
              <div className="absolute inset-0 rounded-full border border-slate-200/80"></div>
              <div className="absolute inset-8 rounded-full border border-slate-200/80"></div>
              <div className="absolute inset-16 rounded-full border border-slate-200/80"></div>
              <div className="absolute inset-24 rounded-full border border-slate-200/80"></div>

              {/* Center red pulse dot */}
              <div className="w-4 h-4 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 z-10"></div>

              {/* Radar sweep beam */}
              <div
                className="absolute inset-0 rounded-full animate-radar pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 0deg at 50% 50%, rgba(244, 63, 94, 0.4) 0deg, rgba(244, 63, 94, 0) 65deg, transparent 65deg)',
                }}
              />

              {/* Blip dots */}
              <div className="absolute top-12 left-20 w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse"></div>
              <div className="absolute top-24 right-14 w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse delay-150"></div>
              <div className="absolute bottom-20 left-16 w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse delay-300"></div>
              <div className="absolute bottom-16 right-24 w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse delay-500"></div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 mt-8 tracking-tight">
              {isHi ? 'आपके नज़दीक ब्लड बैंक खोजे जा रहे हैं...' : 'Searching blood banks near you...'}
            </h2>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOOD BANKS DISCOVERY & MAP SCREEN (Matching Reference Screens 6 & 7) */}
        {/* ========================================================================= */}
        {currentStep === 'SCREEN_BLOOD_BANKS' && (
          <div className="flex-1 flex flex-col">
            {/* Interactive Leaflet Map (Height 210px for mobile) */}
            <div className="relative w-full h-[210px] bg-slate-100">
              <MapView
                center={[lat, lng]}
                zoom={10}
                radiusKm={radiusKm}
                markers={mapMarkers}
                height="210px"
              />

              {/* Floating Legend Pill */}
              <div className="absolute bottom-2.5 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-3 z-10">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Best match
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Has stock
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  No stock
                </span>
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Radius Filter Pills */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2 justify-center">
                {([25, 50, 100] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRadiusKm(r);
                      void fetchBloodBanks(r);
                    }}
                    className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      radiusKm === r
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>

              {/* Subhead count */}
              <div className="text-sm font-bold text-slate-800 text-center mt-3">
                {isHi
                  ? `${displayBanks.length} बैंक उपलब्ध (${selectedDistrict}, ${selectedState}) · ${selectedBloodGroup || 'AB+'} और संगत`
                  : `Showing ${displayBanks.length} Bank(s) in ${selectedDistrict}, ${selectedState} · ${selectedBloodGroup || 'AB+'} & Compatible`}
              </div>

              {displayBanks.some((bank: any) => typeof bank.distanceKm !== 'number') && (
                <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] leading-relaxed text-amber-800">
                  {isHi
                    ? 'कुछ आधिकारिक स्टॉक रिकॉर्ड में बैंक के GPS निर्देशांक नहीं हैं। ऐसे रिकॉर्ड ज़िला-स्तर पर दिखाए जाते हैं; उनकी 25/50/100 किमी दूरी सत्यापित नहीं की जा सकती और वे मानचित्र पर नहीं दिखेंगे।'
                    : 'Some official stock records do not include bank GPS coordinates. They are shown as district-level stock results; their 25/50/100 km distance cannot be verified and they will not appear as map pins.'}
                </p>
              )}
            </div>

            {/* Scrollable Blood Banks Cards List */}
            <div className="p-4 space-y-3 pb-28">
              {banksError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{banksError}</p>}
              {banksLoading && <p className="text-center text-sm text-slate-500">{isHi ? 'ब्लड बैंक खोजे जा रहे हैं…' : 'Searching blood banks…'}</p>}
              {!banksLoading && !banksError && displayBanks.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">{isHi ? 'इस क्षेत्र में कोई सत्यापित परिणाम नहीं मिला।' : 'No blood bank results were returned for this area.'}</p>
                  <p className="mt-1 text-xs text-slate-500">{isHi ? 'दायरा बढ़ाकर फिर खोजें या रक्तदाता खोजें।' : 'Try a wider radius or continue to search for registered volunteer donors.'}</p>
                </div>
              )}
              {displayBanks.map((bank: any) => {
                const matchingStock = (bank.stock || []).filter((item: any) =>
                  item.bloodGroup === selectedBloodGroup &&
                  item.componentType === selectedComponent &&
                  item.unitsAvailable > 0
                );
                const units = matchingStock.reduce((sum: number, item: any) => sum + item.unitsAvailable, 0);
                const measuredDistance = typeof bank.distanceKm === 'number' && Number.isFinite(bank.distanceKm)
                  ? `${bank.distanceKm.toFixed(1)} km`
                  : (isHi ? 'दूरी उपलब्ध नहीं' : 'Distance unavailable');
                const updatedTime = bank.lastStockUpdate
                  ? new Date(bank.lastStockUpdate).toLocaleString(isHi ? 'hi-IN' : 'en-IN')
                  : (isHi ? 'अपडेट समय उपलब्ध नहीं' : 'Update time unavailable');
                const destLat = typeof bank.latitude === 'number' ? bank.latitude : null;
                const destLng = typeof bank.longitude === 'number' ? bank.longitude : null;
                const bankPhone = typeof bank.phone === 'string' && bank.phone.trim() ? bank.phone : null;
                const bankLocation = bank.address || bank.city || `${selectedDistrict}, ${selectedState}`;

                return (
                  <div
                    key={bank.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all space-y-3"
                  >
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{bank.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {bankLocation} · <span className="font-semibold text-rose-600">{measuredDistance}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        {bank.source || 'Blood Bank'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                        {units} {isHi ? 'यूनिट उपलब्ध' : 'units available'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {selectedBloodGroup || 'AB+'} · {selectedComponent}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {updatedTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleShare(bank.name, `${bankLocation} · ${measuredDistance}`)}
                        className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors shadow-xs"
                        aria-label="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {destLat !== null && destLng !== null && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors shadow-xs"
                          aria-label="Directions"
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      )}

                      {bankPhone && (
                        <a
                          href={`tel:${bankPhone}`}
                          className="flex-1 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-2 text-slate-800 text-sm font-semibold transition-colors shadow-xs"
                        >
                          <Phone className="w-4 h-4 text-slate-700" />
                          <span>{isHi ? 'कॉल करें' : 'Call'}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Sticky Action: Fallback to Donors (Matching Reference Screen 7) */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30 flex flex-col items-center gap-1.5 shadow-lg">
              <span className="text-xs text-slate-500 font-medium">
                {isHi ? 'ब्लड बैंक तक जाने में असमर्थ?' : 'Unable to travel to the banks?'}
              </span>
              <Button
                type="button"
                onClick={handleFindDonors}
                disabled={donorLookupLoading || !isLocationResolved}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {donorLookupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5 animate-pulse" />}
                <span>{isHi ? 'अपने नज़दीक रक्तदाता खोजें' : 'Search eligible donors near you'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DONORS FOUND & VERIFICATION CHECK (Matching Reference Screen 8) */}
        {/* ========================================================================= */}
        {currentStep === 'SCREEN_DONORS_FOUND' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {isHi ? 'आपके क्षेत्र में संगत रक्तदाता' : 'Compatible donors in your area'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {isHi
                  ? `${radiusKm} किमी के भीतर उपलब्ध और इस डिवाइस पर सूचना चालू रखने वाले पंजीकृत रक्तदाताओं को ही अनुरोध भेजा जाएगा।`
                  : `Only registered, available donors with push notifications enabled on their devices can receive this request within ${radiusKm} km.`}
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                {donorLookupLoading ? (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
                    {isHi ? 'पंजीकृत रक्तदाताओं की जाँच हो रही है…' : 'Checking registered, notification-enabled donors…'}
                  </div>
                ) : donorLookupError ? (
                  <p role="alert" className="text-sm text-red-700">{donorLookupError}</p>
                ) : donorsCount > 0 ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                    <p className="text-sm text-slate-700">
                      {isHi
                        ? 'इस क्षेत्र में योग्य सूचना-सक्षम रक्तदाता उपलब्ध हैं। वास्तविक अनुरोध बनाते समय केवल मेल खाने वाले रक्तदाताओं को अलर्ट भेजा जाएगा।'
                        : 'Eligible notification-enabled donor registrations are available in this area. When you send the request, the API will notify only the matching donors.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                    <p className="text-sm text-slate-700">
                      {isHi
                        ? 'अभी इस क्षेत्र में सक्रिय सूचना-सदस्यता वाला कोई संगत रक्तदाता नहीं मिला। आप फिर भी अनुरोध बना सकते हैं; कोई झूठा अलर्ट नहीं दिखाया जाएगा।'
                        : 'No compatible donor with an active push subscription was found in this area right now. You can still create the request; the system will not show or message demo donors.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur-md">
              <Button
                type="button"
                onClick={() => goToStep('STEP_4_PATIENT_DETAILS')}
                className="h-12 w-full rounded-xl bg-rose-500 text-base font-semibold text-white shadow-md hover:bg-rose-600"
              >
                {isHi ? 'आगे बढ़ें' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* STEP 4: PATIENT DETAILS (Matching Reference Screen 9) */}
        {/* ========================================================================= */}
        {currentStep === 'STEP_4_PATIENT_DETAILS' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {isHi ? 'मरीज़ के बारे में कुछ विवरण' : 'A few details about the patient'}
              </h1>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {isHi
                  ? 'विस्तृत अनुरोध से रक्तदाता द्वारा सहायता की संभावना बढ़ जाती है।'
                  : 'A detailed request is far more likely to invite a donor.'}
              </p>

              {/* Form Fields */}
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isHi ? 'मरीज़ का नाम' : 'Patient name'}
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder={isHi ? 'उदा. साहिब सिंह' : 'e.g. Sahib Singh'}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isHi ? 'आयु (वर्ष)' : 'Age'}
                  </label>
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    placeholder={isHi ? 'उदा. 34' : 'e.g. 34'}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isHi ? 'लिंग' : 'Gender'}
                  </label>
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    <option value="Prefer not to say">{isHi ? 'कहना नहीं चाहते' : 'Prefer not to say'}</option>
                    <option value="Male">{isHi ? 'पुरुष' : 'Male'}</option>
                    <option value="Female">{isHi ? 'महिला' : 'Female'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {isHi ? 'आवश्यक यूनिट की संख्या' : 'Number of units required'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={unitsNeeded}
                    onChange={(e) => setUnitsNeeded(parseInt(e.target.value, 10) || 1)}
                    placeholder="e.g. 2"
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Continue Action */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30">
              <Button
                type="button"
                onClick={() => goToStep('STEP_5_COMPONENT')}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.99]"
              >
                {isHi ? 'आगे बढ़ें' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: WHAT EXACTLY IS NEEDED? (Matching Reference Screen 10) */}
        {/* ========================================================================= */}
        {currentStep === 'STEP_5_COMPONENT' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                  {isHi ? 'वास्तव में किस घटक की आवश्यकता है?' : 'What exactly is needed?'}
                </h1>
                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      isHi
                        ? 'वास्तव में किस घटक की आवश्यकता है? डॉक्टर से पूछें। इससे हमें रक्तदाताओं को अधिक सटीक रूप से फ़िल्टर करने में मदद मिलेगी।'
                        : 'What exactly is needed? Ask the doctor. This will help us filter out donors more accurately.'
                    )
                  }
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                  aria-label="Speak"
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {isHi
                  ? 'डॉक्टर से पूछें। इससे हमें रक्तदाताओं को अधिक सटीक रूप से फ़िल्टर करने में मदद मिलेगी'
                  : 'Ask the doctor. This will help us filter out donors more accurately'}
              </p>

              {/* Component Pills */}
              <div className="flex flex-wrap gap-2.5 mt-6">
                {COMPONENT_OPTIONS.map((comp) => {
                  const isSelected = selectedComponent === comp.id;
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setSelectedComponent(comp.id)}
                      className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                        isSelected
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {isHi ? comp.labelHi : comp.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Continue Action */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30">
              <Button
                type="button"
                onClick={() => goToStep('STEP_6_SEND_REQUEST')}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.99]"
              >
                {isHi ? 'आगे बढ़ें' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6: MESSAGE REQUEST TO DONOR (Matching Reference Screen 11) */}
        {/* ========================================================================= */}
        {currentStep === 'STEP_6_SEND_REQUEST' && (
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {isHi ? 'रक्तदाता को संदेश अनुरोध' : 'Message request to donor'}
              </h1>

              {/* YOUR MESSAGE Card */}
              <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 tracking-wider uppercase">
                  <span>{isHi ? 'आपका संदेश' : 'YOUR MESSAGE'}</span>
                  <button
                    type="button"
                    onClick={() => speakText(defaultGeneratedMessage)}
                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-slate-600 shadow-2xs hover:bg-slate-100"
                    aria-label="Speak"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-slate-700 mt-2.5 leading-relaxed font-medium">
                  {defaultGeneratedMessage}
                </p>
              </div>

              {/* Patient's Condition Box with Camera & Mic Icons */}
              <div className="mt-4">
                <div className="relative rounded-2xl border border-rose-300 p-3 bg-white focus-within:ring-2 focus-within:ring-rose-500/20 focus-within:border-rose-500 transition-all">
                  <textarea
                    rows={3}
                    value={patientCondition}
                    onChange={(e) => setPatientCondition(e.target.value)}
                    placeholder={isHi ? 'मरीज़ की स्थिति (उदा. दुर्घटना, सर्जरी)...' : "Patient's condition"}
                    className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none bg-transparent"
                  />
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-1">
                    <button
                      type="button"
                      onClick={() => alert(isHi ? 'कैमरा उपलब्ध नहीं है' : 'Camera snapshot simulator')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Camera"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(isHi ? 'वॉइस रिकॉर्डिंग तैयार है' : 'Voice note simulator')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      aria-label="Microphone"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Condition Chips */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {CONDITION_TAGS.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setPatientCondition((prev) =>
                          prev ? `${prev}, ${tag.labelEn}` : tag.labelEn
                        );
                      }}
                      className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:border-slate-300 transition-colors"
                    >
                      {isHi ? tag.labelHi : tag.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {requestError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{requestError}</p>}
            {/* Send the actual request; donor matching and notification delivery are handled by the API. */}
            <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30">
              <Button
                type="button"
                onClick={handleSendRequest}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md bg-rose-500 hover:bg-rose-600 text-white active:scale-[0.99]"
              >
                {isHi ? 'आपातकालीन अनुरोध भेजें' : 'Send emergency request'}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SENDING PAPER AIRPLANE ANIMATION (Matching Reference Screen 12) */}
        {/* ========================================================================= */}
        {currentStep === 'SCREEN_SENDING' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            {/* Flying Paper Airplane */}
            <div className="w-24 h-24 flex items-center justify-center animate-plane">
              <Send className="w-20 h-20 text-rose-500 fill-rose-500 -rotate-45" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mt-8 tracking-tight">
              {isHi ? 'भेजा जा रहा है...' : 'Sending...'}
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              {isHi
                ? 'योग्य रक्तदाताओं को सुरक्षित पुश सूचना भेजी जा रही है…'
                : 'Sending push notifications to eligible registered donors…'}
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REQUEST SENT / WAITING ROOM (Matching Reference Screen 13) */}
        {/* ========================================================================= */}
        {currentStep === 'SCREEN_WAITING_ROOM' && (
          <div className="flex-1 p-4">
            {createdRequestId ? (
              <WaitingRoom
                requestId={createdRequestId}
                requestCloseToken={requestCloseToken}
              />
            ) : (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-800">
                {isHi ? 'अनुरोध आईडी प्राप्त नहीं हुई। कृपया दोबारा प्रयास करें।' : 'No request was created. Please return and try again.'}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* NOT SURE WHICH GROUP HELPER MODAL */}
        {/* ========================================================================= */}
        {showGroupHelperModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  {isHi ? 'रक्त समूह संगतता नियम' : 'Blood Group Compatibility'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGroupHelperModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  <strong>O- (O Negative):</strong> Universal red cell donor. Can give blood to all
                  blood groups. Vital in emergencies.
                </p>
                <p>
                  <strong>AB+ (AB Positive):</strong> Universal recipient. Can safely receive blood
                  from any blood group.
                </p>
                <p>
                  <strong>Rh Factor:</strong> Rh-negative patients should ideally receive Rh-negative
                  blood to prevent antibody reactions.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setShowGroupHelperModal(false)}
                className="w-full h-11 rounded-xl bg-slate-900 text-white font-semibold"
              >
                {isHi ? 'समझ गया' : 'Got it'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default RequestWizard;
