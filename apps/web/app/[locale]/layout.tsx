import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, Link } from '../../src/routing';
import { RegisterServiceWorker } from '../components/register-sw';
import { LanguageSwitcher } from '../components/language-switcher';
import '../globals.css';
import { HeartPulse, PhoneCall, ShieldAlert, Droplet } from 'lucide-react';

export const viewport: Viewport = {
  themeColor: '#dc2626',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'RaktKhoj — Emergency Blood Discovery (रक्तखोज)',
  description:
    'Find verified blood banks with real-time inventory and connect with nearby voluntary blood donors in medical emergencies across India.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RaktKhoj',
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'hi')) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} dir="ltr">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-red-500 selection:text-white">
        <NextIntlClientProvider messages={messages}>
          {/* PWA Service Worker Registration */}
          <RegisterServiceWorker />

          {/* Top Emergency Helpline Ticker */}
          <aside
            aria-label="National Emergency Helplines"
            className="bg-red-700 text-white text-xs px-4 py-1.5 flex items-center justify-between shadow-xs print:hidden"
          >
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 animate-pulse text-red-200" />
              <span>
                {locale === 'hi'
                  ? 'राष्ट्रीय आपातकालीन रक्त हेल्पलाइन: 104 | एम्बुलेंस: 108'
                  : 'National Blood Helpline: 104 | Ambulance: 108'}
              </span>
            </div>
            <a
              href="tel:104"
              className="hidden sm:inline-flex items-center gap-1 font-semibold text-red-100 hover:text-white underline underline-offset-2"
            >
              <PhoneCall className="h-3 w-3" />
              {locale === 'hi' ? 'तुरंत कॉल करें (104)' : 'Call 104 Now'}
            </a>
          </aside>

          {/* Main Navigation Header */}
          <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              {/* Logo & Name */}
              <Link
                href="/"
                className="flex items-center gap-2.5 transition-transform active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-sm ring-2 ring-red-100">
                  <Droplet className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                      RaktKhoj
                    </span>
                    <span className="text-sm font-semibold text-red-600">
                      रक्तखोज
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium -mt-1 hidden sm:block">
                    {locale === 'hi'
                      ? 'आपातकालीन रक्त खोज और सहायता प्रणाली'
                      : 'Emergency Blood Discovery & Routing'}
                  </p>
                </div>
              </Link>

              {/* Navigation Actions */}
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  href="/offline"
                  className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors px-2 py-1"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  {locale === 'hi' ? 'हेल्पलाइन निर्देशिका' : 'Helplines'}
                </Link>

                <LanguageSwitcher />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Mission */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-red-600" />
                    <span className="font-bold text-base text-slate-900">
                      RaktKhoj (रक्तखोज)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {locale === 'hi'
                      ? 'रक्तखोज भारत में आपातकालीन परिस्थितियों में सत्यापित ब्लड बैंकों और नजदीकी रक्तदाताओं को तुरंत जोड़ने वाला एक खुला तकनीकी मंच है। हर सेकंड मायने रखता है।'
                      : 'An active routing engine connecting families in medical emergencies with real-time blood bank inventory and compatible volunteer donors across India.'}
                  </p>
                </div>

                {/* Emergency Hotlines */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {locale === 'hi'
                      ? 'आपातकालीन संपर्क नंबर'
                      : 'Emergency Contacts'}
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-600">
                    <li className="flex items-center justify-between">
                      <span>{locale === 'hi' ? 'राष्ट्रीय रक्त हेल्पलाइन' : 'National Blood Helpline'}</span>
                      <a href="tel:104" className="font-bold text-red-600 hover:underline">104</a>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{locale === 'hi' ? 'आपातकालीन एम्बुलेंस' : 'Emergency Ambulance'}</span>
                      <a href="tel:108" className="font-bold text-red-600 hover:underline">108</a>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>{locale === 'hi' ? 'ई-रक्तकोष टोल-फ्री' : 'eRaktKosh Toll-Free'}</span>
                      <a href="tel:18001801104" className="font-bold text-red-600 hover:underline">1800-180-1104</a>
                    </li>
                  </ul>
                </div>

                {/* Attribution & Links */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {locale === 'hi' ? 'डेटा स्रोत एवं संदर्भ' : 'Data & Governance'}
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {locale === 'hi'
                      ? 'ब्लड बैंक डेटा eRaktKosh (CDAC / स्वास्थ्य एवं परिवार कल्याण मंत्रालय) के सहयोग से संदर्भित है। रक्तदान स्वैच्छिक एवं निःशुल्क है।'
                      : 'Blood bank data referenced via eRaktKosh (CDAC / Ministry of Health & Family Welfare, Govt. of India). Voluntary donation is non-remunerated.'}
                  </p>
                  <div className="pt-1">
                    <Link
                      href="/offline"
                      className="text-xs text-red-600 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <PhoneCall className="h-3 w-3" />
                      {locale === 'hi'
                        ? 'ऑफ़लाइन निर्देशिका देखें'
                        : 'View Offline Directory'}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
                <p>© 2026 RaktKhoj (रक्तखोज). Built for India 🇮🇳</p>
                <p className="mt-2 sm:mt-0 font-medium">
                  {locale === 'hi' ? 'रक्तदान महादान' : 'Saving Lives Every Second'}
                </p>
              </div>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
