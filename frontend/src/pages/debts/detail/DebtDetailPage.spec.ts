import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import DebtDetailPage from './DebtDetailPage.vue';
import {
  mockGivenDebtResponse,
  mockTakenDebtResponse,
  mockClosedDebtResponse,
  mockOverdueDebtResponse,
} from '@/test/mocks/handlers/debts';
import { mockAccountResponse } from '@/test/mocks/handlers/accounts';
import { formatCurrency } from '@/shared/lib/format/currency';

// Mock app router — vi.hoisted runs before vi.mock hoisting
const { navigateBackMock } = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
}));
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// PaymentDrawer рендерит настоящую vaul-шторку; закрытие роняет jsdom на чтении
// style отсоединённого узла — см. комментарий в стабе.
vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

// ---------------------------------------------------------------------------

const routes = [
  { path: '/debts/:id', component: DebtDetailPage, name: 'debt-detail' },
  { path: '/debts', component: { template: '<div />' }, name: 'debts-list' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(debtId: string) {
  const router = createTestRouter(routes);
  router.push(`/debts/${debtId}`);
  await router.isReady();

  currentWrapper = renderWithProviders(DebtDetailPage, {
    router,
    provideAuth: { user: mockUser },
  });
  // Allow all queries (debts, accounts) to settle.
  // Two flushes: query fires → response arrives → dependent watchers trigger.
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

// ===========================================================================
describe('DebtDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Reset handlers BEFORE unmount to prevent stale responses during flush
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('shows loading state while debts load', async () => {
      // Block the debts response so loading state stays visible
      let resolveDebts!: () => void;
      server.use(
        http.get('*/api/debts', async () => {
          await new Promise<void>((res) => {
            resolveDebts = res;
          });
          return HttpResponse.json([mockGivenDebtResponse]);
        }),
      );

      const router = createTestRouter(routes);
      router.push(`/debts/${mockGivenDebtResponse.id}`);
      await router.isReady();

      currentWrapper = renderWithProviders(DebtDetailPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();

      expect(currentWrapper.find('[data-testid="debt-loading"]').exists()).toBe(true);

      // Release response and let component settle
      resolveDebts();
      await flushPromises();
      await flushPromises();
    });

    it('shows not found state for nonexistent debt id', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([])));
      const wrapper = await renderPage('nonexistent-id');

      expect(wrapper.find('[data-testid="not-found"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Долг не найден');
    });

    it('shows debt person name in header', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])));
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      expect(wrapper.text()).toContain('Алексей');
    });
  });

  // -----------------------------------------------------------------------
  // Active Debt (given, partially paid)
  // -----------------------------------------------------------------------
  describe('active debt (given, partially paid)', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
    });

    it('shows "Я дал в долг" label', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Я дал в долг');
    });

    it('shows remaining amount', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // remaining_amount = 30000, formatted as UZS
      expect(wrapper.text()).toContain('30');
      expect(wrapper.text()).toContain('Осталось');
    });

    it('shows "Погашено" with paid amount in the progress meter', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // paid = 50000 - 30000 = 20000; the meter replaces the old breakdown card
      const meter = wrapper.find('[data-testid="debt-meter"]');
      expect(meter.exists()).toBe(true);
      expect(meter.text()).toContain('Погашено');
      expect(meter.text()).toContain('20');
    });

    it('does not show a fee row when the debt has no transfer fee', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.find('[data-testid="debt-fee-row"]').exists()).toBe(false);
    });

    it('shows the progress meter at 40%', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // (50000 - 30000) / 50000 = 40%
      const meter = wrapper.find('[data-testid="debt-meter"]');
      expect(meter.text()).toContain('40%');
    });

    it('shows the total debt amount in the progress meter', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      const meter = wrapper.find('[data-testid="debt-meter"]');
      expect(meter.text()).toContain('50');
    });

    it('shows payment button', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      const btn = wrapper.find('[data-testid="payment-btn"]');
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toContain('Внести платёж');
    });

    it('shows delete button inside the "more" menu', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      // Удаление и скрытие суммы живут в меню «···», а не на первом экране
      expect(wrapper.find('[data-testid="delete-debt-btn"]').exists()).toBe(false);

      await wrapper.find('[data-testid="debt-more-btn"]').trigger('click');
      await flushPromises();

      expect(wrapper.find('[data-testid="delete-debt-btn"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Active Debt (taken, full amount)
  // -----------------------------------------------------------------------
  describe('active debt (taken, full amount)', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockTakenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
    });

    it('shows "Я взял в долг" label', async () => {
      const wrapper = await renderPage(mockTakenDebtResponse.id);
      expect(wrapper.text()).toContain('Я взял в долг');
    });

    it('shows full remaining amount', async () => {
      const wrapper = await renderPage(mockTakenDebtResponse.id);
      // remaining_amount = 100000
      expect(wrapper.text()).toContain('100');
      expect(wrapper.text()).toContain('Осталось');
    });

    it('hides the progress meter entirely when there is nothing to break down', async () => {
      const wrapper = await renderPage(mockTakenDebtResponse.id);
      // Нетронутый долг: paid=0, forgiven=0 — метру нечего показывать
      expect(wrapper.find('[data-testid="debt-meter"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('Погашено');
    });

    it('shows due date', async () => {
      const wrapper = await renderPage(mockTakenDebtResponse.id);
      expect(wrapper.text()).toContain('Дата возврата');
    });
  });

  // -----------------------------------------------------------------------
  // Closed Debt
  // -----------------------------------------------------------------------
  describe('closed debt', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockClosedDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
    });

    it('shows "Погашен" badge', async () => {
      const wrapper = await renderPage(mockClosedDebtResponse.id);
      expect(wrapper.text()).toContain('Погашен');
    });

    it('shows "Сумма" instead of "Осталось"', async () => {
      const wrapper = await renderPage(mockClosedDebtResponse.id);
      expect(wrapper.text()).toContain('Сумма');
      expect(wrapper.text()).not.toContain('Осталось');
    });

    it('does NOT show payment button', async () => {
      const wrapper = await renderPage(mockClosedDebtResponse.id);
      expect(wrapper.find('[data-testid="payment-btn"]').exists()).toBe(false);
    });

    it('shows "Удалить долг" button at bottom', async () => {
      const wrapper = await renderPage(mockClosedDebtResponse.id);
      // У закрытого долга нечего платить — удаление вынесено прямо на страницу,
      // а не спрятано в меню «···»
      expect(wrapper.find('[data-testid="debt-more-btn"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="delete-debt-btn"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Удалить долг');
    });

    it('hides the meter when the debt was simply paid in full', async () => {
      const wrapper = await renderPage(mockClosedDebtResponse.id);
      // remaining=0, forgiven=0 → сплошная полоса и подпись, дословно
      // повторяющая «Сумма долга» из заголовка: показывать нечего
      expect(wrapper.find('[data-testid="debt-meter"]').exists()).toBe(false);
      // The old UProgressBar component is fully replaced by DebtProgressMeter
      const progressBars = wrapper.findAllComponents({ name: 'UProgressBar' });
      expect(progressBars.length).toBe(0);
    });

    it('shows the meter when part of a closed debt was forgiven', async () => {
      // Часть отдали, часть простили — способ закрытия долга виден только здесь
      server.use(
        http.get('*/api/debts', () =>
          HttpResponse.json([
            { ...mockClosedDebtResponse, forgivenAmount: 5000, remainingAmount: 0 },
          ]),
        ),
      );

      const wrapper = await renderPage(mockClosedDebtResponse.id);
      const meter = wrapper.find('[data-testid="debt-meter"]');

      expect(meter.exists()).toBe(true);
      expect(meter.text()).toContain('прощено');
      expect(meter.find('[data-segment="forgiven"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Overdue Debt
  // -----------------------------------------------------------------------
  describe('overdue debt', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockOverdueDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
    });

    it('shows the "Просрочено" badge in the hero', async () => {
      const wrapper = await renderPage(mockOverdueDebtResponse.id);
      expect(wrapper.find('[data-testid="debt-hero"]').text()).toContain('Просрочено');
    });
  });

  // -----------------------------------------------------------------------
  // Debt Details Card
  // -----------------------------------------------------------------------
  describe('debt details card', () => {
    it('shows original amount in the creation timeline node', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // «Дата создания» больше не отдельная строка — сумма и дата создания
      // теперь только в первом узле тайм-лайна
      expect(wrapper.text()).toContain('Долг создан');
      // totalAmount = 50000
      expect(wrapper.text()).toContain('50');
    });

    it('shows currency embedded in the amount (no separate "Валюта" row)', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      const heroAmount = wrapper.find('[data-testid="debt-hero-amount"]');
      expect(heroAmount.text()).toBe(
        formatCurrency(mockGivenDebtResponse.remainingAmount, mockGivenDebtResponse.currency),
      );
      expect(wrapper.text()).not.toContain('Валюта');
    });

    it('shows linked account name when present', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // mockGivenDebtResponse.accountId = 'acc-1', mockAccountResponse.name = 'Основной'
      expect(wrapper.text()).toContain('Счёт');
      expect(wrapper.text()).toContain('Основной');
    });

    it('shows created date in the timeline instead of a separate "Дата создания" row', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Долг создан');
      expect(wrapper.text()).not.toContain('Дата создания');
    });
  });

  // -----------------------------------------------------------------------
  // Debt Without Linked Account
  // -----------------------------------------------------------------------
  describe('debt without linked account', () => {
    it('hides the meta card entirely when there is nothing left to show', async () => {
      const debtWithoutAccount = {
        ...mockGivenDebtResponse,
        id: 'debt-no-acc',
        accountId: null,
      };
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([debtWithoutAccount])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage('debt-no-acc');

      // mockGivenDebtResponse has nextPaymentDate: null too, so the meta card
      // (Дата возврата + Счёт) has nothing left to render at all
      expect(wrapper.text()).not.toContain('Счёт');
      // "Основной" account name should NOT appear since accountId is null
      expect(wrapper.text()).not.toContain('Основной');
      expect(wrapper.find('[data-testid="debt-hero"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Debt Without Due Date
  // -----------------------------------------------------------------------
  describe('debt without due date', () => {
    it('hides due date row when no next_payment_date', async () => {
      // mockGivenDebtResponse has nextPaymentDate: null
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      expect(wrapper.text()).not.toContain('Дата возврата');
    });
  });

  // -----------------------------------------------------------------------
  // Delete Flow
  // -----------------------------------------------------------------------
  describe('delete flow', () => {
    it('clicking delete button shows delete modal', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      await wrapper.find('[data-testid="debt-more-btn"]').trigger('click');
      await flushPromises();

      const deleteBtn = wrapper.find('[data-testid="delete-debt-btn"]');
      expect(deleteBtn.exists()).toBe(true);

      await deleteBtn.trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'DeleteDebtModal' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);
    });

    it('confirming delete sends DELETE /api/debts/:id and navigates to debts-list', async () => {
      let deletedUrl = '';
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
        http.delete('*/api/debts/:id', ({ request }) => {
          deletedUrl = request.url;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const router = createTestRouter(routes);
      router.push(`/debts/${mockGivenDebtResponse.id}`);
      await router.isReady();

      currentWrapper = renderWithProviders(DebtDetailPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();
      await flushPromises();

      // Open the "···" menu, then the delete modal from it
      await currentWrapper.find('[data-testid="debt-more-btn"]').trigger('click');
      await flushPromises();
      const deleteBtn = currentWrapper.find('[data-testid="delete-debt-btn"]');
      await deleteBtn.trigger('click');
      await flushPromises();

      // Confirm deletion via modal emit
      const modal = currentWrapper.findComponent({ name: 'DeleteDebtModal' });
      modal.vm.$emit('confirm');
      await flushPromises();
      await flushPromises();

      expect(deletedUrl).toContain(`/api/debts/${mockGivenDebtResponse.id}`);
      expect(router.currentRoute.value.name).toBe('debts-list');
    });

    it('closed debt bottom delete button opens modal', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockClosedDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockClosedDebtResponse.id);

      // У закрытого долга удаление стоит прямо на странице, без меню «···»
      const deleteBtn = wrapper.find('[data-testid="delete-debt-btn"]');
      expect(deleteBtn.exists()).toBe(true);
      expect(deleteBtn.text()).toContain('Удалить долг');

      await deleteBtn.trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'DeleteDebtModal' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Payment Button
  // -----------------------------------------------------------------------
  describe('payment button', () => {
    it('clicking payment button shows the payment drawer', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      const paymentBtn = wrapper.find('[data-testid="payment-btn"]');
      expect(paymentBtn.exists()).toBe(true);

      await paymentBtn.trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'PaymentDrawer' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Payment Confirm Flow
  // -----------------------------------------------------------------------
  describe('payment confirm flow', () => {
    it('processes partial payment and stays on page when debt not fully closed', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
        // GET /api/debts/:id — re-fetch for fresh data
        http.get('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'tx-payment-1',
            userId: 'test-user-1',
            accountId: body.accountId,
            categoryId: body.categoryId,
            amount: body.amount,
            currency: body.currency,
            type: body.type,
            description: body.description,
            date: body.date,
            createdAt: new Date().toISOString(),
            isDebtRelated: body.isDebtRelated,
            debtId: body.debtId,
            toAccountId: null,
            toAmount: null,
            toCurrency: null,
            returnedAmount: 0,
            netAmount: body.amount,
            hasDebtReturns: false,
          });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockGivenDebtResponse,
            id: params.id,
            ...body,
          });
        }),
      );

      const router = createTestRouter(routes);
      router.push(`/debts/${mockGivenDebtResponse.id}`);
      await router.isReady();

      currentWrapper = renderWithProviders(DebtDetailPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();
      await flushPromises();

      // Open payment drawer
      await currentWrapper.find('[data-testid="payment-btn"]').trigger('click');
      await flushPromises();

      // Emit partial payment (10000 < 30000 remaining, so debt stays open)
      const modal = currentWrapper.findComponent({ name: 'PaymentDrawer' });
      modal.vm.$emit('confirm', { amount: 10000, accountId: 'acc-1' });
      await flushPromises();
      await flushPromises();

      // Should stay on detail page since debt not fully closed
      expect(router.currentRoute.value.name).toBe('debt-detail');
    });

    it('navigates to debts list when payment fully closes the debt', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
        http.get('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'tx-payment-close',
            userId: 'test-user-1',
            accountId: body.accountId,
            categoryId: body.categoryId,
            amount: body.amount,
            currency: body.currency,
            type: body.type,
            description: body.description,
            date: body.date,
            createdAt: new Date().toISOString(),
            isDebtRelated: body.isDebtRelated,
            debtId: body.debtId,
            toAccountId: null,
            toAmount: null,
            toCurrency: null,
            returnedAmount: 0,
            netAmount: body.amount,
            hasDebtReturns: false,
          });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockGivenDebtResponse,
            id: params.id,
            ...body,
          });
        }),
      );

      const router = createTestRouter(routes);
      router.push(`/debts/${mockGivenDebtResponse.id}`);
      await router.isReady();

      currentWrapper = renderWithProviders(DebtDetailPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();
      await flushPromises();

      // Open payment drawer
      await currentWrapper.find('[data-testid="payment-btn"]').trigger('click');
      await flushPromises();

      // Emit full payment (30000 >= 30000 remaining, so debt closes)
      const modal = currentWrapper.findComponent({ name: 'PaymentDrawer' });
      modal.vm.$emit('confirm', { amount: 30000, accountId: 'acc-1' });
      await flushPromises();
      await flushPromises();

      // Should navigate to debts list since debt is fully closed
      expect(router.currentRoute.value.name).toBe('debts-list');
    });

    it('navigates to debts list when debt is forgiven (forgiveRemainder)', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
        http.get('*/api/debts/:id', () => HttpResponse.json(mockGivenDebtResponse)),
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 'tx-forgive-1',
            userId: 'test-user-1',
            accountId: body.accountId,
            categoryId: body.categoryId,
            amount: body.amount,
            currency: body.currency,
            type: body.type,
            description: body.description,
            date: body.date,
            createdAt: new Date().toISOString(),
            isDebtRelated: body.isDebtRelated ?? false,
            debtId: body.debtId ?? null,
            toAccountId: null,
            toAmount: null,
            toCurrency: null,
            returnedAmount: 0,
            netAmount: body.amount,
            hasDebtReturns: false,
          });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockGivenDebtResponse,
            id: params.id,
            ...body,
          });
        }),
      );

      const router = createTestRouter(routes);
      router.push(`/debts/${mockGivenDebtResponse.id}`);
      await router.isReady();

      currentWrapper = renderWithProviders(DebtDetailPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();
      await flushPromises();

      // Open payment drawer
      await currentWrapper.find('[data-testid="payment-btn"]').trigger('click');
      await flushPromises();

      // Emit forgive: amount=0, forgiveRemainder=true
      const modal = currentWrapper.findComponent({ name: 'PaymentDrawer' });
      modal.vm.$emit('confirm', { amount: 0, accountId: 'acc-1', forgiveRemainder: true });
      await flushPromises();
      await flushPromises();

      // Should navigate to debts list since forgiveRemainder closes the debt
      expect(router.currentRoute.value.name).toBe('debts-list');
    });
  });

  // -----------------------------------------------------------------------
  // Back Button
  // -----------------------------------------------------------------------
  describe('back button', () => {
    it('calls navigateBack when back button is clicked', async () => {
      server.use(http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])));
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      const header = wrapper.findComponent({ name: 'AppHeader' });
      expect(header.exists()).toBe(true);
      header.vm.$emit('back');
      await flushPromises();

      expect(navigateBackMock).toHaveBeenCalled();
    });
  });
});
