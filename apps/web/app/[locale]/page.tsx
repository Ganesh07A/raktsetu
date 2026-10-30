'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '../../src/routing';
import { Button } from '@repo/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@repo/ui/card';
import { Badge } from '@repo/ui/badge';
import {
  Search,
  UserPlus,
  Building2,
  Users,
  MessageSquare,
  Clock,
  ShieldCheck,
  MapPin,
  ArrowRight,
  PhoneCall,
  Activity,
} from 'lucide-react';

const BLOOD_GROUPS = [
  { group: 'O-', noteEn: 'Universal Donor', noteHi: 'सर्वदाता' },
  { group: 'O+', noteEn: 'Most Common', noteHi: 'सर्वाधिक सामान्य' },
  { group: 'A-', noteEn: 'Rare', noteHi: 'दुर्लभ' },
  { group: 'A+', noteEn: 'High Demand', noteHi: 'उच्च मांग' },
  { group: 'B-', noteEn: 'Rare', noteHi: 'दुर्लभ' },
  { group: 'B+', noteEn: 'High Demand', noteHi: 'उच्च मांग' },
  { group: 'AB-', noteEn: 'Very Rare', noteHi: 'अति दुर्लभ' },
  { group: 'AB+', noteEn: 'Universal Recipient', noteHi: 'सर्वग्राही' },
];

export default function HomePage() {
  const locale = useLocale();
  const isHi = locale === 'hi';

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white p-6 sm:p-12 shadow-lg">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/30 px-3 py-1 text-xs font-semibold backdrop-blur-xs border border-red-300/30">
            <Activity className="h-3.5 w-3.5 animate-pulse text-red-200" />
            <span>
              {isHi
                ? 'दो-चरणीय आपातकालीन रक्त खोज प्रणाली'
                : 'Two-Stage Active Emergency Routing'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            {isHi ? (
              <>
                हर सेकंड मायने रखता है — <br />
                <span className="text-red-200">रक्त खोजें या जीवन बचाएं</span>
              </>
            ) : (
              <>
                When Every Second Counts — <br />
                <span className="text-red-200">Find Blood Instantly</span>
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-red-100 max-w-2xl leading-relaxed">
            {isHi
              ? 'सत्यापित ब्लड बैंकों से वास्तविक समय में स्टॉक देखें। यदि स्टॉक उपलब्ध न हो, तो रक्तखोज तुरंत आपके नजदीकी संगत स्वयंसेवी रक्तदाताओं को व्हाट्सएप द्वारा सक्रिय करता है।'
              : 'Discover nearby blood banks with real-time stock inventory. If blood banks are out of stock, RaktKhoj automatically cascades to nearby compatible volunteer donors via WhatsApp.'}
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              asChild
              size="lg"
              className="bg-white text-red-700 hover:bg-red-50 font-bold shadow-md text-base h-12 px-6"
            >
              <Link href="/request" className="flex items-center gap-2">
                <Search className="h-5 w-5 text-red-600" />
                <span>{isHi ? 'अभी रक्त खोजें' : 'Find Blood Now'}</span>
                <ArrowRight className="h-4 w-4 text-red-500 ml-1" />
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-red-800/40 hover:bg-red-800/70 text-white font-semibold text-base h-12 px-6 backdrop-blur-xs"
            >
              <Link href="/donor/register" className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-red-200" />
                <span>{isHi ? 'रक्तदाता बनें' : 'Register as Donor'}</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Blood Group Quick Navigator */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {isHi ? 'आवश्यक रक्त समूह चुनें' : 'Select Blood Group'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {isHi
                ? 'तुरंत निकटतम ब्लड बैंक और रक्तदाता खोजने के लिए रक्त समूह पर क्लिक करें'
                : 'Click any blood group to start an immediate proximity search'}
            </p>
          </div>
          <span className="text-xs font-semibold text-red-600">
            {isHi ? '8 मानक ABO/Rh समूह' : 'All 8 ABO/Rh Groups'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BLOOD_GROUPS.map((b) => (
            <Link
              key={b.group}
              href={`/request?bloodGroup=${encodeURIComponent(b.group)}`}
              className="group block"
            >
              <Card className="h-full border border-slate-200 hover:border-red-400 hover:shadow-md transition-all group-hover:scale-[1.02]">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-slate-900 group-hover:text-red-600 transition-colors">
                      {b.group}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {isHi ? b.noteHi : b.noteEn}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works: Two-Stage Active Cascade */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-xs">
            {isHi ? 'प्रणाली की कार्यप्रणाली' : 'How RaktKhoj Works'}
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isHi
              ? 'सत्यापित बैंक से स्वयंसेवी रक्तदाता तक'
              : 'Two-Stage Active Emergency Routing'}
          </h2>
          <p className="text-sm text-slate-600">
            {isHi
              ? 'रक्तखोज कोई साधारण निर्देशिका नहीं है। यह जीवन बचाने के लिए सक्रिय तकनीक का उपयोग करता है।'
              : 'RaktKhoj does not leave families helpless when blood banks run out of stock.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-slate-200 shadow-xs relative">
            <CardHeader className="p-6">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-black text-xl mb-3">
                1
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-red-600" />
                {isHi ? 'चरण 1: ब्लड बैंक खोज' : 'Stage 1: Blood Bank Stock'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 leading-relaxed mt-2">
                {isHi
                  ? 'आपके जीपीएस या जिले के आधार पर निकटतम सरकारी और निजी ब्लड बैंकों में लाइव स्टॉक इन्वेंट्री (PRBC, प्लेटलेट्स) की जांच।'
                  : 'Proximity search across verified blood banks via eRaktKosh integration, sorted by distance with exact component availability.'}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-slate-200 shadow-xs relative">
            <CardHeader className="p-6">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xl mb-3">
                2
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-600" />
                {isHi ? 'चरण 2: स्वतः दाता खोज' : 'Stage 2: Donor Cascade'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 leading-relaxed mt-2">
                {isHi
                  ? 'यदि स्टॉक शून्य हो, तो प्रणाली स्वतः लाल रक्त कोशिका संगतता नियमों (ABO/Rh) के अनुसार 5-50 किमी दायरे में दाताओं को खोजती है।'
                  : 'If banks are empty, the engine instantly identifies compatible volunteer donors enforcing the strict ABO/Rh RBC compatibility matrix.'}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-slate-200 shadow-xs relative">
            <CardHeader className="p-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xl mb-3">
                3
              </div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
                {isHi ? 'चरण 3: व्हाट्सएप अलर्ट' : 'Stage 3: WhatsApp Dispatch'}
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 leading-relaxed mt-2">
                {isHi
                  ? 'संगत दाताओं को व्हाट्सएप पर इंटरैक्टिव बटन (स्वीकार/अस्वीकार) के साथ सूचना भेजी जाती है। स्वीकृति मिलने पर परिवार को संपर्क विवरण मिलता है।'
                  : 'Outbound WhatsApp interactive buttons enable rapid donor response. Families see accepted donor contact details in the live waiting room.'}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Emergency Helplines Callout */}
      <section className="rounded-xl border border-red-200 bg-red-50/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-red-600 text-white shrink-0">
            <PhoneCall className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isHi
                ? 'क्या आप अत्यंत गंभीर आपातकाल में हैं?'
                : 'Need Immediate Emergency Assistance?'}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isHi
                ? 'राष्ट्रीय रक्त हेल्पलाइन (104) या आपातकालीन एम्बुलेंस (108) पर तुरंत कॉल करें।'
                : 'Call National Blood Helpline (104) or Emergency Ambulance (108) for immediate dispatch.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="tel:104"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 text-xs shadow-xs transition-colors"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>104 (रक्त हेल्पलाइन)</span>
          </a>
          <a
            href="tel:108"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-red-700 font-bold px-4 py-2 text-xs transition-colors"
          >
            <span>108 (एम्बुलेंस)</span>
          </a>
        </div>
      </section>
    </div>
  );
}
