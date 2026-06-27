import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { detectLocale } from './detectLocale';
import { setI18nLocale, type AppLocale } from './index';

// Module-level singleton state (matches useTheme / useAuth pattern)
const locale = useLocalStorage<AppLocale>(STORAGE_KEYS.LOCALE, detectLocale());

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
    if (profileLanguage && profileLanguage !== locale.value) {
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
