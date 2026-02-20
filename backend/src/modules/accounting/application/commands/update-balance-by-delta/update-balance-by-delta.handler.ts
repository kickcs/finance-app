import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateBalanceByDeltaCommand } from './update-balance-by-delta.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';

@CommandHandler(UpdateBalanceByDeltaCommand)
export class UpdateBalanceByDeltaHandler implements ICommandHandler<UpdateBalanceByDeltaCommand> {
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
  ) {}

  async execute(command: UpdateBalanceByDeltaCommand) {
    const balance = await this.accountBalanceRepository.updateByDelta(
      command.accountId,
      command.currency,
      command.delta,
    );

    if (!balance) {
      throw new NotFoundException(
        `Balance for account ${command.accountId} with currency ${command.currency} not found`,
      );
    }

    return {
      id: balance.id,
      accountId: balance.accountId,
      currency: balance.currency,
      balance: balance.balance,
      createdAt: balance.createdAt,
    };
  }
}
