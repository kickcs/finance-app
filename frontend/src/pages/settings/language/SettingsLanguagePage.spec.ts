import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import type * as SharedApi from '@/shared/api';

const setLocale = vi.fn();
const setLanguage = vi.fn().mockResolvedValue(undefined);
const testUser = { id: 'test-user-1', name: 'Test User', email: 'test@example.com' };

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({
    install: () => {},
    global: { locale: { value: 'ru' }, t: (k: string) => k },
  }),
}));

vi.mock('@/shared/i18n/useLocale', () => ({
  useLocale: () => ({
    locale: { value: 'ru' },
    setLocale,
  }),
}));

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    useAuth: () => ({ user: { value: testUser } }),
    useProfile: () => ({ setLanguage }),
  };
});

import SettingsLanguagePage from './SettingsLanguagePage.vue';

describe('SettingsLanguagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selecting English calls setLocale("en") and persists to the profile', async () => {
    const wrapper = renderWithProviders(SettingsLanguagePage);

    await wrapper.find('[data-testid="language-option-en"]').trigger('click');
    await flushPromises();

    expect(setLocale).toHaveBeenCalledWith('en');
    expect(setLanguage).toHaveBeenCalledWith('en');
    wrapper.unmount();
  });
});
