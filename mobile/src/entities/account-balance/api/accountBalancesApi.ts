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
