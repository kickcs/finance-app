import { http } from '@/shared/api/http';
import type { AccountBalance } from '@/shared/api/database.types';

export interface AccountBalanceResponse {
  id: string;
  accountId: string;
  currency: string;
  balance: number;
  createdAt: string;
}

export function transformBalance(bal: AccountBalanceResponse): AccountBalance {
  return {
    id: bal.id,
    account_id: bal.accountId,
    currency: bal.currency,
    balance: bal.balance,
    created_at: bal.createdAt,
  };
}

export const accountBalancesApi = {
  async getByAccountId(accountId: string): Promise<AccountBalance[]> {
    const data = await http<AccountBalanceResponse[]>(
      `/api/account-balances/by-account/${accountId}`,
    );
    return data.map(transformBalance);
  },

  async getByAccountIds(accountIds: string[]): Promise<AccountBalance[]> {
    if (accountIds.length === 0) return [];
    const data = await http<AccountBalanceResponse[]>('/api/account-balances/by-accounts', {
      method: 'POST',
      body: JSON.stringify({ accountIds }),
    });
    return data.map(transformBalance);
  },
};
