import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, createTestQueryClient } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import {
  mockGivenDebtResponse,
  mockTakenDebtResponse,
  type MockDebtResponse,
} from '@/test/mocks/handlers/debts';
import { debtQueryKeys } from './queryKeys';
import { useDebtMutations } from './useDebtMutations';
import type { Debt } from '@/shared/api/database.types';

vi.mock('@/shared/api/invalidation', () => ({
  invalidateDebtRelated: vi.fn().mockResolvedValue(undefined),
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateDebtRelated } from '@/shared/api/invalidation';

const USER_ID = 'test-user-1';
const GIVEN_ID = mockGivenDebtResponse.id;
const TAKEN_ID = mockTakenDebtResponse.id;

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountMutations() {
  const queryClient = createTestQueryClient();
  let api!: ReturnType<typeof useDebtMutations>;
  const Stub = defineComponent({
    setup() {
      api = useDebtMutations(USER_ID);
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub, { queryClient });
  return { api, queryClient };
}

function seedList(queryClient: ReturnType<typeof createTestQueryClient>, debts: Debt[]) {
  queryClient.setQueryData(debtQueryKeys.list(USER_ID, 'active'), debts);
}

function toDebt(response: MockDebtResponse): Debt {
  return {
    id: response.id,
    user_id: response.userId,
    name: response.name,
    total_amount: response.totalAmount,
    remaining_amount: response.remainingAmount,
    monthly_payment: response.monthlyPayment,
    next_payment_date: response.nextPaymentDate,
    created_at: response.createdAt,
    debt_type: response.debtType,
    person_name: response.personName,
    account_id: response.accountId,
    transaction_id: response.transactionId,
    close_transaction_id: response.closeTransactionId,
    is_closed: response.isClosed,
    currency: response.currency,
    source_transaction_id: response.sourceTransactionId,
    description: response.description,
    closed_at: response.closedAt,
    forgiven_amount: response.forgivenAmount,
    is_private: response.isPrivate,
    fee_amount: response.feeAmount,
  };
}

describe('useDebtMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    server.resetHandlers();
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  it('после правки сбрасывает не только долги, но и всё, что за ними тянется', async () => {
    const { api } = mountMutations();

    await api.updateDebt(GIVEN_ID, { description: 'новая заметка' });
    await flushPromises();

    expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  it('после удаления сбрасывает те же кэши', async () => {
    const { api } = mountMutations();

    await api.deleteDebt(GIVEN_ID);
    await flushPromises();

    expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  it('оптимистично убирает удалённый долг из списка', async () => {
    const { api, queryClient } = mountMutations();
    seedList(queryClient, [toDebt(mockGivenDebtResponse), toDebt(mockTakenDebtResponse)]);

    await api.deleteDebt(GIVEN_ID);

    const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID, 'active'));
    expect(cached?.map((d) => d.id)).toEqual([TAKEN_ID]);
  });

  it('возвращает список в прежний вид, когда сервер отказал', async () => {
    server.use(http.delete('*/api/debts/:id', () => new HttpResponse(null, { status: 500 })));
    const { api, queryClient } = mountMutations();
    seedList(queryClient, [toDebt(mockGivenDebtResponse)]);

    await expect(api.deleteDebt(GIVEN_ID)).rejects.toThrow();

    const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID, 'active'));
    expect(cached?.map((d) => d.id)).toEqual([GIVEN_ID]);
  });

  it('зачёт кладёт в кэш остатки, которые посчитал сервер', async () => {
    server.use(
      http.post('*/api/debts/offset', () =>
        HttpResponse.json({
          personName: 'Азиз',
          currency: 'UZS',
          offsetAmount: 500,
          debts: [
            { ...mockGivenDebtResponse, remainingAmount: 0, isClosed: true },
            { ...mockTakenDebtResponse, remainingAmount: 250 },
          ],
        }),
      ),
    );
    const { api, queryClient } = mountMutations();
    seedList(queryClient, [toDebt(mockGivenDebtResponse), toDebt(mockTakenDebtResponse)]);

    const result = await api.offsetDebts('Азиз', 'UZS');

    expect(result.offset_amount).toBe(500);
    const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID, 'active'));
    // Погашенная сторона из активных ушла, встречная осталась с новым остатком
    expect(cached?.map((d) => [d.id, d.remaining_amount])).toEqual([[TAKEN_ID, 250]]);
    expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  it('отмена закрытия применяет вернувшийся долг', async () => {
    server.use(
      http.post('*/api/debts/:id/reopen', () =>
        HttpResponse.json({ ...mockGivenDebtResponse, isClosed: false, remainingAmount: 700 }),
      ),
    );
    const { api, queryClient } = mountMutations();
    seedList(queryClient, [toDebt(mockGivenDebtResponse)]);

    await api.reopenDebt(GIVEN_ID);

    const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID, 'active'));
    expect(cached?.[0].remaining_amount).toBe(700);
  });

  it('созданный долг сразу виден в плоском списке', async () => {
    const { api, queryClient } = mountMutations();
    seedList(queryClient, []);

    await api.createDebt({
      name: 'Долг от Азиза',
      total_amount: 1000,
      remaining_amount: 1000,
      debt_type: 'given',
      person_name: 'Азиз',
      currency: 'UZS',
    });

    const cached = queryClient.getQueryData<Debt[]>(debtQueryKeys.list(USER_ID, 'active'));
    expect(cached).toHaveLength(1);
    expect(invalidateDebtRelated).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });
});
