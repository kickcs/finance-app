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
  CategoryBreakdown,
  TransactionWithReturns,
} from '../../../domain/repositories/transaction.repository.interface';
import { TransactionOrmEntity } from '../typeorm/transaction.orm-entity';
import { CategoryOrmEntity } from '../typeorm/category.orm-entity';
import { DebtOrmEntity } from '../../../../debt/infrastructure/persistence/typeorm/debt.orm-entity';
import { TransactionMapper } from '../mappers/transaction.mapper';
import { getDefaultCategoryById } from '../../../domain/constants/default-categories';

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
    });

    return ormEntities.map((entity) => TransactionMapper.toDomain(entity));
  }

  async findByAccountIdWithIncoming(accountId: string): Promise<Transaction[]> {
    const outgoing = await this.ormRepository.find({
      where: { accountId },
    });

    const incoming = await this.ormRepository.find({
      where: { toAccountId: accountId, type: 'transfer' },
    });

    const all = [...outgoing, ...incoming].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return all.map((entity) => TransactionMapper.toDomain(entity));
  }

  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    const ormEntities = await this.ormRepository.find({
      where: {
        userId,
        date: Between(startDate, endDate),
      },
      order: { date: 'DESC' },
    });

    return ormEntities.map((entity) => TransactionMapper.toDomain(entity));
  }

  async save(transaction: Transaction): Promise<Transaction> {
    const ormEntity = TransactionMapper.toOrm(transaction);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return TransactionMapper.toDomain(savedEntity);
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

    const items = await query.getMany();

    // Calculate returned amounts for expense transactions via debt returns
    // For each expense transaction, find debts linked via source_transaction_id
    // and sum the amounts from their close_transaction_id (return transactions)
    const transactionIds = items.map((t) => t.id);
    const returnedAmountsMap: Record<string, number> = {};

    if (transactionIds.length > 0) {
      const returnedAmountsResult = await this.ormRepository
        .createQueryBuilder('return_tx')
        .innerJoin(DebtOrmEntity, 'd', 'd.close_transaction_id = return_tx.id')
        .where('d.source_transaction_id IN (:...transactionIds)', {
          transactionIds,
        })
        .andWhere("return_tx.category_id = 'debt_return_to_me'")
        .select('d.source_transaction_id', 'sourceTransactionId')
        .addSelect('SUM(return_tx.amount)', 'returnedAmount')
        .groupBy('d.source_transaction_id')
        .getRawMany<{ sourceTransactionId: string; returnedAmount: string }>();

      for (const row of returnedAmountsResult) {
        returnedAmountsMap[row.sourceTransactionId] = Number(
          row.returnedAmount,
        );
      }
    }

    const lastItem = items[items.length - 1];

    // Map items with returned amounts
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
    const merged = [...outgoing, ...incoming]
      .sort((a, b) => {
        const dateCompare =
          new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .slice(0, pageSize + 1);

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
  ): Promise<MonthlyStats> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Helper to create base query with date range
    const createBaseQuery = () =>
      this.ormRepository
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.date >= :startDate', { startDate })
        .andWhere('t.date < :endDate', { endDate });

    // 1. Regular income (non-debt-related, handles NULL as false)
    const regularIncomeResult = await createBaseQuery()
      .select('SUM(t.amount)', 'total')
      .andWhere('t.type = :type', { type: 'income' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .getRawOne<{ total: string | null }>();

    // 2. Regular expense (non-debt-related, handles NULL as false)
    const regularExpenseResult = await createBaseQuery()
      .select('SUM(t.amount)', 'total')
      .andWhere('t.type = :type', { type: 'expense' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .getRawOne<{ total: string | null }>();

    // 3. Debt given (counts as expense - money I lent out)
    const debtGivenResult = await createBaseQuery()
      .select('SUM(t.amount)', 'total')
      .andWhere("t.category_id = 'debt_given'")
      .getRawOne<{ total: string | null }>();

    // 4. Debt taken (counts as income - money I borrowed)
    const debtTakenResult = await createBaseQuery()
      .select('SUM(t.amount)', 'total')
      .andWhere("t.category_id = 'debt_taken'")
      .getRawOne<{ total: string | null }>();

    // 5. Debt returns TO ME (subtract from expenses - only if original debt affected balance)
    const debtReturnsToMeResult = await createBaseQuery()
      .select('SUM(t.amount)', 'total')
      .andWhere("t.category_id = 'debt_return_to_me'")
      .andWhere('t.is_debt_related = true')
      .getRawOne<{ total: string | null }>();

    // 6. Debt returns FROM ME (subtract from income - only if original debt affected balance)
    const debtReturnsFromMeResult = await createBaseQuery()
      .select('SUM(t.amount)', 'total')
      .andWhere("t.category_id = 'debt_return_from_me'")
      .andWhere('t.is_debt_related = true')
      .getRawOne<{ total: string | null }>();

    // Calculate NET values
    const regularIncome = Number(regularIncomeResult?.total ?? 0);
    const regularExpense = Number(regularExpenseResult?.total ?? 0);
    const debtGiven = Number(debtGivenResult?.total ?? 0);
    const debtTaken = Number(debtTakenResult?.total ?? 0);
    const debtReturnsToMe = Number(debtReturnsToMeResult?.total ?? 0);
    const debtReturnsFromMe = Number(debtReturnsFromMeResult?.total ?? 0);

    // Income = regular + debt_taken - returns_from_me
    const netIncome = Math.max(
      0,
      regularIncome + debtTaken - debtReturnsFromMe,
    );
    // Expense = regular + debt_given - returns_to_me
    const netExpense = Math.max(
      0,
      regularExpense + debtGiven - debtReturnsToMe,
    );

    // By currency calculations
    // 5. Regular income by currency
    const regularIncomeByCurrencyResult = await createBaseQuery()
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .andWhere('t.type = :type', { type: 'income' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 6. Regular expense by currency
    const regularExpenseByCurrencyResult = await createBaseQuery()
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .andWhere('t.type = :type', { type: 'expense' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 9. Debt given by currency
    const debtGivenByCurrencyResult = await createBaseQuery()
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .andWhere("t.category_id = 'debt_given'")
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 10. Debt taken by currency
    const debtTakenByCurrencyResult = await createBaseQuery()
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .andWhere("t.category_id = 'debt_taken'")
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 11. Debt returns TO ME by currency (only if original debt affected balance)
    const debtReturnsToMeByCurrencyResult = await createBaseQuery()
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .andWhere("t.category_id = 'debt_return_to_me'")
      .andWhere('t.is_debt_related = true')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 12. Debt returns FROM ME by currency (only if original debt affected balance)
    const debtReturnsFromMeByCurrencyResult = await createBaseQuery()
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .andWhere("t.category_id = 'debt_return_from_me'")
      .andWhere('t.is_debt_related = true')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // Process by-currency data
    const regularIncomeByCurrency: Record<string, number> = {};
    for (const row of regularIncomeByCurrencyResult) {
      regularIncomeByCurrency[row.currency] = Number(row.amount);
    }

    const regularExpenseByCurrency: Record<string, number> = {};
    for (const row of regularExpenseByCurrencyResult) {
      regularExpenseByCurrency[row.currency] = Number(row.amount);
    }

    const debtGivenByCurrency: Record<string, number> = {};
    for (const row of debtGivenByCurrencyResult) {
      debtGivenByCurrency[row.currency] = Number(row.amount);
    }

    const debtTakenByCurrency: Record<string, number> = {};
    for (const row of debtTakenByCurrencyResult) {
      debtTakenByCurrency[row.currency] = Number(row.amount);
    }

    const debtReturnsToMeByCurrency: Record<string, number> = {};
    for (const row of debtReturnsToMeByCurrencyResult) {
      debtReturnsToMeByCurrency[row.currency] = Number(row.amount);
    }

    const debtReturnsFromMeByCurrency: Record<string, number> = {};
    for (const row of debtReturnsFromMeByCurrencyResult) {
      debtReturnsFromMeByCurrency[row.currency] = Number(row.amount);
    }

    // Calculate NET by currency
    const allCurrencies = new Set([
      ...Object.keys(regularIncomeByCurrency),
      ...Object.keys(regularExpenseByCurrency),
      ...Object.keys(debtGivenByCurrency),
      ...Object.keys(debtTakenByCurrency),
      ...Object.keys(debtReturnsToMeByCurrency),
      ...Object.keys(debtReturnsFromMeByCurrency),
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

      // Income = regular + debt_taken - returns_from_me
      const netIncomeForCurrency = Math.max(
        0,
        incomeVal + takenVal - returnsFromMe,
      );
      // Expense = regular + debt_given - returns_to_me
      const netExpenseForCurrency = Math.max(
        0,
        expenseVal + givenVal - returnsToMe,
      );

      if (netIncomeForCurrency > 0) {
        incomeByCurrency[currency] = netIncomeForCurrency;
      }
      if (netExpenseForCurrency > 0) {
        expenseByCurrency[currency] = netExpenseForCurrency;
      }
    }

    return {
      totalIncome: netIncome,
      totalExpense: netExpense,
      incomeByCurrency,
      expenseByCurrency,
    };
  }

  async getAnalyticsStats(
    userId: string,
    options: AnalyticsOptions,
  ): Promise<AnalyticsStats> {
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

    // 1. Regular income (non-debt-related, handles NULL as false)
    const regularIncomeResult = await createBaseQuery()
      .andWhere('t.type = :type', { type: 'income' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .select('SUM(t.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 2. Regular expense (non-debt-related, handles NULL as false)
    const regularExpenseResult = await createBaseQuery()
      .andWhere('t.type = :type', { type: 'expense' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .select('SUM(t.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 3. Debt given (counts as expense - money I lent out)
    const debtGivenResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_given'")
      .select('SUM(t.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 4. Debt taken (counts as income - money I borrowed)
    const debtTakenResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_taken'")
      .select('SUM(t.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 5. Debt returns TO ME (subtract from expenses - only if original debt affected balance)
    const debtReturnsToMeResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_return_to_me'")
      .andWhere('t.is_debt_related = true')
      .select('SUM(t.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // 6. Debt returns FROM ME (subtract from income - only if original debt affected balance)
    const debtReturnsFromMeResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_return_from_me'")
      .andWhere('t.is_debt_related = true')
      .select('SUM(t.amount)', 'total')
      .getRawOne<{ total: string | null }>();

    // Calculate NET values
    const regularIncome = Number(regularIncomeResult?.total ?? 0);
    const regularExpense = Number(regularExpenseResult?.total ?? 0);
    const debtGiven = Number(debtGivenResult?.total ?? 0);
    const debtTaken = Number(debtTakenResult?.total ?? 0);
    const debtReturnsToMe = Number(debtReturnsToMeResult?.total ?? 0);
    const debtReturnsFromMe = Number(debtReturnsFromMeResult?.total ?? 0);

    // Income = regular + debt_taken - returns_from_me
    const netIncome = Math.max(
      0,
      regularIncome + debtTaken - debtReturnsFromMe,
    );
    // Expense = regular + debt_given - returns_to_me
    const netExpense = Math.max(
      0,
      regularExpense + debtGiven - debtReturnsToMe,
    );

    // 7. Regular income by currency
    const regularIncomeByCurrencyResult = await createBaseQuery()
      .andWhere('t.type = :type', { type: 'income' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 6. Regular expense by currency
    const regularExpenseByCurrencyResult = await createBaseQuery()
      .andWhere('t.type = :type', { type: 'expense' })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 9. Debt given by currency
    const debtGivenByCurrencyResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_given'")
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 10. Debt taken by currency
    const debtTakenByCurrencyResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_taken'")
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 11. Debt returns TO ME by currency (only if original debt affected balance)
    const debtReturnsToMeByCurrencyResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_return_to_me'")
      .andWhere('t.is_debt_related = true')
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // 12. Debt returns FROM ME by currency (only if original debt affected balance)
    const debtReturnsFromMeByCurrencyResult = await createBaseQuery()
      .andWhere("t.category_id = 'debt_return_from_me'")
      .andWhere('t.is_debt_related = true')
      .select('t.currency', 'currency')
      .addSelect('SUM(t.amount)', 'amount')
      .groupBy('t.currency')
      .getRawMany<{ currency: string; amount: string }>();

    // Process by-currency data
    const regularIncomeByCurrency: Record<string, number> = {};
    for (const row of regularIncomeByCurrencyResult) {
      regularIncomeByCurrency[row.currency] = Number(row.amount);
    }

    const regularExpenseByCurrency: Record<string, number> = {};
    for (const row of regularExpenseByCurrencyResult) {
      regularExpenseByCurrency[row.currency] = Number(row.amount);
    }

    const debtGivenByCurrency: Record<string, number> = {};
    for (const row of debtGivenByCurrencyResult) {
      debtGivenByCurrency[row.currency] = Number(row.amount);
    }

    const debtTakenByCurrency: Record<string, number> = {};
    for (const row of debtTakenByCurrencyResult) {
      debtTakenByCurrency[row.currency] = Number(row.amount);
    }

    const debtReturnsToMeByCurrency: Record<string, number> = {};
    for (const row of debtReturnsToMeByCurrencyResult) {
      debtReturnsToMeByCurrency[row.currency] = Number(row.amount);
    }

    const debtReturnsFromMeByCurrency: Record<string, number> = {};
    for (const row of debtReturnsFromMeByCurrencyResult) {
      debtReturnsFromMeByCurrency[row.currency] = Number(row.amount);
    }

    // Calculate NET by currency
    const allCurrencies = new Set([
      ...Object.keys(regularIncomeByCurrency),
      ...Object.keys(regularExpenseByCurrency),
      ...Object.keys(debtGivenByCurrency),
      ...Object.keys(debtTakenByCurrency),
      ...Object.keys(debtReturnsToMeByCurrency),
      ...Object.keys(debtReturnsFromMeByCurrency),
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

      // Income = regular + debt_taken - returns_from_me
      const netIncomeForCurrency = Math.max(
        0,
        incomeVal + takenVal - returnsFromMe,
      );
      // Expense = regular + debt_given - returns_to_me
      const netExpenseForCurrency = Math.max(
        0,
        expenseVal + givenVal - returnsToMe,
      );

      if (netIncomeForCurrency > 0) {
        incomeByCurrency[currency] = netIncomeForCurrency;
      }
      if (netExpenseForCurrency > 0) {
        expenseByCurrency[currency] = netExpenseForCurrency;
      }
    }

    // Get category breakdown (only regular transactions, without debt returns)
    const categoryBreakdownResult = await createBaseQuery()
      .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
      .andWhere('(t.is_debt_related = false OR t.is_debt_related IS NULL)')
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
      .addGroupBy('t.currency')
      .getRawMany<{
        categoryId: string;
        categoryName: string | null;
        categoryIcon: string | null;
        categoryColor: string | null;
        type: 'income' | 'expense';
        currency: string;
        amount: string;
      }>();

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

    // Get category offsets from debt returns (debt_return_to_me → debt → source transaction → category)
    // When someone returns money to me, subtract from the original expense category
    let categoryOffsetsQuery = this.ormRepository
      .createQueryBuilder('return_tx')
      .innerJoin(DebtOrmEntity, 'd', 'd.close_transaction_id = return_tx.id')
      .innerJoin(
        TransactionOrmEntity,
        'source_tx',
        'source_tx.id = d.source_transaction_id',
      )
      .where('return_tx.user_id = :userId', { userId })
      .andWhere('return_tx.date >= :startDate', { startDate })
      .andWhere('return_tx.date <= :endDate', { endDate })
      .andWhere("return_tx.category_id = 'debt_return_to_me'")
      .select('source_tx.category_id', 'categoryId')
      .addSelect('source_tx.currency', 'currency')
      .addSelect('SUM(return_tx.amount)', 'offsetAmount')
      .groupBy('source_tx.category_id')
      .addGroupBy('source_tx.currency');

    if (accountIds && accountIds.length > 0) {
      categoryOffsetsQuery = categoryOffsetsQuery.andWhere(
        'return_tx.account_id IN (:...accountIds)',
        { accountIds },
      );
    }

    const categoryOffsetsResult = await categoryOffsetsQuery.getRawMany<{
      categoryId: string;
      currency: string;
      offsetAmount: string;
    }>();

    // Apply offsets to expense categories
    for (const offset of categoryOffsetsResult) {
      const key = `${offset.categoryId}-expense`;
      const category = categoryMap.get(key);

      if (category) {
        const offsetAmount = Number(offset.offsetAmount);
        category.amount -= offsetAmount;
        category.amountByCurrency[offset.currency] =
          (category.amountByCurrency[offset.currency] ?? 0) - offsetAmount;

        // Remove currency if it becomes <= 0
        if (category.amountByCurrency[offset.currency] <= 0) {
          delete category.amountByCurrency[offset.currency];
        }

        // Remove category if total amount becomes <= 0
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
}
