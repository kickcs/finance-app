import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import InstallPwaBanner from './ui/InstallPwaBanner.vue';
import InstallPwaModal from './ui/InstallPwaModal.vue';

// ============================================================================
// The install-pwa feature uses module-level state (singleton refs).
// We mock the module and expose usePwaInstall as a vi.fn() so each test
// can override the returned shape via mockReturnValueOnce.
// ============================================================================

const mockDismissBanner = vi.fn();
const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
const mockTriggerNativeInstall = vi.fn().mockResolvedValue(undefined);

function makeDefaultReturn(
  overrides: Partial<{
    isStandalone: boolean;
    platform: 'ios' | 'android' | 'desktop';
    showBannerValue: boolean;
    canUseNativePromptValue: boolean;
    triggerNativeInstall: () => Promise<void>;
  }> = {},
) {
  return {
    platform: overrides.platform ?? 'desktop',
    isStandalone: overrides.isStandalone ?? false,
    isDismissed: ref(false),
    showModal: ref(false),
    showBanner: ref(overrides.showBannerValue ?? true),
    canUseNativePrompt: ref(overrides.canUseNativePromptValue ?? false),
    openModal: mockOpenModal,
    closeModal: mockCloseModal,
    dismissBanner: mockDismissBanner,
    triggerNativeInstall: overrides.triggerNativeInstall ?? mockTriggerNativeInstall,
  } as any;
}

vi.mock('./model/usePwaInstall', () => ({
  usePwaInstall: vi.fn(() => makeDefaultReturn()),
}));

import { usePwaInstall } from './model/usePwaInstall';

/** Helper: find element inside teleported modal content via document.body */
function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePwaInstall).mockImplementation(() => makeDefaultReturn());
});

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

// ============================================================================
// InstallPwaBanner
// ============================================================================
describe('InstallPwaBanner', () => {
  describe('visibility', () => {
    it('shows banner when showBanner is true', () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: true }));
      currentWrapper = renderWithProviders(InstallPwaBanner);
      expect(currentWrapper.find('[data-testid="install-pwa-banner"]').exists()).toBe(true);
    });

    it('hides banner when showBanner is false', () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: false }));
      currentWrapper = renderWithProviders(InstallPwaBanner);
      expect(currentWrapper.find('[data-testid="install-pwa-banner"]').exists()).toBe(false);
    });
  });

  describe('content', () => {
    it('displays the install prompt title', () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: true }));
      currentWrapper = renderWithProviders(InstallPwaBanner);
      expect(currentWrapper.text()).toContain('Установите приложение');
    });

    it('displays the subtitle', () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: true }));
      currentWrapper = renderWithProviders(InstallPwaBanner);
      expect(currentWrapper.text()).toContain('Быстрый доступ с главного экрана');
    });
  });

  describe('interactions', () => {
    it('emits "install" event when banner is clicked', async () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: true }));
      currentWrapper = renderWithProviders(InstallPwaBanner);

      // InstallPwaBanner emits 'install' via handleClick which is bound to UCard's @click.
      // UCard forwards @click via inheritAttrs to its root div. We trigger a click
      // on the content div (child of the card) which bubbles up to the card's handler.
      const contentDiv = currentWrapper.find('[data-testid="install-pwa-card"] .flex');
      if (contentDiv.exists()) {
        await contentDiv.trigger('click');
      } else {
        // Fallback: trigger on card itself
        await currentWrapper.find('[data-testid="install-pwa-card"]').trigger('click');
      }
      expect(currentWrapper.emitted('install')).toHaveLength(1);
    });

    it('calls dismissBanner when dismiss button is clicked', async () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: true }));
      currentWrapper = renderWithProviders(InstallPwaBanner);
      await currentWrapper.find('[data-testid="dismiss-btn"]').trigger('click');
      expect(mockDismissBanner).toHaveBeenCalledOnce();
    });

    it('does not emit "install" when dismiss button is clicked', async () => {
      vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn({ showBannerValue: true }));
      currentWrapper = renderWithProviders(InstallPwaBanner);
      await currentWrapper.find('[data-testid="dismiss-btn"]').trigger('click');
      expect(currentWrapper.emitted('install')).toBeFalsy();
    });
  });
});

// ============================================================================
// InstallPwaModal — modal content is teleported to document.body
// ============================================================================
describe('InstallPwaModal', () => {
  async function renderModal(
    modelValue = true,
    pwaOverrides?: Parameters<typeof makeDefaultReturn>[0],
  ) {
    vi.mocked(usePwaInstall).mockReturnValueOnce(makeDefaultReturn(pwaOverrides));
    currentWrapper = renderWithProviders(InstallPwaModal, {
      props: { modelValue },
    });
    await flushPromises();
    return currentWrapper;
  }

  it('shows modal title "Установите Ouro Finance"', async () => {
    await renderModal(true);
    expect(document.body.textContent).toContain('Установите Ouro Finance');
  });

  it('shows "Приложение установлено" when running as standalone', async () => {
    await renderModal(true, { isStandalone: true });
    expect(findInBody('[data-testid="already-installed"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Приложение установлено');
  });

  it('shows iOS step-by-step instructions on iOS platform', async () => {
    await renderModal(true, { platform: 'ios', isStandalone: false });
    expect(document.body.textContent).toContain('Нажмите');
    expect(document.body.textContent).toContain('Поделиться');
  });

  it('shows native install button on Android when native prompt available', async () => {
    await renderModal(true, {
      platform: 'android',
      isStandalone: false,
      canUseNativePromptValue: true,
    });
    expect(findInBody('[data-testid="android-install-btn"]')).not.toBeNull();
  });

  it('shows native install button on desktop when native prompt available', async () => {
    await renderModal(true, {
      platform: 'desktop',
      isStandalone: false,
      canUseNativePromptValue: true,
    });
    expect(findInBody('[data-testid="desktop-install-btn"]')).not.toBeNull();
  });

  it('calls triggerNativeInstall when install button is clicked', async () => {
    const localTrigger = vi.fn().mockResolvedValue(undefined);
    await renderModal(true, {
      platform: 'android',
      isStandalone: false,
      canUseNativePromptValue: true,
      triggerNativeInstall: localTrigger,
    });

    const installBtn = findInBody('[data-testid="android-install-btn"]');
    expect(installBtn).not.toBeNull();
    installBtn!.click();
    await flushPromises();

    expect(localTrigger).toHaveBeenCalledOnce();
  });

  it('shows manual Android instructions when no native prompt', async () => {
    await renderModal(true, {
      platform: 'android',
      isStandalone: false,
      canUseNativePromptValue: false,
    });
    expect(findInBody('[data-testid="android-install-btn"]')).toBeNull();
    expect(document.body.textContent).toContain('Установить приложение');
  });

  it('shows desktop browser menu instructions without native prompt', async () => {
    await renderModal(true, {
      platform: 'desktop',
      isStandalone: false,
      canUseNativePromptValue: false,
    });
    expect(document.body.textContent).toContain('Установите Ouro Finance');
    expect(findInBody('[data-testid="desktop-install-btn"]')).toBeNull();
  });
});
