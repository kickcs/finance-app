import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CreateTransactionCommand } from './create-transaction.command';
import { Transaction } from '../../../domain/aggregates/transaction';
import { Account } from '../../../domain/aggregates/account';
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
import { INFORMATIONAL_ONLY_CATEGORY_IDS } from '../../../domain/constants/default-categories';

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
      feeAmount,
      manager: outerManager,
      isInformational,
    } = command;

    const transactionId = crypto.randomUUID();
    let transaction: Transaction;

    // Cross-field guard: the informational flag is reserved for marker categories
    // (прощение, взаимозачёт), and those categories must be informational.
    // Transfers can never be informational (Transaction.createTransfer hardcodes
    // false anyway, but reject early so the contract is enforced at the API
    // boundary too).
    const isMarkerCategory = INFORMATIONAL_ONLY_CATEGORY_IDS.includes(categoryId);
    if (isInformational) {
      if (type === 'transfer') {
        throw new BadRequestException('Transfers cannot be informational');
      }
      if (!isMarkerCategory) {
        throw new BadRequestException(
          `Informational transactions are only allowed for categories ${INFORMATIONAL_ONLY_CATEGORY_IDS.map((id) => `"${id}"`).join(', ')}`,
        );
      }
    } else if (isMarkerCategory) {
      throw new BadRequestException(
        `Category "${categoryId}" can only be used with isInformational=true`,
      );
    }

    // A fee only makes sense when money leaves the account: transfers and
    // expenses (e.g. the bank charge on top of money lent out). Income never
    // pays a fee here, and informational rows touch no balance at all.
    if (feeAmount && feeAmount > 0) {
      if (type === 'income') {
        throw new BadRequestException('Fee is not supported for income transactions');
      }
      if (isInformational) {
        throw new BadRequestException('Informational transactions cannot have a fee');
      }
    }

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

      const effectiveToCurrency = toCurrency ?? currency;

      // Without an explicit toAmount a cross-currency transfer would silently
      // credit the destination 1:1 (100 USD -> 100 EUR).
      if (effectiveToCurrency !== currency && (toAmount === undefined || toAmount === null)) {
        throw new BadRequestException('toAmount is required for cross-currency transfers');
      }

      // Intra-account transfer = currency conversion inside one multi-currency
      // account. Both sides MUST share one aggregate instance: loading the
      // account twice would make the second save overwrite the first one's
      // balance change.
      const isIntraAccount = toAccountId === accountId;
      if (isIntraAccount && effectiveToCurrency === currency) {
        throw new BadRequestException('Cannot transfer to the same account in the same currency');
      }

      const toAccount = isIntraAccount
        ? account
        : await this.accountRepository.findByIdWithBalances(toAccountId);
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
      const feeTransaction =
        feeAmount && feeAmount > 0
          ? this.createFeeTransaction(userId, account, feeAmount, currency, date)
          : null;

      // Save all within a database transaction. If an outer manager was
      // supplied we participate in that transaction, otherwise we open our own.
      const persistTransfer = async (manager: EntityManager) => {
        await this.accountRepository.save(account, manager);
        if (toAccount !== account) {
          await this.accountRepository.save(toAccount, manager);
        }
        await this.transactionRepository.save(transaction, manager);
        if (feeTransaction) {
          await this.transactionRepository.save(feeTransaction, manager);
        }
      };

      if (outerManager) {
        await persistTransfer(outerManager);
      } else {
        await this.dataSource.transaction(persistTransfer);
      }

      // Publish events after commit
      await this.eventPublisher.publishEvents(account);
      if (toAccount !== account) {
        await this.eventPublisher.publishEvents(toAccount);
      }
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
          isInformational,
        );
        if (!isInformational) {
          account.credit(amount, currency);
        }
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
          isInformational,
        );
        if (!isInformational) {
          account.debit(amount, currency);
        }
      }

      // Same commission rule as transfers: money paid to move money is its own
      // expense, not part of the amount the user typed in.
      const feeTransaction =
        feeAmount && feeAmount > 0
          ? this.createFeeTransaction(userId, account, feeAmount, currency, date)
          : null;

      // Save within a database transaction. If an outer manager was supplied,
      // run the writes through it; otherwise open our own transaction.
      const persist = async (manager: EntityManager) => {
        if (!isInformational) {
          await this.accountRepository.save(account, manager);
        }
        await this.transactionRepository.save(transaction, manager);
        if (feeTransaction) {
          await this.transactionRepository.save(feeTransaction, manager);
        }
      };

      if (outerManager) {
        await persist(outerManager);
      } else {
        await this.dataSource.transaction(persist);
      }

      // Publish events after commit
      if (!isInformational) {
        await this.eventPublisher.publishEvents(account);
      }
      await this.eventPublisher.publishEvents(transaction);
      if (feeTransaction) {
        await this.eventPublisher.publishEvents(feeTransaction);
      }
    }

    return toTransactionResponse(transaction);
  }

  /**
   * The fee is always a standalone `commission` expense on the same account,
   * currency and date. Deliberately not debt-related and without a debtId:
   * linked to a debt it would show up in that debt's payment timeline and
   * count as money repaid.
   */
  private createFeeTransaction(
    userId: string,
    account: Account,
    feeAmount: number,
    currency: string,
    date: Date,
  ): Transaction {
    const feeTransaction = Transaction.createExpense(
      crypto.randomUUID(),
      userId,
      account.id,
      'commission',
      feeAmount,
      currency,
      date,
      'Комиссия за перевод',
      false,
      undefined,
    );
    account.debit(feeAmount, currency);
    return feeTransaction;
  }
}
