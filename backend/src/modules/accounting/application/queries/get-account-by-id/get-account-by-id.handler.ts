import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetAccountByIdQuery } from './get-account-by-id.query';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { toAccountResponse } from '../../shared/account-response.helper';

@QueryHandler(GetAccountByIdQuery)
export class GetAccountByIdHandler
  implements IQueryHandler<GetAccountByIdQuery>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetAccountByIdQuery) {
    const account = await this.accountRepository.findByIdWithBalances(query.id);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    return toAccountResponse(account);
  }
}
