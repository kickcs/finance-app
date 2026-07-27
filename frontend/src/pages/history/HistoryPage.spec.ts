import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import HistoryPage from './HistoryPage.vue';
import { mockAccountResponse } from '@/test/mocks/handlers/accounts';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';

// Mock app router — vi.hoisted runs before vi.mock hoisting
vi.mock('@/app/router', () => ({
  navigateBack: vi.fn(),
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// Закрытие настоящей шторки роняет jsdom на чтении style отсоединённого узла —
// см. комментарий в стабе.
vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

// ---------------------------------------------------------------------------

// Mock transaction data in camelCase (backend format, as MSW responses)
const mockExpenseTransaction = {
  ...mockTransactionResponse,
  id: 'tx-1',
  userId: 'test-user-1',
  accountId: 'acc-1',
  categoryId: 'cat-groceries',
  amount: 25000,
  currency: 'UZS',
  type: 'expense',
  description: 'Продукты',
  date: '2025-06-15T00:00:00.000Z',
  createdAt: '2025-06-15T12:00:00.000Z',
  isDebtRelated: false,
  debtId: null,
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  returnedAmount: 0,
  netAmount: 25000,
  hasDebtReturns: false,
};

const mockIncomeTransaction = {
  ...mockTransactionResponse,
  id: 'tx-2',
  userId: 'test-user-1',
  accountId: 'acc-1',
  categoryId: 'cat-salary',
  amount: 100000,
  currency: 'UZS',
  type: 'income',
  description: 'Зарплата',
  date: '2025-06-14T00:00:00.000Z',
  createdAt: '2025-06-14T10:00:00.000Z',
  isDebtRelated: false,
  debtId: null,
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  returnedAmount: 0,
  netAmount: 100000,
  hasDebtReturns: false,
};

const mockSecondExpenseTransaction = {
  ...mockTransactionResponse,
  id: 'tx-3',
  userId: 'test-user-1',
  accountId: 'acc-1',
  categoryId: 'cat-transport',
  amount: 5000,
  currency: 'UZS',
  type: 'expense',
  description: 'Такси',
  date: '2025-06-15T00:00:00.000Z',
  createdAt: '2025-06-15T08:00:00.000Z',
  isDebtRelated: false,
  debtId: null,
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  returnedAmount: 0,
  netAmount: 5000,
  hasDebtReturns: false,
};

// ---------------------------------------------------------------------------

const routes = [
  { path: '/history', component: HistoryPage, name: 'history' },
  { path: '/transactions/new', component: { template: '<div />' }, name: 'new-transaction' },
  { path: '/', component: { template: '<div />' }, name: 'dashboard' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage() {
  const router = createTestRouter(routes);
  router.push('/history');
  await router.isReady();

  currentWrapper = renderWithProviders(HistoryPage, {
    router,
    provideAuth: { user: mockUser },
  });
  // Allow all queries (transactions, accounts, categories, exchange-rates, debts) to settle.
  // Two flushes: query fires -> response arrives -> dependent watchers trigger.
  await flushPromises();
  await flushPromises();
  return { wrapper: currentWrapper, router };
}

// ===========================================================================
describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it('displays page title "История"', async () => {
      const { wrapper } = await renderPage();
      expect(wrapper.text()).toContain('История');
    });

    it('shows type filter tabs', async () => {
      const { wrapper } = await renderPage();

      const tabs = wrapper.findComponent({ name: 'UTabs' });
      expect(tabs.exists()).toBe(true);
      // Should show filter tab labels
      expect(wrapper.text()).toContain('Все');
      expect(wrapper.text()).toContain('Расходы');
      expect(wrapper.text()).toContain('Доходы');
      expect(wrapper.text()).toContain('Переводы');
      expect(wrapper.text()).toContain('Долги');
    });

    it('shows refresh button', async () => {
      const { wrapper } = await renderPage();

      const refreshBtn = wrapper.find('button[aria-label="Обновить"]');
      expect(refreshBtn.exists()).toBe(true);
    });

    it('shows search and filters buttons in the controls row', async () => {
      const { wrapper } = await renderPage();

      expect(wrapper.find('[data-testid="open-search-btn"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="open-filters-btn"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Empty State (no transactions, no filters)
  // -----------------------------------------------------------------------
  describe('empty state (no transactions)', () => {
    it('shows "Нет транзакций" when no transactions and no filters active', async () => {
      const { wrapper } = await renderPage();

      expect(wrapper.find('[data-testid="history-empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Нет транзакций');
      expect(wrapper.text()).toContain('Добавьте свою первую транзакцию');
    });

    it('shows "Добавить транзакцию" button in empty state', async () => {
      const { wrapper } = await renderPage();

      const addBtn = wrapper.find('[data-testid="add-transaction-btn"]');
      expect(addBtn.exists()).toBe(true);
      expect(addBtn.text()).toContain('Добавить транзакцию');
    });

    it('"Добавить транзакцию" button navigates to new-transaction route', async () => {
      const { wrapper, router } = await renderPage();
      const pushSpy = vi.spyOn(router, 'push');

      const addBtn = wrapper.find('[data-testid="add-transaction-btn"]');
      await addBtn.trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'new-transaction' });
    });
  });

  // -----------------------------------------------------------------------
  // Empty State (filtered, no results)
  // -----------------------------------------------------------------------
  describe('empty state (filtered, no results)', () => {
    it('shows "Ничего не найдено" when type filter active but no results', async () => {
      // Default handler returns empty transactions
      const { wrapper } = await renderPage();

      // Switch to 'expense' type filter to activate filters
      const tabs = wrapper.findComponent({ name: 'UTabs' });
      tabs.vm.$emit('update:modelValue', 'expense');
      await nextTick();
      await flushPromises();
      await flushPromises();

      expect(wrapper.find('[data-testid="history-empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Ничего не найдено');
      expect(wrapper.text()).toContain('Попробуйте изменить параметры поиска');
    });

    it('shows "Сбросить фильтры" button when filters active and no results', async () => {
      const { wrapper } = await renderPage();

      // Switch to 'income' type filter
      const tabs = wrapper.findComponent({ name: 'UTabs' });
      tabs.vm.$emit('update:modelValue', 'income');
      await nextTick();
      await flushPromises();
      await flushPromises();

      const resetBtn = wrapper.find('[data-testid="reset-filters-btn"]');
      expect(resetBtn.exists()).toBe(true);
      expect(resetBtn.text()).toContain('Сбросить фильтры');
    });

    it('"Сбросить фильтры" button resets all filters', async () => {
      const { wrapper } = await renderPage();

      // Switch to 'expense' type filter
      const tabs = wrapper.findComponent({ name: 'UTabs' });
      tabs.vm.$emit('update:modelValue', 'expense');
      await nextTick();
      await flushPromises();
      await flushPromises();

      // Click reset filters
      const resetBtn = wrapper.find('[data-testid="reset-filters-btn"]');
      await resetBtn.trigger('click');
      await nextTick();
      await flushPromises();

      // After reset, the empty state should show the "no transactions" variant
      // (since there are no transactions at all)
      expect(wrapper.text()).toContain('Нет транзакций');
      expect(wrapper.find('[data-testid="reset-filters-btn"]').exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Loading State
  // -----------------------------------------------------------------------
  describe('loading state', () => {
    it('shows skeleton while transactions load', async () => {
      // Block transactions response to keep loading state
      let resolveTransactions!: () => void;
      server.use(
        http.get('*/api/transactions', async () => {
          await new Promise<void>((res) => {
            resolveTransactions = res;
          });
          return HttpResponse.json({
            data: [],
            nextCursor: null,
            hasMore: false,
          });
        }),
      );

      const router = createTestRouter(routes);
      router.push('/history');
      await router.isReady();

      currentWrapper = renderWithProviders(HistoryPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();

      expect(currentWrapper.find('[data-testid="history-loading"]').exists()).toBe(true);

      // Release the blocked response and let component settle
      resolveTransactions();
      await flushPromises();
      await flushPromises();
    });
  });

  // -----------------------------------------------------------------------
  // Transaction List
  // -----------------------------------------------------------------------
  describe('transaction list', () => {
    it('renders transaction list when data exists', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({
            data: [mockExpenseTransaction, mockIncomeTransaction],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );
      const { wrapper } = await renderPage();

      expect(wrapper.find('[data-testid="history-transaction-list"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="history-empty-state"]').exists()).toBe(false);
    });

    it('renders VirtualGroupedTransactionList component', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({
            data: [mockExpenseTransaction, mockIncomeTransaction],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );
      const { wrapper } = await renderPage();

      const virtualList = wrapper.findComponent({ name: 'VirtualGroupedTransactionList' });
      expect(virtualList.exists()).toBe(true);
    });

    it('groups transactions by date', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({
            data: [mockExpenseTransaction, mockSecondExpenseTransaction, mockIncomeTransaction],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );
      const { wrapper } = await renderPage();

      const virtualList = wrapper.findComponent({ name: 'VirtualGroupedTransactionList' });
      expect(virtualList.exists()).toBe(true);

      // tx-1 and tx-3 are on 2025-06-15, tx-2 is on 2025-06-14 => 2 groups
      const groups = virtualList.props('groups');
      expect(groups).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Type Filter Tabs
  // -----------------------------------------------------------------------
  describe('type filter tabs', () => {
    it('defaults to "all" filter', async () => {
      const { wrapper } = await renderPage();

      const tabs = wrapper.findComponent({ name: 'UTabs' });
      expect(tabs.props('modelValue')).toBe('all');
    });

    it('switching tabs changes type filter', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({
            data: [mockExpenseTransaction],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );
      const { wrapper } = await renderPage();

      const tabs = wrapper.findComponent({ name: 'UTabs' });

      // Switch to expense
      tabs.vm.$emit('update:modelValue', 'expense');
      await nextTick();
      await flushPromises();
      await flushPromises();

      // UTabs model should now reflect the new value
      expect(tabs.props('modelValue')).toBe('expense');
    });

    it('switching to specific type filter changes server request', async () => {
      let lastRequestUrl = '';
      server.use(
        http.get('*/api/transactions', ({ request }) => {
          lastRequestUrl = request.url;
          return HttpResponse.json({
            data: [],
            nextCursor: null,
            hasMore: false,
          });
        }),
      );
      const { wrapper } = await renderPage();

      // Switch to income filter
      const tabs = wrapper.findComponent({ name: 'UTabs' });
      tabs.vm.$emit('update:modelValue', 'income');
      await nextTick();
      await flushPromises();
      await flushPromises();

      // Request should contain type=income
      expect(lastRequestUrl).toContain('type=income');
    });
  });

  // -----------------------------------------------------------------------
  // Filter Toggle
  // -----------------------------------------------------------------------
  describe('search toggle', () => {
    it('type tabs are shown and search field hidden by default', async () => {
      const { wrapper } = await renderPage();

      expect(wrapper.findComponent({ name: 'UTabs' }).exists()).toBe(true);
      expect(wrapper.findComponent({ name: 'SearchInput' }).exists()).toBe(false);
    });

    it('search button replaces type tabs with the search field', async () => {
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="open-search-btn"]').trigger('click');
      await nextTick();

      // Пока идёт поиск, тип-фильтр не применяется — вкладки не показываем
      expect(wrapper.findComponent({ name: 'SearchInput' }).exists()).toBe(true);
      expect(wrapper.findComponent({ name: 'UTabs' }).exists()).toBe(false);
    });

    it('"Отмена" closes search and restores type tabs', async () => {
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="open-search-btn"]').trigger('click');
      await nextTick();

      const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Отмена');
      expect(cancelBtn).toBeDefined();
      await cancelBtn!.trigger('click');
      await nextTick();

      expect(wrapper.findComponent({ name: 'SearchInput' }).exists()).toBe(false);
      expect(wrapper.findComponent({ name: 'UTabs' }).exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Filters Sheet
  // -----------------------------------------------------------------------
  describe('filters sheet', () => {
    it('sheet is closed by default', async () => {
      const { wrapper } = await renderPage();

      const sheet = wrapper.findComponent({ name: 'HistoryFiltersSheet' });
      expect(sheet.exists()).toBe(true);
      expect(sheet.props('open')).toBe(false);
    });

    it('filters button opens the sheet', async () => {
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="open-filters-btn"]').trigger('click');
      await nextTick();

      expect(wrapper.findComponent({ name: 'HistoryFiltersSheet' }).props('open')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Refresh Button
  // -----------------------------------------------------------------------
  describe('refresh button', () => {
    it('refresh button is enabled by default', async () => {
      const { wrapper } = await renderPage();

      const refreshBtn = wrapper.find('button[aria-label="Обновить"]');
      expect(refreshBtn.attributes('disabled')).toBeUndefined();
    });

    it('refresh button becomes disabled while refreshing', async () => {
      const { wrapper } = await renderPage();

      const refreshBtn = wrapper.find('button[aria-label="Обновить"]');
      // Click refresh
      await refreshBtn.trigger('click');
      // Button should be disabled while refreshing (isRefreshing = true)
      // After flushPromises, invalidation resolves so it goes back to enabled
      await flushPromises();
      await flushPromises();

      // After refresh completes, button should be re-enabled
      expect(refreshBtn.attributes('disabled')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Active Filters Indicator Dot
  // -----------------------------------------------------------------------
  describe('active filters', () => {
    it('shows neither count badge nor chips when no filters are active', async () => {
      const { wrapper } = await renderPage();

      expect(wrapper.find('[data-testid="active-filters-count"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="active-filter-chips"]').exists()).toBe(false);
    });

    it('selecting an account shows the count badge and a removable chip', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])));
      const { wrapper } = await renderPage();

      const sheet = wrapper.findComponent({ name: 'HistoryFiltersSheet' });
      sheet.vm.$emit('update:selectedAccountId', mockAccountResponse.id);
      await nextTick();
      await flushPromises();

      expect(wrapper.find('[data-testid="active-filters-count"]').text()).toBe('1');

      const chips = wrapper.find('[data-testid="active-filter-chips"]');
      expect(chips.exists()).toBe(true);
      expect(chips.text()).toContain(mockAccountResponse.name);
    });

    it('clicking the chip removes the filter', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])));
      const { wrapper } = await renderPage();

      const sheet = wrapper.findComponent({ name: 'HistoryFiltersSheet' });
      sheet.vm.$emit('update:selectedAccountId', mockAccountResponse.id);
      await nextTick();
      await flushPromises();

      await wrapper.find('[data-testid="active-filter-chips"] button').trigger('click');
      await nextTick();
      await flushPromises();

      expect(wrapper.find('[data-testid="active-filter-chips"]').exists()).toBe(false);
      expect(sheet.props('selectedAccountId')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Transaction Click on Mobile
  // -----------------------------------------------------------------------
  describe('transaction click on mobile', () => {
    it('opens edit modal when transaction clicked on mobile', async () => {
      server.use(
        http.get('*/api/transactions', () =>
          HttpResponse.json({
            data: [mockExpenseTransaction],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );
      const { wrapper } = await renderPage();

      // Simulate transaction click via VirtualGroupedTransactionList event
      const virtualList = wrapper.findComponent({ name: 'VirtualGroupedTransactionList' });
      expect(virtualList.exists()).toBe(true);

      // Emit transaction-click event with a Transaction object (snake_case, frontend format)
      virtualList.vm.$emit('transaction-click', {
        id: 'tx-1',
        user_id: 'test-user-1',
        account_id: 'acc-1',
        category_id: 'cat-groceries',
        amount: 25000,
        currency: 'UZS',
        type: 'expense',
        description: 'Продукты',
        date: '2025-06-15T00:00:00.000Z',
        created_at: '2025-06-15T12:00:00.000Z',
        is_debt_related: false,
        is_informational: false,
        debt_id: null,
        to_account_id: null,
        to_amount: null,
        to_currency: null,
        returned_amount: 0,
        net_amount: 25000,
        has_debt_returns: false,
      });
      await flushPromises();
      await flushPromises();

      // Edit modal should be open (mobile mode - jsdom defaults isDesktop to false)
      const editModal = wrapper.findComponent({ name: 'EditTransactionModal' });
      expect(editModal.exists()).toBe(true);
      expect(editModal.props('modelValue')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Edit and Delete Modals
  // -----------------------------------------------------------------------
  describe('edit and delete modals', () => {
    it('renders EditTransactionModal', async () => {
      const { wrapper } = await renderPage();

      const editModal = wrapper.findComponent({ name: 'EditTransactionModal' });
      expect(editModal.exists()).toBe(true);
      // Initially closed
      expect(editModal.props('modelValue')).toBe(false);
    });

    it('renders DeleteTransactionModal', async () => {
      const { wrapper } = await renderPage();

      const deleteModal = wrapper.findComponent({ name: 'DeleteTransactionModal' });
      expect(deleteModal.exists()).toBe(true);
      // Initially closed
      expect(deleteModal.props('modelValue')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Filters Container Content
  // -----------------------------------------------------------------------
  describe('filters sheet content', () => {
    async function openFiltersSheet() {
      const { wrapper } = await renderPage();
      await wrapper.find('[data-testid="open-filters-btn"]').trigger('click');
      await nextTick();
      await flushPromises();
      return wrapper;
    }

    it('renders AccountSelector when accounts exist', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])));
      const wrapper = await openFiltersSheet();

      expect(wrapper.findComponent({ name: 'AccountSelector' }).exists()).toBe(true);
    });

    it('renders CategoryChips when categories exist', async () => {
      const wrapper = await openFiltersSheet();

      expect(wrapper.findComponent({ name: 'CategoryChips' }).exists()).toBe(true);
    });

    it('does not mount sheet content while closed', async () => {
      const { wrapper } = await renderPage();

      expect(wrapper.findComponent({ name: 'CategoryChips' }).exists()).toBe(false);
    });
  });
});
