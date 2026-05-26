import { http } from '@/shared/api/http';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';
import {
  type AccountBalanceResponse,
  transformBalance,
} from '@/entities/account-balance/api/accountBalancesApi';

interface AccountResponse {
  id: string;
  userId: string;
  name: string;
  balance: number;
  currency: string;
  icon: string;
  color: string;
  type: 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit';
  order: number;
  createdAt: string;
  creditLimit: number | null;
  gracePeriodDays: number | null;
  billingDay: number | null;
  totalAmount: number | null;
  interestRate: number | null;
  monthlyPayment: number | null;
  startDate: string | null;
  endDate: string | null;
  maturityDate: string | null;
  isReplenishable: boolean | null;
  isWithdrawable: boolean | null;
}

function transformAccountBase(acc: AccountResponse) {
  return {
    id: acc.id,
    user_id: acc.userId,
    name: acc.name,
    icon: acc.icon,
    color: acc.color,
    type: acc.type,
    order: acc.order,
    created_at: acc.createdAt,
    credit_limit: acc.creditLimit,
    grace_period_days: acc.gracePeriodDays,
    billing_day: acc.billingDay,
    total_amount: acc.totalAmount,
    interest_rate: acc.interestRate,
    monthly_payment: acc.monthlyPayment,
    start_date: acc.startDate,
    end_date: acc.endDate,
    maturity_date: acc.maturityDate,
    is_replenishable: acc.isReplenishable,
    is_withdrawable: acc.isWithdrawable,
  };
}

function transformAccount(acc: AccountResponse): Account {
  return {
    ...transformAccountBase(acc),
    balance: acc.balance,
    currency: acc.currency,
  };
}

function transformAccountWithBalances(
  acc: AccountResponse & { balances: AccountBalanceResponse[] },
): AccountWithBalances {
  return {
    ...transformAccountBase(acc),
    balances: acc.balances?.map(transformBalance) ?? [],
  };
}

export const accountsApi = {
  async getAll(): Promise<Account[]> {
    const data = await http<AccountResponse[]>('/api/accounts');
    return data.map(transformAccount);
  },

  async getAllWithBalances(): Promise<AccountWithBalances[]> {
    const data = await http<(AccountResponse & { balances: AccountBalanceResponse[] })[]>(
      '/api/accounts',
    );
    return data.map(transformAccountWithBalances);
  },

  async getById(accountId: string): Promise<Account> {
    const data = await http<AccountResponse>(`/api/accounts/${accountId}`);
    return transformAccount(data);
  },

  async create(input: {
    name: string;
    icon: string;
    color: string;
    type: Account['type'];
    balance: number;
    currency: string;
  }): Promise<Account> {
    const data = await http<AccountResponse>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        icon: input.icon,
        color: input.color,
        type: input.type,
        order: 0,
        balances: [{ currency: input.currency, balance: input.balance }],
      }),
    });
    return transformAccount(data);
  },

  async update(id: string, updates: Partial<Account>): Promise<Account> {
    const data = await http<AccountResponse>(`/api/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: updates.name,
        icon: updates.icon,
        color: updates.color,
        type: updates.type,
        order: updates.order,
      }),
    });
    return transformAccount(data);
  },

  async delete(id: string): Promise<void> {
    await http(`/api/accounts/${id}`, { method: 'DELETE' });
  },
};
