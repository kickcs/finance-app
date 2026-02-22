import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DeleteTransactionCommand } from './delete-transaction.command';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { BalanceCalculationService, TransferDomainService } from '../../../domain/services';

@CommandHandler(DeleteTransactionCommand)
export class DeleteTransactionHandler implements ICommandHandler<DeleteTransactionCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: DeleteTransactionCommand): Promise<void> {
    const transaction = await this.transactionRepository.findById(command.id);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId !== command.userId) {
      throw new ForbiddenException('Transaction does not belong to user');
    }

    // Get the account and reverse the transaction effect
    const account = await this.accountRepository.findByIdWithBalances(transaction.accountId);

    // Mark transaction as deleted (raises event)
    transaction.markDeleted();

    // Wrap all balance reversals + delete in a DB transaction
    await this.dataSource.transaction(async () => {
      if (account) {
        if (transaction.type.isTransfer() && transaction.toAccountId) {
          const toAccount = await this.accountRepository.findByIdWithBalances(
            transaction.toAccountId,
          );
          if (!toAccount) {
            throw new NotFoundException(
              'Destination account not found, cannot safely delete transfer',
            );
          }
          TransferDomainService.reverseTransfer(
            account,
            toAccount,
            transaction.amountValue,
            transaction.currency,
            transaction.toAmountValue!,
            transaction.toCurrency!,
          );
          await this.accountRepository.save(toAccount);
        } else {
          BalanceCalculationService.reverseTransaction(account, transaction);
        }
        await this.accountRepository.save(account);
      }

      await this.transactionRepository.delete(command.id);
    });

    // Publish events after commit
    if (account) {
      await this.eventPublisher.publishEvents(account);
    }
    await this.eventPublisher.publishEvents(transaction);
  }
}
