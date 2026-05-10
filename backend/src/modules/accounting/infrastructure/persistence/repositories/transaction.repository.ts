import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Transaction } from '../../../domain/aggregates/transaction';
import {
  ITransactionRepository,
  PaginatedResult,
  PaginationOptions,
  MonthlyStats,
  AnalyticsStats,
  AnalyticsOptions,
  DailyStatsOptions,
  DailyStatsEntry,
  CategoryBreakdown,
  TransactionWithReturns,
  HashtagResult,
} from '../../../domain/repositories/transaction.repository.interface';
import { TransactionOrmEntity } from '../typeorm/transaction.orm-entity';
import { CategoryOrmEntity } from '../typeorm/category.orm-entity';
// Cross-context import: debt ORM entity used for returned-amount read-model queries.
import { DebtOrmEntity } from '../../../../debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { TransactionMapper } from '../mappers/transaction.mapper';
import {
  getDefaultCategoryById,
  DEBT_CATEGORY_IDS,
  ALL_DEBT_CATEGORY_IDS,
} from '../../../domain/constants/default-categories';
import { getFinancialMonthBounds } from '../../../../../shared/utils/financial-period';

/** Shared query parameters for debt category filtering. */
const DEBT_PARAMS = {
  debtIds: ALL_DEBT_CATEGORY_IDS,
  debtGivenId: DEBT_CATEGORY_IDS.GIVEN,
  debtTakenId: DEBT_CATEGORY_IDS.TAKEN,
  debtReturnToMeId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
  debtReturnFromMeId: DEBT_CATEGORY_IDS.RETURN_FROM_ME,
} as const;

/** Raw row shape returned by the debt-aware conditional SUM queries. */
interface DebtBreakdownRow {
  regularIncome: string | null;
  regularExpense: string | null;
  debtGiven: string | null;
  debtTaken: string | null;
  debtReturnsToMe: string | null;
  debtReturnsFromMe: string | null;
}

const parseDecimal = (v: string | null | undefined): number => Number(v ?? 0);

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly ormRepository: Repository<TransactionOrmEntity>,
    @InjectRepository(CategoryOrmEntity)
    private readonly categoryRepository: Repository<CategoryOrmEntity>,
  ) {}

  async findById(id: string): Promise<Transaction | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });

    if (!ormEntity) {
      return null;
    }

    return TransactionMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string, limit?: number): Promise<Transaction[]> {
    const query = this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.created_at', 'DESC');

    if (limit) {
      query.limit(limit);
    }

    const ormEntities = await query.getMany();
    return ormEntities.map((entity) => TransactionMapper.toDomain(entity));
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    const ormEntities = await this.ormRepository.find({
      where: { accountId },
      order: { date: 'DESC' },
      take: 1000,
    });

    return ormEntities.map((entity) => TransactionMapper.toDomain(entity));
  }

  async findByAccountIdWithIncoming(accountId: string, limit = 100): Promise<Transaction[]> {
    // Parallel queries with shared limit, merge + sort in JS (bounded by limit)
    const [outgoing, incoming] = await Promise.all([
      this.ormRepository
        .createQueryBuilder('t')
        .where('t.account_id = :accountId', { accountId })
        .orderBy('t.date', 'DESC')
        .addOrderBy('t.created_at', 'DESC')
        .limit(limit)
        .getMany(),
      this.ormRepository
        .createQueryBuilder('t')
        .where('t.to_account_id = :accountId', { accountId })
        .andWhere('t.type = :type', { type: 'transfer' })
        .orderBy('t.date', 'DESC')
        .addOrderBy('t.created_at', 'DESC')
        .limit(limit)
        .getMany(),
    ]);

    return this.mergeByDateDesc(outgoing, incoming, limit).map((entity) =>
      TransactionMapper.toDomain(entity),
    );
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    const ormEntities = await this.ormRepository.find({
      where: {
        userId,
        date: Between(startDate, endDate),
      },
      order: { date: 'DESC' },
      take: 1000,
    });

    return ormEntities.map((entity) => TransactionMapper.toDomain(entity));
  }

  async save(transaction: Transaction): Promise<Transaction> {
    const ormEntity = TransactionMapper.toOrm(transaction);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return TransactionMapper.toDomain(savedEntity);
  }

  async saveMany(transactions: Transaction[]): Promise<Transaction[]> {
    if (transactions.length === 0) return [];
    const ormEntities = transactions.map((t) => TransactionMapper.toOrm(t));

    // Chunk to stay within PostgreSQL's ~32767 parameter limit.
    // Each transaction has ~15 columns, so 500 rows per chunk is safe.
    const CHUNK_SIZE = 500;
    const saved: TransactionOrmEntity[] = [];
    for (let i = 0; i < ormEntities.length; i += CHUNK_SIZE) {
      const chunk = ormEntities.slice(i, i + CHUNK_SIZE);
      const result = await this.ormRepository.save(chunk);
      saved.push(...result);
    }

    return saved.map((entity) => TransactionMapper.toDomain(entity));
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async deleteByAccountId(accountId: string): Promise<void> {
    // Delete outgoing transactions and incoming transfers in parallel
    await Promise.all([
      this.ormRepository.delete({ accountId }),
      this.ormRepository.delete({ toAccountId: accountId, type: 'transfer' }),
    ]);
  }

  async countByAccountId(accountId: string): Promise<number> {
    const [outgoing, incoming] = await Promise.all([
      this.ormRepository.count({ where: { accountId } }),
      this.ormRepository.count({
        where: { toAccountId: accountId, type: 'transfer' },
      }),
    ]);
    return outgoing + incoming;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }

  async getPaginated(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TransactionWithReturns>> {
    let query = this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.created_at', 'DESC')
      .limit(options.pageSize);

    if (options.cursorDate && options.cursorCreatedAt) {
      query = query.andWhere(
        '(t.date < :cursorDate OR (t.date = :cursorDate AND t.created_at < :cursorCreatedAt))',
        {
          cursorDate: options.cursorDate,
          cursorCreatedAt: options.cursorCreatedAt,
        },
      );
    }

    if (options.type) {
      if (options.type === 'debt') {
        query = query.andWhere('t.is_debt_related = true');
      } else {
        query = query
          .andWhere('t.type = :type', { type: options.type })
          .andWhere('t.is_debt_related = false');
      }
    }

    if (options.accountId) {
      query = query.andWhere('t.account_id = :accountId', {
        accountId: options.accountId,
      });
    }

    if (options.categoryId) {
      query = query.andWhere('t.category_id = :categoryId', {
        categoryId: options.categoryId,
      });
    }

    if (options.search) {
      query = query.andWhere('t.description ILIKE :search', {
        search: `%${options.search}%`,
      });
    }

    if (options.debtId) {
      query = query.andWhere('t.debt_id = :debtId', { debtId: options.debtId });
    }

    const items = await query.getMany();

    // Calculate returned amounts for expense transactions via debt returns
    const returnedAmountsMap: Record<string, number> = {};
    const transactionIds = items.map((t) => t.id);

    if (transactionIds.length > 0) {
      const returnedAmountsResult = await this.ormRepository
        .createQueryBuilder('return_tx')
        .innerJoin(
          DebtOrmEntity,
          'd',
          '(return_tx.debt_id IS NOT NULL AND return_tx.debt_id = d.id) OR (return_tx.debt_id IS NULL AND d.close_transaction_id = return_tx.id)',
        )
        .innerJoin(
          TransactionOrmEntity,
          'source_tx',
          'source_tx.id = COALESCE(d.source_transaction_id, d.transaction_id)',
        )
        .where('source_tx.id IN (:...transactionIds)', { transactionIds })
        .andWhere('return_tx.category_id = :returnToMeId', {
          returnToMeId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
        })
        .select('source_tx.id', 'sourceTransactionId')
        .addSelect('SUM(return_tx.amount)', 'returnedAmount')
        .groupBy('source_tx.id')
        .getRawMany<{ sourceTransactionId: string; returnedAmount: string }>();

      for (const row of returnedAmountsResult) {
        returnedAmountsMap[row.sourceTransactionId] = Number(row.returnedAmount);
      }
    }

    const lastItem = items[items.length - 1];

    const dataWithReturns: TransactionWithReturns[] = items.map((entity) => {
      const domain = TransactionMapper.toDomain(entity);
      const returnedAmount = returnedAmountsMap[entity.id] ?? 0;
      return Object.assign(domain, {
        returnedAmount,
      }) as TransactionWithReturns;
    });

    // If filtering by expense type, exclude transactions where netAmount <= 0
    let filteredData = dataWithReturns;
    if (options.type === 'expense') {
      filteredData = dataWithReturns.filter((t) => {
        const netAmount = t.amountValue - t.returnedAmount;
        return netAmount > 0;
      });
    }

    return {
      data: filteredData,
      nextCursor: lastItem
        ? {
            date: lastItem.date.toISOString(),
            createdAt: lastItem.createdAt.toISOString(),
          }
        : null,
      hasMore: items.length === options.pageSize,
    };
  }

  async searchPaginated(
    userId: string,
    searchTerm: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string },
  ): Promise<PaginatedResult<Transaction>> {
    let query = this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.description ILIKE :search', { search: `%${searchTerm}%` })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.created_at', 'DESC')
      .limit(pageSize);

    if (cursor) {
      query = query.andWhere(
        '(t.date < :cursorDate OR (t.date = :cursorDate AND t.created_at < :cursorCreatedAt))',
        {
          cursorDate: cursor.date,
          cursorCreatedAt: cursor.createdAt,
        },
      );
    }

    const items = await query.getMany();
    const lastItem = items[items.length - 1];

    return {
      data: items.map((entity) => TransactionMapper.toDomain(entity)),
      nextCursor: lastItem
        ? {
            date: lastItem.date.toISOString(),
            createdAt: lastItem.createdAt.toISOString(),
          }
        : null,
      hasMore: items.length === pageSize,
    };
  }

  async getByAccountPaginated(
    accountId: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string },
  ): Promise<PaginatedResult<Transaction>> {
    // Request pageSize + 1 from each query to properly detect hasMore
    const fetchLimit = pageSize + 1;

    let outgoingQuery = this.ormRepository
      .createQueryBuilder('t')
      .where('t.account_id = :accountId', { accountId })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.created_at', 'DESC')
      .limit(fetchLimit);

    let incomingQuery = this.ormRepository
      .createQueryBuilder('t')
      .where('t.to_account_id = :accountId', { accountId })
      .andWhere('t.type = :type', { type: 'transfer' })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.created_at', 'DESC')
      .limit(fetchLimit);

    if (cursor) {
      const cursorCondition =
        '(t.date < :cursorDate OR (t.date = :cursorDate AND t.created_at < :cursorCreatedAt))';
      outgoingQuery = outgoingQuery.andWhere(cursorCondition, {
        cursorDate: cursor.date,
        cursorCreatedAt: cursor.createdAt,
      });
      incomingQuery = incomingQuery.andWhere(cursorCondition, {
        cursorDate: cursor.date,
        cursorCreatedAt: cursor.createdAt,
      });
    }

    const [outgoing, incoming] = await Promise.all([
      outgoingQuery.getMany(),
      incomingQuery.getMany(),
    ]);

    // Merge and sort, then take pageSize + 1 to check hasMore
    const merged = this.mergeByDateDesc(outgoing, incoming, pageSize + 1);

    // Check if there are more items beyond the requested page
    const hasMore = merged.length > pageSize;
    const data = merged.slice(0, pageSize);
    const lastItem = data[data.length - 1];

    return {
      data: data.map((entity) => TransactionMapper.toDomain(entity)),
      nextCursor: lastItem
        ? {
            date: lastItem.date.toISOString(),
            createdAt: lastItem.createdAt.toISOString(),
          }
        : null,
      hasMore,
    };
  }

  async getMonthlyStats(
    userId: string,
    year: number,
    month: number,
    startDay: number = 1,
  ): Promise<MonthlyStats> {
    const { start: startDate, end: endDate } = getFinancialMonthBounds(year, month, startDay);

    // Query 1: All totals in one query using conditional SUM
    const result = await this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.date >= :startDate', { startDate })
      .andWhere('t.date < :endDate', { endDate })
      .select(
        `SUM(CASE WHEN t.type = 'income' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN (:...debtIds) THEN t.amount ELSE 0 END)`,
        'regularIncome',
      )
      .addSelect(
        `SUM(CASE WHEN t.type = 'expense' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN (:...debtIds) THEN t.amount ELSE 0 END)`,
        'regularExpense',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtGivenId THEN t.amount ELSE 0 END)`,
        'debtGiven',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtTakenId THEN t.amount ELSE 0 END)`,
        'debtTaken',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtReturnToMeId AND t.is_debt_related = true THEN t.amount ELSE 0 END)`,
        'debtReturnsToMe',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtReturnFromMeId AND t.is_debt_related = true THEN t.amount ELSE 0 END)`,
        'debtReturnsFromMe',
      )
      .setParameters(DEBT_PARAMS)
      .getRawOne<DebtBreakdownRow>();

    const regularIncome = Number(result?.regularIncome ?? 0);
    const regularExpense = Number(result?.regularExpense ?? 0);
    const debtGiven = Number(result?.debtGiven ?? 0);
    const debtTaken = Number(result?.debtTaken ?? 0);
    const debtReturnsToMe = Number(result?.debtReturnsToMe ?? 0);
    const debtReturnsFromMe = Number(result?.debtReturnsFromMe ?? 0);

    const netIncome = regularIncome + Math.max(0, debtTaken - debtReturnsFromMe);
    const netExpense = regularExpense + Math.max(0, debtGiven - debtReturnsToMe);

    // Query 2: By-currency breakdown with same conditional logic
    const byCurrencyResult = await this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.date >= :startDate', { startDate })
      .andWhere('t.date < :endDate', { endDate })
      .select('t.currency', 'currency')
      .addSelect(
        `SUM(CASE WHEN t.type = 'income' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN (:...debtIds) THEN t.amount ELSE 0 END)`,
        'regularIncome',
      )
      .addSelect(
        `SUM(CASE WHEN t.type = 'expense' AND (t.is_debt_related = false OR t.is_debt_related IS NULL) AND t.category_id NOT IN (:...debtIds) THEN t.amount ELSE 0 END)`,
        'regularExpense',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtGivenId THEN t.amount ELSE 0 END)`,
        'debtGiven',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtTakenId THEN t.amount ELSE 0 END)`,
        'debtTaken',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtReturnToMeId AND t.is_debt_related = true THEN t.amount ELSE 0 END)`,
        'debtReturnsToMe',
      )
      .addSelect(
        `SUM(CASE WHEN t.category_id = :debtReturnFromMeId AND t.is_debt_related = true THEN t.amount ELSE 0 END)`,
        'debtReturnsFromMe',
      )
      .setParameters(DEBT_PARAMS)
      .groupBy('t.currency')
      .getRawMany<{ currency: string } & DebtBreakdownRow>();

    const incomeByCurrency: Record<string, number> = {};
    const expenseByCurrency: Record<string, number> = {};

    for (const row of byCurrencyResult) {
      const incomeVal = Number(row.regularIncome ?? 0);
      const expenseVal = Number(row.regularExpense ?? 0);
      const givenVal = Number(row.debtGiven ?? 0);
      const takenVal = Number(row.debtTaken ?? 0);
      const returnsToMe = Number(row.debtReturnsToMe ?? 0);
      const returnsFromMe = Number(row.debtReturnsFromMe ?? 0);

      const netIncomeForCurrency = incomeVal + Math.max(0, takenVal - returnsFromMe);
      const netExpenseForCurrency = expenseVal + Math.max(0, givenVal - returnsToMe);

      if (netIncomeForCurrency > 0) {
        incomeByCurrency[row.currency] = netIncomeForCurrency;
      }
      if (netExpenseForCurrency > 0) {
        expenseByCurrency[row.currency] = netExpenseForCurrency;
      }
    }

    return {
      totalIncome: netIncome,
      totalExpense: netExpense,
      incomeByCurrency,
      expenseByCurrency,
    };
  }

  async getAnalyticsStats(userId: string, options: AnalyticsOptions): Promise<AnalyticsStats> {
    const { startDate, endDate, accountIds } = options;

    // Base query builder helper (without debt filter)
    const createBaseQuery = () => {
      let query = this.ormRepository
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.date >= :startDate', { startDate })
        .andWhere('t.date <= :endDate', { endDate });

      if (accountIds && accountIds.length > 0) {
        query = query.andWhere('t.account_id IN (:...accountIds)', {
          accountIds,
        });
      }

      return query;
    };

    // Single aggregation query replacing 12 sequential scalar/by-currency queries
    const rows = await createBaseQuery()
      .select('t.type', 'type')
      .addSelect('t.category_id', 'categoryId')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(t.is_debt_related, false)', 'isDebtRelated')
      .addSelect('SUM(t.amount)', 'total')
      .groupBy('t.type')
      .addGroupBy('t.category_id')
      .addGroupBy('t.currency')
      .addGroupBy('COALESCE(t.is_debt_related, false)')
      .getRawMany<{
        type: string;
        categoryId: string;
        currency: string;
        isDebtRelated: boolean | string;
        total: string | null;
      }>();

    // Compute all scalar totals and by-currency breakdowns from the single result set
    let regularIncome = 0,
      regularExpense = 0;
    let debtGiven = 0,
      debtTaken = 0,
      debtReturnsToMe = 0,
      debtReturnsFromMe = 0;
    const regularIncomeByCurrency: Record<string, number> = {};
    const regularExpenseByCurrency: Record<string, number> = {};
    const debtGivenByCurrency: Record<string, number> = {};
    const debtTakenByCurrency: Record<string, number> = {};
    const debtReturnsToMeByCurrency: Record<string, number> = {};
    const debtReturnsFromMeByCurrency: Record<string, number> = {};

    for (const row of rows) {
      const amount = Number(row.total ?? 0);
      const isDebt = row.isDebtRelated === true || row.isDebtRelated === 'true';

      switch (row.categoryId) {
        case DEBT_CATEGORY_IDS.GIVEN:
          debtGiven += amount;
          debtGivenByCurrency[row.currency] = (debtGivenByCurrency[row.currency] || 0) + amount;
          continue;
        case DEBT_CATEGORY_IDS.TAKEN:
          debtTaken += amount;
          debtTakenByCurrency[row.currency] = (debtTakenByCurrency[row.currency] || 0) + amount;
          continue;
        case DEBT_CATEGORY_IDS.RETURN_TO_ME:
          // Only counted when original debt affected balance (is_debt_related = true)
          if (isDebt) {
            debtReturnsToMe += amount;
            debtReturnsToMeByCurrency[row.currency] =
              (debtReturnsToMeByCurrency[row.currency] || 0) + amount;
          }
          continue;
        case DEBT_CATEGORY_IDS.RETURN_FROM_ME:
          // Only counted when original debt affected balance (is_debt_related = true)
          if (isDebt) {
            debtReturnsFromMe += amount;
            debtReturnsFromMeByCurrency[row.currency] =
              (debtReturnsFromMeByCurrency[row.currency] || 0) + amount;
          }
          continue;
      }

      // Regular (non-debt) transactions — debt categories already handled by switch/continue above
      if (!isDebt) {
        if (row.type === 'income') {
          regularIncome += amount;
          regularIncomeByCurrency[row.currency] =
            (regularIncomeByCurrency[row.currency] || 0) + amount;
        } else if (row.type === 'expense') {
          regularExpense += amount;
          regularExpenseByCurrency[row.currency] =
            (regularExpenseByCurrency[row.currency] || 0) + amount;
        }
      }
    }

    // Get category breakdown (only regular transactions, without debt returns)
    const categoryBreakdownQuery = createBaseQuery()
      .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .andWhere('t.category_id NOT IN (:...debtIds)', { debtIds: ALL_DEBT_CATEGORY_IDS })
      .leftJoin(CategoryOrmEntity, 'c', 'c.id::text = t.category_id')
      .select('t.category_id', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect('c.icon', 'categoryIcon')
      .addSelect('c.color', 'categoryColor')
      .addSelect('t.type', 'type')
      .addSelect('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.category_id')
      .addGroupBy('c.name')
      .addGroupBy('c.icon')
      .addGroupBy('c.color')
      .addGroupBy('t.type')
      .addGroupBy('t.currency');

    // When someone returns money to me, subtract from the original expense category.
    const categoryOffsetsQuery = this.createDebtReturnBaseQuery(
      userId,
      startDate,
      endDate,
      accountIds,
    )
      .select('source_tx.category_id', 'categoryId')
      .addSelect('source_tx.currency', 'currency')
      .addSelect('SUM(return_tx.amount)', 'offsetAmount')
      .groupBy('source_tx.category_id')
      .addGroupBy('source_tx.currency');

    // Excludes debt_given/taken sources to avoid double-counting with the
    // `max(0, debtGiven - debtReturnsToMe)` formula applied to scalar totals.
    const regularExpenseOffsetsQuery = this.createDebtReturnBaseQuery(
      userId,
      startDate,
      endDate,
      accountIds,
    )
      .andWhere('return_tx.is_debt_related = true')
      .andWhere('source_tx.type = :expenseType', { expenseType: 'expense' })
      .andWhere('source_tx.category_id NOT IN (:...debtIds)', { debtIds: ALL_DEBT_CATEGORY_IDS })
      .select('source_tx.currency', 'currency')
      .addSelect('SUM(return_tx.amount)', 'offsetAmount')
      .groupBy('source_tx.currency');

    // All three queries are read-only and independent — run them in parallel
    const [categoryBreakdownResult, categoryOffsetsResult, regularExpenseOffsetsResult] =
      await Promise.all([
        categoryBreakdownQuery.getRawMany<{
          categoryId: string;
          categoryName: string | null;
          categoryIcon: string | null;
          categoryColor: string | null;
          type: 'income' | 'expense';
          currency: string;
          amount: string;
        }>(),
        categoryOffsetsQuery.getRawMany<{
          categoryId: string;
          currency: string;
          offsetAmount: string;
        }>(),
        regularExpenseOffsetsQuery.getRawMany<{
          currency: string;
          offsetAmount: string;
        }>(),
      ]);

    const regularExpenseOffsetsByCurrency: Record<string, number> = {};
    for (const row of regularExpenseOffsetsResult) {
      const amount = parseDecimal(row.offsetAmount);
      regularExpenseOffsetsByCurrency[row.currency] =
        (regularExpenseOffsetsByCurrency[row.currency] ?? 0) + amount;
    }
    const regularExpenseOffsetsTotal = Object.values(regularExpenseOffsetsByCurrency).reduce(
      (sum, v) => sum + v,
      0,
    );

    const adjustedRegularExpense = Math.max(0, regularExpense - regularExpenseOffsetsTotal);
    const netIncome = regularIncome + Math.max(0, debtTaken - debtReturnsFromMe);
    const netExpense = adjustedRegularExpense + Math.max(0, debtGiven - debtReturnsToMe);

    // Include offset-only currencies so a currency present only in returns is still considered.
    const allCurrencies = new Set([
      ...Object.keys(regularIncomeByCurrency),
      ...Object.keys(regularExpenseByCurrency),
      ...Object.keys(debtGivenByCurrency),
      ...Object.keys(debtTakenByCurrency),
      ...Object.keys(debtReturnsToMeByCurrency),
      ...Object.keys(debtReturnsFromMeByCurrency),
      ...Object.keys(regularExpenseOffsetsByCurrency),
    ]);

    const incomeByCurrency: Record<string, number> = {};
    const expenseByCurrency: Record<string, number> = {};

    for (const currency of allCurrencies) {
      const incomeVal = regularIncomeByCurrency[currency] ?? 0;
      const expenseVal = regularExpenseByCurrency[currency] ?? 0;
      const givenVal = debtGivenByCurrency[currency] ?? 0;
      const takenVal = debtTakenByCurrency[currency] ?? 0;
      const returnsToMe = debtReturnsToMeByCurrency[currency] ?? 0;
      const returnsFromMe = debtReturnsFromMeByCurrency[currency] ?? 0;
      const offset = regularExpenseOffsetsByCurrency[currency] ?? 0;

      const adjustedExpenseForCurrency = Math.max(0, expenseVal - offset);
      const netIncomeForCurrency = incomeVal + Math.max(0, takenVal - returnsFromMe);
      const netExpenseForCurrency =
        adjustedExpenseForCurrency + Math.max(0, givenVal - returnsToMe);

      if (netIncomeForCurrency > 0) {
        incomeByCurrency[currency] = netIncomeForCurrency;
      }
      if (netExpenseForCurrency > 0) {
        expenseByCurrency[currency] = netExpenseForCurrency;
      }
    }

    // Process category breakdown - aggregate by categoryId and type
    const categoryMap = new Map<string, CategoryBreakdown>();
    for (const row of categoryBreakdownResult) {
      const key = `${row.categoryId}-${row.type}`;
      const existing = categoryMap.get(key);

      // Get category details: first try DB result, then default categories, then fallback
      let categoryName = row.categoryName;
      let categoryIcon = row.categoryIcon;
      let categoryColor = row.categoryColor;

      if (!categoryName || !categoryIcon || !categoryColor) {
        const defaultCategory = getDefaultCategoryById(row.categoryId);
        if (defaultCategory) {
          categoryName = categoryName ?? defaultCategory.name;
          categoryIcon = categoryIcon ?? defaultCategory.icon;
          categoryColor = categoryColor ?? defaultCategory.color;
        }
      }

      if (existing) {
        existing.amount += Number(row.amount);
        existing.amountByCurrency[row.currency] =
          (existing.amountByCurrency[row.currency] ?? 0) + Number(row.amount);
      } else {
        categoryMap.set(key, {
          categoryId: row.categoryId,
          categoryName: categoryName ?? 'Другое',
          categoryIcon: categoryIcon ?? 'more_horiz',
          categoryColor: categoryColor ?? '#6B7280',
          type: row.type,
          amount: Number(row.amount),
          amountByCurrency: { [row.currency]: Number(row.amount) },
        });
      }
    }

    // Apply offsets to expense categories — cap at category amount to prevent spill-over
    for (const offset of categoryOffsetsResult) {
      const key = `${offset.categoryId}-expense`;
      const category = categoryMap.get(key);

      if (category) {
        const offsetAmount = Number(offset.offsetAmount);

        // Cap offset so it never exceeds what the category actually has
        const currencyAmount = category.amountByCurrency[offset.currency] ?? 0;
        const cappedTotalOffset = Math.min(offsetAmount, category.amount);
        const cappedCurrencyOffset = Math.min(cappedTotalOffset, currencyAmount);

        category.amount -= cappedTotalOffset;
        if (cappedCurrencyOffset > 0) {
          category.amountByCurrency[offset.currency] = currencyAmount - cappedCurrencyOffset;
          if (category.amountByCurrency[offset.currency] <= 0) {
            delete category.amountByCurrency[offset.currency];
          }
        }

        // Remove category only if it genuinely has no remaining amount
        if (category.amount <= 0) {
          categoryMap.delete(key);
        }
      }
    }

    return {
      totalIncome: netIncome,
      totalExpense: netExpense,
      incomeByCurrency,
      expenseByCurrency,
      categoryBreakdown: Array.from(categoryMap.values()),
    };
  }

  async getDailyStats(userId: string, options: DailyStatsOptions): Promise<DailyStatsEntry[]> {
    const { startDate, endDate, accountIds, groupBy = 'day' } = options;

    // Defense-in-depth: validate groupBy before SQL interpolation
    const allowedGroupBy = ['day', 'week', 'month'] as const;
    const safeGroupBy = (allowedGroupBy as readonly string[]).includes(groupBy) ? groupBy : 'day';

    let query = this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.date >= :startDate', { startDate })
      .andWhere('t.date <= :endDate', { endDate })
      .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .andWhere('t.category_id NOT IN (:...debtIds)', { debtIds: ALL_DEBT_CATEGORY_IDS });

    if (accountIds && accountIds.length > 0) {
      query = query.andWhere('t.account_id IN (:...accountIds)', { accountIds });
    }

    // Query debt returns, attributed to the date of the SOURCE expense (not return date).
    // This correctly offsets the original expense on the day it happened.
    // For returns without a source transaction, attribute to the return date.
    // Join via debt_id (set on partial payments) with fallback to close_transaction_id.
    let debtReturnsQuery = this.ormRepository
      .createQueryBuilder('return_tx')
      .innerJoin(
        DebtOrmEntity,
        'd',
        '(return_tx.debt_id IS NOT NULL AND return_tx.debt_id = d.id) OR (return_tx.debt_id IS NULL AND d.close_transaction_id = return_tx.id)',
      )
      .leftJoin(
        TransactionOrmEntity,
        'source_tx',
        'source_tx.id = COALESCE(d.source_transaction_id, d.transaction_id)',
      )
      .where('return_tx.user_id = :userId', { userId })
      .andWhere('return_tx.is_debt_related = true')
      .andWhere('return_tx.category_id IN (:...returnCategoryIds)', {
        returnCategoryIds: [DEBT_CATEGORY_IDS.RETURN_TO_ME, DEBT_CATEGORY_IDS.RETURN_FROM_ME],
      })
      // Include returns where either the source expense or the return itself falls in date range
      .andWhere(
        '(COALESCE(source_tx.date, return_tx.date) >= :startDate AND COALESCE(source_tx.date, return_tx.date) <= :endDate)',
        { startDate, endDate },
      );

    if (accountIds && accountIds.length > 0) {
      debtReturnsQuery = debtReturnsQuery.andWhere('return_tx.account_id IN (:...accountIds)', {
        accountIds,
      });
    }

    // Both queries are read-only and independent — run in parallel
    const [rows, debtReturnRows] = await Promise.all([
      query
        .select(`date_trunc('${safeGroupBy}', t.date)`, 'period')
        .addSelect('t.type', 'type')
        .addSelect('t.currency', 'currency')
        .addSelect('SUM(t.amount)', 'total')
        .groupBy('period')
        .addGroupBy('t.type')
        .addGroupBy('t.currency')
        .orderBy('period', 'ASC')
        .getRawMany<{
          period: Date;
          type: string;
          currency: string;
          total: string | null;
        }>(),
      debtReturnsQuery
        .select(`date_trunc('${safeGroupBy}', COALESCE(source_tx.date, return_tx.date))`, 'period')
        .addSelect('return_tx.category_id', 'categoryId')
        .addSelect('return_tx.currency', 'currency')
        .addSelect('SUM(return_tx.amount)', 'total')
        .groupBy('period')
        .addGroupBy('return_tx.category_id')
        .addGroupBy('return_tx.currency')
        .getRawMany<{
          period: Date;
          categoryId: string;
          currency: string;
          total: string | null;
        }>(),
    ]);

    // Aggregate rows into a map keyed by period date string
    const statsMap = new Map<string, DailyStatsEntry>();

    for (const row of rows) {
      const dateKey = new Date(row.period).toISOString().split('T')[0];
      let entry = statsMap.get(dateKey);
      if (!entry) {
        entry = { date: dateKey, incomeByCurrency: {}, expenseByCurrency: {} };
        statsMap.set(dateKey, entry);
      }

      const amount = Number(row.total ?? 0);
      if (row.type === 'income') {
        entry.incomeByCurrency[row.currency] = (entry.incomeByCurrency[row.currency] || 0) + amount;
      } else if (row.type === 'expense') {
        entry.expenseByCurrency[row.currency] =
          (entry.expenseByCurrency[row.currency] || 0) + amount;
      }
    }

    // Offset expenses by debt returns (same formula as monthly stats)
    for (const row of debtReturnRows) {
      const dateKey = new Date(row.period).toISOString().split('T')[0];
      let entry = statsMap.get(dateKey);
      if (!entry) {
        entry = { date: dateKey, incomeByCurrency: {}, expenseByCurrency: {} };
        statsMap.set(dateKey, entry);
      }

      const amount = Number(row.total ?? 0);
      if (row.categoryId === DEBT_CATEGORY_IDS.RETURN_TO_ME) {
        // Someone returned money to me → subtract from expenses
        entry.expenseByCurrency[row.currency] = Math.max(
          0,
          (entry.expenseByCurrency[row.currency] || 0) - amount,
        );
      } else if (row.categoryId === DEBT_CATEGORY_IDS.RETURN_FROM_ME) {
        // I returned money to someone → subtract from income
        entry.incomeByCurrency[row.currency] = Math.max(
          0,
          (entry.incomeByCurrency[row.currency] || 0) - amount,
        );
      }
    }

    // Fill gaps: ensure every period in range has an entry
    const result: DailyStatsEntry[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // Truncate start to period boundary
    if (safeGroupBy === 'week') {
      const day = current.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = start of week
      current.setDate(current.getDate() - diff);
    } else if (safeGroupBy === 'month') {
      current.setDate(1);
    }

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const entry = statsMap.get(dateKey) ?? {
        date: dateKey,
        incomeByCurrency: {},
        expenseByCurrency: {},
      };
      result.push(entry);

      // Advance to next period
      if (safeGroupBy === 'week') {
        current.setDate(current.getDate() + 7);
      } else if (safeGroupBy === 'month') {
        current.setMonth(current.getMonth() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    return result;
  }

  async getHashtags(userId: string): Promise<HashtagResult[]> {
    const result: HashtagResult[] = await this.ormRepository.query(
      `SELECT sub.tag, COUNT(*)::int as count
       FROM (
         SELECT lower(unnest(regexp_matches(description, '#[^\\s#.,;:!?)]+', 'g'))) as tag
         FROM transactions
         WHERE user_id = $1 AND description LIKE '%#%'
       ) sub
       GROUP BY sub.tag
       ORDER BY count DESC`,
      [userId],
    );

    return result;
  }

  /**
   * Shared foundation for debt-return offset queries — extracted to keep
   * the three-table join + RETURN_TO_ME scoping in one place so callers
   * don't drift apart on the JOIN condition.
   */
  private createDebtReturnBaseQuery(
    userId: string,
    startDate: Date,
    endDate: Date,
    accountIds?: string[],
  ) {
    let query = this.ormRepository
      .createQueryBuilder('return_tx')
      .innerJoin(
        DebtOrmEntity,
        'd',
        '(return_tx.debt_id IS NOT NULL AND return_tx.debt_id = d.id) OR (return_tx.debt_id IS NULL AND d.close_transaction_id = return_tx.id)',
      )
      .innerJoin(
        TransactionOrmEntity,
        'source_tx',
        'source_tx.id = COALESCE(d.source_transaction_id, d.transaction_id)',
      )
      .where('return_tx.user_id = :userId', { userId })
      .andWhere('return_tx.date >= :startDate', { startDate })
      .andWhere('return_tx.date <= :endDate', { endDate })
      .andWhere('return_tx.category_id = :returnToMeId', {
        returnToMeId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
      });

    if (accountIds && accountIds.length > 0) {
      query = query.andWhere('return_tx.account_id IN (:...accountIds)', { accountIds });
    }

    return query;
  }

  private mergeByDateDesc(
    a: TransactionOrmEntity[],
    b: TransactionOrmEntity[],
    limit: number,
  ): TransactionOrmEntity[] {
    return [...a, ...b]
      .sort((x, y) => {
        const dateCompare = new Date(y.date).getTime() - new Date(x.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime();
      })
      .slice(0, limit);
  }
}
