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
import { Transaction } from '../../../domain/aggregates/transaction';

/**
 * Счета, затронутые одной правкой. Каждый читается один раз менеджером
 * транзакции и правится одним экземпляром: вторая копия того же счёта
 * затёрла бы изменения первой при сохранении.
 */
type AccountCache = Map<string, Account>;

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

    const { secondPart, ...data } = command.data;
    const date = data.date ? new Date(data.date) : undefined;

    // Store old values for balance recalculation
    const oldAccountId = transaction.accountId;
    const oldAmount = transaction.amountValue;
    const oldCurrency = transaction.currency;
    const oldType = transaction.typeValue;
    const oldToAccountId = transaction.toAccountId;
    const oldToAmount = transaction.toAmountValue;
    const oldToCurrency = transaction.toCurrency;

    // Determine new values (or keep old if not changed)
    const newAccountId = data.accountId ?? oldAccountId;
    const newAmount = data.amount ?? oldAmount;
    const newCurrency = data.currency ?? oldCurrency;
    const newType = data.type ?? oldType;
    const newToAccountId = data.toAccountId !== undefined ? data.toAccountId : oldToAccountId;
    const newToAmount = data.toAmount !== undefined ? data.toAmount : oldToAmount;
    const newToCurrency = data.toCurrency !== undefined ? data.toCurrency : oldToCurrency;

    // Check if any balance-affecting field changed
    const balanceChanged =
      oldAccountId !== newAccountId ||
      oldAmount !== newAmount ||
      oldCurrency !== newCurrency ||
      oldType !== newType ||
      oldToAccountId !== newToAccountId ||
      oldToAmount !== newToAmount ||
      oldToCurrency !== newToCurrency;

    const sibling = transaction.paymentGroupId
      ? ((await this.transactionRepository.findPaymentSiblings([transaction])).get(
          transaction.id,
        ) ?? null)
      : null;
    // Вторая часть оплаты есть после правки: её задали или не тронули существующую.
    const keepsSecondPart = secondPart !== null && (secondPart !== undefined || sibling !== null);

    if (keepsSecondPart) {
      if (newType !== 'income' && newType !== 'expense') {
        throw new BadRequestException(
          'A transaction paid from two accounts must stay income or expense',
        );
      }
      const newIsDebtRelated = data.isDebtRelated ?? transaction.isDebtRelated;
      const newDebtId = data.debtId !== undefined ? data.debtId : transaction.debtId;
      if (newIsDebtRelated || newDebtId) {
        throw new BadRequestException('Debt-related transactions cannot be paid from two accounts');
      }
      if ((secondPart?.accountId ?? sibling?.accountId) === newAccountId) {
        throw new BadRequestException('Both parts of a payment must use different accounts');
      }
    } else {
      // Пару убирают, либо она уже пропала вместе со своим счётом.
      transaction.leavePaymentGroup();
    }

    // Update the transaction data
    transaction.update({ ...data, date });

    const removedSibling = keepsSecondPart ? null : sibling;
    removedSibling?.markDeleted();

    let keptSibling: Transaction | null = null;
    let siblingOldEffect: NonTransferEffect | null = null;
    if (keepsSecondPart && sibling) {
      siblingOldEffect = toEffect(sibling);
      sibling.update({
        accountId: secondPart?.accountId,
        amount: secondPart?.amount,
        currency: data.currency,
        type: data.type,
        categoryId: data.categoryId,
        description: data.description,
        date,
      });
      keptSibling = sibling;
    } else if (keepsSecondPart && secondPart) {
      keptSibling = transaction.createPaymentSibling(
        crypto.randomUUID(),
        secondPart.accountId,
        secondPart.amount,
        crypto.randomUUID(),
      );
    }

    const accounts: AccountCache = new Map();

    // Wrap all balance + transaction updates in a DB transaction
    await this.dataSource.transaction(async (manager) => {
      if (balanceChanged) {
        if (oldType !== 'transfer' && newType !== 'transfer') {
          await this.reverseNonTransfer(manager, accounts, command.userId, {
            accountId: oldAccountId,
            amount: oldAmount,
            currency: oldCurrency,
            type: oldType,
          });
          await this.applyNonTransfer(manager, accounts, command.userId, {
            accountId: newAccountId,
            amount: newAmount,
            currency: newCurrency,
            type: newType,
          });
        } else if (oldType === 'transfer' && newType === 'transfer') {
          await this.handleTransferBalanceUpdate(
            manager,
            accounts,
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
            accounts,
            command.userId,
            oldAccountId,
            oldAmount,
            oldCurrency,
            oldToAccountId!,
            oldToAmount!,
            oldToCurrency!,
          );
          await this.applyNonTransfer(manager, accounts, command.userId, {
            accountId: newAccountId,
            amount: newAmount,
            currency: newCurrency,
            type: newType,
          });
        } else {
          await this.reverseNonTransfer(manager, accounts, command.userId, {
            accountId: oldAccountId,
            amount: oldAmount,
            currency: oldCurrency,
            type: oldType,
          });
          await this.applyTransfer(
            manager,
            accounts,
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

      if (removedSibling) {
        await this.reverseNonTransfer(manager, accounts, command.userId, toEffect(removedSibling));
      }
      if (keptSibling) {
        const newEffect = toEffect(keptSibling);
        if (!siblingOldEffect || !isSameEffect(siblingOldEffect, newEffect)) {
          if (siblingOldEffect) {
            await this.reverseNonTransfer(manager, accounts, command.userId, siblingOldEffect);
          }
          await this.applyNonTransfer(manager, accounts, command.userId, newEffect);
        }
      }

      // Sequential writes: a transactional EntityManager runs on a single
      // connection, parallel queries on it are not safe.
      for (const account of accounts.values()) {
        await this.accountRepository.save(account, manager);
      }
      await this.transactionRepository.save(transaction, manager);
      if (keptSibling) {
        await this.transactionRepository.save(keptSibling, manager);
      }
      if (removedSibling) {
        await this.transactionRepository.delete(removedSibling.id, manager);
      }
    });

    // Publish events AFTER the DB transaction commits
    for (const account of accounts.values()) {
      await this.eventPublisher.publishEvents(account);
    }
    await this.eventPublisher.publishEvents(transaction);
    for (const part of [keptSibling, removedSibling]) {
      if (part) {
        await this.eventPublisher.publishEvents(part);
      }
    }

    return toTransactionResponse(transaction, keptSibling);
  }

  private async loadAccount(
    manager: EntityManager,
    accounts: AccountCache,
    accountId: string,
    userId: string,
  ): Promise<Account> {
    const cached = accounts.get(accountId);
    if (cached) {
      return cached;
    }
    const account = await this.accountRepository.findByIdWithBalances(accountId, manager);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException('Account does not belong to user');
    }
    accounts.set(accountId, account);
    return account;
  }

  private async handleTransferBalanceUpdate(
    manager: EntityManager,
    accounts: AccountCache,
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
        accounts,
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
        accounts,
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
    accounts: AccountCache,
    userId: string,
    effect: NonTransferEffect,
  ): Promise<void> {
    const account = await this.loadAccount(manager, accounts, effect.accountId, userId);

    if (effect.type === 'income') {
      account.debit(effect.amount, effect.currency);
    } else if (effect.type === 'expense') {
      account.credit(effect.amount, effect.currency);
    }
  }

  private async applyNonTransfer(
    manager: EntityManager,
    accounts: AccountCache,
    userId: string,
    effect: NonTransferEffect,
  ): Promise<void> {
    const account = await this.loadAccount(manager, accounts, effect.accountId, userId);

    if (effect.type === 'income') {
      account.credit(effect.amount, effect.currency);
    } else if (effect.type === 'expense') {
      account.debit(effect.amount, effect.currency);
    }
  }

  private async reverseTransfer(
    manager: EntityManager,
    accounts: AccountCache,
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    const fromAccount = await this.loadAccount(manager, accounts, fromAccountId, userId);
    const toAccount = await this.loadAccount(manager, accounts, toAccountId, userId);

    // Reverse debit from source (credit it back)
    fromAccount.credit(fromAmount, fromCurrency);

    // Reverse credit to destination (debit it back)
    toAccount.debit(toAmount, toCurrency);
  }

  private async applyTransfer(
    manager: EntityManager,
    accounts: AccountCache,
    userId: string,
    fromAccountId: string,
    fromAmount: number,
    fromCurrency: string,
    toAccountId: string,
    toAmount: number,
    toCurrency: string,
  ): Promise<void> {
    const fromAccount = await this.loadAccount(manager, accounts, fromAccountId, userId);
    const toAccount = await this.loadAccount(manager, accounts, toAccountId, userId);

    // Debit source account
    fromAccount.debit(fromAmount, fromCurrency);

    // Credit destination account
    toAccount.credit(toAmount, toCurrency);
  }
}

interface NonTransferEffect {
  accountId: string;
  amount: number;
  currency: string;
  type: string;
}

function toEffect(transaction: Transaction): NonTransferEffect {
  return {
    accountId: transaction.accountId,
    amount: transaction.amountValue,
    currency: transaction.currency,
    type: transaction.typeValue,
  };
}

function isSameEffect(a: NonTransferEffect, b: NonTransferEffect): boolean {
  return (
    a.accountId === b.accountId &&
    a.amount === b.amount &&
    a.currency === b.currency &&
    a.type === b.type
  );
}
