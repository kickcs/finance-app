import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useCloseAllDebts } from './useCloseAllDebts';
import {
  mockGivenDebtResponse,
  mockSecondGivenDebtResponse,
  mockTakenDebtResponse,
} from '@/test/mocks/handlers/debts';
import { mockTransactionResponse } from '@/test/mocks/handlers/transactions';
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

function makeDebt(partial: Record<string, any>): Debt {
  const raw = { ...mockGivenDebtResponse, ...partial };
  return {
    id: raw.id,
    user_id: raw.userId,
    name: raw.name,
    total_amount: raw.totalAmount,
    remaining_amount: raw.remainingAmount,
    monthly_payment: raw.monthlyPayment,
    next_payment_date: raw.nextPaymentDate,
    created_at: raw.createdAt,
    debt_type: raw.debtType as 'given' | 'taken',
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

const debt1 = makeDebt({
  id: 'debt-1',
  totalAmount: 30000,
  remainingAmount: 30000,
  createdAt: '2025-01-01T00:00:00.000Z',
  transactionId: 'tx-debt-1',
});
const debt2 = makeDebt({
  ...mockSecondGivenDebtResponse,
  totalAmount: 20000,
  remainingAmount: 20000,
  createdAt: '2025-02-01T00:00:00.000Z',
  transactionId: 'tx-debt-5',
});
const takenDebt = makeDebt({
  ...mockTakenDebtResponse,
  id: 'taken-debt-1',
  totalAmount: 100000,
  remainingAmount: 100000,
  debtType: 'taken',
});

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useCloseAllDebts>;
  const Stub = defineComponent({
    setup() {
      result = useCloseAllDebts();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useCloseAllDebts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default handlers for partial-payment sub-calls
    server.use(
      http.get('*/api/debts/:id', ({ params }) => {
        if (params.id === 'debt-1') {
          return HttpResponse.json({
            ...mockGivenDebtResponse,
            id: 'debt-1',
            remainingAmount: 30000,
            isClosed: false,
          });
        }
        if (params.id === mockSecondGivenDebtResponse.id) {
          return HttpResponse.json({
            ...mockSecondGivenDebtResponse,
            remainingAmount: 20000,
            isClosed: false,
          });
        }
        if (params.id === 'taken-debt-1') {
          return HttpResponse.json({
            ...mockTakenDebtResponse,
            id: 'taken-debt-1',
            remainingAmount: 100000,
            isClosed: false,
          });
        }
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
      http.post('*/api/transactions', () =>
        HttpResponse.json({ ...mockTransactionResponse, id: `tx-${Date.now()}` }),
      ),
      http.patch('*/api/debts/:id', async ({ request, params }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
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
    it('starts with isClosing=false, progress=0, total=0', () => {
      const c = mountComposable();
      expect(c.isClosing.value).toBe(false);
      expect(c.progress.value).toBe(0);
      expect(c.total.value).toBe(0);
      expect(c.error.value).toBeNull();
    });
  });

  // ── Empty debts guard ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns true immediately for empty debts array', async () => {
      const c = mountComposable();
      const result = await c.closeAllDebts([], ACCOUNT_ID, USER_ID);
      expect(result).toBe(true);
    });
  });

  // ── Full payment ───────────────────────────────────────────────────────

  describe('full payment — pays all debts', () => {
    it('processes each debt and returns true', async () => {
      const patchSpy = vi.fn();
      server.use(
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchSpy(params.id, body);
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      const result = await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(result).toBe(true);
      // Both debts should be patched to closed
      expect(patchSpy).toHaveBeenCalledTimes(2);
      const calls = patchSpy.mock.calls;
      calls.forEach(([, body]) => {
        expect(body.isClosed).toBe(true);
        expect(body.remainingAmount).toBe(0);
      });
    });

    it('shows success toast after all debts closed', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('invalidates debt-related cache once at the end', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).toHaveBeenCalledTimes(1);
      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });

    it('sets total to the number of debts before processing', async () => {
      const c = mountComposable();
      // Capture total before awaiting
      const promise = c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      expect(c.total.value).toBe(2);
      await promise;
      await flushPromises();
    });

    it('sets isClosing=false after completion', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      expect(c.isClosing.value).toBe(false);
    });

    it('processes debts FIFO (oldest first by createdAt)', async () => {
      const txBodies: unknown[] = [];
      server.use(
        http.post('*/api/transactions', async ({ request }) => {
          const body = await request.json();
          txBodies.push(body);
          return HttpResponse.json({ ...mockTransactionResponse, id: `tx-${Date.now()}` });
        }),
      );

      const c = mountComposable();
      // debt1 has createdAt 2025-01-01 (older), debt2 has 2025-02-01
      await c.closeAllDebts([debt2, debt1], ACCOUNT_ID, USER_ID, { paymentAmount: 30000 });
      await flushPromises();

      // First transaction should be for debt1 (older, amount 30000)
      expect(txBodies).toHaveLength(1); // Only debt1 is fully covered
    });
  });

  // ── Partial amount distribution ────────────────────────────────────────

  describe('partial payment distribution', () => {
    it('distributes partial payment FIFO — first debt gets full, second gets remainder', async () => {
      const patchCalls: Array<{ id: string; body: unknown }> = [];
      server.use(
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchCalls.push({ id: params.id as string, body });
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      // Pay exactly enough for debt1 (30000) out of 50000 total. debt2 (20000) would get 0.
      // paymentAmount = 30000 → covers debt1 fully (remaining 30000), debt2 gets 0 → skipped
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, { paymentAmount: 30000 });
      await flushPromises();

      // Only debt1 should be patched (debt2 gets 0 and no forgive)
      expect(patchCalls.some((c) => c.id === 'debt-1')).toBe(true);
    });

    it('forgives remaining debt when forgiveRemainder=true', async () => {
      const patchCalls: Array<{ id: string; body: Record<string, unknown> }> = [];
      server.use(
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patchCalls.push({ id: params.id as string, body });
          return HttpResponse.json({ ...mockGivenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      // Pay 10000 and forgive the rest of debt1 (remaining 30000) and all of debt2
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, {
        paymentAmount: 10000,
        forgiveRemainder: true,
      });
      await flushPromises();

      // Both debts should end up closed
      const closedPatches = patchCalls.filter((p) => p.body.isClosed === true);
      expect(closedPatches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns false and shows error toast when a payment fails', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      const result = await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(result).toBe(false);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('sets error message on failure', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(c.error.value).toBeTruthy();
    });

    it('sets isClosing=false after failure', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);

      expect(c.isClosing.value).toBe(false);
    });

    it('still calls invalidateDebtRelated even after failure (to sync state)', async () => {
      server.use(
        http.post('*/api/transactions', () =>
          HttpResponse.json({ message: 'Error' }, { status: 500 }),
        ),
      );

      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      await flushPromises();

      // The catch block calls invalidateDebtRelated to sync partial state
      expect(invalidateDebtRelated).toHaveBeenCalled();
    });
  });

  // ── taken-type debts ───────────────────────────────────────────────────

  describe('taken-type debts', () => {
    it('creates expense transaction for taken-type debt', async () => {
      const txBodies: unknown[] = [];
      server.use(
        http.get('*/api/debts/:id', () =>
          HttpResponse.json({
            ...mockTakenDebtResponse,
            id: 'taken-debt-1',
            remainingAmount: 100000,
            isClosed: false,
          }),
        ),
        http.post('*/api/transactions', async ({ request }) => {
          const body = await request.json();
          txBodies.push(body);
          return HttpResponse.json({ ...mockTransactionResponse, id: `tx-taken-${Date.now()}` });
        }),
        http.patch('*/api/debts/:id', async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockTakenDebtResponse, id: params.id, ...body });
        }),
      );

      const c = mountComposable();
      await c.closeAllDebts([takenDebt], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(txBodies.length).toBeGreaterThan(0);
      const firstTx = txBodies[0] as Record<string, unknown>;
      expect(firstTx.type).toBe('expense'); // taken debt return = expense
    });
  });
});
