import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetAccountsQuery } from './get-accounts.query';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { toAccountResponse } from '../../shared/account-response.helper';

@QueryHandler(GetAccountsQuery)
export class GetAccountsHandler implements IQueryHandler<GetAccountsQuery> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(query: GetAccountsQuery) {
    const accounts = await this.accountRepository.findAllWithBalances(query.userId);

    return accounts.map(toAccountResponse);
  }
}
