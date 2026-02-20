import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetAnalyticsStatsQuery } from './get-analytics-stats.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetAnalyticsStatsQuery)
export class GetAnalyticsStatsHandler implements IQueryHandler<GetAnalyticsStatsQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetAnalyticsStatsQuery) {
    return this.transactionRepository.getAnalyticsStats(query.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      accountIds: query.accountIds,
    });
  }
}
