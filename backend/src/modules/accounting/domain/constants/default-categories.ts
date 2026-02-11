export interface DefaultCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'transfer';
}

export const EXPENSE_CATEGORIES: DefaultCategory[] = [
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

export const INCOME_CATEGORIES: DefaultCategory[] = [
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

export const DEBT_CATEGORIES: DefaultCategory[] = [
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

export const TRANSFER_CATEGORY: DefaultCategory = {
  id: 'transfer',
  name: 'Перевод',
  icon: 'swap_horiz',
  color: '#6366f1',
  type: 'transfer',
};

export const ALL_DEFAULT_CATEGORIES: DefaultCategory[] = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...DEBT_CATEGORIES,
  TRANSFER_CATEGORY,
];

// Map for quick lookup by ID
export const DEFAULT_CATEGORIES_MAP = new Map<string, DefaultCategory>(
  ALL_DEFAULT_CATEGORIES.map((cat) => [cat.id, cat]),
);

export function getDefaultCategoryById(
  id: string,
): DefaultCategory | undefined {
  return DEFAULT_CATEGORIES_MAP.get(id);
}
