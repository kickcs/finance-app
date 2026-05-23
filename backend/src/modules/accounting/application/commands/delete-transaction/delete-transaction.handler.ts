import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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
import { IDebtRepository, DEBT_REPOSITORY } from '../../../../debt/domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';
import { BalanceCalculationService, TransferDomainService } from '../../../domain/services';

@CommandHandler(DeleteTransactionCommand)
export class DeleteTransactionHandler implements ICommandHandler<DeleteTransactionCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
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

    // Prevent deletion if transaction is linked to open debts (as source or direct transaction)
    if (!command.skipDebtCheck) {
      const hasOpenDebts = await this.debtRepository.hasOpenDebtsForTransaction(command.id);
      if (hasOpenDebts) {
        throw new BadRequestException(
          'Нельзя удалить транзакцию, пока есть связанные открытые долги. Сначала закройте долги.',
        );
      }
    }

    // Informational transactions never modified the account balance, so we skip
    // the reversal step entirely. Loading the account is also unnecessary.
    const account = transaction.isInformational
      ? null
      : await this.accountRepository.findByIdWithBalances(transaction.accountId);

    // If this is the forgiveness info-tx attached to a closed debt, reverse the
    // forgiveness on the debt side too — otherwise debts.close_transaction_id
    // dangles (no FK) and the debt remains is_closed=true with no way to undo.
    const linkedClosedDebt = transaction.isInformational
      ? await this.debtRepository.findByCloseTransactionId(command.id)
      : null;

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

      if (linkedClosedDebt) {
        const restoredRemaining = linkedClosedDebt.forgivenAmount;
        linkedClosedDebt.update({
          closeTransactionId: null,
          forgivenAmount: 0,
          isClosed: false,
          remainingAmount: restoredRemaining,
        });
        await this.debtRepository.save(linkedClosedDebt);
      }

      await this.transactionRepository.delete(command.id);
    });

    // Publish events after commit
    if (account) {
      await this.eventPublisher.publishEvents(account);
    }
    if (linkedClosedDebt) {
      await this.eventPublisher.publishEvents(linkedClosedDebt);
    }
    await this.eventPublisher.publishEvents(transaction);
  }
}
