import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsByDateRangeQuery } from './get-transactions-by-date-range.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import { toTransactionResponse } from '../../helpers/to-transaction-response';

@QueryHandler(GetTransactionsByDateRangeQuery)
export class GetTransactionsByDateRangeHandler implements IQueryHandler<GetTransactionsByDateRangeQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionsByDateRangeQuery) {
    const transactions = await this.transactionRepository.findByDateRange(
      query.userId,
      query.startDate,
      query.endDate,
    );

    const siblings = await this.transactionRepository.findPaymentSiblings(transactions);
    return transactions.map((t) => toTransactionResponse(t, siblings.get(t.id)));
  }
}
