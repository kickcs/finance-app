import type { Account } from '../aggregates/account';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/**
 * Account Repository Interface
 */
export interface IAccountRepository {
  findById(id: string): Promise<Account | null>;
  findByUserId(userId: string): Promise<Account[]>;
  findByIdWithBalances(id: string): Promise<Account | null>;
  findAllWithBalances(userId: string): Promise<Account[]>;
  save(account: Account): Promise<Account>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  existsForUser(id: string, userId: string): Promise<boolean>;
  updateOrder(accountIds: string[]): Promise<void>;
}
