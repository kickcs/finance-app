import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteBalancesByAccountCommand } from './delete-balances-by-account.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';

@CommandHandler(DeleteBalancesByAccountCommand)
export class DeleteBalancesByAccountHandler
  implements ICommandHandler<DeleteBalancesByAccountCommand>
{
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
  ) {}

  async execute(command: DeleteBalancesByAccountCommand): Promise<void> {
    await this.accountBalanceRepository.deleteByAccountId(command.accountId);
  }
}
