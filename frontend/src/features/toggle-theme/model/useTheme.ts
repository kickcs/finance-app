import { ref, watch } from 'vue';
import { usePreferredDark, useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export type Theme = 'light' | 'dark' | 'system';

// VueUse useLocalStorage with string default uses raw serializer (no JSON wrapping).
// Clean up any legacy JSON-wrapped values (e.g. "\"dark\"" → "dark")
const raw = localStorage.getItem(STORAGE_KEYS.THEME);
if (raw && raw.startsWith('"')) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') {
      localStorage.setItem(STORAGE_KEYS.THEME, parsed);
    }
  } catch {
    /* ignore malformed values */
  }
}

// Singleton state - shared across all useTheme() calls
const theme = useLocalStorage<Theme>(STORAGE_KEYS.THEME, 'system');
const isDark = ref(false);
let initialized = false;
let stopPrefersDarkWatch: (() => void) | null = null;

const prefersDark = usePreferredDark();

function applyTheme(newTheme: Theme) {
  const shouldBeDark = newTheme === 'dark' || (newTheme === 'system' && prefersDark.value);
  isDark.value = shouldBeDark;

  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', shouldBeDark ? '#09090B' : '#FAFAFA');
}

export function useTheme() {
  function setTheme(newTheme: Theme) {
    theme.value = newTheme;
    applyTheme(newTheme);
  }

  function toggleTheme() {
    const newTheme = isDark.value ? 'light' : 'dark';
    setTheme(newTheme);
  }

  function initTheme() {
    if (initialized) return;

    applyTheme(theme.value);

    // Listen for system theme changes via VueUse reactive prefersDark
    stopPrefersDarkWatch = watch(prefersDark, () => {
      if (theme.value === 'system') {
        applyTheme('system');
      }
    });

    initialized = true;
  }

  function destroyTheme() {
    stopPrefersDarkWatch?.();
    stopPrefersDarkWatch = null;
    initialized = false;
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    initTheme,
    destroyTheme,
  };
}
