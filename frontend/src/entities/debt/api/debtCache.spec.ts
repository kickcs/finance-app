import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, type InfiniteData } from '@tanstack/vue-query';
import {
  snapshotDebtCaches,
  restoreDebtCaches,
  applyDebtUpdate,
  applyDebtRemove,
  buildDebtPaymentPatch,
} from './debtCache';
import { debtQueryKeys } from './queryKeys';
import type { Debt } from '@/shared/api/database.types';
import type { PaginatedDebtsResult } from '../model/types';

const USER_ID = 'user-1';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    user_id: USER_ID,
    name: 'Долг от Алишер',
    total_amount: 100,
    remaining_amount: 100,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алишер',
    account_id: 'acc-1',
    transaction_id: 'tx-1',
    close_transaction_id: null,
    is_closed: false,
    currency: 'USD',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    ...overrides,
  };
}

const debtA = makeDebt({ id: 'debt-a', remaining_amount: 100 });
const debtB = makeDebt({
  id: 'debt-b',
  person_name: 'Бек',
  name: 'Долг для Бек',
  debt_type: 'taken',
  remaining_amount: 50,
  currency: 'UZS',
});
const debtC = makeDebt({ id: 'debt-c', remaining_amount: 30 });

function makeInfiniteData(): InfiniteData<PaginatedDebtsResult> {
  return {
    pages: [
      {
        groups: [
          { person_name: 'Алишер', debt_type: 'given', debts: [debtA, debtC] },
          { person_name: 'Бек', debt_type: 'taken', debts: [debtB] },
        ],
        totalSummary: { totalGiven: { USD: 130 }, totalTaken: { UZS: 50 } },
        nextCursor: null,
        hasMore: false,
        totalDebtsCount: 3,
      },
    ],
    pageParams: [undefined],
  };
}

const activeKey = debtQueryKeys.infinite(USER_ID, { status: 'active' });
const listKey = debtQueryKeys.list(USER_ID);

function seed(queryClient: QueryClient) {
  queryClient.setQueryData<Debt[]>(listKey, [debtA, debtB, debtC]);
  queryClient.setQueryData(activeKey, makeInfiniteData());
}

function getInfinite(queryClient: QueryClient): InfiniteData<PaginatedDebtsResult> {
  return queryClient.getQueryData(activeKey)!;
}

describe('debtCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    seed(queryClient);
  });

  describe('applyDebtUpdate — partial payment', () => {
    it('decreases remaining_amount in list and infinite caches', () => {
      applyDebtUpdate(queryClient, 'debt-a', { remaining_amount: 60 });

      const list = queryClient.getQueryData<Debt[]>(listKey)!;
      expect(list.find((d) => d.id === 'debt-a')?.remaining_amount).toBe(60);

      const page = getInfinite(queryClient).pages[0];
      const group = page.groups.find((g) => g.person_name === 'Алишер')!;
      expect(group.debts.find((d) => d.id === 'debt-a')?.remaining_amount).toBe(60);
    });

    it('subtracts the payment delta from totalSummary for the debt currency/type', () => {
      applyDebtUpdate(queryClient, 'debt-a', { remaining_amount: 60 });

      const page = getInfinite(queryClient).pages[0];
      expect(page.totalSummary.totalGiven.USD).toBe(90); // 130 - 40
      expect(page.totalSummary.totalTaken.UZS).toBe(50); // untouched
      expect(page.totalDebtsCount).toBe(3); // not closed — count unchanged
    });

    it('uses the taken bucket for taken debts', () => {
      applyDebtUpdate(queryClient, 'debt-b', { remaining_amount: 20 });

      const page = getInfinite(queryClient).pages[0];
      expect(page.totalSummary.totalTaken.UZS).toBe(20); // 50 - 30
      expect(page.totalSummary.totalGiven.USD).toBe(130);
    });
  });

  describe('applyDebtUpdate — closing a debt', () => {
    it('removes the debt from active-status groups and decrements totalDebtsCount', () => {
      applyDebtUpdate(queryClient, 'debt-a', { remaining_amount: 0, is_closed: true });

      const page = getInfinite(queryClient).pages[0];
      const group = page.groups.find((g) => g.person_name === 'Алишер')!;
      expect(group.debts.map((d) => d.id)).toEqual(['debt-c']);
      expect(page.totalDebtsCount).toBe(2);
      expect(page.totalSummary.totalGiven.USD).toBe(30); // 130 - 100
    });

    it('drops a group that becomes empty', () => {
      applyDebtUpdate(queryClient, 'debt-b', { remaining_amount: 0, is_closed: true });

      const page = getInfinite(queryClient).pages[0];
      expect(page.groups.find((g) => g.person_name === 'Бек')).toBeUndefined();
      expect(page.totalSummary.totalTaken.UZS).toBe(0);
    });

    it('keeps the debt (patched in place) in the plain list cache', () => {
      applyDebtUpdate(queryClient, 'debt-a', { remaining_amount: 0, is_closed: true });

      const list = queryClient.getQueryData<Debt[]>(listKey)!;
      const debt = list.find((d) => d.id === 'debt-a');
      expect(debt?.is_closed).toBe(true);
      expect(debt?.remaining_amount).toBe(0);
    });

    it('updates closed debts in place in closed-status caches', () => {
      const closedKey = debtQueryKeys.infinite(USER_ID, { status: 'closed' });
      const closedDebt = makeDebt({ id: 'debt-z', is_closed: true, remaining_amount: 0 });
      queryClient.setQueryData(closedKey, {
        pages: [
          {
            groups: [{ person_name: 'Алишер', debt_type: 'given', debts: [closedDebt] }],
            totalSummary: { totalGiven: {}, totalTaken: {} },
            nextCursor: null,
            hasMore: false,
            totalDebtsCount: 1,
          },
        ],
        pageParams: [undefined],
      } satisfies InfiniteData<PaginatedDebtsResult>);

      applyDebtUpdate(queryClient, 'debt-z', { is_private: true });

      const page =
        queryClient.getQueryData<InfiniteData<PaginatedDebtsResult>>(closedKey)!.pages[0];
      expect(page.groups[0].debts[0].is_private).toBe(true);
      expect(page.totalDebtsCount).toBe(1);
    });
  });

  describe('applyDebtUpdate — misc', () => {
    it('leaves caches untouched when the debt is not present (filtered-out cache)', () => {
      const filteredKey = debtQueryKeys.infinite(USER_ID, { status: 'active', currency: 'EUR' });
      const emptyData: InfiniteData<PaginatedDebtsResult> = {
        pages: [
          {
            groups: [],
            totalSummary: { totalGiven: {}, totalTaken: {} },
            nextCursor: null,
            hasMore: false,
            totalDebtsCount: 0,
          },
        ],
        pageParams: [undefined],
      };
      queryClient.setQueryData(filteredKey, emptyData);

      applyDebtUpdate(queryClient, 'debt-a', { remaining_amount: 60 });

      expect(queryClient.getQueryData(filteredKey)).toEqual(emptyData);
    });

    it('does not change totalSummary for non-amount updates', () => {
      applyDebtUpdate(queryClient, 'debt-a', { is_private: true });

      const page = getInfinite(queryClient).pages[0];
      expect(page.totalSummary.totalGiven.USD).toBe(130);
      expect(
        page.groups.find((g) => g.person_name === 'Алишер')!.debts.find((d) => d.id === 'debt-a')
          ?.is_private,
      ).toBe(true);
    });
  });

  describe('applyDebtRemove', () => {
    it('removes the debt from all caches and adjusts summary/count', () => {
      applyDebtRemove(queryClient, 'debt-a');

      const list = queryClient.getQueryData<Debt[]>(listKey)!;
      expect(list.map((d) => d.id)).toEqual(['debt-b', 'debt-c']);

      const page = getInfinite(queryClient).pages[0];
      const group = page.groups.find((g) => g.person_name === 'Алишер')!;
      expect(group.debts.map((d) => d.id)).toEqual(['debt-c']);
      expect(page.totalDebtsCount).toBe(2);
      expect(page.totalSummary.totalGiven.USD).toBe(30);
    });
  });

  describe('buildDebtPaymentPatch', () => {
    const debt = makeDebt({ remaining_amount: 100 });

    it('partial payment decreases remaining without closing', () => {
      expect(buildDebtPaymentPatch(debt, 40, false)).toEqual({
        remaining_amount: 60,
        is_closed: false,
      });
    });

    it('full payment closes the debt and stamps closed_at', () => {
      const patch = buildDebtPaymentPatch(debt, 100, false);
      expect(patch.remaining_amount).toBe(0);
      expect(patch.is_closed).toBe(true);
      expect(patch.closed_at).toEqual(expect.any(String));
    });

    it('overpayment closes the debt', () => {
      expect(buildDebtPaymentPatch(debt, 150, false).is_closed).toBe(true);
    });

    it('forgiving the remainder closes the debt and records forgiven_amount', () => {
      const patch = buildDebtPaymentPatch(debt, 30, true);
      expect(patch.remaining_amount).toBe(0);
      expect(patch.is_closed).toBe(true);
      expect(patch.forgiven_amount).toBe(70);
    });

    it('forgiveness with overpayment never records negative forgiven_amount', () => {
      expect(buildDebtPaymentPatch(debt, 120, true).forgiven_amount).toBe(0);
    });
  });

  describe('snapshot / restore', () => {
    it('restores all debt caches to the snapshotted state', async () => {
      const snapshot = await snapshotDebtCaches(queryClient);

      applyDebtUpdate(queryClient, 'debt-a', { remaining_amount: 0, is_closed: true });
      applyDebtRemove(queryClient, 'debt-b');

      restoreDebtCaches(queryClient, snapshot);

      expect(queryClient.getQueryData<Debt[]>(listKey)).toEqual([debtA, debtB, debtC]);
      expect(getInfinite(queryClient)).toEqual(makeInfiniteData());
    });
  });
});
