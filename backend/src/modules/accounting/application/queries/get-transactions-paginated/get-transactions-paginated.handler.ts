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
      ...query.filter,
      ...query.page,
    });

    return {
      data: result.data.map((t) => {
        const netAmount = t.amountValue - t.returnedAmount;
        return {
          ...toTransactionResponse(t, t.paymentSibling),
          returnedAmount: t.returnedAmount,
          netAmount,
          hasDebtReturns: t.returnedAmount > 0,
          bulkLocked: t.bulkLocked,
        };
      }),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}
