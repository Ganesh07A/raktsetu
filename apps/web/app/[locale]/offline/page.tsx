'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import { WifiOff, PhoneCall, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Helpline {
  nameEn: string;
  nameHi: string;
  number: string;
  callUrl: string;
  descriptionEn: string;
  descriptionHi: string;
  isPrimary?: boolean;
}

const HELPLINES: Helpline[] = [
  {
    nameEn: 'National Blood & Health Helpline',
    nameHi: 'राष्ट्रीय रक्त एवं स्वास्थ्य हेल्पलाइन',
    number: '104',
    callUrl: 'tel:104',
    descriptionEn: '24x7 government helpline for blood availability, blood bank locations, and medical advice.',
    descriptionHi: 'रक्त उपलब्धता, ब्लड बैंक की स्थिति और आपातकालीन सहायता के लिए 24 घंटे उपलब्ध।',
    isPrimary: true,
  },
  {
    nameEn: 'Emergency Ambulance Services',
    nameHi: 'आपातकालीन एम्बुलेंस सेवा',
    number: '108',
    callUrl: 'tel:108',
    descriptionEn: 'Immediate medical transport and critical care ambulance dispatch across India.',
    descriptionHi: 'त्वरित चिकित्सा परिवहन और आपातकालीन रोगी वाहन सेवा।',
    isPrimary: true,
  },
  {
    nameEn: 'All-in-One National Emergency Number',
    nameHi: 'अखिल भारतीय आपातकालीन नंबर',
    number: '112',
    callUrl: 'tel:112',
    descriptionEn: 'Unified emergency response system for police, fire, and medical crises.',
    descriptionHi: 'एकीकृत राष्ट्रीय आपातकालीन प्रतिक्रिया प्रणाली (पुलिस, एम्बुलेंस, आपदा)।',
  },
  {
    nameEn: 'eRaktKosh NBTC Toll-Free Helpline',
    nameHi: 'ई-रक्तकोष राष्ट्रीय रक्त संचरण परिषद',
    number: '1800-180-1104',
    callUrl: 'tel:18001801104',
    descriptionEn: 'Central helpline by Ministry of Health and Family Welfare for nationwide blood bank status.',
    descriptionHi: 'स्वास्थ्य एवं परिवार कल्याण मंत्रालय द्वारा संचालित केंद्रीय टोल-फ्री नंबर।',
  },
  {
    nameEn: 'Indian Red Cross Society (IRCS) Blood Bank',
    nameHi: 'भारतीय रेड क्रॉस सोसाइटी केंद्रीय ब्लड बैंक',
    number: '011-23711551',
    callUrl: 'tel:01123711551',
    descriptionEn: 'National headquarters blood bank, 1 Red Cross Road, New Delhi.',
    descriptionHi: 'राष्ट्रीय मुख्यालय ब्लड बैंक, नई दिल्ली।',
  },
];

const COMPATIBILITY_CHART = [
  { recipient: 'O-', compatibleDonors: 'O- only (Universal RBC Donor)' },
  { recipient: 'O+', compatibleDonors: 'O+, O-' },
  { recipient: 'A-', compatibleDonors: 'A-, O-' },
  { recipient: 'A+', compatibleDonors: 'A+, A-, O+, O-' },
  { recipient: 'B-', compatibleDonors: 'B-, O-' },
  { recipient: 'B+', compatibleDonors: 'B+, B-, O+, O-' },
  { recipient: 'AB-', compatibleDonors: 'AB-, A-, B-, O-' },
  { recipient: 'AB+', compatibleDonors: 'All 8 Groups (Universal Recipient)' },
];

export default function OfflinePage() {
  const locale = useLocale();
  const isHi = locale === 'hi';
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    if (typeof window !== 'undefined') {
      if (navigator.onLine) {
        window.location.href = isHi ? '/hi' : '/';
      } else {
        setTimeout(() => setIsRetrying(false), 800);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Offline Alert Banner */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-full bg-amber-100 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
              <WifiOff className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">
                  {isHi ? 'आप वर्तमान में ऑफ़लाइन हैं' : 'You Are Currently Offline'}
                </h1>
                <Badge variant="warning">{isHi ? 'इंटरनेट बाधित' : 'No Internet'}</Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 mt-1">
                {isHi
                  ? 'इंटरनेट कनेक्शन उपलब्ध नहीं है, परंतु आप नीचे दिए गए नंबरों पर सीधे कॉल करके रक्त बैंक और एम्बुलेंस सहायता ले सकते हैं।'
                  : 'Emergency helpline directory is cached and ready. You can directly place phone calls to national helplines below.'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            loading={isRetrying}
            className="border-amber-400 bg-white hover:bg-amber-100 text-amber-900 shrink-0 font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            {isHi ? 'पुनः प्रयास करें' : 'Retry Connection'}
          </Button>
        </div>
      </div>

      {/* Direct Call Directory */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-red-600" />
            {isHi ? 'तत्काल आपातकालीन हेल्पलाइन निर्देशिका' : 'Immediate Emergency Helpline Directory'}
          </h2>
          <span className="text-xs text-slate-500">
            {isHi ? 'टोल-फ्री / निःशुल्क' : 'Direct 1-Click Dialing'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HELPLINES.map((h) => (
            <Card
              key={h.number}
              className={`border transition-all ${
                h.isPrimary
                  ? 'border-red-300 bg-gradient-to-br from-white to-red-50/40 shadow-sm'
                  : 'border-slate-200'
              }`}
            >
              <CardHeader className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      {isHi ? h.nameHi : h.nameEn}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {isHi ? h.descriptionHi : h.descriptionEn}
                    </CardDescription>
                  </div>
                  {h.isPrimary && (
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      {isHi ? 'प्राथमिक' : 'Priority'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                <a
                  href={h.callUrl}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 text-sm shadow-sm transition-colors active:scale-98"
                >
                  <PhoneCall className="h-4 w-4 fill-current" />
                  <span>
                    {isHi ? 'कॉल करें: ' : 'Call: '}
                    {h.number}
                  </span>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Offline Blood Compatibility Quick Reference */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base font-bold text-slate-900">
                {isHi
                  ? 'ऑफ़लाइन लाल रक्त कोशिका (RBC) अनुकूलता संदर्भ'
                  : 'Offline Red Blood Cell (RBC) Compatibility Matrix'}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
              {isHi ? 'चिकित्सकीय दिशानिर्देश' : 'Clinical Reference'}
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-600 mt-1">
            {isHi
              ? 'आपातकालीन रक्त आधान में कौन सा रक्त समूह किससे प्राप्त कर सकता है:'
              : 'Quick clinical reference for red blood cell transfusions under emergency conditions:'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                <th className="py-2.5 px-3">{isHi ? 'रोगी का रक्त समूह (प्राप्तकर्ता)' : 'Patient Blood Group'}</th>
                <th className="py-2.5 px-3">{isHi ? 'संगत रक्तदाता समूह' : 'Compatible Donor Groups'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMPATIBILITY_CHART.map((row) => (
                <tr key={row.recipient} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-bold text-red-700">{row.recipient}</td>
                  <td className="py-2.5 px-3 text-slate-800">{row.compatibleDonors}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              {isHi
                ? 'नोट: आपातकालीन आधान से पूर्व अस्पताल लैब में क्रॉस-मैचिंग अनिवार्य है।'
                : 'Note: Hospital laboratory cross-matching is mandatory prior to blood transfusion.'}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
