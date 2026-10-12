import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { GetTransactionsByAccountPaginatedQuery } from './get-transactions-by-account-paginated.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import { toTransactionResponse } from '../../helpers/to-transaction-response';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@QueryHandler(GetTransactionsByAccountPaginatedQuery)
export class GetTransactionsByAccountPaginatedHandler implements IQueryHandler<GetTransactionsByAccountPaginatedQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetTransactionsByAccountPaginatedQuery) {
    const account = await this.accountRepository.findById(query.accountId);
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit null check for security
    if (!account || account.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    const cursor =
      query.cursorDate && query.cursorCreatedAt
        ? { date: query.cursorDate, createdAt: query.cursorCreatedAt, id: query.cursorId }
        : undefined;

    const result = await this.transactionRepository.getByAccountPaginated(
      query.accountId,
      query.pageSize,
      cursor,
    );

    const siblings = await this.transactionRepository.findPaymentSiblings(result.data);
    return {
      data: result.data.map((t) => toTransactionResponse(t, siblings.get(t.id))),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }
}
