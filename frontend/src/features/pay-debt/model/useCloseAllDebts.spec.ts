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
import { debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import type { Debt } from '@/shared/api/database.types';

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
    fee_amount: 0,
    fee_transaction_id: null,
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

/** Платежи, которые ушли на сервер, — по одному запросу на долг. */
let payments: Array<{ debtId: string; body: Record<string, unknown> }> = [];

function stubPayments(status = 200) {
  server.use(
    http.post('*/api/debts/:id/payments', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      payments.push({ debtId: params.id as string, body });
      if (status !== 200) return new HttpResponse(null, { status });
      return HttpResponse.json({
        debt: { ...mockGivenDebtResponse, id: params.id, isClosed: true, remainingAmount: 0 },
        paymentTransactionId: `tx-${payments.length}`,
        transactionIds: [`tx-${payments.length}`],
      });
    }),
  );
}

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

describe('useCloseAllDebts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payments = [];
    stubPayments();
    queryClient.clear();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  describe('исходное состояние', () => {
    it('ничего не идёт, счётчики на нуле', () => {
      const c = mountComposable();
      expect(c.isClosing.value).toBe(false);
      expect(c.progress.value).toBe(0);
      expect(c.total.value).toBe(0);
      expect(c.error.value).toBeNull();
    });

    it('пустой список закрывать нечего', async () => {
      const c = mountComposable();
      expect(await c.closeAllDebts([], ACCOUNT_ID, USER_ID)).toBe(true);
      expect(payments).toHaveLength(0);
    });
  });

  describe('полное погашение', () => {
    it('шлёт по платежу на каждый долг', async () => {
      const c = mountComposable();

      expect(await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID)).toBe(true);
      await flushPromises();

      expect(payments.map((p) => p.debtId)).toEqual(['debt-1', debt2.id]);
      expect(payments.map((p) => p.body.amount)).toEqual([30000, 20000]);
    });

    it('показывает тост об успехе', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });

    it('сбрасывает кэши один раз в конце, а не после каждого долга', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).toHaveBeenCalledTimes(1);
      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });

    it('правит кэш только когда пачка отработала, а не до неё', async () => {
      let releasePay!: () => void;
      const gate = new Promise<void>((res) => {
        releasePay = res;
      });
      server.use(
        http.post('*/api/debts/:id/payments', async ({ params }) => {
          await gate;
          return HttpResponse.json({
            debt: { ...mockGivenDebtResponse, id: params.id, isClosed: true, remainingAmount: 0 },
            paymentTransactionId: 'tx-1',
            transactionIds: ['tx-1'],
          });
        }),
      );
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [debt1, debt2]);
      const c = mountComposable();

      const promise = c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      await flushPromises();

      // Платежи ещё идут — экраны, читающие кэш, обязаны видеть оба долга
      expect(queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID))).toHaveLength(2);

      releasePay();
      await promise;
      await flushPromises();

      expect(queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID))).toHaveLength(2);
      expect(
        queryClient
          .getQueryData<Debt[]>(debtQueryKeys.list(USER_ID))
          ?.every((d) => d.is_closed && d.remaining_amount === 0),
      ).toBe(true);
    });

    it('знает общее число долгов до начала работы', async () => {
      const c = mountComposable();
      const promise = c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      expect(c.total.value).toBe(2);
      await promise;
      await flushPromises();
    });

    it('снимает признак работы после завершения', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      expect(c.isClosing.value).toBe(false);
    });

    it('идёт от старых долгов к новым', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt2, debt1], ACCOUNT_ID, USER_ID, { paymentAmount: 30000 });
      await flushPromises();

      // Денег хватает ровно на старший долг — он единственный и оплачивается
      expect(payments).toHaveLength(1);
      expect(payments[0].debtId).toBe('debt-1');
    });
  });

  describe('распределение частичной суммы', () => {
    it('первому долгу — сколько хватит, остальным — что осталось', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, { paymentAmount: 40000 });
      await flushPromises();

      expect(payments.map((p) => [p.debtId, p.body.amount])).toEqual([
        ['debt-1', 30000],
        [debt2.id, 10000],
      ]);
    });

    it('прощает остаток, когда просили', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, {
        paymentAmount: 10000,
        forgiveRemainder: true,
      });
      await flushPromises();

      expect(payments).toHaveLength(2);
      expect(payments.every((p) => p.body.forgiveRemainder === true)).toBe(true);
    });

    it('переплату отдаёт последнему долгу вместе с категорией', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, {
        paymentAmount: 60000,
        excessCategoryId: 'cat-bonus',
      });
      await flushPromises();

      const last = payments[payments.length - 1];
      expect(last.body.amount).toBe(30000);
      expect(last.body.excessCategoryId).toBe('cat-bonus');
    });
  });

  describe('ошибка', () => {
    it('возвращает false и показывает тост', async () => {
      payments = [];
      stubPayments(500);
      const c = mountComposable();

      expect(await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID)).toBe(false);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    });

    it('называет долг, на котором остановились', async () => {
      payments = [];
      stubPayments(500);
      const c = mountComposable();

      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);

      expect(c.error.value).toBe('Ошибка при закрытии долга 1 из 2');
    });

    it('снимает признак работы после провала', async () => {
      payments = [];
      stubPayments(500);
      const c = mountComposable();

      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);

      expect(c.isClosing.value).toBe(false);
    });

    it('перезапрашивает состояние: часть платежей могла пройти', async () => {
      payments = [];
      stubPayments(500);
      const c = mountComposable();

      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);

      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });
  });

  describe('взятые долги', () => {
    it('шлёт такой же платёж — сторону выбирает сервер', async () => {
      const c = mountComposable();
      await c.closeAllDebts([takenDebt], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(payments).toHaveLength(1);
      expect(payments[0].body.amount).toBe(100000);
    });
  });
});
