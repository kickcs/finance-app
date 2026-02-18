import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetBalancesByAccountsQuery } from './get-balances-by-accounts.query';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';

@QueryHandler(GetBalancesByAccountsQuery)
export class GetBalancesByAccountsHandler
  implements IQueryHandler<GetBalancesByAccountsQuery>
{
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
  ) {}

  async execute(query: GetBalancesByAccountsQuery) {
    const balances = await this.accountBalanceRepository.findByAccountIds(
      query.accountIds,
    );

    return balances.map((b) => ({
      id: b.id,
      accountId: b.accountId,
      currency: b.currency,
      balance: b.balance,
      createdAt: b.createdAt,
    }));
  }
}
