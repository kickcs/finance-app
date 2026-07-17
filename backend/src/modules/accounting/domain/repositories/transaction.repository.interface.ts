import type { EntityManager } from 'typeorm';
import type { Transaction } from '../aggregates/transaction';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface PaginatedCursor {
  date: string;
  createdAt: string;
  /** Unique tiebreaker: rows can share (date, createdAt), e.g. after bulk import. */
  id: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: PaginatedCursor | null;
  hasMore: boolean;
}

export interface PaginationOptions {
  pageSize: number;
  cursorDate?: string;
  cursorCreatedAt?: string;
  cursorId?: string;
  type?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
  debtId?: string;
}

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  type: 'income' | 'expense';
  amount: number;
  amountByCurrency: Record<string, number>;
}

export interface AnalyticsStats {
  totalIncome: number;
  totalExpense: number;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
  categoryBreakdown: CategoryBreakdown[];
}

export interface AnalyticsOptions {
  startDate: Date;
  endDate: Date;
  accountIds?: string[];
}

export interface DailyStatsOptions {
  startDate: Date;
  endDate: Date;
  accountIds?: string[];
  groupBy?: 'day' | 'week' | 'month';
}

export interface DailyStatsEntry {
  date: string;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
}

export interface HashtagResult {
  tag: string;
  count: number;
}

export interface TransactionWithReturns extends Transaction {
  returnedAmount: number;
}

/**
 * Transaction Repository Interface
 */
export interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string, limit?: number): Promise<Transaction[]>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByAccountIdWithIncoming(accountId: string, limit?: number): Promise<Transaction[]>;
  findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]>;
  /** Pass `manager` to participate in an open DB transaction. */
  save(transaction: Transaction, manager?: EntityManager): Promise<Transaction>;
  saveMany(transactions: Transaction[], manager?: EntityManager): Promise<Transaction[]>;
  delete(id: string, manager?: EntityManager): Promise<void>;
  deleteByAccountId(accountId: string, manager?: EntityManager): Promise<void>;
  countByAccountId(accountId: string): Promise<number>;
  exists(id: string): Promise<boolean>;

  // Paginated queries
  getPaginated(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TransactionWithReturns>>;
  searchPaginated(
    userId: string,
    searchTerm: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string; id?: string },
  ): Promise<PaginatedResult<Transaction>>;
  getByAccountPaginated(
    accountId: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string; id?: string },
  ): Promise<PaginatedResult<Transaction>>;

  // Statistics
  getMonthlyStats(
    userId: string,
    year: number,
    month: number,
    startDay?: number,
    timezone?: string,
  ): Promise<MonthlyStats>;

  getAnalyticsStats(userId: string, options: AnalyticsOptions): Promise<AnalyticsStats>;

  getDailyStats(userId: string, options: DailyStatsOptions): Promise<DailyStatsEntry[]>;

  getHashtags(userId: string): Promise<HashtagResult[]>;
}
