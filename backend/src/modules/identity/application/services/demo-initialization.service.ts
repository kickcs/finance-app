/**
 * DEMO DATA CONFIGURATION
 * ⚠️ Keep in sync with: frontend/src/features/demo-mode/model/demoDataGenerator.ts
 * Both files use identical constants for demo data generation.
 * If you change amounts, descriptions, or weights here, update the frontend counterpart too.
 *
 * Note: EXPENSE_CATEGORIES and INCOME_CATEGORIES here use plain string literals
 * ('gifts', 'gifts_income'). The frontend uses CATEGORY_IDS constants that resolve
 * to the same values. This is intentional — the backend has no need for that import.
 *
 * Note: Russian description strings have been moved to src/i18n/ru/demo.json.
 * The frontend demoDataGenerator.ts still uses hardcoded Russian strings and now
 * diverges from this backend implementation.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import {
  IAccountRepository,
  ACCOUNT_REPOSITORY,
} from '../../../accounting/domain/repositories/account.repository.interface';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../accounting/domain/repositories/transaction.repository.interface';
import {
  IDebtRepository,
  DEBT_REPOSITORY,
} from '../../../debt/domain/repositories/debt.repository.interface';
import {
  IPersonRepository,
  PERSON_REPOSITORY,
} from '../../../person/domain/repositories/person.repository.interface';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../domain/repositories/profile.repository.interface';
import { Account, AccountTypeFields } from '../../../accounting/domain/aggregates/account';
import { Transaction } from '../../../accounting/domain/aggregates/transaction';
import { Debt } from '../../../debt/domain/aggregates/debt';
import { Person } from '../../../person/domain/aggregates/person';
import { Profile } from '../../domain';
import { DomainEventPublisher } from '../../../../shared';

// Category amounts in UZS (realistic ranges)
const CATEGORY_AMOUNTS: Record<string, { min: number; max: number }> = {
  // Expenses
  groceries: { min: 50000, max: 300000 },
  transport: { min: 10000, max: 100000 },
  health: { min: 30000, max: 500000 },
  housing: { min: 100000, max: 500000 },
  cafe: { min: 30000, max: 150000 },
  entertainment: { min: 20000, max: 200000 },
  gifts: { min: 50000, max: 300000 },
  education: { min: 100000, max: 500000 },
  family: { min: 50000, max: 300000 },
  sport: { min: 30000, max: 150000 },
  travel: { min: 200000, max: 1000000 },
  other_expense: { min: 20000, max: 200000 },
  // Income
  salary: { min: 8000000, max: 15000000 },
  freelance: { min: 500000, max: 3000000 },
  investments: { min: 100000, max: 1000000 },
  gifts_income: { min: 100000, max: 500000 },
  cashback: { min: 10000, max: 100000 },
  other_income: { min: 50000, max: 500000 },
};

// Expense categories with weights (probability)
const EXPENSE_CATEGORIES: Array<{ id: string; weight: number }> = [
  { id: 'groceries', weight: 25 },
  { id: 'transport', weight: 15 },
  { id: 'cafe', weight: 15 },
  { id: 'entertainment', weight: 10 },
  { id: 'health', weight: 5 },
  { id: 'housing', weight: 8 },
  { id: 'gifts', weight: 3 },
  { id: 'education', weight: 5 },
  { id: 'family', weight: 5 },
  { id: 'sport', weight: 5 },
  { id: 'travel', weight: 2 },
  { id: 'other_expense', weight: 2 },
];

// Income categories with weights
const INCOME_CATEGORIES: Array<{ id: string; weight: number }> = [
  { id: 'freelance', weight: 40 },
  { id: 'cashback', weight: 30 },
  { id: 'gifts_income', weight: 15 },
  { id: 'investments', weight: 10 },
  { id: 'other_income', weight: 5 },
];

interface DemoTransactionData {
  accountIndex: number;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  description: string;
  date: Date;
}

type ContactKey = 'ahmed' | 'anna' | 'kolya' | 'dima';

interface DebtSeed {
  key: string;
  amount: number;
  currency: string;
  type: 'given' | 'taken';
  personKey: ContactKey;
}

const PEOPLE_DATA: Array<{ key: ContactKey; color: string }> = [
  { key: 'ahmed', color: '#3b82f6' },
  { key: 'anna', color: '#f43f5e' },
  { key: 'kolya', color: '#10b981' },
  { key: 'dima', color: '#f59e0b' },
];

const DEBTS_SEED: DebtSeed[] = [
  { key: 'repair', amount: 500000, currency: 'UZS', type: 'given', personKey: 'ahmed' },
  { key: 'trip', amount: 200, currency: 'USD', type: 'given', personKey: 'ahmed' },
  { key: 'wedding', amount: 1500000, currency: 'UZS', type: 'given', personKey: 'anna' },
  { key: 'tillPayday', amount: 300000, currency: 'UZS', type: 'given', personKey: 'kolya' },
  { key: 'furniture', amount: 2000000, currency: 'UZS', type: 'taken', personKey: 'anna' },
  { key: 'laptop', amount: 100, currency: 'USD', type: 'taken', personKey: 'dima' },
];

@Injectable()
export class DemoInitializationService {
  private readonly logger = new Logger(DemoInitializationService.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepository: IProfileRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Initialize demo account with sample data
   */
  async initializeDemoData(profile: Profile): Promise<string> {
    const userId = profile.id;
    // Defensive default: the column is NOT NULL DEFAULT 'ru', but guard against
    // legacy rows / ORM edge cases returning a nullish language.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const lang = profile.language ?? 'ru';

    try {
      // 1. Create accounts
      const accounts = await this.createAccounts(userId, lang);
      const mainId = accounts[0].id;
      const savingsId = accounts[1].id;

      // 2. Update profile with default account and onboarding flags
      profile.updateProfile({
        currency: 'UZS',
        hasCompletedOnboarding: true,
        defaultAccountId: mainId,
      });
      await this.profileRepository.save(profile);

      // 3. Create transactions
      await this.createTransactions(userId, [mainId, savingsId], lang);

      // 4. Create debts
      await this.createDebts(userId, mainId, lang);

      // 5. Create people (contacts)
      await this.createPeople(userId, lang);

      this.logger.log(`Demo data initialized for user ${userId}`);
      return mainId;
    } catch (error) {
      this.logger.error(`Failed to initialize demo data for user ${userId}`, error);
      throw error;
    }
  }

  // nestjs-i18n's translate<> generic resolves to a wrapped IfAnyOrNever type
  // that does not narrow to a plain string/string[] for dynamic (string) keys,
  // so we assert the known demo.json value shapes here.
  private t(key: string, lang: string): string {
    return this.i18n.translate(key, { lang });
  }

  private tArr(key: string, lang: string): string[] {
    const value = this.i18n.translate(key, { lang });
    if (!Array.isArray(value)) {
      this.logger.warn(`Demo i18n key "${key}" is not an array (got ${typeof value})`);
      return [String(value)];
    }
    return value as string[];
  }

  private async createAccounts(userId: string, lang: string): Promise<Account[]> {
    const mainBalance = this.roundToThousand(this.randomBetween(3000000, 8000000));
    const savingsBalance = this.roundToThousand(this.randomBetween(8000000, 15000000));

    const accountsData: Array<{
      name: string;
      icon: string;
      color: string;
      type: string;
      balances: Array<{ currency: string; balance: number }>;
      typeFields?: AccountTypeFields;
    }> = [
      {
        name: this.t('demo.accounts.main', lang),
        icon: 'credit_card',
        color: '#3b82f6',
        type: 'basic',
        balances: [{ currency: 'UZS', balance: mainBalance }],
      },
      {
        name: this.t('demo.accounts.savings', lang),
        icon: 'savings',
        color: '#a855f7',
        type: 'savings',
        balances: [{ currency: 'UZS', balance: savingsBalance }],
      },
    ];

    const savedAccounts: Account[] = [];
    for (let i = 0; i < accountsData.length; i++) {
      const data = accountsData[i];
      const account = Account.create(
        crypto.randomUUID(),
        userId,
        data.name,
        data.icon,
        data.color,
        data.type,
        i,
        data.balances,
        data.typeFields,
      );
      const savedAccount = await this.accountRepository.save(account);
      await this.eventPublisher.publishEvents(account);
      savedAccounts.push(savedAccount);
    }

    return savedAccounts;
  }

  private async createTransactions(
    userId: string,
    accountIds: string[],
    lang: string,
  ): Promise<void> {
    const transactionsData = this.generateTransactionsData(lang);
    const [mainId, savingsId] = accountIds;

    const transactions: Transaction[] = transactionsData.map((txData) => {
      const accountId = txData.accountIndex === 0 ? mainId : savingsId;

      if (txData.type === 'income') {
        return Transaction.createIncome(
          crypto.randomUUID(),
          userId,
          accountId,
          txData.categoryId,
          txData.amount,
          txData.currency,
          txData.date,
          txData.description,
        );
      } else {
        return Transaction.createExpense(
          crypto.randomUUID(),
          userId,
          accountId,
          txData.categoryId,
          txData.amount,
          txData.currency,
          txData.date,
          txData.description,
        );
      }
    });

    // Batch insert all transactions in a single call
    await this.transactionRepository.saveMany(transactions);
    // Skip event publishing for bulk transactions to improve performance
  }

  private async createDebts(userId: string, accountId: string, lang: string): Promise<void> {
    const debts = DEBTS_SEED.map((seed) =>
      Debt.create({
        id: crypto.randomUUID(),
        userId,
        name: this.t(`demo.debts.${seed.key}`, lang),
        totalAmount: seed.amount,
        currency: seed.currency,
        debtType: seed.type,
        personName: this.t(`demo.contacts.${seed.personKey}`, lang),
        accountId,
      }),
    );

    await Promise.all(debts.map((debt) => this.debtRepository.save(debt)));
    await this.eventPublisher.publishEventsFromMultiple(debts);
  }

  private async createPeople(userId: string, lang: string): Promise<void> {
    const people = PEOPLE_DATA.map((data) =>
      Person.create(
        crypto.randomUUID(),
        userId,
        this.t(`demo.contacts.${data.key}`, lang),
        data.color,
      ),
    );

    await Promise.all(people.map((p) => this.personRepository.save(p)));
  }

  private generateTransactionsData(lang: string): DemoTransactionData[] {
    const transactions: DemoTransactionData[] = [];
    const now = new Date();

    // Generate transactions for the last 30 days
    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      // 2-5 transactions per day
      const txCount = this.randomBetween(2, 5);

      for (let i = 0; i < txCount; i++) {
        // 80% expenses, 20% income (excluding salary)
        const isExpense = Math.random() < 0.8;

        if (isExpense) {
          const category = this.pickWeighted(EXPENSE_CATEGORIES);
          const amounts = CATEGORY_AMOUNTS[category.id];
          const amount = this.roundToThousand(this.randomBetween(amounts.min, amounts.max));
          const descriptions = this.tArr(`demo.descriptions.${category.id}`, lang);

          transactions.push({
            accountIndex: 0, // All expenses from main account
            categoryId: category.id,
            amount,
            currency: 'UZS',
            type: 'expense',
            description: this.pickRandom(descriptions),
            date,
          });
        } else {
          const category = this.pickWeighted(INCOME_CATEGORIES);
          const amounts = CATEGORY_AMOUNTS[category.id];
          const amount = this.roundToThousand(this.randomBetween(amounts.min, amounts.max));
          const descriptions = this.tArr(`demo.descriptions.${category.id}`, lang);

          transactions.push({
            accountIndex: 0, // All income to main account
            categoryId: category.id,
            amount,
            currency: 'UZS',
            type: 'income',
            description: this.pickRandom(descriptions),
            date,
          });
        }
      }
    }

    // Add salary on 1st and 15th of current month
    const salaryAmount = this.roundToThousand(this.randomBetween(8000000, 12000000));
    const salaryDescriptions = this.tArr('demo.descriptions.salary', lang);

    // Salary on 1st
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (firstOfMonth <= now) {
      transactions.push({
        accountIndex: 0,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: salaryDescriptions[0],
        date: firstOfMonth,
      });
    }

    // Salary on 15th
    const fifteenthOfMonth = new Date(now.getFullYear(), now.getMonth(), 15);
    if (fifteenthOfMonth <= now) {
      transactions.push({
        accountIndex: 0,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: salaryDescriptions[1],
        date: fifteenthOfMonth,
      });
    }

    // Add salary from previous month if within 30 days
    const prevMonth1st = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth15th = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (prevMonth1st >= thirtyDaysAgo) {
      transactions.push({
        accountIndex: 0,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: salaryDescriptions[0],
        date: prevMonth1st,
      });
    }

    if (prevMonth15th >= thirtyDaysAgo) {
      transactions.push({
        accountIndex: 0,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: salaryDescriptions[1],
        date: prevMonth15th,
      });
    }

    return transactions;
  }

  // Utility functions
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private roundToThousand(amount: number): number {
    return Math.round(amount / 1000) * 1000;
  }

  private pickWeighted<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item;
    }

    return items[items.length - 1];
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }
}
