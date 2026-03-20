import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import ThemeToggle from './ui/ThemeToggle.vue';
import { useTheme } from './model/useTheme';

// ---------------------------------------------------------------------------
// Stub matchMedia for jsdom (not provided by default).
// NOTE: usePreferredDark() in useTheme.ts runs at module import time, so
// stubbing matchMedia here affects the MediaQueryList EventListener callbacks,
// but the singleton prefersDark ref reads `window.matchMedia()` via VueUse.
// We call this before the module is first imported.
// ---------------------------------------------------------------------------
function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark ? query.includes('prefers-color-scheme: dark') : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia(false);
  // Reset singleton so each test starts fresh
  const { destroyTheme } = useTheme();
  destroyTheme();
});

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
  const { destroyTheme } = useTheme();
  destroyTheme();
  await flushPromises();
});

// ============================================================================
// useTheme composable
// ============================================================================
describe('useTheme', () => {
  it('defaults to "system" theme when localStorage is empty', () => {
    const { theme } = useTheme();
    expect(theme.value).toBe('system');
  });

  it('setTheme("dark") adds "dark" class to documentElement', () => {
    const { setTheme } = useTheme();
    setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme("light") removes "dark" class from documentElement', () => {
    document.documentElement.classList.add('dark');
    const { setTheme } = useTheme();
    setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme("dark") updates the theme reactive ref', () => {
    const { setTheme, theme } = useTheme();
    setTheme('dark');
    // Check via the reactive ref (VueUse syncs this immediately)
    expect(theme.value).toBe('dark');
  });

  it('setTheme("light") updates the theme reactive ref', () => {
    const { setTheme, theme } = useTheme();
    setTheme('light');
    expect(theme.value).toBe('light');
  });

  it('setTheme("system") updates the theme reactive ref', () => {
    const { setTheme, theme } = useTheme();
    setTheme('system');
    expect(theme.value).toBe('system');
  });

  it('setTheme("dark") persists to localStorage (via nextTick)', async () => {
    const { setTheme } = useTheme();
    setTheme('dark');
    await nextTick();
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('dark');
  });

  it('setTheme("light") persists to localStorage (via nextTick)', async () => {
    const { setTheme } = useTheme();
    setTheme('light');
    await nextTick();
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('light');
  });

  it('setTheme("system") persists to localStorage (via nextTick)', async () => {
    const { setTheme } = useTheme();
    setTheme('system');
    await nextTick();
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('system');
  });

  it('toggleTheme switches from light to dark', () => {
    const { setTheme, toggleTheme, isDark } = useTheme();
    setTheme('light');
    expect(isDark.value).toBe(false);

    toggleTheme();
    expect(isDark.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggleTheme switches from dark to light', () => {
    const { setTheme, toggleTheme, isDark } = useTheme();
    setTheme('dark');
    expect(isDark.value).toBe(true);

    toggleTheme();
    expect(isDark.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggleTheme persists new value to localStorage (via nextTick)', async () => {
    const { setTheme, toggleTheme } = useTheme();
    setTheme('light');

    toggleTheme();
    await nextTick();
    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('dark');
  });

  it('system theme with light preference does not apply dark class', () => {
    stubMatchMedia(false);
    const { setTheme } = useTheme();
    setTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('initTheme can be called multiple times without throwing', () => {
    const { initTheme, isDark } = useTheme();
    initTheme();
    initTheme();
    expect(isDark.value).toBe(false);
  });

  it('isDark is true after setTheme("dark")', () => {
    const { setTheme, isDark } = useTheme();
    setTheme('dark');
    expect(isDark.value).toBe(true);
  });

  it('isDark is false after setTheme("light")', () => {
    const { setTheme, isDark } = useTheme();
    setTheme('light');
    expect(isDark.value).toBe(false);
  });
});

// ============================================================================
// ThemeToggle component
// ============================================================================
describe('ThemeToggle', () => {
  beforeEach(() => {
    // Start from light state
    const { setTheme } = useTheme();
    setTheme('light');
  });

  afterEach(async () => {
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  it('renders the toggle button', () => {
    currentWrapper = renderWithProviders(ThemeToggle);
    expect(currentWrapper.find('[data-testid="theme-toggle-btn"]').exists()).toBe(true);
  });

  it('shows "Тёмная тема" label when in light mode and showLabel=true', () => {
    const { setTheme } = useTheme();
    setTheme('light');

    currentWrapper = renderWithProviders(ThemeToggle, { props: { showLabel: true } });
    expect(currentWrapper.text()).toContain('Тёмная тема');
  });

  it('shows "Светлая тема" label when in dark mode and showLabel=true', () => {
    const { setTheme } = useTheme();
    setTheme('dark');

    currentWrapper = renderWithProviders(ThemeToggle, { props: { showLabel: true } });
    expect(currentWrapper.text()).toContain('Светлая тема');
  });

  it('clicking toggle switches from light to dark theme', async () => {
    const { setTheme, isDark } = useTheme();
    setTheme('light');

    currentWrapper = renderWithProviders(ThemeToggle);
    await currentWrapper.find('[data-testid="theme-toggle-btn"]').trigger('click');

    expect(isDark.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('clicking toggle switches from dark to light theme', async () => {
    const { setTheme, isDark } = useTheme();
    setTheme('dark');

    currentWrapper = renderWithProviders(ThemeToggle);
    await currentWrapper.find('[data-testid="theme-toggle-btn"]').trigger('click');

    expect(isDark.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('clicking toggle persists new theme to localStorage (via nextTick)', async () => {
    const { setTheme } = useTheme();
    setTheme('light');

    currentWrapper = renderWithProviders(ThemeToggle);
    await currentWrapper.find('[data-testid="theme-toggle-btn"]').trigger('click');
    await nextTick();

    expect(localStorage.getItem(STORAGE_KEYS.THEME)).toBe('dark');
  });

  it('does not show label text when showLabel is false (default)', () => {
    currentWrapper = renderWithProviders(ThemeToggle);
    // No label span rendered when showLabel is not passed
    expect(currentWrapper.find('span').exists()).toBe(false);
  });
});
