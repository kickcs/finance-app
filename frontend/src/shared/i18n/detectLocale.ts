import type { AppLocale } from './index';

export function detectLocale(): AppLocale {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}
