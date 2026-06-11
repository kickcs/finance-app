import type { EntityManager } from 'typeorm';
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
  /** Pass `manager` to participate in an open DB transaction. */
  save(account: Account, manager?: EntityManager): Promise<Account>;
  delete(id: string, manager?: EntityManager): Promise<void>;
  exists(id: string): Promise<boolean>;
  existsForUser(id: string, userId: string): Promise<boolean>;
  updateOrder(accountIds: string[]): Promise<void>;
}
