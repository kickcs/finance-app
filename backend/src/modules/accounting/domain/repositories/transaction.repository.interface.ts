import type { Transaction } from '../aggregates/transaction';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: { date: string; createdAt: string } | null;
  hasMore: boolean;
}

export interface PaginationOptions {
  pageSize: number;
  cursorDate?: string;
  cursorCreatedAt?: string;
  type?: string;
  accountId?: string;
  categoryId?: string;
  search?: string;
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
  findByAccountIdWithIncoming(accountId: string): Promise<Transaction[]>;
  findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]>;
  save(transaction: Transaction): Promise<Transaction>;
  delete(id: string): Promise<void>;
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
    cursor?: { date: string; createdAt: string },
  ): Promise<PaginatedResult<Transaction>>;
  getByAccountPaginated(
    accountId: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string },
  ): Promise<PaginatedResult<Transaction>>;

  // Statistics
  getMonthlyStats(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthlyStats>;

  getAnalyticsStats(
    userId: string,
    options: AnalyticsOptions,
  ): Promise<AnalyticsStats>;
}
