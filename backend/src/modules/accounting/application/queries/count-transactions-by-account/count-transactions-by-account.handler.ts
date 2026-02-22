import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CountTransactionsByAccountQuery } from './count-transactions-by-account.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@QueryHandler(CountTransactionsByAccountQuery)
export class CountTransactionsByAccountHandler implements IQueryHandler<CountTransactionsByAccountQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: CountTransactionsByAccountQuery): Promise<{ count: number }> {
    const account = await this.accountRepository.findById(query.accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    const count = await this.transactionRepository.countByAccountId(query.accountId);
    return { count };
  }
}
