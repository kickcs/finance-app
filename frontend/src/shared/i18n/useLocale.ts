import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { initialLocale, isAppLocale } from './detectLocale';
import { setI18nLocale, type AppLocale } from './index';

// Module-level singleton state (matches useTheme / useAuth pattern).
// initialLocale() resolves the persisted-or-detected start value (same source
// the i18n instance uses, so they agree). A stored value that isn't a supported
// locale would otherwise be picked up verbatim by useLocalStorage and stick.
const locale = useLocalStorage<AppLocale>(STORAGE_KEYS.LOCALE, initialLocale());
if (!isAppLocale(locale.value)) {
  locale.value = initialLocale();
}

export function useLocale() {
  function setLocale(next: AppLocale): void {
    locale.value = next;
    setI18nLocale(next);
  }

  /** Apply the persisted locale to the i18n instance (call once on app init). */
  function initLocale(): void {
    setI18nLocale(locale.value);
  }

  /** Profile wins on conflict at login: adopt the backend value into local state. */
  function adoptFromProfile(profileLanguage: AppLocale | null | undefined): void {
    // Only adopt supported locales — guard against legacy/unexpected profile values.
    if (isAppLocale(profileLanguage) && profileLanguage !== locale.value) {
      setLocale(profileLanguage);
    }
  }

  return {
    locale,
    availableLocales: ['ru', 'en'] as const,
    setLocale,
    initLocale,
    adoptFromProfile,
  };
}
