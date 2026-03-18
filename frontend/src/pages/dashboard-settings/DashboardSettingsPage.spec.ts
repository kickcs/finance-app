import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
// defineComponent and h are used via require() in vi.hoisted below
import { QueryClient } from '@tanstack/vue-query';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import DashboardSettingsPage from './DashboardSettingsPage.vue';
import { mockAccountResponse, mockSecondAccountResponse } from '@/test/mocks/handlers/accounts';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';
import { useToast } from '@/shared/ui';

// vi.hoisted runs before vi.mock hoisting — safe for factory references
const { navigateBackMock, DraggableStub } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { defineComponent: dc, h: hFn } = require('vue');
  return {
    navigateBackMock: vi.fn(),
    DraggableStub: dc({
      name: 'draggable',
      props: { modelValue: { type: Array }, itemKey: { type: String } },
      emits: ['start', 'end', 'update:modelValue'],
      setup(props: any, { slots }: any) {
        return () =>
          hFn(
            'div',
            { 'data-testid': 'draggable-container' },
            (props.modelValue ?? []).map((item: any, index: number) =>
              slots.item?.({ element: item, index }),
            ),
          );
      },
    }),
  };
});

// Mock vuedraggable module (direct import, not defineAsyncComponent)
vi.mock('vuedraggable', () => ({
  default: DraggableStub,
}));
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// ---------------------------------------------------------------------------

const routes = [
  { path: '/dashboard-settings', component: DashboardSettingsPage, name: 'dashboard-settings' },
  { path: '/', component: { template: '<div />' }, name: 'dashboard' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

/**
 * Render the page. Optionally provide a pre-seeded QueryClient to simulate
 * already-cached profile data (needed for initialization-from-saved-settings tests).
 */
async function renderPage(options?: { queryClient?: QueryClient }) {
  const router = createTestRouter(routes);
  router.push('/dashboard-settings');
  await router.isReady();

  currentWrapper = renderWithProviders(DashboardSettingsPage, {
    router,
    queryClient: options?.queryClient,
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

// ===========================================================================
describe('DashboardSettingsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    // Clear any lingering toasts from previous tests
    const { dismissAll } = useToast();
    dismissAll();
  });

  afterEach(async () => {
    vi.useRealTimers();
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title "Настройка главной"', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Настройка главной');
    });

    it('shows widgets section header', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Виджеты на главной');
    });

    it('shows help text for drag-and-drop', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Перетаскивайте виджеты за иконку слева');
    });
  });

  // -----------------------------------------------------------------------
  // Widget list
  // -----------------------------------------------------------------------
  describe('widget list', () => {
    it('renders all 7 default widgets with correct labels', async () => {
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Быстрые действия');
      expect(wrapper.text()).toContain('Счета');
      expect(wrapper.text()).toContain('Топ расходов');
      expect(wrapper.text()).toContain('Последние транзакции');
      expect(wrapper.text()).toContain('Бюджет');
      expect(wrapper.text()).toContain('Долги');
      expect(wrapper.text()).toContain('Напоминания');
    });

    it('renders widget items with data-testid attributes', async () => {
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="widget-item-quick_actions"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-item-accounts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-item-top_expenses"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-item-transactions"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-item-budget"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-item-debts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-item-reminders"]').exists()).toBe(true);
    });

    it('all widgets are visible (toggled on) by default', async () => {
      const wrapper = await renderPage();

      const widgetSection = wrapper.find('[data-testid="widgets-section"]');
      const widgetToggles = widgetSection.findAll('[role="switch"]');
      expect(widgetToggles.length).toBe(7);

      for (const toggle of widgetToggles) {
        expect(toggle.attributes('aria-checked')).toBe('true');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Widget toggle
  // -----------------------------------------------------------------------
  describe('widget toggle', () => {
    it('toggling a widget marks it hidden and triggers save', async () => {
      let savedPayload: Record<string, unknown> | null = null;
      server.use(
        http.patch('*/api/profiles/me', async ({ request }) => {
          savedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockProfileResponse, ...savedPayload });
        }),
      );

      const wrapper = await renderPage();

      // Find the toggle for "Бюджет" widget via aria-label
      const budgetToggle = wrapper.find('[aria-label="Показывать Бюджет"]');
      expect(budgetToggle.exists()).toBe(true);

      // Click to toggle off
      await budgetToggle.trigger('click');
      await flushPromises();

      // Advance past the 500ms debounce
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();

      // Verify the save was called with budget in hidden_widgets
      expect(savedPayload).not.toBeNull();
      const dashSettings = (savedPayload as any).dashboardSettings;
      expect(dashSettings).toBeDefined();
      expect(dashSettings.hiddenWidgets).toContain('budget');
    });

    it('toggle reflects hidden state after click', async () => {
      const wrapper = await renderPage();

      const budgetToggle = wrapper.find('[aria-label="Показывать Бюджет"]');
      expect(budgetToggle.attributes('aria-checked')).toBe('true');

      await budgetToggle.trigger('click');
      await flushPromises();

      expect(budgetToggle.attributes('aria-checked')).toBe('false');
    });
  });

  // -----------------------------------------------------------------------
  // Account section
  // -----------------------------------------------------------------------
  describe('account section', () => {
    it('shows accounts with toggle for each', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      const accountSection = wrapper.find('[data-testid="accounts-section"]');
      expect(accountSection.exists()).toBe(true);
      expect(accountSection.text()).toContain('Участвуют в балансе');
      expect(accountSection.text()).toContain('Основной');
      expect(accountSection.text()).toContain('Накопления');
    });

    it('shows account help text', async () => {
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Отключенные счета не будут учитываться');
    });

    it('renders account items with data-testid attributes', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="account-item-acc-1"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="account-item-acc-2"]').exists()).toBe(true);
    });

    it('all accounts are visible (toggled on) by default', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      const accountSection = wrapper.find('[data-testid="accounts-section"]');
      const accountToggles = accountSection.findAll('[role="switch"]');
      expect(accountToggles.length).toBe(2);

      for (const toggle of accountToggles) {
        expect(toggle.attributes('aria-checked')).toBe('true');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Account toggle
  // -----------------------------------------------------------------------
  describe('account toggle', () => {
    it('toggling account updates hiddenAccountIds and triggers save', async () => {
      let savedPayload: Record<string, unknown> | null = null;
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
        http.patch('*/api/profiles/me', async ({ request }) => {
          savedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockProfileResponse, ...savedPayload });
        }),
      );

      const wrapper = await renderPage();

      // Find the toggle for the second account
      const accToggle = wrapper.find('[aria-label="Включить Накопления в баланс"]');
      expect(accToggle.exists()).toBe(true);

      // Click to toggle off
      await accToggle.trigger('click');
      await flushPromises();

      // Advance past the 500ms debounce
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();

      expect(savedPayload).not.toBeNull();
      const dashSettings = (savedPayload as any).dashboardSettings;
      expect(dashSettings).toBeDefined();
      expect(dashSettings.hiddenAccountIds).toContain('acc-2');
    });

    it('toggle reflects hidden state after click', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      const accToggle = wrapper.find('[aria-label="Включить Накопления в баланс"]');
      expect(accToggle.attributes('aria-checked')).toBe('true');

      await accToggle.trigger('click');
      await flushPromises();

      expect(accToggle.attributes('aria-checked')).toBe('false');
    });
  });

  // -----------------------------------------------------------------------
  // Account section hidden when no accounts
  // -----------------------------------------------------------------------
  describe('account section visibility', () => {
    it('hides accounts section when no accounts exist', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="accounts-section"]').exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Back navigation
  // -----------------------------------------------------------------------
  describe('back navigation', () => {
    it('back button calls navigateBack', async () => {
      const wrapper = await renderPage();

      const backBtn = wrapper.find('button[aria-label="Назад"]');
      expect(backBtn.exists()).toBe(true);
      await backBtn.trigger('click');
      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Auto-save (debounced)
  // -----------------------------------------------------------------------
  describe('auto-save', () => {
    it('does not save immediately — waits for debounce', async () => {
      let saveCount = 0;
      server.use(
        http.patch('*/api/profiles/me', async ({ request }) => {
          saveCount++;
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockProfileResponse, ...body });
        }),
      );

      const wrapper = await renderPage();

      // Toggle a widget
      const toggle = wrapper.find('[aria-label="Показывать Бюджет"]');
      await toggle.trigger('click');
      await flushPromises();

      // Before debounce fires, no save should have occurred
      expect(saveCount).toBe(0);

      // Advance past the 500ms debounce
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();

      expect(saveCount).toBe(1);
    });

    it('multiple quick toggles result in a single save', async () => {
      let saveCount = 0;
      server.use(
        http.patch('*/api/profiles/me', async ({ request }) => {
          saveCount++;
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockProfileResponse, ...body });
        }),
      );

      const wrapper = await renderPage();

      // Toggle two widgets quickly
      const budgetToggle = wrapper.find('[aria-label="Показывать Бюджет"]');
      const debtsToggle = wrapper.find('[aria-label="Показывать Долги"]');

      await budgetToggle.trigger('click');
      await flushPromises();

      // Advance partially (200ms)
      vi.advanceTimersByTime(200);

      await debtsToggle.trigger('click');
      await flushPromises();

      // Advance past full debounce from second toggle (500ms)
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();

      // Only one save should have been made (debounce collapsed them)
      expect(saveCount).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Save error
  // -----------------------------------------------------------------------
  describe('save error', () => {
    it('failed save shows error toast', async () => {
      server.use(
        http.patch('*/api/profiles/me', () => {
          return HttpResponse.json({ message: 'Server error' }, { status: 500 });
        }),
      );

      const wrapper = await renderPage();
      const { toasts } = useToast();

      // Toggle a widget
      const toggle = wrapper.find('[aria-label="Показывать Бюджет"]');
      await toggle.trigger('click');
      await flushPromises();

      // Advance past the 500ms debounce
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // Check the singleton toast store for an error toast
      const errorToast = toasts.value.find((t) => t.variant === 'error');
      expect(errorToast).toBeDefined();
      expect(errorToast!.title).toBe('Ошибка');
      expect(errorToast!.description).toBe('Не удалось сохранить настройки');
    });
  });

  // -----------------------------------------------------------------------
  // Initialization from existing settings
  // -----------------------------------------------------------------------
  describe('initialization from existing settings', () => {
    it('widgets ordered and hidden per saved settings', async () => {
      // Pre-seed the query cache with profile data containing saved dashboard settings.
      // This simulates a user navigating from the dashboard where the profile is already cached.
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      queryClient.setQueryData(['profile', 'test-user-1'], {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com',
        currency: 'UZS',
        has_completed_onboarding: true,
        default_account_id: 'acc-1',
        created_at: '2025-01-01T00:00:00.000Z',
        is_demo: false,
        demo_expires_at: null,
        dashboard_settings: {
          widget_order: [
            'accounts',
            'quick_actions',
            'budget',
            'top_expenses',
            'transactions',
            'debts',
            'reminders',
          ],
          hidden_widgets: ['budget'],
          hidden_account_ids: [],
        },
        quick_actions_hidden: false,
        quick_actions_hint_dismissed: false,
      });

      const wrapper = await renderPage({ queryClient });

      // "Бюджет" toggle should be off (hidden)
      const budgetToggle = wrapper.find('[aria-label="Показывать Бюджет"]');
      expect(budgetToggle.attributes('aria-checked')).toBe('false');

      // "Счета" should still be visible
      const accountsToggle = wrapper.find('[aria-label="Показывать Счета"]');
      expect(accountsToggle.attributes('aria-checked')).toBe('true');

      // Check order: first widget should be "accounts" (Счета), second "quick_actions"
      const widgetItems = wrapper.findAll('[data-testid^="widget-item-"]');
      expect(widgetItems.length).toBe(7);
      expect(widgetItems[0].attributes('data-testid')).toBe('widget-item-accounts');
      expect(widgetItems[1].attributes('data-testid')).toBe('widget-item-quick_actions');
    });

    it('accounts hidden per saved settings', async () => {
      // Pre-seed the query cache with profile data that hides acc-2
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      });
      queryClient.setQueryData(['profile', 'test-user-1'], {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com',
        currency: 'UZS',
        has_completed_onboarding: true,
        default_account_id: 'acc-1',
        created_at: '2025-01-01T00:00:00.000Z',
        is_demo: false,
        demo_expires_at: null,
        dashboard_settings: {
          widget_order: [
            'quick_actions',
            'accounts',
            'top_expenses',
            'transactions',
            'budget',
            'debts',
            'reminders',
          ],
          hidden_widgets: [],
          hidden_account_ids: ['acc-2'],
        },
        quick_actions_hidden: false,
        quick_actions_hint_dismissed: false,
      });

      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );

      const wrapper = await renderPage({ queryClient });

      // First account should be visible
      const acc1Toggle = wrapper.find('[aria-label="Включить Основной в баланс"]');
      expect(acc1Toggle.attributes('aria-checked')).toBe('true');

      // Second account should be hidden
      const acc2Toggle = wrapper.find('[aria-label="Включить Накопления в баланс"]');
      expect(acc2Toggle.attributes('aria-checked')).toBe('false');
    });
  });

  // -----------------------------------------------------------------------
  // Drag and drop
  // -----------------------------------------------------------------------
  describe('drag and drop', () => {
    it('draggable container is rendered via stub', async () => {
      const wrapper = await renderPage();

      const container = wrapper.find('[data-testid="draggable-container"]');
      expect(container.exists()).toBe(true);
    });

    it('reorder via emitting end event triggers save', async () => {
      let savedPayload: Record<string, unknown> | null = null;
      server.use(
        http.patch('*/api/profiles/me', async ({ request }) => {
          savedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockProfileResponse, ...savedPayload });
        }),
      );

      const wrapper = await renderPage();

      // Find the draggable stub and emit 'end' to simulate drag completion
      const draggableComp = wrapper.findComponent({ name: 'draggable' });
      expect(draggableComp.exists()).toBe(true);

      draggableComp.vm.$emit('end');
      await flushPromises();

      // Advance past the 500ms debounce
      vi.advanceTimersByTime(500);
      await flushPromises();
      await flushPromises();

      expect(savedPayload).not.toBeNull();
      const dashSettings = (savedPayload as any).dashboardSettings;
      expect(dashSettings).toBeDefined();
      expect(dashSettings.widgetOrder).toBeDefined();
      expect(dashSettings.widgetOrder.length).toBe(7);
    });
  });
});
