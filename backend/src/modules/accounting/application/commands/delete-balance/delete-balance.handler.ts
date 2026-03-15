import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteBalanceCommand } from './delete-balance.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { assertAccountOwnership } from '../../helpers/assert-account-ownership';

@CommandHandler(DeleteBalanceCommand)
export class DeleteBalanceHandler implements ICommandHandler<DeleteBalanceCommand> {
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: DeleteBalanceCommand): Promise<void> {
    await assertAccountOwnership(this.accountRepository, command.accountId, command.userId);

    await this.accountBalanceRepository.delete(command.accountId, command.currency);
  }
}
