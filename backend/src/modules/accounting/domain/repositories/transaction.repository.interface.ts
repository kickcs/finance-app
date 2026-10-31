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

/**
 * Фильтр истории: один и тот же для ленты, итога и массовой правки, чтобы число в плашке
 * совпадало со строками, которые лента отдаст при прокрутке до конца.
 */
export interface TransactionFilter {
  /** `income` | `expense` | `transfer` | `debt`. */
  type?: string;
  /** Старый фильтр по одному счёту: смотрит только `account_id`, входящие переводы не ловит. */
  accountId?: string;
  categoryId?: string;
  search?: string;
  debtId?: string;
  /** Идентификаторы категорий — строки, не UUID: у встроенных категорий id-слаги. */
  categoryIds?: string[];
  /** Счёт-источник или счёт-получатель перевода. */
  accountIds?: string[];
  /** Теги без `#`, регистр не важен. */
  tags?: string[];
  /** Начало и конец периода — моменты времени, границы включаются. */
  startDate?: Date;
  endDate?: Date;
  /** Только строки, созданные не позже этого момента (сверка массовой правки с итогом). */
  asOf?: Date;
}

export interface PaginationOptions extends TransactionFilter {
  pageSize: number;
  cursorDate?: string;
  cursorCreatedAt?: string;
  cursorId?: string;
}

/** Итог по фильтру: строки считаются так же, как их отдаёт лента (пара оплаты — две строки). */
export interface TransactionsSummary {
  count: number;
  lockedCount: number;
  /** По валютам: доход плюс, расход минус; перевод и информационная строка дают 0. */
  totals: { currency: string; amount: number }[];
}

/** Строка массовой правки и признак «вне правки» (`lockedForBulkSql`), посчитанный в том же запросе. */
export interface BulkRow {
  transaction: Transaction;
  locked: boolean;
}

/** Что правит массовая операция: все строки фильтра на момент `asOf` или перечисленные id. */
export type BulkSelection =
  | { kind: 'filter'; filter: TransactionFilter; maxRows: number }
  | { kind: 'ids'; ids: string[] };

export interface BulkSelectionResult {
  /** Строки выборки (не позиции), по возрастанию id. */
  selected: BulkRow[];
  /** Вторые половины пар оплаты, которых нет в выборке. */
  siblings: BulkRow[];
  /** Для `ids`: id, которых нет ни у кого. */
  missingIds: string[];
  /** Для `ids`: id, которые есть, но чужие. */
  foreignIds: string[];
  /** Для `filter`: подходящих строк больше `maxRows`; `selected` пуст. */
  overLimit: boolean;
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
  /** У части оплаты с двух счетов — её доля возвратов группы. */
  returnedAmount: number;
  paymentSibling: Transaction | null;
  /** Строка вне массовой правки (предикат `lockedForBulkSql`). */
  bulkLocked: boolean;
}

/**
 * Transaction Repository Interface
 */
export interface ITransactionRepository {
  /** Pass `manager` to read inside an open DB transaction. */
  findById(id: string, manager?: EntityManager): Promise<Transaction | null>;
  findByUserId(userId: string, limit?: number): Promise<Transaction[]>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByAccountIdWithIncoming(accountId: string, limit?: number): Promise<Transaction[]>;
  findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]>;
  /** Pass `manager` to participate in an open DB transaction. */
  save(transaction: Transaction, manager?: EntityManager): Promise<Transaction>;
  saveMany(transactions: Transaction[], manager?: EntityManager): Promise<Transaction[]>;
  delete(id: string, manager?: EntityManager): Promise<void>;
  deleteMany(ids: readonly string[], manager?: EntityManager): Promise<void>;
  deleteByAccountId(accountId: string, manager?: EntityManager): Promise<void>;
  countByAccountId(accountId: string): Promise<number>;
  exists(id: string): Promise<boolean>;
  /**
   * Вторые части оплат с двух счетов одним запросом: id транзакции → её пара.
   * Строки без группы и без найденной пары в карту не попадают.
   */
  findPaymentSiblings(
    transactions: Transaction[],
    manager?: EntityManager,
  ): Promise<Map<string, Transaction>>;
  findPaymentSibling(
    transaction: Transaction,
    manager?: EntityManager,
  ): Promise<Transaction | null>;

  /**
   * Выборка массовой правки теми же условиями, что у ленты и итога. С `lock` строки и вторые
   * половины пар запираются в порядке id (нужна открытая транзакция), без него — чтение для предпросмотра.
   */
  findForBulk(
    userId: string,
    selection: BulkSelection,
    manager: EntityManager,
    options: { lock: boolean },
  ): Promise<BulkSelectionResult>;
  /** Свои строки по id под `FOR UPDATE`, в порядке id; чужих и отсутствующих в результате нет. */
  findByIdsForUpdate(
    ids: readonly string[],
    userId: string,
    manager: EntityManager,
  ): Promise<Transaction[]>;

  // Paginated queries
  getPaginated(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TransactionWithReturns>>;
  getSummary(userId: string, filter: TransactionFilter): Promise<TransactionsSummary>;
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
