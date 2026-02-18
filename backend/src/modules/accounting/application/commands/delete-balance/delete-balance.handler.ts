import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteBalanceCommand } from './delete-balance.command';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';

@CommandHandler(DeleteBalanceCommand)
export class DeleteBalanceHandler
  implements ICommandHandler<DeleteBalanceCommand>
{
  constructor(
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
  ) {}

  async execute(command: DeleteBalanceCommand): Promise<void> {
    await this.accountBalanceRepository.delete(
      command.accountId,
      command.currency,
    );
  }
}
