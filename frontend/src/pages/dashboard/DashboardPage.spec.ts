import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import DashboardPage from './DashboardPage.vue';
import { mockAccountResponse, mockSecondAccountResponse } from '@/test/mocks/handlers/accounts';
import { mockGivenDebtResponse, mockTakenDebtResponse } from '@/test/mocks/handlers/debts';
import { mockBudgetResponse } from '@/test/mocks/handlers/budgets';
import { mockAnalyticsWithDataResponse } from '@/test/mocks/handlers/analytics';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted runs before vi.mock hoisting
// ---------------------------------------------------------------------------
const { navigateBackMock } = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
}));

vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

vi.mock('@/features/install-pwa', () => ({
  InstallPwaBanner: {
    name: 'InstallPwaBanner',
    template: '<div data-testid="install-pwa-banner" />',
  },
  InstallPwaModal: { name: 'InstallPwaModal', template: '<div />' },
  usePwaInstall: () => ({
    showModal: { value: false },
    showBanner: { value: false },
    platform: 'desktop',
    isStandalone: false,
    isDismissed: { value: false },
    canUseNativePrompt: { value: false },
    openModal: vi.fn(),
    closeModal: vi.fn(),
    dismissBanner: vi.fn(),
    triggerNativeInstall: vi.fn(),
  }),
}));

vi.mock('@/shared/lib/composables/usePwaUpdate', () => ({
  usePwaUpdateToast: vi.fn(),
  usePwaUpdate: () => ({
    needRefresh: { value: false },
    updateServiceWorker: vi.fn(),
    checkForUpdate: vi.fn(),
  }),
}));

vi.mock('@/features/feature-hints', () => ({
  useFeatureHints: () => ({
    isDotDismissed: () => true,
    dismissDot: vi.fn(),
    incrementCounter: vi.fn(),
    shouldShowHint: () => false,
    dismissHint: vi.fn(),
    markHintShown: vi.fn(),
    getHintConfig: () => ({ title: 'hint', description: 'desc', actionLabel: 'Go' }),
  }),
  FeatureHintPopover: {
    name: 'FeatureHintPopover',
    template: '<div><slot /></div>',
    props: ['config', 'open', 'side'],
  },
}));

vi.mock('@/shared/lib/haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const routes = [
  { path: '/', component: DashboardPage, name: 'dashboard' },
  { path: '/profile', component: { template: '<div />' }, name: 'profile' },
  { path: '/accounts', component: { template: '<div />' }, name: 'accounts' },
  { path: '/accounts/new', component: { template: '<div />' }, name: 'new-account' },
  { path: '/accounts/:id', component: { template: '<div />' }, name: 'account-detail' },
  { path: '/transactions/new', component: { template: '<div />' }, name: 'new-transaction' },
  { path: '/history', component: { template: '<div />' }, name: 'history' },
  { path: '/debts', component: { template: '<div />' }, name: 'debts-list' },
  { path: '/debts/new', component: { template: '<div />' }, name: 'new-debt' },
  { path: '/debts/:id', component: { template: '<div />' }, name: 'debt-detail' },
  { path: '/analytics', component: { template: '<div />' }, name: 'analytics' },
  {
    path: '/settings/quick-actions',
    component: { template: '<div />' },
    name: 'settings-quick-actions',
  },
  { path: '/settings/dashboard', component: { template: '<div />' }, name: 'dashboard-settings' },
];

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------
let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(options?: { router?: ReturnType<typeof createTestRouter> }) {
  const router = options?.router ?? createTestRouter(routes);
  if (!options?.router) {
    router.push('/');
    await router.isReady();
  }

  currentWrapper = renderWithProviders(DashboardPage, {
    router,
    provideAuth: { user: mockUser },
    global: {
      stubs: {
        // Stub heavy child components that have their own tests
        SetBudgetSheet: {
          name: 'SetBudgetSheet',
          template: '<div data-testid="set-budget-sheet" />',
        },
        QuickActionModal: { name: 'QuickActionModal', template: '<div />' },
        InstallPwaModal: { name: 'InstallPwaModal', template: '<div />' },
        // Async wrappers used in DashboardActivityColumn and DashboardSidePanel
        AsyncComponentWrapper: { name: 'AsyncComponentWrapper', template: '<div />' },
      },
    },
  });
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

// ===========================================================================
describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('renders the dashboard main content', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(true);
    });

    it('shows the user greeting', async () => {
      const wrapper = await renderPage();
      // getGreeting returns one of: Доброе утро, Добрый день, Добрый вечер, Доброй ночи
      const text = wrapper.text();
      const hasGreeting =
        text.includes('Доброе утро') ||
        text.includes('Добрый день') ||
        text.includes('Добрый вечер') ||
        text.includes('Доброй ночи');
      expect(hasGreeting).toBe(true);
    });

    it('displays the user first name from profile', async () => {
      const wrapper = await renderPage();
      // mockProfileResponse.name = 'Test User', userName extracts first word 'Test'
      expect(wrapper.text()).toContain('Test');
    });

    it('renders the BalanceCard component', async () => {
      const wrapper = await renderPage();
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.exists()).toBe(true);
    });

    it('renders the mobile layout container', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="dashboard-mobile-layout"]').exists()).toBe(true);
    });

    it('shows customize dashboard button', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Настроить вид дашборда');
    });
  });

  // -----------------------------------------------------------------------
  // Balance card
  // -----------------------------------------------------------------------
  describe('balance card', () => {
    it('shows total balance for single account', async () => {
      const wrapper = await renderPage();
      // Default handler returns account with 50000 UZS
      // BalanceCard displays formatMasked — contains "50 000"
      expect(wrapper.text()).toContain('Общий баланс');
    });

    it('shows balance for multiple accounts', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Общий баланс');
    });

    it('toggles balance hidden state', async () => {
      const wrapper = await renderPage();
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.exists()).toBe(true);

      // Initially not hidden
      expect(balanceCard.props('hidden')).toBe(false);

      // Emit toggle event
      balanceCard.vm.$emit('toggle-hidden');
      await flushPromises();

      // After toggle, balance should be hidden (localStorage updated)
      expect(balanceCard.props('hidden')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Account stack
  // -----------------------------------------------------------------------
  describe('account stack', () => {
    it('renders AccountStack widget', async () => {
      const wrapper = await renderPage();
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      expect(accountStack.exists()).toBe(true);
    });

    it('passes accounts data to AccountStack', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      expect(accountStack.props('accounts')).toHaveLength(2);
    });

    it('navigates to accounts page when view-all emitted', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      accountStack.vm.$emit('view-all');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'accounts' });
    });

    it('navigates to new account page when add-click emitted', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      accountStack.vm.$emit('add-click');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'new-account' });
    });

    it('navigates to account detail on account-click', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      accountStack.vm.$emit('account-click', mockAccountResponse);
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({
        name: 'account-detail',
        params: { id: 'acc-1' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // Widget ordering
  // -----------------------------------------------------------------------
  describe('widget ordering', () => {
    it('renders widgets in default order when no dashboard settings', async () => {
      const wrapper = await renderPage();
      const mobileLayout = wrapper.find('[data-testid="dashboard-mobile-layout"]');
      expect(mobileLayout.exists()).toBe(true);

      // Default order includes all standard widgets
      // quick_actions, accounts, top_expenses, transactions (via activity), budget, debts
      expect(wrapper.find('[data-testid="widget-quick-actions"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-accounts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-activity"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-budget"]').exists()).toBe(true);
    });

    it('renders widgets in custom order from profile dashboardSettings', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            dashboardSettings: {
              widgetOrder: [
                'budget',
                'accounts',
                'quick_actions',
                'top_expenses',
                'transactions',
                'debts',
              ],
              hiddenWidgets: [],
              hiddenAccountIds: [],
            },
          }),
        ),
      );
      const wrapper = await renderPage();

      // All standard widgets should still be present
      expect(wrapper.find('[data-testid="widget-budget"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-accounts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-quick-actions"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Hidden widgets
  // -----------------------------------------------------------------------
  describe('hidden widgets', () => {
    it('hides widgets listed in hiddenWidgets setting', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            dashboardSettings: {
              widgetOrder: [
                'quick_actions',
                'accounts',
                'top_expenses',
                'transactions',
                'budget',
                'debts',
              ],
              hiddenWidgets: ['quick_actions', 'budget'],
              hiddenAccountIds: [],
            },
          }),
        ),
      );
      const wrapper = await renderPage();

      // Hidden widgets should not be rendered
      expect(wrapper.find('[data-testid="widget-quick-actions"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="widget-budget"]').exists()).toBe(false);

      // Visible widgets should still be present
      expect(wrapper.find('[data-testid="widget-accounts"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="widget-activity"]').exists()).toBe(true);
    });

    it('hides accounts widget when in hiddenWidgets', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            dashboardSettings: {
              widgetOrder: [
                'quick_actions',
                'accounts',
                'top_expenses',
                'transactions',
                'budget',
                'debts',
              ],
              hiddenWidgets: ['accounts'],
              hiddenAccountIds: [],
            },
          }),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="widget-accounts"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="widget-quick-actions"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Empty states
  // -----------------------------------------------------------------------
  describe('empty states', () => {
    it('handles empty accounts gracefully', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();
      // AccountStack shows empty state text
      expect(wrapper.text()).toContain('У вас пока нет счетов');
    });

    it('handles empty debts gracefully', async () => {
      // Default handler already returns empty debts
      const wrapper = await renderPage();
      // Should not crash — page still renders
      expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(true);
    });

    it('handles empty transactions gracefully', async () => {
      // Default handler returns empty transactions
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="dashboard-main"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Budget section
  // -----------------------------------------------------------------------
  describe('budget section', () => {
    it('shows budget empty state when no budget set', async () => {
      // Default budgets handler returns null
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Нет бюджета на месяц');
    });

    it('shows budget with data when budget is set', async () => {
      server.use(http.get('*/api/budgets/current', () => HttpResponse.json(mockBudgetResponse)));
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Бюджет на месяц');
    });

    it('passes budget data to BudgetSection', async () => {
      server.use(http.get('*/api/budgets/current', () => HttpResponse.json(mockBudgetResponse)));
      const wrapper = await renderPage();
      const budgetSection = wrapper.findComponent({ name: 'BudgetSection' });
      expect(budgetSection.exists()).toBe(true);
      expect(budgetSection.props('budget')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Top expenses
  // -----------------------------------------------------------------------
  describe('top expenses', () => {
    it('renders DashboardTopExpenses widget', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Расходы за месяц');
    });

    it('shows empty state when no expense data', async () => {
      const wrapper = await renderPage();
      // Default analytics handler returns empty breakdown
      expect(wrapper.text()).toContain('Нет расходов');
    });

    it('shows category data when analytics has data', async () => {
      server.use(
        http.get('*/api/transactions/stats/analytics', () =>
          HttpResponse.json(mockAnalyticsWithDataResponse),
        ),
      );
      const wrapper = await renderPage();
      // Should show expense category names from breakdown
      expect(wrapper.text()).toContain('Продукты');
    });
  });

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  describe('navigation', () => {
    it('navigates to profile on profile-click in header', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const header = wrapper.findComponent({ name: 'DashboardMobileHeader' });
      header.vm.$emit('profile-click');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'profile' });
    });

    it('navigates to accounts on balance-click in header', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const header = wrapper.findComponent({ name: 'DashboardMobileHeader' });
      header.vm.$emit('balance-click');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'accounts' });
    });

    it('navigates to dashboard settings on settings-click', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const settingsBtn = wrapper.find('[data-testid="dashboard-settings-btn"]');
      await settingsBtn.trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'dashboard-settings' });
    });

    it('navigates to accounts on BalanceCard balance-click', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      balanceCard.vm.$emit('balance-click');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'accounts' });
    });
  });

  // -----------------------------------------------------------------------
  // Loading states
  // -----------------------------------------------------------------------
  describe('loading states', () => {
    it('shows loading state while accounts load', async () => {
      let resolveAccounts!: () => void;
      server.use(
        http.get('*/api/accounts', async () => {
          await new Promise<void>((r) => {
            resolveAccounts = r;
          });
          return HttpResponse.json([mockAccountResponse]);
        }),
      );

      const wrapper = await renderPage();

      // BalanceCard should be in loading state
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.props('loading')).toBe(true);

      // AccountStack should also be loading
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      expect(accountStack.props('loading')).toBe(true);

      // Resolve and verify loading ends
      resolveAccounts();
      await flushPromises();
      await flushPromises();

      expect(balanceCard.props('loading')).toBe(false);
      expect(accountStack.props('loading')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Quick actions widget
  // -----------------------------------------------------------------------
  describe('quick actions', () => {
    it('renders DashboardQuickActions component', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="widget-quick-actions"]').exists()).toBe(true);
    });

    it('quick actions widget is hidden when profile has quickActionsHidden', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            quickActionsHidden: true,
          }),
        ),
      );
      const wrapper = await renderPage();
      const quickActions = wrapper.findComponent({ name: 'DashboardQuickActions' });
      // Component pulls quickActionsHidden from context; when hidden, the root <section>
      // is absent so the wrapper renders no children.
      if (quickActions.exists()) {
        expect(quickActions.find('section').exists()).toBe(false);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Activity column
  // -----------------------------------------------------------------------
  describe('activity column', () => {
    it('renders DashboardActivityColumn', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="widget-activity"]').exists()).toBe(true);
    });

    it('passes debts data to activity column', async () => {
      server.use(
        http.get('*/api/debts', () =>
          HttpResponse.json([mockGivenDebtResponse, mockTakenDebtResponse]),
        ),
      );
      const wrapper = await renderPage();
      const activityColumn = wrapper.findComponent({ name: 'DashboardActivityColumn' });
      expect(activityColumn.exists()).toBe(true);
      const debtsSection = activityColumn.findComponent({ name: 'DebtsSection' });
      expect(debtsSection.exists()).toBe(true);
      expect(debtsSection.props('debts')).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Balance hidden (localStorage)
  // -----------------------------------------------------------------------
  describe('balance hidden toggle', () => {
    it('starts with balance visible by default', async () => {
      const wrapper = await renderPage();
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.props('hidden')).toBe(false);
    });

    it('reads hidden state from localStorage', async () => {
      localStorage.setItem('balance_hidden', 'true');
      const wrapper = await renderPage();
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.props('hidden')).toBe(true);
    });

    it('passes isHidden to AccountStack', async () => {
      localStorage.setItem('balance_hidden', 'true');
      const wrapper = await renderPage();
      const accountStack = wrapper.findComponent({ name: 'AccountStack' });
      expect(accountStack.props('hidden')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Profile data integration
  // -----------------------------------------------------------------------
  describe('profile data', () => {
    it('uses profile currency for BalanceCard', async () => {
      const wrapper = await renderPage();
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.props('currency')).toBe('UZS');
    });

    it('uses different currency when profile is updated', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({ ...mockProfileResponse, currency: 'USD' }),
        ),
      );
      const wrapper = await renderPage();
      const balanceCard = wrapper.findComponent({ name: 'BalanceCard' });
      expect(balanceCard.props('currency')).toBe('USD');
    });

    it('shows first name from profile', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({ ...mockProfileResponse, name: 'Александр Петров' }),
        ),
      );
      const wrapper = await renderPage();
      // useDashboardData extracts first word as userName
      expect(wrapper.text()).toContain('Александр');
    });
  });

  // -----------------------------------------------------------------------
  // DashboardMobileHeader
  // -----------------------------------------------------------------------
  describe('mobile header', () => {
    it('renders DashboardMobileHeader with correct props', async () => {
      const wrapper = await renderPage();
      const header = wrapper.findComponent({ name: 'DashboardMobileHeader' });
      expect(header.exists()).toBe(true);
      expect(header.props('userName')).toBe('Test');
      expect(header.props('currency')).toBe('UZS');
      expect(header.props('isHidden')).toBe(false);
    });

    it('navigates to settings on header settings-click', async () => {
      const router = createTestRouter(routes);
      router.push('/');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });
      const header = wrapper.findComponent({ name: 'DashboardMobileHeader' });
      header.vm.$emit('settings-click');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'dashboard-settings' });
    });
  });

  // -----------------------------------------------------------------------
  // Compact Pro Mode (XDS-30)
  // -----------------------------------------------------------------------
  describe('compact pro mode', () => {
    it('renders standard layout by default', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="dashboard-mobile-layout"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="dashboard-compact-layout"]').exists()).toBe(false);
    });

    it('renders compact layout when localStorage flag is set', async () => {
      localStorage.setItem('dashboard_compact_mode', 'true');
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="dashboard-compact-layout"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="dashboard-mobile-layout"]').exists()).toBe(false);
    });

    it('reflects compact state on the DashboardCompactToggle', async () => {
      localStorage.setItem('dashboard_compact_mode', 'true');
      const wrapper = await renderPage();
      const toggle = wrapper.findComponent({ name: 'DashboardCompactToggle' });
      expect(toggle.exists()).toBe(true);
      // aria-pressed on the underlying button reflects the context state
      expect(toggle.find('button').attributes('aria-pressed')).toBe('true');
    });

    it('toggles compact mode when DashboardCompactToggle is clicked', async () => {
      const wrapper = await renderPage();
      expect(wrapper.find('[data-testid="dashboard-compact-layout"]').exists()).toBe(false);

      const toggle = wrapper.findComponent({ name: 'DashboardCompactToggle' });
      await toggle.find('button').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="dashboard-compact-layout"]').exists()).toBe(true);
      expect(localStorage.getItem('dashboard_compact_mode')).toBe('true');
    });
  });
});
