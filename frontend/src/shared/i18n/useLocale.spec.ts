import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';

vi.mock('./index', () => ({
  setI18nLocale: vi.fn(),
}));

import { useLocale } from './useLocale';
import { setI18nLocale } from './index';

describe('useLocale', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('setLocale updates the ref, localStorage and the i18n instance', async () => {
    const { locale, setLocale } = useLocale();
    // Start from a known locale that differs from the target so the change is
    // observable regardless of the jsdom-detected default (useLocalStorage only
    // writes when the value actually changes, and flushes on the next tick).
    setLocale('ru');
    await nextTick();
    setLocale('en');
    await nextTick();
    expect(locale.value).toBe('en');
    expect(localStorage.getItem('locale')).toBe('en');
    expect(setI18nLocale).toHaveBeenLastCalledWith('en');
  });

  it('exposes available locales', () => {
    const { availableLocales } = useLocale();
    expect(availableLocales).toEqual(['ru', 'en']);
  });
});
