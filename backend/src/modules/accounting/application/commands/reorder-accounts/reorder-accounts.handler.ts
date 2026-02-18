import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { ReorderAccountsCommand } from './reorder-accounts.command';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@CommandHandler(ReorderAccountsCommand)
export class ReorderAccountsHandler
  implements ICommandHandler<ReorderAccountsCommand>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: ReorderAccountsCommand): Promise<void> {
    // Verify all accounts belong to the user
    const accounts = await this.accountRepository.findByUserId(command.userId);
    const userAccountIds = new Set(accounts.map((a) => a.id));

    for (const id of command.accountIds) {
      if (!userAccountIds.has(id)) {
        throw new ForbiddenException('Access denied');
      }
    }

    await this.accountRepository.updateOrder(command.accountIds);
  }
}
