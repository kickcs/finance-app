export const ACCOUNT_BALANCE_REPOSITORY = Symbol('ACCOUNT_BALANCE_REPOSITORY');

export interface AccountBalanceData {
  id: string;
  accountId: string;
  currency: string;
  balance: number;
  createdAt: Date;
}

export interface IAccountBalanceRepository {
  findByAccountId(accountId: string): Promise<AccountBalanceData[]>;
  findByAccountIds(accountIds: string[]): Promise<AccountBalanceData[]>;
  findByAccountIdAndCurrency(
    accountId: string,
    currency: string,
  ): Promise<AccountBalanceData | null>;
  upsert(accountId: string, currency: string, balance: number): Promise<AccountBalanceData>;
  createMany(
    accountId: string,
    balances: { currency: string; balance: number }[],
  ): Promise<AccountBalanceData[]>;
  updateByDelta(
    accountId: string,
    currency: string,
    delta: number,
  ): Promise<AccountBalanceData | null>;
  delete(accountId: string, currency: string): Promise<void>;
  deleteByAccountId(accountId: string): Promise<void>;
}
