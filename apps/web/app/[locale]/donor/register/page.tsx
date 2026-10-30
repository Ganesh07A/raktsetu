'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Link, useRouter } from '../../../../src/routing';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import { Input } from '@repo/ui/input';
import { Stepper, type StepItem } from '@repo/ui/stepper';
import { PhoneInput, isValidIndianMobile } from '@repo/ui/phone-input';
import {
  Droplet,
  CheckCircle2,
  ShieldCheck,
  Crosshair,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HeartHandshake,
  MessageSquare,
  Lock,
  Calendar,
  User,
  Scale,
} from 'lucide-react';
import {
  BLOOD_GROUPS,
  type BloodGroup,
  type Gender,
} from '@repo/shared';

const STEPS_EN: StepItem[] = [
  { title: 'Mobile & OTP', description: 'Verification' },
  { title: 'Personal Info', description: 'Name & Age' },
  { title: 'Blood Group', description: 'ABO/Rh' },
  { title: 'Location', description: 'GPS or District' },
  { title: 'Consent', description: 'WhatsApp Alerts' },
];

const STEPS_HI: StepItem[] = [
  { title: 'मोबाइल एवं OTP', description: 'सत्यापन' },
  { title: 'व्यक्तिगत विवरण', description: 'नाम एवं आयु' },
  { title: 'रक्त समूह', description: 'ABO/Rh' },
  { title: 'स्थान', description: 'जीपीएस या जिला' },
  { title: 'सहमति', description: 'व्हाट्सएप अलर्ट' },
];

export default function DonorRegistrationPage() {
  const locale = useLocale();
  const isHi = locale === 'hi';
  const router = useRouter();

  // Wizard Step (1 to 5)
  const [currentStep, setCurrentStep] = React.useState<number>(1);

  // Form State
  const [phone, setPhone] = React.useState<string>('');
  const [otpSent, setOtpSent] = React.useState<boolean>(false);
  const [otpCode, setOtpCode] = React.useState<string>('');
  const [otpVerified, setOtpVerified] = React.useState<boolean>(false);
  const [otpError, setOtpError] = React.useState<string | null>(null);

  // Personal Info
  const [name, setName] = React.useState<string>('');
  const [dateOfBirth, setDateOfBirth] = React.useState<string>('1998-01-01');
  const [gender, setGender] = React.useState<Gender>('male');
  const [weightKg, setWeightKg] = React.useState<number>(65);

  // Blood Group
  const [bloodGroup, setBloodGroup] = React.useState<BloodGroup>('O+');
  const [lastDonationDate, setLastDonationDate] = React.useState<string>('');

  // Location
  const [useGps, setUseGps] = React.useState<boolean>(false);
  const [latitude, setLatitude] = React.useState<number>(28.5672);
  const [longitude, setLongitude] = React.useState<number>(77.21);
  const [state, setState] = React.useState<string>('Delhi');
  const [district, setDistrict] = React.useState<string>('South Delhi');
  const [searchRadiusKm, setSearchRadiusKm] = React.useState<number>(10);
  const [gpsLoading, setGpsLoading] = React.useState<boolean>(false);

  // Consent & Availability
  const [whatsappConsent, setWhatsappConsent] = React.useState<boolean>(true);
  const [isAvailable, setIsAvailable] = React.useState<boolean>(true);

  // Submission State
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [registeredDonor, setRegisteredDonor] = React.useState<any | null>(null);

  const steps = isHi ? STEPS_HI : STEPS_EN;

  // Step 1: Send OTP
  const handleSendOtp = () => {
    if (!isValidIndianMobile(phone)) {
      setOtpError(
        isHi
          ? 'कृपया 10 अंकों का वैध भारतीय मोबाइल नंबर दर्ज करें'
          : 'Please enter a valid 10-digit Indian mobile number'
      );
      return;
    }
    setOtpError(null);
    setOtpSent(true);
    setOtpCode('123456'); // Pre-fill mock OTP for smooth verification
  };

  const handleVerifyOtp = () => {
    if (otpCode === '123456' || otpCode.length === 6) {
      setOtpVerified(true);
      setOtpError(null);
      setCurrentStep(2);
    } else {
      setOtpError(isHi ? 'अमान्य OTP कोड' : 'Invalid OTP code');
    }
  };

  // Step 4: GPS auto detection
  const handleDetectGps = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setUseGps(true);
          setGpsLoading(false);
        },
        () => {
          setGpsLoading(false);
          setLatitude(28.5672);
          setLongitude(77.21);
        }
      );
    }
  };

  // Final Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappConsent) {
      setSubmitError(
        isHi
          ? 'रक्तदाता पंजीकरण के लिए व्हाट्सएप सूचनाओं की सहमति आवश्यक है'
          : 'Consent to receive WhatsApp notifications is required'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      phone: `+91${phone}`,
      name: name.trim(),
      bloodGroup,
      latitude,
      longitude,
      state,
      district,
      gender,
      weightKg: Number(weightKg),
      dateOfBirth,
      lastDonationDate: lastDonationDate || null,
      whatsappConsent: true,
      isAvailable,
      searchRadiusKm,
      preferredLanguage: locale as 'en' | 'hi',
    };

    try {
      const res = await fetch('http://localhost:3002/api/v1/donors/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to register donor');
      }

      const data = await res.json();
      setRegisteredDonor(data.donor);

      // Save token to localStorage for dashboard
      if (typeof window !== 'undefined') {
        localStorage.setItem('raktkhoj_donor_token', data.token || 'mock_token');
        localStorage.setItem('raktkhoj_donor_id', data.donor?.id || 'donor-1');
        localStorage.setItem('raktkhoj_donor_phone', `+91${phone}`);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error completing registration');
    } finally {
      setSubmitting(false);
    }
  };

  // Celebratory Success Screen
  if (registeredDonor) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 text-center py-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg ring-8 ring-emerald-50 animate-bounce">
          <Droplet className="h-10 w-10 fill-current" />
        </div>

        <div className="space-y-2">
          <Badge variant="success" className="text-xs px-3 py-1 font-bold">
            {isHi ? '✓ पंजीकरण सफल' : '✓ Verified RaktKhoj Life Saver'}
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {isHi ? 'बधाई हो, आप जीवनदाता बन गए हैं!' : 'Thank You For Becoming a Life Saver!'}
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {isHi
              ? 'आपका प्रोफाइल सफलतापूर्वक पंजीकृत हो गया है। जब भी आपके निकट किसी मरीज को आपके रक्त समूह की आवश्यकता होगी, आपको व्हाट्सएप पर सूचित किया जाएगा।'
              : 'Your donor profile is active. You will receive WhatsApp notifications whenever patients near you are in urgent need.'}
          </p>
        </div>

        {/* Digital Donor ID Card */}
        <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white p-6 shadow-xl text-left space-y-4">
          <div className="flex items-center justify-between border-b border-white/20 pb-4">
            <div>
              <p className="text-xs font-semibold text-red-200 uppercase tracking-widest">
                RaktKhoj Donor Identity Card
              </p>
              <h3 className="text-xl font-black">{registeredDonor.name || name}</h3>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white text-red-600 font-black text-2xl flex items-center justify-center shadow-md">
              {registeredDonor.bloodGroup}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-red-100">
            <div>
              <span className="opacity-75">{isHi ? 'पंजीकृत मोबाइल:' : 'Mobile:'}</span>
              <p className="font-bold text-white text-sm">{registeredDonor.phone || `+91 ${phone}`}</p>
            </div>
            <div>
              <span className="opacity-75">{isHi ? 'स्थान:' : 'Location:'}</span>
              <p className="font-bold text-white text-sm">{registeredDonor.district}, {registeredDonor.state}</p>
            </div>
            <div>
              <span className="opacity-75">{isHi ? 'स्थिति:' : 'Status:'}</span>
              <p className="font-bold text-emerald-300 text-sm">
                {registeredDonor.isAvailable ? (isHi ? 'उपलब्ध (Active)' : 'Available') : 'Inactive'}
              </p>
            </div>
            <div>
              <span className="opacity-75">{isHi ? 'दाता आईडी:' : 'Donor ID:'}</span>
              <p className="font-mono text-white text-[11px] truncate">{registeredDonor.id}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-red-200">
            <span>🇮🇳 Voluntary Blood Donor • National Network</span>
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold">
            <Link href="/donor/dashboard">
              <span>{isHi ? 'दाता डैशबोर्ड पर जाएं' : 'Go to Donor Dashboard'}</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto border-slate-300">
            <Link href="/">
              <span>{isHi ? 'मुख्य पृष्ठ' : 'Home'}</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold border border-red-200">
          <HeartHandshake className="h-3.5 w-3.5 text-red-600" />
          <span>{isHi ? 'रक्तदाता पंजीकरण पोर्टल' : 'Volunteer Donor Onboarding'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {isHi ? 'स्वयंसेवी रक्तदाता बनें' : 'Register as a Blood Donor'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          {isHi
            ? 'केवल 2 मिनट में पंजीकरण करें। आपका एक रक्तदान किसी परिवार के चिराग को बुझने से बचा सकता है।'
            : 'Takes just 2 minutes. Receive WhatsApp notifications only when nearby patients need your blood.'}
        </p>
      </div>

      {/* Stepper Component (1 to 5) */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={(step) => {
          if (step < currentStep) setCurrentStep(step);
        }}
        className="pb-4"
      />

      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          {/* STEP 1: MOBILE & OTP */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isHi ? 'चरण 1: मोबाइल नंबर एवं OTP सत्यापन' : 'Step 1: Mobile Phone & OTP Verification'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHi
                    ? 'आपातकालीन व्हाट्सएप सूचनाएं प्राप्त करने के लिए अपना 10 अंकों का सक्रिय मोबाइल नंबर दर्ज करें'
                    : 'Enter your 10-digit mobile number for WhatsApp emergency notifications'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">
                  {isHi ? 'मोबाइल नंबर (+91)' : 'Mobile Phone (+91)'}
                </label>
                <PhoneInput
                  value={phone}
                  onChange={(val) => setPhone(val)}
                  disabled={otpSent}
                />
              </div>

              {!otpSent ? (
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                >
                  <span>{isHi ? 'OTP कोड प्राप्त करें' : 'Get Verification Code'}</span>
                </Button>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700">
                        {isHi ? '6-अंकीय OTP कोड' : '6-Digit OTP Code'}
                      </label>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        {isHi ? 'टेस्ट कोड: 123456' : 'Test Code: 123456'}
                      </span>
                    </div>
                    <Input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="text-center font-mono tracking-widest text-lg h-12"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOtpSent(false)}
                      className="w-1/3"
                    >
                      {isHi ? 'नंबर बदलें' : 'Change Number'}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <span>{isHi ? 'सत्यापित करें एवं आगे बढ़ें' : 'Verify & Continue'}</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {otpError && (
                <p className="text-xs text-red-600 font-semibold">{otpError}</p>
              )}
            </div>
          )}

          {/* STEP 2: PERSONAL INFO */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isHi ? 'चरण 2: व्यक्तिगत विवरण' : 'Step 2: Personal Details'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHi
                    ? 'राष्ट्रीय रक्त संचरण परिषद (NBTC) दिशानिर्देशों के अनुसार पात्रता की पुष्टि'
                    : 'Eligibility guidelines mandated by National Blood Transfusion Council'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span>{isHi ? 'पूरा नाम (Full Name)' : 'Full Name'} *</span>
                </label>
                <Input
                  required
                  placeholder={isHi ? 'उदा. राहुल शर्मा' : 'e.g. Rahul Sharma'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span>{isHi ? 'जन्म तिथि (Date of Birth)' : 'Date of Birth'}</span>
                  </label>
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {isHi ? 'लिंग (Gender)' : 'Gender'}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 font-medium focus:ring-2 focus:ring-red-500"
                  >
                    <option value="male">{isHi ? 'पुरुष (Male)' : 'Male'}</option>
                    <option value="female">{isHi ? 'महिला (Female)' : 'Female'}</option>
                    <option value="other">{isHi ? 'अन्य (Other)' : 'Other'}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-slate-500" />
                  <span>{isHi ? 'वजन (Weight in kg)' : 'Weight (kg)'} *</span>
                </label>
                <Input
                  type="number"
                  min="40"
                  max="150"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="h-11"
                />
                {weightKg < 45 && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      {isHi
                        ? 'नोट: रक्तदान हेतु न्यूनतम वजन 45 किग्रा आवश्यक है।'
                        : 'Note: Minimum donor weight of 45 kg required by NBTC guidelines.'}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>{isHi ? 'पीछे' : 'Back'}</span>
                </Button>
                <Button
                  type="button"
                  disabled={!name.trim()}
                  onClick={() => setCurrentStep(3)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  <span>{isHi ? 'आगे बढ़ें' : 'Next: Blood Group'}</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: BLOOD GROUP */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isHi ? 'चरण 3: आपका रक्त समूह' : 'Step 3: Your Blood Group'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHi
                    ? 'कृपया अपने सत्यापित रक्त समूह का चयन करें'
                    : 'Select your verified ABO/Rh blood group'}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {BLOOD_GROUPS.map((group) => {
                  const isSelected = bloodGroup === group;
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setBloodGroup(group)}
                      className={`h-16 rounded-xl font-black text-xl border-2 transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? 'border-red-600 bg-red-600 text-white shadow-md scale-102'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-red-300'
                      }`}
                    >
                      <span>{group}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700">
                  {isHi ? 'अंतिम रक्तदान की तिथि (यदि लागू हो)' : 'Last Donation Date (Optional)'}
                </label>
                <Input
                  type="date"
                  value={lastDonationDate}
                  onChange={(e) => setLastDonationDate(e.target.value)}
                  className="h-11"
                />
                <p className="text-[10px] text-slate-500">
                  {isHi
                    ? 'पुरुषों के लिए 90 दिन एवं महिलाओं के लिए 120 दिन का न्यूनतम अंतराल अनुशंसित है।'
                    : 'Recommended interval is 90 days for males and 120 days for females.'}
                </p>
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>{isHi ? 'पीछे' : 'Back'}</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  <span>{isHi ? 'आगे बढ़ें' : 'Next: Location'}</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: LOCATION */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isHi ? 'चरण 4: आपका स्थान एवं यात्रा दायरा' : 'Step 4: Location & Travel Radius'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHi
                    ? 'आपातकाल में आप कितनी दूरी तक रक्तदान के लिए जा सकते हैं?'
                    : 'Specify your location and maximum willing response radius'}
                </p>
              </div>

              <Button
                type="button"
                onClick={handleDetectGps}
                loading={gpsLoading}
                variant="outline"
                className="w-full h-11 border-slate-300 text-slate-800 font-bold"
              >
                <Crosshair className="h-4 w-4 mr-2" />
                <span>
                  {useGps
                    ? isHi ? '✓ वर्तमान जीपीएस निर्देशांक प्राप्त' : '✓ Current GPS Coordinates Detected'
                    : isHi ? 'वर्तमान जीपीएस स्थान का उपयोग करें' : 'Use Current GPS Location'}
                </span>
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {isHi ? 'राज्य (State)' : 'State'}
                  </label>
                  <Input
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    {isHi ? 'जिला (District)' : 'District'}
                  </label>
                  <Input
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  {isHi ? 'अधिकतम यात्रा दायरा (Willing Radius)' : 'Willing Travel Radius'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 25].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSearchRadiusKm(r)}
                      className={`h-11 rounded-lg font-bold text-sm border-2 ${
                        searchRadiusKm === r
                          ? 'border-red-600 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>{isHi ? 'पीछे' : 'Back'}</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  <span>{isHi ? 'आगे बढ़ें' : 'Next: Consent'}</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: CONSENT & AVAILABILITY */}
          {currentStep === 5 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isHi ? 'चरण 5: व्हाट्सएप सूचना सहमति एवं उपलब्धता' : 'Step 5: WhatsApp Consent & Availability'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHi
                    ? 'अंतिम चरण: आपातकालीन अलर्ट प्राप्त करने की पुष्टि करें'
                    : 'Final confirmation to receive urgent blood request notifications'}
                </p>
              </div>

              {/* Consent Checkbox */}
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappConsent}
                    onChange={(e) => setWhatsappConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs text-slate-800 leading-relaxed font-medium">
                    {isHi
                      ? 'मैं आपातकालीन परिस्थितियों में मरीज के परिजनों द्वारा रक्त अनुरोध भेजे जाने पर व्हाट्सएप पर तत्काल संदेश और इंटरैक्टिव बटन प्राप्त करने की सहमति देता/देती हूँ।'
                      : 'I agree to receive emergency blood alert notifications via WhatsApp with interactive Accept/Decline quick response buttons when patients nearby require my blood group.'}
                  </span>
                </label>
              </div>

              {/* Availability Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {isHi ? 'वर्तमान में रक्तदान के लिए उपलब्ध' : 'Currently Available to Donate'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isHi
                      ? 'यदि आप अस्वस्थ या यात्रा पर हों तो इसे डैशबोर्ड से कभी भी बंद कर सकते हैं'
                      : 'You can toggle this off anytime from your donor dashboard'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
              </div>

              {submitError && (
                <p className="text-xs text-red-600 font-semibold">{submitError}</p>
              )}

              <div className="flex justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(4)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span>{isHi ? 'पीछे' : 'Back'}</span>
                </Button>
                <Button
                  type="submit"
                  loading={submitting}
                  disabled={!whatsappConsent}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  <span>{isHi ? 'पंजीकरण पूर्ण करें' : 'Complete Registration'}</span>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
