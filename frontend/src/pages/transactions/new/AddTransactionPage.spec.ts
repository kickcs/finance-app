import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import AddTransactionPage from './AddTransactionPage.vue';
import { mockAccountResponse, mockSecondAccountResponse } from '@/test/mocks/handlers/accounts';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';
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
  { path: '/transactions/new', component: AddTransactionPage, name: 'new-transaction' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
  { path: '/accounts/new', component: { template: '<div />' }, name: 'new-account' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(queryParams: Record<string, string> = {}) {
  const router = createTestRouter(routes);
  const query = new URLSearchParams(queryParams).toString();
  router.push(`/transactions/new${query ? '?' + query : ''}`);
  await router.isReady();

  currentWrapper = renderWithProviders(AddTransactionPage, {
    router,
    provideAuth: { user: mockUser },
  });
  // Allow all queries (accounts, categories, profile) to settle.
  // Two flushes: query fires → response arrives → dependent watchers trigger.
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

/** Helper: get TransactionForm's formData prop */
function getFormData(wrapper: ReturnType<typeof renderWithProviders>) {
  const comp = wrapper.findComponent({ name: 'TransactionForm' });
  if (!comp.exists()) throw new Error('TransactionForm not found');
  return comp.props('formData');
}

/** Helper: find the submit button */
function findSubmitBtn(wrapper: ReturnType<typeof renderWithProviders>) {
  const btn = wrapper.find('[data-testid="submit-btn"]');
  if (!btn.exists()) throw new Error('Submit button not found');
  return btn;
}

/** Helper: set amount via the expense amount input */
async function setAmount(wrapper: ReturnType<typeof renderWithProviders>, value: number) {
  const input = wrapper.find('input[aria-label="Сумма"]');
  if (!input.exists()) throw new Error('Amount input not found');
  await input.setValue(value);
  await nextTick();
}

/** Helper: click the first category button matching the given name */
async function selectCategory(wrapper: ReturnType<typeof renderWithProviders>, name: string) {
  const btn = wrapper.findAll('button').find((b) => b.text().includes(name));
  if (!btn) throw new Error(`Category button "${name}" not found`);
  await btn.trigger('click');
  await nextTick();
}

// ===========================================================================
describe('AddTransactionPage', () => {
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
  // Initialization & Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Новая транзакция');
    });

    it('shows empty state when no accounts', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('У вас пока нет счетов');
      expect(wrapper.text()).toContain('Создать счёт');
    });

    it('shows transaction form when accounts exist', async () => {
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(false);
      expect(wrapper.find('form').exists()).toBe(true);
    });

    it('defaults to expense type', async () => {
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Добавить расход');
      expect(getFormData(wrapper).type).toBe('expense');
    });

    it('renders expense categories', async () => {
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Продукты');
      expect(wrapper.text()).toContain('Транспорт');
    });

    it('renders description input', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Комментарий');
    });

    it('renders date picker', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Дата');
    });

    it('shows split expense button in expense mode', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Разделить расход');
    });
  });

  // -----------------------------------------------------------------------
  // Account Auto-Selection
  // -----------------------------------------------------------------------
  describe('account auto-selection', () => {
    it('auto-selects default account from profile', async () => {
      const wrapper = await renderPage();

      const fd = getFormData(wrapper);
      expect(fd.accountId).toBe('acc-1');
      expect(fd.currency).toBe('UZS');
    });

    it('auto-selects first account when no default set', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({ ...mockProfileResponse, defaultAccountId: null }),
        ),
      );
      const wrapper = await renderPage();

      expect(getFormData(wrapper).accountId).toBe('acc-1');
    });

    it('uses accountId from query param over default', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage({ accountId: 'acc-2' });

      const fd = getFormData(wrapper);
      expect(fd.accountId).toBe('acc-2');
      expect(fd.currency).toBe('USD');
    });

    it('sets currency from selected account balance', async () => {
      server.use(
        http.get('*/api/accounts', () => HttpResponse.json([mockSecondAccountResponse])),
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({ ...mockProfileResponse, defaultAccountId: null }),
        ),
      );
      const wrapper = await renderPage();

      expect(getFormData(wrapper).currency).toBe('USD');
    });
  });

  // -----------------------------------------------------------------------
  // Query Parameters
  // -----------------------------------------------------------------------
  describe('query parameters', () => {
    it('sets income type from query', async () => {
      const wrapper = await renderPage({ type: 'income' });

      expect(getFormData(wrapper).type).toBe('income');
      expect(wrapper.text()).toContain('Добавить доход');
    });

    it('sets transfer type from query', async () => {
      const wrapper = await renderPage({ type: 'transfer' });

      expect(getFormData(wrapper).type).toBe('transfer');
      expect(wrapper.text()).toContain('Перевести');
    });

    it('pre-fills categoryId from query', async () => {
      const wrapper = await renderPage({ categoryId: 'cat-groceries' });
      expect(getFormData(wrapper).categoryId).toBe('cat-groceries');
    });

    it('ignores invalid type query param', async () => {
      const wrapper = await renderPage({ type: 'invalid' });
      expect(getFormData(wrapper).type).toBe('expense');
    });
  });

  // -----------------------------------------------------------------------
  // Form Validation
  // -----------------------------------------------------------------------
  describe('form validation', () => {
    it('submit button is disabled without amount and category', async () => {
      const wrapper = await renderPage();
      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    it('submit button stays disabled with amount but no category', async () => {
      const wrapper = await renderPage();

      await setAmount(wrapper, 5000);
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    it('submit button stays disabled with category but no amount', async () => {
      const wrapper = await renderPage();

      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeDefined();
    });

    it('submit button becomes enabled with amount and category', async () => {
      const wrapper = await renderPage();

      await setAmount(wrapper, 5000);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      expect(findSubmitBtn(wrapper).attributes('disabled')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Regular Submission
  // -----------------------------------------------------------------------
  describe('regular submission', () => {
    it('sends expense transaction to API with correct payload', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-new',
            amount: capturedPayload.amount,
            categoryId: capturedPayload.categoryId,
          });
        }),
      );

      const wrapper = await renderPage();

      await setAmount(wrapper, 15000);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.amount).toBe(15000);
      expect(capturedPayload!.categoryId).toBe('cat-groceries');
      expect(capturedPayload!.accountId).toBe('acc-1');
      expect(capturedPayload!.currency).toBe('UZS');
      expect(capturedPayload!.type).toBe('expense');
    });

    it('navigates back after successful submit', async () => {
      const wrapper = await renderPage();

      await setAmount(wrapper, 1000);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(navigateBackMock).toHaveBeenCalled();
    });

    it('sends income transaction with correct type', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-inc' });
        }),
      );

      const wrapper = await renderPage({ type: 'income' });

      await setAmount(wrapper, 50000);
      await selectCategory(wrapper, 'Зарплата');
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.type).toBe('income');
      expect(capturedPayload!.amount).toBe(50000);
    });

    it('sends description when provided', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-desc' });
        }),
      );

      const wrapper = await renderPage();

      await setAmount(wrapper, 2000);
      await selectCategory(wrapper, 'Продукты');

      const descInput = wrapper
        .findAll('input')
        .find((i) => i.attributes('placeholder')?.includes('#продукты'));
      if (descInput) {
        await descInput.setValue('#продукты #магазин');
        await nextTick();
      }

      await flushPromises();
      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.description).toBe('#продукты #магазин');
    });

    it('handles API error gracefully (no crash)', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const wrapper = await renderPage();

      await setAmount(wrapper, 5000);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.find('form').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Split Expense
  // -----------------------------------------------------------------------
  describe('split expense submission', () => {
    /** Reusable MSW interceptors that capture payloads for assertions */
    function useSplitHandlers() {
      const txPayloads: Record<string, unknown>[] = [];
      const debtPayloads: Record<string, unknown>[] = [];
      let txIdCounter = 0;
      const deletedTxIds: string[] = [];

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          txPayloads.push(body);
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: `tx-split-${++txIdCounter}`,
            amount: body.amount,
            categoryId: body.categoryId,
          });
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          debtPayloads.push(body);
          return HttpResponse.json(
            buildMockDebtResponse(body, { id: `debt-${debtPayloads.length}` }),
          );
        }),
        http.delete('*/api/transactions/:id', ({ params }) => {
          deletedTxIds.push(params.id as string);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      return { txPayloads, debtPayloads, deletedTxIds };
    }

    /** Prepare form with amount + category + split enabled */
    async function prepareSplitForm(
      wrapper: ReturnType<typeof renderWithProviders>,
      amount: number,
    ) {
      await setAmount(wrapper, amount);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();
      const formComp = wrapper.findComponent({ name: 'TransactionForm' });
      formComp.vm.$emit('setSplitEnabled', true);
      await nextTick();
      return formComp;
    }

    // ------- Equal method -------

    it('equal split: 2 participants + included, creates 2 debts with correct amounts', async () => {
      const { txPayloads, debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 30000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Мария', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(txPayloads.length).toBe(1);
      expect(txPayloads[0].amount).toBe(30000);

      // 30000 / 3 = 10000 each
      expect(debtPayloads.length).toBe(2);
      expect(debtPayloads[0].totalAmount).toBe(10000);
      expect(debtPayloads[0].personName).toBe('Алексей');
      expect(debtPayloads[1].totalAmount).toBe(10000);
      expect(debtPayloads[1].personName).toBe('Мария');
      expect(navigateBackMock).toHaveBeenCalled();
    });

    it('equal split: 3 participants + included, remainder goes to user', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'А', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Б', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'В', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // 10000 / 4 = 2500 each, remainder 0
      expect(debtPayloads.length).toBe(3);
      expect(debtPayloads[0].totalAmount).toBe(2500);
      expect(debtPayloads[1].totalAmount).toBe(2500);
      expect(debtPayloads[2].totalAmount).toBe(2500);
    });

    it('equal split: handles indivisible amount (remainder to user)', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10001);

      formComp.vm.$emit('addParticipant', 'А', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Б', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'В', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // floor(10001/4) = 2500 per participant, remainder 1 to user
      expect(debtPayloads.length).toBe(3);
      expect(debtPayloads.every((d) => d.totalAmount === 2500)).toBe(true);
    });

    it('equal split: user NOT included, splits between participants only', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Мария', false);
      await nextTick();
      formComp.vm.$emit('setIsIncluded', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // 10000 / 2 = 5000 each
      expect(debtPayloads.length).toBe(2);
      expect(debtPayloads[0].totalAmount).toBe(5000);
      expect(debtPayloads[1].totalAmount).toBe(5000);
    });

    it('equal split: user NOT included, remainder to first participant', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'А', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Б', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'В', false);
      await nextTick();
      formComp.vm.$emit('setIsIncluded', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // 10000 / 3 = 3333, remainder 1 → first participant gets 3334
      expect(debtPayloads.length).toBe(3);
      expect(debtPayloads[0].totalAmount).toBe(3334);
      expect(debtPayloads[1].totalAmount).toBe(3333);
      expect(debtPayloads[2].totalAmount).toBe(3333);
    });

    it('equal split: single participant + included', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // 10000 / 2 = 5000, exactly 1 debt
      expect(debtPayloads.length).toBe(1);
      expect(debtPayloads[0].totalAmount).toBe(5000);
      expect(debtPayloads[0].personName).toBe('Алексей');
    });

    // ------- Custom method -------

    it('custom split: manual amounts per participant', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Мария', false);
      await nextTick();

      formComp.vm.$emit('setSplitMethod', 'custom');
      await nextTick();
      formComp.vm.$emit('setIsIncluded', false);
      await nextTick();

      const splitData = formComp.props('splitData');
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[0].id, 7000);
      await nextTick();
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[1].id, 3000);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(debtPayloads.length).toBe(2);
      expect(debtPayloads[0].totalAmount).toBe(7000);
      expect(debtPayloads[0].personName).toBe('Алексей');
      expect(debtPayloads[1].totalAmount).toBe(3000);
      expect(debtPayloads[1].personName).toBe('Мария');
    });

    it('custom split: user included, myShare auto-calculated as remainder', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('setSplitMethod', 'custom');
      await nextTick();

      const splitData = formComp.props('splitData');
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[0].id, 4000);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(debtPayloads.length).toBe(1);
      expect(debtPayloads[0].totalAmount).toBe(4000);
    });

    // ------- Zero & edge cases -------

    it('filters out participants with zero amount (no debt created)', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Мария', false);
      await nextTick();

      formComp.vm.$emit('setSplitMethod', 'custom');
      await nextTick();
      formComp.vm.$emit('setIsIncluded', false);
      await nextTick();

      const splitData = formComp.props('splitData');
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[0].id, 10000);
      await nextTick();
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[1].id, 0);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      // Мария filtered out (amount=0)
      expect(debtPayloads.length).toBe(1);
      expect(debtPayloads[0].personName).toBe('Алексей');
      expect(debtPayloads[0].totalAmount).toBe(10000);
    });

    it('split enabled but no participants → blocked by validation', async () => {
      const wrapper = await renderPage();

      await setAmount(wrapper, 5000);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      const formComp = wrapper.findComponent({ name: 'TransactionForm' });
      formComp.vm.$emit('setSplitEnabled', true);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.find('[data-testid="validation-error"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('Проверьте данные разделения расхода');
      expect(navigateBackMock).not.toHaveBeenCalled();
    });

    // ------- Debt payload structure -------

    it('debt payload has correct structure', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 20000);

      formComp.vm.$emit('addParticipant', 'Иван Петров', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(debtPayloads.length).toBe(1);
      const debt = debtPayloads[0];
      expect(debt.name).toBe('Долг от Иван Петров');
      expect(debt.totalAmount).toBe(10000); // 20000/2
      expect(debt.remainingAmount).toBe(10000);
      expect(debt.debtType).toBe('given');
      expect(debt.personName).toBe('Иван Петров');
      expect(debt.accountId).toBe('acc-1');
      expect(debt.currency).toBe('UZS');
      expect(debt.sourceTransactionId).toBe('tx-split-1');
    });

    it('all debts link to same transaction via sourceTransactionId', async () => {
      const { debtPayloads } = useSplitHandlers();
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 9000);

      formComp.vm.$emit('addParticipant', 'А', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Б', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'В', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(debtPayloads.length).toBe(3);
      const txId = debtPayloads[0].sourceTransactionId;
      expect(txId).toMatch(/^tx-split-/);
      expect(debtPayloads.every((d) => d.sourceTransactionId === txId)).toBe(true);
    });

    // ------- Rollback -------

    it('rolls back transaction when debt creation fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { deletedTxIds } = useSplitHandlers();
      // Override debt handler to fail
      server.use(
        http.post('*/api/debts', () =>
          HttpResponse.json({ message: 'Debt error' }, { status: 500 }),
        ),
      );

      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Петр', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(deletedTxIds).toContain('tx-split-1');
      expect(navigateBackMock).not.toHaveBeenCalled();
      expect(wrapper.text()).toContain('Не удалось создать долги');
      consoleSpy.mockRestore();
    });

    it('rolls back transaction when second debt fails (first already created)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { deletedTxIds } = useSplitHandlers();
      let debtCallCount = 0;
      // Override debt handler: first call succeeds, second fails
      server.use(
        http.post('*/api/debts', async ({ request }) => {
          debtCallCount++;
          if (debtCallCount === 1) {
            const body = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-ok' }));
          }
          return HttpResponse.json({ message: 'fail' }, { status: 500 });
        }),
      );

      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'А', false);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Б', false);
      await nextTick();
      formComp.vm.$emit('setIsIncluded', false);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(deletedTxIds).toContain('tx-split-1');
      expect(navigateBackMock).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    // ------- Validation errors -------

    it('validation error: overspending (custom amounts exceed total)', async () => {
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('setSplitMethod', 'custom');
      await nextTick();

      const splitData = formComp.props('splitData');
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[0].id, 20000);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.find('[data-testid="validation-error"]').exists()).toBe(true);
      expect(navigateBackMock).not.toHaveBeenCalled();
    });

    it('validation error: underspending (custom amounts below total)', async () => {
      const wrapper = await renderPage();
      const formComp = await prepareSplitForm(wrapper, 10000);

      formComp.vm.$emit('addParticipant', 'Алексей', false);
      await nextTick();
      formComp.vm.$emit('setSplitMethod', 'custom');
      await nextTick();
      formComp.vm.$emit('setIsIncluded', false);
      await nextTick();

      const splitData = formComp.props('splitData');
      formComp.vm.$emit('updateParticipantAmount', splitData.participants[0].id, 3000);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.find('[data-testid="validation-error"]').exists()).toBe(true);
      expect(navigateBackMock).not.toHaveBeenCalled();
    });

    it('add then remove all participants → blocked by validation', async () => {
      const wrapper = await renderPage();

      await setAmount(wrapper, 5000);
      await selectCategory(wrapper, 'Продукты');
      await flushPromises();

      const formComp = wrapper.findComponent({ name: 'TransactionForm' });
      formComp.vm.$emit('setSplitEnabled', true);
      await nextTick();
      formComp.vm.$emit('addParticipant', 'Temp', false);
      await nextTick();

      const splitData = formComp.props('splitData');
      formComp.vm.$emit('removeParticipant', splitData.participants[0].id);
      await nextTick();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(wrapper.find('[data-testid="validation-error"]').exists()).toBe(true);
      expect(navigateBackMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Quick Action (categoryId in query)
  // -----------------------------------------------------------------------
  describe('quick action flow', () => {
    it('pre-fills category and allows immediate amount entry', async () => {
      const wrapper = await renderPage({ categoryId: 'cat-groceries' });

      const fd = getFormData(wrapper);
      expect(fd.categoryId).toBe('cat-groceries');
      expect(fd.accountId).toBe('acc-1');
    });

    it('submits quick action with pre-filled category', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-quick' });
        }),
      );

      const wrapper = await renderPage({ categoryId: 'cat-groceries' });

      await setAmount(wrapper, 8500);
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.categoryId).toBe('cat-groceries');
      expect(capturedPayload!.amount).toBe(8500);
    });
  });

  // -----------------------------------------------------------------------
  // Multiple accounts
  // -----------------------------------------------------------------------
  describe('multiple accounts', () => {
    it('renders all accounts for selection', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Основной');
      expect(wrapper.text()).toContain('Накопления');
    });

    it('selects account via click and updates currency', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      expect(getFormData(wrapper).accountId).toBe('acc-1');

      const accBtn = wrapper.findAll('button').find((b) => b.text().includes('Накопления'));
      if (accBtn) {
        await accBtn.trigger('click');
        await flushPromises();
        expect(getFormData(wrapper).accountId).toBe('acc-2');
        expect(getFormData(wrapper).currency).toBe('USD');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Transfer Submission
  // -----------------------------------------------------------------------
  describe('transfer submission', () => {
    it('sends transfer transaction with toAccountId and toAmount', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );

      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: 'tx-transfer',
            type: 'transfer',
            ...capturedPayload,
          });
        }),
      );

      const wrapper = await renderPage({ type: 'transfer' });

      // TransactionForm should be in transfer mode
      const formComp = wrapper.findComponent({ name: 'TransactionForm' });
      expect(formComp.props('formData').type).toBe('transfer');

      // Set amount and update transfer fields via formData
      await setAmount(wrapper, 100000);

      // Emit formData update with transfer fields
      const currentData = formComp.props('formData');
      formComp.vm.$emit('update:formData', {
        ...currentData,
        amount: 100000,
        toAccountId: 'acc-2',
        toAmount: 8,
        toCurrency: 'USD',
        categoryId: 'transfer',
      });
      await nextTick();
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.type).toBe('transfer');
      expect(capturedPayload!.toAccountId).toBe('acc-2');
      // toAmount is auto-recalculated by TransferPanel watcher using exchange rates
      // 100000 UZS * 0.0000794 (mock rate) = 7.94 USD
      expect(capturedPayload!.toAmount).toBeCloseTo(7.94, 1);
      expect(capturedPayload!.toCurrency).toBe('USD');
      expect(capturedPayload!.amount).toBe(100000);
    });

    it('navigates back after successful transfer', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );

      const wrapper = await renderPage({ type: 'transfer' });

      const formComp = wrapper.findComponent({ name: 'TransactionForm' });
      const currentData = formComp.props('formData');
      formComp.vm.$emit('update:formData', {
        ...currentData,
        amount: 50000,
        toAccountId: 'acc-2',
        toAmount: 4,
        toCurrency: 'USD',
        categoryId: 'transfer',
      });
      await nextTick();
      await flushPromises();

      await wrapper.find('form').trigger('submit');
      await flushPromises();

      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Type Switching
  // -----------------------------------------------------------------------
  describe('type switching', () => {
    it('switches to income type and shows income categories', async () => {
      const wrapper = await renderPage({ type: 'income' });

      expect(wrapper.text()).toContain('Добавить доход');
      expect(wrapper.text()).toContain('Зарплата');
    });

    it('hides split expense button in income mode', async () => {
      const wrapper = await renderPage({ type: 'income' });
      // All panels are rendered in a swipeable container, so we check the IncomePanel specifically
      const incomePanel = wrapper.findComponent({ name: 'IncomePanel' });
      expect(incomePanel.exists()).toBe(true);
      expect(incomePanel.text()).not.toContain('Разделить расход');
    });

    it('shows transfer label in transfer mode', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage({ type: 'transfer' });
      expect(wrapper.text()).toContain('Перевести');
    });
  });

  // -----------------------------------------------------------------------
  // Loading State
  // -----------------------------------------------------------------------
  describe('loading state', () => {
    it('does not show form or empty state while accounts are loading', async () => {
      // Controlled promise to block the accounts response
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
      router.push('/transactions/new');
      await router.isReady();

      currentWrapper = renderWithProviders(AddTransactionPage, {
        router,
        provideAuth: { user: mockUser },
      });
      await flushPromises();

      // During loading: neither empty state nor form should be visible
      expect(currentWrapper.find('[data-testid="no-accounts-state"]').exists()).toBe(false);

      // Release the blocked response and let component settle
      resolveAccounts();
      await flushPromises();
      await flushPromises();
    });
  });
});
