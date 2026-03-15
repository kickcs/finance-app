import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpsertBalanceCommand } from './upsert-balance.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { assertAccountOwnership } from '../../helpers/assert-account-ownership';

@CommandHandler(UpsertBalanceCommand)
export class UpsertBalanceHandler implements ICommandHandler<UpsertBalanceCommand> {
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: UpsertBalanceCommand) {
    await assertAccountOwnership(this.accountRepository, command.accountId, command.userId);

    const balance = await this.accountBalanceRepository.upsert(
      command.accountId,
      command.currency,
      command.balance,
    );

    return {
      id: balance.id,
      accountId: balance.accountId,
      currency: balance.currency,
      balance: balance.balance,
      createdAt: balance.createdAt,
    };
  }
}
