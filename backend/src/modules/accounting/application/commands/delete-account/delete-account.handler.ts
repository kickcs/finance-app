import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteAccountCommand } from './delete-account.command';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler implements ICommandHandler<DeleteAccountCommand> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    const account = await this.accountRepository.findById(command.id);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    account.markDeleted();

    await this.accountRepository.delete(command.id);
    await this.eventPublisher.publishEvents(account);
  }
}
