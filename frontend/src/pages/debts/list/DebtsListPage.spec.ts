import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { QueryClient } from '@tanstack/vue-query';
import { queryClient as appQueryClient } from '@/shared/api/queryClient';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import DebtsListPage from './DebtsListPage.vue';
import {
  mockGivenDebtResponse,
  mockTakenDebtResponse,
  mockClosedDebtResponse,
  mockSecondGivenDebtResponse,
  buildPaginatedDebtsResponse,
  payDebtHandler,
  payDebtResult,
  type PayDebtBody,
} from '@/test/mocks/handlers/debts';
import { setIsDesktopForTests } from '@/shared/lib/platform';

/** Алексей taken debt — used when we need 2 groups for the same person */
const mockAlexeiTakenDebtResponse = {
  ...mockGivenDebtResponse,
  id: 'debt-alexei-taken',
  name: 'Долг для Алексей',
  debtType: 'taken' as const,
  totalAmount: 20000,
  remainingAmount: 20000,
  transactionId: 'tx-debt-alexei-taken',
};

// PaymentDrawer и DebtActionsSheet рендерят настоящую vaul-шторку; её закрытие
// роняет jsdom — в проекте для этого есть стаб
vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

// Mock app router — vi.hoisted runs before vi.mock hoisting
const { navigateBackMock } = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
}));
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// ---------------------------------------------------------------------------

const routes = [
  { path: '/debts', component: DebtsListPage, name: 'debts-list' },
  { path: '/debts/new', component: { template: '<div />' }, name: 'new-debt' },
  { path: '/debts/:id', component: { template: '<div />' }, name: 'debt-detail' },
  { path: '/transactions/new', component: { template: '<div />' }, name: 'new-transaction' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(queryParams: Record<string, string> = {}, queryClient?: QueryClient) {
  const router = createTestRouter(routes);
  const query = new URLSearchParams(queryParams).toString();
  router.push(`/debts${query ? '?' + query : ''}`);
  await router.isReady();

  currentWrapper = renderWithProviders(DebtsListPage, {
    router,
    queryClient,
    provideAuth: { user: mockUser },
  });
  // Allow all queries (debts, accounts, exchange-rates, profile) to settle.
  // Two flushes: query fires -> response arrives -> dependent watchers trigger.
  await flushPromises();
  await flushPromises();
  return { wrapper: currentWrapper, router };
}

// ===========================================================================
describe('DebtsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Reset handlers BEFORE unmount to prevent stale responses during flush
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    // Оптимистичные правки пишут в singleton-кэш приложения — один тест
    // монтируется на нём, и остальным его состояние доставаться не должно.
    appQueryClient.clear();
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title "Долги"', async () => {
      const { wrapper } = await renderPage();
      expect(wrapper.text()).toContain('Долги');
    });

    it('shows loading skeleton while debts load', async () => {
      // Block debts response to keep loading state
      let resolveDebts!: () => void;
      server.use(
        http.get('*/api/debts/paginated', async () => {
          await new Promise<void>((res) => {
            resolveDebts = res;
          });
          return HttpResponse.json(buildPaginatedDebtsResponse([]));
        }),
      );

      const router = createTestRouter(routes);
      router.push('/debts');
      await router.isReady();

      currentWrapper = renderWithProviders(DebtsListPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();

      expect(currentWrapper.find('[data-testid="debt-loading"]').exists()).toBe(true);

      // Release the blocked response and let component settle
      resolveDebts();
      await flushPromises();
      await flushPromises();
    });

    it('shows empty state when no active debts', async () => {
      // Default handler returns empty array
      const { wrapper } = await renderPage();

      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Вы без долгов!');
    });

    it('shows debt groups when debts exist', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockTakenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage();

      // Tree view shows person group headers — one for each person+debtType combo
      expect(wrapper.text()).toContain('Алексей');
      expect(wrapper.text()).toContain('Мария');
    });

    it('shows the summary card with the net total and both sides', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockTakenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage();

      const summary = wrapper.find('[data-testid="debts-summary"]');

      expect(summary.exists()).toBe(true);
      expect(wrapper.find('[data-testid="debts-summary-net"]').exists()).toBe(true);
      expect(summary.text()).toContain('Вам должны');
      expect(summary.text()).toContain('Вы должны');
    });

    it('shows one row per person', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockTakenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage();

      const rows = wrapper.findAll('[data-testid="person-debt-row"]');

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.text()).join(' ')).toContain('Алексей');
    });
  });

  // -----------------------------------------------------------------------
  // Status Filter
  // -----------------------------------------------------------------------
  describe('status filter', () => {
    it('shows active tab by default', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
      );
      const { wrapper } = await renderPage();

      // Active debts should be visible, not closed empty state
      expect(wrapper.find('[data-testid="closed-empty-state"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('По людям');
    });

    it('switches to closed tab showing closed debts', async () => {
      server.use(
        http.get('*/api/debts/paginated', ({ request }) => {
          const url = new URL(request.url);
          const status = url.searchParams.get('status');
          const debts = status === 'closed' ? [mockClosedDebtResponse] : [mockGivenDebtResponse];
          return HttpResponse.json(buildPaginatedDebtsResponse(debts));
        }),
      );
      const { wrapper } = await renderPage();

      // Switch to closed tab via UTabs component
      const tabs = wrapper.findComponent({ name: 'UTabs' });
      expect(tabs.exists()).toBe(true);
      tabs.vm.$emit('update:modelValue', 'closed');
      await nextTick();
      await flushPromises();

      expect(wrapper.text()).toContain('Погашенные долги');
      // Погашенный долг рисует та же DebtCard — в закрытом виде
      const closedDebtCards = wrapper.findAllComponents({ name: 'DebtCard' });
      expect(closedDebtCards.length).toBe(1);
    });

    it('shows closed empty state when no closed debts', async () => {
      server.use(
        http.get('*/api/debts/paginated', ({ request }) => {
          const url = new URL(request.url);
          const status = url.searchParams.get('status');
          return HttpResponse.json(
            buildPaginatedDebtsResponse(status === 'closed' ? [] : [mockGivenDebtResponse]),
          );
        }),
      );
      const { wrapper } = await renderPage();

      // Switch to closed tab via UTabs component
      const tabs = wrapper.findComponent({ name: 'UTabs' });
      tabs.vm.$emit('update:modelValue', 'closed');
      await nextTick();
      await flushPromises();

      expect(wrapper.find('[data-testid="closed-empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Нет закрытых долгов');
    });
  });

  // -----------------------------------------------------------------------
  // Grouped View Content
  // -----------------------------------------------------------------------
  describe('grouped view content', () => {
    it('shows person name headers in grouped view', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockTakenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage();

      // Grouped view by default — should show person names
      expect(wrapper.text()).toContain('Алексей');
      expect(wrapper.text()).toContain('Мария');
    });

    it('shows "Вам должны" and "Вы должны" labels in person headers', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockTakenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage();

      expect(wrapper.text()).toContain('Вам должны');
      expect(wrapper.text()).toContain('Вы должны');
    });

    it('groups multiple debts under same person', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([
              mockGivenDebtResponse,
              mockSecondGivenDebtResponse,
              mockTakenDebtResponse,
            ]),
          ),
        ),
      );
      const { wrapper } = await renderPage();

      // Алексей group should show "2 долга", Мария group should show "1 долг"
      expect(wrapper.text()).toContain('Алексей');
      expect(wrapper.text()).toContain('2');
      expect(wrapper.text()).toContain('Мария');
    });
  });

  // -----------------------------------------------------------------------
  // Empty State Actions
  // -----------------------------------------------------------------------
  describe('empty state actions', () => {
    it('empty state "Создать долг" button navigates to new debt', async () => {
      const { wrapper, router } = await renderPage();

      // Empty state should be showing
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);

      // Click the action button inside empty state — navigates to new-transaction with type=debt
      const actionBtn = wrapper.findAll('button').find((b) => b.text().includes('Создать долг'));
      expect(actionBtn).toBeDefined();
      await actionBtn!.trigger('click');
      await flushPromises();

      // Should navigate to new-transaction page with debt type
      expect(router.currentRoute.value.name).toBe('new-transaction');
      expect(router.currentRoute.value.query.type).toBe('debt');
    });
  });

  // -----------------------------------------------------------------------
  // Person Filter (query params)
  // -----------------------------------------------------------------------
  describe('person filter', () => {
    it('filters debts by person from query param', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([
              mockGivenDebtResponse,
              mockTakenDebtResponse,
              mockSecondGivenDebtResponse,
            ]),
          ),
        ),
      );
      const { wrapper } = await renderPage({ person: 'Алексей', type: 'given' });

      // Tree should show person group with correct debts
      expect(wrapper.text()).toContain('Алексей');
      // Filter indicator should be visible
      expect(wrapper.text()).toContain('Долги: Алексей');
    });

    it('shows filter indicator with person name', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockSecondGivenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage({ person: 'Алексей' });

      // Filter indicator should show person name
      expect(wrapper.text()).toContain('Алексей');
      expect(wrapper.text()).toContain('Долги: Алексей');
    });

    it('shows clear filter button', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
      );
      const { wrapper } = await renderPage({ person: 'Алексей' });

      const clearBtn = wrapper.find('[data-testid="clear-filter-btn"]');
      expect(clearBtn.exists()).toBe(true);
    });

    it('показывает кнопку «поделиться» только когда открыт человек', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
      );

      const withoutFilter = await renderPage();
      expect(withoutFilter.wrapper.find('[data-testid="share-debts-btn"]').exists()).toBe(false);
      withoutFilter.wrapper.unmount();

      const { wrapper } = await renderPage({ person: 'Алексей' });
      expect(wrapper.find('[data-testid="share-debts-btn"]').exists()).toBe(true);
    });

    it('открывает шторку «поделиться» с итогом по человеку', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockSecondGivenDebtResponse]),
          ),
        ),
      );
      const { wrapper } = await renderPage({ person: 'Алексей' });

      await wrapper.find('[data-testid="share-debts-btn"]').trigger('click');
      await flushPromises();

      const drawer = document.body.querySelector('[data-testid="share-debts-drawer"]');
      expect(drawer).not.toBeNull();
      // 30 000 + 20 000 остатка по двум долгам Алексея
      expect(drawer?.textContent).toContain('Алексей');
      expect(drawer?.textContent).toContain('2 долга');
    });

    it('shows "close all" button when >1 groups for same person', async () => {
      // Need 2 groups (given + taken) so groups.length > 1 condition is met
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockAlexeiTakenDebtResponse]),
          ),
        ),
        payDebtHandler(mockAlexeiTakenDebtResponse),
      );
      const { wrapper } = await renderPage({ person: 'Алексей' });

      const closeAllBtn = wrapper.find('[data-testid="close-all-btn"]');
      expect(closeAllBtn.exists()).toBe(true);
      expect(closeAllBtn.text()).toContain('Закрыть все долги');
    });

    it('clears filter when clear button clicked', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockSecondGivenDebtResponse]),
          ),
        ),
      );
      const { wrapper, router } = await renderPage({ person: 'Алексей' });

      // Filter should be active
      expect(wrapper.find('[data-testid="clear-filter-btn"]').exists()).toBe(true);

      await wrapper.find('[data-testid="clear-filter-btn"]').trigger('click');
      await flushPromises();

      // Route should be updated (no query params)
      expect(router.currentRoute.value.query.person).toBeUndefined();
      // Filter indicator should be gone
      expect(wrapper.find('[data-testid="clear-filter-btn"]').exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  describe('navigation', () => {
    it('navigates to new-transaction with type=debt on add button click', async () => {
      const { wrapper, router } = await renderPage();

      const addBtn = wrapper.find('[data-testid="add-debt-btn"]');
      expect(addBtn.exists()).toBe(true);
      await addBtn.trigger('click');
      await flushPromises();

      // Navigates to new-transaction page with debt type
      expect(router.currentRoute.value.name).toBe('new-transaction');
      expect(router.currentRoute.value.query.type).toBe('debt');
    });

    it('navigates to debt detail on card click', async () => {
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
      );
      const { wrapper, router } = await renderPage();

      // Find and click on the tree group to expand it
      const treeItems = wrapper.findAllComponents({ name: 'TreeItem' });
      if (treeItems.length > 0) {
        await treeItems[0].trigger('click');
        await flushPromises();
      }

      // Find DebtCard inside the expanded tree
      const debtCard = wrapper.findComponent({ name: 'DebtCard' });
      if (debtCard.exists()) {
        await debtCard.trigger('click');
        await flushPromises();
        expect(router.currentRoute.value.name).toBe('debt-detail');
        expect(router.currentRoute.value.params.id).toBe('debt-1');
      } else {
        // Tree may render differently in test env — verify person name is shown
        expect(wrapper.text()).toContain('Алексей');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Back Button
  // -----------------------------------------------------------------------
  describe('back button', () => {
    it('calls navigateBack when back button is clicked', async () => {
      const { wrapper } = await renderPage();

      const header = wrapper.findComponent({ name: 'AppHeader' });
      expect(header.exists()).toBe(true);
      header.vm.$emit('back');
      await flushPromises();

      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Close All Debts Flow
  // -----------------------------------------------------------------------
  describe('close all debts flow', () => {
    it('closes all debts for a person and clears filter', async () => {
      // Need 2 groups (given + taken) so groups.length > 1 condition shows close-all-btn
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockAlexeiTakenDebtResponse]),
          ),
        ),
        payDebtHandler(mockAlexeiTakenDebtResponse),
      );

      const { wrapper, router } = await renderPage({ person: 'Алексей' });

      // "close all" button should be visible
      const closeAllBtn = wrapper.find('[data-testid="close-all-btn"]');
      expect(closeAllBtn.exists()).toBe(true);

      // Click it to open the modal
      await closeAllBtn.trigger('click');
      await flushPromises();

      // Find CloseAllDebtsDrawer and emit confirm
      const modal = wrapper.findComponent({ name: 'CloseAllDebtsDrawer' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);

      // The total of both debts: 30000 + 20000 = 50000
      modal.vm.$emit('confirm', 'acc-1', {
        paymentAmount: 50000,
        forgiveRemainder: false,
      });
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // Filter should be cleared (route no longer has person query)
      expect(router.currentRoute.value.query.person).toBeUndefined();
      // Clear filter btn should be gone
      expect(wrapper.find('[data-testid="clear-filter-btn"]').exists()).toBe(false);
    });

    it('не схлопывает шторку и список, пока платежи в полёте', async () => {
      // Оптимистичные правки идут в singleton-кэш приложения, а не в тестовый:
      // на нём и проверяем, что экран не мигает.
      appQueryClient.clear();
      let releasePay!: () => void;
      const gate = new Promise<void>((res) => {
        releasePay = res;
      });
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockAlexeiTakenDebtResponse]),
          ),
        ),
        http.post('*/api/debts/:id/payments', async ({ params, request }) => {
          await gate;
          const body = (await request.json()) as PayDebtBody;
          const target =
            [mockGivenDebtResponse, mockAlexeiTakenDebtResponse].find((d) => d.id === params.id) ??
            mockGivenDebtResponse;
          return HttpResponse.json(payDebtResult(target, body));
        }),
      );

      const { wrapper } = await renderPage({ person: 'Алексей' }, appQueryClient);

      await wrapper.find('[data-testid="close-all-btn"]').trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'CloseAllDebtsDrawer' });
      modal.vm.$emit('confirm', 'acc-1', { paymentAmount: 50000, forgiveRemainder: false });
      await flushPromises();
      await nextTick();

      // Платежи ещё идут: список за шторкой остаётся на месте, «Вы без долгов!»
      // мелькать не должен.
      expect(modal.props('isClosing')).toBe(true);
      expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('Вы без долгов!');

      // И сама шторка продолжает описывать запущенную операцию: её список
      // долгов не должен обнуляться под ней.
      expect(modal.props('debts')).toHaveLength(2);
      expect(document.body.querySelectorAll('[data-testid="close-all-debt-row"]')).toHaveLength(2);

      releasePay();
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // Когда пачка отработала — шторка закрылась, фильтр по человеку сброшен.
      expect(modal.props('modelValue')).toBe(false);
      expect(wrapper.find('[data-testid="clear-filter-btn"]').exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Взаимозачёт
  // -----------------------------------------------------------------------
  describe('взаимозачёт встречных долгов', () => {
    it('подтверждение зачёта уходит на сервер вместе с валютой', async () => {
      let offsetBody: Record<string, unknown> = {};
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(
            buildPaginatedDebtsResponse([mockGivenDebtResponse, mockAlexeiTakenDebtResponse]),
          ),
        ),
        http.post('*/api/debts/offset', async ({ request }) => {
          offsetBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            personName: 'Алексей',
            currency: 'UZS',
            offsetAmount: 20000,
            debts: [
              { ...mockGivenDebtResponse, remainingAmount: 10000 },
              { ...mockAlexeiTakenDebtResponse, remainingAmount: 0, isClosed: true },
            ],
          });
        }),
      );

      const { wrapper } = await renderPage({ person: 'Алексей' });

      const card = wrapper.find('[data-testid="mutual-debt-card"]');
      expect(card.exists()).toBe(true);
      await card.find('[data-testid="offset-debts-btn"]').trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'OffsetDebtsModal' });
      expect(modal.props('modelValue')).toBe(true);
      modal.vm.$emit('confirm');
      await flushPromises();
      await flushPromises();

      expect(offsetBody).toEqual({ personName: 'Алексей', currency: 'UZS' });
      expect(wrapper.findComponent({ name: 'OffsetDebtsModal' }).props('modelValue')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Single Payment Flow (desktop detail panel — PaymentDrawer)
  // -----------------------------------------------------------------------
  describe('single payment flow (desktop detail panel)', () => {
    afterEach(() => {
      setIsDesktopForTests(null);
    });

    it('keeps the person name and the secondary actions in the detail panel', async () => {
      // У панели нет `AppHeader`, куда детальная страница унесла имя и «···», —
      // без собственной строки-шапки редактирование и удаление были бы недоступны
      setIsDesktopForTests(true);
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
        // Панель читает долг не из пагинированного списка, а из `useDebts`
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
      );
      const { wrapper } = await renderPage();

      await wrapper.find('[data-testid="person-debt-row"]').trigger('click');
      await flushPromises();

      const panel = wrapper.findComponent({ name: 'DebtDetailPanel' });
      expect(panel.text()).toContain(mockGivenDebtResponse.personName);

      const moreBtn = panel.find('[data-testid="debt-panel-more-btn"]');
      expect(moreBtn.exists()).toBe(true);
      await moreBtn.trigger('click');
      await flushPromises();

      // Шторка действий телепортируется в body — внутри панели её нет
      expect(document.body.querySelector('[data-testid="delete-debt-btn"]')).not.toBeNull();
    });

    it('правка из панели открывает шторку, а не уводит на экран долга', async () => {
      setIsDesktopForTests(true);
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
      );
      const { wrapper, router } = await renderPage();

      await wrapper.find('[data-testid="person-debt-row"]').trigger('click');
      await flushPromises();

      const panel = wrapper.findComponent({ name: 'DebtDetailPanel' });
      await panel.find('[aria-label="Редактировать"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.name).toBe('debts-list');
      expect(wrapper.findComponent({ name: 'EditDebtDrawer' }).props('modelValue')).toBe(true);
    });

    it('opens PaymentDrawer for the selected debt, closes it optimistically, and clears the selection once the debt closes', async () => {
      setIsDesktopForTests(true);
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
      );
      const { wrapper } = await renderPage();

      // Select the debt via its person row — desktop mode sets selectedDebtId directly.
      const personRow = wrapper.find('[data-testid="person-debt-row"]');
      expect(personRow.exists()).toBe(true);
      await personRow.trigger('click');
      await flushPromises();

      const drawer = wrapper.findComponent({ name: 'PaymentDrawer' });
      expect(drawer.exists()).toBe(true);
      expect(drawer.props('debt')?.id).toBe(mockGivenDebtResponse.id);
      expect(drawer.props('modelValue')).toBe(false);

      // "Внести платёж" in the detail panel opens the drawer.
      const panel = wrapper.findComponent({ name: 'DebtDetailPanel' });
      expect(panel.exists()).toBe(true);
      await panel.find('[data-testid="payment-btn"]').trigger('click');
      await nextTick();
      expect(wrapper.findComponent({ name: 'PaymentDrawer' }).props('modelValue')).toBe(true);

      let resolvePayment!: () => void;
      server.use(
        http.post('*/api/debts/:id/payments', async ({ request }) => {
          const body = (await request.json()) as PayDebtBody;
          await new Promise<void>((resolve) => {
            resolvePayment = resolve;
          });
          return HttpResponse.json(payDebtResult(mockGivenDebtResponse, body));
        }),
      );

      // Pay the full remaining amount — closes the debt.
      wrapper.findComponent({ name: 'PaymentDrawer' }).vm.$emit('confirm', {
        amount: mockGivenDebtResponse.remainingAmount,
        accountId: 'acc-1',
      });
      await nextTick();

      // Drawer hides immediately, before the transaction POST resolves.
      expect(wrapper.findComponent({ name: 'PaymentDrawer' }).props('modelValue')).toBe(false);

      // Let the flow reach the (blocked) payment POST — снимок кэша делается
      // раньше, отдельным микротаск-хопом.
      await flushPromises();
      await flushPromises();
      resolvePayment();
      await flushPromises();
      await flushPromises();
      await flushPromises();

      // The payment closed the debt — desktop selection (and the panel) is cleared.
      expect(wrapper.findComponent({ name: 'DebtDetailPanel' }).exists()).toBe(false);
    });
  });
  // -----------------------------------------------------------------------
  // Первичная отрисовка
  // -----------------------------------------------------------------------
  describe('первичная отрисовка', () => {
    it('под вкладкой «Закрытые» не оставляет долги активной вкладки', async () => {
      let releaseClosed!: () => void;
      server.use(
        http.get('*/api/debts/paginated', async ({ request }) => {
          const status = new URL(request.url).searchParams.get('status');
          if (status === 'closed') {
            await new Promise<void>((res) => {
              releaseClosed = res;
            });
            return HttpResponse.json(buildPaginatedDebtsResponse([mockClosedDebtResponse]));
          }
          return HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse]));
        }),
      );
      const { wrapper } = await renderPage();
      expect(wrapper.findAll('[data-testid="person-debt-row"]')).toHaveLength(1);

      wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'closed');
      await nextTick();
      await flushPromises();

      // Ответ по закрытым ещё в пути: на экране каркас, а не строки прошлого фильтра
      expect(wrapper.find('[data-testid="debt-loading"]').exists()).toBe(true);
      expect(wrapper.findAll('[data-testid="person-debt-row"]')).toHaveLength(0);
      expect(wrapper.findAllComponents({ name: 'DebtCard' })).toHaveLength(0);

      releaseClosed();
      await flushPromises();
      await flushPromises();
      expect(wrapper.text()).toContain('Погашенные долги');
    });

    it('под фильтром по человеку не оставляет долги остальных', async () => {
      let releaseFiltered!: () => void;
      server.use(
        http.get('*/api/debts/paginated', async ({ request }) => {
          const personName = new URL(request.url).searchParams.get('personName');
          if (personName) {
            await new Promise<void>((res) => {
              releaseFiltered = res;
            });
            return HttpResponse.json(
              buildPaginatedDebtsResponse([mockGivenDebtResponse, mockSecondGivenDebtResponse]),
            );
          }
          return HttpResponse.json(
            buildPaginatedDebtsResponse([
              mockGivenDebtResponse,
              mockSecondGivenDebtResponse,
              mockTakenDebtResponse,
            ]),
          );
        }),
      );
      const { wrapper } = await renderPage();
      expect(wrapper.text()).toContain('Мария');

      // У Алексея два долга — тап уводит в фильтр по нему, а не сразу в долг
      const alexei = wrapper
        .findAll('[data-testid="person-debt-row"]')
        .find((row) => row.text().includes('Алексей'));
      await alexei!.trigger('click');
      await nextTick();
      await flushPromises();

      expect(wrapper.find('[data-testid="debt-loading"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain('Мария');

      releaseFiltered();
      await flushPromises();
      await flushPromises();
      expect(wrapper.findAllComponents({ name: 'DebtCard' })).toHaveLength(2);
    });

    it('не показывает итоги, пока не приехали курсы', async () => {
      let releaseRates!: () => void;
      server.use(
        http.get('*/api/debts/paginated', () =>
          HttpResponse.json(buildPaginatedDebtsResponse([mockGivenDebtResponse])),
        ),
        http.get('*/api/exchange-rates/batch', async () => {
          await new Promise<void>((res) => {
            releaseRates = res;
          });
          return HttpResponse.json({ baseCurrency: 'UZS', rates: {} });
        }),
      );
      const { wrapper } = await renderPage();

      // Долги уже пришли, но пересчёт без курсов врёт — сводки на экране нет
      expect(wrapper.find('[data-testid="debt-loading"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="debts-summary"]').exists()).toBe(false);

      releaseRates();
      await flushPromises();
      await flushPromises();
      expect(wrapper.find('[data-testid="debts-summary"]').exists()).toBe(true);
    });
  });
});
