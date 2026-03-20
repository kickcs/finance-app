import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { mockPremiumSubscriptionResponse } from '@/test/mocks/handlers/subscription';
import SubscriptionSection from './SubscriptionSection.vue';

// Mock app router — not used by this component but needed for plugin chain
vi.mock('@/app/router', () => ({
  navigateBack: vi.fn(),
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderSection() {
  currentWrapper = renderWithProviders(SubscriptionSection, {
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

describe('SubscriptionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -------------------------------------------------------------------------
  // Rendering — free plan (default handler)
  // -------------------------------------------------------------------------
  describe('free plan', () => {
    it('renders "Подписка" section header', async () => {
      const wrapper = await renderSection();
      expect(wrapper.text()).toContain('Подписка');
    });

    it('renders the subscription button', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-button"]').exists()).toBe(true);
    });

    it('shows "Premium подписка" as plan label for free user', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-plan-label"]').text()).toContain(
        'Premium подписка',
      );
    });

    it('shows "Бесплатный" as status for free user', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe('Бесплатный');
    });

    it('does not show period-end date for free user', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-period-end"]').exists()).toBe(false);
    });

    it('emits "upgrade" event when button is clicked', async () => {
      const wrapper = await renderSection();
      await wrapper.find('[data-testid="subscription-button"]').trigger('click');
      expect(wrapper.emitted('upgrade')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Premium plan — active subscription
  // -------------------------------------------------------------------------
  describe('premium plan — active', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/subscription/status', () =>
          HttpResponse.json(mockPremiumSubscriptionResponse),
        ),
      );
    });

    it('shows plan label from PLAN_LABELS for premium user', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-plan-label"]').text()).toContain('Premium');
    });

    it('shows "Активна" as status for premium user', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe('Активна');
    });

    it('shows "Следующая оплата" with a period-end date for active premium', async () => {
      const wrapper = await renderSection();
      const periodEnd = wrapper.find('[data-testid="subscription-period-end"]');
      expect(periodEnd.exists()).toBe(true);
      expect(periodEnd.text()).toContain('Следующая оплата');
    });
  });

  // -------------------------------------------------------------------------
  // Premium plan — cancelled (cancel_at_period_end = true)
  // -------------------------------------------------------------------------
  describe('premium plan — cancelled', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/subscription/status', () =>
          HttpResponse.json({
            ...mockPremiumSubscriptionResponse,
            cancelAtPeriodEnd: true,
          }),
        ),
      );
    });

    it('shows "Отменена" status when cancel_at_period_end is true', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe('Отменена');
    });

    it('shows "Действует до" instead of "Следующая оплата"', async () => {
      const wrapper = await renderSection();
      const periodEnd = wrapper.find('[data-testid="subscription-period-end"]');
      expect(periodEnd.exists()).toBe(true);
      expect(periodEnd.text()).toContain('Действует до');
    });
  });

  // -------------------------------------------------------------------------
  // Trialing
  // -------------------------------------------------------------------------
  describe('trialing status', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/subscription/status', () =>
          HttpResponse.json({
            ...mockPremiumSubscriptionResponse,
            status: 'trialing',
          }),
        ),
      );
    });

    it('shows "Пробный период" status for trialing subscription', async () => {
      const wrapper = await renderSection();
      expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe(
        'Пробный период',
      );
    });
  });
});
