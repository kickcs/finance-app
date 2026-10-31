import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import HistoryPage from './HistoryPage.vue';
import { mockAccountResponse, mockSecondAccountResponse } from '@/test/mocks/handlers/accounts';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { isBottomNavSuppressed } from '@/shared/lib/composables';
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
    // Фильтры живут в sessionStorage до конца сессии — между тестами их надо обнулять
    sessionStorage.clear();
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

    it('keeps only search and refresh in the header — the old filters button is gone', async () => {
      const { wrapper } = await renderPage();

      expect(wrapper.find('[data-testid="open-search-btn"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Обновить"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="open-filters-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="active-filters-count"]').exists()).toBe(false);
    });

    it('shows the facet rail with four chips under the tabs', async () => {
      const { wrapper } = await renderPage();

      const rail = wrapper.find('[data-testid="history-facet-rail"]');
      expect(rail.exists()).toBe(true);
      expect(rail.text()).toContain('Период');
      expect(rail.text()).toContain('Категория');
      expect(rail.text()).toContain('Тег');
      expect(rail.text()).toContain('Счёт');
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

      // Пока идёт поиск, фильтры не применяются — вкладки и чипы не показываем
      expect(wrapper.findComponent({ name: 'SearchInput' }).exists()).toBe(true);
      expect(wrapper.findComponent({ name: 'UTabs' }).exists()).toBe(false);
      expect(wrapper.find('[data-testid="history-facet-rail"]').exists()).toBe(false);
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
      expect(wrapper.find('[data-testid="history-facet-rail"]').exists()).toBe(true);
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
        payment_group_id: null,
        payment_sibling: null,
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
  // Facet rail and sheet
  // -----------------------------------------------------------------------
  describe('facet chips', () => {
    type Page = Awaited<ReturnType<typeof renderPage>>['wrapper'];

    /** Запоминает адреса запросов ленты и итога, чтобы сверять, что именно ушло на сервер. */
    function captureRequests() {
      const list: URL[] = [];
      const summary: URL[] = [];
      server.use(
        http.get('*/api/transactions', ({ request }) => {
          list.push(new URL(request.url));
          return HttpResponse.json({ data: [], nextCursor: null, hasMore: false });
        }),
        http.get('*/api/transactions/summary', ({ request }) => {
          summary.push(new URL(request.url));
          return HttpResponse.json({
            count: 0,
            eligibleCount: 0,
            lockedCount: 0,
            totals: [],
            asOf: '2025-06-15T12:00:00.000Z',
          });
        }),
      );
      return {
        last: () => list[list.length - 1],
        lastSummary: () => summary[summary.length - 1],
      };
    }

    async function settle() {
      await nextTick();
      await flushPromises();
      await flushPromises();
    }

    async function openFacet(wrapper: Page, facet: string) {
      await wrapper.find(`[data-testid="facet-chip-${facet}"]`).trigger('click');
      await settle();
    }

    // Содержимое шторки уезжает в портал на body, поэтому ищем его там
    function sheet() {
      return document.body.querySelector<HTMLElement>('[data-testid="history-facet-sheet"]');
    }

    function option(label: string) {
      const found = [
        ...(sheet()?.querySelectorAll<HTMLElement>('[role="checkbox"], [role="radio"]') ?? []),
      ].find((el) => el.textContent?.includes(label));
      if (!found) throw new Error(`В шторке нет пункта «${label}»`);
      return found;
    }

    async function pick(label: string) {
      option(label).click();
      await settle();
    }

    async function closeSheet() {
      document.body.querySelector<HTMLElement>('[data-testid="facet-show"]')?.click();
      await settle();
    }

    const railText = (wrapper: Page) => wrapper.find('[data-testid="history-facet-rail"]').text();

    describe('opening', () => {
      it('chip opens the sheet with its own options', async () => {
        const { wrapper } = await renderPage();
        expect(sheet()).toBeNull();

        await openFacet(wrapper, 'category');

        expect(sheet()?.dataset.facet).toBe('category');
        expect(option('Продукты').getAttribute('role')).toBe('checkbox');
        expect(document.body.textContent).toContain('Категория');
      });

      it('chips are buttons that announce a dialog', async () => {
        const { wrapper } = await renderPage();

        for (const facet of ['period', 'category', 'tag', 'account']) {
          expect(
            wrapper.find(`[data-testid="facet-chip-${facet}"]`).attributes('aria-haspopup'),
          ).toBe('dialog');
        }
      });

      it('closing button hides the sheet', async () => {
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'category');

        await closeSheet();

        expect(sheet()).toBeNull();
      });

      it('"Переводы" hide the category chip — transfers have no categories', async () => {
        const { wrapper } = await renderPage();
        expect(wrapper.find('[data-testid="facet-chip-category"]').exists()).toBe(true);

        wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'transfer');
        await settle();

        expect(wrapper.find('[data-testid="facet-chip-category"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="facet-chip-period"]').exists()).toBe(true);
      });
    });

    describe('categories', () => {
      it('multi-select sends the list and labels the chip "Первая +N"', async () => {
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'category');

        await pick('Продукты');
        await pick('Транспорт');

        expect(option('Продукты').getAttribute('aria-checked')).toBe('true');
        expect(requests.last().searchParams.get('categoryIds')).toBe('cat-groceries,cat-transport');
        expect(requests.lastSummary().searchParams.get('categoryIds')).toBe(
          'cat-groceries,cat-transport',
        );
        expect(railText(wrapper)).toContain('Продукты +1');
      });

      it('tapping a selected option unselects it', async () => {
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'category');

        await pick('Продукты');
        await pick('Транспорт');
        await pick('Продукты');

        expect(requests.last().searchParams.get('categoryIds')).toBe('cat-transport');
        expect(railText(wrapper)).toContain('Транспорт');
        expect(railText(wrapper)).not.toContain('+1');
      });

      it('"×" on the chip clears the facet and refetches without it', async () => {
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'category');
        await pick('Продукты');
        await closeSheet();
        expect(requests.last().searchParams.get('categoryIds')).toBe('cat-groceries');

        await wrapper.find('button[aria-label="Сбросить: Категория"]').trigger('click');
        await settle();

        expect(requests.last().searchParams.has('categoryIds')).toBe(false);
        expect(wrapper.find('[data-testid="facet-clear-category"]').exists()).toBe(false);
        expect(railText(wrapper)).toContain('Категория');
      });

      it('"Сбросить" in the sheet clears only this facet and is disabled when empty', async () => {
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'category');
        const reset = () =>
          document.body.querySelector<HTMLButtonElement>('[data-testid="facet-reset"]')!;
        expect(reset().disabled).toBe(true);

        await pick('Продукты');
        expect(reset().disabled).toBe(false);
        reset().click();
        await settle();

        expect(requests.last().searchParams.has('categoryIds')).toBe(false);
        expect(option('Продукты').getAttribute('aria-checked')).toBe('false');
      });

      it('switching the type tab drops incompatible categories and keeps compatible ones', async () => {
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'category');
        await pick('Продукты');
        await pick('Зарплата');
        await closeSheet();

        wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'expense');
        await settle();

        expect(requests.last().searchParams.get('type')).toBe('expense');
        expect(requests.last().searchParams.get('categoryIds')).toBe('cat-groceries');
        expect(railText(wrapper)).toContain('Продукты');
        expect(railText(wrapper)).not.toContain('Зарплата');
      });

      it('an id missing from the list is shown as "N выбрано"', async () => {
        sessionStorage.setItem(
          STORAGE_KEYS.HISTORY_FILTERS,
          JSON.stringify({ categoryIds: ['gone-1', 'gone-2'] }),
        );
        const { wrapper } = await renderPage();

        expect(railText(wrapper)).toContain('2 выбрано');
      });
    });

    describe('accounts', () => {
      it('selects several accounts and sends accountIds', async () => {
        server.use(
          http.get('*/api/accounts', () =>
            HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
          ),
        );
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'account');

        await pick(mockAccountResponse.name);
        expect(requests.last().searchParams.get('accountIds')).toBe(mockAccountResponse.id);
        expect(railText(wrapper)).toContain(mockAccountResponse.name);

        await pick(mockSecondAccountResponse.name);
        expect(requests.last().searchParams.get('accountIds')).toBe(
          `${mockAccountResponse.id},${mockSecondAccountResponse.id}`,
        );
        expect(railText(wrapper)).toContain(`${mockAccountResponse.name} +1`);
      });
    });

    describe('tags', () => {
      it('lists hashtags with usage counts and sends tags without "#"', async () => {
        server.use(
          http.get('*/api/transactions/hashtags', () =>
            HttpResponse.json([
              { tag: '#кафе', count: 3 },
              { tag: '#такси', count: 1 },
            ]),
          ),
        );
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'tag');

        expect(option('#кафе').textContent).toContain('3');
        expect(option('#такси').textContent).toContain('1');

        await pick('#кафе');
        await pick('#такси');

        expect(requests.last().searchParams.get('tags')).toBe('кафе,такси');
        expect(railText(wrapper)).toContain('#кафе +1');
      });

      it('says so when there are no tags yet', async () => {
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'tag');

        expect(sheet()?.textContent).toContain('Тегов пока нет');
      });
    });

    describe('period', () => {
      it('a preset sends startDate/endDate and a second tap removes the period', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 31, 12));
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'period');
        expect(option('Этот месяц').getAttribute('role')).toBe('radio');

        await pick('Последние 7 дней');

        expect(requests.last().searchParams.get('startDate')).toBe('2026-10-25');
        expect(requests.last().searchParams.get('endDate')).toBe('2026-10-31');
        expect(requests.lastSummary().searchParams.get('startDate')).toBe('2026-10-25');
        expect(railText(wrapper)).toContain('Последние 7 дней');

        await pick('Последние 7 дней');

        expect(requests.last().searchParams.has('startDate')).toBe(false);
        expect(requests.last().searchParams.has('endDate')).toBe(false);
      });

      it('"Этот месяц" runs from the start of the month to today', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 31, 12));
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'period');

        await pick('Этот месяц');

        expect(requests.last().searchParams.get('startDate')).toBe('2026-10-01');
        expect(requests.last().searchParams.get('endDate')).toBe('2026-10-31');
      });

      it('"Свой период" reveals two date fields and does not filter until a date is set', async () => {
        const requests = captureRequests();
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'period');

        await pick('Свой период');

        expect(document.body.querySelector('button[aria-label="Начало периода"]')).not.toBeNull();
        expect(document.body.querySelector('button[aria-label="Конец периода"]')).not.toBeNull();
        expect(requests.last().searchParams.has('startDate')).toBe(false);
        expect(wrapper.find('[data-testid="facet-clear-period"]').exists()).toBe(false);
      });

      it('has no "Сбросить" button — a second tap on the preset does that', async () => {
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'period');

        expect(document.body.querySelector('[data-testid="facet-reset"]')).toBeNull();
      });
    });

    describe('show button', () => {
      function summaryReturns(count: number) {
        server.use(
          http.get('*/api/transactions/summary', () =>
            HttpResponse.json({
              count,
              eligibleCount: count,
              lockedCount: 0,
              totals: [],
              asOf: '2025-06-15T12:00:00.000Z',
            }),
          ),
        );
      }

      it.each([
        [0, 'Ничего не найдено'],
        [1, 'Показать 1 операцию'],
        [3, 'Показать 3 операции'],
        [5, 'Показать 5 операций'],
        [21, 'Показать 21 операцию'],
      ])('with %i results reads «%s»', async (count, label) => {
        summaryReturns(count);
        const { wrapper } = await renderPage();

        await openFacet(wrapper, 'category');

        expect(document.body.querySelector('[data-testid="facet-show"]')?.textContent?.trim()).toBe(
          label,
        );
      });

      it('is just "Показать" until the count arrives', async () => {
        server.use(
          http.get('*/api/transactions/summary', async () => {
            await new Promise(() => {});
            return HttpResponse.json({});
          }),
        );
        const { wrapper } = await renderPage();

        await openFacet(wrapper, 'category');

        expect(document.body.querySelector('[data-testid="facet-show"]')?.textContent?.trim()).toBe(
          'Показать',
        );
      });
    });

    describe('state', () => {
      it('empty result with only a chip active offers "Сбросить фильтры"', async () => {
        server.use(http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])));
        const { wrapper } = await renderPage();
        await openFacet(wrapper, 'account');
        await pick(mockAccountResponse.name);
        await closeSheet();

        expect(wrapper.text()).toContain('Ничего не найдено');
        const resetBtn = wrapper.find('[data-testid="reset-filters-btn"]');
        expect(resetBtn.exists()).toBe(true);

        await resetBtn.trigger('click');
        await settle();

        expect(wrapper.text()).toContain('Нет транзакций');
        expect(railText(wrapper)).not.toContain(mockAccountResponse.name);
      });

      it('reads the old stored form {type, accountId, categoryId} without crashing', async () => {
        sessionStorage.setItem(
          STORAGE_KEYS.HISTORY_FILTERS,
          JSON.stringify({ type: 'expense', accountId: 'acc-1', categoryId: 'cat-groceries' }),
        );
        server.use(http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])));
        const requests = captureRequests();

        const { wrapper } = await renderPage();

        expect(wrapper.find('[data-testid="history-facet-rail"]').exists()).toBe(true);
        expect(requests.last().searchParams.get('type')).toBe('expense');
        expect(requests.last().searchParams.get('accountIds')).toBe('acc-1');
        expect(requests.last().searchParams.get('categoryIds')).toBe('cat-groceries');
        expect(railText(wrapper)).toContain(mockAccountResponse.name);
        expect(railText(wrapper)).toContain('Продукты');
      });

      it('a broken stored value falls back to the defaults', async () => {
        sessionStorage.setItem(STORAGE_KEYS.HISTORY_FILTERS, '{"type":"exp');
        const requests = captureRequests();

        const { wrapper } = await renderPage();

        expect(wrapper.findComponent({ name: 'UTabs' }).props('modelValue')).toBe('all');
        expect(requests.last().searchParams.has('type')).toBe(false);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Массовая правка
  // -----------------------------------------------------------------------
  describe('bulk edit', () => {
    const lockedTransaction = { ...mockSecondExpenseTransaction, bulkLocked: true };

    /** Лента с фильтром по категории, итог «10, из них 1 вне правки», журнал запросов bulk. */
    function filteredByCategory() {
      sessionStorage.setItem(
        STORAGE_KEYS.HISTORY_FILTERS,
        JSON.stringify({ type: 'all', categoryIds: ['cat-groceries'], tags: [], accountIds: [] }),
      );
      const bulk: Record<string, unknown>[] = [];
      const list: URL[] = [];
      const summary: URL[] = [];
      server.use(
        http.get('*/api/transactions/summary', ({ request }) => {
          summary.push(new URL(request.url));
          return HttpResponse.json({
            count: 10,
            eligibleCount: 9,
            lockedCount: 1,
            totals: [{ currency: 'UZS', amount: -250000 }],
            asOf: '2025-06-15T12:00:00.000Z',
          });
        }),
        http.get('*/api/transactions', ({ request }) => {
          list.push(new URL(request.url));
          return HttpResponse.json({
            data: [mockExpenseTransaction, lockedTransaction],
            nextCursor: null,
            hasMore: false,
          });
        }),
        http.post('*/api/transactions/bulk', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          bulk.push(body);
          return HttpResponse.json({
            changed: 9,
            skipped: [],
            balanceDeltas: [],
            undoToken: body.dryRun ? undefined : 'token-1',
          });
        }),
      );
      return {
        bulk,
        list,
        lastList: () => list[list.length - 1],
        lastSummary: () => summary[summary.length - 1],
      };
    }

    const $ = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);

    async function settle() {
      await nextTick();
      await flushPromises();
      await flushPromises();
    }

    it('плашка: подпись итога и число на кнопке сходятся', async () => {
      filteredByCategory();
      const { wrapper } = await renderPage();

      const dock = wrapper.find('[data-testid="bulk-dock"]');
      expect(dock.text()).toContain('10 операций, 1 не изменится');
      expect(dock.find('[data-testid="bulk-edit-all-btn"]').text()).toBe('Изменить все 9');
    });

    it('открытый поиск без запроса плашку прячет: под ней был бы невидимый фильтр', async () => {
      filteredByCategory();
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="open-search-btn"]').trigger('click');
      await settle();

      expect(wrapper.find('[data-testid="bulk-dock"]').exists()).toBe(false);
    });

    describe('поиск в охвате', () => {
      async function search(wrapper: ReturnType<typeof renderWithProviders>, term: string) {
        await wrapper.find('[data-testid="open-search-btn"]').trigger('click');
        await settle();
        wrapper.findComponent({ name: 'SearchInput' }).vm.$emit('update:modelValue', term);
        // Дебаунс ввода — 300 мс
        await new Promise((resolve) => setTimeout(resolve, 350));
        await settle();
      }

      it('лента, итог и «Изменить все» идут по одному фильтру — запросу поиска', async () => {
        const { bulk, list, lastList, lastSummary } = filteredByCategory();
        const { wrapper } = await renderPage();

        await search(wrapper, 'такси');

        const searched = list.filter((url) => url.searchParams.get('search') === 'такси');
        expect(searched).toHaveLength(1);
        // Поиск, как и раньше, идёт мимо скрытых на время поиска чипов
        expect(lastList().searchParams.has('categoryIds')).toBe(false);
        expect(lastSummary().searchParams.get('search')).toBe('такси');
        expect(lastSummary().searchParams.has('categoryIds')).toBe(false);
        const dock = wrapper.find('[data-testid="bulk-dock"]');
        expect(dock.find('[data-testid="bulk-edit-all-btn"]').text()).toBe('Изменить все 9');

        await dock.find('[data-testid="bulk-edit-all-btn"]').trigger('click');
        await settle();
        expect($('bulk-scope')?.textContent).toContain('Поиск: «такси»');

        $('bulk-verb-category')!.click();
        await settle();
        $('bulk-category-cat-transport')!.click();
        await settle();
        $('bulk-confirm-apply')!.click();
        await settle();

        expect((bulk[1].selection as { filter: unknown }).filter).toEqual({ search: 'такси' });
      });

      it('после правки остаётся в поиске: чипы, которые она переключила бы, сейчас не действуют', async () => {
        const { lastList } = filteredByCategory();
        const { wrapper } = await renderPage();
        await search(wrapper, 'такси');

        await wrapper.find('[data-testid="bulk-edit-all-btn"]').trigger('click');
        await settle();
        $('bulk-verb-category')!.click();
        await settle();
        $('bulk-category-cat-transport')!.click();
        await settle();
        $('bulk-confirm-apply')!.click();
        await settle();

        expect(wrapper.findComponent({ name: 'SearchInput' }).exists()).toBe(true);
        expect(lastList().searchParams.get('search')).toBe('такси');
        expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.HISTORY_FILTERS)!)).toMatchObject({
          categoryIds: ['cat-groceries'],
        });
      });
    });

    it('после переноса в категорию фильтр переключается на неё', async () => {
      const { bulk, lastList } = filteredByCategory();
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="bulk-edit-all-btn"]').trigger('click');
      await settle();
      $('bulk-verb-category')!.click();
      await settle();
      $('bulk-category-cat-transport')!.click();
      await settle();
      $('bulk-confirm-apply')!.click();
      await settle();

      expect(bulk.map((b) => b.dryRun ?? false)).toEqual([true, false]);
      expect(bulk[1]).toMatchObject({
        selection: { filter: { categoryIds: ['cat-groceries'] }, expectedCount: 9 },
        action: { kind: 'category', categoryId: 'cat-transport' },
      });
      expect(lastList().searchParams.get('categoryIds')).toBe('cat-transport');
      expect($('bulk-edit-sheet')).toBeNull();
    });

    it('после переноса меняются только категории: тип, теги и счета остаются', async () => {
      const { lastList } = filteredByCategory();
      sessionStorage.setItem(
        STORAGE_KEYS.HISTORY_FILTERS,
        JSON.stringify({
          type: 'expense',
          categoryIds: ['cat-groceries'],
          tags: ['кафе'],
          accountIds: ['acc-1'],
        }),
      );
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="bulk-edit-all-btn"]').trigger('click');
      await settle();
      $('bulk-verb-category')!.click();
      await settle();
      $('bulk-category-cat-transport')!.click();
      await settle();
      $('bulk-confirm-apply')!.click();
      await settle();

      expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.HISTORY_FILTERS)!)).toMatchObject({
        type: 'expense',
        categoryIds: ['cat-transport'],
        tags: ['кафе'],
        accountIds: ['acc-1'],
      });
      expect(lastList().searchParams.get('type')).toBe('expense');
      expect(lastList().searchParams.get('categoryIds')).toBe('cat-transport');
    });

    it('долгое нажатие включает выбор; строку с замком не отметить', async () => {
      filteredByCategory();
      const { wrapper } = await renderPage();
      const list = wrapper.findComponent({ name: 'VirtualGroupedTransactionList' });
      const rows = list.props('groups').flatMap((g: { transactions: unknown[] }) => g.transactions);
      const plain = rows.find((tx: { id: string }) => tx.id === 'tx-1');
      const locked = rows.find((tx: { id: string }) => tx.id === 'tx-3');

      const barText = () => wrapper.find('[data-testid="bulk-selection-bar"]').text();

      list.vm.$emit('transaction-long-press', plain);
      await settle();
      expect(list.props('selectMode')).toBe(true);
      expect(barText()).toContain('Выбрано 1 из 1');
      // Панель действий встаёт на место нижней навигации
      expect(isBottomNavSuppressed.value).toBe(true);

      list.vm.$emit('transaction-click', locked);
      await settle();
      expect(barText()).toContain('Выбрано 1 из 1');

      // В режиме выбора тап снимает отметку, а не открывает правку
      list.vm.$emit('transaction-click', plain);
      await settle();
      expect(barText()).toContain('Выбрано 0 из 1');
      expect(wrapper.findComponent({ name: 'EditTransactionModal' }).props('modelValue')).toBe(
        false,
      );

      await wrapper.find('[data-testid="bulk-selection-exit"]').trigger('click');
      await settle();
      expect(isBottomNavSuppressed.value).toBe(false);
    });
  });
});
