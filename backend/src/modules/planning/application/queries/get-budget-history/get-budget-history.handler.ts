import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetBudgetHistoryQuery } from './get-budget-history.query';
import { IBudgetRepository, BUDGET_REPOSITORY } from '../../../domain/repositories';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../../accounting/domain/repositories';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../../../exchange/application/services/exchange-rate-cache.service';
import { convertExpensesToCurrency, calcBudgetPercentage } from '../convert-expenses';
import { Budget } from '../../../domain/aggregates/budget';
import { getCurrentFinancialMonthInTz } from '../../../../../shared/utils/financial-period';

@QueryHandler(GetBudgetHistoryQuery)
export class GetBudgetHistoryHandler implements IQueryHandler<GetBudgetHistoryQuery> {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly exchangeRateCache: IExchangeRateCache,
  ) {}

  async execute(query: GetBudgetHistoryQuery) {
    // Fetch all budgets for user in one query (default + all overrides)
    const allBudgets = await this.budgetRepository.findByUserId(query.userId);
    const defaultBudget = allBudgets.find((b) => b.isDefault) ?? null;
    const overrideMap = new Map(
      allBudgets.filter((b) => !b.isDefault).map((b) => [`${b.year}-${b.month}`, b]),
    );

    const months: Array<{ year: number; month: number }> = [];
    const current = getCurrentFinancialMonthInTz(query.startDay, query.timezone);
    let { year: y, month: m } = current;

    for (let i = 0; i < query.months; i++) {
      months.push({ year: y, month: m });
      m--;
      if (m === 0) {
        m = 12;
        y--;
      }
    }

    // Resolve budgets and filter months that have one
    const monthsWithBudgets = months
      .map((m) => ({
        ...m,
        budget: overrideMap.get(`${m.year}-${m.month}`) ?? defaultBudget,
      }))
      .filter((m): m is typeof m & { budget: Budget } => m.budget !== null);

    // Fetch all monthly stats in parallel
    const statsResults = await Promise.all(
      monthsWithBudgets.map((m) =>
        this.transactionRepository.getMonthlyStats(
          query.userId,
          m.year,
          m.month,
          query.startDay,
          query.timezone,
        ),
      ),
    );

    return {
      items: monthsWithBudgets.map((m, i) => {
        const spent = convertExpensesToCurrency(
          statsResults[i].expenseByCurrency,
          m.budget.currency,
          this.exchangeRateCache,
        );

        return {
          year: m.year,
          month: m.month,
          amount: m.budget.amount,
          currency: m.budget.currency,
          spent,
          percentage: calcBudgetPercentage(spent, m.budget.amount),
        };
      }),
    };
  }
}
