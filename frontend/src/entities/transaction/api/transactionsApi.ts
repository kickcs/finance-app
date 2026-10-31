import { http } from '@/shared/api/http';
import type {
  Transaction,
  TransactionInsert,
  TransactionUpdate,
} from '@/shared/api/database.types';

/** Поля строки плюс `second_part`: объект меняет вторую часть оплаты, `null` убирает, отсутствие не трогает. */
export type TransactionUpdates = Partial<Transaction> & Pick<TransactionUpdate, 'second_part'>;

export interface PaginatedCursor {
  date: string;
  createdAt: string;
  /** Tiebreaker for rows sharing (date, createdAt); absent in cached legacy cursors. */
  id?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: PaginatedCursor | null;
  hasMore: boolean;
}

export interface TransactionFilters {
  type?: 'income' | 'expense' | 'transfer' | 'debt' | 'adjustment';
  /** Подстрока описания. */
  search?: string;
  /** Идентификаторы-строки: у встроенных категорий id — слаг, не UUID. */
  category_ids?: string[];
  /** Включая входящие переводы на эти счета. */
  account_ids?: string[];
  /** Без `#`. Несколько тегов — «любой из». */
  tags?: string[];
  /** Календарные даты `YYYY-MM-DD`, обе границы включительно. */
  start_date?: string;
  end_date?: string;
}

/** Итог выборки по фильтру: «N операций, K по долгу» и число на кнопке «Изменить все». */
export interface TransactionsSummary {
  count: number;
  /** Сколько строк войдёт в массовую правку; остальные заблокированы (`locked_count`). */
  eligible_count: number;
  locked_count: number;
  /** Суммы по валютам: общей суммы нет. */
  totals: { currency: string; amount: number }[];
  /** Момент сервера, на который посчитан итог; вместе с `count` уходит в массовую правку. */
  as_of: string;
}

export type BulkAction =
  | { kind: 'category'; category_id: string }
  | { kind: 'transfer'; to_account_id: string }
  | { kind: 'account'; account_id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'delete' };

/** Либо ручной выбор, либо вся выборка фильтра со сверкой с показанным итогом. */
export type BulkSelection =
  | { ids: string[] }
  | { filter: TransactionFilters; as_of: string; expected_count: number };

export interface BulkUpdateRequest {
  selection: BulkSelection;
  action: BulkAction;
  /** Предпросмотр: тот же ответ, но ничего не записано. */
  dryRun?: boolean;
}

/** Причины, по которым строка выборки пропущена; тексты — на клиенте. */
export type BulkSkipReason =
  | 'locked'
  | 'wrong_type'
  | 'same_account'
  | 'pair_on_target'
  | 'pair_split'
  | 'already_in_category'
  | 'already_tagged'
  | 'transfer_not_movable';

export interface BulkResult {
  changed: number;
  skipped: { reason: BulkSkipReason; count: number }[];
  balance_deltas: { account_id: string; currency: string; delta: number }[];
  /** Нет у удаления и предпросмотра. */
  undo_token: string | null;
}

interface BulkResultResponse {
  changed: number;
  skipped: { reason: BulkSkipReason; count: number }[];
  balanceDeltas: { accountId: string; currency: string; delta: number }[];
  undoToken?: string | null;
}

interface TransactionsSummaryResponse {
  count: number;
  eligibleCount: number;
  lockedCount: number;
  totals: { currency: string; amount: number }[];
  asOf: string;
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

// Response types from NestJS backend (camelCase)
interface AnalyticsStatsResponse {
  totalIncome: number;
  totalExpense: number;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
  categoryBreakdown: CategoryBreakdownResponse[];
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

interface DailyStatsEntryResponse {
  date: string;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
}

function transformCategoryBreakdown(c: CategoryBreakdownResponse): CategoryBreakdown {
  return {
    category_id: c.categoryId,
    category_name: c.categoryName,
    category_icon: c.categoryIcon,
    category_color: c.categoryColor,
    type: c.type,
    amount: c.amount,
    amount_by_currency: c.amountByCurrency,
  };
}

function transformAnalyticsStats(data: AnalyticsStatsResponse): AnalyticsStats {
  return {
    total_income: data.totalIncome,
    total_expense: data.totalExpense,
    income_by_currency: data.incomeByCurrency,
    expense_by_currency: data.expenseByCurrency,
    category_breakdown: data.categoryBreakdown.map(transformCategoryBreakdown),
  };
}

function transformDailyStatsEntry(entry: DailyStatsEntryResponse): DailyStatsEntry {
  return {
    date: entry.date,
    income_by_currency: entry.incomeByCurrency,
    expense_by_currency: entry.expenseByCurrency,
  };
}

// Response type from NestJS backend (camelCase)
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
  paymentGroupId: string | null;
  settlementId: string | null;
  paymentSibling: { id: string; accountId: string; amount: number } | null;
  /** Отсутствует в ответах до массовой правки. */
  bulkLocked?: boolean;
}

interface MonthlyStatsResponse {
  totalIncome: number;
  totalExpense: number;
  incomeByCurrency: Record<string, number>;
  expenseByCurrency: Record<string, number>;
}

// Transform camelCase to snake_case
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
    payment_group_id: tx.paymentGroupId ?? null,
    settlement_id: tx.settlementId ?? null,
    payment_sibling: tx.paymentSibling
      ? {
          id: tx.paymentSibling.id,
          account_id: tx.paymentSibling.accountId,
          amount: tx.paymentSibling.amount,
        }
      : null,
    bulk_locked: tx.bulkLocked ?? false,
  };
}

const isEmptyValue = (v: unknown) =>
  v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Фильтр в форме сервера без пустых значений: лента, итог и сверка правки видят один и тот же. */
function filtersToServer(filters: TransactionFilters = {}): Record<string, string | string[]> {
  const camel = {
    type: filters.type,
    search: filters.search,
    categoryIds: filters.category_ids,
    accountIds: filters.account_ids,
    tags: filters.tags,
    startDate: filters.start_date,
    endDate: filters.end_date,
  };
  return Object.fromEntries(Object.entries(camel).filter(([, v]) => !isEmptyValue(v))) as Record<
    string,
    string | string[]
  >;
}

/** Списки в query — одним параметром через запятую: в таком виде их разбирает сервер. */
function filtersToParams(filters?: TransactionFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filtersToServer(filters)).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(',') : v,
    ]),
  );
}

function selectionToServer(selection: BulkSelection) {
  return 'ids' in selection
    ? { ids: selection.ids }
    : {
        filter: filtersToServer(selection.filter),
        asOf: selection.as_of,
        expectedCount: selection.expected_count,
      };
}

function actionToServer(action: BulkAction) {
  switch (action.kind) {
    case 'category':
      return { kind: action.kind, categoryId: action.category_id };
    case 'transfer':
      return { kind: action.kind, toAccountId: action.to_account_id };
    case 'account':
      return { kind: action.kind, accountId: action.account_id };
    case 'tag':
    case 'delete':
      return action;
  }
}

function bulkBody(request: BulkUpdateRequest) {
  return {
    selection: selectionToServer(request.selection),
    action: actionToServer(request.action),
    dryRun: request.dryRun,
  };
}

/** Размер тела `POST /transactions/bulk` в байтах — по нему решают, довезёт ли его keepalive. */
export function bulkRequestBytes(request: BulkUpdateRequest): number {
  return new TextEncoder().encode(JSON.stringify(bulkBody(request))).length;
}

function transformBulkResult(data: BulkResultResponse): BulkResult {
  return {
    changed: data.changed,
    skipped: data.skipped,
    balance_deltas: data.balanceDeltas.map((d) => ({
      account_id: d.accountId,
      currency: d.currency,
      delta: d.delta,
    })),
    undo_token: data.undoToken ?? null,
  };
}

import type { Hashtag } from '../model/types';
export type { Hashtag };

export const transactionsApi = {
  async getAll(_userId: string, limit?: number): Promise<Transaction[]> {
    // Backend gets userId from JWT token
    // API returns paginated response { data: [], nextCursor, hasMore }
    const response = await http.get<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>('/transactions', {
      params: { pageSize: limit },
    });
    return response.data.map(transformTransaction);
  },

  async getById(id: string): Promise<Transaction> {
    const data = await http.get<TransactionResponse>(`/transactions/${id}`);
    return transformTransaction(data);
  },

  async getByDateRange(
    _userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Transaction[]> {
    // Backend gets userId from JWT token
    const data = await http.get<TransactionResponse[]>('/transactions/by-date-range', {
      params: { startDate, endDate },
    });
    return data.map(transformTransaction);
  },

  async getByAccount(accountId: string): Promise<Transaction[]> {
    const data = await http.get<TransactionResponse[]>(`/transactions/by-account/${accountId}`);
    return data.map(transformTransaction);
  },

  async getByAccountWithIncoming(accountId: string): Promise<Transaction[]> {
    const data = await http.get<TransactionResponse[]>(
      `/transactions/by-account/${accountId}/with-incoming`,
    );
    return data.map(transformTransaction);
  },

  async create(transaction: TransactionInsert): Promise<Transaction> {
    // Backend gets userId from JWT token
    const data = await http.post<TransactionResponse>('/transactions', {
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
      secondPart: transaction.second_part && {
        accountId: transaction.second_part.account_id,
        amount: transaction.second_part.amount,
      },
    });
    return transformTransaction(data);
  },

  async adjustBalance(params: {
    accountId: string;
    targetBalance: number;
    currency: string;
    date?: string;
    description?: string;
  }): Promise<Transaction> {
    const data = await http.post<TransactionResponse>('/transactions/adjust-balance', {
      accountId: params.accountId,
      targetBalance: params.targetBalance,
      currency: params.currency,
      date: params.date,
      description: params.description,
    });
    return transformTransaction(data);
  },

  async update(id: string, updates: TransactionUpdates): Promise<Transaction> {
    const data = await http.patch<TransactionResponse>(`/transactions/${id}`, {
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
      // null снимает вторую часть, undefined (ключ пропадает из JSON) её не трогает.
      secondPart: updates.second_part && {
        accountId: updates.second_part.account_id,
        amount: updates.second_part.amount,
      },
    });
    return transformTransaction(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/transactions/${id}`);
  },

  async getPaginated(
    _userId: string,
    pageSize: number = 20,
    cursor?: PaginatedCursor,
    filters?: TransactionFilters,
  ): Promise<PaginatedResult<Transaction>> {
    // Backend gets userId from JWT token
    const data = await http.get<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>('/transactions', {
      params: {
        pageSize,
        cursorDate: cursor?.date,
        cursorCreatedAt: cursor?.createdAt,
        cursorId: cursor?.id,
        ...filtersToParams(filters),
      },
    });
    return {
      data: data.data.map(transformTransaction),
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    };
  },

  async getSummary(filters?: TransactionFilters): Promise<TransactionsSummary> {
    const data = await http.get<TransactionsSummaryResponse>('/transactions/summary', {
      params: filtersToParams(filters),
    });
    return {
      count: data.count,
      eligible_count: data.eligibleCount,
      locked_count: data.lockedCount,
      totals: data.totals,
      as_of: data.asOf,
    };
  },

  /** `keepalive` — запрос переживёт закрытие страницы (тело до ~64 КБ). */
  async bulkUpdate(
    request: BulkUpdateRequest,
    options?: { keepalive?: boolean },
  ): Promise<BulkResult> {
    const data = await http.post<BulkResultResponse>('/transactions/bulk', bulkBody(request), {
      keepalive: options?.keepalive,
    });
    return transformBulkResult(data);
  },

  async undoBulk(undoToken: string): Promise<{ restored: number }> {
    return http.post<{ restored: number }>('/transactions/bulk/undo', { undoToken });
  },

  async getByAccountPaginated(
    accountId: string,
    pageSize: number = 20,
    cursor?: PaginatedCursor,
  ): Promise<PaginatedResult<Transaction>> {
    const data = await http.get<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>(`/transactions/by-account/${accountId}/paginated`, {
      params: {
        pageSize,
        cursorDate: cursor?.date,
        cursorCreatedAt: cursor?.createdAt,
        cursorId: cursor?.id,
      },
    });
    return {
      data: data.data.map(transformTransaction),
      nextCursor: data.nextCursor,
      hasMore: data.hasMore,
    };
  },

  async getMonthlyStats(_userId: string, year: number, month: number): Promise<MonthlyStats> {
    // Backend gets userId from JWT token
    const data = await http.get<MonthlyStatsResponse>('/transactions/stats/monthly', {
      params: { year, month },
    });
    return {
      total_income: data.totalIncome,
      total_expense: data.totalExpense,
      income_by_currency: data.incomeByCurrency,
      expense_by_currency: data.expenseByCurrency,
    };
  },

  async getAnalyticsStats(options: AnalyticsOptions): Promise<AnalyticsStats> {
    // Backend gets userId from JWT token
    const params: Record<string, string | undefined> = {
      startDate: options.startDate,
      endDate: options.endDate,
    };
    if (options.accountIds && options.accountIds.length > 0) {
      params.accountIds = options.accountIds.join(',');
    }
    const data = await http.get<AnalyticsStatsResponse>('/transactions/stats/analytics', {
      params,
    });
    return transformAnalyticsStats(data);
  },

  async getDailyStats(options: DailyStatsOptions): Promise<DailyStatsEntry[]> {
    const params: Record<string, string | undefined> = {
      startDate: options.startDate,
      endDate: options.endDate,
      groupBy: options.groupBy,
    };
    if (options.accountIds && options.accountIds.length > 0) {
      params.accountIds = options.accountIds.join(',');
    }
    const data = await http.get<DailyStatsEntryResponse[]>('/transactions/stats/daily', { params });
    return data.map(transformDailyStatsEntry);
  },

  async getHashtags(): Promise<Hashtag[]> {
    return http.get<Hashtag[]>('/transactions/hashtags');
  },

  async countByAccount(accountId: string): Promise<number> {
    const data = await http.get<{ count: number }>(`/transactions/by-account/${accountId}/count`);
    return data.count;
  },

  async getByDebtId(debtId: string): Promise<Transaction[]> {
    const response = await http.get<{
      data: TransactionResponse[];
      nextCursor: PaginatedCursor | null;
      hasMore: boolean;
    }>('/transactions', {
      params: { debtId, pageSize: 100 },
    });
    return response.data.map(transformTransaction);
  },
};
