import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateManyBalancesCommand } from './create-many-balances.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { assertAccountOwnership } from '../../helpers/assert-account-ownership';

@CommandHandler(CreateManyBalancesCommand)
export class CreateManyBalancesHandler implements ICommandHandler<CreateManyBalancesCommand> {
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: CreateManyBalancesCommand) {
    await assertAccountOwnership(this.accountRepository, command.accountId, command.userId);

    const balances = await this.accountBalanceRepository.createMany(
      command.accountId,
      command.balances,
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
