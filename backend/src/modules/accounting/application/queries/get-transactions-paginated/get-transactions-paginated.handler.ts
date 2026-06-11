import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsPaginatedQuery } from './get-transactions-paginated.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetTransactionsPaginatedQuery)
export class GetTransactionsPaginatedHandler implements IQueryHandler<GetTransactionsPaginatedQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionsPaginatedQuery) {
    const result = await this.transactionRepository.getPaginated(query.userId, {
      pageSize: query.pageSize,
      cursorDate: query.cursorDate,
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId: query.cursorId,
      type: query.type,
      accountId: query.accountId,
      categoryId: query.categoryId,
      search: query.search,
      debtId: query.debtId,
    });

    return {
      data: result.data.map((t) => {
        const netAmount = t.amountValue - t.returnedAmount;
        return {
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
          isInformational: t.isInformational,
          debtId: t.debtId,
          toAccountId: t.toAccountId,
          toAmount: t.toAmountValue,
          toCurrency: t.toCurrency,
          createdAt: t.createdAt,
          returnedAmount: t.returnedAmount,
          netAmount,
          hasDebtReturns: t.returnedAmount > 0,
        };
      }),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}
