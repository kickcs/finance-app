import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useDebtForm } from './useDebtForm';
import { CATEGORY_IDS } from '@/entities/category';
import { buildMockDebtResponse } from '@/test/mocks/handlers/debts';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/api/invalidation', () => ({
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateDebtRelated } from '@/shared/api/invalidation';

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useDebtForm>;
  const Stub = defineComponent({
    setup() {
      result = useDebtForm();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

function fillValidForm(
  c: ReturnType<typeof useDebtForm>,
  overrides: { debt_type?: 'given' | 'taken'; skip_transaction?: boolean } = {},
) {
  c.updateField('person_name', 'Алексей');
  c.updateField('amount', 50000);
  c.updateField('account_id', 'acc-1');
  c.updateField('currency', 'UZS');
  if (overrides.debt_type !== undefined) c.updateField('debt_type', overrides.debt_type);
  if (overrides.skip_transaction !== undefined)
    c.updateField('skip_transaction', overrides.skip_transaction);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useCreateDebt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── isValid ─────────────────────────────────────────────────────────────

  describe('isValid', () => {
    it('is false on empty form', () => {
      const c = mountComposable();
      expect(c.isValid.value).toBe(false);
    });

    it('is false when person_name is empty', () => {
      const c = mountComposable();
      c.updateField('amount', 50000);
      c.updateField('account_id', 'acc-1');
      expect(c.isValid.value).toBe(false);
    });

    it('is false when amount is 0', () => {
      const c = mountComposable();
      c.updateField('person_name', 'Алексей');
      c.updateField('account_id', 'acc-1');
      c.updateField('amount', 0);
      expect(c.isValid.value).toBe(false);
    });

    it('is false when account_id is null', () => {
      const c = mountComposable();
      c.updateField('person_name', 'Алексей');
      c.updateField('amount', 50000);
      // account_id remains null
      expect(c.isValid.value).toBe(false);
    });

    it('is true when all required fields are filled', () => {
      const c = mountComposable();
      fillValidForm(c);
      expect(c.isValid.value).toBe(true);
    });
  });

  // ── createDebt — given ───────────────────────────────────────────────────

  describe('createDebt — given type', () => {
    it('creates expense transaction with DEBT_GIVEN category', async () => {
      let txBody: any = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          txBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-given-1' });
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-given-1' }));
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { debt_type: 'given' });

      await c.createDebt(USER_ID);

      expect(txBody?.type).toBe('expense');
      expect(txBody?.categoryId).toBe(CATEGORY_IDS.DEBT_GIVEN);
      expect(txBody?.amount).toBe(50000);
      expect(txBody?.isDebtRelated).toBe(true);
    });

    it('creates debt with "Долг от" name and links transaction back', async () => {
      let debtBody: any = null;
      let patchTxId: string | null = null;
      let patchTxBody: any = null;

      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-given-2' }),
        ),
        http.post('*/api/debts', async ({ request }) => {
          debtBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(debtBody, { id: 'debt-given-2' }));
        }),
        http.patch('*/api/transactions/:id', async ({ request, params }) => {
          patchTxId = params.id as string;
          patchTxBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: params.id });
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { debt_type: 'given' });

      const result = await c.createDebt(USER_ID);
      await flushPromises();

      expect(result).toBe('debt-given-2');
      expect(debtBody?.name).toBe('Долг от Алексей');
      expect(debtBody?.debtType).toBe('given');
      expect(debtBody?.totalAmount).toBe(50000);

      // Link-back: PATCH /transactions/tx-given-2 with { debtId: 'debt-given-2' }
      expect(patchTxId).toBe('tx-given-2');
      expect(patchTxBody?.debtId).toBe('debt-given-2');
    });

    it('invalidates cache and shows success toast', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-given-3' }),
        ),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-given-3' }));
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { debt_type: 'given' });

      await c.createDebt(USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });
  });

  // ── createDebt — taken ───────────────────────────────────────────────────

  describe('createDebt — taken type', () => {
    it('creates income transaction with DEBT_TAKEN category and "Долг для" name', async () => {
      let txBody: any = null;
      let debtBody: any = null;

      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          txBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-taken-1' });
        }),
        http.post('*/api/debts', async ({ request }) => {
          debtBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(debtBody, { id: 'debt-taken-1' }));
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { debt_type: 'taken' });

      await c.createDebt(USER_ID);

      expect(txBody?.type).toBe('income');
      expect(txBody?.categoryId).toBe(CATEGORY_IDS.DEBT_TAKEN);
      expect(debtBody?.debtType).toBe('taken');
      expect(debtBody?.name).toBe('Долг для Алексей');
    });
  });

  // ── createDebt — skip_transaction ─────────────────────────────────────────

  describe('createDebt — skip_transaction', () => {
    it('skips transaction creation and does not link back', async () => {
      const txPostSpy = vi.fn();
      const txPatchSpy = vi.fn();

      server.use(
        http.post('*/api/transactions', () => {
          txPostSpy();
          return HttpResponse.json(mockTransactionResponse);
        }),
        http.patch('*/api/transactions/:id', () => {
          txPatchSpy();
          return HttpResponse.json(mockTransactionResponse);
        }),
        http.post('*/api/debts', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse(body, { id: 'debt-skip-1' }));
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { skip_transaction: true });

      const result = await c.createDebt(USER_ID);

      expect(result).toBe('debt-skip-1');
      expect(txPostSpy).not.toHaveBeenCalled();
      expect(txPatchSpy).not.toHaveBeenCalled();
    });
  });

  // ── createDebt — validation ──────────────────────────────────────────────

  describe('createDebt — invalid form', () => {
    it('returns null and sets error without calling any API', async () => {
      const txPostSpy = vi.fn();
      server.use(
        http.post('*/api/transactions', () => {
          txPostSpy();
          return HttpResponse.json(mockTransactionResponse);
        }),
      );

      const c = mountComposable(); // empty form

      const result = await c.createDebt(USER_ID);

      expect(result).toBeNull();
      expect(c.error.value).toBeTruthy();
      expect(txPostSpy).not.toHaveBeenCalled();
    });
  });

  // ── createDebt — error + rollback ────────────────────────────────────────

  describe('createDebt — error handling', () => {
    it('rolls back transaction and shows error toast on debt creation failure', async () => {
      const txDeleteSpy = vi.fn();

      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-rollback-1' }),
        ),
        http.post('*/api/debts', () =>
          HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
        ),
        http.delete('*/api/transactions/:id', ({ params }) => {
          txDeleteSpy(params.id as string);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      fillValidForm(c);

      const result = await c.createDebt(USER_ID);
      await flushPromises();

      expect(result).toBeNull();
      expect(c.error.value).toBeTruthy();
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
      expect(txDeleteSpy).toHaveBeenCalledWith('tx-rollback-1');
    });

    it('does not rollback when skip_transaction is true and debt creation fails', async () => {
      const txDeleteSpy = vi.fn();

      server.use(
        http.post('*/api/debts', () =>
          HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
        ),
        http.delete('*/api/transactions/:id', () => {
          txDeleteSpy();
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { skip_transaction: true });

      await c.createDebt(USER_ID);
      await flushPromises();

      expect(txDeleteSpy).not.toHaveBeenCalled();
    });

    it('sets isSubmitting to false after failure', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      fillValidForm(c);

      await c.createDebt(USER_ID);

      expect(c.isSubmitting.value).toBe(false);
    });
  });

  // ── updateField ──────────────────────────────────────────────────────────

  describe('updateField', () => {
    it('updates a specific field without touching others', () => {
      const c = mountComposable();
      c.updateField('person_name', 'Тест');
      c.updateField('amount', 12345);

      expect(c.formData.value.person_name).toBe('Тест');
      expect(c.formData.value.amount).toBe(12345);
      expect(c.formData.value.debt_type).toBe('taken'); // initial value unchanged
    });
  });

  // ── resetForm ────────────────────────────────────────────────────────────

  describe('resetForm', () => {
    it('resets form to initial state and clears error', () => {
      const c = mountComposable();
      fillValidForm(c);
      c.error.value = 'Какая-то ошибка';

      c.resetForm();

      expect(c.formData.value.person_name).toBe('');
      expect(c.formData.value.amount).toBe(0);
      expect(c.formData.value.account_id).toBeNull();
      expect(c.formData.value.debt_type).toBe('taken');
      expect(c.error.value).toBeNull();
    });
  });
});
