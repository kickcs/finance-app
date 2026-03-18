import { http, HttpResponse } from 'msw';

export const mockBudgetResponse = {
  budget: {
    id: 'budget-1',
    userId: 'test-user-1',
    year: null,
    month: null,
    amount: 1000000,
    currency: 'UZS',
    isDefault: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  spent: 250000,
  remaining: 750000,
  percentage: 25,
};

export const budgetHandlers = [
  http.get('*/api/budgets/current', () => {
    return HttpResponse.json(null);
  }),

  http.put('*/api/budgets/default', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      budget: {
        ...mockBudgetResponse.budget,
        amount: body.amount,
      },
    });
  }),

  http.put('*/api/budgets/override', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      budget: {
        ...mockBudgetResponse.budget,
        year: body.year,
        month: body.month,
        amount: body.amount,
        isDefault: false,
      },
    });
  }),

  http.delete('*/api/budgets/override/:year/:month', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
