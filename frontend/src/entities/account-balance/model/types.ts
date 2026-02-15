export type { AccountBalance } from '@/shared/api/database.types';

export interface CurrencyBalance {
  currency: string;
  balance: number;
}

export interface AccountBalanceUpdate {
  accountId: string;
  currency: string;
  balance: number;
}
