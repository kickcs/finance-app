import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsByAccountQuery } from './get-transactions-by-account.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetTransactionsByAccountQuery)
export class GetTransactionsByAccountHandler implements IQueryHandler<GetTransactionsByAccountQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionsByAccountQuery) {
    const transactions = await this.transactionRepository.findByAccountId(
      query.accountId,
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
      toAccountId: t.toAccountId,
      toAmount: t.toAmountValue,
      toCurrency: t.toCurrency,
      createdAt: t.createdAt,
    }));
  }
}
