import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { usePayDebt } from './usePayDebt';
import { mockGivenDebtResponse, mockTakenDebtResponse } from '@/test/mocks/handlers/debts';
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

function makeDebt(
  partial: Partial<Record<keyof typeof mockGivenDebtResponse, unknown>> = {},
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
    debt_type: raw.debtType,
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
  currency: 'UZS',
});

/** Ответ сервера на платёж: он же — источник нового состояния долга. */
function payResponse(over: Partial<typeof mockGivenDebtResponse> = {}, ids = ['tx-pay-1']) {
  return {
    debt: { ...mockGivenDebtResponse, id: 'debt-1', ...over },
    paymentTransactionId: ids[0] ?? null,
    transactionIds: ids,
  };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;
let lastBody: Record<string, unknown> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof usePayDebt>;
  const Stub = defineComponent({
    setup() {
      result = usePayDebt();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

/** Перехватывает эндпоинт платежа и запоминает отправленное тело. */
function stubPayEndpoint(body: Record<string, unknown> | null, status = 200) {
  server.use(
    http.post('*/api/debts/:id/payments', async ({ request }) => {
      lastBody = (await request.json()) as Record<string, unknown>;
      if (status !== 200) return new HttpResponse(null, { status });
      return HttpResponse.json(body);
    }),
  );
}

describe('usePayDebt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastBody = null;
    queryClient.clear();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  describe('проверки перед отправкой', () => {
    it('отрицательная сумма не уходит на сервер', async () => {
      const api = mountComposable();
      expect(await api.payDebt(givenDebt, -100, ACCOUNT_ID, USER_ID)).toBe(false);
      expect(api.error.value).toBe('Некорректная сумма платежа');
      expect(lastBody).toBeNull();
    });

    it('ноль без прощения бессмысленен', async () => {
      const api = mountComposable();
      expect(await api.payDebt(givenDebt, 0, ACCOUNT_ID, USER_ID)).toBe(false);
      expect(api.error.value).toBe('Некорректная сумма платежа');
    });

    it('переплата без категории останавливается с подсказкой', async () => {
      const api = mountComposable();
      expect(await api.payDebt(givenDebt, 40000, ACCOUNT_ID, USER_ID)).toBe(false);
      expect(api.error.value).toBe('Выберите категорию для переплаты');
      expect(lastBody).toBeNull();
    });

    it('ноль с прощением проходит', async () => {
      stubPayEndpoint(payResponse({ isClosed: true, remainingAmount: 0, forgivenAmount: 30000 }));
      const api = mountComposable();

      expect(await api.payDebt(givenDebt, 0, ACCOUNT_ID, USER_ID, { forgiveRemainder: true })).toBe(
        true,
      );
    });
  });

  describe('запрос', () => {
    it('уходит одним вызовом со всеми параметрами платежа', async () => {
      stubPayEndpoint(payResponse({ remainingAmount: 20000 }));
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID, {
        forgiveRemainder: false,
        transactionDate: '2026-08-01T10:00:00.000Z',
      });

      expect(lastBody).toEqual({
        amount: 10000,
        accountId: ACCOUNT_ID,
        date: '2026-08-01T10:00:00.000Z',
        forgiveRemainder: false,
      });
    });

    it('переносит категорию переплаты', async () => {
      stubPayEndpoint(payResponse({ isClosed: true, remainingAmount: 0 }, ['tx-1', 'tx-2']));
      const api = mountComposable();

      await api.payDebt(givenDebt, 40000, ACCOUNT_ID, USER_ID, { excessCategoryId: 'cat-bonus' });

      expect(lastBody?.excessCategoryId).toBe('cat-bonus');
    });

    it('по взятому долгу шлёт тот же запрос — сторону выбирает сервер', async () => {
      stubPayEndpoint({
        debt: { ...mockTakenDebtResponse, id: 'debt-2', remainingAmount: 50000 },
        paymentTransactionId: 'tx-pay-2',
        transactionIds: ['tx-pay-2'],
      });
      const api = mountComposable();

      expect(await api.payDebt(takenDebt, 50000, ACCOUNT_ID, USER_ID)).toBe(true);
      expect(lastBody?.amount).toBe(50000);
    });
  });

  describe('состояние после платежа', () => {
    it('кладёт в кэш долг, который вернул сервер', async () => {
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [givenDebt]);
      stubPayEndpoint(payResponse({ remainingAmount: 20000, totalAmount: 50000 }));
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(cached?.[0].remaining_amount).toBe(20000);
    });

    it('отдаёт id записи платежа', async () => {
      stubPayEndpoint(payResponse({ remainingAmount: 20000 }, ['tx-pay-42']));
      const api = mountComposable();
      const onTransactionCreated = vi.fn();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID, { onTransactionCreated });

      expect(onTransactionCreated).toHaveBeenCalledWith('tx-pay-42');
    });

    it('не зовёт onTransactionCreated, когда платежа не было', async () => {
      stubPayEndpoint({
        debt: { ...mockGivenDebtResponse, id: 'debt-1', isClosed: true, remainingAmount: 0 },
        paymentTransactionId: null,
        transactionIds: ['tx-forgive'],
      });
      const api = mountComposable();
      const onTransactionCreated = vi.fn();

      await api.payDebt(givenDebt, 0, ACCOUNT_ID, USER_ID, {
        forgiveRemainder: true,
        onTransactionCreated,
      });

      expect(onTransactionCreated).not.toHaveBeenCalled();
    });

    it('сбрасывает связанные кэши и показывает тост', async () => {
      stubPayEndpoint(payResponse({ remainingAmount: 20000 }));
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Платёж проведён', variant: 'success' }),
      );
    });

    it('снимает признак «в полёте» после завершения', async () => {
      stubPayEndpoint(payResponse({ remainingAmount: 20000 }));
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      expect(api.isPaying.value).toBe(false);
    });
  });

  describe('долг закрыли раньше', () => {
    it('409 — платёж не нужен, а не провалился', async () => {
      stubPayEndpoint(null, 409);
      const api = mountComposable();

      expect(await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID)).toBe(true);
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Долг уже закрыт' }));
    });

    it('снимает оптимистичную правку, а не оставляет призрачный платёж', async () => {
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [givenDebt]);
      stubPayEndpoint(null, 409);
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(cached?.[0].remaining_amount).toBe(30000);
    });
  });

  describe('ошибка', () => {
    it('возвращает false, откатывает кэш и перезапрашивает состояние', async () => {
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [givenDebt]);
      stubPayEndpoint(null, 500);
      const api = mountComposable();

      expect(await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID)).toBe(false);
      expect(api.error.value).toBe('Не удалось внести платёж');
      const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(cached?.[0].remaining_amount).toBe(30000);
      // Запись могла долететь до сервера — состояние переспрашивается
      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });

    it('показывает тост об ошибке', async () => {
      stubPayEndpoint(null, 500);
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID);

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Не удалось внести платёж', variant: 'error' }),
      );
    });
  });

  describe('пачка платежей', () => {
    it('не трогает кэш и не показывает тост — это делает вызывающий', async () => {
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [givenDebt]);
      stubPayEndpoint(payResponse({ remainingAmount: 20000 }));
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID, { bulk: true });

      expect(invalidateDebtRelated).not.toHaveBeenCalled();
      expect(toastMock).not.toHaveBeenCalled();
    });

    it('не правит остаток и по успешному ответу — иначе долги пропадали бы по одному', async () => {
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [givenDebt]);
      stubPayEndpoint(payResponse({ remainingAmount: 20000 }));
      const api = mountComposable();

      await api.payDebt(givenDebt, 10000, ACCOUNT_ID, USER_ID, { bulk: true });

      const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(cached?.[0].remaining_amount).toBe(givenDebt.remaining_amount);
    });
  });
});
