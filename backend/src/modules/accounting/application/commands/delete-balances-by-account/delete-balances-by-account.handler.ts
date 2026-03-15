import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteBalancesByAccountCommand } from './delete-balances-by-account.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { assertAccountOwnership } from '../../helpers/assert-account-ownership';

@CommandHandler(DeleteBalancesByAccountCommand)
export class DeleteBalancesByAccountHandler implements ICommandHandler<DeleteBalancesByAccountCommand> {
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: DeleteBalancesByAccountCommand): Promise<void> {
    await assertAccountOwnership(this.accountRepository, command.accountId, command.userId);

    await this.accountBalanceRepository.deleteByAccountId(command.accountId);
  }
}
