import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpdateTransactionCommand } from './update-transaction.command';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(UpdateTransactionCommand)
export class UpdateTransactionHandler implements ICommandHandler<UpdateTransactionCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: UpdateTransactionCommand) {
    const transaction = await this.transactionRepository.findById(command.id);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId !== command.userId) {
      throw new ForbiddenException('Transaction does not belong to user');
    }

    // Store old values for balance recalculation
    const oldAccountId = transaction.accountId;
    const oldAmount = transaction.amountValue;
    const oldCurrency = transaction.currency;
    const oldType = transaction.typeValue;
    const oldToAccountId = transaction.toAccountId;
    const oldToAmount = transaction.toAmountValue;
    const oldToCurrency = transaction.toCurrency;

    // Determine new values (or keep old if not changed)
    const newAccountId = command.data.accountId ?? oldAccountId;
    const newAmount = command.data.amount ?? oldAmount;
    const newCurrency = command.data.currency ?? oldCurrency;
    const newType = command.data.type ?? oldType;
    const newToAccountId =
      command.data.toAccountId !== undefined
        ? command.data.toAccountId
        : oldToAccountId;
    const newToAmount =
      command.data.toAmount !== undefined ? command.data.toAmount : oldToAmount;
    const newToCurrency =
      command.data.toCurrency !== undefined
        ? command.data.toCurrency
        : oldToCurrency;

    // Check if any balance-affecting field changed
    const balanceChanged =
      oldAccountId !== newAccountId ||
      oldAmount !== newAmount ||
      oldCurrency !== newCurrency ||
      oldType !== newType ||
      oldToAccountId !== newToAccountId ||
      oldToAmount !== newToAmount ||
      oldToCurrency !== newToCurrency;

    // Update the transaction data
    transaction.update({
      ...command.data,
      date: command.data.date ? new Date(command.data.date) : undefined,
    });

    // Wrap all balance + transaction updates in a DB transaction
    await this.dataSource.transaction(async () => {
      if (balanceChanged) {
        if (oldType !== 'transfer' && newType !== 'transfer') {
          await this.handleNonTransferBalanceUpdate(
            command.userId,
            oldAccountId,
            newAccountId,
            oldAmount,
            newAmount,
            oldCurrency,
            newCurrency,
            oldType,
            newType,
          );
        } else if (oldType === 'transfer' && newType === 'transfer') {
          await this.handleTransferBalanceUpdate(
            command.userId,
            oldAccountId,
            newAccountId,
            oldAmount,
            newAmount,
            oldCurrency,
            newCurrency,
            oldToAccountId,
            newToAccountId,
            oldToAmount,
            newToAmount,
            oldToCurrency,
            newToCurrency,
          );
        } else if (oldType === 'transfer' && newType !== 'transfer') {
          await this.reverseTransfer(
            command.userId,
            oldAccountId,
            oldAmount,
            oldCurrency,
            oldToAccountId!,
            oldToAmount!,
            oldToCurrency!,
          );
          await this.applyNonTransfer(
            command.userId,
            newAccountId,
            newAmount,
            newCurrency,
            newType,
          );
        } else {
          await this.reverseNonTransfer(
            command.userId,
            oldAccountId,
            oldAmount,
            oldCurrency,
            oldType,
          );
          await this.applyTransfer(
            command.userId,
            newAccountId,
            newAmount,
            newCurrency,
            newToAccountId!,
            newToAmount!,
            newToCurrency!,
          );
        }
      }

      await this.transactionRepository.save(transaction);
    });

    await this.eventPublisher.publishEvents(transaction);

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

  private async validateAccountOwnership(
    accountId: string,
    userId: string,
  ) {
    const account =
      await this.accountRepository.findByIdWithBalances(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException('Account does not belong to user');
    }
    return account;
  }

  private async handleNonTransferBalanceUpdate(
    userId: string,
    oldAccountId: string,
    newAccountId: string,
    oldAmount: number,
    newAmount: number,
    oldCurrency: string,
    newCurrency: string,
    oldType: string,
    newType: string,
  ): Promise<void> {
    if (oldAccountId === newAccountId && oldCurrency === newCurrency) {
      // Same account and currency - just adjust the difference
      const account = await this.validateAccountOwnership(oldAccountId, userId);

      // Reverse old effect
      if (oldType === 'income') {
        account.debit(oldAmount, oldCurrency);
      } else if (oldType === 'expense') {
        account.credit(oldAmount, oldCurrency);
      }

      // Apply new effect
      if (newType === 'income') {
        account.credit(newAmount, newCurrency);
      } else if (newType === 'expense') {
        account.debit(newAmount, newCurrency);
      }

      await this.accountRepository.save(account);
      await this.eventPublisher.publishEvents(account);
    } else {
      // Different accounts or currencies - reverse on old, apply on new
      await this.reverseNonTransfer(
        userId,
        oldAccountId,
        oldAmount,
        oldCurrency,
        oldType,
      );
      await this.applyNonTransfer(
        userId,
        newAccountId,
        newAmount,
        newCurrency,
        newType,
      );
    }
  }

  private async handleTransferBalanceUpdate(
    userId: string,
    oldFromAccountId: string,
    newFromAccountId: string,
    oldFromAmount: number,
    newFromAmount: number,
    oldFromCurrency: string,
    newFromCurrency: string,
    oldToAccountId: string | null,
    newToAccountId: string | null,
    oldToAmount: number | null,
    newToAmount: number | null,
    oldToCurrency: string | null,
    newToCurrency: string | null,
  ): Promise<void> {
    // Reverse old transfer
    if (oldToAccountId && oldToAmount !== null && oldToCurrency) {
      await this.reverseTransfer(
        userId,
        oldFromAccountId,
        oldFromAmount,
        oldFromCurrency,
        oldToAccountId,
        oldToAmount,
        oldToCurrency,
      );
    }

    // Apply new transfer
    if (newToAccountId && newToAmount !== null && newToCurrency) {
      await this.applyTransfer(
        userId,
        newFromAccountId,
        newFromAmount,
        newFromCurrency,
        newToAccountId,
        newToAmount,
        newToCurrency,
      );
    }
  }

  private async reverseNonTransfer(
    userId: string,
    accountId: string,
    amount: number,
    currency: string,
    type: string,
  ): Promise<void> {
    const account = await this.validateAccountOwnership(accountId, userId);

    if (type === 'income') {
      account.debit(amount, currency);
    } else if (type === 'expense') {
      account.credit(amount, currency);
    }

    await this.accountRepository.save(account);
    await this.eventPublisher.publishEvents(account);
  }

  private async applyNonTransfer(
    userId: string,
    accountId: string,
    amount: number,
    currency: string,
    type: string,
  ): Promise<void> {
    const account = await this.validateAccountOwnership(accountId, userId);

    if (type === 'income') {
      account.credit(amount, currency);
    } else if (type === 'expense') {
      account.debit(amount, currency);
    }

    await this.accountRepository.save(account);
    await this.eventPublisher.publishEvents(account);
  }

  private async reverseTransfer(
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    const fromAccount = await this.validateAccountOwnership(fromAccountId, userId);
    const toAccount = await this.validateAccountOwnership(toAccountId, userId);

    // Reverse debit from source (credit it back)
    fromAccount.credit(fromAmount, fromCurrency);
    await this.accountRepository.save(fromAccount);
    await this.eventPublisher.publishEvents(fromAccount);

    // Reverse credit to destination (debit it back)
    toAccount.debit(toAmount, toCurrency);
    await this.accountRepository.save(toAccount);
    await this.eventPublisher.publishEvents(toAccount);
  }

  private async applyTransfer(
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    const fromAccount = await this.validateAccountOwnership(fromAccountId, userId);
    const toAccount = await this.validateAccountOwnership(toAccountId, userId);

    // Debit source account
    fromAccount.debit(fromAmount, fromCurrency);
    await this.accountRepository.save(fromAccount);
    await this.eventPublisher.publishEvents(fromAccount);

    // Credit destination account
    toAccount.credit(toAmount, toCurrency);
    await this.accountRepository.save(toAccount);
    await this.eventPublisher.publishEvents(toAccount);
  }
}
