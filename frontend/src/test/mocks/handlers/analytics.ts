import { http, HttpResponse } from 'msw';

export const mockAnalyticsStatsResponse = {
  totalIncome: 0,
  totalExpense: 0,
  incomeByCurrency: {},
  expenseByCurrency: {},
  categoryBreakdown: [],
};

export const mockAnalyticsWithDataResponse = {
  totalIncome: 500000,
  totalExpense: 250000,
  incomeByCurrency: { UZS: 500000 },
  expenseByCurrency: { UZS: 250000 },
  categoryBreakdown: [
    {
      categoryId: 'cat-groceries',
      categoryName: 'Продукты',
      categoryIcon: 'shopping_basket',
      categoryColor: '#10b981',
      type: 'expense' as const,
      amount: 150000,
      amountByCurrency: { UZS: 150000 },
    },
    {
      categoryId: 'cat-transport',
      categoryName: 'Транспорт',
      categoryIcon: 'directions_car',
      categoryColor: '#3b82f6',
      type: 'expense' as const,
      amount: 100000,
      amountByCurrency: { UZS: 100000 },
    },
  ],
};

export const analyticsHandlers = [
  http.get('*/api/transactions/stats/analytics', () => {
    return HttpResponse.json(mockAnalyticsStatsResponse);
  }),
];
