import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

@CommandHandler(CreateTransactionCommand)
export class CreateTransactionHandler implements ICommandHandler<CreateTransactionCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
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
    } = command;

    const transactionId = crypto.randomUUID();
    let transaction: Transaction;

    // Get source account
    const account =
      await this.accountRepository.findByIdWithBalances(accountId);
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

      const toAccount =
        await this.accountRepository.findByIdWithBalances(toAccountId);
      if (!toAccount) {
        throw new NotFoundException('Destination account not found');
      }
      if (toAccount.userId !== userId) {
        throw new ForbiddenException(
          'Destination account does not belong to user',
        );
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

      // Save both accounts
      await this.accountRepository.save(account);
      await this.accountRepository.save(toAccount);

      // Publish account events
      await this.eventPublisher.publishEvents(account);
      await this.eventPublisher.publishEvents(toAccount);
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
        );
        account.debit(amount, currency);
      }

      // Save account with updated balance
      await this.accountRepository.save(account);
      await this.eventPublisher.publishEvents(account);
    }

    // Save transaction
    const savedTransaction = await this.transactionRepository.save(transaction);
    await this.eventPublisher.publishEvents(transaction);

    return this.toResponse(savedTransaction);
  }

  private toResponse(transaction: Transaction) {
    return {
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      amount: transaction.amountValue,
      currency: transaction.currency,
      type: transaction.typeValue,
      description: transaction.description,
      date: transaction.date,
      isDebtRelated: transaction.isDebtRelated,
      toAccountId: transaction.toAccountId,
      toAmount: transaction.toAmountValue,
      toCurrency: transaction.toCurrency,
      createdAt: transaction.createdAt,
    };
  }
}
