import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTransactionsPaginatedQuery } from './get-transactions-paginated.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import { toTransactionResponse } from '../../helpers/to-transaction-response';

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

    const siblings = await this.transactionRepository.findPaymentSiblings(result.data);
    return {
      data: result.data.map((t) => {
        const netAmount = t.amountValue - t.returnedAmount;
        return {
          ...toTransactionResponse(t, siblings.get(t.id)),
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
