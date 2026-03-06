import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateTransactionCommand } from './create-transaction.command';
import { Transaction } from '../../../domain/aggregates/transaction';
import { TransferDomainService } from '../../../domain/services';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';
import { toTransactionResponse } from '../../helpers/to-transaction-response';

@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler implements ICommandHandler<CreateTransactionCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: CreateTransactionCommand) {
    const {
      userId,
      accountId,
      categoryId,
      amount,
      currency,
      type,
      date,
      description,
      isDebtRelated,
      toAccountId,
      toAmount,
      toCurrency,
      debtId,
    } = command;

    const transactionId = crypto.randomUUID();
    let transaction: Transaction;

    // Get source account
    const account = await this.accountRepository.findByIdWithBalances(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException('Account does not belong to user');
    }

    if (type === 'transfer') {
      if (!toAccountId) {
        throw new BadRequestException('toAccountId is required for transfers');
      }

      const toAccount = await this.accountRepository.findByIdWithBalances(toAccountId);
      if (!toAccount) {
        throw new NotFoundException('Destination account not found');
      }
      if (toAccount.userId !== userId) {
        throw new ForbiddenException('Destination account does not belong to user');
      }

      // Use domain service for transfer
      transaction = TransferDomainService.executeTransfer({
        id: transactionId,
        userId,
        fromAccount: account,
        toAccount,
        categoryId,
        fromAmount: amount,
        fromCurrency: currency,
        toAmount: toAmount ?? amount,
        toCurrency: toCurrency ?? currency,
        date,
        description,
      });

      // Create commission expense if fee specified
      const feeAmount = command.feeAmount;
      let feeTransaction: Transaction | null = null;

      if (feeAmount && feeAmount > 0) {
        feeTransaction = Transaction.createExpense(
          crypto.randomUUID(),
          userId,
          accountId,
          'commission',
          feeAmount,
          currency,
          date,
          'Комиссия за перевод',
          false,
          undefined,
        );
        account.debit(feeAmount, currency);
      }

      // Save all within a database transaction
      await this.dataSource.transaction(async () => {
        await this.accountRepository.save(account);
        await this.accountRepository.save(toAccount);
        await this.transactionRepository.save(transaction);
        if (feeTransaction) {
          await this.transactionRepository.save(feeTransaction);
        }
      });

      // Publish events after commit
      await this.eventPublisher.publishEvents(account);
      await this.eventPublisher.publishEvents(toAccount);
      await this.eventPublisher.publishEvents(transaction);
      if (feeTransaction) {
        await this.eventPublisher.publishEvents(feeTransaction);
      }

      return toTransactionResponse(transaction);
    } else {
      // Create income or expense transaction
      if (type === 'income') {
        transaction = Transaction.createIncome(
          transactionId,
          userId,
          accountId,
          categoryId,
          amount,
          currency,
          date,
          description,
          isDebtRelated,
          debtId,
        );
        account.credit(amount, currency);
      } else {
        transaction = Transaction.createExpense(
          transactionId,
          userId,
          accountId,
          categoryId,
          amount,
          currency,
          date,
          description,
          isDebtRelated,
          debtId,
        );
        account.debit(amount, currency);
      }

      // Save within a database transaction
      await this.dataSource.transaction(async () => {
        await this.accountRepository.save(account);
        await this.transactionRepository.save(transaction);
      });

      // Publish events after commit
      await this.eventPublisher.publishEvents(account);
      await this.eventPublisher.publishEvents(transaction);
    }

    return toTransactionResponse(transaction);
  }
}
