import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Router } from 'vue-router';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import AddDebtPage from './AddDebtPage.vue';
import { mockAccountResponse } from '@/test/mocks/handlers/accounts';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { buildMockDebtResponse } from '@/test/mocks/handlers/debts';

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
  { path: '/debts/new', component: AddDebtPage, name: 'new-debt' },
  { path: '/debts', component: { template: '<div />' }, name: 'debts-list' },
  { path: '/accounts/new', component: { template: '<div />' }, name: 'new-account' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;
let currentRouter: Router | null = null;

async function renderPage() {
  const router = createTestRouter(routes);
  router.push('/debts/new');
  await router.isReady();

  currentRouter = router;
  currentWrapper = renderWithProviders(AddDebtPage, {
    router,
    provideAuth: { user: mockUser },
  });
  // Allow all queries (accounts, people) to settle.
  // Two flushes: query fires -> response arrives -> dependent watchers trigger.
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

/** Helper: get DebtForm component */
function getDebtForm(wrapper: ReturnType<typeof renderWithProviders>) {
  const comp = wrapper.findComponent({ name: 'DebtForm' });
  if (!comp.exists()) throw new Error('DebtForm not found');
  return comp;
}

/** Helper: get DebtForm's formData prop */
function getFormData(wrapper: ReturnType<typeof renderWithProviders>) {
  return getDebtForm(wrapper).props('formData');
}

/** Helper: update formData fields via emit from DebtForm */
async function updateFormData(
  wrapper: ReturnType<typeof renderWithProviders>,
  updates: Record<string, unknown>,
) {
  const formComp = getDebtForm(wrapper);
  const currentData = formComp.props('formData');
  formComp.vm.$emit('update:formData', { ...currentData, ...updates });
  await nextTick();
  await flushPromises();
}

/** Helper: select an account by clicking its button */
async function selectAccount(wrapper: ReturnType<typeof renderWithProviders>, name: string) {
  const btn = wrapper.findAll('button').find((b) => b.text().includes(name));
  if (!btn) throw new Error(`Account button "${name}" not found`);
  await btn.trigger('click');
  await nextTick();
}

/** Helper: fill the form with valid data and select account */
async function fillForm(
  wrapper: ReturnType<typeof renderWithProviders>,
  overrides: Record<string, unknown> = {},
) {
  // Select account first (via click to trigger handleAccountChange)
  await selectAccount(wrapper, 'Основной');
  await flushPromises();

  // Update remaining form fields
  await updateFormData(wrapper, {
    person_name: 'Тест',
    amount: 5000,
    ...overrides,
  });
}

/** Helper: find the submit button */
function findSubmitBtn(wrapper: ReturnType<typeof renderWithProviders>) {
  const btns = wrapper.findAll('button');
  const btn = btns.find((b) => b.text().includes('Создать долг'));
  if (!btn) throw new Error('Submit button not found');
  return btn;
}

// ===========================================================================
describe('AddDebtPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Reset handlers BEFORE unmount to prevent stale responses during flush
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    currentRouter = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title "Новый долг"', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Новый долг');
    });

    it('shows loading state while accounts load', async () => {
      let resolveAccounts!: () => void;
      server.use(
        http.get('*/api/accounts', async () => {
          await new Promise<void>((res) => {
            resolveAccounts = res;
          });
          return HttpResponse.json([mockAccountResponse]);
        }),
      );

      const router = createTestRouter(routes);
      router.push('/debts/new');
      await router.isReady();

      currentWrapper = renderWithProviders(AddDebtPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();

      expect(currentWrapper.find('[data-testid="accounts-loading"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(false);

      // Release the blocked response and let component settle
      resolveAccounts();
      await flushPromises();
      await flushPromises();
    });

    it('shows no-accounts state when no accounts', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Сначала создайте счёт');
      expect(wrapper.text()).toContain('Создать счёт');
    });

    it('shows form when accounts available', async () => {
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="accounts-loading"]').exists()).toBe(false);
      expect(wrapper.find('form').exists()).toBe(true);
    });

    it('shows "Создать долг" submit button', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Создать долг');
    });
  });

  // -----------------------------------------------------------------------
  // Form Defaults
  // -----------------------------------------------------------------------
  describe('form defaults', () => {
    it('defaults to "taken" debt type (Я взял в долг)', async () => {
      const wrapper = await renderPage();

      const fd = getFormData(wrapper);
      expect(fd.debt_type).toBe('taken');
      expect(wrapper.text()).toContain('Я взял в долг');
    });

    it('selects account via click', async () => {
      const wrapper = await renderPage();

      // Initially null
      expect(getFormData(wrapper).account_id).toBeNull();

      // Click account button
      await selectAccount(wrapper, 'Основной');
      await flushPromises();

      expect(getFormData(wrapper).account_id).toBe('acc-1');
      expect(getFormData(wrapper).currency).toBe('UZS');
    });
  });

  // -----------------------------------------------------------------------
  // Form Submission (taken type)
  // -----------------------------------------------------------------------
  describe('form submission (taken type)', () => {
    it('sends transaction + debt to API with correct payloads', async () => {
      let capturedTxPayload: Record<string, unknown> | null = null;
      let capturedDebtPayload: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedTxPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-debt-new',
            amount: capturedTxPayload.amount,
            type: capturedTxPayload.type,
            isDebtRelated: true,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          capturedDebtPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            buildMockDebtResponse(capturedDebtPayload, { id: 'debt-new-1' }),
          );
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: params.id,
            ...body,
          });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Алексей',
        amount: 50000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Transaction payload (camelCase to backend)
      expect(capturedTxPayload).not.toBeNull();
      expect(capturedTxPayload!.accountId).toBe('acc-1');
      expect(capturedTxPayload!.categoryId).toBe('debt_taken');
      expect(capturedTxPayload!.amount).toBe(50000);
      expect(capturedTxPayload!.currency).toBe('UZS');
      expect(capturedTxPayload!.type).toBe('income');
      expect(capturedTxPayload!.isDebtRelated).toBe(true);
      expect(capturedTxPayload!.description).toContain('Взял в долг');
      expect(capturedTxPayload!.description).toContain('Алексей');

      // Debt payload (camelCase to backend)
      expect(capturedDebtPayload).not.toBeNull();
      expect(capturedDebtPayload!.name).toBe('Долг для Алексей');
      expect(capturedDebtPayload!.totalAmount).toBe(50000);
      expect(capturedDebtPayload!.remainingAmount).toBe(50000);
      expect(capturedDebtPayload!.debtType).toBe('taken');
      expect(capturedDebtPayload!.personName).toBe('Алексей');
      expect(capturedDebtPayload!.accountId).toBe('acc-1');
      expect(capturedDebtPayload!.transactionId).toBe('tx-debt-new');
      expect(capturedDebtPayload!.currency).toBe('UZS');
    });

    it('navigates to debts list on success', async () => {
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-nav',
            amount: body.amount,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-nav' }));
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: params.id, ...body });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Тест',
        amount: 1000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Should navigate to debts-list route via router.replace
      expect(currentRouter!.currentRoute.value.name).toBe('debts-list');
    });

    it('links transaction to debt via PATCH', async () => {
      let capturedPatchPayload: Record<string, unknown> | null = null;
      let capturedPatchId: string | null = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-link-1',
            amount: body.amount,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-link-1' }));
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          capturedPatchPayload = (await request.json()) as Record<string, unknown>;
          capturedPatchId = params.id as string;
          return HttpResponse.json({ ...mockTransactionResponse, id: params.id });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Иван',
        amount: 20000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedPatchId).toBe('tx-link-1');
      expect(capturedPatchPayload).not.toBeNull();
      expect(capturedPatchPayload!.debtId).toBe('debt-link-1');
    });

    it('includes description in transaction payload when provided', async () => {
      let capturedTxPayload: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedTxPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-desc-1',
            amount: capturedTxPayload.amount,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-desc-1' }));
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: params.id, ...body });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Описание Тест',
        amount: 7000,
        description: 'Обед в кафе',
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedTxPayload).not.toBeNull();
      expect(capturedTxPayload!.description).toBe('Обед в кафе');
    });
  });

  // -----------------------------------------------------------------------
  // Form Submission (given type)
  // -----------------------------------------------------------------------
  describe('form submission (given type)', () => {
    it('sends expense transaction for given debt', async () => {
      let capturedTxPayload: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedTxPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-given-1',
            amount: capturedTxPayload.amount,
            type: 'expense',
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-given-1' }));
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: params.id, ...body });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        debt_type: 'given',
        person_name: 'Мария',
        amount: 30000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedTxPayload).not.toBeNull();
      expect(capturedTxPayload!.type).toBe('expense');
      expect(capturedTxPayload!.categoryId).toBe('debt_given');
      expect(capturedTxPayload!.amount).toBe(30000);
      expect(capturedTxPayload!.description).toContain('Дал в долг');
      expect(capturedTxPayload!.description).toContain('Мария');
    });

    it('debt name is "Долг от PersonName" for given type', async () => {
      let capturedDebtPayload: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-given-name',
            amount: body.amount,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          capturedDebtPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            buildMockDebtResponse(capturedDebtPayload, { id: 'debt-given-name' }),
          );
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: params.id, ...body });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        debt_type: 'given',
        person_name: 'Петр',
        amount: 15000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedDebtPayload).not.toBeNull();
      expect(capturedDebtPayload!.name).toBe('Долг от Петр');
      expect(capturedDebtPayload!.debtType).toBe('given');
    });
  });

  // -----------------------------------------------------------------------
  // Skip Transaction
  // -----------------------------------------------------------------------
  describe('skip transaction', () => {
    it('when skipTransaction checked, skips transaction creation, only creates debt', async () => {
      let txCallCount = 0;
      let capturedDebtPayload: Record<string, unknown> | null = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          txCallCount++;
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-skip',
            amount: body.amount,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          capturedDebtPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            buildMockDebtResponse(capturedDebtPayload, { id: 'debt-skip-1' }),
          );
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Сергей',
        amount: 10000,
        skipTransaction: true,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Transaction should NOT have been created
      expect(txCallCount).toBe(0);

      // Debt should have been created
      expect(capturedDebtPayload).not.toBeNull();
      expect(capturedDebtPayload!.name).toContain('Сергей');
      expect(capturedDebtPayload!.totalAmount).toBe(10000);

      // Should navigate to debts list
      expect(currentRouter!.currentRoute.value.name).toBe('debts-list');
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------
  describe('validation', () => {
    it('submit button disabled when person_name is empty', async () => {
      const wrapper = await renderPage();

      // Select account and set amount but leave person_name empty
      await selectAccount(wrapper, 'Основной');
      await updateFormData(wrapper, { amount: 5000 });
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    it('submit button disabled when amount is 0', async () => {
      const wrapper = await renderPage();

      // Select account and set person_name but leave amount at 0
      await selectAccount(wrapper, 'Основной');
      await updateFormData(wrapper, { person_name: 'Тест', amount: 0 });
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    it('submit button disabled when no account selected', async () => {
      const wrapper = await renderPage();

      // Set person_name and amount but don't select account
      await updateFormData(wrapper, { person_name: 'Тест', amount: 5000 });
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    it('submit button enabled when form is complete', async () => {
      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Тест',
        amount: 5000,
      });
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('shows error on API failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Ошибка',
        amount: 5000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.text()).toContain('Не удалось создать долг');
      expect(wrapper.find('form').exists()).toBe(true);

      consoleSpy.mockRestore();
    });

    it('rolls back transaction on debt creation failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const deletedTxIds: string[] = [];

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-rollback-1',
            amount: body.amount,
          });
        }),
        http.post('*/api/debts', () =>
          HttpResponse.json({ message: 'Debt error' }, { status: 500 }),
        ),
        http.delete('*/api/transactions/:id', ({ params }) => {
          deletedTxIds.push(params.id as string);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const wrapper = await renderPage();

      await fillForm(wrapper, {
        person_name: 'Rollback',
        amount: 25000,
      });
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Transaction should have been rolled back
      expect(deletedTxIds).toContain('tx-rollback-1');

      // Should NOT navigate away
      expect(currentRouter!.currentRoute.value.name).not.toBe('debts-list');

      // Should show error
      expect(wrapper.text()).toContain('Не удалось создать долг');

      consoleSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // Back Button
  // -----------------------------------------------------------------------
  describe('back button', () => {
    it('calls navigateBack when back button is clicked', async () => {
      const wrapper = await renderPage();

      const header = wrapper.findComponent({ name: 'AppHeader' });
      expect(header.exists()).toBe(true);
      header.vm.$emit('back');
      await flushPromises();

      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // No-Accounts Navigation
  // -----------------------------------------------------------------------
  describe('no-accounts navigation', () => {
    it('navigates to new account page when "Создать счёт" clicked', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(true);

      const createAccountBtn = wrapper
        .findAll('button')
        .find((b) => b.text().includes('Создать счёт'));
      expect(createAccountBtn).toBeDefined();
      await createAccountBtn!.trigger('click');
      await flushPromises();

      expect(currentRouter!.currentRoute.value.name).toBe('new-account');
    });
  });
});
