import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import type { AppLocale } from './index';

const APP_LOCALES: readonly AppLocale[] = ['ru', 'en'];

/** Narrow an arbitrary value to a supported app locale. */
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value);
}

/** Detect the locale from the browser, falling back to 'ru'. */
export function detectLocale(): AppLocale {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

/**
 * The locale the app should start in: the persisted choice if valid, otherwise
 * the browser-detected one. Shared by the i18n instance and the useLocale
 * singleton so both agree on the initial value (no first-render flash).
 */
export function initialLocale(): AppLocale {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCALE) : null;
  return isAppLocale(stored) ? stored : detectLocale();
}
