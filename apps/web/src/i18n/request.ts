import { getRequestConfig } from 'next-intl/server';
import { routing } from '../routing';
import { en, hi } from '@repo/shared/i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'en' | 'hi')) {
    locale = routing.defaultLocale;
  }

  const messages = locale === 'hi' ? hi : en;

  return {
    locale,
    messages,
  };
});
