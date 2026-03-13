/**
 * DEMO DATA CONFIGURATION
 * ⚠️ Keep in sync with: backend/src/modules/identity/application/services/demo-initialization.service.ts
 * Both files use identical constants for demo data generation.
 * If you change amounts, descriptions, or weights here, update the backend counterpart too.
 *
 * Note: EXPENSE_CATEGORIES and INCOME_CATEGORIES here use CATEGORY_IDS constants
 * (e.g. CATEGORY_IDS.GIFTS, CATEGORY_IDS.GIFTS_INCOME) instead of raw string literals.
 * The backend uses plain strings ('gifts', 'gifts_income'). Both resolve to the same values.
 */
import { CATEGORY_IDS } from '@/entities/category';
import { toLocalISODate } from '@/shared/lib/date';

export interface DemoAccountData {
  name: string;
  icon: string;
  color: string;
  type: 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit';
  balances: Array<{ currency: string; balance: number }>;
  creditLimit?: number;
  gracePeriodDays?: number;
  billingDay?: number;
  totalAmount?: number;
  interestRate?: number;
  monthlyPayment?: number;
  startDate?: string;
  endDate?: string;
  maturityDate?: string;
  isReplenishable?: boolean;
  isWithdrawable?: boolean;
}

export interface DemoTransactionData {
  accountIndex: number;
  category_id: string;
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  description: string;
  date: string;
}

export interface DemoDebtData {
  name: string;
  total_amount: number;
  remaining_amount: number;
  currency: string;
  debt_type: 'given' | 'taken';
  person_name: string;
}

export interface DemoPersonData {
  name: string;
  color: string;
}

export interface DemoReminderData {
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once';
  next_date: string;
  icon: string;
  color: string;
}

export interface GeneratedDemoData {
  accounts: DemoAccountData[];
  transactions: DemoTransactionData[];
  debts: DemoDebtData[];
  people: DemoPersonData[];
  reminders: DemoReminderData[];
}

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
  groceries: ['Makro', 'Korzinka', 'Havas', 'Овощи на базаре', 'Продукты на неделю'],
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
  { id: CATEGORY_IDS.GIFTS, weight: 3 },
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
  { id: CATEGORY_IDS.GIFTS_INCOME, weight: 15 },
  { id: 'investments', weight: 10 },
  { id: 'other_income', weight: 5 },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundToThousand(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[items.length - 1];
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const formatDate = toLocalISODate;

function getNextMonthDate(dayOfMonth: number): string {
  const now = new Date();
  const nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);

  // If the day has passed this month, move to next month
  if (nextDate <= now) {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return formatDate(nextDate);
}

function generateTransactions(): DemoTransactionData[] {
  const transactions: DemoTransactionData[] = [];
  const now = new Date();

  // Generate transactions for the last 30 days
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = formatDate(date);

    // 2-5 transactions per day
    const txCount = randomBetween(2, 5);

    for (let i = 0; i < txCount; i++) {
      // 80% expenses, 20% income (excluding salary)
      const isExpense = Math.random() < 0.8;

      if (isExpense) {
        const category = pickWeighted(EXPENSE_CATEGORIES);
        const amounts = CATEGORY_AMOUNTS[category.id];
        const amount = roundToThousand(randomBetween(amounts.min, amounts.max));
        const descriptions = CATEGORY_DESCRIPTIONS[category.id];

        transactions.push({
          accountIndex: 0, // All expenses from main account
          category_id: category.id,
          amount,
          currency: 'UZS',
          type: 'expense',
          description: pickRandom(descriptions),
          date: dateStr,
        });
      } else {
        const category = pickWeighted(INCOME_CATEGORIES);
        const amounts = CATEGORY_AMOUNTS[category.id];
        const amount = roundToThousand(randomBetween(amounts.min, amounts.max));
        const descriptions = CATEGORY_DESCRIPTIONS[category.id];

        transactions.push({
          accountIndex: 0, // All income to main account
          category_id: category.id,
          amount,
          currency: 'UZS',
          type: 'income',
          description: pickRandom(descriptions),
          date: dateStr,
        });
      }
    }
  }

  // Add salary on 1st and 15th of current month
  const salaryAmount = roundToThousand(randomBetween(8000000, 12000000));

  // Salary on 1st
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (firstOfMonth <= now) {
    transactions.push({
      accountIndex: 0,
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Зарплата',
      date: formatDate(firstOfMonth),
    });
  }

  // Salary on 15th
  const fifteenthOfMonth = new Date(now.getFullYear(), now.getMonth(), 15);
  if (fifteenthOfMonth <= now) {
    transactions.push({
      accountIndex: 0,
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Аванс',
      date: formatDate(fifteenthOfMonth),
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
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Зарплата',
      date: formatDate(prevMonth1st),
    });
  }

  if (prevMonth15th >= thirtyDaysAgo) {
    transactions.push({
      accountIndex: 0,
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Аванс',
      date: formatDate(prevMonth15th),
    });
  }

  return transactions;
}

export function generateDemoData(): GeneratedDemoData {
  const transactions = generateTransactions();

  const mainBalance = randomBetween(3000000, 8000000);
  const savingsBalance = randomBetween(8000000, 15000000);

  return {
    accounts: [
      {
        name: 'Основной',
        icon: 'credit_card',
        color: '#3b82f6',
        type: 'basic',
        balances: [{ currency: 'UZS', balance: roundToThousand(mainBalance) }],
      },
      {
        name: 'Накопительный',
        icon: 'savings',
        color: '#a855f7',
        type: 'savings',
        balances: [{ currency: 'UZS', balance: roundToThousand(savingsBalance) }],
      },
    ],
    transactions,
    debts: [
      // Given (user lent money)
      {
        name: 'На ремонт',
        total_amount: 500000,
        remaining_amount: 500000,
        currency: 'UZS',
        debt_type: 'given',
        person_name: 'Ахмед',
      },
      {
        name: 'На поездку',
        total_amount: 200,
        remaining_amount: 200,
        currency: 'USD',
        debt_type: 'given',
        person_name: 'Ахмед',
      },
      {
        name: 'На свадьбу',
        total_amount: 1500000,
        remaining_amount: 1500000,
        currency: 'UZS',
        debt_type: 'given',
        person_name: 'Анна',
      },
      {
        name: 'До зарплаты',
        total_amount: 300000,
        remaining_amount: 300000,
        currency: 'UZS',
        debt_type: 'given',
        person_name: 'Коля',
      },
      // Taken (user borrowed money)
      {
        name: 'На мебель',
        total_amount: 2000000,
        remaining_amount: 2000000,
        currency: 'UZS',
        debt_type: 'taken',
        person_name: 'Анна',
      },
      {
        name: 'За ноутбук',
        total_amount: 100,
        remaining_amount: 100,
        currency: 'USD',
        debt_type: 'taken',
        person_name: 'Дима',
      },
    ],
    people: [
      { name: 'Ахмед', color: '#3b82f6' },
      { name: 'Анна', color: '#f43f5e' },
      { name: 'Коля', color: '#10b981' },
      { name: 'Дима', color: '#f59e0b' },
    ],
    reminders: [
      {
        name: 'Аренда квартиры',
        amount: 3000000,
        frequency: 'monthly',
        next_date: getNextMonthDate(5),
        icon: 'home',
        color: '#6366f1',
      },
      {
        name: 'Netflix',
        amount: 85000,
        frequency: 'monthly',
        next_date: getNextMonthDate(15),
        icon: 'tv',
        color: '#e50914',
      },
      {
        name: 'Spotify',
        amount: 55000,
        frequency: 'monthly',
        next_date: getNextMonthDate(20),
        icon: 'music_note',
        color: '#1db954',
      },
    ],
  };
}
