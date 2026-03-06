import type { Category } from './types';

export const EXPENSE_CATEGORIES: Category[] = [
  {
    id: 'groceries',
    name: 'Продукты',
    icon: 'shopping_basket',
    color: '#10b981',
    type: 'expense',
  },
  {
    id: 'transport',
    name: 'Транспорт',
    icon: 'directions_car',
    color: '#3b82f6',
    type: 'expense',
  },
  {
    id: 'health',
    name: 'Здоровье',
    icon: 'cardiology',
    color: '#f43f5e',
    type: 'expense',
  },
  {
    id: 'housing',
    name: 'Жилье',
    icon: 'cottage',
    color: '#6366f1',
    type: 'expense',
  },
  {
    id: 'cafe',
    name: 'Кафе',
    icon: 'restaurant',
    color: '#f97316',
    type: 'expense',
  },
  {
    id: 'entertainment',
    name: 'Досуг',
    icon: 'movie',
    color: '#a855f7',
    type: 'expense',
  },
  {
    id: 'gifts',
    name: 'Подарки',
    icon: 'volunteer_activism',
    color: '#ec4899',
    type: 'expense',
  },
  {
    id: 'education',
    name: 'Образование',
    icon: 'school',
    color: '#06b6d4',
    type: 'expense',
  },
  {
    id: 'family',
    name: 'Семья',
    icon: 'family_restroom',
    color: '#14b8a6',
    type: 'expense',
  },
  {
    id: 'sport',
    name: 'Спорт',
    icon: 'fitness_center',
    color: '#84cc16',
    type: 'expense',
  },
  {
    id: 'travel',
    name: 'Путешествия',
    icon: 'flight',
    color: '#f59e0b',
    type: 'expense',
  },
  {
    id: 'other_expense',
    name: 'Другое',
    icon: 'more_horiz',
    color: '#64748b',
    type: 'expense',
  },
];

export const INCOME_CATEGORIES: Category[] = [
  {
    id: 'salary',
    name: 'Зарплата',
    icon: 'payments',
    color: '#10b981',
    type: 'income',
  },
  {
    id: 'freelance',
    name: 'Фриланс',
    icon: 'work',
    color: '#3b82f6',
    type: 'income',
  },
  {
    id: 'investments',
    name: 'Инвестиции',
    icon: 'trending_up',
    color: '#a855f7',
    type: 'income',
  },
  {
    id: 'gifts_income',
    name: 'Подарки',
    icon: 'redeem',
    color: '#ec4899',
    type: 'income',
  },
  {
    id: 'cashback',
    name: 'Кэшбек',
    icon: 'credit_score',
    color: '#f59e0b',
    type: 'income',
  },
  {
    id: 'other_income',
    name: 'Другое',
    icon: 'more_horiz',
    color: '#64748b',
    type: 'income',
  },
];

// Debt-related categories (excluded from money flow calculations)
/** Set of all debt-related category IDs — used to exclude debt transactions from daily totals. */
export const DEBT_CATEGORY_IDS = new Set([
  'debt_given',
  'debt_taken',
  'debt_return_to_me',
  'debt_return_from_me',
]);

export const DEBT_CATEGORIES: Category[] = [
  {
    id: 'debt_given',
    name: 'Дал в долг',
    icon: 'arrow_upward',
    color: '#f59e0b',
    type: 'expense',
  },
  {
    id: 'debt_taken',
    name: 'Взял в долг',
    icon: 'arrow_downward',
    color: '#8b5cf6',
    type: 'income',
  },
  {
    id: 'debt_return_to_me',
    name: 'Возврат долга (мне)',
    icon: 'reply',
    color: '#10b981',
    type: 'income',
  },
  {
    id: 'debt_return_from_me',
    name: 'Возврат долга (от меня)',
    icon: 'reply_all',
    color: '#ef4444',
    type: 'expense',
  },
];

// Re-export from shared for backwards compatibility (canonical source: shared/config/categoryIds.ts)
export { CATEGORY_IDS } from '@/shared/config/categoryIds';

// Transfer category (special - auto-assigned for transfers)
export const TRANSFER_CATEGORY: Category = {
  id: 'transfer',
  name: 'Перевод',
  icon: 'swap_horiz',
  color: '#6366f1',
  type: 'transfer',
};

// Commission category (special - auto-assigned for transfer commissions)
export const COMMISSION_CATEGORY: Category = {
  id: 'commission',
  name: 'Комиссия',
  icon: 'receipt_long',
  color: '#ef4444',
  type: 'expense',
};

// Balance adjustment category (special - auto-assigned for balance adjustments)
export const ADJUSTMENT_CATEGORY: Category = {
  id: 'balance_adjustment',
  name: 'Коррекция баланса',
  icon: 'tune',
  color: '#64748b',
  type: 'adjustment',
};

export const ALL_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
  COMMISSION_CATEGORY,
  ADJUSTMENT_CATEGORY,
];

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find((cat) => cat.id === id);
}

export function getCategoriesByType(
  type: 'expense' | 'income' | 'transfer' | 'adjustment',
): Category[] {
  if (type === 'transfer') return [TRANSFER_CATEGORY];
  if (type === 'adjustment') return [ADJUSTMENT_CATEGORY];
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
}
