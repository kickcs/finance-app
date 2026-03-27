import { http, HttpResponse } from 'msw';

export interface MockDebtResponse {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  monthlyPayment: number | null;
  nextPaymentDate: string | null;
  createdAt: string;
  debtType: 'given' | 'taken';
  personName: string;
  accountId: string;
  transactionId: string | null;
  closeTransactionId: string | null;
  isClosed: boolean;
  currency: string;
  sourceTransactionId: string | null;
  description: string | null;
  closedAt: string | null;
  forgivenAmount: number;
  isPrivate: boolean;
}

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
    description: null,
    closedAt: null,
    forgivenAmount: 0,
    isPrivate: false,
    ...overrides,
  };
}

// --- Mock debt objects (camelCase = backend format) ---

export const mockGivenDebtResponse: MockDebtResponse = {
  id: 'debt-1',
  userId: 'test-user-1',
  name: 'Долг от Алексей',
  totalAmount: 50000,
  remainingAmount: 30000,
  monthlyPayment: null,
  nextPaymentDate: null,
  createdAt: '2025-01-15T12:00:00.000Z',
  debtType: 'given',
  personName: 'Алексей',
  accountId: 'acc-1',
  transactionId: 'tx-debt-1',
  closeTransactionId: null,
  isClosed: false,
  currency: 'UZS',
  sourceTransactionId: null,
  description: null,
  closedAt: null,
  forgivenAmount: 0,
  isPrivate: false,
};

export const mockTakenDebtResponse: MockDebtResponse = {
  id: 'debt-2',
  userId: 'test-user-1',
  name: 'Долг для Мария',
  totalAmount: 100000,
  remainingAmount: 100000,
  monthlyPayment: null,
  nextPaymentDate: '2025-03-01T00:00:00.000Z',
  createdAt: '2025-02-01T12:00:00.000Z',
  debtType: 'taken',
  personName: 'Мария',
  accountId: 'acc-1',
  transactionId: 'tx-debt-2',
  closeTransactionId: null,
  isClosed: false,
  currency: 'UZS',
  sourceTransactionId: null,
  description: null,
  closedAt: null,
  forgivenAmount: 0,
  isPrivate: false,
};

export const mockClosedDebtResponse: MockDebtResponse = {
  id: 'debt-3',
  userId: 'test-user-1',
  name: 'Долг от Иван',
  totalAmount: 20000,
  remainingAmount: 0,
  monthlyPayment: null,
  nextPaymentDate: null,
  createdAt: '2025-01-01T12:00:00.000Z',
  debtType: 'given',
  personName: 'Иван',
  accountId: 'acc-1',
  transactionId: 'tx-debt-3',
  closeTransactionId: 'tx-close-3',
  isClosed: true,
  currency: 'UZS',
  sourceTransactionId: null,
  description: null,
  closedAt: '2025-02-01T12:00:00.000Z',
  forgivenAmount: 0,
  isPrivate: false,
};

export const mockOverdueDebtResponse = {
  ...mockTakenDebtResponse,
  id: 'debt-4',
  name: 'Долг для Сергей',
  personName: 'Сергей',
  nextPaymentDate: '2024-01-01T00:00:00.000Z',
};

/** Second given debt from same person (Алексей), for grouped view testing */
export const mockSecondGivenDebtResponse = {
  ...mockGivenDebtResponse,
  id: 'debt-5',
  name: 'Долг от Алексей #2',
  totalAmount: 20000,
  remainingAmount: 20000,
  createdAt: '2025-02-10T12:00:00.000Z',
  transactionId: 'tx-debt-5',
};

export function buildPaginatedDebtsResponse(debts: MockDebtResponse[]) {
  const groupMap = new Map<string, MockDebtResponse[]>();
  for (const debt of debts) {
    const key = `${debt.personName}::${debt.debtType}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(debt);
  }

  const groups = Array.from(groupMap.entries()).map(([key, groupDebts]) => {
    const [personName, debtType] = key.split('::');
    return { personName, debtType, debts: groupDebts };
  });

  const totalGiven: Record<string, number> = {};
  const totalTaken: Record<string, number> = {};
  for (const debt of debts) {
    if (debt.debtType === 'given') {
      totalGiven[debt.currency] = (totalGiven[debt.currency] ?? 0) + debt.remainingAmount;
    } else {
      totalTaken[debt.currency] = (totalTaken[debt.currency] ?? 0) + debt.remainingAmount;
    }
  }

  return {
    groups,
    totalSummary: { totalGiven, totalTaken },
    nextCursor: null,
    hasMore: false,
    totalDebtsCount: debts.length,
  };
}

export const debtHandlers = [
  // GET paginated debts (must be before GET :id to avoid wildcard match)
  http.get('*/api/debts/paginated', () => {
    return HttpResponse.json(buildPaginatedDebtsResponse([]));
  }),

  // GET single debt (must be before GET list to avoid wildcard match)
  http.get('*/api/debts/:id', ({ params }) => {
    const id = params.id as string;
    const allDebts = [
      mockGivenDebtResponse,
      mockTakenDebtResponse,
      mockClosedDebtResponse,
      mockOverdueDebtResponse,
      mockSecondGivenDebtResponse,
    ];
    const found = allDebts.find((d) => d.id === id);
    if (found) return HttpResponse.json(found);
    return HttpResponse.json({ message: 'Not found' }, { status: 404 });
  }),

  http.post('*/api/debts', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(buildMockDebtResponse(body));
  }),

  http.patch('*/api/debts/:id', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...mockGivenDebtResponse,
      id: params.id,
      ...body,
    });
  }),

  http.delete('*/api/debts/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/debts', () => {
    return HttpResponse.json([]);
  }),
];
