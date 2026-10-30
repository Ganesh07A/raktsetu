import { en, type TranslationDictionary } from './en';
import { hi } from './hi';
import type { SupportedLanguage } from '../constants';

export { en, hi };
export type { TranslationDictionary };

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en,
  hi,
};

export function getTranslation(
  locale: SupportedLanguage = 'en'
): TranslationDictionary {
  return translations[locale] ?? en;
}
