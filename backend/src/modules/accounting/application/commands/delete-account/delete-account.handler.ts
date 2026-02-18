import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteAccountCommand } from './delete-account.command';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountBalanceRepository,
  ACCOUNT_BALANCE_REPOSITORY,
} from '../../../domain/repositories/account-balance.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler
  implements ICommandHandler<DeleteAccountCommand>
{
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_BALANCE_REPOSITORY)
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    const account = await this.accountRepository.findById(command.id);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.userId !== command.userId) {
      throw new ForbiddenException('Access denied');
    }

    account.markDeleted();

    // Delete related data and account atomically
    await this.dataSource.transaction(async () => {
      await this.transactionRepository.deleteByAccountId(command.id);
      await this.accountBalanceRepository.deleteByAccountId(command.id);
      await this.accountRepository.delete(command.id);
    });

    await this.eventPublisher.publishEvents(account);
  }
}
