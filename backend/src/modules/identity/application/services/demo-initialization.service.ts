import { Injectable, Inject, Logger } from '@nestjs/common';
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
  IReminderRepository,
  REMINDER_REPOSITORY,
} from '../../../planning/domain/repositories/reminder.repository.interface';
import {
  IProfileRepository,
  PROFILE_REPOSITORY,
} from '../../domain/repositories/profile.repository.interface';
import {
  Account,
  AccountTypeFields,
} from '../../../accounting/domain/aggregates/account';
import { Transaction } from '../../../accounting/domain/aggregates/transaction';
import { Debt } from '../../../debt/domain/aggregates/debt';
import {
  Reminder,
  ReminderFrequency,
} from '../../../planning/domain/aggregates/reminder';
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

// Description templates for each category
const CATEGORY_DESCRIPTIONS: Record<string, string[]> = {
  groceries: [
    'Makro',
    'Korzinka',
    'Havas',
    'Овощи на базаре',
    'Продукты на неделю',
  ],
  transport: ['Yandex Go', 'Метро', 'Заправка', 'MyTaxi', 'Автобус'],
  health: ['Аптека', 'Анализы', 'Врач', 'Стоматолог', 'Витамины'],
  housing: ['Коммунальные', 'Интернет', 'Уборка', 'Ремонт', 'Мебель'],
  cafe: ['Обед', 'Кофе', 'Evos', 'Oqtepa', 'Ресторан'],
  entertainment: ['Кино', 'Netflix', 'Концерт', 'Игры', 'Подписка'],
  gifts: ['День рождения', 'Подарок другу', 'Цветы', 'Сувенир'],
  education: ['Курсы', 'Книги', 'Udemy', 'Репетитор'],
  family: ['Детский сад', 'Школа', 'Одежда детям', 'Игрушки'],
  sport: ['Тренажерка', 'Бассейн', 'Спортивная форма', 'Протеин'],
  travel: ['Билеты', 'Отель', 'Экскурсия', 'Сувениры из поездки'],
  other_expense: ['Разное', 'Мелкие расходы', 'Прочее'],
  salary: ['Зарплата', 'Аванс'],
  freelance: ['Проект', 'Заказ', 'Консультация'],
  investments: ['Дивиденды', 'Проценты по вкладу'],
  gifts_income: ['Подарок', 'От родителей'],
  cashback: ['Кэшбек Uzcard', 'Кэшбек Payme'],
  other_income: ['Возврат', 'Продажа', 'Прочее'],
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
    @Inject(REMINDER_REPOSITORY)
    private readonly reminderRepository: IReminderRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  /**
   * Initialize demo account with sample data
   */
  async initializeDemoData(profile: Profile): Promise<string> {
    const userId = profile.id;

    try {
      // 1. Create accounts
      const accounts = await this.createAccounts(userId);
      const walletId = accounts[0].id;
      const cardId = accounts[1].id;

      // 2. Update profile with default account and onboarding flags
      profile.updateProfile({
        currency: 'UZS',
        hasCompletedOnboarding: true,
        defaultAccountId: walletId,
      });
      await this.profileRepository.save(profile);

      // 3. Create transactions
      await this.createTransactions(userId, [walletId, cardId]);

      // 4. Create debt
      await this.createDebt(userId, walletId);

      // 5. Create reminders
      await this.createReminders(userId);

      this.logger.log(`Demo data initialized for user ${userId}`);
      return walletId;
    } catch (error) {
      this.logger.error(
        `Failed to initialize demo data for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  private async createAccounts(userId: string): Promise<Account[]> {
    const walletBalance = this.roundToThousand(
      this.randomBetween(800000, 2000000),
    );
    const cardBalanceUZS = this.roundToThousand(
      this.randomBetween(3000000, 8000000),
    );
    const cardBalanceUSD = this.randomBetween(100, 500);
    const savingsBalance = this.roundToThousand(
      this.randomBetween(5000000, 15000000),
    );

    const accountsData: Array<{
      name: string;
      icon: string;
      color: string;
      type: string;
      balances: Array<{ currency: string; balance: number }>;
      typeFields?: AccountTypeFields;
    }> = [
      {
        name: 'Кошелёк',
        icon: 'account_balance_wallet',
        color: '#3b82f6',
        type: 'cash',
        balances: [{ currency: 'UZS', balance: walletBalance }],
      },
      {
        name: 'Карта Visa',
        icon: 'credit_card',
        color: '#10b981',
        type: 'basic',
        balances: [
          { currency: 'UZS', balance: cardBalanceUZS },
          { currency: 'USD', balance: cardBalanceUSD },
        ],
      },
      {
        name: 'Накопления',
        icon: 'savings',
        color: '#a855f7',
        type: 'savings',
        balances: [{ currency: 'UZS', balance: savingsBalance }],
      },
      {
        name: 'Visa Gold',
        icon: 'credit_card',
        color: '#f59e0b',
        type: 'credit_card',
        balances: [
          {
            currency: 'UZS',
            balance: this.roundToThousand(this.randomBetween(-1000000, 0)),
          },
        ],
        typeFields: {
          creditLimit: 20000000,
          gracePeriodDays: 55,
          billingDay: 15,
        },
      },
      {
        name: 'Ипотека',
        icon: 'account_balance',
        color: '#ef4444',
        type: 'loan',
        balances: [
          {
            currency: 'UZS',
            balance: -this.roundToThousand(
              this.randomBetween(150000000, 250000000),
            ),
          },
        ],
        typeFields: {
          totalAmount: 300000000,
          interestRate: 22,
          monthlyPayment: 4500000,
          startDate: new Date('2024-01-15'),
          endDate: new Date('2034-01-15'),
        },
      },
      {
        name: 'Срочный вклад',
        icon: 'savings',
        color: '#6366f1',
        type: 'deposit',
        balances: [
          {
            currency: 'UZS',
            balance: this.roundToThousand(
              this.randomBetween(10000000, 30000000),
            ),
          },
        ],
        typeFields: {
          interestRate: 23,
          maturityDate: new Date('2026-06-01'),
          isReplenishable: true,
          isWithdrawable: false,
        },
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
  ): Promise<void> {
    const transactions = this.generateTransactionsData();
    const [walletId, cardId] = accountIds;

    for (const txData of transactions) {
      const accountId = txData.accountIndex === 0 ? walletId : cardId;

      let transaction: Transaction;
      if (txData.type === 'income') {
        transaction = Transaction.createIncome(
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
        transaction = Transaction.createExpense(
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

      await this.transactionRepository.save(transaction);
      // Skip event publishing for bulk transactions to improve performance
    }
  }

  private async createDebt(userId: string, accountId: string): Promise<void> {
    const debt = Debt.create(
      crypto.randomUUID(),
      userId,
      'Долг Ахмеду',
      500000,
      'UZS',
      'given',
      'Ахмед',
      accountId,
    );

    await this.debtRepository.save(debt);
    await this.eventPublisher.publishEvents(debt);
  }

  private async createReminders(userId: string): Promise<void> {
    const remindersData: Array<{
      name: string;
      amount: number;
      frequency: ReminderFrequency;
      nextDate: Date;
      icon: string;
      color: string;
    }> = [
      {
        name: 'Аренда квартиры',
        amount: 3000000,
        frequency: 'monthly',
        nextDate: this.getNextMonthDate(5),
        icon: 'home',
        color: '#6366f1',
      },
      {
        name: 'Netflix',
        amount: 85000,
        frequency: 'monthly',
        nextDate: this.getNextMonthDate(15),
        icon: 'tv',
        color: '#e50914',
      },
      {
        name: 'Spotify',
        amount: 55000,
        frequency: 'monthly',
        nextDate: this.getNextMonthDate(20),
        icon: 'music_note',
        color: '#1db954',
      },
    ];

    for (const data of remindersData) {
      const reminder = Reminder.create(
        crypto.randomUUID(),
        userId,
        data.name,
        data.amount,
        data.frequency,
        data.nextDate,
        data.icon,
        data.color,
      );
      await this.reminderRepository.save(reminder);
    }
  }

  private generateTransactionsData(): DemoTransactionData[] {
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
          const amount = this.roundToThousand(
            this.randomBetween(amounts.min, amounts.max),
          );
          const descriptions = CATEGORY_DESCRIPTIONS[category.id];

          transactions.push({
            accountIndex: Math.random() < 0.6 ? 1 : 0, // 60% card, 40% wallet
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
          const amount = this.roundToThousand(
            this.randomBetween(amounts.min, amounts.max),
          );
          const descriptions = CATEGORY_DESCRIPTIONS[category.id];

          transactions.push({
            accountIndex: Math.random() < 0.7 ? 1 : 0, // 70% to card
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
    const salaryAmount = this.roundToThousand(
      this.randomBetween(8000000, 12000000),
    );

    // Salary on 1st
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (firstOfMonth <= now) {
      transactions.push({
        accountIndex: 1,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: 'Зарплата',
        date: firstOfMonth,
      });
    }

    // Salary on 15th
    const fifteenthOfMonth = new Date(now.getFullYear(), now.getMonth(), 15);
    if (fifteenthOfMonth <= now) {
      transactions.push({
        accountIndex: 1,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: 'Аванс',
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
        accountIndex: 1,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: 'Зарплата',
        date: prevMonth1st,
      });
    }

    if (prevMonth15th >= thirtyDaysAgo) {
      transactions.push({
        accountIndex: 1,
        categoryId: 'salary',
        amount: salaryAmount,
        currency: 'UZS',
        type: 'income',
        description: 'Аванс',
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

  private getNextMonthDate(dayOfMonth: number): Date {
    const now = new Date();
    const nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

    // If the day has passed this month, move to next month
    if (nextDate <= now) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    return nextDate;
  }
}
