import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { usePartialPayment } from './usePartialPayment';
import { mockGivenDebtResponse, mockTakenDebtResponse } from '@/test/mocks/handlers/debts';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
import { CATEGORY_IDS } from '@/entities/category';
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
const ACCOUNT_ID = 'acc-1';

function makeDebt(
  partial: Partial<Record<keyof typeof mockGivenDebtResponse, unknown>> & {
    debtType?: 'given' | 'taken';
  },
): Debt {
  const raw = { ...mockGivenDebtResponse, ...partial } as typeof mockGivenDebtResponse;
  return {
    id: raw.id,
    user_id: raw.userId,
    name: raw.name,
    total_amount: raw.totalAmount,
    remaining_amount: raw.remainingAmount,
    monthly_payment: raw.monthlyPayment,
    next_payment_date: raw.nextPaymentDate,
    created_at: raw.createdAt,
    debt_type: (raw.debtType ?? raw.debtType) as 'given' | 'taken',
    person_name: raw.personName,
    account_id: raw.accountId,
    transaction_id: raw.transactionId,
    close_transaction_id: raw.closeTransactionId,
    is_closed: raw.isClosed,
    currency: raw.currency,
    source_transaction_id: raw.sourceTransactionId,
    description: raw.description,
    closed_at: raw.closedAt,
    forgiven_amount: raw.forgivenAmount,
    is_private: raw.isPrivate,
  };
}

const givenDebt = makeDebt({
  id: 'debt-1',
  totalAmount: 50000,
  remainingAmount: 30000,
  debtType: 'given',
  transactionId: 'tx-debt-1',
  currency: 'UZS',
});

const takenDebt = makeDebt({
  ...mockTakenDebtResponse,
  id: 'debt-2',
  totalAmount: 100000,
  remainingAmount: 100000,
  debtType: 'taken',
  transactionId: 'tx-debt-2',
  currency: 'UZS',
});

const debtNoTransaction = makeDebt({
  id: 'debt-no-tx',
  totalAmount: 20000,
  remainingAmount: 20000,
  debtType: 'given',
  transactionId: null,
  currency: 'UZS',
});

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof usePartialPayment>;
  const Stub = defineComponent({
    setup() {
      result = usePartialPayment();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('usePartialPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: re-fetch returns non-closed debt
    server.use(
      http.get('*/api/debts/:id', ({ params }) => {
        if (params.id === givenDebt.id) {
          return HttpResponse.json({
            ...mockGivenDebtResponse,
            id: givenDebt.id,
            remainingAmount: givenDebt.remaining_amount,
            isClosed: false,
          });
        }
        if (params.id === takenDebt.id) {
          return HttpResponse.json({
            ...mockTakenDebtResponse,
            id: takenDebt.id,
            remainingAmount: takenDebt.remaining_amount,
            isClosed: false,
          });
        }
        if (params.id === debtNoTransaction.id) {
          return HttpResponse.json({
            ...mockGivenDebtResponse,
            id: debtNoTransaction.id,
            transactionId: null,
            remainingAmount: debtNoTransaction.remaining_amount,
            isClosed: false,
          });
        }
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
    );
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // ── Initial state ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with isPaying=false and no error', () => {
      const c = mountComposable();
      expect(c.isPaying.value).toBe(false);
      expect(c.error.value).toBeNull();
    });
  });

  // ── Validation ────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns false for negative amount', async () => {
      const c = mountComposable();
      const result = await c.makePartialPayment(givenDebt, -100, ACCOUNT_ID, USER_ID);
      expect(result).toBe(false);
      expect(c.error.value).toBeTruthy();
    });

    it('returns false for zero amount without forgiveRemainder', async () => {
      const c = mountComposable();
      const result = await c.makePartialPayment(givenDebt, 0, ACCOUNT_ID, USER_ID);
      expect(result).toBe(false);
      expect(c.error.value).toBeTruthy();
    });

    it('returns false for overpayment without excessCategoryId', async () => {
      const c = mountComposable();
      // Payment exceeds remaining_amount (30000) → overpayment
      const result = await c.makePartialPayment(givenDebt, 50000, ACCOUNT_ID, USER_ID);
      expect(result).toBe(false);
      expect(c.error.value).toMatch(/категорию/i);
    });
  });

  // ── Given-type debt: partial payment ──────────────────────────────────

  describe('given debt — partial payment', () => {
    it('creates income transaction with DEBT_RETURN_TO_ME category', async () => {
      let txBody: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          txBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-pay-1' });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(result).toBe(true);
      expect((txBody as Record<string, unknown> | null)?.type).toBe('income');
      expect((txBody as Record<string, unknown> | null)?.categoryId).toBe(
        CATEGORY_IDS.DEBT_RETURN_TO_ME,
      );
      expect((txBody as Record<string, unknown> | null)?.amount).toBe(10000);
      expect((txBody as Record<string, unknown> | null)?.currency).toBe('UZS');
      expect((txBody as Record<string, unknown> | null)?.accountId).toBe(ACCOUNT_ID);
    });

    it('updates debt remaining_amount correctly after partial payment', async () => {
      let patchBody: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-partial-1' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...patchBody });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      // remaining was 30000, payment = 10000 → new remaining = 20000
      expect((patchBody as Record<string, unknown> | null)?.remainingAmount).toBe(20000);
      expect((patchBody as Record<string, unknown> | null)?.isClosed).toBe(false);
    });

    it('marks debt as closed when payment equals remaining amount', async () => {
      let patchBody: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-close-1' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...patchBody });
        }),
      );

      const c = mountComposable();
      // Pay exactly the remaining (30000)
      await c.makePartialPayment(givenDebt, 30000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect((patchBody as Record<string, unknown> | null)?.isClosed).toBe(true);
      expect((patchBody as Record<string, unknown> | null)?.remainingAmount).toBe(0);
    });

    it('shows success toast on successful payment', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-pay-toast' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('invalidates debt-related cache after payment', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-pay-inv' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });

    it('sets isPaying=false after completion', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-pay-state' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      expect(c.isPaying.value).toBe(false);
    });
  });

  // ── Taken-type debt ────────────────────────────────────────────────────

  describe('taken debt — partial payment', () => {
    it('creates expense transaction with DEBT_RETURN_FROM_ME category', async () => {
      let txBody: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          txBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTransactionResponse, id: 'tx-taken-pay' });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTakenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(takenDebt, 50000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(result).toBe(true);
      expect((txBody as Record<string, unknown> | null)?.type).toBe('expense');
      expect((txBody as Record<string, unknown> | null)?.categoryId).toBe(
        CATEGORY_IDS.DEBT_RETURN_FROM_ME,
      );
    });
  });

  // ── Already-closed debt detection ─────────────────────────────────────

  describe('already-closed debt detection', () => {
    it('returns true without creating transaction when re-fetch shows debt is already closed', async () => {
      const txPostSpy = vi.fn();
      server.use(
        http.get('*/api/debts/:id', () =>
          HttpResponse.json({
            ...mockGivenDebtResponse,
            id: givenDebt.id,
            isClosed: true,
            remainingAmount: 0,
          }),
        ),
        http.post('*/api/transactions', () => {
          txPostSpy();
          return HttpResponse.json({ ...mockTransactionResponse });
        }),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(result).toBe(true);
      expect(txPostSpy).not.toHaveBeenCalled();
    });
  });

  // ── Overpayment ────────────────────────────────────────────────────────

  describe('overpayment handling', () => {
    it('creates main payment transaction + excess category transaction', async () => {
      const txBodies: unknown[] = [];
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = await request.json();
          txBodies.push(body);
          return HttpResponse.json({ ...mockTransactionResponse, id: `tx-ov-${txBodies.length}` });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      // Pay 40000 on a debt with remaining=30000 → excess = 10000
      const result = await c.makePartialPayment(givenDebt, 40000, ACCOUNT_ID, USER_ID, {
        excessCategoryId: CATEGORY_IDS.GIFTS_INCOME,
      });
      await flushPromises();

      expect(result).toBe(true);
      expect(txBodies).toHaveLength(2); // Main + excess
      const mainTx = txBodies[0] as Record<string, unknown>;
      const excessTx = txBodies[1] as Record<string, unknown>;
      expect(mainTx.amount).toBe(30000); // capped at remaining
      expect(excessTx.amount).toBe(10000); // the excess
      expect(excessTx.categoryId).toBe(CATEGORY_IDS.GIFTS_INCOME);
    });

    it('marks debt as closed on overpayment', async () => {
      let patchBody: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: `tx-ov-cls` }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...patchBody });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 40000, ACCOUNT_ID, USER_ID, {
        excessCategoryId: CATEGORY_IDS.GIFTS_INCOME,
      });
      await flushPromises();

      expect((patchBody as Record<string, unknown> | null)?.isClosed).toBe(true);
    });
  });

  // ── Forgiveness ────────────────────────────────────────────────────────

  describe('forgiveness', () => {
    it('creates informational expense forgiveness record for given debt with no transaction history', async () => {
      const txBodies: unknown[] = [];
      server.use(
        http.get('*/api/debts/:id', () =>
          HttpResponse.json({
            ...mockGivenDebtResponse,
            id: debtNoTransaction.id,
            transactionId: null,
            remainingAmount: debtNoTransaction.remaining_amount,
            isClosed: false,
          }),
        ),
        http.post('*/api/transactions', async ({ request }) => {
          const body = await request.json();
          txBodies.push(body);
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: `tx-forg-${txBodies.length}`,
          });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(debtNoTransaction, 0, ACCOUNT_ID, USER_ID, {
        forgiveRemainder: true,
      });
      await flushPromises();

      expect(result).toBe(true);
      const forgiveTx = txBodies.find(
        (b) => (b as Record<string, unknown>).categoryId === CATEGORY_IDS.DEBT_FORGIVEN,
      ) as Record<string, unknown> | undefined;
      expect(forgiveTx).toBeDefined();
      expect(forgiveTx?.type).toBe('expense');
      expect(forgiveTx?.isInformational).toBe(true);
      expect(forgiveTx?.debtId).toBe(debtNoTransaction.id);
    });

    it('creates informational record for given debt WITH existing transaction_id', async () => {
      const txBodies: unknown[] = [];
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = await request.json();
          txBodies.push(body);
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: `tx-forg-${txBodies.length}`,
          });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(givenDebt, 0, ACCOUNT_ID, USER_ID, {
        forgiveRemainder: true,
      });
      await flushPromises();

      expect(result).toBe(true);
      const forgiveTx = txBodies.find(
        (b) => (b as Record<string, unknown>).categoryId === CATEGORY_IDS.DEBT_FORGIVEN,
      ) as Record<string, unknown> | undefined;
      expect(forgiveTx).toBeDefined();
      expect(forgiveTx?.type).toBe('expense');
      expect(forgiveTx?.amount).toBe(givenDebt.remaining_amount);
      expect(forgiveTx?.isInformational).toBe(true);
      expect(forgiveTx?.accountId).toBe(givenDebt.account_id ?? ACCOUNT_ID);
    });

    it('creates informational income record for taken debt', async () => {
      const txBodies: unknown[] = [];
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = await request.json();
          txBodies.push(body);
          return HttpResponse.json({
            ...mockTransactionResponse,
            id: `tx-forg-${txBodies.length}`,
          });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTakenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(takenDebt, 0, ACCOUNT_ID, USER_ID, {
        forgiveRemainder: true,
      });
      await flushPromises();

      expect(result).toBe(true);
      const forgiveTx = txBodies.find(
        (b) => (b as Record<string, unknown>).categoryId === CATEGORY_IDS.DEBT_FORGIVEN,
      ) as Record<string, unknown> | undefined;
      expect(forgiveTx).toBeDefined();
      expect(forgiveTx?.type).toBe('income');
      expect(forgiveTx?.isInformational).toBe(true);
    });

    it('marks debt as closed after forgiveness', async () => {
      let patchBody: Record<string, unknown> | null = null;
      server.use(
        http.get('*/api/debts/:id', () =>
          HttpResponse.json({
            ...mockGivenDebtResponse,
            id: debtNoTransaction.id,
            transactionId: null,
            remainingAmount: debtNoTransaction.remaining_amount,
            isClosed: false,
          }),
        ),
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-forg-close' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...patchBody });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(debtNoTransaction, 0, ACCOUNT_ID, USER_ID, {
        forgiveRemainder: true,
      });
      await flushPromises();

      expect((patchBody as Record<string, unknown> | null)?.isClosed).toBe(true);
      expect((patchBody as Record<string, unknown> | null)?.remainingAmount).toBe(0);
    });
  });

  // ── skipInvalidation / skipToast ──────────────────────────────────────

  describe('options: skipInvalidation and skipToast', () => {
    it('skips invalidation when skipInvalidation=true', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-skip-inv' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID, {
        skipInvalidation: true,
      });
      await flushPromises();

      expect(invalidateDebtRelated).not.toHaveBeenCalled();
    });

    it('skips toast when skipToast=true', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ ...mockTransactionResponse, id: 'tx-skip-toast' }),
        ),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID, {
        skipToast: true,
        skipInvalidation: true,
      });
      await flushPromises();

      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns false and sets error when transaction creation fails', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const result = await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(result).toBe(false);
      expect(c.error.value).toBeTruthy();
    });

    it('shows error toast when payment fails', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('sets isPaying=false after failure', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.makePartialPayment(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      expect(c.isPaying.value).toBe(false);
    });
  });
});
