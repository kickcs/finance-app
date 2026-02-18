import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetBalancesByAccountQuery } from './get-balances-by-account.query';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';

@QueryHandler(GetBalancesByAccountQuery)
export class GetBalancesByAccountHandler
  implements IQueryHandler<GetBalancesByAccountQuery>
{
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
  ) {}

  async execute(query: GetBalancesByAccountQuery) {
    const balances = await this.accountBalanceRepository.findByAccountId(
      query.accountId,
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
