import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetMonthlyStatsQuery } from './get-monthly-stats.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetMonthlyStatsQuery)
export class GetMonthlyStatsHandler implements IQueryHandler<GetMonthlyStatsQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetMonthlyStatsQuery) {
    return this.transactionRepository.getMonthlyStats(query.userId, query.year, query.month);
  }
}
