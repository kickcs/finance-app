import type { AccountInsert, TransactionInsert, DebtInsert, ReminderInsert } from '@/shared/api'

export interface DemoAccountData {
  name: string
  icon: string
  color: string
  type: 'basic' | 'savings'
  balances: Array<{ currency: string; balance: number }>
}

export interface DemoTransactionData {
  accountIndex: number
  category_id: string
  amount: number
  currency: string
  type: 'income' | 'expense'
  description: string
  date: string
}

export interface DemoDebtData {
  name: string
  total_amount: number
  remaining_amount: number
  currency: string
  debt_type: 'given' | 'taken'
  person_name: string
}

export interface DemoReminderData {
  name: string
  amount: number
  frequency: 'weekly' | 'monthly' | 'yearly' | 'once'
  next_date: string
  icon: string
  color: string
}

export interface GeneratedDemoData {
  accounts: DemoAccountData[]
  transactions: DemoTransactionData[]
  debt: DemoDebtData
  reminders: DemoReminderData[]
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
}

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
}

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
]

// Income categories with weights
const INCOME_CATEGORIES: Array<{ id: string; weight: number }> = [
  { id: 'freelance', weight: 40 },
  { id: 'cashback', weight: 30 },
  { id: 'gifts_income', weight: 15 },
  { id: 'investments', weight: 10 },
  { id: 'other_income', weight: 5 },
]

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function roundToThousand(amount: number): number {
  return Math.round(amount / 1000) * 1000
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight

  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item
  }

  return items[items.length - 1]
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getNextMonthDate(dayOfMonth: number): string {
  const now = new Date()
  const nextDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth)

  // If the day has passed this month, move to next month
  if (nextDate <= now) {
    nextDate.setMonth(nextDate.getMonth() + 1)
  }

  return formatDate(nextDate)
}

function generateTransactions(): DemoTransactionData[] {
  const transactions: DemoTransactionData[] = []
  const now = new Date()

  // Generate transactions for the last 30 days
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const date = new Date(now)
    date.setDate(date.getDate() - daysAgo)
    const dateStr = formatDate(date)

    // 2-5 transactions per day
    const txCount = randomBetween(2, 5)

    for (let i = 0; i < txCount; i++) {
      // 80% expenses, 20% income (excluding salary)
      const isExpense = Math.random() < 0.8

      if (isExpense) {
        const category = pickWeighted(EXPENSE_CATEGORIES)
        const amounts = CATEGORY_AMOUNTS[category.id]
        const amount = roundToThousand(randomBetween(amounts.min, amounts.max))
        const descriptions = CATEGORY_DESCRIPTIONS[category.id]

        transactions.push({
          accountIndex: Math.random() < 0.6 ? 1 : 0, // 60% card, 40% wallet
          category_id: category.id,
          amount,
          currency: 'UZS',
          type: 'expense',
          description: pickRandom(descriptions),
          date: dateStr,
        })
      } else {
        const category = pickWeighted(INCOME_CATEGORIES)
        const amounts = CATEGORY_AMOUNTS[category.id]
        const amount = roundToThousand(randomBetween(amounts.min, amounts.max))
        const descriptions = CATEGORY_DESCRIPTIONS[category.id]

        transactions.push({
          accountIndex: Math.random() < 0.7 ? 1 : 0, // 70% to card
          category_id: category.id,
          amount,
          currency: 'UZS',
          type: 'income',
          description: pickRandom(descriptions),
          date: dateStr,
        })
      }
    }
  }

  // Add salary on 1st and 15th of current month
  const salaryAmount = roundToThousand(randomBetween(8000000, 12000000))

  // Salary on 1st
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  if (firstOfMonth <= now) {
    transactions.push({
      accountIndex: 1, // Card
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Зарплата',
      date: formatDate(firstOfMonth),
    })
  }

  // Salary on 15th
  const fifteenthOfMonth = new Date(now.getFullYear(), now.getMonth(), 15)
  if (fifteenthOfMonth <= now) {
    transactions.push({
      accountIndex: 1, // Card
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Аванс',
      date: formatDate(fifteenthOfMonth),
    })
  }

  // Add salary from previous month if within 30 days
  const prevMonth1st = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth15th = new Date(now.getFullYear(), now.getMonth() - 1, 15)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  if (prevMonth1st >= thirtyDaysAgo) {
    transactions.push({
      accountIndex: 1,
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Зарплата',
      date: formatDate(prevMonth1st),
    })
  }

  if (prevMonth15th >= thirtyDaysAgo) {
    transactions.push({
      accountIndex: 1,
      category_id: 'salary',
      amount: salaryAmount,
      currency: 'UZS',
      type: 'income',
      description: 'Аванс',
      date: formatDate(prevMonth15th),
    })
  }

  return transactions
}

export function generateDemoData(): GeneratedDemoData {
  const transactions = generateTransactions()

  // Calculate realistic balances based on transactions
  // Start with base amounts and adjust
  const walletBalance = randomBetween(800000, 2000000)
  const cardBalanceUZS = randomBetween(3000000, 8000000)
  const cardBalanceUSD = randomBetween(100, 500)
  const savingsBalance = randomBetween(5000000, 15000000)

  return {
    accounts: [
      {
        name: 'Кошелёк',
        icon: 'account_balance_wallet',
        color: '#3b82f6',
        type: 'basic',
        balances: [{ currency: 'UZS', balance: roundToThousand(walletBalance) }],
      },
      {
        name: 'Карта Visa',
        icon: 'credit_card',
        color: '#10b981',
        type: 'basic',
        balances: [
          { currency: 'UZS', balance: roundToThousand(cardBalanceUZS) },
          { currency: 'USD', balance: cardBalanceUSD },
        ],
      },
      {
        name: 'Накопления',
        icon: 'savings',
        color: '#a855f7',
        type: 'savings',
        balances: [{ currency: 'UZS', balance: roundToThousand(savingsBalance) }],
      },
    ],
    transactions,
    debt: {
      name: 'Долг Ахмеду',
      total_amount: 500000,
      remaining_amount: 500000,
      currency: 'UZS',
      debt_type: 'given',
      person_name: 'Ахмед',
    },
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
  }
}
