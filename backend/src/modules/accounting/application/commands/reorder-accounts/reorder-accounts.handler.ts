import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ReorderAccountsCommand } from './reorder-accounts.command';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';

@CommandHandler(ReorderAccountsCommand)
export class ReorderAccountsHandler implements ICommandHandler<ReorderAccountsCommand> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: ReorderAccountsCommand): Promise<void> {
    await this.accountRepository.updateOrder(command.accountIds);
  }
}
