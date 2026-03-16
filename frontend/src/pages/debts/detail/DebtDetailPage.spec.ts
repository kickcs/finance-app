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

    it('shows "Уже выплачено" with paid amount', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // paid = 50000 - 30000 = 20000
      expect(wrapper.text()).toContain('Уже выплачено');
      expect(wrapper.text()).toContain('20');
    });

    it('shows progress bar with 40%', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      // (50000 - 30000) / 50000 = 40%
      expect(wrapper.text()).toContain('Погашено 40%');
    });

    it('shows "Всего" total amount', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Всего:');
      expect(wrapper.text()).toContain('50');
    });

    it('shows payment button', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      const btn = wrapper.find('[data-testid="payment-btn"]');
      expect(btn.exists()).toBe(true);
      expect(btn.text()).toContain('Внести платёж');
    });

    it('shows delete button', async () => {
      const wrapper = await renderPage(mockGivenDebtResponse.id);
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

    it('does NOT show "Уже выплачено" when remaining equals total', async () => {
      const wrapper = await renderPage(mockTakenDebtResponse.id);
      expect(wrapper.text()).not.toContain('Уже выплачено');
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
      // Closed debts don't show the inline delete button in header, but have a bottom delete button
      expect(wrapper.find('[data-testid="delete-debt-btn"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('Удалить долг');
    });

    it('does NOT show progress bar', async () => {
      const wrapper = await renderPage(mockClosedDebtResponse.id);
      // Closed debt with remaining=0 should not display progress section
      expect(wrapper.text()).not.toContain('Погашено');
      // The UProgressBar component should not be present in debt details section
      const progressBars = wrapper.findAllComponents({ name: 'UProgressBar' });
      expect(progressBars.length).toBe(0);
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

    it('shows "(просрочено)" text near due date', async () => {
      const wrapper = await renderPage(mockOverdueDebtResponse.id);
      expect(wrapper.text()).toContain('(просрочено)');
    });
  });

  // -----------------------------------------------------------------------
  // Debt Details Card
  // -----------------------------------------------------------------------
  describe('debt details card', () => {
    it('shows original amount', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Исходная сумма');
      // totalAmount = 50000
      expect(wrapper.text()).toContain('50');
    });

    it('shows currency', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Валюта');
      expect(wrapper.text()).toContain('UZS');
    });

    it('shows debt type "Вам должны" for given debt', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Вам должны');
    });

    it('shows debt type "Вы должны" for taken debt', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockTakenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockTakenDebtResponse.id);
      expect(wrapper.text()).toContain('Вы должны');
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

    it('shows created date', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);
      expect(wrapper.text()).toContain('Дата создания');
    });
  });

  // -----------------------------------------------------------------------
  // Debt Without Linked Account
  // -----------------------------------------------------------------------
  describe('debt without linked account', () => {
    it('hides account row when no linked account', async () => {
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

      // Should NOT show the "Счёт" row with account name
      // The detail card should still exist but without account info
      expect(wrapper.text()).toContain('Исходная сумма');
      // "Основной" account name should NOT appear since accountId is null
      expect(wrapper.text()).not.toContain('Основной');
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

      // Open delete modal
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

      // Closed debt has a bottom "Удалить долг" button, not the header one
      expect(wrapper.find('[data-testid="delete-debt-btn"]').exists()).toBe(false);

      // Find the bottom delete button by text
      const deleteBtn = wrapper.findAll('button').find((b) => b.text().includes('Удалить долг'));
      expect(deleteBtn).toBeDefined();
      await deleteBtn!.trigger('click');
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
    it('clicking payment button shows payment modal', async () => {
      server.use(
        http.get('*/api/debts', () => HttpResponse.json([mockGivenDebtResponse])),
        http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])),
      );
      const wrapper = await renderPage(mockGivenDebtResponse.id);

      const paymentBtn = wrapper.find('[data-testid="payment-btn"]');
      expect(paymentBtn.exists()).toBe(true);

      await paymentBtn.trigger('click');
      await flushPromises();

      const modal = wrapper.findComponent({ name: 'PartialPaymentModal' });
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

      // Open payment modal
      await currentWrapper.find('[data-testid="payment-btn"]').trigger('click');
      await flushPromises();

      // Emit partial payment (10000 < 30000 remaining, so debt stays open)
      const modal = currentWrapper.findComponent({ name: 'PartialPaymentModal' });
      modal.vm.$emit('confirm', 10000, 'acc-1', {});
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

      // Open payment modal
      await currentWrapper.find('[data-testid="payment-btn"]').trigger('click');
      await flushPromises();

      // Emit full payment (30000 >= 30000 remaining, so debt closes)
      const modal = currentWrapper.findComponent({ name: 'PartialPaymentModal' });
      modal.vm.$emit('confirm', 30000, 'acc-1', {});
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

      // Open payment modal
      await currentWrapper.find('[data-testid="payment-btn"]').trigger('click');
      await flushPromises();

      // Emit forgive: amount=0, forgiveRemainder=true
      const modal = currentWrapper.findComponent({ name: 'PartialPaymentModal' });
      modal.vm.$emit('confirm', 0, 'acc-1', { forgiveRemainder: true });
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
