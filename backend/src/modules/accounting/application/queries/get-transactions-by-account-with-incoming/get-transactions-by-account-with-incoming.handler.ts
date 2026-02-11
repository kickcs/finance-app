import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsByAccountWithIncomingQuery } from './get-transactions-by-account-with-incoming.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetTransactionsByAccountWithIncomingQuery)
export class GetTransactionsByAccountWithIncomingHandler implements IQueryHandler<GetTransactionsByAccountWithIncomingQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionsByAccountWithIncomingQuery) {
    const transactions =
      await this.transactionRepository.findByAccountIdWithIncoming(
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
