import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useCloseDebt } from './useCloseDebt';
import { mockGivenDebtResponse, mockTakenDebtResponse } from '@/test/mocks/handlers/debts';
import type { Debt } from '@/shared/api/database.types';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/api/invalidation', () => ({
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateDebtRelated } from '@/shared/api/invalidation';

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';

// Transform camelCase mock response to snake_case Debt type
const givenDebt: Debt = {
  id: mockGivenDebtResponse.id,
  user_id: mockGivenDebtResponse.userId,
  name: mockGivenDebtResponse.name,
  total_amount: mockGivenDebtResponse.totalAmount,
  remaining_amount: mockGivenDebtResponse.remainingAmount,
  monthly_payment: mockGivenDebtResponse.monthlyPayment,
  next_payment_date: mockGivenDebtResponse.nextPaymentDate,
  created_at: mockGivenDebtResponse.createdAt,
  debt_type: mockGivenDebtResponse.debtType as 'given',
  person_name: mockGivenDebtResponse.personName,
  account_id: mockGivenDebtResponse.accountId,
  transaction_id: mockGivenDebtResponse.transactionId,
  close_transaction_id: mockGivenDebtResponse.closeTransactionId,
  is_closed: mockGivenDebtResponse.isClosed,
  currency: mockGivenDebtResponse.currency,
  source_transaction_id: mockGivenDebtResponse.sourceTransactionId,
  description: mockGivenDebtResponse.description,
  closed_at: mockGivenDebtResponse.closedAt,
  forgiven_amount: mockGivenDebtResponse.forgivenAmount,
  is_private: mockGivenDebtResponse.isPrivate,
};

const takenDebt: Debt = {
  id: mockTakenDebtResponse.id,
  user_id: mockTakenDebtResponse.userId,
  name: mockTakenDebtResponse.name,
  total_amount: mockTakenDebtResponse.totalAmount,
  remaining_amount: mockTakenDebtResponse.remainingAmount,
  monthly_payment: mockTakenDebtResponse.monthlyPayment,
  next_payment_date: mockTakenDebtResponse.nextPaymentDate,
  created_at: mockTakenDebtResponse.createdAt,
  debt_type: mockTakenDebtResponse.debtType as 'taken',
  person_name: mockTakenDebtResponse.personName,
  account_id: mockTakenDebtResponse.accountId,
  transaction_id: mockTakenDebtResponse.transactionId,
  close_transaction_id: mockTakenDebtResponse.closeTransactionId,
  is_closed: mockTakenDebtResponse.isClosed,
  currency: mockTakenDebtResponse.currency,
  source_transaction_id: mockTakenDebtResponse.sourceTransactionId,
  description: mockTakenDebtResponse.description,
  closed_at: mockTakenDebtResponse.closedAt,
  forgiven_amount: mockTakenDebtResponse.forgivenAmount,
  is_private: mockTakenDebtResponse.isPrivate,
};

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useCloseDebt>;
  const Stub = defineComponent({
    setup() {
      result = useCloseDebt();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useCloseDebt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('initialises with isDeleting=false and no error', () => {
      const c = mountComposable();
      expect(c.isDeleting.value).toBe(false);
      expect(c.error.value).toBeNull();
    });
  });

  // ── Successful delete ──────────────────────────────────────────────────

  describe('deleteDebt — success', () => {
    it('calls DELETE /api/debts/:id and returns true', async () => {
      const deleteSpy = vi.fn();
      server.use(
        http.delete('*/api/debts/:id', ({ params }) => {
          deleteSpy(params.id);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      const result = await c.deleteDebt(givenDebt, USER_ID);

      expect(result).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith(givenDebt.id);
    });

    it('invalidates debt-related cache on success', async () => {
      server.use(http.delete('*/api/debts/:id', () => new HttpResponse(null, { status: 204 })));

      const c = mountComposable();
      await c.deleteDebt(givenDebt, USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });

    it('shows success toast on delete', async () => {
      server.use(http.delete('*/api/debts/:id', () => new HttpResponse(null, { status: 204 })));

      const c = mountComposable();
      await c.deleteDebt(givenDebt, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('sets isDeleting to false after successful delete', async () => {
      server.use(http.delete('*/api/debts/:id', () => new HttpResponse(null, { status: 204 })));

      const c = mountComposable();
      const promise = c.deleteDebt(givenDebt, USER_ID);
      expect(c.isDeleting.value).toBe(true);

      await promise;
      expect(c.isDeleting.value).toBe(false);
    });

    it('works for taken-type debt as well', async () => {
      const deleteSpy = vi.fn();
      server.use(
        http.delete('*/api/debts/:id', ({ params }) => {
          deleteSpy(params.id);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const c = mountComposable();
      const result = await c.deleteDebt(takenDebt, USER_ID);

      expect(result).toBe(true);
      expect(deleteSpy).toHaveBeenCalledWith(takenDebt.id);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('deleteDebt — error handling', () => {
    it('returns false and sets error when API fails', async () => {
      server.use(
        http.delete('*/api/debts/:id', () =>
          HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const result = await c.deleteDebt(givenDebt, USER_ID);

      expect(result).toBe(false);
      expect(c.error.value).toBeTruthy();
    });

    it('shows error toast when API fails', async () => {
      server.use(
        http.delete('*/api/debts/:id', () =>
          HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.deleteDebt(givenDebt, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('sets isDeleting to false after failure', async () => {
      server.use(
        http.delete('*/api/debts/:id', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.deleteDebt(givenDebt, USER_ID);

      expect(c.isDeleting.value).toBe(false);
    });

    it('does not call invalidateDebtRelated when API fails', async () => {
      server.use(
        http.delete('*/api/debts/:id', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.deleteDebt(givenDebt, USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).not.toHaveBeenCalled();
    });
  });
});
