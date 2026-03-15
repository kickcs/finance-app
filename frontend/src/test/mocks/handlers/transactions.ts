import { http, HttpResponse } from 'msw';

export const mockTransactionResponse = {
  id: 'tx-1',
  userId: 'test-user-1',
  accountId: 'acc-1',
  categoryId: 'cat-groceries',
  amount: 25000,
  currency: 'UZS',
  type: 'expense',
  description: null,
  date: '2025-06-01T00:00:00.000Z',
  createdAt: '2025-06-01T12:00:00.000Z',
  isDebtRelated: false,
  debtId: null,
  toAccountId: null,
  toAmount: null,
  toCurrency: null,
  returnedAmount: 0,
  netAmount: 25000,
  hasDebtReturns: false,
};

export const mockAccountTransactionResponse = {
  ...mockTransactionResponse,
  id: 'tx-acc-1',
  accountId: 'acc-1',
  amount: 15000,
  description: 'Покупка в магазине',
  date: '2025-06-15T00:00:00.000Z',
  createdAt: '2025-06-15T10:00:00.000Z',
};

export const transactionHandlers = [
  // Account-specific paginated (must be before general /transactions)
  http.get('*/api/transactions/by-account/:id/count', () => {
    return HttpResponse.json({ count: 0 });
  }),

  http.get('*/api/transactions/by-account/:id/paginated', () => {
    return HttpResponse.json({
      data: [],
      nextCursor: null,
      hasMore: false,
    });
  }),

  // Hashtags (must be before general /transactions to match first)
  http.get('*/api/transactions/hashtags', () => {
    return HttpResponse.json([]);
  }),

  // Paginated transactions list (also used for recent/getAll)
  http.get('*/api/transactions', () => {
    return HttpResponse.json({
      data: [],
      nextCursor: null,
      hasMore: false,
    });
  }),

  // Monthly stats
  http.get('*/api/transactions/stats/monthly', () => {
    return HttpResponse.json({
      totalIncome: 0,
      totalExpense: 0,
      incomeByCurrency: {},
      expenseByCurrency: {},
    });
  }),

  // Adjust balance
  http.post('*/api/transactions/adjust-balance', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockTransactionResponse,
      id: `tx-adjust-${Date.now()}`,
      type: 'adjustment',
      categoryId: 'adjustment',
      amount: body.targetBalance,
      accountId: body.accountId,
      currency: body.currency,
      description: body.description ?? 'Корректировка баланса',
    });
  }),

  // Create transaction
  http.post('*/api/transactions', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockTransactionResponse,
      id: `tx-${Date.now()}`,
      accountId: body.accountId,
      categoryId: body.categoryId,
      amount: body.amount,
      currency: body.currency,
      type: body.type,
      description: body.description,
      date: body.date,
      toAccountId: body.toAccountId ?? null,
      toAmount: body.toAmount ?? null,
      toCurrency: body.toCurrency ?? null,
    });
  }),

  // Delete transaction (rollback)
  http.delete('*/api/transactions/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
