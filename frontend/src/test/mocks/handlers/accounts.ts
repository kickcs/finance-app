import { http, HttpResponse } from 'msw';

export const mockAccountResponse = {
  id: 'acc-1',
  userId: 'test-user-1',
  name: 'Основной',
  balance: 50000,
  currency: 'UZS',
  icon: 'account_balance_wallet',
  color: '#10b981',
  type: 'basic',
  order: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  creditLimit: null,
  gracePeriodDays: null,
  billingDay: null,
  totalAmount: null,
  interestRate: null,
  monthlyPayment: null,
  startDate: null,
  endDate: null,
  maturityDate: null,
  isReplenishable: null,
  isWithdrawable: null,
  balances: [
    {
      id: 'bal-1',
      accountId: 'acc-1',
      currency: 'UZS',
      balance: 50000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

export const mockSecondAccountResponse = {
  ...mockAccountResponse,
  id: 'acc-2',
  name: 'Накопления',
  balance: 1000,
  currency: 'USD',
  icon: 'savings',
  color: '#3b82f6',
  type: 'savings' as const,
  order: 1,
  balances: [
    {
      id: 'bal-2',
      accountId: 'acc-2',
      currency: 'USD',
      balance: 1000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

export const mockCreditCardAccountResponse = {
  ...mockAccountResponse,
  id: 'acc-3',
  name: 'Кредитная карта',
  icon: 'credit_card',
  color: '#ef4444',
  type: 'credit_card' as const,
  order: 2,
  creditLimit: 500000,
  gracePeriodDays: 55,
  billingDay: 15,
  balances: [
    {
      id: 'bal-3',
      accountId: 'acc-3',
      currency: 'UZS',
      balance: -120000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

export const mockLoanAccountResponse = {
  ...mockAccountResponse,
  id: 'acc-4',
  name: 'Ипотека',
  icon: 'real_estate_agent',
  color: '#f59e0b',
  type: 'loan' as const,
  order: 3,
  totalAmount: 50000000,
  interestRate: 22,
  monthlyPayment: 650000,
  startDate: '2024-01-15',
  endDate: '2034-01-15',
  balances: [
    {
      id: 'bal-4',
      accountId: 'acc-4',
      currency: 'UZS',
      balance: -45000000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

export const mockDepositAccountResponse = {
  ...mockAccountResponse,
  id: 'acc-5',
  name: 'Вклад Сбережения',
  icon: 'savings',
  color: '#8b5cf6',
  type: 'deposit' as const,
  order: 4,
  interestRate: 15,
  maturityDate: '2026-06-01',
  isReplenishable: true,
  isWithdrawable: false,
  balances: [
    {
      id: 'bal-5',
      accountId: 'acc-5',
      currency: 'UZS',
      balance: 10000000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

export const accountHandlers = [
  http.get('*/api/accounts', () => {
    return HttpResponse.json([mockAccountResponse]);
  }),

  http.patch('*/api/accounts/:id', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...mockAccountResponse, ...body });
  }),

  http.delete('*/api/accounts/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/accounts/reorder', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
