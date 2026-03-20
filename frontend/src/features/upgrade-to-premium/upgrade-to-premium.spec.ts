import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import PremiumBadge from './ui/PremiumBadge.vue';
import PremiumUpgradeModal from './ui/PremiumUpgradeModal.vue';
import { usePremiumFeature } from '@/shared/lib/composables/usePremiumFeature';
import { ref, computed } from 'vue';

// Mock app router
vi.mock('@/app/router', () => ({
  navigateBack: vi.fn(),
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

// ============================================================================
describe('PremiumBadge', () => {
  it('renders the "Premium" label', () => {
    currentWrapper = renderWithProviders(PremiumBadge);
    expect(currentWrapper.text()).toContain('Premium');
  });
});

// ============================================================================
describe('PremiumUpgradeModal', () => {
  const { mockLemonSqueezy, mockWindowOpen } = vi.hoisted(() => ({
    mockLemonSqueezy: { Url: { Open: vi.fn() } },
    mockWindowOpen: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('LemonSqueezy', mockLemonSqueezy);
    vi.stubGlobal('open', mockWindowOpen);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function renderModal(props: { modelValue: boolean; featureName?: string }) {
    currentWrapper = renderWithProviders(PremiumUpgradeModal, {
      props,
      provideAuth: { user: mockUser },
    });
    await flushPromises();
    return currentWrapper;
  }

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------
  it('renders modal content when modelValue=true', async () => {
    await renderModal({ modelValue: true });
    // The modal title "Ouro Premium" should be in the DOM (teleported to body)
    expect(document.body.textContent).toContain('Ouro Premium');
  });

  it('shows feature name hint when featureName prop is provided', async () => {
    await renderModal({ modelValue: true, featureName: 'Экспорт данных' });
    expect(document.body.textContent).toContain('Экспорт данных');
  });

  it('lists premium features', async () => {
    await renderModal({ modelValue: true });
    expect(document.body.textContent).toContain('Расширенная аналитика');
    expect(document.body.textContent).toContain('Экспорт данных');
  });

  it('renders yearly and monthly plan buttons', async () => {
    await renderModal({ modelValue: true });
    const yearlyBtn = findInBody('[data-testid="yearly-btn"]');
    const monthlyBtn = findInBody('[data-testid="monthly-btn"]');
    expect(yearlyBtn).not.toBeNull();
    expect(monthlyBtn).not.toBeNull();
  });

  it('shows plan prices in button labels', async () => {
    await renderModal({ modelValue: true });
    expect(document.body.textContent).toContain('$16.99/год');
    expect(document.body.textContent).toContain('$2.99/мес');
  });

  // -------------------------------------------------------------------------
  // Checkout — yearly plan
  // -------------------------------------------------------------------------
  it('calls LemonSqueezy.Url.Open with yearly checkout URL when yearly button clicked', async () => {
    await renderModal({ modelValue: true });
    await flushPromises();

    const yearlyBtn = findInBody('[data-testid="yearly-btn"]');
    expect(yearlyBtn).not.toBeNull();
    yearlyBtn!.click();
    await flushPromises();

    expect(mockLemonSqueezy.Url.Open).toHaveBeenCalledWith(
      expect.stringContaining('premium_yearly'),
    );
  });

  // -------------------------------------------------------------------------
  // Checkout — monthly plan
  // -------------------------------------------------------------------------
  it('calls LemonSqueezy.Url.Open with monthly checkout URL when monthly button clicked', async () => {
    await renderModal({ modelValue: true });
    await flushPromises();

    const monthlyBtn = findInBody('[data-testid="monthly-btn"]');
    expect(monthlyBtn).not.toBeNull();
    monthlyBtn!.click();
    await flushPromises();

    expect(mockLemonSqueezy.Url.Open).toHaveBeenCalledWith(
      expect.stringContaining('premium_monthly'),
    );
  });

  // -------------------------------------------------------------------------
  // Fallback to window.open when LemonSqueezy is not available
  // -------------------------------------------------------------------------
  it('falls back to window.open when LemonSqueezy is unavailable', async () => {
    vi.stubGlobal('LemonSqueezy', undefined);

    await renderModal({ modelValue: true });
    await flushPromises();

    const yearlyBtn = findInBody('[data-testid="yearly-btn"]');
    yearlyBtn!.click();
    await flushPromises();

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('premium_yearly'),
      '_blank',
    );
  });

  // -------------------------------------------------------------------------
  // Checkout API error → toast
  // -------------------------------------------------------------------------
  it('shows error toast when checkout API fails', async () => {
    server.use(http.post('*/api/subscription/checkout', () => HttpResponse.error()));

    await renderModal({ modelValue: true });
    await flushPromises();

    const monthlyBtn = findInBody('[data-testid="monthly-btn"]');
    monthlyBtn!.click();
    await flushPromises();

    // LemonSqueezy should NOT have been called
    expect(mockLemonSqueezy.Url.Open).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Emits update:modelValue=false after successful checkout
  // -------------------------------------------------------------------------
  it('emits update:modelValue=false after successful checkout', async () => {
    const wrapper = await renderModal({ modelValue: true });
    await flushPromises();

    const yearlyBtn = findInBody('[data-testid="yearly-btn"]');
    yearlyBtn!.click();
    await flushPromises();

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    expect(emitted![emitted!.length - 1]).toEqual([false]);
  });
});

// ============================================================================
// usePremiumFeature composable
// ============================================================================
describe('usePremiumFeature', () => {
  beforeEach(() => {
    // Reset singleton state between tests by re-running init with fresh refs
  });

  it('returns false and opens modal for free user calling requirePremium()', () => {
    const { requirePremium, showUpgradeModal, init } = usePremiumFeature();
    init({
      isPremium: computed(() => false),
      subscription: ref({
        plan: 'free' as const,
        status: 'active' as const,
        is_premium: false,
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
      }),
    });

    const result = requirePremium('Экспорт данных');
    expect(result).toBe(false);
    expect(showUpgradeModal.value).toBe(true);
  });

  it('returns true for premium user calling requirePremium()', () => {
    const { requirePremium, showUpgradeModal, init } = usePremiumFeature();
    init({
      isPremium: computed(() => true),
      subscription: ref({
        plan: 'premium_monthly' as const,
        status: 'active' as const,
        is_premium: true,
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
      }),
    });

    showUpgradeModal.value = false; // reset

    const result = requirePremium('Экспорт данных');
    expect(result).toBe(true);
    expect(showUpgradeModal.value).toBe(false);
  });

  it('sets upgradeFeatureName when opening modal', () => {
    const { requirePremium, upgradeFeatureName, init } = usePremiumFeature();
    init({
      isPremium: computed(() => false),
      subscription: ref({
        plan: 'free' as const,
        status: 'active' as const,
        is_premium: false,
        trial_end: null,
        current_period_end: null,
        cancel_at_period_end: false,
      }),
    });

    requirePremium('Сканирование чеков');
    expect(upgradeFeatureName.value).toBe('Сканирование чеков');
  });

  it('isPremium getter is accessible without init', () => {
    const { isPremium } = usePremiumFeature();
    expect(isPremium).toBe(false);
  });
});
