'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../../src/routing';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/button';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'hi' : 'en';
    const params = searchParams ? searchParams.toString() : '';
    const query = params ? `?${params}` : '';
    router.replace(`${pathname}${query}`, { locale: nextLocale });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLocale}
      className="font-medium px-3 py-1.5 h-8 text-xs border-red-200 hover:bg-red-50 text-red-700 transition-colors shadow-xs"
      aria-label="Toggle language between English and Hindi"
    >
      {locale === 'en' ? '🇮🇳 हिन्दी' : '🌐 English'}
    </Button>
  );
}
