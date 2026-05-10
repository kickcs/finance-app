import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
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
import { AccountOrmEntity } from '../../../infrastructure/persistence/typeorm/account.orm-entity';
import { AccountBalanceOrmEntity } from '../../../infrastructure/persistence/typeorm/account-balance.orm-entity';
import { TransactionOrmEntity } from '../../../infrastructure/persistence/typeorm/transaction.orm-entity';
import { AccountMapper } from '../../../infrastructure/persistence/mappers/account.mapper';
import { TransactionMapper } from '../../../infrastructure/persistence/mappers/transaction.mapper';
import { Account } from '../../../domain/aggregates/account';

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

      // Save all within a database transaction. If an outer manager was
      // supplied we participate in that transaction via manager.getRepository.
      // Otherwise we go through the injected default-connection repositories
      // wrapped in our own transaction (existing behaviour).
      if (outerManager) {
        await this.persistAccount(outerManager, account);
        await this.persistAccount(outerManager, toAccount);
        await this.persistTransaction(outerManager, transaction);
        if (feeTransaction) {
          await this.persistTransaction(outerManager, feeTransaction);
        }
      } else {
        await this.dataSource.transaction(async () => {
          await this.accountRepository.save(account);
          await this.accountRepository.save(toAccount);
          await this.transactionRepository.save(transaction);
          if (feeTransaction) {
            await this.transactionRepository.save(feeTransaction);
          }
        });
      }

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

      // Save within a database transaction. If an outer manager was supplied,
      // run the writes through it; otherwise fall back to the injected
      // repositories inside their own transaction (existing behaviour).
      if (outerManager) {
        await this.persistAccount(outerManager, account);
        await this.persistTransaction(outerManager, transaction);
      } else {
        await this.dataSource.transaction(async () => {
          await this.accountRepository.save(account);
          await this.transactionRepository.save(transaction);
        });
      }

      // Publish events after commit
      await this.eventPublisher.publishEvents(account);
      await this.eventPublisher.publishEvents(transaction);
    }

    return toTransactionResponse(transaction);
  }

  /**
   * Persist an account aggregate via the supplied EntityManager. Mirrors the
   * behaviour of `AccountRepository.save` so the same write semantics apply
   * whether the call goes through the default-connection repository or an
   * outer-transaction manager.
   */
  private async persistAccount(manager: EntityManager, account: Account): Promise<void> {
    const accountRepo = manager.getRepository(AccountOrmEntity);
    const balanceRepo = manager.getRepository(AccountBalanceOrmEntity);
    const ormEntity = AccountMapper.toOrm(account);

    await accountRepo.save({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      balance: ormEntity.balance,
      currency: ormEntity.currency,
      icon: ormEntity.icon,
      color: ormEntity.color,
      type: ormEntity.type,
      order: ormEntity.order,
      creditLimit: ormEntity.creditLimit,
      gracePeriodDays: ormEntity.gracePeriodDays,
      billingDay: ormEntity.billingDay,
      totalAmount: ormEntity.totalAmount,
      interestRate: ormEntity.interestRate,
      monthlyPayment: ormEntity.monthlyPayment,
      startDate: ormEntity.startDate,
      endDate: ormEntity.endDate,
      maturityDate: ormEntity.maturityDate,
      isReplenishable: ormEntity.isReplenishable,
      isWithdrawable: ormEntity.isWithdrawable,
    });

    if (ormEntity.balances.length > 0) {
      const balanceRecords = ormEntity.balances.map((balance) => ({
        id: balance.id,
        accountId: ormEntity.id,
        currency: balance.currency,
        balance: balance.balance,
      }));
      await balanceRepo.upsert(balanceRecords, ['accountId', 'currency']);
    }
  }

  private async persistTransaction(
    manager: EntityManager,
    transaction: Transaction,
  ): Promise<void> {
    const repo = manager.getRepository(TransactionOrmEntity);
    const ormEntity = TransactionMapper.toOrm(transaction);
    await repo.save(ormEntity);
  }
}
