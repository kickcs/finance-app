import { http, HttpResponse } from 'msw';

export function buildMockDebtResponse(
  body: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `debt-${Date.now()}`,
    userId: 'test-user-1',
    name: body.name,
    totalAmount: body.totalAmount,
    remainingAmount: body.remainingAmount,
    monthlyPayment: null,
    nextPaymentDate: null,
    createdAt: new Date().toISOString(),
    debtType: body.debtType,
    personName: body.personName,
    accountId: body.accountId,
    transactionId: body.transactionId ?? null,
    closeTransactionId: null,
    isClosed: false,
    currency: body.currency,
    sourceTransactionId: body.sourceTransactionId ?? null,
    ...overrides,
  };
}

export const debtHandlers = [
  http.post('*/api/debts', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(buildMockDebtResponse(body));
  }),

  http.get('*/api/debts', () => {
    return HttpResponse.json([]);
  }),
];
