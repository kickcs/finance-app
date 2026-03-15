import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { GetBalancesByAccountsQuery } from './get-balances-by-accounts.query';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@QueryHandler(GetBalancesByAccountsQuery)
export class GetBalancesByAccountsHandler implements IQueryHandler<GetBalancesByAccountsQuery> {
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetBalancesByAccountsQuery) {
    const userAccounts = await this.accountRepository.findByUserId(query.userId);
    const userAccountIds = new Set(userAccounts.map((a) => a.id));

    const unauthorizedIds = query.accountIds.filter((id) => !userAccountIds.has(id));

    if (unauthorizedIds.length > 0) {
      throw new ForbiddenException('Access denied');
    }

    const balances = await this.accountBalanceRepository.findByAccountIds(query.accountIds);

    return balances.map((b) => ({
      id: b.id,
      accountId: b.accountId,
      currency: b.currency,
      balance: b.balance,
      createdAt: b.createdAt,
    }));
  }
}
