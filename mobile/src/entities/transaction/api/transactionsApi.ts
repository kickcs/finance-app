import { http } from '@/shared/api/http';
import type { Transaction, TransactionInsert } from '@/shared/api/database.types';

/**
 * Backend derives `user_id` from JWT, so callers don't supply it.
 * Mirrors how the Vue frontend posts to /api/transactions.
 */
export type TransactionCreateInput = Omit<TransactionInsert, 'user_id' | 'id' | 'created_at'>;

export interface PaginatedCursor {
  date: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: PaginatedCursor | null;
  hasMore: boolean;
}

export interface TransactionFilters {
  type?: 'income' | 'expense' | 'transfer' | 'debt' | 'adjustment';
  accountId?: string;
  categoryId?: string;
  search?: string;
}

export interface MonthlyStats {
  total_income: number;
  total_expense: number;
  income_by_currency: Record<string, number>;
  expense_by_currency: Record<string, number>;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  type: 'income' | 'expense';
  amount: number;
  amount_by_currency: Record<string, number>;
}

export interface AnalyticsStats {
  total_income: number;
  total_expense: number;
  income_by_currency: Record<string, number>;
  expense_by_currency: Record<string, number>;
  category_breakdown: CategoryBreakdown[];
}

export interface AnalyticsOptions {
  startDate: string;
  endDate: string;
  accountIds?: string[];
}

export interface DailyStatsEntry {
  date: string;
  income_by_currency: Record<string, number>;
  expense_by_currency: Record<string, number>;
}

export interface DailyStatsOptions {
  startDate: string;
  endDate: string;
  accountIds?: string[];
  groupBy?: 'day' | 'week' | 'month';
}

interface CategoryBreakdownResponse {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  type: 'income' | 'expense';
  amount: number;
  amountByCurrency: Record<string, number>;
}

interface AnalyticsStatsResponse {
  totalIncome: number;
  totalExpense: number;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
  categoryBreakdown: CategoryBreakdownResponse[];
}

interface DailyStatsEntryResponse {
  date: string;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
}

interface TransactionResponse {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  description: string | null;
  date: string;
  createdAt: string;
  isDebtRelated: boolean;
  isInformational: boolean;
  debtId: string | null;
  toAccountId: string | null;
  toAmount: number | null;
  toCurrency: string | null;
  returnedAmount: number;
  netAmount: number;
  hasDebtReturns: boolean;
}

interface MonthlyStatsResponse {
  totalIncome: number;
  totalExpense: number;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
}

function transformTransaction(tx: TransactionResponse): Transaction {
  return {
    id: tx.id,
    user_id: tx.userId,
    account_id: tx.accountId,
    category_id: tx.categoryId,
    amount: tx.amount,
    currency: tx.currency,
    type: tx.type,
    description: tx.description,
    date: tx.date,
    created_at: tx.createdAt,
    is_debt_related: tx.isDebtRelated,
    is_informational: tx.isInformational,
    debt_id: tx.debtId,
    to_account_id: tx.toAccountId,
    to_amount: tx.toAmount,
    to_currency: tx.toCurrency,
    returned_amount: tx.returnedAmount,
    net_amount: tx.netAmount,
    has_debt_returns: tx.hasDebtReturns,
  };
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const transactionsApi = {
  async getAll(limit?: number): Promise<Transaction[]> {
    const qs = buildQuery({ pageSize: limit ?? null });
    const response = await http<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>(`/api/transactions${qs}`);
    return response.data.map(transformTransaction);
  },

  async getById(id: string): Promise<Transaction> {
    const data = await http<TransactionResponse>(`/api/transactions/${id}`);
    return transformTransaction(data);
  },

  async getPaginated(
    pageSize = 20,
    cursor?: PaginatedCursor,
    filters?: TransactionFilters,
  ): Promise<PaginatedResult<Transaction>> {
    const qs = buildQuery({
      pageSize,
      cursorDate: cursor?.date,
      cursorCreatedAt: cursor?.createdAt,
      type: filters?.type,
      accountId: filters?.accountId,
      categoryId: filters?.categoryId,
      search: filters?.search,
    });
    const data = await http<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>(`/api/transactions${qs}`);
    return {
      data: data.data.map(transformTransaction),
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    };
  },

  async getByAccountPaginated(
    accountId: string,
    pageSize = 20,
    cursor?: PaginatedCursor,
  ): Promise<PaginatedResult<Transaction>> {
    const qs = buildQuery({
      pageSize,
      cursorDate: cursor?.date,
      cursorCreatedAt: cursor?.createdAt,
    });
    const data = await http<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>(`/api/transactions/by-account/${accountId}/paginated${qs}`);
    return {
      data: data.data.map(transformTransaction),
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    };
  },

  async getAnalyticsStats(options: AnalyticsOptions): Promise<AnalyticsStats> {
    const qs = buildQuery({
      startDate: options.startDate,
      endDate: options.endDate,
      accountIds:
        options.accountIds && options.accountIds.length > 0
          ? options.accountIds.join(',')
          : undefined,
    });
    const data = await http<AnalyticsStatsResponse>(
      `/api/transactions/stats/analytics${qs}`,
    );
    return {
      total_income: data.totalIncome,
      total_expense: data.totalExpense,
      income_by_currency: data.incomeByCurrency,
      expense_by_currency: data.expenseByCurrency,
      category_breakdown: data.categoryBreakdown.map((c) => ({
        category_id: c.categoryId,
        category_name: c.categoryName,
        category_icon: c.categoryIcon,
        category_color: c.categoryColor,
        type: c.type,
        amount: c.amount,
        amount_by_currency: c.amountByCurrency,
      })),
    };
  },

  async getDailyStats(options: DailyStatsOptions): Promise<DailyStatsEntry[]> {
    const qs = buildQuery({
      startDate: options.startDate,
      endDate: options.endDate,
      groupBy: options.groupBy,
      accountIds:
        options.accountIds && options.accountIds.length > 0
          ? options.accountIds.join(',')
          : undefined,
    });
    const data = await http<DailyStatsEntryResponse[]>(
      `/api/transactions/stats/daily${qs}`,
    );
    return data.map((entry) => ({
      date: entry.date,
      income_by_currency: entry.incomeByCurrency,
      expense_by_currency: entry.expenseByCurrency,
    }));
  },

  async getMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
    const qs = buildQuery({ year, month });
    const data = await http<MonthlyStatsResponse>(`/api/transactions/stats/monthly${qs}`);
    return {
      total_income: data.totalIncome,
      total_expense: data.totalExpense,
      income_by_currency: data.incomeByCurrency,
      expense_by_currency: data.expenseByCurrency,
    };
  },

  async adjustBalance(params: {
    accountId: string;
    targetBalance: number;
    currency: string;
    date?: string;
    description?: string;
  }): Promise<Transaction> {
    const data = await http<TransactionResponse>('/api/transactions/adjust-balance', {
      method: 'POST',
      body: JSON.stringify({
        accountId: params.accountId,
        targetBalance: params.targetBalance,
        currency: params.currency,
        date: params.date,
        description: params.description,
      }),
    });
    return transformTransaction(data);
  },

  async create(transaction: TransactionCreateInput): Promise<Transaction> {
    const data = await http<TransactionResponse>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        accountId: transaction.account_id,
        categoryId: transaction.category_id,
        amount: transaction.amount,
        currency: transaction.currency,
        type: transaction.type,
        description: transaction.description,
        date: transaction.date,
        isDebtRelated: transaction.is_debt_related ?? false,
        isInformational: transaction.is_informational ?? false,
        debtId: transaction.debt_id,
        toAccountId: transaction.to_account_id,
        toAmount: transaction.to_amount,
        toCurrency: transaction.to_currency,
        feeAmount: transaction.fee_amount,
      }),
    });
    return transformTransaction(data);
  },

  async update(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const data = await http<TransactionResponse>(`/api/transactions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        accountId: updates.account_id,
        categoryId: updates.category_id,
        amount: updates.amount,
        currency: updates.currency,
        type: updates.type,
        description: updates.description,
        date: updates.date,
        isDebtRelated: updates.is_debt_related,
        debtId: updates.debt_id,
        toAccountId: updates.to_account_id,
        toAmount: updates.to_amount,
        toCurrency: updates.to_currency,
      }),
    });
    return transformTransaction(data);
  },

  async delete(id: string): Promise<void> {
    await http(`/api/transactions/${id}`, { method: 'DELETE' });
  },
};
