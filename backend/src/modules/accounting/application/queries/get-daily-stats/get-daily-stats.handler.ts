import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDailyStatsQuery } from './get-daily-stats.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetDailyStatsQuery)
export class GetDailyStatsHandler implements IQueryHandler<GetDailyStatsQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetDailyStatsQuery) {
    return this.transactionRepository.getDailyStats(query.userId, {
      startDate: query.startDate,
      endDate: query.endDate,
      accountIds: query.accountIds,
      groupBy: query.groupBy,
    });
  }
}
