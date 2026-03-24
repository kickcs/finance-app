import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetBudgetForMonthQuery } from './get-budget-for-month.query';
import { IBudgetRepository, BUDGET_REPOSITORY } from '../../../domain/repositories';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../../accounting/domain/repositories';
import {
  IExchangeRateCache,
  EXCHANGE_RATE_CACHE,
} from '../../../../exchange/application/services/exchange-rate-cache.service';
import { BudgetResponseMapper } from '../../mappers';
import { convertExpensesToCurrency, calcBudgetPercentage } from '../convert-expenses';

@QueryHandler(GetBudgetForMonthQuery)
export class GetBudgetForMonthHandler implements IQueryHandler<GetBudgetForMonthQuery> {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly exchangeRateCache: IExchangeRateCache,
  ) {}

  async execute(query: GetBudgetForMonthQuery) {
    // Fetch override and default in parallel
    const [override, defaultBudget] = await Promise.all([
      this.budgetRepository.findOverride(query.userId, query.year, query.month),
      this.budgetRepository.findDefault(query.userId),
    ]);
    const budget = override ?? defaultBudget;
    if (!budget) {
      return null;
    }

    // Get monthly stats
    const stats = await this.transactionRepository.getMonthlyStats(
      query.userId,
      query.year,
      query.month,
      query.startDay,
    );

    const spent = convertExpensesToCurrency(
      stats.expenseByCurrency,
      budget.currency,
      this.exchangeRateCache,
    );

    return {
      budget: BudgetResponseMapper.toResponse(budget),
      spent,
      remaining: Math.round((budget.amount - spent) * 100) / 100,
      percentage: calcBudgetPercentage(spent, budget.amount),
    };
  }
}
