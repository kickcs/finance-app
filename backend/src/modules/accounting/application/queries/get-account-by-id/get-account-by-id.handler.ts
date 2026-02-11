import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetAccountByIdQuery } from './get-account-by-id.query';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@QueryHandler(GetAccountByIdQuery)
export class GetAccountByIdHandler implements IQueryHandler<GetAccountByIdQuery> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetAccountByIdQuery) {
    const account = await this.accountRepository.findByIdWithBalances(query.id);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return {
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
    };
  }
}
