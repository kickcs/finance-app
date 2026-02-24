import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsByDateRangeQuery } from './get-transactions-by-date-range.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

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

    return transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      accountId: t.accountId,
      categoryId: t.categoryId,
      amount: t.amountValue,
      currency: t.currency,
      type: t.typeValue,
      description: t.description,
      date: t.date,
      isDebtRelated: t.isDebtRelated,
      debtId: t.debtId,
      toAccountId: t.toAccountId,
      toAmount: t.toAmountValue,
      toCurrency: t.toCurrency,
      createdAt: t.createdAt,
    }));
  }
}
