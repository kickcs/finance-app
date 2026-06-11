import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
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
    await this.dataSource.transaction(async (manager) => {
      if (balanceChanged) {
        if (oldType !== 'transfer' && newType !== 'transfer') {
          await this.handleNonTransferBalanceUpdate(
            manager,
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
            manager,
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
            manager,
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
            manager,
            pendingAccounts,
            command.userId,
            newAccountId,
            newAmount,
            newCurrency,
            newType,
          );
        } else {
          await this.reverseNonTransfer(
            manager,
            pendingAccounts,
            command.userId,
            oldAccountId,
            oldAmount,
            oldCurrency,
            oldType,
          );
          await this.applyTransfer(
            manager,
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

      await this.transactionRepository.save(transaction, manager);
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
    manager: EntityManager,
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

      await this.accountRepository.save(account, manager);
      pendingAccounts.push(account);
    } else {
      // Different accounts or currencies - reverse on old, apply on new
      await this.reverseNonTransfer(
        manager,
        pendingAccounts,
        userId,
        oldAccountId,
        oldAmount,
        oldCurrency,
        oldType,
      );
      await this.applyNonTransfer(
        manager,
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
    manager: EntityManager,
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
        manager,
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
        manager,
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
    manager: EntityManager,
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

    await this.accountRepository.save(account, manager);
    pendingAccounts.push(account);
  }

  private async applyNonTransfer(
    manager: EntityManager,
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

    await this.accountRepository.save(account, manager);
    pendingAccounts.push(account);
  }

  private async reverseTransfer(
    manager: EntityManager,
    pendingAccounts: Account[],
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    // Intra-account conversion: both sides must share one aggregate instance,
    // otherwise the second save overwrites the first.
    const fromAccount = await this.validateAccountOwnership(fromAccountId, userId);
    const toAccount =
      toAccountId === fromAccountId
        ? fromAccount
        : await this.validateAccountOwnership(toAccountId, userId);

    // Reverse debit from source (credit it back)
    fromAccount.credit(fromAmount, fromCurrency);

    // Reverse credit to destination (debit it back)
    toAccount.debit(toAmount, toCurrency);

    // Sequential writes: a transactional EntityManager runs on a single
    // connection, parallel queries on it are not safe.
    await this.accountRepository.save(fromAccount, manager);
    if (toAccount !== fromAccount) {
      await this.accountRepository.save(toAccount, manager);
      pendingAccounts.push(fromAccount, toAccount);
    } else {
      pendingAccounts.push(fromAccount);
    }
  }

  private async applyTransfer(
    manager: EntityManager,
    pendingAccounts: Account[],
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    // Intra-account conversion: both sides must share one aggregate instance,
    // otherwise the second save overwrites the first.
    const fromAccount = await this.validateAccountOwnership(fromAccountId, userId);
    const toAccount =
      toAccountId === fromAccountId
        ? fromAccount
        : await this.validateAccountOwnership(toAccountId, userId);

    // Debit source account
    fromAccount.debit(fromAmount, fromCurrency);

    // Credit destination account
    toAccount.credit(toAmount, toCurrency);

    // Sequential writes: a transactional EntityManager runs on a single
    // connection, parallel queries on it are not safe.
    await this.accountRepository.save(fromAccount, manager);
    if (toAccount !== fromAccount) {
      await this.accountRepository.save(toAccount, manager);
      pendingAccounts.push(fromAccount, toAccount);
    } else {
      pendingAccounts.push(fromAccount);
    }
  }
}
