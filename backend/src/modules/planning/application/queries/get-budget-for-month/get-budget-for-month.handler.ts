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
    // Find override first, then default
    let budget = await this.budgetRepository.findOverride(query.userId, query.year, query.month);
    if (!budget) {
      budget = await this.budgetRepository.findDefault(query.userId);
    }
    if (!budget) {
      return null;
    }

    // Get monthly stats
    const stats = await this.transactionRepository.getMonthlyStats(
      query.userId,
      query.year,
      query.month,
    );

    // Convert multi-currency expenses to budget's currency
    let spent = 0;
    for (const [currency, amount] of Object.entries(stats.expenseByCurrency)) {
      if (currency === budget.currency) {
        spent += amount;
      } else {
        const rateResult = this.exchangeRateCache.resolve(currency, budget.currency);
        spent += rateResult ? amount * rateResult.rate : amount;
      }
    }

    return {
      budget: BudgetResponseMapper.toResponse(budget),
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round((budget.amount - spent) * 100) / 100,
      percentage: Math.min(Math.round((spent / budget.amount) * 100), 999),
    };
  }
}
