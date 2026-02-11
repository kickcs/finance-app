import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetAccountsQuery } from './get-accounts.query';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@QueryHandler(GetAccountsQuery)
export class GetAccountsHandler implements IQueryHandler<GetAccountsQuery> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetAccountsQuery) {
    const accounts = await this.accountRepository.findAllWithBalances(
      query.userId,
    );

    return accounts.map((account) => ({
      id: account.id,
      userId: account.userId,
      name: account.name,
      icon: account.icon,
      color: account.color,
      type: account.typeValue,
      order: account.order,
      balances: account.balances.map((b) => ({
        id: b.id,
        currency: b.currencyCode,
        balance: b.balanceAmount,
      })),
      createdAt: account.createdAt,
    }));
  }
}
