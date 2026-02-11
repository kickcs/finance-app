import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    const newToAccountId = command.data.toAccountId !== undefined ? command.data.toAccountId : oldToAccountId;
    const newToAmount = command.data.toAmount !== undefined ? command.data.toAmount : oldToAmount;
    const newToCurrency = command.data.toCurrency !== undefined ? command.data.toCurrency : oldToCurrency;

    // Check if any balance-affecting field changed
    const balanceChanged =
      oldAccountId !== newAccountId ||
      oldAmount !== newAmount ||
      oldCurrency !== newCurrency ||
      oldType !== newType ||
      oldToAccountId !== newToAccountId ||
      oldToAmount !== newToAmount ||
      oldToCurrency !== newToCurrency;

    if (balanceChanged) {
      // Handle non-transfer transactions (income/expense)
      if (oldType !== 'transfer' && newType !== 'transfer') {
        await this.handleNonTransferBalanceUpdate(
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
        // Both old and new are transfers
        await this.handleTransferBalanceUpdate(
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
        // Converting from transfer to income/expense
        await this.reverseTransfer(oldAccountId, oldAmount, oldCurrency, oldToAccountId!, oldToAmount!, oldToCurrency!);
        await this.applyNonTransfer(newAccountId, newAmount, newCurrency, newType);
      } else {
        // Converting from income/expense to transfer
        await this.reverseNonTransfer(oldAccountId, oldAmount, oldCurrency, oldType);
        await this.applyTransfer(newAccountId, newAmount, newCurrency, newToAccountId!, newToAmount!, newToCurrency!);
      }
    }

    // Update the transaction data
    transaction.update({
      ...command.data,
      date: command.data.date ? new Date(command.data.date) : undefined,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);
    await this.eventPublisher.publishEvents(transaction);

    return {
      id: savedTransaction.id,
      userId: savedTransaction.userId,
      accountId: savedTransaction.accountId,
      categoryId: savedTransaction.categoryId,
      amount: savedTransaction.amountValue,
      currency: savedTransaction.currency,
      type: savedTransaction.typeValue,
      description: savedTransaction.description,
      date: savedTransaction.date,
      isDebtRelated: savedTransaction.isDebtRelated,
      toAccountId: savedTransaction.toAccountId,
      toAmount: savedTransaction.toAmountValue,
      toCurrency: savedTransaction.toCurrency,
      createdAt: savedTransaction.createdAt,
    };
  }

  private async handleNonTransferBalanceUpdate(
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
      const account = await this.accountRepository.findByIdWithBalances(oldAccountId);
      if (!account) return;

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
      await this.reverseNonTransfer(oldAccountId, oldAmount, oldCurrency, oldType);
      await this.applyNonTransfer(newAccountId, newAmount, newCurrency, newType);
    }
  }

  private async handleTransferBalanceUpdate(
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
    accountId: string,
    amount: number,
    currency: string,
    type: string,
  ): Promise<void> {
    const account = await this.accountRepository.findByIdWithBalances(accountId);
    if (!account) return;

    if (type === 'income') {
      account.debit(amount, currency);
    } else if (type === 'expense') {
      account.credit(amount, currency);
    }

    await this.accountRepository.save(account);
    await this.eventPublisher.publishEvents(account);
  }

  private async applyNonTransfer(
    accountId: string,
    amount: number,
    currency: string,
    type: string,
  ): Promise<void> {
    const account = await this.accountRepository.findByIdWithBalances(accountId);
    if (!account) return;

    if (type === 'income') {
      account.credit(amount, currency);
    } else if (type === 'expense') {
      account.debit(amount, currency);
    }

    await this.accountRepository.save(account);
    await this.eventPublisher.publishEvents(account);
  }

  private async reverseTransfer(
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    const fromAccount = await this.accountRepository.findByIdWithBalances(fromAccountId);
    const toAccount = await this.accountRepository.findByIdWithBalances(toAccountId);

    if (fromAccount) {
      // Reverse debit from source (credit it back)
      fromAccount.credit(fromAmount, fromCurrency);
      await this.accountRepository.save(fromAccount);
      await this.eventPublisher.publishEvents(fromAccount);
    }

    if (toAccount) {
      // Reverse credit to destination (debit it back)
      toAccount.debit(toAmount, toCurrency);
      await this.accountRepository.save(toAccount);
      await this.eventPublisher.publishEvents(toAccount);
    }
  }

  private async applyTransfer(
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    const fromAccount = await this.accountRepository.findByIdWithBalances(fromAccountId);
    const toAccount = await this.accountRepository.findByIdWithBalances(toAccountId);

    if (fromAccount) {
      // Debit source account
      fromAccount.debit(fromAmount, fromCurrency);
      await this.accountRepository.save(fromAccount);
      await this.eventPublisher.publishEvents(fromAccount);
    }

    if (toAccount) {
      // Credit destination account
      toAccount.credit(toAmount, toCurrency);
      await this.accountRepository.save(toAccount);
      await this.eventPublisher.publishEvents(toAccount);
    }
  }
}
