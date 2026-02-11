import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetTransactionByIdQuery)
export class GetTransactionByIdHandler implements IQueryHandler<GetTransactionByIdQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionByIdQuery) {
    const transaction = await this.transactionRepository.findById(query.id);

    if (!transaction) {
      throw new NotFoundException(`Transaction with id ${query.id} not found`);
    }

    if (transaction.userId !== query.userId) {
      throw new NotFoundException(`Transaction with id ${query.id} not found`);
    }

    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      amount: transaction.amountValue,
      currency: transaction.currency,
      type: transaction.typeValue,
      description: transaction.description,
      date: transaction.date,
      isDebtRelated: transaction.isDebtRelated,
      toAccountId: transaction.toAccountId,
      toAmount: transaction.toAmountValue,
      toCurrency: transaction.toCurrency,
      createdAt: transaction.createdAt,
    };
  }
}
