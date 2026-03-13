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
    const defaultBudget = await this.budgetRepository.findDefault(query.userId);
    const now = new Date();
    const items: Array<{
      year: number;
      month: number;
      amount: number;
      currency: string;
      spent: number;
      percentage: number;
    }> = [];

    for (let i = 0; i < query.months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Find override for this month, fallback to default
      let budget = await this.budgetRepository.findOverride(query.userId, year, month);
      if (!budget) {
        budget = defaultBudget;
      }
      if (!budget) {
        continue;
      }

      // Get monthly stats
      const stats = await this.transactionRepository.getMonthlyStats(query.userId, year, month);

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

      items.push({
        year,
        month,
        amount: budget.amount,
        currency: budget.currency,
        spent: Math.round(spent * 100) / 100,
        percentage: Math.min(Math.round((spent / budget.amount) * 100), 999),
      });
    }

    return { items };
  }
}
