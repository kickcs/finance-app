import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BulkImportCommand } from './bulk-import.command';
import { Transaction } from '../../../domain/aggregates/transaction';
import { Category } from '../../../domain/aggregates/category';
import { Account } from '../../../domain/aggregates/account';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../domain/repositories/account.repository.interface';
import {
  ICategoryRepository,
  CATEGORY_REPOSITORY,
} from '../../../domain/repositories/category.repository.interface';
import { DomainEventPublisher } from '../../../../../shared';

@CommandHandler(BulkImportCommand)
export class BulkImportHandler implements ICommandHandler<BulkImportCommand> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: ICategoryRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: BulkImportCommand) {
    const { userId, transactions: rows } = command;

    // Fetch existing categories and accounts
    const existingCategories = await this.categoryRepository.findByUserId(userId);
    const existingAccounts = await this.accountRepository.findAllWithBalances(userId);

    // Build name→entity maps (case-insensitive, trimmed)
    const categoryMap = new Map<string, Category>();
    for (const cat of existingCategories) {
      categoryMap.set(cat.name.trim().toLowerCase(), cat);
    }

    const accountMap = new Map<string, Account>();
    for (const acc of existingAccounts) {
      accountMap.set(acc.name.trim().toLowerCase(), acc);
    }

    const createdCategories: string[] = [];
    const createdAccounts: string[] = [];

    const transactionsToSave: Transaction[] = [];
    const accountsToSave = new Map<string, Account>();

    for (const row of rows) {
      const categoryKey = row.categoryName.trim().toLowerCase();
      const accountKey = row.accountName.trim().toLowerCase();

      // Find or create category
      let category = categoryMap.get(categoryKey);
      if (!category) {
        const isExpense = row.amount < 0;
        category = Category.create(
          crypto.randomUUID(),
          userId,
          row.categoryName.trim(),
          'help_outline',
          '#94A3B8',
          isExpense ? 'expense' : 'income',
          999,
        );
        categoryMap.set(categoryKey, category);
        createdCategories.push(row.categoryName.trim());
      }

      // Find or create account
      let account = accountMap.get(accountKey);
      if (!account) {
        account = Account.create(
          crypto.randomUUID(),
          userId,
          row.accountName.trim(),
          'wallet',
          '#3B82F6',
          'cash',
          999,
          [{ currency: row.currency, balance: 0 }],
        );
        accountMap.set(accountKey, account);
        createdAccounts.push(row.accountName.trim());
      }

      // Create transaction
      const absAmount = Math.abs(row.amount);
      const date = new Date(row.date);
      const transactionId = crypto.randomUUID();

      let transaction: Transaction;
      if (row.amount >= 0) {
        transaction = Transaction.createIncome(
          transactionId,
          userId,
          account.id,
          category.id,
          absAmount,
          row.currency,
          date,
          row.note ?? undefined,
        );
        account.credit(absAmount, row.currency);
      } else {
        transaction = Transaction.createExpense(
          transactionId,
          userId,
          account.id,
          category.id,
          absAmount,
          row.currency,
          date,
          row.note ?? undefined,
        );
        account.debit(absAmount, row.currency);
      }

      transactionsToSave.push(transaction);
      accountsToSave.set(account.id, account);
    }

    // Save everything in a single DB transaction
    await this.dataSource.transaction(async (manager) => {
      // Save new categories in a single batch insert
      const newCats = [...categoryMap.values()].filter((cat) =>
        createdCategories.includes(cat.name),
      );
      if (newCats.length > 0) {
        await this.categoryRepository.saveMany(newCats, manager);
      }

      // Save all accounts sequentially: a transactional EntityManager runs on
      // a single connection, parallel queries on it are not safe.
      for (const account of accountsToSave.values()) {
        await this.accountRepository.save(account, manager);
      }

      // Batch save all transactions in a single call
      await this.transactionRepository.saveMany(transactionsToSave, manager);
    });

    // Publish domain events after commit
    for (const account of accountsToSave.values()) {
      await this.eventPublisher.publishEvents(account);
    }
    for (const transaction of transactionsToSave) {
      await this.eventPublisher.publishEvents(transaction);
    }

    return {
      importedCount: transactionsToSave.length,
      categoriesCreated: [...new Set(createdCategories)],
      accountsCreated: [...new Set(createdAccounts)],
    };
  }
}
