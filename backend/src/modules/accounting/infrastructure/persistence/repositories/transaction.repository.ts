import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, Between } from 'typeorm';
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
  UNRETURNED_DEBT_CATEGORY_ID,
} from '../../../domain/constants/default-categories';
import { getFinancialMonthBounds } from '../../../../../shared/utils/financial-period';

// created_at is stored with microseconds in Postgres, but cursors round-trip
// through JS Dates (ms precision). Both the ORDER BY and the cursor condition
// truncate to ms so rows in the same millisecond compare as equal and the id
// tiebreaker decides — otherwise such rows are skipped on page boundaries.
const TRUNCATED_CREATED_AT = "date_trunc('milliseconds', t.created_at)";

const CURSOR_CONDITION_WITH_ID =
  `(t.date < :cursorDate` +
  ` OR (t.date = :cursorDate AND ${TRUNCATED_CREATED_AT} < :cursorCreatedAt)` +
  ` OR (t.date = :cursorDate AND ${TRUNCATED_CREATED_AT} = :cursorCreatedAt AND t.id < :cursorId))`;

const LEGACY_CURSOR_CONDITION =
  '(t.date < :cursorDate OR (t.date = :cursorDate AND t.created_at < :cursorCreatedAt))';

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

  async save(transaction: Transaction, manager?: EntityManager): Promise<Transaction> {
    const repo = manager ? manager.getRepository(TransactionOrmEntity) : this.ormRepository;
    const ormEntity = TransactionMapper.toOrm(transaction);
    const savedEntity = await repo.save(ormEntity);
    return TransactionMapper.toDomain(savedEntity);
  }

  async saveMany(transactions: Transaction[], manager?: EntityManager): Promise<Transaction[]> {
    if (transactions.length === 0) return [];
    const repo = manager ? manager.getRepository(TransactionOrmEntity) : this.ormRepository;
    const ormEntities = transactions.map((t) => TransactionMapper.toOrm(t));

    // Chunk to stay within PostgreSQL's ~32767 parameter limit.
    // Each transaction has ~15 columns, so 500 rows per chunk is safe.
    const CHUNK_SIZE = 500;
    const saved: TransactionOrmEntity[] = [];
    for (let i = 0; i < ormEntities.length; i += CHUNK_SIZE) {
      const chunk = ormEntities.slice(i, i + CHUNK_SIZE);
      const result = await repo.save(chunk);
      saved.push(...result);
    }

    return saved.map((entity) => TransactionMapper.toDomain(entity));
  }

  async delete(id: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(TransactionOrmEntity) : this.ormRepository;
    await repo.delete(id);
  }

  async deleteByAccountId(accountId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(TransactionOrmEntity) : this.ormRepository;
    // Sequential: a transactional EntityManager runs on a single connection,
    // parallel queries on it are not safe.
    await repo.delete({ accountId });
    await repo.delete({ toAccountId: accountId, type: 'transfer' });
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
      // created_at is truncated to ms both here and in the cursor condition:
      // JS Dates round-trip with ms precision, while Postgres stores
      // microseconds — comparing untruncated values skips rows on page
      // boundaries. Ties are broken by id.
      .addOrderBy(TRUNCATED_CREATED_AT, 'DESC')
      .addOrderBy('t.id', 'DESC')
      .limit(options.pageSize);

    if (options.cursorDate && options.cursorCreatedAt) {
      if (options.cursorId) {
        query = query.andWhere(CURSOR_CONDITION_WITH_ID, {
          cursorDate: options.cursorDate,
          cursorCreatedAt: options.cursorCreatedAt,
          cursorId: options.cursorId,
        });
      } else {
        // Legacy cursor without id (older clients): may skip rows that share
        // (date, created_at) on a page boundary, but never duplicates.
        query = query.andWhere(LEGACY_CURSOR_CONDITION, {
          cursorDate: options.cursorDate,
          cursorCreatedAt: options.cursorCreatedAt,
        });
      }
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
            id: lastItem.id,
          }
        : null,
      hasMore: items.length === options.pageSize,
    };
  }

  async searchPaginated(
    userId: string,
    searchTerm: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string; id?: string },
  ): Promise<PaginatedResult<Transaction>> {
    let query = this.ormRepository
      .createQueryBuilder('t')
      .where('t.user_id = :userId', { userId })
      .andWhere('t.description ILIKE :search', { search: `%${searchTerm}%` })
      .orderBy('t.date', 'DESC')
      .addOrderBy(TRUNCATED_CREATED_AT, 'DESC')
      .addOrderBy('t.id', 'DESC')
      .limit(pageSize);

    if (cursor) {
      if (cursor.id) {
        query = query.andWhere(CURSOR_CONDITION_WITH_ID, {
          cursorDate: cursor.date,
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        });
      } else {
        query = query.andWhere(LEGACY_CURSOR_CONDITION, {
          cursorDate: cursor.date,
          cursorCreatedAt: cursor.createdAt,
        });
      }
    }

    const items = await query.getMany();
    const lastItem = items[items.length - 1];

    return {
      data: items.map((entity) => TransactionMapper.toDomain(entity)),
      nextCursor: lastItem
        ? {
            date: lastItem.date.toISOString(),
            createdAt: lastItem.createdAt.toISOString(),
            id: lastItem.id,
          }
        : null,
      hasMore: items.length === pageSize,
    };
  }

  async getByAccountPaginated(
    accountId: string,
    pageSize: number,
    cursor?: { date: string; createdAt: string; id?: string },
  ): Promise<PaginatedResult<Transaction>> {
    // Request pageSize + 1 from each query to properly detect hasMore
    const fetchLimit = pageSize + 1;

    let outgoingQuery = this.ormRepository
      .createQueryBuilder('t')
      .where('t.account_id = :accountId', { accountId })
      .orderBy('t.date', 'DESC')
      .addOrderBy(TRUNCATED_CREATED_AT, 'DESC')
      .addOrderBy('t.id', 'DESC')
      .limit(fetchLimit);

    let incomingQuery = this.ormRepository
      .createQueryBuilder('t')
      .where('t.to_account_id = :accountId', { accountId })
      .andWhere('t.type = :type', { type: 'transfer' })
      .orderBy('t.date', 'DESC')
      .addOrderBy(TRUNCATED_CREATED_AT, 'DESC')
      .addOrderBy('t.id', 'DESC')
      .limit(fetchLimit);

    if (cursor) {
      const cursorCondition = cursor.id ? CURSOR_CONDITION_WITH_ID : LEGACY_CURSOR_CONDITION;
      const cursorParams = {
        cursorDate: cursor.date,
        cursorCreatedAt: cursor.createdAt,
        ...(cursor.id ? { cursorId: cursor.id } : {}),
      };
      outgoingQuery = outgoingQuery.andWhere(cursorCondition, cursorParams);
      incomingQuery = incomingQuery.andWhere(cursorCondition, cursorParams);
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
            id: lastItem.id,
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
    // Thin wrapper over getAnalyticsStats so monthly budget and analytics page
    // share one formula (split-expense returns offset categories, etc).
    const { start, end } = getFinancialMonthBounds(year, month, startDay);
    // getFinancialMonthBounds returns end as the FIRST day of the next financial
    // month (exclusive: t.date < end). getAnalyticsStats uses t.date <= endDate
    // (inclusive). t.date is `timestamp with time zone`, so we step back ONE
    // MILLISECOND, not one day — otherwise every non-midnight transaction on the
    // last day of the period is excluded.
    const endInclusive = new Date(end.getTime() - 1);

    const stats = await this.getAnalyticsStats(userId, {
      startDate: start,
      endDate: endInclusive,
    });

    return {
      totalIncome: stats.totalIncome,
      totalExpense: stats.totalExpense,
      incomeByCurrency: stats.incomeByCurrency,
      expenseByCurrency: stats.expenseByCurrency,
    };
  }

  async getAnalyticsStats(userId: string, options: AnalyticsOptions): Promise<AnalyticsStats> {
    const { startDate, endDate, accountIds } = options;

    // Base query builder helper (without debt filter)
    // Informational transactions are excluded from all analytics — they exist
    // only for display in the transactions feed and never affect totals.
    const createBaseQuery = () => {
      let query = this.ormRepository
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.date >= :startDate', { startDate })
        .andWhere('t.date <= :endDate', { endDate })
        .andWhere('(t.is_informational = false OR t.is_informational IS NULL)');

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

    // Per-currency totals: income (regular) and debt buckets feed the income side and
    // the synthetic "unreturned debts" category. Expense per category is sourced from
    // categoryBreakdownQuery below — no scalar regularExpense needed here.
    const regularIncomeByCurrency: Record<string, number> = {};
    const debtGivenByCurrency: Record<string, number> = {};
    const debtTakenByCurrency: Record<string, number> = {};
    const debtReturnsFromMeByCurrency: Record<string, number> = {};

    for (const row of rows) {
      const amount = Number(row.total ?? 0);
      const isDebt = row.isDebtRelated === true || row.isDebtRelated === 'true';

      switch (row.categoryId) {
        case DEBT_CATEGORY_IDS.GIVEN:
          debtGivenByCurrency[row.currency] = (debtGivenByCurrency[row.currency] || 0) + amount;
          continue;
        case DEBT_CATEGORY_IDS.TAKEN:
          debtTakenByCurrency[row.currency] = (debtTakenByCurrency[row.currency] || 0) + amount;
          continue;
        case DEBT_CATEGORY_IDS.RETURN_TO_ME:
          // Handled entirely via categoryOffsetsQuery, which attributes each return
          // to its source transaction: split returns offset the source spending
          // category, pure-loan returns reduce the unreturned-debts bucket.
          continue;
        case DEBT_CATEGORY_IDS.RETURN_FROM_ME:
          // Only counted when original debt affected balance (is_debt_related = true)
          if (isDebt) {
            debtReturnsFromMeByCurrency[row.currency] =
              (debtReturnsFromMeByCurrency[row.currency] || 0) + amount;
          }
          continue;
        case DEBT_CATEGORY_IDS.FORGIVEN:
          // Forgiveness rows in this category exist only as bookkeeping markers.
          // Informational ones are filtered upstream (createBaseQuery); any stray
          // non-informational row with this category is still semantically a
          // forgiveness event, not part of regular spending — drop it from totals.
          continue;
      }

      // Regular (non-debt) transactions — debt categories already handled by switch/continue above.
      // Only income is tracked here; expense lives entirely in categoryBreakdownQuery.
      if (!isDebt && row.type === 'income') {
        regularIncomeByCurrency[row.currency] =
          (regularIncomeByCurrency[row.currency] || 0) + amount;
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
    // Pure-loan returns (source is debt_given) are excluded here — they feed the
    // unreturned-debts bucket via loanReturnsQuery below, on different date rules.
    const categoryOffsetsQuery = this.createDebtReturnBaseQuery(
      userId,
      startDate,
      endDate,
      accountIds,
    )
      .andWhere('source_tx.category_id != :loanGivenId', {
        loanGivenId: DEBT_CATEGORY_IDS.GIVEN,
      })
      .select('source_tx.category_id', 'categoryId')
      .addSelect('source_tx.currency', 'currency')
      .addSelect('SUM(return_tx.amount)', 'offsetAmount')
      .groupBy('source_tx.category_id')
      .addGroupBy('source_tx.currency');

    // Returns of pure loans, windowed by the date the loan was GIVEN, not the
    // date of the return. The unreturned-debts bucket shows the actual
    // outstanding balance of loans handed out in this period — a repayment
    // arriving after the period flips must still shrink it, and a repayment of
    // an older loan must not eat into this period's bucket.
    //
    // The bucket is skipped entirely when scoped to specific accounts (a loan
    // and its repayment often live on different accounts, so a per-account view
    // can't compute the outstanding balance) — don't pay for the join then.
    const isAccountFiltered = !!accountIds && accountIds.length > 0;
    const loanReturnsQuery = isAccountFiltered
      ? null
      : this.createDebtReturnBaseQuery(userId, startDate, endDate, accountIds, 'source')
          .andWhere('source_tx.category_id = :loanGivenId', {
            loanGivenId: DEBT_CATEGORY_IDS.GIVEN,
          })
          .select('source_tx.currency', 'currency')
          .addSelect('SUM(return_tx.amount)', 'returnedAmount')
          .groupBy('source_tx.currency');

    // Three queries are read-only and independent — run them in parallel
    const [categoryBreakdownResult, categoryOffsetsResult, loanReturnsResult] = await Promise.all([
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
      loanReturnsQuery?.getRawMany<{
        currency: string;
        returnedAmount: string;
      }>() ?? [],
    ]);

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

    // Apply offsets to expense categories — cap at THE OFFSET CURRENCY BUCKET so
    // category.amount and sum(category.amountByCurrency) stay in lockstep. The
    // return is denominated in source_tx.currency; allowing it to spill into
    // other currency buckets would either cross-convert at 1:1 (wrong) or break
    // the identity sum(amountByCurrency) === amount that downstream code relies on.
    //
    // Returns of pure loans (source is a debt_given transaction) never offset a
    // spending category — they reduce the unreturned-debts bucket below instead
    // (excluded from categoryOffsetsQuery, sourced from loanReturnsQuery).
    const loanReturnsByCurrency: Record<string, number> = {};
    for (const row of loanReturnsResult) {
      loanReturnsByCurrency[row.currency] =
        (loanReturnsByCurrency[row.currency] ?? 0) + Number(row.returnedAmount);
    }
    for (const offset of categoryOffsetsResult) {
      const key = `${offset.categoryId}-expense`;
      const category = categoryMap.get(key);
      if (!category) continue;

      const offsetAmount = Number(offset.offsetAmount);
      const currencyAmount = category.amountByCurrency[offset.currency] ?? 0;
      const cappedOffset = Math.min(offsetAmount, currencyAmount);
      if (cappedOffset <= 0) continue;

      category.amount -= cappedOffset;
      category.amountByCurrency[offset.currency] = currencyAmount - cappedOffset;
      if (category.amountByCurrency[offset.currency] <= 0) {
        delete category.amountByCurrency[offset.currency];
      }

      if (category.amount <= 0) {
        categoryMap.delete(key);
      }
    }

    // Add synthetic "Невозвращённые долги" category for outstanding given-debt balance per currency.
    // This guarantees the algebraic identity: totalExpense === sum(categoryBreakdown.amount).
    //
    // Only returns of pure loans are subtracted here. Split returns already offset
    // their source spending category above — subtracting them again would shrink
    // the bucket below the real outstanding-loan figure (double-count).
    //
    // Skip when the user filtered by accountIds: a debt and its return often live on
    // different accounts (give from Cash, repaid into Bank), so a per-account view
    // sees only one half and would inflate the bucket with already-repaid debt.
    // Better hide it than display a false outstanding figure.
    if (!isAccountFiltered) {
      const unreturnedDebtByCurrency: Record<string, number> = {};
      const debtCurrencies = new Set<string>([
        ...Object.keys(debtGivenByCurrency),
        ...Object.keys(loanReturnsByCurrency),
      ]);
      for (const currency of debtCurrencies) {
        const outstanding =
          (debtGivenByCurrency[currency] ?? 0) - (loanReturnsByCurrency[currency] ?? 0);
        if (outstanding > 0) {
          unreturnedDebtByCurrency[currency] = outstanding;
        }
      }
      const unreturnedDebtTotal = Object.values(unreturnedDebtByCurrency).reduce(
        (sum, v) => sum + v,
        0,
      );
      if (unreturnedDebtTotal > 0) {
        categoryMap.set(`${UNRETURNED_DEBT_CATEGORY_ID}-expense`, {
          categoryId: UNRETURNED_DEBT_CATEGORY_ID,
          categoryName: 'Невозвращённые долги',
          categoryIcon: 'handshake',
          categoryColor: '#9CA3AF',
          type: 'expense',
          amount: unreturnedDebtTotal,
          amountByCurrency: { ...unreturnedDebtByCurrency },
        });
      }
    }

    // Derive expenseByCurrency / totalExpense from categoryMap — single source of truth.
    // This guarantees pie chart sum === StatCard total: there is no separate formula.
    const expenseByCurrency: Record<string, number> = {};
    let totalExpense = 0;
    for (const cat of categoryMap.values()) {
      if (cat.type !== 'expense') continue;
      totalExpense += cat.amount;
      for (const [c, amt] of Object.entries(cat.amountByCurrency)) {
        expenseByCurrency[c] = (expenseByCurrency[c] ?? 0) + amt;
      }
    }

    // Income side: regular income plus outstanding taken-debt balance (money still owed by me).
    // Same account-filter caveat as expense: a taken debt and its return may live on different
    // accounts, so when scoped to one account skip the debt term entirely rather than show
    // inflated income.
    const incomeByCurrency: Record<string, number> = {};
    let totalIncome = 0;
    const incomeCurrencies = new Set<string>([
      ...Object.keys(regularIncomeByCurrency),
      ...(isAccountFiltered
        ? []
        : [...Object.keys(debtTakenByCurrency), ...Object.keys(debtReturnsFromMeByCurrency)]),
    ]);
    for (const currency of incomeCurrencies) {
      const incomeVal = regularIncomeByCurrency[currency] ?? 0;
      const debtTerm = isAccountFiltered
        ? 0
        : Math.max(
            0,
            (debtTakenByCurrency[currency] ?? 0) - (debtReturnsFromMeByCurrency[currency] ?? 0),
          );
      const netIncomeForCurrency = incomeVal + debtTerm;
      if (netIncomeForCurrency > 0) {
        incomeByCurrency[currency] = netIncomeForCurrency;
        totalIncome += netIncomeForCurrency;
      }
    }

    return {
      totalIncome,
      totalExpense,
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
      .andWhere('(t.is_informational = false OR t.is_informational IS NULL)')
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
      .andWhere('(return_tx.is_informational = false OR return_tx.is_informational IS NULL)')
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
   *
   * dateWindowOn picks which side the period filter applies to:
   * - 'return' — returns that HAPPENED in the period (split offsets);
   * - 'source' — returns of debts GIVEN in the period, whenever repaid
   *   (unreturned-debts bucket shows the actual outstanding balance).
   */
  private createDebtReturnBaseQuery(
    userId: string,
    startDate: Date,
    endDate: Date,
    accountIds?: string[],
    dateWindowOn: 'return' | 'source' = 'return',
  ) {
    const dateAlias = dateWindowOn === 'source' ? 'source_tx' : 'return_tx';
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
      .andWhere(`${dateAlias}.date >= :startDate`, { startDate })
      .andWhere(`${dateAlias}.date <= :endDate`, { endDate })
      .andWhere('(return_tx.is_informational = false OR return_tx.is_informational IS NULL)')
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
        // getTime() is ms precision, matching the ms-truncated SQL ordering
        const createdCompare = new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime();
        if (createdCompare !== 0) return createdCompare;
        // id DESC: canonical uuid hex strings compare the same as Postgres uuids
        return y.id < x.id ? -1 : y.id > x.id ? 1 : 0;
      })
      .slice(0, limit);
  }
}
