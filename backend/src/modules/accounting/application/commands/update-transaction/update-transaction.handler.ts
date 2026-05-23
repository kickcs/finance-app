import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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
import { toTransactionResponse } from '../../helpers/to-transaction-response';
import { Account } from '../../../domain/aggregates/account';

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

    // Informational transactions (e.g. debt forgiveness records) never touched account
    // balances on creation, so any balance-affecting edit here would push the account
    // by a phantom delta. Lock them to immutable.
    if (transaction.isInformational) {
      throw new BadRequestException('Informational transactions cannot be edited');
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
      command.data.toAccountId !== undefined ? command.data.toAccountId : oldToAccountId;
    const newToAmount = command.data.toAmount !== undefined ? command.data.toAmount : oldToAmount;
    const newToCurrency =
      command.data.toCurrency !== undefined ? command.data.toCurrency : oldToCurrency;

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

    // Local array to collect accounts whose events should be published after commit.
    // Must NOT be a class field — this handler is a singleton shared across requests.
    const pendingAccounts: Account[] = [];

    // Wrap all balance + transaction updates in a DB transaction
    await this.dataSource.transaction(async () => {
      if (balanceChanged) {
        if (oldType !== 'transfer' && newType !== 'transfer') {
          await this.handleNonTransferBalanceUpdate(
            pendingAccounts,
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
            pendingAccounts,
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
            pendingAccounts,
            command.userId,
            oldAccountId,
            oldAmount,
            oldCurrency,
            oldToAccountId!,
            oldToAmount!,
            oldToCurrency!,
          );
          await this.applyNonTransfer(
            pendingAccounts,
            command.userId,
            newAccountId,
            newAmount,
            newCurrency,
            newType,
          );
        } else {
          await this.reverseNonTransfer(
            pendingAccounts,
            command.userId,
            oldAccountId,
            oldAmount,
            oldCurrency,
            oldType,
          );
          await this.applyTransfer(
            pendingAccounts,
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

    // Publish events AFTER the DB transaction commits
    for (const account of pendingAccounts) {
      await this.eventPublisher.publishEvents(account);
    }
    await this.eventPublisher.publishEvents(transaction);

    return toTransactionResponse(transaction);
  }

  private async validateAccountOwnership(accountId: string, userId: string) {
    const account = await this.accountRepository.findByIdWithBalances(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException('Account does not belong to user');
    }
    return account;
  }

  private async handleNonTransferBalanceUpdate(
    pendingAccounts: Account[],
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
      pendingAccounts.push(account);
    } else {
      // Different accounts or currencies - reverse on old, apply on new
      await this.reverseNonTransfer(
        pendingAccounts,
        userId,
        oldAccountId,
        oldAmount,
        oldCurrency,
        oldType,
      );
      await this.applyNonTransfer(
        pendingAccounts,
        userId,
        newAccountId,
        newAmount,
        newCurrency,
        newType,
      );
    }
  }

  private async handleTransferBalanceUpdate(
    pendingAccounts: Account[],
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
        pendingAccounts,
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
        pendingAccounts,
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
    pendingAccounts: Account[],
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
    pendingAccounts.push(account);
  }

  private async applyNonTransfer(
    pendingAccounts: Account[],
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
    pendingAccounts.push(account);
  }

  private async reverseTransfer(
    pendingAccounts: Account[],
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    // Load both accounts in parallel since they are independent
    const [fromAccount, toAccount] = await Promise.all([
      this.validateAccountOwnership(fromAccountId, userId),
      this.validateAccountOwnership(toAccountId, userId),
    ]);

    // Reverse debit from source (credit it back)
    fromAccount.credit(fromAmount, fromCurrency);

    // Reverse credit to destination (debit it back)
    toAccount.debit(toAmount, toCurrency);

    // Save both accounts in parallel
    await Promise.all([
      this.accountRepository.save(fromAccount),
      this.accountRepository.save(toAccount),
    ]);

    pendingAccounts.push(fromAccount, toAccount);
  }

  private async applyTransfer(
    pendingAccounts: Account[],
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    // Load both accounts in parallel since they are independent
    const [fromAccount, toAccount] = await Promise.all([
      this.validateAccountOwnership(fromAccountId, userId),
      this.validateAccountOwnership(toAccountId, userId),
    ]);

    // Debit source account
    fromAccount.debit(fromAmount, fromCurrency);

    // Credit destination account
    toAccount.credit(toAmount, toCurrency);

    // Save both accounts in parallel
    await Promise.all([
      this.accountRepository.save(fromAccount),
      this.accountRepository.save(toAccount),
    ]);

    pendingAccounts.push(fromAccount, toAccount);
  }
}
