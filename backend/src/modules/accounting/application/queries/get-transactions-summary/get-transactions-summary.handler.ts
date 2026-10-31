import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsSummaryQuery } from './get-transactions-summary.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetTransactionsSummaryQuery)
export class GetTransactionsSummaryHandler implements IQueryHandler<GetTransactionsSummaryQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionsSummaryQuery) {
    // `created_at` задаёт приложение, а не БД, поэтому и момент сверки берём по его часам.
    const asOf = new Date();
    const summary = await this.transactionRepository.getSummary(query.userId, {
      ...query.filter,
      asOf,
    });

    return {
      count: summary.count,
      eligibleCount: summary.count - summary.lockedCount,
      lockedCount: summary.lockedCount,
      totals: summary.totals,
      asOf: asOf.toISOString(),
    };
  }
}
