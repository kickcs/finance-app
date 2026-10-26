import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { useCloseAllDebts } from './useCloseAllDebts';
import {
  closeAllResultResponse,
  closedDebtResponse,
  mockGivenDebtResponse,
  mockSecondGivenDebtResponse,
  type CloseAllBody,
} from '@/test/mocks/handlers/debts';
import { debtQueryKeys } from '@/entities/debt';
import { queryClient } from '@/shared/api/queryClient';
import { makeDebt } from '@/test/fixtures/debt';
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

const debt1 = makeDebt({
  id: 'debt-1',
  name: 'Долг 1',
  total_amount: 30_000,
  remaining_amount: 30_000,
  created_at: '2025-01-01T00:00:00.000Z',
});
const debt2 = makeDebt({
  id: 'debt-5',
  name: 'Долг 2',
  total_amount: 20_000,
  remaining_amount: 20_000,
  created_at: '2025-02-01T00:00:00.000Z',
});
const takenDebt = makeDebt({
  id: 'taken-1',
  debt_type: 'taken',
  total_amount: 10_000,
  remaining_amount: 10_000,
  created_at: '2025-03-01T00:00:00.000Z',
});
const usdDebt = makeDebt({
  id: 'debt-usd',
  currency: 'USD',
  total_amount: 100,
  remaining_amount: 100,
});

/** Всё, что ушло на сервер по долговым ручкам: «Закрыть все» обязано быть одним запросом. */
let closeAllBodies: CloseAllBody[] = [];
let strayRequests: string[] = [];

function stubCloseAll(response = closeAllResultResponse()) {
  server.use(
    http.post('*/api/debts/close-all', async ({ request }) => {
      closeAllBodies.push((await request.json()) as CloseAllBody);
      return HttpResponse.json(response);
    }),
    http.post('*/api/debts/offset', () => {
      strayRequests.push('offset');
      return HttpResponse.json({});
    }),
    http.post('*/api/debts/:id/payments', () => {
      strayRequests.push('payment');
      return HttpResponse.json({});
    }),
  );
}

function stubCloseAllFailure(status: number, body: unknown = null) {
  server.use(
    http.post('*/api/debts/close-all', () => {
      return HttpResponse.json(body ?? { message: 'Internal error' }, { status });
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
    closeAllBodies = [];
    strayRequests = [];
    queryClient.clear();
    stubCloseAll();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  describe('исходное состояние', () => {
    it('ничего не идёт', () => {
      const c = mountComposable();
      expect(c.isClosing.value).toBe(false);
    });

    it('пустой список закрывать нечего — запроса нет', async () => {
      const c = mountComposable();

      expect(await c.closeAllDebts([], ACCOUNT_ID, USER_ID)).toBe(true);
      expect(closeAllBodies).toHaveLength(0);
    });
  });

  describe('запрос', () => {
    it('один вызов «Закрыть все» вместо зачёта и пачки платежей', async () => {
      const c = mountComposable();

      expect(await c.closeAllDebts([debt1, debt2, takenDebt], ACCOUNT_ID, USER_ID)).toBe(true);

      expect(closeAllBodies).toHaveLength(1);
      expect(strayRequests).toEqual([]);
    });

    it('тело собирается из аргументов: долги, счёт, сумма, прощение, категория, дата', async () => {
      const c = mountComposable();

      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, {
        paymentAmount: 60_000,
        forgiveRemainder: false,
        excessCategoryId: 'cat-bonus',
        transactionDate: '2026-10-01T12:00:00.000Z',
      });

      expect(closeAllBodies[0]).toEqual({
        debtIds: ['debt-1', 'debt-5'],
        accountId: ACCOUNT_ID,
        paymentAmount: 60_000,
        excessCategoryId: 'cat-bonus',
        date: '2026-10-01T12:00:00.000Z',
      });
    });

    it('без опций сумма не уходит вовсе: сервер платит весь остаток', async () => {
      const c = mountComposable();

      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);

      expect(Object.keys(closeAllBodies[0]).sort()).toEqual(['accountId', 'debtIds']);
    });

    it('прощение остатка уходит флагом вместе с суммой', async () => {
      const c = mountComposable();

      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, {
        paymentAmount: 10_000,
        forgiveRemainder: true,
      });

      expect(closeAllBodies[0]).toMatchObject({ paymentAmount: 10_000, forgiveRemainder: true });
    });

    it('разные валюты, «оплатить всё»: суммы в теле нет', async () => {
      const c = mountComposable();

      await c.closeAllDebts([debt1, usdDebt], ACCOUNT_ID, USER_ID, {
        paymentAmount: 30_100,
        forgiveRemainder: false,
      });

      expect(closeAllBodies[0]).toEqual({
        debtIds: ['debt-1', 'debt-usd'],
        accountId: ACCOUNT_ID,
      });
    });

    it('разные валюты, «простить всё»: флаг прощения без суммы', async () => {
      const c = mountComposable();

      await c.closeAllDebts([debt1, usdDebt], ACCOUNT_ID, USER_ID, {
        paymentAmount: 0,
        forgiveRemainder: true,
      });

      expect(closeAllBodies[0]).toEqual({
        debtIds: ['debt-1', 'debt-usd'],
        accountId: ACCOUNT_ID,
        forgiveRemainder: true,
      });
    });
  });

  describe('результат', () => {
    it('отдаёт id первой записи платежа — его ждёт подтверждение импорта', async () => {
      stubCloseAll(closeAllResultResponse({ paymentTransactionIds: ['tx-1', 'tx-2'] }));
      const onTransactionCreated = vi.fn();
      const c = mountComposable();

      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, { onTransactionCreated });

      expect(onTransactionCreated).toHaveBeenCalledTimes(1);
      expect(onTransactionCreated).toHaveBeenCalledWith('tx-1');
    });

    it('если платежей не было (закрыл один зачёт), обратный вызов молчит', async () => {
      stubCloseAll(closeAllResultResponse({ paymentTransactionIds: [], offsetAmount: 10_000 }));
      const onTransactionCreated = vi.fn();
      const c = mountComposable();

      expect(
        await c.closeAllDebts([debt1, takenDebt], ACCOUNT_ID, USER_ID, { onTransactionCreated }),
      ).toBe(true);

      expect(onTransactionCreated).not.toHaveBeenCalled();
    });

    it('показывает тост об успехе', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Все долги закрыты', variant: 'success' }),
      );
    });

    it('тост об успехе можно отключить', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID, { skipSuccessToast: true });
      await flushPromises();

      expect(toastMock).not.toHaveBeenCalled();
    });

    it('сбрасывает кэши один раз в конце', async () => {
      const c = mountComposable();
      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      await flushPromises();

      expect(invalidateDebtRelated).toHaveBeenCalledTimes(1);
      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });

    it('пока расчёт идёт, он помечен идущим; по ответу флаг снимается', async () => {
      const c = mountComposable();
      const promise = c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      expect(c.isClosing.value).toBe(true);

      await promise;
      await flushPromises();

      expect(c.isClosing.value).toBe(false);
    });
  });

  describe('кэш', () => {
    const closed1 = closedDebtResponse({ ...mockGivenDebtResponse, id: 'debt-1' });
    const closed2 = closedDebtResponse({ ...mockSecondGivenDebtResponse, id: 'debt-5' });

    it('идёт из «до» сразу в «после»: пока запрос в полёте, долги на месте', async () => {
      let release!: () => void;
      const gate = new Promise<void>((res) => {
        release = res;
      });
      server.use(
        http.post('*/api/debts/close-all', async () => {
          await gate;
          return HttpResponse.json(closeAllResultResponse({ debts: [closed1, closed2] }));
        }),
      );
      // Singleton: именно его правит composable, а не клиент `renderWithProviders`.
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [debt1, debt2]);
      const c = mountComposable();

      const promise = c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);
      await flushPromises();

      // Экраны, читающие кэш, обязаны по-прежнему видеть оба долга открытыми.
      const before = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(before).toHaveLength(2);
      expect(before?.some((d) => d.is_closed)).toBe(false);

      release();
      await promise;
      await flushPromises();

      const after = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(after).toHaveLength(2);
      expect(after?.every((d) => d.is_closed && d.remaining_amount === 0)).toBe(true);
    });

    it('берёт состояние долгов из ответа сервера, а не считает его сам', async () => {
      // Закрылся один; второй сервер оставил с остатком — клиент это не предсказывал.
      stubCloseAll(
        closeAllResultResponse({
          debts: [
            closed1,
            { ...mockSecondGivenDebtResponse, id: 'debt-5', remainingAmount: 7_000 },
          ],
        }),
      );
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [debt1, debt2]);
      const c = mountComposable();

      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID, { paymentAmount: 43_000 });
      await flushPromises();

      const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID));
      expect(cached?.find((d) => d.id === 'debt-1')?.is_closed).toBe(true);
      expect(cached?.find((d) => d.id === 'debt-5')).toMatchObject({
        is_closed: false,
        remaining_amount: 7_000,
      });
    });
  });

  describe('ошибка', () => {
    it('возвращает false и показывает тост', async () => {
      stubCloseAllFailure(500);
      const c = mountComposable();

      expect(await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID)).toBe(false);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Не удалось закрыть все долги', variant: 'error' }),
      );
    });

    it('заголовок тоста задаёт вызывающий', async () => {
      stubCloseAllFailure(500);
      const c = mountComposable();

      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID, {
        errorToastTitle: 'Не удалось провести платёж',
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Не удалось провести платёж' }),
      );
    });

    it('отказ сервера по правилам объясняется его же текстом', async () => {
      stubCloseAllFailure(400, { message: 'Выберите категорию для переплаты' });
      const c = mountComposable();

      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Выберите категорию для переплаты' }),
      );
    });

    it('не называет «зачёт проведён»: расчёт атомарный, при отказе не записано ничего', async () => {
      stubCloseAllFailure(500);
      const c = mountComposable();

      await c.closeAllDebts([debt1, takenDebt], ACCOUNT_ID, USER_ID);

      expect(toastMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Зачёт проведён, остаток не закрыт' }),
      );
    });

    it('снимает признак работы после провала', async () => {
      stubCloseAllFailure(500);
      const c = mountComposable();

      await c.closeAllDebts([debt1], ACCOUNT_ID, USER_ID);

      expect(c.isClosing.value).toBe(false);
    });

    it('кэш не трогает, но состояние перезапрашивает', async () => {
      stubCloseAllFailure(409, { message: 'Долг уже закрыт' });
      queryClient.setQueryData(debtQueryKeys.list(USER_ID), [debt1, debt2]);
      const c = mountComposable();

      await c.closeAllDebts([debt1, debt2], ACCOUNT_ID, USER_ID);

      expect(
        queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID))?.some((d) => d.is_closed),
      ).toBe(false);
      expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
    });
  });
});
