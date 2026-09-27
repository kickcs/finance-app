import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { mountComposable, createTestQueryClient, mockUser } from '@/test/test-utils';
import { useBudget } from './useBudget';
import { budgetQueryKeys } from './queryKeys';
import type { BudgetCurrentResponse } from '../model/types';

const USER_ID = mockUser.id;

function mockBudget(amount: number, spent: number): BudgetCurrentResponse {
  return {
    budget: {
      id: 'budget-1',
      userId: USER_ID,
      year: null,
      month: null,
      amount,
      currency: 'UZS',
      isDefault: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    spent,
    remaining: amount - spent,
    percentage: (spent / amount) * 100,
  };
}

let currentWrapper: ReturnType<typeof mountComposable>['wrapper'] | null = null;

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

describe('useBudget', () => {
  it('patches amount, remaining and percentage optimistically before the request settles', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(budgetQueryKeys.current(USER_ID), mockBudget(1000000, 250000));

    server.use(
      http.put('*/api/budgets/default', async ({ request }) => {
        await new Promise((r) => setTimeout(r, 30));
        const body = (await request.json()) as { amount: number };
        return HttpResponse.json({
          budget: { ...mockBudget(1000000, 250000).budget, amount: body.amount },
        });
      }),
    );

    const { result, wrapper } = mountComposable(() => useBudget(USER_ID), {
      queryClient,
      provideAuth: { user: mockUser },
    });
    currentWrapper = wrapper;

    const pending = result.setDefault(2000000);
    await new Promise((r) => setTimeout(r, 10));

    expect(result.budget.value?.budget.amount).toBe(2000000);
    expect(result.budget.value?.remaining).toBe(1750000);
    expect(result.budget.value?.percentage).toBeCloseTo(12.5);

    await pending;
  });

  it('rolls back the optimistic patch when setDefault fails', async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(budgetQueryKeys.current(USER_ID), mockBudget(1000000, 250000));

    server.use(
      http.put('*/api/budgets/default', () =>
        HttpResponse.json({ message: 'error' }, { status: 500 }),
      ),
      // Resync after rollback must agree with the rolled-back value.
      http.get('*/api/budgets/current', () => HttpResponse.json(mockBudget(1000000, 250000))),
    );

    const { result, wrapper } = mountComposable(() => useBudget(USER_ID), {
      queryClient,
      provideAuth: { user: mockUser },
    });
    currentWrapper = wrapper;

    await result.setDefault(2000000).catch(() => {});

    expect(result.budget.value?.budget.amount).toBe(1000000);
  });
});
