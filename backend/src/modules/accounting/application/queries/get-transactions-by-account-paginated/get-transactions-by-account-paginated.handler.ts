import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsByAccountPaginatedQuery } from './get-transactions-by-account-paginated.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetTransactionsByAccountPaginatedQuery)
export class GetTransactionsByAccountPaginatedHandler implements IQueryHandler<GetTransactionsByAccountPaginatedQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionsByAccountPaginatedQuery) {
    const cursor =
      query.cursorDate && query.cursorCreatedAt
        ? { date: query.cursorDate, createdAt: query.cursorCreatedAt }
        : undefined;

    const result = await this.transactionRepository.getByAccountPaginated(
      query.accountId,
      query.pageSize,
      cursor,
    );

    return {
      data: result.data.map((t) => ({
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
      })),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}
